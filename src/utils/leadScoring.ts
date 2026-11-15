import {
  DiscoveredPlace,
  EmailVerificationLevel,
  ProspectResearch,
  SocialProfiles,
  SocialVerificationLevel,
} from '../types';

export type LeadTier = 'HIGH_POTENTIAL' | 'MEDIUM_POTENTIAL' | 'LOW_POTENTIAL';

export interface ScoreBreakdown {
  reputationNeed: number; // 0 - 35
  businessFit: number; // 0 - 25
  reachability: number; // 0 - 25
  confidenceBonus: number; // 0 - 15
}

export interface LeadOpportunityAnalysis {
  leadScore: number; // 0 - 100
  tier: LeadTier;
  tierLabel: string;
  scoreBreakdown: ScoreBreakdown;
  confidenceLabel: 'Verified Lead' | 'Contact Verified' | 'Needs Verification';
  contactReadinessLabel: 'Direct Reach Verified' | 'Partial Contact Info' | 'Limited Contact Info';
  emailConfidence: EmailVerificationLevel;
  instagramConfidence: SocialVerificationLevel;
  actionRecommendation: string;
  reviewOpportunityTitle: string;
  reviewOpportunityDetail: string;
  isReviewResponseVerified: boolean;
  sampledLowRatingCount: number;
  whyGoodProspect: string[];
  signals: {
    hasWebsite: boolean;
    websiteReachable?: boolean;
    hasInstagram: boolean;
    hasEmail: boolean;
    hasPhone: boolean;
  };
}

function getRootDomain(urlOrEmail?: string): string | undefined {
  if (!urlOrEmail) return undefined;
  try {
    const raw = urlOrEmail.includes('@')
      ? `https://${urlOrEmail.split('@')[1]}`
      : urlOrEmail.startsWith('http')
      ? urlOrEmail
      : `https://${urlOrEmail}`;
    const host = new URL(raw).hostname.toLowerCase().replace(/^www\./, '');
    const parts = host.split('.').filter(Boolean);
    return parts.length >= 2 ? parts.slice(-2).join('.') : host || undefined;
  } catch {
    return undefined;
  }
}

function hasRecentSampleActivity(place: Pick<DiscoveredPlace, 'sampleReviews'>): boolean {
  const reviews = place.sampleReviews || [];
  if (reviews.length === 0) return false;

  const cutoffMs = Date.now() - 120 * 24 * 60 * 60 * 1000; // ~4 months
  return reviews.some((r) => {
    if (r.publishTime) {
      const ts = Date.parse(r.publishTime);
      if (!Number.isNaN(ts) && ts >= cutoffMs) return true;
    }
    const rel = (r.relativePublishTime || '').toLowerCase();
    return (
      rel.includes('hour') ||
      rel.includes('day') ||
      rel.includes('week') ||
      /\b[1-3]\s+months?\b/.test(rel) ||
      rel.includes('a month ago')
    );
  });
}

export function computeLeadOpportunity(
  place: Pick<
    DiscoveredPlace,
    | 'displayName'
    | 'city'
    | 'state'
    | 'rating'
    | 'userRatingCount'
    | 'websiteUri'
    | 'nationalPhoneNumber'
    | 'sampleReviews'
    | 'socials'
  >,
  prospect?: ProspectResearch,
  overrideSocials?: SocialProfiles
): LeadOpportunityAnalysis {
  const socials = overrideSocials || prospect?.socials || place.socials;
  const hasWebsite = Boolean(place.websiteUri);
  const websiteReachable = socials?.websiteReachable;
  const hasInstagram = Boolean(
    socials?.instagram || prospect?.instagramUrl || prospect?.instagramHandle
  );
  const effectiveEmail = socials?.websiteEmail || prospect?.contactEmail;
  const hasEmail = Boolean(effectiveEmail);
  const hasPhone = Boolean(place.nationalPhoneNumber);

  // Infer or use email verification level
  let emailConfidence: EmailVerificationLevel = 'unverified';
  if (hasEmail) {
    if (socials?.emailConfidence) {
      emailConfidence = socials.emailConfidence;
    } else if (effectiveEmail) {
      const siteRoot = getRootDomain(place.websiteUri);
      const emailRoot = getRootDomain(effectiveEmail);
      emailConfidence =
        siteRoot && emailRoot && siteRoot === emailRoot ? 'verified_domain' : 'external_match';
    }
  }

  // Infer or use Instagram verification level
  let instagramConfidence: SocialVerificationLevel = 'unverified';
  if (hasInstagram) {
    if (socials?.instagramConfidence) {
      instagramConfidence = socials.instagramConfidence;
    } else if (socials?.source === 'scanned_from_website') {
      instagramConfidence = 'website_verified';
    } else if (socials?.source === 'manual_entry') {
      instagramConfidence = 'manual_entry';
    } else if (socials?.source === 'discovered_via_google_search') {
      instagramConfidence = 'search_match';
    } else {
      instagramConfidence = 'website_verified';
    }
  }

  const rating = place.rating;
  const reviewCount = place.userRatingCount ?? 0;
  const sampleReviews = place.sampleReviews || [];
  const sampledLowRatingCount = sampleReviews.filter(
    (r) => typeof r.rating === 'number' && r.rating <= 3
  ).length;
  const severeSampleCount = sampleReviews.filter(
    (r) => typeof r.rating === 'number' && r.rating <= 2
  ).length;
  const recentActive = hasRecentSampleActivity(place);

  // ------------------------------------------------------------------
  // 1. Reputation Need (0 - 35 pts): Real need for review management
  // ------------------------------------------------------------------
  let ratingPressure = 6;
  if (typeof rating === 'number') {
    if (rating >= 3.5 && rating <= 4.3) ratingPressure = 18;
    else if ((rating >= 3.0 && rating < 3.5) || (rating > 4.3 && rating <= 4.5)) ratingPressure = 14;
    else if (rating < 3.0) ratingPressure = 11;
    else if (rating > 4.5 && rating <= 4.7) ratingPressure = 8;
    else ratingPressure = 3; // 4.8 - 5.0 stars: low urgency unless proven gap
  }

  const isReviewResponseVerified = Boolean(
    prospect?.hasManualInspection && (prospect.reviewsInspectedCount ?? 0) > 0
  );

  let gapScore = 0;
  const reviewOpportunityTitle = 'Review opportunity';
  let reviewOpportunityDetail = '';

  if (isReviewResponseVerified && prospect) {
    const unanswered = prospect.unansweredNegativeCount ?? 0;
    const inspected = prospect.reviewsInspectedCount ?? 0;
    const negative = prospect.negativeReviewsCount ?? 0;

    if (unanswered >= 3) {
      gapScore = 17;
      reviewOpportunityDetail = `${unanswered} inspected negative reviews have no owner response (out of ${inspected} checked).`;
    } else if (unanswered === 2) {
      gapScore = 14;
      reviewOpportunityDetail = `2 inspected negative reviews have no owner response (out of ${inspected} checked).`;
    } else if (unanswered === 1) {
      gapScore = 10;
      reviewOpportunityDetail = `1 inspected negative review has no owner response (out of ${inspected} checked).`;
    } else if (negative > 0) {
      gapScore = 2;
      reviewOpportunityDetail = `All ${negative} negative review(s) found during inspection already had owner replies.`;
    } else {
      gapScore = 4;
      reviewOpportunityDetail = `${inspected} reviews inspected with minimal negative complaints.`;
    }
  } else {
    // Unverified gap score is capped at 11 pts so unverified leads don't artificially max out
    if (severeSampleCount >= 2) {
      gapScore = 11;
      reviewOpportunityDetail = `${severeSampleCount} recent 1–2★ review(s) visible in Google's sample — owner replies NOT VERIFIED.`;
    } else if (severeSampleCount === 1 || sampledLowRatingCount >= 2) {
      gapScore = 8;
      reviewOpportunityDetail = `${sampledLowRatingCount} low-rated review(s) in Google's sample — open Maps to confirm unanswered replies.`;
    } else if (sampledLowRatingCount === 1) {
      gapScore = 5;
      reviewOpportunityDetail = `1 low-rated review in recent sample — owner response status NOT VERIFIED.`;
    } else if (reviewCount >= 60 && typeof rating === 'number' && rating <= 4.5) {
      gapScore = 4;
      reviewOpportunityDetail = `Steady customer flow (${reviewCount.toLocaleString()} reviews at ${rating.toFixed(
        1
      )}★) — owner response status NOT VERIFIED.`;
    } else {
      gapScore = 1;
      reviewOpportunityDetail =
        'Owner response activity NOT VERIFIED — click Inspect Reviews to verify on Google Maps.';
    }
  }

  const reputationNeed = Math.min(35, ratingPressure + gapScore);

  // ------------------------------------------------------------------
  // 2. Business Fit & Activity (0 - 25 pts): Local SMB sweet spot
  // ------------------------------------------------------------------
  let volumeFit = 3;
  if (reviewCount >= 80 && reviewCount <= 1500) volumeFit = 18; // prime local SMB buyer
  else if (reviewCount > 1500 && reviewCount <= 4000) volumeFit = 15;
  else if (reviewCount >= 35 && reviewCount < 80) volumeFit = 13;
  else if (reviewCount >= 15 && reviewCount < 35) volumeFit = 8;
  else if (reviewCount > 4000) volumeFit = 10; // huge landmarks/chains often slower cold sales

  let activityAndWebFit = 0;
  if (recentActive) activityAndWebFit += 4;
  if (hasWebsite && websiteReachable === true) activityAndWebFit += 3;
  else if (hasWebsite && websiteReachable !== false) activityAndWebFit += 2;

  const businessFit = Math.min(25, volumeFit + activityAndWebFit);

  // ------------------------------------------------------------------
  // 3. Contact Reachability & Accuracy (0 - 25 pts)
  // ------------------------------------------------------------------
  let emailPts = 0;
  if (hasEmail) {
    if (emailConfidence === 'verified_domain') emailPts = 11;
    else if (emailConfidence === 'site_listed') emailPts = 9;
    else emailPts = 6;
  }

  const phonePts = hasPhone ? 5 : 0;

  let igPts = 0;
  if (hasInstagram) {
    if (instagramConfidence === 'website_verified' || instagramConfidence === 'manual_entry') {
      igPts = 6;
    } else if (instagramConfidence === 'directory_verified') {
      igPts = 5;
    } else {
      igPts = 3;
    }
  }

  let extraChannelPts = 0;
  if (hasWebsite && websiteReachable !== false) extraChannelPts += 2;
  if (socials?.facebook || socials?.tiktok) extraChannelPts += 1;
  extraChannelPts = Math.min(3, extraChannelPts);

  const reachability = Math.min(25, emailPts + phonePts + igPts + extraChannelPts);

  // ------------------------------------------------------------------
  // 4. Verification Confidence Bonus (0 - 15 pts)
  // ------------------------------------------------------------------
  let confidenceBonus = 0;
  if (isReviewResponseVerified) {
    confidenceBonus += (prospect?.unansweredNegativeCount ?? 0) > 0 ? 10 : 6;
  }
  if (emailConfidence === 'verified_domain') confidenceBonus += 4;
  else if (emailConfidence === 'site_listed') confidenceBonus += 3;
  if (instagramConfidence === 'website_verified') confidenceBonus += 1;
  confidenceBonus = Math.min(15, confidenceBonus);

  const leadScore = Math.min(100, reputationNeed + businessFit + reachability + confidenceBonus);

  // Determine tier (respect manual LOW / HIGH overrides cleanly)
  let tier: LeadTier = 'LOW_POTENTIAL';
  let tierLabel = 'Standard Prospect';
  if (
    prospect?.opportunityLevel === 'HIGH' ||
    (prospect?.opportunityLevel !== 'LOW' && leadScore >= 70)
  ) {
    tier = 'HIGH_POTENTIAL';
    tierLabel = 'High-Potential Prospect';
  } else if (
    prospect?.opportunityLevel === 'MEDIUM' ||
    (prospect?.opportunityLevel !== 'LOW' && leadScore >= 46)
  ) {
    tier = 'MEDIUM_POTENTIAL';
    tierLabel = 'Medium-Potential Prospect';
  }

  const confidenceLabel: LeadOpportunityAnalysis['confidenceLabel'] = isReviewResponseVerified
    ? 'Verified Lead'
    : emailConfidence === 'verified_domain' ||
      emailConfidence === 'site_listed' ||
      instagramConfidence === 'website_verified'
    ? 'Contact Verified'
    : 'Needs Verification';

  const contactReadinessLabel: LeadOpportunityAnalysis['contactReadinessLabel'] =
    (emailConfidence === 'verified_domain' || emailConfidence === 'site_listed') &&
    (hasPhone || instagramConfidence === 'website_verified')
      ? 'Direct Reach Verified'
      : hasEmail || hasInstagram || hasPhone
      ? 'Partial Contact Info'
      : 'Limited Contact Info';

  // Actionable recommendation tailored to exact signals
  let actionRecommendation = '';
  if (isReviewResponseVerified && (prospect?.unansweredNegativeCount ?? 0) > 0) {
    actionRecommendation = hasEmail
      ? `Ready to pitch: reference ${prospect?.unansweredNegativeCount} unanswered negative review(s) via ${
          emailConfidence === 'verified_domain' ? 'verified domain email' : 'listed email'
        }.`
      : `Confirmed ${prospect?.unansweredNegativeCount} unanswered review(s) — outreach via ${
          hasInstagram ? 'Instagram DM or phone' : 'phone call'
        }.`;
  } else if (sampledLowRatingCount > 0 && hasEmail) {
    actionRecommendation = `Verify replies to the ${sampledLowRatingCount} low-rated sample review(s) on Maps, then pitch via verified contact email.`;
  } else if (!hasEmail && hasInstagram) {
    actionRecommendation =
      instagramConfidence === 'website_verified'
        ? 'No public email found — use site-verified Instagram DM or phone.'
        : 'Confirm Instagram handle match, inspect Maps replies, and call or DM.';
  } else if (!hasEmail && !hasInstagram && hasPhone) {
    actionRecommendation = 'Phone-only prospect — inspect Google Maps reviews before calling.';
  } else if (hasEmail) {
    actionRecommendation = 'Direct email available — inspect Google Maps reviews to confirm reply gaps.';
  } else {
    actionRecommendation = 'Limited contact data — check Google Maps listing or search website manually.';
  }

  // Build concise, evidence-grounded "Why this is a good prospect" bullets
  const whyGoodProspect: string[] = [];

  if (reviewCount >= 80 && reviewCount <= 1500) {
    whyGoodProspect.push(`${reviewCount.toLocaleString()} reviews = prime established local SMB`);
  } else if (reviewCount > 1500) {
    whyGoodProspect.push(`${reviewCount.toLocaleString()} reviews = high-volume multi-customer operation`);
  } else if (reviewCount >= 25) {
    whyGoodProspect.push(`${reviewCount.toLocaleString()} reviews = growing local footprint`);
  } else if (reviewCount > 0) {
    whyGoodProspect.push(`${reviewCount.toLocaleString()} reviews = early-stage profile`);
  }

  if (typeof rating === 'number') {
    if (rating >= 3.5 && rating <= 4.3) {
      whyGoodProspect.push(`${rating.toFixed(1)}★ rating = high reputation sensitivity`);
    } else if (rating > 4.3 && rating <= 4.5) {
      whyGoodProspect.push(`${rating.toFixed(1)}★ rating = room to protect & push above 4.6★`);
    } else if (rating < 3.5) {
      whyGoodProspect.push(`${rating.toFixed(1)}★ rating = urgent reputation recovery need`);
    } else {
      whyGoodProspect.push(`${rating.toFixed(1)}★ rating = strong rating protection focus`);
    }
  }

  if (emailConfidence === 'verified_domain') {
    whyGoodProspect.push('Domain-verified business email ready for outreach');
  } else if (emailConfidence === 'site_listed') {
    whyGoodProspect.push('Email listed directly on official website');
  } else if (instagramConfidence === 'website_verified') {
    whyGoodProspect.push('Site-verified Instagram linked from official website');
  } else if (hasWebsite && websiteReachable === false) {
    whyGoodProspect.push('Listed website appears unreachable — verify contact channels');
  }

  if (isReviewResponseVerified && prospect) {
    if (prospect.unansweredNegativeCount > 0) {
      whyGoodProspect.push(
        `Verified gap: ${prospect.unansweredNegativeCount} unanswered negative review(s)`
      );
    } else {
      whyGoodProspect.push('Owner already replies to negative reviews');
    }
  } else if (severeSampleCount > 0) {
    whyGoodProspect.push(
      `${severeSampleCount} recent 1–2★ review(s) in sample (replies NOT VERIFIED)`
    );
  } else if (sampledLowRatingCount > 0) {
    whyGoodProspect.push(
      `${sampledLowRatingCount} low-rated review(s) in sample (replies NOT VERIFIED)`
    );
  } else {
    whyGoodProspect.push('Owner response activity: NOT VERIFIED yet');
  }

  return {
    leadScore,
    tier,
    tierLabel,
    scoreBreakdown: {
      reputationNeed,
      businessFit,
      reachability,
      confidenceBonus,
    },
    confidenceLabel,
    contactReadinessLabel,
    emailConfidence,
    instagramConfidence,
    actionRecommendation,
    reviewOpportunityTitle,
    reviewOpportunityDetail,
    isReviewResponseVerified,
    sampledLowRatingCount,
    whyGoodProspect: whyGoodProspect.slice(0, 4),
    signals: {
      hasWebsite,
      websiteReachable,
      hasInstagram,
      hasEmail,
      hasPhone,
    },
  };
}
