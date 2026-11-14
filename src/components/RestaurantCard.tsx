import React, { useState } from 'react';
import {
  ExternalLink,
  Globe,
  Phone,
  MapPin,
  Star,
  ClipboardCheck,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  ShieldCheck,
  Building,
  Instagram,
  Facebook,
  Share2,
  Search,
  Sparkles,
  RefreshCw,
  Mail,
} from 'lucide-react';
import { DiscoveredPlace, ProspectResearch, SocialProfiles } from '../types';

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
          source: 'manual_entry',
        }
      : place.socials);

  const getOpportunityBadge = (level: string) => {
    switch (level) {
      case 'HIGH':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            HIGH Opportunity
          </span>
        );
      case 'MEDIUM':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            MEDIUM Opportunity
          </span>
        );
      case 'LOW':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-700/60 text-slate-300 border border-slate-600/50">
            LOW Opportunity
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
            <HelpCircle className="w-3 h-3 text-indigo-400" />
            UNVERIFIED
          </span>
        );
    }
  };

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

  return (
    <div
      className={`bg-slate-800/90 rounded-2xl border transition-all duration-200 overflow-hidden flex flex-col justify-between ${
        isSelected
          ? 'border-emerald-500 shadow-lg shadow-emerald-500/10 ring-1 ring-emerald-500'
          : prospect
          ? 'border-slate-700 hover:border-slate-600'
          : 'border-slate-700/70 hover:border-slate-600'
      }`}
    >
      <div className="p-5 space-y-4">
        {/* Top Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-bold text-base text-white tracking-tight leading-snug">
                {place.displayName}
              </h3>
              {place.category && (
                <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-slate-700/80 text-slate-300 border border-slate-600/50">
                  {place.category}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="truncate">{place.formattedAddress}</span>
              <span className="text-[10px] text-slate-500 font-mono" title="Source: Google Maps Places API">
                [Places API]
              </span>
            </div>
          </div>

          <div className="shrink-0 text-right">
            {prospect ? (
              getOpportunityBadge(prospect.opportunityLevel)
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-slate-700/50 text-slate-400 border border-slate-700">
                Not Researched
              </span>
            )}
          </div>
        </div>

        {/* Rating and Volume */}
        <div className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-900/60 border border-slate-700/40 text-xs">
          <div className="flex items-center gap-1.5">
            <div className="flex items-center text-amber-400 font-bold">
              <Star className="w-4 h-4 fill-amber-400 mr-1" />
              <span>{place.rating !== undefined ? place.rating.toFixed(1) : 'N/A'}</span>
            </div>
            <span className="text-slate-500">/ 5.0</span>
          </div>
          <div className="h-3 w-px bg-slate-700" />
          <div className="text-slate-300">
            <span className="font-bold text-white">
              {place.userRatingCount !== undefined
                ? place.userRatingCount.toLocaleString()
                : 'Unknown'}
            </span>{' '}
            <span className="text-slate-400">Google Ratings</span>
          </div>
          <div className="ml-auto text-[10px] text-slate-500 font-mono">
            [Google Maps Verified]
          </div>
        </div>

        {/* Contact info rows */}
        <div className="space-y-1.5 text-xs text-slate-300">
          {place.nationalPhoneNumber ? (
            <div className="flex items-center gap-2">
              <Phone className="w-3.5 h-3.5 text-slate-400" />
              <span>{place.nationalPhoneNumber}</span>
              <span className="text-[10px] text-slate-500 font-mono">[Public Phone]</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-slate-500">
              <Phone className="w-3.5 h-3.5" />
              <span className="italic">Phone not provided</span>
            </div>
          )}

          {place.websiteUri ? (
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <Globe className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <a
                  href={place.websiteUri}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-emerald-400 hover:text-emerald-300 underline underline-offset-2 truncate"
                >
                  {place.websiteUri.replace(/^https?:\/\/(www\.)?/, '')}
                </a>
                <span className="text-[10px] text-slate-500 font-mono shrink-0">[Official Site]</span>
              </div>

              {/* Quick Scan Socials Button */}
              {(!currentSocials || currentSocials.source === 'unscanned') && !isAutoScanning && (
                <button
                  type="button"
                  onClick={handleScanSocials}
                  disabled={isAutoScanning}
                  className="text-[11px] font-semibold text-indigo-400 hover:text-indigo-300 bg-indigo-950/40 hover:bg-indigo-900/50 border border-indigo-500/30 px-2 py-0.5 rounded flex items-center gap-1 transition-colors shrink-0 cursor-pointer disabled:opacity-50"
                  title="Scan official website and Google Search for Instagram & social profiles"
                >
                  <Sparkles className="w-3 h-3 text-pink-400" />
                  <span>Get Socials</span>
                </button>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-between gap-2 text-slate-500">
              <div className="flex items-center gap-2">
                <Globe className="w-3.5 h-3.5" />
                <span className="italic">No website registered</span>
              </div>
              {(!currentSocials || currentSocials.source === 'unscanned') && !isAutoScanning && (
                <button
                  type="button"
                  onClick={handleScanSocials}
                  disabled={isAutoScanning}
                  className="text-[11px] font-semibold text-sky-400 hover:text-sky-300 bg-sky-950/40 hover:bg-sky-900/50 border border-sky-500/30 px-2 py-0.5 rounded flex items-center gap-1 transition-colors shrink-0 cursor-pointer disabled:opacity-50"
                  title="Search Google and social directories for Instagram & social profiles"
                >
                  <Search className="w-3 h-3 text-sky-400" />
                  <span>Find on Google</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Social Presence & Instagram Discovery Block */}
        <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-700/60 space-y-2">
          <div className="flex items-center justify-between text-xs gap-2 flex-wrap">
            <span className="font-semibold text-slate-300 flex items-center gap-1.5">
              <Instagram className="w-3.5 h-3.5 text-pink-400" />
              <span>Social Discovery &amp; Instagram:</span>
            </span>

            {isAutoScanning && (
              <span className="text-[10px] font-mono text-sky-300 bg-sky-500/10 px-1.5 py-0.5 rounded border border-sky-500/20 flex items-center gap-1">
                <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                <span>Checking Site &amp; Google...</span>
              </span>
            )}
            {!isAutoScanning && currentSocials?.source === 'scanned_from_website' && (
              <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                [Found on Website]
              </span>
            )}
            {!isAutoScanning && currentSocials?.source === 'discovered_via_google_search' && (
              <span className="text-[10px] font-mono text-sky-300 bg-sky-500/10 px-1.5 py-0.5 rounded border border-sky-500/20">
                [Found via Google Search]
              </span>
            )}
            {!isAutoScanning && currentSocials?.source === 'website_and_google_search' && (
              <span className="text-[10px] font-mono text-emerald-300 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                [Website + Google Search]
              </span>
            )}
            {!isAutoScanning && currentSocials?.source === 'manual_entry' && (
              <span className="text-[10px] font-mono text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded border border-indigo-500/20">
                [Manually Verified]
              </span>
            )}
            {!isAutoScanning && currentSocials?.source === 'not_found' && (
              <span className="text-[10px] font-mono text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700">
                [Not Found Auto]
              </span>
            )}
          </div>

          <div className="flex items-center flex-wrap gap-2 text-xs">
            {/* Instagram Link or Handle */}
            {currentSocials?.instagram ? (
              <a
                href={currentSocials.instagram}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gradient-to-r from-pink-600/20 via-purple-600/20 to-orange-600/20 border border-pink-500/40 text-pink-300 hover:text-white hover:border-pink-400 font-semibold transition-all group"
                title={`Open official Instagram: ${currentSocials.instagramHandle || currentSocials.instagram}`}
              >
                <Instagram className="w-3.5 h-3.5 text-pink-400 group-hover:scale-110 transition-transform" />
                <span className="font-mono text-[11px]">
                  {currentSocials.instagramHandle || 'Instagram Profile'}
                </span>
                <ExternalLink className="w-2.5 h-2.5 text-pink-400" />
              </a>
            ) : (
              <a
                href={instagramSearchUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-700 hover:border-slate-600 text-[11px] transition-colors"
                title="Search Instagram for this restaurant"
              >
                <Search className="w-3 h-3 text-pink-400" />
                <span>Search Instagram</span>
                <ExternalLink className="w-2.5 h-2.5 text-slate-500" />
              </a>
            )}

            {/* Facebook Link */}
            {currentSocials?.facebook && (
              <a
                href={currentSocials.facebook}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-blue-600/20 border border-blue-500/30 text-blue-300 hover:text-white text-[11px] transition-all"
                title="Open Facebook Page"
              >
                <Facebook className="w-3 h-3 text-blue-400" />
                <span>Facebook</span>
              </a>
            )}

            {/* TikTok Link */}
            {currentSocials?.tiktok && (
              <a
                href={currentSocials.tiktok}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-cyan-600/20 border border-cyan-500/30 text-cyan-300 hover:text-white text-[11px] transition-all"
                title="Open TikTok Profile"
              >
                <Share2 className="w-3 h-3 text-cyan-400" />
                <span>TikTok</span>
              </a>
            )}

            {/* Website Email if extracted */}
            {currentSocials?.websiteEmail && (
              <a
                href={`mailto:${currentSocials.websiteEmail}`}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-600/20 border border-emerald-500/30 text-emerald-300 hover:text-white text-[11px] transition-all"
                title={`Email: ${currentSocials.websiteEmail}`}
              >
                <Mail className="w-3 h-3 text-emerald-400" />
                <span className="truncate max-w-[140px]">{currentSocials.websiteEmail}</span>
              </a>
            )}

            {/* Rescan button (works with website + Google Search) */}
            {!isAutoScanning && (
              <button
                type="button"
                onClick={handleScanSocials}
                disabled={isAutoScanning}
                className="text-[10px] text-slate-500 hover:text-slate-300 p-1 rounded hover:bg-slate-800 transition-colors cursor-pointer"
                title="Re-scan website and Google Search for updated socials"
              >
                <RefreshCw className="w-3 h-3" />
              </button>
            )}
          </div>

          {currentSocials?.discoveredSources && currentSocials.discoveredSources.length > 0 && (
            <div className="flex items-center flex-wrap gap-1.5 pt-1 border-t border-slate-800/80 text-[10px] text-slate-400">
              <span className="text-slate-500">Checked sources:</span>
              {currentSocials.discoveredSources.slice(0, 3).map((src, idx) => (
                <a
                  key={idx}
                  href={src.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sky-400/90 hover:text-sky-300 underline underline-offset-2 truncate max-w-[140px]"
                  title={src.title || src.url}
                >
                  {src.title || src.url.replace(/^https?:\/\/(www\.)?/, '').split('/')[0]}
                </a>
              ))}
            </div>
          )}
        </div>

        {/* Researched inspection status summary if available */}
        {prospect && prospect.hasManualInspection && (
          <div className="p-2.5 rounded-xl bg-emerald-950/20 border border-emerald-500/20 text-xs space-y-1">
            <div className="flex items-center justify-between text-emerald-400 font-semibold">
              <span className="flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Human Inspected on {prospect.dateInspected}
              </span>
              <span className="font-mono text-emerald-300">
                {prospect.unansweredNegativeCount} Unanswered Negatives
              </span>
            </div>
            <p className="text-[11px] text-slate-300 line-clamp-2">
              {prospect.opportunityRationale || prospect.inspectionNotes}
            </p>
          </div>
        )}
      </div>

      {/* Action Footer */}
      <div className="p-3 bg-slate-900/80 border-t border-slate-700/60 flex items-center justify-between gap-2">
        <a
          href={place.googleMapsUri}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors"
          title="Open original place listing on Google Maps"
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
          <span>{prospect ? 'Edit Checklist' : 'Research Prospect'}</span>
        </button>
      </div>
    </div>
  );
};
