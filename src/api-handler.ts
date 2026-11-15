import { GoogleGenAI, Type } from '@google/genai';
import type { SocialDiscoverySource, SocialProfiles } from './types.ts';

export interface ClassifyInput {
  businessName: string;
  city?: string;
  state?: string;
  category?: string;
  rating?: number | null;
  userRatingCount?: number | null;
  hasManualInspection: boolean;
  reviewsInspectedCount?: number;
  negativeReviewsCount?: number;
  negativeWithRepliesCount?: number;
  unansweredNegativeCount?: number;
  inspectionNotes?: string;
}

export interface ClassificationResult {
  opportunity: 'HIGH' | 'MEDIUM' | 'LOW' | 'UNVERIFIED';
  rationale: string;
  verifiedEvidence: string[];
  assumptions: string[];
  replyNationPitchAngle: string;
}

interface ExtractedSocials {
  instagram?: string;
  instagramHandle?: string;
  instagramConfidence?: 'website_verified' | 'directory_verified' | 'search_match';
  facebook?: string;
  tiktok?: string;
  twitter?: string;
  youtube?: string;
  websiteEmail?: string;
  emailSource?: string;
  emailConfidence?: 'verified_domain' | 'site_listed' | 'external_match' | 'unverified';
  websiteReachable?: boolean;
  websiteStatusCode?: number;
}

let geminiQuotaCooldownUntil = 0;
let lastCooldownLogAt = 0;
let geminiSearchQueue: Promise<void> = Promise.resolve();

function isRateLimitOrQuotaError(err: unknown): boolean {
  const msg =
    err instanceof Error
      ? err.message
      : typeof err === 'string'
        ? err
        : JSON.stringify(err || '');
  return (
    msg.includes('429') ||
    msg.includes('RESOURCE_EXHAUSTED') ||
    msg.toLowerCase().includes('quota') ||
    msg.toLowerCase().includes('rate limit')
  );
}

function triggerGeminiCooldown(err: unknown): void {
  const now = Date.now();
  // Enter a 5-minute cooldown when Gemini quota/rate limits are reached
  geminiQuotaCooldownUntil = now + 5 * 60 * 1000;
  if (now - lastCooldownLogAt > 60_000) {
    lastCooldownLogAt = now;
    console.info(
      'Gemini API rate limit/quota reached; pausing Gemini calls for 5 minutes and using free directory & rule-based fallbacks.'
    );
  }
  void err;
}

function isGeminiAvailable(): boolean {
  return Date.now() >= geminiQuotaCooldownUntil;
}

function enqueueGeminiSearch<T>(task: () => Promise<T>): Promise<T> {
  const run = geminiSearchQueue.then(async () => {
    const result = await task();
    // Brief spacing between Gemini Google Search calls to stay within RPM limits
    await new Promise((r) => setTimeout(r, 350));
    return result;
  });
  geminiSearchQueue = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || !isGeminiAvailable()) return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

const IG_IGNORED_PATHS = new Set([
  'p',
  'reel',
  'reels',
  'tv',
  'explore',
  'accounts',
  'developer',
  'about',
  'legal',
  'directory',
  'tags',
  'direct',
  'stories',
  'share',
  'oauth',
]);

// Website builders, SaaS platforms, and review aggregators frequently embedded in footers
const PLATFORM_SOCIAL_HANDLES = new Set([
  'wix',
  'wixstudio',
  'squarespace',
  'wordpress',
  'wordpressdotcom',
  'shopify',
  'webflow',
  'godaddy',
  'framer',
  'elementor',
  'bentobox',
  'getbentobox',
  'popmenu',
  'toasttab',
  'spoton',
  'chownow',
  'clover',
  'square',
  'squareup',
  'mindbody',
  'vagaro',
  'fresha',
  'yelp',
  'opentable',
  'resy',
  'doordash',
  'ubereats',
  'grubhub',
  'postmates',
  'google',
  'facebook',
  'instagram',
  'tiktok',
  'twitter',
  'youtube',
  'linkedin',
  'hubspot',
  'mailchimp',
]);

const FB_IGNORED_PATHS = new Set([
  'sharer',
  'sharer.php',
  'share',
  'dialog',
  'tr',
  'policies',
  'privacy',
  'groups',
  'events',
  'marketplace',
  'watch',
  'help',
  'plugins',
  'login',
  'pg',
  '2008',
  'pages',
  'people',
  'p',
  'photo',
  'photos',
  'videos',
  'notes',
  'l.php',
  'home.php',
  'docs',
  'business',
  'about',
  'profile.php',
]);

const TW_IGNORED_PATHS = new Set([
  'intent',
  'share',
  'home',
  'search',
  'privacy',
  'tos',
  'i',
  'hashtag',
]);

const JUNK_EMAIL_DOMAINS = new Set([
  'example.com',
  'example.org',
  'example.net',
  'sentry.io',
  'wixpress.com',
  'wix.com',
  'squarespace.com',
  'godaddy.com',
  'wordpress.org',
  'wordpress.com',
  'cloudflare.com',
  'googleapis.com',
  'gstatic.com',
  'w3.org',
  'schema.org',
  'yourdomain.com',
  'domain.com',
  'yoursite.com',
  'email.com',
  'test.com',
  'latofonts.com',
  'fontawesome.com',
  'jquery.com',
  'shopify.com',
  'toasttab.com',
  'bentobox.com',
  'webflow.io',
  'mailchimp.com',
  'hubspot.com',
  'zendesk.com',
  'intercom.io',
  'yelp.com',
  'clutch.co',
  'bbb.org',
]);

const FREE_MAIL_PROVIDERS = new Set([
  'gmail.com',
  'yahoo.com',
  'outlook.com',
  'hotmail.com',
  'icloud.com',
  'aol.com',
  'proton.me',
  'protonmail.com',
  'me.com',
  'live.com',
]);

function getRootDomain(urlOrDomain?: string): string | undefined {
  if (!urlOrDomain) return undefined;
  try {
    const withProto = urlOrDomain.startsWith('http') ? urlOrDomain : `https://${urlOrDomain}`;
    const host = new URL(withProto).hostname.toLowerCase().replace(/^www\./, '');
    const parts = host.split('.').filter(Boolean);
    if (parts.length >= 2) {
      return parts.slice(-2).join('.');
    }
    return host || undefined;
  } catch {
    return undefined;
  }
}

function getBusinessNameTokens(businessName: string): string[] {
  const stopWords = new Set([
    'the',
    'and',
    'llc',
    'inc',
    'corp',
    'co',
    'ltd',
    'group',
    'services',
    'company',
    'agency',
    'solutions',
    'studio',
    'restaurant',
    'clinic',
  ]);
  return businessName
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 4 && !stopWords.has(w));
}

function isJunkEmail(email: string): boolean {
  const lower = email.trim().toLowerCase();
  if (!/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,12}$/.test(lower)) {
    return true;
  }
  const [local, domain] = lower.split('@');
  if (!local || !domain) return true;

  if (/\.(png|jpg|jpeg|gif|svg|webp|css|js|woff|woff2|pdf)$/i.test(lower)) {
    return true;
  }
  if (JUNK_EMAIL_DOMAINS.has(domain)) return true;
  for (const blocked of JUNK_EMAIL_DOMAINS) {
    if (domain.endsWith(`.${blocked}`)) return true;
  }

  if (
    /^(no-?reply|donotreply|do-not-reply|bounce|mailer-daemon|postmaster|abuse|dmca|webmaster|u00\d+|2x|3x|test|user|name|yourname)/.test(
      local
    )
  ) {
    return true;
  }

  return false;
}

function isExternalEmailPlausible(
  email: string,
  businessName: string,
  websiteUrl?: string
): { plausible: boolean; confidence: 'verified_domain' | 'external_match' } {
  const lower = email.trim().toLowerCase();
  if (isJunkEmail(lower)) {
    return { plausible: false, confidence: 'external_match' };
  }
  const [local, domain] = lower.split('@');
  const siteRoot = getRootDomain(websiteUrl);
  const emailRoot = getRootDomain(domain);

  if (siteRoot && emailRoot && siteRoot === emailRoot) {
    return { plausible: true, confidence: 'verified_domain' };
  }

  const tokens = getBusinessNameTokens(businessName);
  const compactDomain = domain.replace(/[^a-z0-9]/g, '');
  const compactLocal = local.replace(/[^a-z0-9]/g, '');

  if (FREE_MAIL_PROVIDERS.has(domain)) {
    // Require at least one business token in the local-part for free email providers found externally
    const matchesName = tokens.some((t) => compactLocal.includes(t));
    return { plausible: matchesName || !websiteUrl, confidence: 'external_match' };
  }

  // Commercial domain from external search: must match business name token if website wasn't available
  const matchesBusinessDomain = tokens.some((t) => compactDomain.includes(t));
  return { plausible: matchesBusinessDomain, confidence: 'external_match' };
}

function normalizeInstagramUrl(raw?: string | null): { url?: string; handle?: string } {
  if (!raw || typeof raw !== 'string') return {};
  const clean = raw.startsWith('http') ? raw : raw.startsWith('//') ? `https:${raw}` : `https://${raw}`;
  const match = clean.match(/instagram\.com\/([a-zA-Z0-9_.]{2,30})(?:\/|\?|$)/i);
  if (match && match[1]) {
    const slug = match[1];
    const lowerSlug = slug.toLowerCase();
    if (!IG_IGNORED_PATHS.has(lowerSlug) && !PLATFORM_SOCIAL_HANDLES.has(lowerSlug)) {
      return {
        url: `https://www.instagram.com/${slug}/`,
        handle: `@${slug}`,
      };
    }
  }
  return {};
}

function normalizeFacebookUrl(raw?: string | null): string | undefined {
  if (!raw || typeof raw !== 'string') return undefined;
  const clean = raw.startsWith('http') ? raw : raw.startsWith('//') ? `https:${raw}` : `https://${raw}`;
  // Handle /pages/Name/ID or /p/Name-ID cleanly
  const pageMatch = clean.match(/(?:facebook\.com|fb\.com)\/(pages\/[a-zA-Z0-9_.-]+\/\d+|p\/[a-zA-Z0-9_.-]+)/i);
  if (pageMatch && pageMatch[1]) {
    return `https://www.facebook.com/${pageMatch[1]}`;
  }
  const match = clean.match(/(?:facebook\.com|fb\.com)\/([a-zA-Z0-9_.-]{3,60})(?:\/|\?|$)/i);
  if (match && match[1]) {
    const slug = match[1].toLowerCase();
    if (!FB_IGNORED_PATHS.has(slug) && !PLATFORM_SOCIAL_HANDLES.has(slug) && !/^\d+$/.test(slug)) {
      return `https://www.facebook.com/${match[1]}`;
    }
  }
  return undefined;
}

function normalizeTikTokUrl(raw?: string | null): string | undefined {
  if (!raw || typeof raw !== 'string') return undefined;
  const clean = raw.startsWith('http') ? raw : raw.startsWith('//') ? `https:${raw}` : `https://${raw}`;
  const match = clean.match(/tiktok\.com\/@([a-zA-Z0-9_.-]{2,30})(?:\/|\?|$)/i);
  if (match && match[1] && !PLATFORM_SOCIAL_HANDLES.has(match[1].toLowerCase())) {
    return `https://www.tiktok.com/@${match[1]}`;
  }
  return undefined;
}

function normalizeTwitterUrl(raw?: string | null): string | undefined {
  if (!raw || typeof raw !== 'string') return undefined;
  const clean = raw.startsWith('http') ? raw : raw.startsWith('//') ? `https:${raw}` : `https://${raw}`;
  const match = clean.match(/(?:twitter\.com|x\.com)\/([a-zA-Z0-9_]{2,20})(?:\/|\?|$)/i);
  if (
    match &&
    match[1] &&
    !TW_IGNORED_PATHS.has(match[1].toLowerCase()) &&
    !PLATFORM_SOCIAL_HANDLES.has(match[1].toLowerCase())
  ) {
    return `https://twitter.com/${match[1]}`;
  }
  return undefined;
}

function normalizeYouTubeUrl(raw?: string | null): string | undefined {
  if (!raw || typeof raw !== 'string') return undefined;
  const clean = raw.startsWith('http') ? raw : raw.startsWith('//') ? `https:${raw}` : `https://${raw}`;
  const match = clean.match(/(?:https?:\/\/)?(?:www\.)?youtube\.com\/(?:@|c\/|channel\/)([a-zA-Z0-9_.-]+)/i);
  if (match) {
    return clean.split(/[?#\s"']/)[0];
  }
  return undefined;
}

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&#64;|&#x40;/gi, '@')
    .replace(/&#46;|&#x2e;/gi, '.')
    .replace(/&amp;/gi, '&');
}

interface EmailCandidate {
  email: string;
  source: string;
}

function pickBestSiteEmail(
  candidates: EmailCandidate[],
  websiteUrl?: string
): {
  email?: string;
  source?: string;
  confidence?: 'verified_domain' | 'site_listed';
} {
  if (candidates.length === 0) return {};

  const siteRoot = getRootDomain(websiteUrl);
  const scored = new Map<
    string,
    { email: string; source: string; score: number; matchesDomain: boolean }
  >();

  for (const c of candidates) {
    const email = c.email.trim().toLowerCase();
    if (isJunkEmail(email)) continue;

    const [local, domain] = email.split('@');
    const emailRoot = getRootDomain(domain);
    const matchesDomain = Boolean(siteRoot && emailRoot && siteRoot === emailRoot);

    let score = 0;
    if (matchesDomain) score += 100;
    else if (FREE_MAIL_PROVIDERS.has(domain)) score += 35;
    else score += 10;

    if (c.source === 'website_schema') score += 30;
    else if (c.source === 'website_mailto' || c.source === 'contact_page') score += 25;
    else if (c.source === 'website_text') score += 12;

    if (
      /^(info|contact|hello|office|team|sales|bookings|appointments|reservations|admin|support|inquiries|frontdesk|help)$/.test(
        local
      )
    ) {
      score += 20;
    }
    if (/^(privacy|legal|dmca|accessibility|compliance|careers|jobs)$/.test(local)) {
      score -= 30;
    }

    const existing = scored.get(email);
    if (!existing || score > existing.score) {
      scored.set(email, { email, source: c.source, score, matchesDomain });
    }
  }

  const best = Array.from(scored.values()).sort((a, b) => b.score - a.score)[0];
  if (!best) return {};

  return {
    email: best.email,
    source: best.source,
    confidence: best.matchesDomain ? 'verified_domain' : 'site_listed',
  };
}

function extractJsonLdSignals(html: string): {
  sameAsUrls: string[];
  emails: string[];
} {
  const sameAsUrls: string[] = [];
  const emails: string[] = [];

  const scriptRegex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = scriptRegex.exec(html)) !== null) {
    try {
      const parsed = JSON.parse(match[1].trim());
      const visit = (node: unknown) => {
        if (!node || typeof node !== 'object') return;
        if (Array.isArray(node)) {
          node.forEach(visit);
          return;
        }
        const obj = node as Record<string, unknown>;
        if (typeof obj.email === 'string') {
          emails.push(obj.email.replace(/^mailto:/i, '').trim());
        }
        if (typeof obj.sameAs === 'string') {
          sameAsUrls.push(obj.sameAs);
        } else if (Array.isArray(obj.sameAs)) {
          obj.sameAs.forEach((item) => {
            if (typeof item === 'string') sameAsUrls.push(item);
          });
        }
        Object.values(obj).forEach((v) => {
          if (v && typeof v === 'object') visit(v);
        });
      };
      visit(parsed);
    } catch {
      // ignore malformed JSON-LD blocks
    }
  }

  return { sameAsUrls, emails };
}

function extractSocialsFromHtml(
  rawHtml: string,
  websiteUrl?: string,
  pageKind: 'home' | 'contact' = 'home'
): ExtractedSocials {
  const html = decodeHtmlEntities(rawHtml);
  const result: ExtractedSocials = {};
  const jsonLd = extractJsonLdSignals(html);

  // Combine JSON-LD sameAs URLs first (highest precision), then HTML URLs
  const allCandidateText = `${jsonLd.sameAsUrls.join('\n')}\n${html}`;

  // 1. Instagram
  const igMatches = allCandidateText.match(
    /(?:https?:)?\/\/(?:www\.)?instagram\.com\/([a-zA-Z0-9_.]{2,30})\/?(?=[^a-zA-Z0-9_.]|$)/gi
  );
  if (igMatches) {
    for (const rawUrl of igMatches) {
      const normalized = normalizeInstagramUrl(rawUrl);
      if (normalized.url) {
        result.instagram = normalized.url;
        result.instagramHandle = normalized.handle;
        result.instagramConfidence = 'website_verified';
        break;
      }
    }
  }

  // 2. Facebook
  const fbMatches = allCandidateText.match(
    /(?:https?:)?\/\/(?:www\.)?(?:facebook\.com|fb\.com)\/([a-zA-Z0-9_.-]{3,60})\/?(?=[^a-zA-Z0-9_.-]|$)/gi
  );
  if (fbMatches) {
    for (const rawUrl of fbMatches) {
      const fb = normalizeFacebookUrl(rawUrl);
      if (fb) {
        result.facebook = fb;
        break;
      }
    }
  }

  // 3. TikTok
  const tiktokMatches = allCandidateText.match(
    /(?:https?:)?\/\/(?:www\.)?tiktok\.com\/@([a-zA-Z0-9_.-]{2,30})\/?/gi
  );
  if (tiktokMatches) {
    for (const rawUrl of tiktokMatches) {
      const tt = normalizeTikTokUrl(rawUrl);
      if (tt) {
        result.tiktok = tt;
        break;
      }
    }
  }

  // 4. Twitter / X
  const twMatches = allCandidateText.match(
    /(?:https?:)?\/\/(?:www\.)?(?:twitter\.com|x\.com)\/([a-zA-Z0-9_]{2,20})\/?/gi
  );
  if (twMatches) {
    for (const rawUrl of twMatches) {
      const tw = normalizeTwitterUrl(rawUrl);
      if (tw) {
        result.twitter = tw;
        break;
      }
    }
  }

  // 5. YouTube
  const ytMatches = allCandidateText.match(
    /(?:https?:)?\/\/(?:www\.)?youtube\.com\/(?:@|c\/|channel\/)([a-zA-Z0-9_.-]+)/gi
  );
  if (ytMatches && ytMatches.length > 0) {
    result.youtube = normalizeYouTubeUrl(ytMatches[0]);
  }

  // 6. Email candidates from JSON-LD, mailto:, and visible text
  const emailCandidates: EmailCandidate[] = [];

  for (const ldEmail of jsonLd.emails) {
    emailCandidates.push({ email: ldEmail, source: 'website_schema' });
  }

  const mailtoRegex = /mailto:([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,12})/gi;
  let mailtoMatch: RegExpExecArray | null;
  while ((mailtoMatch = mailtoRegex.exec(html)) !== null) {
    emailCandidates.push({
      email: mailtoMatch[1],
      source: pageKind === 'contact' ? 'contact_page' : 'website_mailto',
    });
  }

  // Scan visible text (strip script/style tags first to avoid JS bundle noise)
  const visibleText = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ');
  const textEmails = visibleText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,12}/g);
  if (textEmails) {
    for (const rawEmail of textEmails.slice(0, 15)) {
      emailCandidates.push({
        email: rawEmail,
        source: pageKind === 'contact' ? 'contact_page' : 'website_text',
      });
    }
  }

  const bestEmail = pickBestSiteEmail(emailCandidates, websiteUrl);
  if (bestEmail.email) {
    result.websiteEmail = bestEmail.email;
    result.emailSource = bestEmail.source;
    result.emailConfidence = bestEmail.confidence;
  }

  return result;
}

interface HtmlFetchResult {
  html: string | null;
  finalUrl?: string;
  statusCode?: number;
  reachable: boolean;
}

async function fetchHtmlWithTimeout(url: string, timeoutMs = 5000): Promise<HtmlFetchResult> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      redirect: 'follow',
    });

    clearTimeout(timeout);
    if (!response.ok) {
      return {
        html: null,
        finalUrl: response.url || url,
        statusCode: response.status,
        reachable: false,
      };
    }
    const html = await response.text();
    return {
      html,
      finalUrl: response.url || url,
      statusCode: response.status,
      reachable: true,
    };
  } catch {
    return { html: null, reachable: false };
  }
}

async function scanWebsiteForSocials(websiteUrl: string): Promise<ExtractedSocials> {
  if (!websiteUrl || !websiteUrl.startsWith('http')) {
    return {};
  }

  const homeRes = await fetchHtmlWithTimeout(websiteUrl, 5500);
  if (!homeRes.html) {
    return {
      websiteReachable: homeRes.reachable,
      websiteStatusCode: homeRes.statusCode,
    };
  }

  const effectiveSiteUrl = homeRes.finalUrl || websiteUrl;
  const primary = extractSocialsFromHtml(homeRes.html, effectiveSiteUrl, 'home');
  primary.websiteReachable = true;
  primary.websiteStatusCode = homeRes.statusCode;

  // Check Linktree or /contact & /about pages whenever EITHER Instagram OR a verified email is missing
  if (!primary.instagram || !primary.websiteEmail || primary.emailConfidence !== 'verified_domain') {
    const secondaryUrls: string[] = [];

    const linktreeMatch = homeRes.html.match(
      /https?:\/\/(?:linktr\.ee|beacons\.ai|bento\.me)\/[a-zA-Z0-9_.-]+/i
    );
    if (linktreeMatch?.[0]) {
      secondaryUrls.push(linktreeMatch[0]);
    }

    const contactMatches = Array.from(
      homeRes.html.matchAll(/href=["']([^"']*(?:contact|about|connect|team)[^"']*)["']/gi)
    );
    const siteOrigin = (() => {
      try {
        return new URL(effectiveSiteUrl).origin;
      } catch {
        return '';
      }
    })();

    for (const m of contactMatches) {
      if (secondaryUrls.length >= 2) break;
      try {
        const resolved = new URL(m[1], effectiveSiteUrl);
        if (
          resolved.origin === siteOrigin &&
          resolved.href !== effectiveSiteUrl &&
          !/\.(pdf|jpg|png|css|js)$/i.test(resolved.pathname) &&
          !secondaryUrls.includes(resolved.href)
        ) {
          secondaryUrls.push(resolved.href);
        }
      } catch {
        // ignore invalid href
      }
    }

    // Common fallback /contact path if no explicit link was found and email is still missing
    if (secondaryUrls.length === 0 && !primary.websiteEmail && siteOrigin) {
      secondaryUrls.push(`${siteOrigin}/contact`);
    }

    for (const subUrl of secondaryUrls.slice(0, 2)) {
      const subRes = await fetchHtmlWithTimeout(subUrl, 3800);
      if (!subRes.html) continue;

      const extra = extractSocialsFromHtml(subRes.html, effectiveSiteUrl, 'contact');
      if (!primary.instagram && extra.instagram) {
        primary.instagram = extra.instagram;
        primary.instagramHandle = extra.instagramHandle;
        primary.instagramConfidence = 'website_verified';
      }
      if (!primary.facebook && extra.facebook) primary.facebook = extra.facebook;
      if (!primary.tiktok && extra.tiktok) primary.tiktok = extra.tiktok;
      if (!primary.twitter && extra.twitter) primary.twitter = extra.twitter;
      if (!primary.youtube && extra.youtube) primary.youtube = extra.youtube;

      // Upgrade email if we didn't have one or found a verified domain email on /contact
      if (
        extra.websiteEmail &&
        (!primary.websiteEmail ||
          (primary.emailConfidence !== 'verified_domain' &&
            extra.emailConfidence === 'verified_domain'))
      ) {
        primary.websiteEmail = extra.websiteEmail;
        primary.emailSource = extra.emailSource;
        primary.emailConfidence = extra.emailConfidence;
      }

      if (primary.instagram && primary.emailConfidence === 'verified_domain') {
        break;
      }
    }
  }

  return primary;
}

function extractJsonObject(text: string): Record<string, unknown> | null {
  const cleaned = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return null;
  }
}

async function discoverSocialsViaGoogleSearch(
  businessName: string,
  city: string,
  state: string,
  websiteUrl?: string
): Promise<{
  socials: ExtractedSocials;
  discoveredSources: Array<{ title?: string; url: string }>;
}> {
  if (!businessName.trim() || !isGeminiAvailable() || !process.env.GEMINI_API_KEY) {
    return { socials: {}, discoveredSources: [] };
  }

  return enqueueGeminiSearch(async () => {
    const ai = getGeminiClient();
    if (!ai) {
      return { socials: {}, discoveredSources: [] };
    }

    const locationStr = [city, state].filter(Boolean).join(', ');
    const prompt = `Use Google Search to find the official social media profiles (especially Instagram) and publicly listed business contact email for this specific US business across Google, Instagram, Facebook, TikTok, LinkedIn, Linktree, Yelp, Clutch, or official directories.

Business Name: ${businessName}
Location: ${locationStr || 'United States'}
Official Website (if known): ${websiteUrl || 'Not listed'}

Strict verification rules:
1. Only include profile URLs and emails that genuinely appear in Google Search results and clearly belong to "${businessName}" in ${locationStr || 'its US location'}.
2. Do NOT guess or fabricate handles or emails, and NEVER return aggregator/directory emails (like yelp.com or clutch.co) or website-builder handles (like wix/squarespace). If unverified, set to null.
3. Return ONLY a JSON object with this exact shape:
{
  "instagram": "https://www.instagram.com/handle/" or null,
  "facebook": "https://www.facebook.com/page" or null,
  "tiktok": "https://www.tiktok.com/@handle" or null,
  "twitter": "https://twitter.com/handle" or null,
  "youtube": "https://www.youtube.com/@channel" or null,
  "email": "public@domain.com" or null
}`;

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config: {
          tools: [{ googleSearch: {} }],
        },
      });

      const discoveredSources: Array<{ title?: string; url: string }> = [];
      const socials: ExtractedSocials = {};

      // Extract verified links from Google Search grounding metadata
      const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
      for (const chunk of chunks) {
        const uri = chunk.web?.uri;
        const title = chunk.web?.title;
        if (uri) {
          discoveredSources.push({ title: title || undefined, url: uri });

          if (!socials.instagram) {
            const ig = normalizeInstagramUrl(uri);
            if (ig.url) {
              socials.instagram = ig.url;
              socials.instagramHandle = ig.handle;
              socials.instagramConfidence = 'search_match';
            }
          }
          if (!socials.facebook) {
            socials.facebook = normalizeFacebookUrl(uri);
          }
          if (!socials.tiktok) {
            socials.tiktok = normalizeTikTokUrl(uri);
          }
          if (!socials.twitter) {
            socials.twitter = normalizeTwitterUrl(uri);
          }
          if (!socials.youtube) {
            socials.youtube = normalizeYouTubeUrl(uri);
          }
        }
      }

      // Parse structured JSON response from Gemini
      const parsed = response.text ? extractJsonObject(response.text) : null;
      if (parsed) {
        if (!socials.instagram && typeof parsed.instagram === 'string') {
          const ig = normalizeInstagramUrl(parsed.instagram);
          if (ig.url) {
            socials.instagram = ig.url;
            socials.instagramHandle = ig.handle;
            socials.instagramConfidence = 'search_match';
          }
        }
        if (!socials.facebook && typeof parsed.facebook === 'string') {
          socials.facebook = normalizeFacebookUrl(parsed.facebook);
        }
        if (!socials.tiktok && typeof parsed.tiktok === 'string') {
          socials.tiktok = normalizeTikTokUrl(parsed.tiktok);
        }
        if (!socials.twitter && typeof parsed.twitter === 'string') {
          socials.twitter = normalizeTwitterUrl(parsed.twitter);
        }
        if (!socials.youtube && typeof parsed.youtube === 'string') {
          socials.youtube = normalizeYouTubeUrl(parsed.youtube);
        }
        if (typeof parsed.email === 'string') {
          const cleanCandidate = parsed.email.trim().toLowerCase();
          const check = isExternalEmailPlausible(cleanCandidate, businessName, websiteUrl);
          if (check.plausible) {
            socials.websiteEmail = cleanCandidate;
            socials.emailSource = 'google_search';
            socials.emailConfidence = check.confidence;
          }
        }
      }

      // Deduplicate discoveredSources up to 5 entries
      const uniqueSources: Array<{ title?: string; url: string }> = [];
      const seenUrls = new Set<string>();
      for (const src of discoveredSources) {
        if (!seenUrls.has(src.url)) {
          seenUrls.add(src.url);
          uniqueSources.push(src);
          if (uniqueSources.length >= 5) break;
        }
      }

      return { socials, discoveredSources: uniqueSources };
    } catch (err) {
      if (isRateLimitOrQuotaError(err)) {
        triggerGeminiCooldown(err);
      } else {
        console.info(
          `Google Search social discovery skipped for "${businessName}":`,
          err instanceof Error ? err.message : 'unavailable'
        );
      }
      return { socials: {}, discoveredSources: [] };
    }
  });
}

async function fetchJsonWithTimeout(url: string, timeoutMs = 4500): Promise<any | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'ReplyNationProspectFinder/1.0',
        Accept: 'application/json',
      },
    });
    clearTimeout(timeout);
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

function normalizeHandleOrUrl(
  raw: string | undefined,
  platform: 'instagram' | 'facebook' | 'tiktok' | 'twitter'
): string | undefined {
  if (!raw || typeof raw !== 'string') return undefined;
  const trimmed = raw.trim().replace(/^@/, '');
  if (!trimmed) return undefined;

  if (platform === 'instagram') {
    if (trimmed.includes('instagram.com')) {
      return normalizeInstagramUrl(trimmed).url;
    }
    return normalizeInstagramUrl(`https://www.instagram.com/${trimmed}/`).url;
  }
  if (platform === 'facebook') {
    if (trimmed.includes('facebook.com') || trimmed.includes('fb.com')) {
      return normalizeFacebookUrl(trimmed);
    }
    return normalizeFacebookUrl(`https://www.facebook.com/${trimmed}`);
  }
  if (platform === 'tiktok') {
    if (trimmed.includes('tiktok.com')) {
      return normalizeTikTokUrl(trimmed);
    }
    return normalizeTikTokUrl(`https://www.tiktok.com/@${trimmed}`);
  }
  if (platform === 'twitter') {
    if (trimmed.includes('twitter.com') || trimmed.includes('x.com')) {
      return normalizeTwitterUrl(trimmed);
    }
    return normalizeTwitterUrl(`https://twitter.com/${trimmed}`);
  }
  return undefined;
}

/**
 * Fallback lookup via OpenStreetMap Nominatim (extratags) & Wikidata entity claims,
 * plus scanning any official website discovered via OSM/Wikidata if not already scanned.
 */
async function discoverSocialsViaOpenDirectories(
  businessName: string,
  city: string,
  state: string,
  alreadyScannedUrl?: string
): Promise<{
  socials: ExtractedSocials;
  discoveredSources: Array<{ title?: string; url: string }>;
}> {
  if (!businessName.trim()) {
    return { socials: {}, discoveredSources: [] };
  }

  const query = [businessName, city, state].filter(Boolean).join(' ');
  const nominatimUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
    query
  )}&format=json&extratags=1&limit=3`;

  const results = await fetchJsonWithTimeout(nominatimUrl, 4500);
  if (!Array.isArray(results) || results.length === 0) {
    return { socials: {}, discoveredSources: [] };
  }

  const socials: ExtractedSocials = {};
  const discoveredSources: Array<{ title?: string; url: string }> = [];

  // Prefer commercial/amenity/office/shop/tourism entries or first match
  const best =
    results.find(
      (r: any) =>
        r?.class === 'amenity' ||
        r?.class === 'office' ||
        r?.class === 'shop' ||
        r?.class === 'tourism'
    ) || results[0];

  const tags: Record<string, string> = best?.extratags || {};
  if (best?.osm_type && best?.osm_id) {
    discoveredSources.push({
      title: 'OpenStreetMap Listing',
      url: `https://www.openstreetmap.org/${best.osm_type}/${best.osm_id}`,
    });
  }

  const rawIg = tags['contact:instagram'] || tags.instagram;
  if (rawIg) {
    const igUrl = normalizeHandleOrUrl(rawIg, 'instagram');
    if (igUrl) {
      const normalized = normalizeInstagramUrl(igUrl);
      socials.instagram = normalized.url;
      socials.instagramHandle = normalized.handle;
      socials.instagramConfidence = 'directory_verified';
    }
  }
  const rawFb = tags['contact:facebook'] || tags.facebook;
  if (rawFb) {
    socials.facebook = normalizeHandleOrUrl(rawFb, 'facebook');
  }
  const rawTt = tags['contact:tiktok'] || tags.tiktok;
  if (rawTt) {
    socials.tiktok = normalizeHandleOrUrl(rawTt, 'tiktok');
  }
  const rawTw = tags['contact:twitter'] || tags.twitter;
  if (rawTw) {
    socials.twitter = normalizeHandleOrUrl(rawTw, 'twitter');
  }
  const rawEmail = tags['contact:email'] || tags.email;
  if (rawEmail) {
    const check = isExternalEmailPlausible(rawEmail, businessName, alreadyScannedUrl);
    if (check.plausible) {
      socials.websiteEmail = rawEmail.trim().toLowerCase();
      socials.emailSource = 'osm_directory';
      socials.emailConfidence = check.confidence;
    }
  }

  let discoveredWebsite: string | undefined = tags['contact:website'] || tags.website || tags.url;

  // Query Wikidata if linked
  if (tags.wikidata && /^Q\d+$/i.test(tags.wikidata)) {
    const qid = tags.wikidata.toUpperCase();
    const wikidataJson = await fetchJsonWithTimeout(
      `https://www.wikidata.org/wiki/Special:EntityData/${qid}.json`,
      4500
    );
    const entity = wikidataJson?.entities?.[qid];
    const claims = entity?.claims || {};
    discoveredSources.push({
      title: 'Wikidata Record',
      url: `https://www.wikidata.org/wiki/${qid}`,
    });

    const getClaimVal = (prop: string): string | undefined =>
      claims[prop]?.[0]?.mainsnak?.datavalue?.value;

    if (!socials.instagram) {
      const wdIg = getClaimVal('P2003');
      if (wdIg) {
        const igUrl = normalizeHandleOrUrl(wdIg, 'instagram');
        if (igUrl) {
          const norm = normalizeInstagramUrl(igUrl);
          socials.instagram = norm.url;
          socials.instagramHandle = norm.handle;
          socials.instagramConfidence = 'directory_verified';
        }
      }
    }
    if (!socials.facebook) {
      const wdFb = getClaimVal('P2013');
      if (wdFb) socials.facebook = normalizeHandleOrUrl(wdFb, 'facebook');
    }
    if (!socials.twitter) {
      const wdTw = getClaimVal('P2002');
      if (wdTw) socials.twitter = normalizeHandleOrUrl(wdTw, 'twitter');
    }
    if (!socials.tiktok) {
      const wdTt = getClaimVal('P7085');
      if (wdTt) socials.tiktok = normalizeHandleOrUrl(wdTt, 'tiktok');
    }
    if (!discoveredWebsite) {
      discoveredWebsite = getClaimVal('P856');
    }
  }

  // If OSM/Wikidata found a website URL that wasn't already scanned (or failed before), scan it!
  if (
    (!socials.instagram || !socials.websiteEmail) &&
    discoveredWebsite &&
    discoveredWebsite.startsWith('http') &&
    discoveredWebsite.replace(/\/$/, '').toLowerCase() !==
      (alreadyScannedUrl || '').replace(/\/$/, '').toLowerCase()
  ) {
    const siteExtra = await scanWebsiteForSocials(discoveredWebsite);
    if (!socials.instagram && siteExtra.instagram) {
      socials.instagram = siteExtra.instagram;
      socials.instagramHandle = siteExtra.instagramHandle;
      socials.instagramConfidence = 'website_verified';
    }
    if (!socials.facebook && siteExtra.facebook) socials.facebook = siteExtra.facebook;
    if (!socials.tiktok && siteExtra.tiktok) socials.tiktok = siteExtra.tiktok;
    if (!socials.twitter && siteExtra.twitter) socials.twitter = siteExtra.twitter;
    if (!socials.youtube && siteExtra.youtube) socials.youtube = siteExtra.youtube;
    if (!socials.websiteEmail && siteExtra.websiteEmail) {
      socials.websiteEmail = siteExtra.websiteEmail;
      socials.emailSource = siteExtra.emailSource;
      socials.emailConfidence = siteExtra.emailConfidence;
    }
    discoveredSources.push({
      title: discoveredWebsite.replace(/^https?:\/\/(www\.)?/, '').split('/')[0],
      url: discoveredWebsite,
    });
  }

  return { socials, discoveredSources };
}

const socialDiscoveryCache = new Map<
  string,
  { expiresAt: number; data: SocialProfiles }
>();

/**
 * Discovers & verifies social media and contact information:
 * 1. Scans the business's official website (JSON-LD, homepage, /contact page, Linktree) and validates reachability.
 * 2. Checks open directories (OpenStreetMap Nominatim & Wikidata) if Instagram or verified email is missing.
 * 3. Falls back to rate-limited Gemini Google Search grounding with anti-false-positive validation.
 */
export async function discoverWebsiteSocials(
  websiteUrl: string,
  businessName: string = '',
  city: string = '',
  state: string = ''
): Promise<SocialProfiles> {
  const cacheKey = `${websiteUrl}|${businessName}|${city}|${state}`.toLowerCase().trim();
  const cached = socialDiscoveryCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  const searchQuery = `${businessName} ${city} ${state}`.trim();
  const instagramSearchUrl = `https://www.google.com/search?q=site%3Ainstagram.com+${encodeURIComponent(
    searchQuery
  )}`;

  // Stage 1: Scan business website (including JSON-LD & /contact page)
  const siteSocials = await scanWebsiteForSocials(websiteUrl);
  const foundOnWebsite = Boolean(
    siteSocials.instagram ||
      siteSocials.facebook ||
      siteSocials.tiktok ||
      siteSocials.twitter ||
      siteSocials.youtube ||
      siteSocials.websiteEmail
  );

  let externalSocials: ExtractedSocials = {};
  let discoveredSources: Array<{ title?: string; url: string }> = [];

  // Stage 2: Check open directories (OpenStreetMap & Wikidata) if Instagram or verified email is still missing
  if (!siteSocials.instagram || !siteSocials.websiteEmail) {
    const dirResult = await discoverSocialsViaOpenDirectories(
      businessName,
      city,
      state,
      websiteUrl
    );
    externalSocials = { ...dirResult.socials };
    discoveredSources = [...dirResult.discoveredSources];

    // Stage 3: Fall back to Gemini Google Search grounding only if Instagram or email is still missing and quota allows
    if (
      (!siteSocials.instagram && !externalSocials.instagram) ||
      (!siteSocials.websiteEmail && !externalSocials.websiteEmail)
    ) {
      if (isGeminiAvailable()) {
        const googleResult = await discoverSocialsViaGoogleSearch(
          businessName,
          city,
          state,
          websiteUrl
        );
        externalSocials = {
          instagram: externalSocials.instagram || googleResult.socials.instagram,
          instagramHandle:
            externalSocials.instagramHandle || googleResult.socials.instagramHandle,
          instagramConfidence:
            externalSocials.instagramConfidence || googleResult.socials.instagramConfidence,
          facebook: externalSocials.facebook || googleResult.socials.facebook,
          tiktok: externalSocials.tiktok || googleResult.socials.tiktok,
          twitter: externalSocials.twitter || googleResult.socials.twitter,
          youtube: externalSocials.youtube || googleResult.socials.youtube,
          websiteEmail: externalSocials.websiteEmail || googleResult.socials.websiteEmail,
          emailSource: externalSocials.emailSource || googleResult.socials.emailSource,
          emailConfidence:
            externalSocials.emailConfidence || googleResult.socials.emailConfidence,
        };
        for (const src of googleResult.discoveredSources) {
          if (!discoveredSources.some((existing) => existing.url === src.url)) {
            discoveredSources.push(src);
          }
        }
      }
    }
  }

  const instagram = siteSocials.instagram || externalSocials.instagram;
  const instagramHandle = siteSocials.instagramHandle || externalSocials.instagramHandle;
  const instagramConfidence =
    siteSocials.instagramConfidence || externalSocials.instagramConfidence;
  const facebook = siteSocials.facebook || externalSocials.facebook;
  const tiktok = siteSocials.tiktok || externalSocials.tiktok;
  const twitter = siteSocials.twitter || externalSocials.twitter;
  const youtube = siteSocials.youtube || externalSocials.youtube;
  const websiteEmail = siteSocials.websiteEmail || externalSocials.websiteEmail;
  const emailSource = siteSocials.emailSource || externalSocials.emailSource;
  const emailConfidence = siteSocials.emailConfidence || externalSocials.emailConfidence;

  const foundExternally = Boolean(
    externalSocials.instagram ||
      externalSocials.facebook ||
      externalSocials.tiktok ||
      externalSocials.twitter ||
      externalSocials.youtube ||
      externalSocials.websiteEmail
  );

  let source: SocialDiscoverySource = 'not_found';
  if (foundOnWebsite && foundExternally) {
    source = 'website_and_google_search';
  } else if (foundOnWebsite) {
    source = 'scanned_from_website';
  } else if (foundExternally) {
    source = 'discovered_via_google_search';
  }

  const result: SocialProfiles = {
    instagram,
    instagramHandle,
    instagramConfidence,
    facebook,
    tiktok,
    twitter,
    youtube,
    websiteEmail,
    emailSource,
    emailConfidence,
    websiteReachable: siteSocials.websiteReachable,
    websiteStatusCode: siteSocials.websiteStatusCode,
    source,
    lastScannedAt: new Date().toISOString(),
    instagramSearchUrl,
    discoveredSources: discoveredSources.length > 0 ? discoveredSources.slice(0, 5) : undefined,
  };

  socialDiscoveryCache.set(cacheKey, {
    expiresAt: Date.now() + 10 * 60 * 1000,
    data: result,
  });

  return result;
}

export async function classifyProspectOpportunity(
  data: ClassifyInput
): Promise<ClassificationResult> {
  const ai = getGeminiClient();

  // If no manual inspection has been conducted yet, owner response status is unverified
  if (!data.hasManualInspection || (data.reviewsInspectedCount ?? 0) === 0) {
    return {
      opportunity: 'UNVERIFIED',
      rationale:
        'Owner response status cannot be determined without human inspection because Google Maps API does not provide complete owner response flags. Open the Google Maps listing to inspect recent reviews and record findings.',
      verifiedEvidence: [
        `Business Name: ${data.businessName}`,
        data.rating ? `Overall Rating: ${data.rating} stars` : 'Rating: Not available',
        data.userRatingCount
          ? `Total Review Volume: ${data.userRatingCount.toLocaleString()} ratings`
          : 'Review Volume: Not available',
        'Manual Review Inspection: Pending (0 reviews inspected by user)',
      ],
      assumptions: [
        'Assumes potential response gap until verified on Google Maps.',
      ],
      replyNationPitchAngle:
        'Pending manual review of owner responses on Google Maps.',
    };
  }

  // If Gemini API Key is available, use Gemini 4 Hydrogen for nuanced evidence separation
  if (ai) {
    try {
      const prompt = `Analyze this business prospect for ReplyNation (an AI-powered Google review response tool):
Business Name: ${data.businessName}
Location: ${data.city || 'Unknown'}, ${data.state || 'Unknown'}
Industry/Category: ${data.category || 'Local Business'}
Overall Rating: ${data.rating ?? 'N/A'}
Total Public Ratings: ${data.userRatingCount ?? 'N/A'}
Reviews Inspected by User: ${data.reviewsInspectedCount ?? 0}
Negative Reviews Found by User: ${data.negativeReviewsCount ?? 0}
Negative Reviews WITH Owner Replies: ${data.negativeWithRepliesCount ?? 0}
Verified UNANSWERED Negative Reviews: ${data.unansweredNegativeCount ?? 0}
User Inspection Notes: ${data.inspectionNotes || 'None'}

Instructions:
1. Classify opportunity as HIGH, MEDIUM, LOW, or UNVERIFIED.
   - HIGH: Multiple confirmed unanswered negative reviews (e.g. 2+), or large review volume with persistent unaddressed complaints.
   - MEDIUM: 1 confirmed unanswered negative review, or moderate review volume with spotty/delayed replies.
   - LOW: High owner response rate (all/most negative reviews already answered promptly), very low review count (<10), or near-perfect rating with no complaints.
   - UNVERIFIED: No inspection done.
2. Separate verified evidence (facts confirmed from the inspection data) from assumptions (hypotheses or general industry expectations).
3. Do not fabricate review text, customer names, or non-supplied details.
4. Provide a tailored ReplyNation outreach angle highlighting how automated timely review responses help their specific situation.`;

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              opportunity: {
                type: Type.STRING,
                enum: ['HIGH', 'MEDIUM', 'LOW', 'UNVERIFIED'],
              },
              rationale: { type: Type.STRING },
              verifiedEvidence: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              assumptions: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              replyNationPitchAngle: { type: Type.STRING },
            },
            required: [
              'opportunity',
              'rationale',
              'verifiedEvidence',
              'assumptions',
              'replyNationPitchAngle',
            ],
          },
        },
      });

      if (response.text) {
        const parsed = JSON.parse(response.text) as ClassificationResult;
        return parsed;
      }
    } catch (err) {
      if (isRateLimitOrQuotaError(err)) {
        triggerGeminiCooldown(err);
      } else {
        console.info(
          'Gemini API classification skipped, using rule-based evaluation:',
          err instanceof Error ? err.message : 'unavailable'
        );
      }
    }
  }

  // Deterministic rule-based fallback based strictly on evidence
  const unanswered = data.unansweredNegativeCount ?? 0;
  const negative = data.negativeReviewsCount ?? 0;
  const volume = data.userRatingCount ?? 0;

  let opportunity: 'HIGH' | 'MEDIUM' | 'LOW' = 'LOW';
  let rationale = '';

  if (unanswered >= 2 || (unanswered >= 1 && volume > 200)) {
    opportunity = 'HIGH';
    rationale = `Human verification confirmed ${unanswered} negative review(s) without owner replies. For an establishment with ${volume} total ratings, unaddressed negative feedback creates noticeable brand attrition that ReplyNation can immediately resolve.`;
  } else if (unanswered === 1 || (negative > 1 && (data.negativeWithRepliesCount ?? 0) === 0)) {
    opportunity = 'MEDIUM';
    rationale = `Human verification found ${unanswered} unaddressed negative review. There is a clear opportunity for automated review turnaround, though volume of unanswered reviews is moderate.`;
  } else {
    opportunity = 'LOW';
    rationale = `Of the ${data.reviewsInspectedCount} reviews inspected, ${data.negativeWithRepliesCount ?? 0} out of ${negative} negative reviews already have owner replies, or overall negative sentiment is minimal.`;
  }

  return {
    opportunity,
    rationale,
    verifiedEvidence: [
      `User inspected ${data.reviewsInspectedCount ?? 0} reviews.`,
      `User identified ${negative} negative reviews and confirmed ${unanswered} lack owner replies.`,
      `Google Maps rating: ${data.rating ?? 'N/A'} stars across ${volume.toLocaleString()} reviews.`,
    ],
    assumptions: [
      'Assumes sampled reviews reflect the ongoing owner engagement cadence.',
      'Assumes the business has an active operator capable of adopting an AI response workflow.',
    ],
    replyNationPitchAngle:
      unanswered > 0
        ? `Highlight the ${unanswered} unaddressed negative review(s) and demonstrate how ReplyNation drafts professional, de-escalating replies within 5 minutes.`
        : 'Highlight how ReplyNation saves 3+ hours per week by automatically acknowledging every customer review while maintaining brand voice.',
  };
}

export interface PlacesTextSearchInput {
  textQuery: string;
  minRating?: number;
  maxResultCount?: number;
}

export interface PlacesProxyResult {
  ok: boolean;
  status: number;
  places?: Array<{
    id: string;
    displayName: string;
    formattedAddress?: string;
    googleMapsURI?: string;
    websiteURI?: string;
    nationalPhoneNumber?: string;
    rating?: number;
    userRatingCount?: number;
    location?: { lat: number; lng: number };
    types?: string[];
    reviews?: Array<{
      authorName: string;
      rating?: number;
      relativePublishTime?: string;
      publishTime?: string;
      text?: string;
    }>;
  }>;
  errorCode?: string;
  errorMessage?: string;
}

export async function searchPlacesTextProxy(
  input: PlacesTextSearchInput
): Promise<PlacesProxyResult> {
  const apiKey =
    process.env.GOOGLE_MAPS_API_KEY ||
    process.env.GOOGLE_MAPS_SERVER_API_KEY ||
    process.env.VITE_GOOGLE_MAPS_API_KEY;

  if (!apiKey || apiKey === 'MY_GOOGLE_MAPS_API_KEY') {
    return {
      ok: false,
      status: 400,
      errorCode: 'MISSING_API_KEY',
      errorMessage:
        'Google Maps API key is not configured on this deployment. Add VITE_GOOGLE_MAPS_API_KEY (and optionally GOOGLE_MAPS_API_KEY) in your environment variables and redeploy.',
    };
  }

  const textQuery = (input.textQuery || '').trim();
  if (!textQuery) {
    return {
      ok: false,
      status: 400,
      errorCode: 'INVALID_REQUEST',
      errorMessage: 'Search query is required.',
    };
  }

  const targetLimit = Math.min(Math.max(Number(input.maxResultCount) || 10, 1), 100);
  const fieldMask =
    'nextPageToken,places.id,places.displayName,places.formattedAddress,places.googleMapsUri,places.websiteUri,places.nationalPhoneNumber,places.rating,places.userRatingCount,places.location,places.types,places.reviews';

  type ProxyPlace = NonNullable<PlacesProxyResult['places']>[number];

  const mapRawPlace = (p: any): ProxyPlace => ({
    id: p.id,
    displayName: p.displayName?.text || 'Business',
    formattedAddress: p.formattedAddress,
    googleMapsURI: p.googleMapsUri,
    websiteURI: p.websiteUri,
    nationalPhoneNumber: p.nationalPhoneNumber,
    rating: typeof p.rating === 'number' ? p.rating : undefined,
    userRatingCount:
      typeof p.userRatingCount === 'number' ? p.userRatingCount : undefined,
    location:
      typeof p.location?.latitude === 'number' &&
      typeof p.location?.longitude === 'number'
        ? { lat: p.location.latitude, lng: p.location.longitude }
        : undefined,
    types: Array.isArray(p.types) ? p.types : [],
    reviews: Array.isArray(p.reviews)
      ? p.reviews.slice(0, 5).map((r: any) => ({
          authorName: r.authorAttribution?.displayName || 'Google Reviewer',
          rating: typeof r.rating === 'number' ? r.rating : undefined,
          relativePublishTime: r.relativePublishTimeDescription,
          publishTime: r.publishTime,
          text: typeof r.text === 'string' ? r.text : r.text?.text,
        }))
      : [],
  });

  const fetchSearchPage = async (reqBody: Record<string, unknown>) => {
    const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-Maps-Solution-ID': 'gmp_mcp_codeassist_v1_aistudio',
        'X-Goog-FieldMask': fieldMask,
      },
      body: JSON.stringify(reqBody),
      signal: AbortSignal.timeout(12000),
    });

    const data: any = await response.json().catch(() => ({}));
    return { response, data };
  };

  try {
    const collected: ProxyPlace[] = [];
    const seenIds = new Set<string>();

    const appendPlaces = (rawList: any[]) => {
      for (const raw of rawList) {
        if (!raw?.id || seenIds.has(raw.id)) continue;
        seenIds.add(raw.id);
        collected.push(mapRawPlace(raw));
        if (collected.length >= targetLimit) break;
      }
    };

    const baseRequest: Record<string, unknown> = {
      textQuery,
      pageSize: Math.min(20, targetLimit),
    };
    if (typeof input.minRating === 'number' && input.minRating > 0) {
      baseRequest.minRating = input.minRating;
    }

    // 1. Primary query + nextPageToken pagination (up to 3 pages = 60 results)
    const firstPage = await fetchSearchPage(baseRequest);
    if (!firstPage.response.ok) {
      const apiErr = firstPage.data?.error || {};
      return {
        ok: false,
        status: firstPage.response.status,
        errorCode: apiErr.status || `HTTP_${firstPage.response.status}`,
        errorMessage:
          apiErr.message ||
          `Places API (New) returned status ${firstPage.response.status}.`,
      };
    }

    appendPlaces(firstPage.data?.places || []);

    let nextPageToken: string | undefined = firstPage.data?.nextPageToken;
    let pageCount = 1;
    while (nextPageToken && collected.length < targetLimit && pageCount < 3) {
      pageCount += 1;
      // Google Places API needs a short moment before nextPageToken activates
      await new Promise((r) => setTimeout(r, 900));

      let pageRes = await fetchSearchPage({
        ...baseRequest,
        pageSize: Math.min(20, targetLimit - collected.length),
        pageToken: nextPageToken,
      });

      if (!pageRes.response.ok && pageRes.response.status === 400) {
        await new Promise((r) => setTimeout(r, 1200));
        pageRes = await fetchSearchPage({
          ...baseRequest,
          pageSize: Math.min(20, targetLimit - collected.length),
          pageToken: nextPageToken,
        });
      }

      if (!pageRes.response.ok) break;
      appendPlaces(pageRes.data?.places || []);
      nextPageToken = pageRes.data?.nextPageToken;
    }

    // 2. If targetLimit > 60 (e.g. 100) and we have coordinates, sweep city quadrant bias circles
    if (collected.length < targetLimit) {
      const coords = collected.filter((p) => p.location).map((p) => p.location!);
      if (coords.length > 0) {
        const avgLat = coords.reduce((acc, c) => acc + c.lat, 0) / coords.length;
        const avgLng = coords.reduce((acc, c) => acc + c.lng, 0) / coords.length;

        // Offsets (~5-7km around city center) to uncover additional businesses beyond Google's 60-item single-query cap
        const offsets = [
          { dLat: 0, dLng: 0 },
          { dLat: 0.055, dLng: 0 },
          { dLat: -0.055, dLng: 0 },
          { dLat: 0, dLng: 0.065 },
          { dLat: 0, dLng: -0.065 },
          { dLat: 0.045, dLng: 0.055 },
          { dLat: 0.045, dLng: -0.055 },
          { dLat: -0.045, dLng: 0.055 },
          { dLat: -0.045, dLng: -0.055 },
        ];

        for (const offset of offsets) {
          if (collected.length >= targetLimit) break;
          const zoneReq: Record<string, unknown> = {
            textQuery,
            pageSize: 20,
            rankPreference: 'DISTANCE',
            locationBias: {
              circle: {
                center: {
                  latitude: avgLat + offset.dLat,
                  longitude: avgLng + offset.dLng,
                },
                radius: 6500,
              },
            },
          };
          if (typeof input.minRating === 'number' && input.minRating > 0) {
            zoneReq.minRating = input.minRating;
          }

          const zoneRes = await fetchSearchPage(zoneReq);
          if (zoneRes.response.ok) {
            appendPlaces(zoneRes.data?.places || []);
          }
        }
      }
    }

    return {
      ok: true,
      status: 200,
      places: collected.slice(0, targetLimit),
    };
  } catch (err) {
    return {
      ok: false,
      status: 500,
      errorCode: 'PROXY_FETCH_ERROR',
      errorMessage: err instanceof Error ? err.message : String(err),
    };
  }
}


