import React, { useState } from 'react';
import {
  ExternalLink,
  Globe,
  Phone,
  MapPin,
  Star,
  ClipboardCheck,
  CheckCircle2,
  Flame,
  Zap,
  Instagram,
  Facebook,
  Share2,
  Search,
  Sparkles,
  RefreshCw,
  Mail,
  TrendingUp,
  MessageSquareWarning,
  ShieldAlert,
} from 'lucide-react';
import { DiscoveredPlace, ProspectResearch, SocialProfiles } from '../types';
import { computeLeadOpportunity } from '../utils/leadScoring';

interface RestaurantCardProps {
  place: DiscoveredPlace;
  prospect?: ProspectResearch;
  onInspect: (place: DiscoveredPlace) => void;
  onUpdateSocials?: (placeId: string, socials: SocialProfiles) => void;
  isSelected?: boolean;
}

export const RestaurantCard: React.FC<RestaurantCardProps> = ({
  place,
  prospect,
  onInspect,
  onUpdateSocials,
  isSelected,
}) => {
  const [isScanningSocials, setIsScanningSocials] = useState(false);

  // Derive active socials from place or saved prospect
  const currentSocials: SocialProfiles | undefined =
    prospect?.socials ||
    (prospect?.instagramUrl || prospect?.instagramHandle
      ? {
          instagram: prospect.instagramUrl,
          instagramHandle: prospect.instagramHandle,
          facebook: prospect.facebookUrl,
          tiktok: prospect.tiktokUrl,
          websiteEmail: prospect.contactEmail,
          source: 'manual_entry',
        }
      : place.socials);

  const opportunity = computeLeadOpportunity(place, prospect, currentSocials);
  const effectiveEmail = currentSocials?.websiteEmail || prospect?.contactEmail;

  const handleScanSocials = async () => {
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
        if (onUpdateSocials) {
          onUpdateSocials(place.id, data);
        }
      }
    } catch (err) {
      console.warn('Failed to scan socials for place:', err);
    } finally {
      setIsScanningSocials(false);
    }
  };

  const isAutoScanning = isScanningSocials || currentSocials?.source === 'scanning';

  const instagramSearchQuery = `site:instagram.com "${place.displayName}" ${place.city}`;
  const instagramSearchUrl = `https://www.google.com/search?q=${encodeURIComponent(
    instagramSearchQuery
  )}`;

  const getTierBanner = () => {
    if (opportunity.tier === 'HIGH_POTENTIAL') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-gradient-to-r from-orange-500/20 to-emerald-500/20 text-orange-300 border border-orange-500/35">
          <Flame className="w-3.5 h-3.5 text-orange-400" />
          <span>High-Potential Prospect</span>
        </span>
      );
    }
    if (opportunity.tier === 'MEDIUM_POTENTIAL') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
          <Zap className="w-3.5 h-3.5 text-amber-400" />
          <span>Medium-Potential Prospect</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-700/60 text-slate-300 border border-slate-600/50">
        <span>Standard Prospect</span>
      </span>
    );
  };

  const scoreBarColor =
    opportunity.leadScore >= 72
      ? 'from-orange-500 to-emerald-400'
      : opportunity.leadScore >= 50
      ? 'from-amber-500 to-yellow-400'
      : 'from-slate-500 to-slate-400';

  const scoreTextColor =
    opportunity.leadScore >= 72
      ? 'text-emerald-300'
      : opportunity.leadScore >= 50
      ? 'text-amber-300'
      : 'text-slate-300';

  return (
    <div
      className={`bg-slate-800/90 rounded-2xl border transition-all duration-200 overflow-hidden flex flex-col justify-between ${
        isSelected
          ? 'border-emerald-500 shadow-lg shadow-emerald-500/10 ring-1 ring-emerald-500'
          : opportunity.tier === 'HIGH_POTENTIAL'
          ? 'border-orange-500/30 hover:border-orange-400/60'
          : 'border-slate-700/70 hover:border-slate-600'
      }`}
    >
      <div className="p-5 space-y-4">
        {/* Top Tier Header + Lead Score */}
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="space-y-1.5 min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              {getTierBanner()}
              {prospect && (
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                    prospect.opportunityLevel === 'HIGH'
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                      : prospect.opportunityLevel === 'MEDIUM'
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                      : prospect.opportunityLevel === 'LOW'
                      ? 'bg-slate-700 text-slate-300 border-slate-600'
                      : 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30'
                  }`}
                >
                  Saved: {prospect.opportunityLevel}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 flex-wrap pt-0.5">
              <h3 className="font-bold text-base sm:text-lg text-white tracking-tight leading-snug">
                {place.displayName}
              </h3>
              {place.category && (
                <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-slate-700/80 text-slate-300 border border-slate-600/50">
                  {place.category}
                </span>
              )}
            </div>
          </div>

          {/* Lead Score Badge */}
          <div className="shrink-0 text-right bg-slate-900/90 border border-slate-700/80 rounded-xl px-3 py-2 min-w-[106px]">
            <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold flex items-center justify-end gap-1">
              <TrendingUp className="w-3 h-3 text-emerald-400" />
              <span>Lead Score</span>
            </div>
            <div className={`text-lg font-extrabold font-mono leading-tight ${scoreTextColor}`}>
              {opportunity.leadScore}
              <span className="text-xs text-slate-500 font-normal">/100</span>
            </div>
            <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden mt-1">
              <div
                className={`h-full bg-gradient-to-r ${scoreBarColor} rounded-full`}
                style={{ width: `${opportunity.leadScore}%` }}
              />
            </div>
          </div>
        </div>

        {/* Key Prospect Signals Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-3 rounded-xl bg-slate-900/70 border border-slate-700/50 text-xs">
          {/* Rating & Reviews */}
          <div className="flex items-center gap-1.5 text-slate-200">
            <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400 shrink-0" />
            <span className="font-bold text-amber-300">
              {place.rating !== undefined ? place.rating.toFixed(1) : 'N/A'}
            </span>
            <span className="text-slate-500">—</span>
            <span className="font-semibold text-white">
              {place.userRatingCount !== undefined
                ? `${place.userRatingCount.toLocaleString()} reviews`
                : 'Reviews N/A'}
            </span>
          </div>

          {/* Location */}
          <div className="flex items-center gap-1.5 text-slate-300 min-w-0">
            <MapPin className="w-3.5 h-3.5 text-rose-400 shrink-0" />
            <span className="truncate" title={place.formattedAddress}>
              {place.city}, {place.state}
            </span>
            <span
              className="text-[10px] text-slate-500 font-mono shrink-0"
              title="Source: Google Maps Places API"
            >
              [Places API]
            </span>
          </div>

          {/* Instagram Status */}
          <div className="flex items-center gap-1.5 min-w-0">
            <Instagram className="w-3.5 h-3.5 text-pink-400 shrink-0" />
            {isAutoScanning ? (
              <span className="text-sky-300 flex items-center gap-1 text-[11px]">
                <RefreshCw className="w-3 h-3 animate-spin" />
                Scanning Instagram...
              </span>
            ) : currentSocials?.instagram ? (
              <a
                href={currentSocials.instagram}
                target="_blank"
                rel="noopener noreferrer"
                className="text-pink-300 hover:text-white font-semibold underline underline-offset-2 truncate inline-flex items-center gap-1"
                title={`Open ${currentSocials.instagram}`}
              >
                <span>Instagram found</span>
                {currentSocials.instagramHandle && (
                  <span className="font-mono text-[11px] text-pink-400">
                    ({currentSocials.instagramHandle})
                  </span>
                )}
              </a>
            ) : (
              <div className="flex items-center gap-1.5 text-slate-400 min-w-0">
                <span className="truncate">No Instagram found</span>
                <a
                  href={instagramSearchUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] text-sky-400 hover:text-sky-300 underline shrink-0"
                >
                  Search IG
                </a>
              </div>
            )}
          </div>

          {/* Email Status */}
          <div className="flex items-center gap-1.5 min-w-0">
            <Mail className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
            {effectiveEmail ? (
              <a
                href={`mailto:${effectiveEmail}`}
                className="text-indigo-300 hover:text-white font-semibold underline underline-offset-2 truncate"
                title={effectiveEmail}
              >
                Business email found
              </a>
            ) : (
              <span className="text-slate-500">Email not listed</span>
            )}
          </div>

          {/* Website Status */}
          <div className="flex items-center gap-1.5 min-w-0">
            <Globe className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            {place.websiteUri ? (
              <a
                href={place.websiteUri}
                target="_blank"
                rel="noopener noreferrer"
                className="text-emerald-300 hover:text-white font-semibold underline underline-offset-2 truncate"
                title={place.websiteUri}
              >
                Website found ({place.websiteUri.replace(/^https?:\/\/(www\.)?/, '').split('/')[0]})
              </a>
            ) : (
              <span className="text-slate-500">Website not listed</span>
            )}
          </div>

          {/* Public Phone */}
          <div className="flex items-center gap-1.5 min-w-0">
            <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            {place.nationalPhoneNumber ? (
              <span className="text-slate-200 truncate">{place.nationalPhoneNumber}</span>
            ) : (
              <span className="text-slate-500">Phone not provided</span>
            )}
          </div>
        </div>

        {/* Extra discovered social links + email chip if present */}
        {(currentSocials?.facebook ||
          currentSocials?.tiktok ||
          effectiveEmail ||
          !isAutoScanning) && (
          <div className="flex items-center flex-wrap gap-1.5 text-[11px]">
            {effectiveEmail && (
              <a
                href={`mailto:${effectiveEmail}`}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 hover:text-white font-mono"
              >
                <Mail className="w-3 h-3" />
                <span className="truncate max-w-[190px]">{effectiveEmail}</span>
              </a>
            )}
            {currentSocials?.facebook && (
              <a
                href={currentSocials.facebook}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-blue-600/20 border border-blue-500/30 text-blue-300 hover:text-white"
              >
                <Facebook className="w-3 h-3 text-blue-400" />
                <span>Facebook</span>
              </a>
            )}
            {currentSocials?.tiktok && (
              <a
                href={currentSocials.tiktok}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-cyan-600/20 border border-cyan-500/30 text-cyan-300 hover:text-white"
              >
                <Share2 className="w-3 h-3 text-cyan-400" />
                <span>TikTok</span>
              </a>
            )}
            {!isAutoScanning && (
              <button
                type="button"
                onClick={handleScanSocials}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-900 text-slate-400 hover:text-white border border-slate-700 hover:border-slate-500 transition-colors cursor-pointer ml-auto"
                title="Re-scan website, open directories & Google Search for socials/email"
              >
                {currentSocials?.instagram ? (
                  <>
                    <RefreshCw className="w-3 h-3" />
                    <span>Rescan</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3 h-3 text-pink-400" />
                    <span>{place.websiteUri ? 'Scan Socials' : 'Find Socials'}</span>
                  </>
                )}
              </button>
            )}
          </div>
        )}

        {/* Review Opportunity Panel */}
        <div
          className={`p-3 rounded-xl border text-xs space-y-1.5 ${
            opportunity.isReviewResponseVerified &&
            (prospect?.unansweredNegativeCount ?? 0) > 0
              ? 'bg-emerald-950/30 border-emerald-500/30'
              : 'bg-slate-900/80 border-slate-700/70'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="font-bold text-white flex items-center gap-1.5">
              {opportunity.isReviewResponseVerified ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <MessageSquareWarning className="w-3.5 h-3.5 text-amber-400" />
              )}
              <span>Review opportunity</span>
            </span>

            {opportunity.isReviewResponseVerified ? (
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                [Human Verified {prospect?.dateInspected}]
              </span>
            ) : (
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/25 flex items-center gap-1">
                <ShieldAlert className="w-2.5 h-2.5" />
                <span>NOT VERIFIED</span>
              </span>
            )}
          </div>

          <p className="text-slate-200 leading-relaxed font-medium">
            {opportunity.reviewOpportunityDetail}
          </p>
        </div>

        {/* Why this is a good prospect */}
        <div className="space-y-1.5">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Why this is a good prospect
          </div>
          <ul className="space-y-1 text-xs text-slate-300">
            {opportunity.whyGoodProspect.map((reason, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="text-emerald-400 font-bold leading-5">•</span>
                <span>{reason}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Action Footer */}
      <div className="p-3 bg-slate-900/80 border-t border-slate-700/60 flex items-center justify-between gap-2">
        <a
          href={place.googleMapsUri}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors"
          title="Open original place listing on Google Maps to inspect owner replies"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          <span>Open in Google Maps</span>
        </a>

        <button
          onClick={() => onInspect(place)}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            prospect
              ? 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 border border-emerald-500/40'
              : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-sm shadow-emerald-500/20'
          }`}
        >
          <ClipboardCheck className="w-3.5 h-3.5" />
          <span>{prospect ? 'Edit Inspection' : 'Inspect Reviews'}</span>
        </button>
      </div>
    </div>
  );
};
