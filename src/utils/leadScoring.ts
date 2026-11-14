import { DiscoveredPlace, ProspectResearch, SocialProfiles } from '../types';

export type LeadTier = 'HIGH_POTENTIAL' | 'MEDIUM_POTENTIAL' | 'LOW_POTENTIAL';

export interface LeadOpportunityAnalysis {
  leadScore: number; // 0 - 100
  tier: LeadTier;
  tierLabel: string;
  reviewOpportunityTitle: string;
  reviewOpportunityDetail: string;
  isReviewResponseVerified: boolean;
  sampledLowRatingCount: number;
  whyGoodProspect: string[];
  signals: {
    hasWebsite: boolean;
    hasInstagram: boolean;
    hasEmail: boolean;
    hasPhone: boolean;
  };
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
  const hasInstagram = Boolean(
    socials?.instagram || prospect?.instagramUrl || prospect?.instagramHandle
  );
  const hasEmail = Boolean(socials?.websiteEmail || prospect?.contactEmail);
  const hasPhone = Boolean(place.nationalPhoneNumber);

  const rating = place.rating;
  const reviewCount = place.userRatingCount ?? 0;
  const sampledLowRatingCount = (place.sampleReviews || []).filter(
    (r) => typeof r.rating === 'number' && r.rating <= 3
  ).length;

  // 1. Establishment Maturity / Review Volume (0 - 25 pts)
  let volumeScore = 4;
  if (reviewCount >= 500) volumeScore = 25;
  else if (reviewCount >= 200) volumeScore = 22;
  else if (reviewCount >= 100) volumeScore = 18;
  else if (reviewCount >= 40) volumeScore = 14;
  else if (reviewCount >= 15) volumeScore = 9;

  // 2. Reputation Sensitivity (0 - 25 pts)
  // 3.6 - 4.5 stars are the strongest buyers: high volume, visibly affected by negative reviews
  let ratingScore = 10;
  if (typeof rating === 'number') {
    if (rating >= 3.6 && rating <= 4.5) ratingScore = 25;
    else if (rating >= 3.0 && rating < 3.6) ratingScore = 20;
    else if (rating > 4.5 && rating <= 4.7) ratingScore = 15;
    else if (rating > 4.7) ratingScore = 8;
    else ratingScore = 14;
  }

  // 3. Digital & Outreach Readiness (0 - 25 pts)
  let digitalScore = 0;
  if (hasWebsite) digitalScore += 9;
  if (hasInstagram) digitalScore += 7;
  if (hasEmail) digitalScore += 6;
  if (hasPhone) digitalScore += 3;
  digitalScore = Math.min(25, digitalScore);

  // 4. Review Opportunity / Owner Response Signal (0 - 25 pts)
  const isReviewResponseVerified = Boolean(
    prospect?.hasManualInspection && (prospect.reviewsInspectedCount ?? 0) > 0
  );
  let responseScore = 0;
  let reviewOpportunityTitle = 'Review opportunity';
  let reviewOpportunityDetail = '';

  if (isReviewResponseVerified && prospect) {
    const unanswered = prospect.unansweredNegativeCount ?? 0;
    const inspected = prospect.reviewsInspectedCount ?? 0;
    const negative = prospect.negativeReviewsCount ?? 0;

    if (unanswered >= 3) {
      responseScore = 25;
      reviewOpportunityDetail = `${unanswered} inspected negative reviews have no owner response (out of ${inspected} checked).`;
    } else if (unanswered >= 1) {
      responseScore = unanswered === 2 ? 22 : 17;
      reviewOpportunityDetail = `${unanswered} inspected negative review${
        unanswered === 1 ? ' has' : 's have'
      } no owner response (out of ${inspected} checked).`;
    } else if (negative > 0) {
      responseScore = 6;
      reviewOpportunityDetail = `All ${negative} negative review(s) found during inspection already had owner replies.`;
    } else {
      responseScore = 9;
      reviewOpportunityDetail = `${inspected} reviews inspected with minimal negative complaints.`;
    }
  } else {
    // Strictly avoid fabricating owner-response counts when unverified
    if (sampledLowRatingCount > 0 && reviewCount >= 80) {
      responseScore = 15;
      reviewOpportunityDetail = `${sampledLowRatingCount} recent low-rated review(s) in Google sample — owner response status NOT VERIFIED.`;
    } else if (reviewCount >= 100 && typeof rating === 'number' && rating <= 4.5) {
      responseScore = 13;
      reviewOpportunityDetail = `High review flow (${reviewCount.toLocaleString()} total) at ${rating.toFixed(
        1
      )}★ — owner response status NOT VERIFIED.`;
    } else if (sampledLowRatingCount > 0) {
      responseScore = 11;
      reviewOpportunityDetail = `${sampledLowRatingCount} low-rated review(s) in sample — open Google Maps to verify owner replies.`;
    } else {
      responseScore = 6;
      reviewOpportunityDetail =
        'Owner response activity NOT VERIFIED — click Inspect Reviews to check on Google Maps.';
    }
  }

  const leadScore = Math.min(100, volumeScore + ratingScore + digitalScore + responseScore);

  let tier: LeadTier = 'LOW_POTENTIAL';
  let tierLabel = 'Standard Prospect';
  if (
    prospect?.opportunityLevel === 'HIGH' ||
    (prospect?.opportunityLevel !== 'LOW' && leadScore >= 72)
  ) {
    tier = 'HIGH_POTENTIAL';
    tierLabel = 'High-Potential Prospect';
  } else if (
    prospect?.opportunityLevel === 'MEDIUM' ||
    (prospect?.opportunityLevel !== 'LOW' && leadScore >= 50)
  ) {
    tier = 'MEDIUM_POTENTIAL';
    tierLabel = 'Medium-Potential Prospect';
  }

  // Build concise, evidence-grounded "Why this is a good prospect" bullets
  const whyGoodProspect: string[] = [];

  if (reviewCount >= 100) {
    whyGoodProspect.push(`${reviewCount.toLocaleString()} reviews = established business`);
  } else if (reviewCount >= 25) {
    whyGoodProspect.push(`${reviewCount.toLocaleString()} reviews = growing local footprint`);
  } else if (reviewCount > 0) {
    whyGoodProspect.push(`${reviewCount.toLocaleString()} reviews = early-stage profile`);
  }

  if (typeof rating === 'number') {
    if (rating >= 3.5 && rating <= 4.5) {
      whyGoodProspect.push(`${rating.toFixed(1)} rating = reputation-sensitive`);
    } else if (rating < 3.5) {
      whyGoodProspect.push(`${rating.toFixed(1)} rating = urgent reputation recovery need`);
    } else {
      whyGoodProspect.push(`${rating.toFixed(1)} rating = high-rating protection opportunity`);
    }
  }

  if (hasWebsite && hasInstagram) {
    whyGoodProspect.push('Active online presence (Website + Instagram)');
  } else if (hasWebsite || hasInstagram) {
    whyGoodProspect.push(
      hasWebsite ? 'Official website active' : 'Active Instagram presence'
    );
  }

  if (hasEmail && hasPhone) {
    whyGoodProspect.push('Direct outreach ready (Email + Phone found)');
  } else if (hasEmail) {
    whyGoodProspect.push('Business email found for direct outreach');
  }

  if (isReviewResponseVerified && prospect) {
    if (prospect.unansweredNegativeCount > 0) {
      whyGoodProspect.push(
        `Verified gap: ${prospect.unansweredNegativeCount} unanswered negative review(s)`
      );
    } else {
      whyGoodProspect.push('Owner already replies to negative reviews');
    }
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
    reviewOpportunityTitle,
    reviewOpportunityDetail,
    isReviewResponseVerified,
    sampledLowRatingCount,
    whyGoodProspect: whyGoodProspect.slice(0, 4),
    signals: {
      hasWebsite,
      hasInstagram,
      hasEmail,
      hasPhone,
    },
  };
}
