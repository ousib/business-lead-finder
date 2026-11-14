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
  facebook?: string;
  tiktok?: string;
  twitter?: string;
  youtube?: string;
  websiteEmail?: string;
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

function normalizeInstagramUrl(raw?: string | null): { url?: string; handle?: string } {
  if (!raw || typeof raw !== 'string') return {};
  const clean = raw.startsWith('http') ? raw : raw.startsWith('//') ? `https:${raw}` : `https://${raw}`;
  const match = clean.match(/instagram\.com\/([a-zA-Z0-9_.]{2,30})(?:\/|\?|$)/i);
  if (match && match[1]) {
    const slug = match[1];
    if (!IG_IGNORED_PATHS.has(slug.toLowerCase())) {
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
    if (!FB_IGNORED_PATHS.has(slug) && !/^\d+$/.test(slug)) {
      return `https://www.facebook.com/${match[1]}`;
    }
  }
  return undefined;
}

function normalizeTikTokUrl(raw?: string | null): string | undefined {
  if (!raw || typeof raw !== 'string') return undefined;
  const clean = raw.startsWith('http') ? raw : raw.startsWith('//') ? `https:${raw}` : `https://${raw}`;
  const match = clean.match(/tiktok\.com\/@([a-zA-Z0-9_.-]{2,30})(?:\/|\?|$)/i);
  if (match && match[1]) {
    return `https://www.tiktok.com/@${match[1]}`;
  }
  return undefined;
}

function normalizeTwitterUrl(raw?: string | null): string | undefined {
  if (!raw || typeof raw !== 'string') return undefined;
  const clean = raw.startsWith('http') ? raw : raw.startsWith('//') ? `https:${raw}` : `https://${raw}`;
  const match = clean.match(/(?:twitter\.com|x\.com)\/([a-zA-Z0-9_]{2,20})(?:\/|\?|$)/i);
  if (match && match[1] && !TW_IGNORED_PATHS.has(match[1].toLowerCase())) {
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

function extractSocialsFromHtml(html: string): ExtractedSocials {
  const result: ExtractedSocials = {};

  // 1. Instagram
  const igMatches = html.match(
    /(?:https?:)?\/\/(?:www\.)?instagram\.com\/([a-zA-Z0-9_.]{2,30})\/?(?=[^a-zA-Z0-9_.]|$)/gi
  );
  if (igMatches) {
    for (const rawUrl of igMatches) {
      const normalized = normalizeInstagramUrl(rawUrl);
      if (normalized.url) {
        result.instagram = normalized.url;
        result.instagramHandle = normalized.handle;
        break;
      }
    }
  }

  // 2. Facebook
  const fbMatches = html.match(
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
  const tiktokMatches = html.match(
    /(?:https?:)?\/\/(?:www\.)?tiktok\.com\/@([a-zA-Z0-9_.-]{2,30})\/?/gi
  );
  if (tiktokMatches && tiktokMatches.length > 0) {
    result.tiktok = normalizeTikTokUrl(tiktokMatches[0]);
  }

  // 4. Twitter / X
  const twMatches = html.match(
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
  const ytMatches = html.match(
    /(?:https?:)?\/\/(?:www\.)?youtube\.com\/(?:@|c\/|channel\/)([a-zA-Z0-9_.-]+)/gi
  );
  if (ytMatches && ytMatches.length > 0) {
    result.youtube = normalizeYouTubeUrl(ytMatches[0]);
  }

  // 6. Email from mailto
  const mailtoMatches = html.match(/mailto:([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i);
  if (mailtoMatches && mailtoMatches[1]) {
    const candidate = mailtoMatches[1].toLowerCase();
    if (!candidate.includes('example.com') && !candidate.includes('sentry.io')) {
      result.websiteEmail = candidate;
    }
  }

  return result;
}

async function fetchHtmlWithTimeout(url: string, timeoutMs = 5000): Promise<string | null> {
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
    if (!response.ok) return null;
    return await response.text();
  } catch {
    return null;
  }
}

async function scanWebsiteForSocials(websiteUrl: string): Promise<ExtractedSocials> {
  if (!websiteUrl || !websiteUrl.startsWith('http')) {
    return {};
  }

  const html = await fetchHtmlWithTimeout(websiteUrl, 5500);
  if (!html) return {};

  const primary = extractSocialsFromHtml(html);

  // If Instagram wasn't found on the homepage, check a link-in-bio (Linktree/Beacons) or /contact page
  if (!primary.instagram) {
    const linktreeMatch = html.match(/https?:\/\/(?:linktr\.ee|beacons\.ai|bento\.me)\/[a-zA-Z0-9_.-]+/i);
    let secondaryUrl: string | undefined = linktreeMatch?.[0];

    if (!secondaryUrl) {
      const contactHrefMatch = html.match(/href=["']([^"']*(?:contact|about|connect|social)[^"']*)["']/i);
      if (contactHrefMatch?.[1]) {
        try {
          const resolved = new URL(contactHrefMatch[1], websiteUrl);
          if (resolved.origin === new URL(websiteUrl).origin && resolved.href !== websiteUrl) {
            secondaryUrl = resolved.href;
          }
        } catch {
          // ignore invalid URL
        }
      }
    }

    if (secondaryUrl) {
      const secondaryHtml = await fetchHtmlWithTimeout(secondaryUrl, 4000);
      if (secondaryHtml) {
        const extra = extractSocialsFromHtml(secondaryHtml);
        return {
          instagram: primary.instagram || extra.instagram,
          instagramHandle: primary.instagramHandle || extra.instagramHandle,
          facebook: primary.facebook || extra.facebook,
          tiktok: primary.tiktok || extra.tiktok,
          twitter: primary.twitter || extra.twitter,
          youtube: primary.youtube || extra.youtube,
          websiteEmail: primary.websiteEmail || extra.websiteEmail,
        };
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
    const prompt = `Use Google Search to find the official social media profiles (especially Instagram) for this specific US business across Google, Instagram, Facebook, TikTok, LinkedIn, Linktree, Yelp, Clutch, or other business directories.

Business Name: ${businessName}
Location: ${locationStr || 'United States'}
Official Website (if known): ${websiteUrl || 'Not listed'}

Strict rules:
1. Only include profile URLs that genuinely appear in Google Search results and clearly belong to "${businessName}" in ${locationStr || 'its US location'}.
2. Do NOT guess or fabricate handles or URLs. If a profile cannot be verified from search results, set its value to null.
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
          const emailMatch = parsed.email
            .trim()
            .toLowerCase()
            .match(/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/);
          if (emailMatch && !parsed.email.includes('example.com')) {
            socials.websiteEmail = emailMatch[0];
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
  if (rawEmail && rawEmail.includes('@')) {
    socials.websiteEmail = rawEmail.trim().toLowerCase();
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
    !socials.instagram &&
    discoveredWebsite &&
    discoveredWebsite.startsWith('http') &&
    discoveredWebsite.replace(/\/$/, '').toLowerCase() !==
      (alreadyScannedUrl || '').replace(/\/$/, '').toLowerCase()
  ) {
    const siteExtra = await scanWebsiteForSocials(discoveredWebsite);
    if (siteExtra.instagram) {
      socials.instagram = siteExtra.instagram;
      socials.instagramHandle = siteExtra.instagramHandle;
    }
    if (!socials.facebook && siteExtra.facebook) socials.facebook = siteExtra.facebook;
    if (!socials.tiktok && siteExtra.tiktok) socials.tiktok = siteExtra.tiktok;
    if (!socials.twitter && siteExtra.twitter) socials.twitter = siteExtra.twitter;
    if (!socials.youtube && siteExtra.youtube) socials.youtube = siteExtra.youtube;
    if (!socials.websiteEmail && siteExtra.websiteEmail) socials.websiteEmail = siteExtra.websiteEmail;
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
 * Discovers social media presence (especially Instagram):
 * 1. Scans the business's official website (and Linktree / contact pages) if available.
 * 2. Checks free open directories (OpenStreetMap Nominatim & Wikidata) before consuming API quota.
 * 3. If Instagram or socials are still missing, falls back to rate-limited Gemini Google Search grounding.
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

  // Stage 1: Scan business website
  const siteSocials = await scanWebsiteForSocials(websiteUrl);
  const foundOnWebsite = Boolean(
    siteSocials.instagram ||
      siteSocials.facebook ||
      siteSocials.tiktok ||
      siteSocials.twitter ||
      siteSocials.youtube
  );

  let externalSocials: ExtractedSocials = {};
  let discoveredSources: Array<{ title?: string; url: string }> = [];

  // Stage 2: Check free open directories (OpenStreetMap & Wikidata) if Instagram or socials are missing
  if (!siteSocials.instagram || !foundOnWebsite) {
    const dirResult = await discoverSocialsViaOpenDirectories(
      businessName,
      city,
      state,
      websiteUrl
    );
    externalSocials = { ...dirResult.socials };
    discoveredSources = [...dirResult.discoveredSources];

    // Stage 3: Fall back to Gemini Google Search grounding only if Instagram is still missing and quota allows
    if (!siteSocials.instagram && !externalSocials.instagram && isGeminiAvailable()) {
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
        facebook: externalSocials.facebook || googleResult.socials.facebook,
        tiktok: externalSocials.tiktok || googleResult.socials.tiktok,
        twitter: externalSocials.twitter || googleResult.socials.twitter,
        youtube: externalSocials.youtube || googleResult.socials.youtube,
        websiteEmail: externalSocials.websiteEmail || googleResult.socials.websiteEmail,
      };
      for (const src of googleResult.discoveredSources) {
        if (!discoveredSources.some((existing) => existing.url === src.url)) {
          discoveredSources.push(src);
        }
      }
    }
  }

  const instagram = siteSocials.instagram || externalSocials.instagram;
  const instagramHandle = siteSocials.instagramHandle || externalSocials.instagramHandle;
  const facebook = siteSocials.facebook || externalSocials.facebook;
  const tiktok = siteSocials.tiktok || externalSocials.tiktok;
  const twitter = siteSocials.twitter || externalSocials.twitter;
  const youtube = siteSocials.youtube || externalSocials.youtube;
  const websiteEmail = siteSocials.websiteEmail || externalSocials.websiteEmail;

  const foundExternally = Boolean(
    externalSocials.instagram ||
      externalSocials.facebook ||
      externalSocials.tiktok ||
      externalSocials.twitter ||
      externalSocials.youtube
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
    facebook,
    tiktok,
    twitter,
    youtube,
    websiteEmail,
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

  const body: Record<string, unknown> = {
    textQuery,
    maxResultCount: Math.min(Math.max(Number(input.maxResultCount) || 10, 1), 20),
  };
  if (typeof input.minRating === 'number' && input.minRating > 0) {
    body.minRating = input.minRating;
  }

  try {
    const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-Maps-Solution-ID': 'gmp_mcp_codeassist_v1_aistudio',
        'X-Goog-FieldMask':
          'places.id,places.displayName,places.formattedAddress,places.googleMapsUri,places.websiteUri,places.nationalPhoneNumber,places.rating,places.userRatingCount,places.location,places.types,places.reviews',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(12000),
    });

    const data: any = await response.json().catch(() => ({}));

    if (!response.ok) {
      const apiErr = data?.error || {};
      return {
        ok: false,
        status: response.status,
        errorCode: apiErr.status || `HTTP_${response.status}`,
        errorMessage:
          apiErr.message || `Places API (New) returned status ${response.status}.`,
      };
    }

    const places = (data.places || []).map((p: any) => ({
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
    }));

    return {
      ok: true,
      status: 200,
      places,
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

