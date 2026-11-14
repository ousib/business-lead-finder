export type OpportunityLevel = 'HIGH' | 'MEDIUM' | 'LOW' | 'UNVERIFIED';

export type ContactStatus =
  | 'Not Contacted'
  | 'Email Drafted'
  | 'Outreached'
  | 'In Discussion'
  | 'Not Interested';

export interface ReviewSample {
  authorName?: string;
  rating?: number;
  relativePublishTime?: string;
  publishTime?: string;
  text?: string;
  ownerResponseStatus: 'NOT VERIFIED' | 'CONFIRMED_REPLIED' | 'CONFIRMED_UNANSWERED';
}

export type SocialDiscoverySource =
  | 'scanned_from_website'
  | 'discovered_via_google_search'
  | 'website_and_google_search'
  | 'manual_entry'
  | 'not_found'
  | 'scanning'
  | 'unscanned';

export interface SocialProfiles {
  instagram?: string; // full URL e.g. https://www.instagram.com/austinbbq/
  instagramHandle?: string; // e.g. @austinbbq
  facebook?: string;
  tiktok?: string;
  twitter?: string;
  youtube?: string;
  websiteEmail?: string; // publicly listed contact email on website
  source: SocialDiscoverySource;
  lastScannedAt?: string;
  instagramSearchUrl?: string;
  discoveredSources?: Array<{ title?: string; url: string }>;
}

export interface DiscoveredPlace {
  id: string; // Google Place ID
  displayName: string;
  formattedAddress: string;
  city: string;
  state: string;
  category: string;
  googleMapsUri: string;
  websiteUri?: string;
  nationalPhoneNumber?: string;
  rating?: number;
  userRatingCount?: number;
  location?: {
    lat: number;
    lng: number;
  };
  sampleReviews?: ReviewSample[];
  socials?: SocialProfiles;
  rawSource: 'Google Maps Places API (New)';
}

export interface ProspectResearch {
  placeId: string;
  businessName: string;
  city: string;
  state: string;
  category: string;
  googleMapsUri: string;
  websiteUri?: string;
  nationalPhoneNumber?: string;
  rating?: number;
  userRatingCount?: number;

  // Social discovery
  socials?: SocialProfiles;
  instagramUrl?: string;
  instagramHandle?: string;
  facebookUrl?: string;
  tiktokUrl?: string;

  // Manual review checklist
  hasManualInspection: boolean;
  dateInspected: string;
  reviewsInspectedCount: number;
  negativeReviewsCount: number;
  negativeWithRepliesCount: number;
  unansweredNegativeCount: number;
  inspectionNotes: string;

  // Contact discovery
  contactEmail?: string;
  contactStatus: ContactStatus;

  // AI Classification
  opportunityLevel: OpportunityLevel;
  opportunityRationale: string;
  verifiedEvidence: string[];
  assumptions: string[];
  pitchAngle: string;
  lastAiEvaluatedAt?: string;

  verificationStatus: 'Pending Inspection' | 'Human Verified' | 'Needs Follow-up';
}

export interface SearchFilters {
  industry: string;
  city: string;
  state: string;
  cuisine: string;
  minRating: number;
  maxResults: number;
}
