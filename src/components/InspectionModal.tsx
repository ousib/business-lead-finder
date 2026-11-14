import React, { useState } from 'react';
import {
  X,
  ExternalLink,
  Sparkles,
  ClipboardCheck,
  AlertTriangle,
  Info,
  ShieldCheck,
  CheckCircle,
  HelpCircle,
  Mail,
  Phone,
  Globe,
  Star,
  MessageSquareWarning,
  Check,
  Instagram,
  Facebook,
  Share2,
  RefreshCw,
  Search,
} from 'lucide-react';
import {
  DiscoveredPlace,
  ProspectResearch,
  ContactStatus,
  OpportunityLevel,
  SocialProfiles,
  SocialDiscoverySource,
} from '../types';

interface InspectionModalProps {
  place: DiscoveredPlace;
  existingProspect?: ProspectResearch;
  onSave: (prospect: ProspectResearch) => void;
  onClose: () => void;
}

export const InspectionModal: React.FC<InspectionModalProps> = ({
  place,
  existingProspect,
  onSave,
  onClose,
}) => {
  const todayStr = new Date().toISOString().split('T')[0];

  // Checklist state
  const [reviewsInspected, setReviewsInspected] = useState<number>(
    existingProspect?.reviewsInspectedCount ?? (place.sampleReviews?.length || 5)
  );
  const [negativeReviews, setNegativeReviews] = useState<number>(
    existingProspect?.negativeReviewsCount ?? 0
  );
  const [negativeWithReplies, setNegativeWithReplies] = useState<number>(
    existingProspect?.negativeWithRepliesCount ?? 0
  );
  const [dateInspected, setDateInspected] = useState<string>(
    existingProspect?.dateInspected || todayStr
  );
  const [notes, setNotes] = useState<string>(existingProspect?.inspectionNotes || '');

  // Social discovery state
  const initialSocials: SocialProfiles | undefined =
    existingProspect?.socials || place.socials;

  const [instagramUrl, setInstagramUrl] = useState<string>(
    existingProspect?.instagramUrl || initialSocials?.instagram || ''
  );
  const [instagramHandle, setInstagramHandle] = useState<string>(
    existingProspect?.instagramHandle || initialSocials?.instagramHandle || ''
  );
  const [facebookUrl, setFacebookUrl] = useState<string>(
    existingProspect?.facebookUrl || initialSocials?.facebook || ''
  );
  const [tiktokUrl, setTiktokUrl] = useState<string>(
    existingProspect?.tiktokUrl || initialSocials?.tiktok || ''
  );
  const [isScanningSocials, setIsScanningSocials] = useState<boolean>(false);
  const [socialSource, setSocialSource] = useState<SocialDiscoverySource>(
    initialSocials?.source || 'unscanned'
  );
  const [discoveredSources, setDiscoveredSources] = useState<Array<{ title?: string; url: string }>>(
    initialSocials?.discoveredSources || []
  );

  // Contact discovery state
  const [contactEmail, setContactEmail] = useState<string>(
    existingProspect?.contactEmail || initialSocials?.websiteEmail || ''
  );
  const [contactStatus, setContactStatus] = useState<ContactStatus>(
    existingProspect?.contactStatus || 'Not Contacted'
  );

  // AI Evaluation state
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<{
    opportunity: OpportunityLevel;
    rationale: string;
    verifiedEvidence: string[];
    assumptions: string[];
    replyNationPitchAngle: string;
  } | null>(
    existingProspect?.opportunityLevel
      ? {
          opportunity: existingProspect.opportunityLevel,
          rationale: existingProspect.opportunityRationale,
          verifiedEvidence: existingProspect.verifiedEvidence,
          assumptions: existingProspect.assumptions,
          replyNationPitchAngle: existingProspect.pitchAngle,
        }
      : null
  );

  // Derived unanswered negative count: negative - negativeWithReplies
  const unansweredCount = Math.max(0, negativeReviews - negativeWithReplies);

  const handleScanSocialsFromWebsite = async () => {
    setIsScanningSocials(true);
    try {
      const res = await fetch('/api/discover-socials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: place.websiteUri || '',
          businessName: place.displayName,
          city: place.city,
          state: place.state,
        }),
      });
      if (res.ok) {
        const data: SocialProfiles = await res.json();
        if (data.instagram) {
          setInstagramUrl(data.instagram);
        }
        if (data.instagramHandle) {
          setInstagramHandle(data.instagramHandle);
        }
        if (data.facebook) {
          setFacebookUrl(data.facebook);
        }
        if (data.tiktok) {
          setTiktokUrl(data.tiktok);
        }
        if (data.websiteEmail && !contactEmail) {
          setContactEmail(data.websiteEmail);
        }
        if (data.discoveredSources) {
          setDiscoveredSources(data.discoveredSources);
        }
        setSocialSource(data.source);
      }
    } catch (err) {
      console.warn('Failed to discover socials:', err);
    } finally {
      setIsScanningSocials(false);
    }
  };

  const handleRunAiEvaluation = async () => {
    setIsAiLoading(true);
    try {
      const payload = {
        businessName: place.displayName,
        city: place.city,
        state: place.state,
        category: place.category,
        rating: place.rating,
        userRatingCount: place.userRatingCount,
        hasManualInspection: reviewsInspected > 0,
        reviewsInspectedCount: reviewsInspected,
        negativeReviewsCount: negativeReviews,
        negativeWithRepliesCount: negativeWithReplies,
        unansweredNegativeCount: unansweredCount,
        inspectionNotes: notes,
      };

      const res = await fetch('/api/classify-prospect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error(`Server returned HTTP ${res.status}`);
      }

      const data = await res.json();
      setAiResult(data);
    } catch (err) {
      console.error('Failed to run AI evaluation:', err);
      // Fallback evaluation purely rule-based
      const fallbackOpportunity: OpportunityLevel =
        reviewsInspected === 0
          ? 'UNVERIFIED'
          : unansweredCount >= 2
          ? 'HIGH'
          : unansweredCount === 1
          ? 'MEDIUM'
          : 'LOW';

      setAiResult({
        opportunity: fallbackOpportunity,
        rationale:
          reviewsInspected === 0
            ? 'Owner response status is unverified without manual review inspection.'
            : `Verified ${unansweredCount} unanswered negative review(s) across ${reviewsInspected} inspected reviews.`,
        verifiedEvidence: [
          `Inspected ${reviewsInspected} reviews.`,
          `Found ${negativeReviews} negative reviews with ${unansweredCount} lacking owner replies.`,
        ],
        assumptions: [
          'Assumes the sampled reviews represent standard owner responsiveness.',
        ],
        replyNationPitchAngle:
          unansweredCount > 0
            ? 'Demonstrate automated AI de-escalation for the verified unaddressed reviews.'
            : 'Focus on time savings and reputation consistency across all customer ratings.',
      });
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleSaveProspect = () => {
    const oppLevel: OpportunityLevel =
      aiResult?.opportunity ||
      (reviewsInspected === 0
        ? 'UNVERIFIED'
        : unansweredCount >= 2
        ? 'HIGH'
        : unansweredCount === 1
        ? 'MEDIUM'
        : 'LOW');

    const cleanIgUrl = instagramUrl.trim();
    let cleanHandle = instagramHandle.trim();
    if (cleanIgUrl && !cleanHandle) {
      const match = cleanIgUrl.match(/instagram\.com\/([a-zA-Z0-9_.]{2,30})/i);
      if (match && match[1]) {
        cleanHandle = `@${match[1]}`;
      }
    }

    const preservedAutoSources: SocialDiscoverySource[] = [
      'scanned_from_website',
      'discovered_via_google_search',
      'website_and_google_search',
    ];

    const updatedSocials: SocialProfiles = {
      instagram: cleanIgUrl || undefined,
      instagramHandle: cleanHandle || undefined,
      facebook: facebookUrl.trim() || undefined,
      tiktok: tiktokUrl.trim() || undefined,
      websiteEmail: contactEmail.trim() || undefined,
      source: preservedAutoSources.includes(socialSource)
        ? socialSource
        : cleanIgUrl || facebookUrl || tiktokUrl
        ? 'manual_entry'
        : 'not_found',
      lastScannedAt: new Date().toISOString(),
      discoveredSources: discoveredSources.length > 0 ? discoveredSources : undefined,
    };

    const prospectRecord: ProspectResearch = {
      placeId: place.id,
      businessName: place.displayName,
      city: place.city,
      state: place.state,
      category: place.category,
      googleMapsUri: place.googleMapsUri,
      websiteUri: place.websiteUri,
      nationalPhoneNumber: place.nationalPhoneNumber,
      rating: place.rating,
      userRatingCount: place.userRatingCount,

      // Social discovery
      socials: updatedSocials,
      instagramUrl: cleanIgUrl || undefined,
      instagramHandle: cleanHandle || undefined,
      facebookUrl: facebookUrl.trim() || undefined,
      tiktokUrl: tiktokUrl.trim() || undefined,

      hasManualInspection: reviewsInspected > 0,
      dateInspected,
      reviewsInspectedCount: reviewsInspected,
      negativeReviewsCount: negativeReviews,
      negativeWithRepliesCount: negativeWithReplies,
      unansweredNegativeCount: unansweredCount,
      inspectionNotes: notes,

      contactEmail: contactEmail.trim() || undefined,
      contactStatus,

      opportunityLevel: oppLevel,
      opportunityRationale:
        aiResult?.rationale ||
        (reviewsInspected === 0
          ? 'Unverified opportunity pending review inspection.'
          : `${unansweredCount} verified unanswered negative reviews.`),
      verifiedEvidence: aiResult?.verifiedEvidence || [
        `Inspected ${reviewsInspected} reviews on Google Maps listing.`,
        `Identified ${unansweredCount} unanswered negative reviews.`,
      ],
      assumptions: aiResult?.assumptions || [
        'Assumes current owner reply frequency continues without ReplyNation.',
      ],
      pitchAngle:
        aiResult?.replyNationPitchAngle ||
        'Highlight ReplyNation AI review turnaround and reputation protection.',
      lastAiEvaluatedAt: new Date().toISOString(),

      verificationStatus:
        reviewsInspected > 0 ? 'Human Verified' : 'Pending Inspection',
    };

    onSave(prospectRecord);
    onClose();
  };

  const instagramSearchQuery = `site:instagram.com "${place.displayName}" ${place.city}`;
  const instagramSearchUrl = `https://www.google.com/search?q=${encodeURIComponent(
    instagramSearchQuery
  )}`;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col">
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-800 bg-slate-900/90 flex items-start justify-between gap-4 sticky top-0 z-10">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <ClipboardCheck className="w-5 h-5" />
              </span>
              <div>
                <h2 className="text-lg font-bold text-white tracking-tight">
                  Review Opportunity &amp; Social Inspection
                </h2>
                <p className="text-xs text-slate-400">
                  {place.displayName} • {place.formattedAddress}
                </p>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6 flex-1 text-xs sm:text-sm">
          {/* Important Compliance & Grounding Notice */}
          <div className="p-3.5 rounded-xl bg-indigo-950/40 border border-indigo-500/30 flex items-start gap-3">
            <Info className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
            <div className="space-y-1 text-slate-300 text-xs">
              <div className="font-semibold text-indigo-300">
                Compliance Notice: Review Sample &amp; Owner Response Verification
              </div>
              <p>
                The Google Maps Platform Places API provides only a partial sample of recent reviews
                and does not disclose owner response flags. Consequently, owner reply statuses are{' '}
                <span className="font-bold text-amber-300">NOT VERIFIED</span> until you inspect the
                original listing.
              </p>
              <div className="pt-1">
                <a
                  href={place.googleMapsUri}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-emerald-400 hover:text-emerald-300 font-semibold underline underline-offset-2"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Open live Google Maps listing to inspect reviews now</span>
                </a>
              </div>
            </div>
          </div>

          {/* Section 1: Place Overview & Public Contact Info */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/60">
            <div>
              <span className="text-[11px] text-slate-400 block">Rating &amp; Volume</span>
              <div className="flex items-center gap-1.5 font-bold text-white mt-0.5">
                <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                <span>{place.rating ? place.rating.toFixed(1) : 'N/A'}</span>
                <span className="text-xs text-slate-400 font-normal">
                  ({place.userRatingCount?.toLocaleString() || '0'} reviews)
                </span>
              </div>
            </div>

            <div>
              <span className="text-[11px] text-slate-400 block">Public Business Phone</span>
              <div className="flex items-center gap-1.5 text-white mt-0.5 font-mono text-xs">
                <Phone className="w-3.5 h-3.5 text-slate-400" />
                <span>{place.nationalPhoneNumber || 'None listed'}</span>
              </div>
            </div>

            <div>
              <span className="text-[11px] text-slate-400 block">Official Website</span>
              {place.websiteUri ? (
                <a
                  href={place.websiteUri}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-emerald-400 hover:underline mt-0.5 text-xs truncate"
                >
                  <Globe className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{place.websiteUri.replace(/^https?:\/\/(www\.)?/, '')}</span>
                  <ExternalLink className="w-3 h-3 shrink-0 ml-1" />
                </a>
              ) : (
                <span className="text-slate-500 italic mt-0.5 block text-xs">Not available</span>
              )}
            </div>
          </div>

          {/* Social Presence & Instagram Discovery Section */}
          <div className="space-y-3 p-4 rounded-xl bg-gradient-to-br from-pink-950/20 via-slate-800/80 to-slate-900 border border-pink-500/30">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-pink-500/20 text-pink-300">
                  <Instagram className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-xs uppercase tracking-wider">
                    Social Discovery (Instagram &amp; Profiles)
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Scans official website first, then checks Google Search &amp; social directories
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleScanSocialsFromWebsite}
                disabled={isScanningSocials}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white shadow-md shadow-pink-600/20 transition-all cursor-pointer disabled:opacity-50"
              >
                {isScanningSocials ? (
                  <RefreshCw className="w-3 h-3 animate-spin" />
                ) : (
                  <Sparkles className="w-3 h-3" />
                )}
                <span>
                  {isScanningSocials
                    ? 'Searching Site & Google...'
                    : 'Auto-Discover (Site + Google)'}
                </span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              {/* Instagram URL */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1 flex items-center justify-between">
                  <span className="flex items-center gap-1 text-pink-300">
                    <Instagram className="w-3 h-3" />
                    <span>Instagram Profile URL</span>
                  </span>
                  {instagramUrl && (
                    <a
                      href={instagramUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] text-pink-400 hover:underline flex items-center gap-0.5"
                    >
                      <span>Open Profile</span>
                      <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  )}
                </label>
                <div className="relative">
                  <input
                    type="url"
                    placeholder="https://www.instagram.com/restaurant_handle/"
                    value={instagramUrl}
                    onChange={(e) => setInstagramUrl(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-pink-500"
                  />
                </div>
              </div>

              {/* Instagram Handle */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1 flex items-center justify-between">
                  <span className="flex items-center gap-1 text-pink-300">
                    <span>Instagram Handle (@username)</span>
                  </span>
                  <a
                    href={instagramSearchUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] text-slate-400 hover:text-white flex items-center gap-0.5"
                  >
                    <Search className="w-2.5 h-2.5" />
                    <span>Search on IG</span>
                  </a>
                </label>
                <input
                  type="text"
                  placeholder="@handle"
                  value={instagramHandle}
                  onChange={(e) => setInstagramHandle(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-pink-500 font-mono"
                />
              </div>

              {/* Facebook URL */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1 flex items-center gap-1 text-blue-300">
                  <Facebook className="w-3 h-3" />
                  <span>Facebook Page URL</span>
                </label>
                <input
                  type="url"
                  placeholder="https://www.facebook.com/restaurant"
                  value={facebookUrl}
                  onChange={(e) => setFacebookUrl(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* TikTok URL */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1 flex items-center gap-1 text-cyan-300">
                  <Share2 className="w-3 h-3" />
                  <span>TikTok Profile URL</span>
                </label>
                <input
                  type="url"
                  placeholder="https://www.tiktok.com/@restaurant"
                  value={tiktokUrl}
                  onChange={(e) => setTiktokUrl(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>

            {discoveredSources.length > 0 && (
              <div className="pt-2 border-t border-pink-500/20 flex items-center flex-wrap gap-2 text-[11px]">
                <span className="text-slate-400 font-medium">Google &amp; Web Sources Checked:</span>
                {discoveredSources.map((src, idx) => (
                  <a
                    key={idx}
                    href={src.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-900/90 border border-slate-700 text-sky-400 hover:text-sky-300 truncate max-w-[200px]"
                    title={src.url}
                  >
                    <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                    <span className="truncate">
                      {src.title || src.url.replace(/^https?:\/\/(www\.)?/, '').split('/')[0]}
                    </span>
                  </a>
                ))}
              </div>
            )}
          </div>

          {/* Section 2: Manual Review Checklist */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-white text-sm flex items-center gap-1.5">
                <ClipboardCheck className="w-4 h-4 text-emerald-400" />
                <span>Manual Review Checklist</span>
              </h3>
              <span className="text-[11px] text-slate-400">
                Record your manual observations from Google Maps
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Reviews Inspected */}
              <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/70">
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  Reviews Inspected
                </label>
                <input
                  type="number"
                  min="0"
                  max="200"
                  value={reviewsInspected}
                  onChange={(e) => setReviewsInspected(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono text-sm focus:outline-none focus:border-emerald-500"
                />
                <span className="text-[10px] text-slate-500 mt-1 block">
                  Total reviews checked manually
                </span>
              </div>

              {/* Negative Reviews */}
              <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/70">
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  Negative Reviews (1-2★)
                </label>
                <input
                  type="number"
                  min="0"
                  max={reviewsInspected}
                  value={negativeReviews}
                  onChange={(e) => setNegativeReviews(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono text-sm focus:outline-none focus:border-emerald-500"
                />
                <span className="text-[10px] text-slate-500 mt-1 block">
                  Count of negative reviews found
                </span>
              </div>

              {/* Negative with Owner Replies */}
              <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/70">
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  Had Owner Replies
                </label>
                <input
                  type="number"
                  min="0"
                  max={negativeReviews}
                  value={negativeWithReplies}
                  onChange={(e) =>
                    setNegativeWithReplies(Math.max(0, parseInt(e.target.value) || 0))
                  }
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono text-sm focus:outline-none focus:border-emerald-500"
                />
                <span className="text-[10px] text-slate-500 mt-1 block">
                  Negative reviews with responses
                </span>
              </div>
            </div>

            {/* Calculated Unanswered Negative Reviews Alert */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-800/90 border border-slate-700">
              <div className="flex items-center gap-2">
                <MessageSquareWarning
                  className={`w-4 h-4 ${
                    unansweredCount > 0 ? 'text-amber-400' : 'text-emerald-400'
                  }`}
                />
                <div>
                  <span className="text-xs font-semibold text-white">
                    Verified Unanswered Negative Reviews:
                  </span>{' '}
                  <span
                    className={`font-mono font-bold text-sm ${
                      unansweredCount > 0 ? 'text-amber-400' : 'text-emerald-400'
                    }`}
                  >
                    {unansweredCount}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <label className="text-[11px] text-slate-400">Date Inspected:</label>
                <input
                  type="date"
                  value={dateInspected}
                  onChange={(e) => setDateInspected(e.target.value)}
                  className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white"
                />
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Inspection Notes &amp; Complaint Patterns
              </label>
              <textarea
                rows={2}
                placeholder="e.g. 3 recent 1-star reviews in the last 60 days mentioning cold takeout orders and unhelpful phone staff. Zero owner replies visible."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Section 3: Contact Discovery */}
          <div className="space-y-3 p-4 rounded-xl bg-slate-800/60 border border-slate-700/60">
            <h3 className="font-bold text-white text-xs uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-indigo-400" />
              <span>Contact Discovery &amp; Status</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  Contact Email (Verified from site or entered)
                </label>
                <input
                  type="email"
                  placeholder="e.g. manager@restaurant.com"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  Outreach Status
                </label>
                <select
                  value={contactStatus}
                  onChange={(e) => setContactStatus(e.target.value as ContactStatus)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="Not Contacted">Not Contacted</option>
                  <option value="Email Drafted">Email Drafted</option>
                  <option value="Outreached">Outreached</option>
                  <option value="In Discussion">In Discussion</option>
                  <option value="Not Interested">Not Interested</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 4: AI Assistance Opportunity Classifier */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-950/40 via-slate-800/80 to-slate-900 border border-indigo-500/30 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-300">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-sm">
                    AI Opportunity Classification
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Relying exclusively on supplied evidence to prioritize for ReplyNation
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleRunAiEvaluation}
                disabled={isAiLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/30 transition-all cursor-pointer disabled:opacity-50"
              >
                {isAiLoading ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Analyzing Evidence...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Run AI Evaluation</span>
                  </>
                )}
              </button>
            </div>

            {/* AI Results Display */}
            {aiResult && (
              <div className="pt-2 space-y-3 border-t border-indigo-500/20 text-xs">
                {/* Level & Rationale */}
                <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-900/90 border border-slate-700">
                  <div className="shrink-0 pt-0.5">
                    {aiResult.opportunity === 'HIGH' && (
                      <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                        HIGH
                      </span>
                    )}
                    {aiResult.opportunity === 'MEDIUM' && (
                      <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                        MEDIUM
                      </span>
                    )}
                    {aiResult.opportunity === 'LOW' && (
                      <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-700 text-slate-300 border border-slate-600">
                        LOW
                      </span>
                    )}
                    {aiResult.opportunity === 'UNVERIFIED' && (
                      <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-purple-500/20 text-purple-300 border border-purple-500/40">
                        UNVERIFIED
                      </span>
                    )}
                  </div>
                  <div className="space-y-1">
                    <span className="font-semibold text-white block">Classification Rationale</span>
                    <p className="text-slate-300 leading-relaxed">{aiResult.rationale}</p>
                  </div>
                </div>

                {/* Evidence vs Assumptions separation */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-700/80 space-y-1.5">
                    <div className="font-semibold text-emerald-400 flex items-center gap-1.5 text-xs">
                      <CheckCircle className="w-3.5 h-3.5" />
                      <span>Verified Evidence (Supplied Data)</span>
                    </div>
                    <ul className="space-y-1 text-[11px] text-slate-300 list-disc list-inside">
                      {aiResult.verifiedEvidence.map((ev, i) => (
                        <li key={i}>{ev}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-700/80 space-y-1.5">
                    <div className="font-semibold text-amber-400 flex items-center gap-1.5 text-xs">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>Assumptions &amp; Inferences</span>
                    </div>
                    <ul className="space-y-1 text-[11px] text-slate-400 list-disc list-inside">
                      {aiResult.assumptions.map((as, i) => (
                        <li key={i}>{as}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Recommended Pitch Angle */}
                {aiResult.replyNationPitchAngle && (
                  <div className="p-3 rounded-xl bg-indigo-950/30 border border-indigo-500/20 text-xs">
                    <span className="font-semibold text-indigo-300 block mb-0.5">
                      Suggested ReplyNation Pitch Angle:
                    </span>
                    <p className="text-slate-300">{aiResult.replyNationPitchAngle}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-900 border-t border-slate-800 flex items-center justify-between gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Cancel
          </button>

          <button
            onClick={handleSaveProspect}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-lg shadow-emerald-500/20 transition-all cursor-pointer"
          >
            <Check className="w-4 h-4" />
            <span>Save to Researched Pipeline</span>
          </button>
        </div>
      </div>
    </div>
  );
};
