/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { APIProvider, useMapsLibrary } from '@vis.gl/react-google-maps';
import {
  Header,
} from './components/Header';
import { QuotaBanner } from './components/QuotaBanner';
import { SearchForm, buildPlaceSearchQuery } from './components/SearchForm';
import { RestaurantCard } from './components/RestaurantCard';
import { MapView } from './components/MapView';
import { InspectionModal } from './components/InspectionModal';
import { ProspectsTable } from './components/ProspectsTable';
import { ExportModal } from './components/ExportModal';
import { ComplianceModal } from './components/ComplianceModal';
import {
  DiscoveredPlace,
  ProspectResearch,
  SearchFilters,
  ContactStatus,
} from './types';
import {
  MapPin,
  Utensils,
  Search,
  AlertCircle,
  HelpCircle,
  ShieldCheck,
  ExternalLink,
  Layers,
  LayoutGrid,
  Map as MapIcon,
  Sparkles,
  Briefcase,
} from 'lucide-react';

const GOOGLE_MAPS_API_KEY =
  import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

// Internal Search Engine Component inside APIProvider context
const SearchEngine: React.FC<{
  onQuotaExceeded: () => void;
  activeTab: 'search' | 'prospects';
  prospects: ProspectResearch[];
  onSaveProspect: (prospect: ProspectResearch) => void;
  onEditProspect: (prospect: ProspectResearch) => void;
  onDeleteProspect: (placeId: string) => void;
  onUpdateProspectStatus: (placeId: string, status: ContactStatus) => void;
  onOpenExport: () => void;
  onOpenCompliance: () => void;
}> = ({
  onQuotaExceeded,
  activeTab,
  prospects,
  onSaveProspect,
  onEditProspect,
  onDeleteProspect,
  onUpdateProspectStatus,
  onOpenExport,
  onOpenCompliance,
}) => {
  const placesLib = useMapsLibrary('places');

  const [filters, setFilters] = useState<SearchFilters>(() => {
    try {
      const saved = sessionStorage.getItem('replynation_search_filters');
      if (saved) {
        return {
          industry: 'Restaurants',
          ...JSON.parse(saved),
        };
      }
    } catch {
      // ignore
    }
    return {
      industry: 'Restaurants',
      city: 'Austin',
      state: 'Texas',
      cuisine: 'All Restaurants',
      minRating: 0,
      maxResults: 10,
    };
  });

  const [isLoading, setIsLoading] = useState(false);
  const [places, setPlaces] = useState<DiscoveredPlace[]>(() => {
    try {
      const saved = sessionStorage.getItem('replynation_search_places');
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return [];
  });
  const [hasSearched, setHasSearched] = useState(() => {
    try {
      return sessionStorage.getItem('replynation_has_searched') === 'true';
    } catch {
      return false;
    }
  });
  const [searchError, setSearchError] = useState<string | null>(null);

  // Layout view mode
  const [viewMode, setViewMode] = useState<'split' | 'grid' | 'map'>('split');
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | undefined>(() => {
    try {
      const saved = sessionStorage.getItem('replynation_search_places');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.length > 0) return parsed[0].id;
      }
    } catch {
      // ignore
    }
    return undefined;
  });

  // Save search query and results to sessionStorage to prevent loss of research
  useEffect(() => {
    try {
      sessionStorage.setItem('replynation_search_filters', JSON.stringify(filters));
    } catch {
      // ignore
    }
  }, [filters]);

  useEffect(() => {
    try {
      sessionStorage.setItem('replynation_search_places', JSON.stringify(places));
      sessionStorage.setItem('replynation_has_searched', hasSearched ? 'true' : 'false');
    } catch {
      // ignore
    }
  }, [places, hasSearched]);

  // Active place being inspected in modal
  const [inspectingPlace, setInspectingPlace] = useState<DiscoveredPlace | null>(null);

  // Map of prospects indexed by placeId for rapid lookup
  const prospectsMap = React.useMemo(() => {
    const map: Record<string, ProspectResearch> = {};
    prospects.forEach((p) => {
      map[p.placeId] = p;
    });
    return map;
  }, [prospects]);

  // Execute Search using modern Places API (New) Place.searchByText
  const handleExecuteSearch = useCallback(async () => {
    if (!filters.city.trim()) return;

    setIsLoading(true);
    setSearchError(null);
    setHasSearched(true);

    try {
      // Build query string across all supported industries (e.g. "Marketing Agencies in Austin, Texas")
      const textQuery = buildPlaceSearchQuery(filters);

      let rawResults: any[] = [];
      let clientSearchError: any = null;

      if (placesLib && GOOGLE_MAPS_API_KEY) {
        try {
          const request: any = {
            textQuery,
            fields: [
              'id',
              'displayName',
              'formattedAddress',
              'googleMapsURI',
              'websiteURI',
              'nationalPhoneNumber',
              'rating',
              'userRatingCount',
              'location',
              'types',
              'reviews',
            ],
            isOpenNow: false,
            maxResultCount: filters.maxResults,
            internalUsageAttributionIds: ['gmp_mcp_codeassist_v1_aistudio'],
          };

          if (filters.minRating > 0) {
            request.minRating = filters.minRating;
          }

          // Call modern Place.searchByText
          const { places: searchResults } =
            await google.maps.places.Place.searchByText(request);
          rawResults = searchResults || [];
        } catch (sdkErr: any) {
          clientSearchError = sdkErr;
          const sdkMsg = sdkErr?.message || String(sdkErr);
          const isPermissionOrOriginError =
            sdkMsg.includes('PERMISSION_DENIED') ||
            sdkMsg.includes('Permission denied') ||
            sdkMsg.includes('ApiNotActivated') ||
            sdkMsg.includes('RefererNotAllowed');

          if (!isPermissionOrOriginError) {
            throw sdkErr;
          }
        }
      }

      // Automatic fallback to server-side /api/places-search proxy if SDK wasn't ready or hit permission/referrer restrictions
      if (clientSearchError || !placesLib || !GOOGLE_MAPS_API_KEY) {
        const proxyResponse = await fetch('/api/places-search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            textQuery,
            minRating: filters.minRating,
            maxResultCount: filters.maxResults,
          }),
        });

        const proxyData = await proxyResponse.json().catch(() => null);
        if (proxyResponse.ok && proxyData?.ok) {
          rawResults = proxyData.places || [];
        } else {
          // Preserve original client SDK error message when available, paired with proxy context
          const proxyErrText = proxyData?.errorMessage
            ? `${proxyData.errorCode ? `${proxyData.errorCode}: ` : ''}${proxyData.errorMessage}`
            : '';
          const primaryMsg =
            clientSearchError?.message ||
            (clientSearchError ? String(clientSearchError) : '') ||
            proxyErrText ||
            (!GOOGLE_MAPS_API_KEY
              ? 'MISSING_API_KEY: Google Maps API key (VITE_GOOGLE_MAPS_API_KEY) is not configured.'
              : 'Google Maps Places Library is unavailable.');
          throw new Error(primaryMsg);
        }
      }

      if (!rawResults || rawResults.length === 0) {
        setPlaces([]);
        setIsLoading(false);
        return;
      }

      const formatted: DiscoveredPlace[] = rawResults.map((p: any) => {
        // Safe extraction of displayName
        let displayName = 'Business';
        if (typeof p.displayName === 'string') {
          displayName = p.displayName;
        } else if (p.displayName?.text) {
          displayName = p.displayName.text;
        }

        // Safe extraction of location coordinates
        let lat: number | undefined;
        let lng: number | undefined;
        if (p.location) {
          lat = typeof p.location.lat === 'function' ? p.location.lat() : p.location.lat;
          lng = typeof p.location.lng === 'function' ? p.location.lng() : p.location.lng;
        }

        // Safe extraction of category
        const types: string[] = p.types || [];
        const cleanType = types
          .filter((t: string) => !['point_of_interest', 'establishment', 'food'].includes(t))
          .map((t: string) => t.replace(/_/g, ' '))
          .map((t: string) => t.charAt(0).toUpperCase() + t.slice(1))
          .join(', ') || filters.cuisine || filters.industry || 'Business';

        // Google Maps URI
        const googleMapsUri =
          p.googleMapsURI ||
          `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
            `${displayName} ${p.formattedAddress || ''}`
          )}&query_place_id=${p.id}`;

        // Sample reviews with strictly labeled NOT VERIFIED owner replies
        const sampleReviews = (p.reviews || []).slice(0, 5).map((r: any) => ({
          authorName: r.authorName || r.authorAttribution?.displayName || 'Google Reviewer',
          rating: r.rating,
          relativePublishTime: r.relativePublishTime || r.relativePublishTimeDescription,
          publishTime: r.publishTime,
          text: typeof r.text === 'string' ? r.text : r.text?.text,
          ownerResponseStatus: 'NOT VERIFIED' as const,
        }));

        return {
          id: p.id,
          displayName,
          formattedAddress: p.formattedAddress || `${filters.city}, ${filters.state}`,
          city: filters.city,
          state: filters.state,
          category: cleanType,
          googleMapsUri,
          websiteUri: p.websiteURI,
          nationalPhoneNumber: p.nationalPhoneNumber,
          rating: typeof p.rating === 'number' ? p.rating : undefined,
          userRatingCount: typeof p.userRatingCount === 'number' ? p.userRatingCount : undefined,
          location:
            lat !== undefined && lng !== undefined
              ? { lat, lng }
              : undefined,
          sampleReviews,
          socials: {
            source: 'scanning',
            instagramSearchUrl: `https://www.google.com/search?q=site%3Ainstagram.com+${encodeURIComponent(
              `${displayName} ${filters.city} ${filters.state}`
            )}`,
          },
          rawSource: 'Google Maps Places API (New)',
        };
      });

      setPlaces(formatted);
      if (formatted.length > 0) {
        setSelectedPlaceId(formatted[0].id);
      }

      // Automatically auto-discover socials (website scan + directory & Google Search fallback)
      const queue = [...formatted];
      const concurrency = 2;
      const runWorker = async () => {
        while (queue.length > 0) {
          const place = queue.shift();
          if (!place) break;
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
              const discoveredSocials = await res.json();
              setPlaces((prev) =>
                prev.map((item) =>
                  item.id === place.id ? { ...item, socials: discoveredSocials } : item
                )
              );
            } else {
              setPlaces((prev) =>
                prev.map((item) =>
                  item.id === place.id
                    ? {
                        ...item,
                        socials: {
                          ...item.socials,
                          source: 'not_found',
                        },
                      }
                    : item
                )
              );
            }
          } catch {
            setPlaces((prev) =>
              prev.map((item) =>
                item.id === place.id
                  ? {
                      ...item,
                      socials: {
                        ...item.socials,
                        source: 'not_found',
                      },
                    }
                  : item
              )
            );
          }
        }
      };
      void Promise.all(
        Array.from({ length: Math.min(concurrency, queue.length) }, () => runWorker())
      );
    } catch (err: any) {
      console.error('Places API search error:', err);
      const errMsg = err?.message || String(err);
      if (
        errMsg.includes('RESOURCE_EXHAUSTED') ||
        errMsg.includes('OVER_QUERY_LIMIT') ||
        errMsg.includes('OverQuotaMapError') ||
        errMsg.includes('QuotaExceeded')
      ) {
        onQuotaExceeded();
        setSearchError('Google Maps Platform daily quota reached for this API key.');
      } else {
        setSearchError(errMsg || 'An unexpected error occurred while searching for restaurants.');
      }
      setPlaces([]);
    } finally {
      setIsLoading(false);
    }
  }, [filters, placesLib, onQuotaExceeded]);

  const handleUpdatePlaceSocials = useCallback(
    (placeId: string, socials: any) => {
      setPlaces((prev) =>
        prev.map((item) => (item.id === placeId ? { ...item, socials } : item))
      );
      const existing = prospectsMap[placeId];
      if (existing) {
        onSaveProspect({
          ...existing,
          socials,
          instagramUrl: socials.instagram || existing.instagramUrl,
          instagramHandle: socials.instagramHandle || existing.instagramHandle,
          facebookUrl: socials.facebook || existing.facebookUrl,
          tiktokUrl: socials.tiktok || existing.tiktokUrl,
          contactEmail: socials.websiteEmail || existing.contactEmail,
        });
      }
    },
    [prospectsMap, onSaveProspect]
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {activeTab === 'search' ? (
        <div className="space-y-6">
          {/* Search Form */}
          <SearchForm
            filters={filters}
            onChange={setFilters}
            onSearch={handleExecuteSearch}
            isLoading={isLoading}
          />

          {/* Results Header & View Toggle */}
          {hasSearched && (
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-tight">
                  Search Results
                </h2>
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 font-mono">
                  {places.length} found
                </span>
                <span className="text-xs text-slate-400 hidden sm:inline">
                  in {filters.city}, {filters.state}
                </span>
              </div>

              {places.length > 0 && (
                <div className="flex items-center bg-slate-800/80 p-1 rounded-xl border border-slate-700">
                  <button
                    onClick={() => setViewMode('split')}
                    className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg transition-all ${
                      viewMode === 'split'
                        ? 'bg-slate-700 text-white shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>Split View</span>
                  </button>
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg transition-all ${
                      viewMode === 'grid'
                        ? 'bg-slate-700 text-white shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <LayoutGrid className="w-3.5 h-3.5" />
                    <span>Cards Only</span>
                  </button>
                  <button
                    onClick={() => setViewMode('map')}
                    className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg transition-all ${
                      viewMode === 'map'
                        ? 'bg-slate-700 text-white shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <MapIcon className="w-3.5 h-3.5" />
                    <span>Map View</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Loading Skeleton */}
          {isLoading && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div
                  key={i}
                  className="bg-slate-800/60 rounded-2xl p-5 border border-slate-700/60 animate-pulse space-y-4"
                >
                  <div className="h-5 bg-slate-700 rounded-md w-3/4" />
                  <div className="h-4 bg-slate-700/60 rounded-md w-1/2" />
                  <div className="h-10 bg-slate-900/60 rounded-xl" />
                  <div className="h-4 bg-slate-700/40 rounded-md w-2/3" />
                  <div className="h-9 bg-slate-700/40 rounded-lg mt-2" />
                </div>
              ))}
            </div>
          )}

          {/* Error State */}
          {searchError && (
            <div className="p-4 rounded-2xl bg-rose-950/40 border border-rose-500/30 flex items-start gap-3 text-rose-200 text-xs sm:text-sm">
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div className="space-y-2 flex-1">
                <div>
                  <strong className="font-bold text-white block">Search Error</strong>
                  <p className="font-mono text-xs text-rose-200/95 break-words">{searchError}</p>
                </div>

                {(searchError.includes('PERMISSION_DENIED') ||
                  searchError.includes('Permission denied') ||
                  searchError.includes('MISSING_API_KEY') ||
                  searchError.includes('ApiNotActivated') ||
                  searchError.includes('RefererNotAllowed')) && (
                  <div className="p-3 rounded-xl bg-slate-900/80 border border-rose-500/20 text-xs text-slate-300 space-y-1.5">
                    <div className="font-semibold text-white">
                      How to fix Google Places API permissions (Vercel &amp; Google Cloud):
                    </div>
                    <ol className="list-decimal list-inside space-y-1 text-slate-300/90">
                      <li>
                        In <strong>Google Cloud Console → APIs &amp; Services → Library</strong>, enable{' '}
                        <code className="text-emerald-300">Places API (New)</code> (not only the legacy Places API) and{' '}
                        <code className="text-emerald-300">Maps JavaScript API</code>, and verify Billing is enabled on the project.
                      </li>
                      <li>
                        In <strong>Credentials → your API Key</strong>, verify <em>API restrictions</em> include{' '}
                        <code className="text-emerald-300">Places API (New)</code> and{' '}
                        <em>Website (HTTP referrer) restrictions</em> include{' '}
                        <code className="text-emerald-300">https://*.vercel.app/*</code> (plus your custom domain). Note: AI Studio&apos;s free preview key is restricted and will not authorize external Vercel deployments.
                      </li>
                      <li>
                        In <strong>Vercel → Settings → Environment Variables</strong>, set{' '}
                        <code className="text-emerald-300">VITE_GOOGLE_MAPS_API_KEY</code> (and optionally{' '}
                        <code className="text-emerald-300">GOOGLE_MAPS_API_KEY</code> for server fallback), then trigger a fresh <strong>Redeploy</strong>.
                      </li>
                    </ol>
                  </div>
                )}

                <button
                  onClick={handleExecuteSearch}
                  className="text-xs font-semibold text-rose-300 underline hover:text-white cursor-pointer"
                >
                  Try Again
                </button>
              </div>
            </div>
          )}

          {/* Empty State after search */}
          {!isLoading && hasSearched && places.length === 0 && !searchError && (
            <div className="text-center py-12 bg-slate-800/40 border border-slate-800 rounded-2xl p-8 max-w-lg mx-auto space-y-3">
              <Briefcase className="w-10 h-10 text-slate-500 mx-auto" />
              <h3 className="text-base font-bold text-white">No Businesses Found</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                No places matched your search query in <strong className="text-slate-200">{filters.city}, {filters.state}</strong>. Try lowering the minimum rating or clearing the sub-specialty filter.
              </p>
            </div>
          )}

          {/* Initial Pre-search State */}
          {!hasSearched && !isLoading && (
            <div className="bg-gradient-to-br from-slate-800/90 via-slate-800/60 to-slate-900 border border-slate-700/80 rounded-2xl p-8 text-center max-w-2xl mx-auto space-y-4 shadow-xl">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center mx-auto">
                <Search className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-white tracking-tight">
                  Search &amp; Inspect US Businesses for ReplyNation
                </h3>
                <p className="text-xs text-slate-300 max-w-md mx-auto leading-relaxed">
                  Select any industry above — from marketing agencies, dentists, and law firms to salons, cleaning companies, and restaurants — to discover high-opportunity prospects with customer review needs.
                </p>
              </div>

              <div className="pt-2 flex flex-wrap items-center justify-center gap-2">
                <span className="text-[11px] text-slate-400">Popular Prospect Searches:</span>
                {[
                  { industry: 'Marketing Agencies', city: 'Austin', state: 'Texas', cuisine: '' },
                  { industry: 'Dentists', city: 'Chicago', state: 'Illinois', cuisine: 'Cosmetic Dentistry' },
                  { industry: 'Real Estate Agents', city: 'Miami', state: 'Florida', cuisine: '' },
                  { industry: 'Cleaning Companies', city: 'Houston', state: 'Texas', cuisine: 'Commercial Janitorial' },
                  { industry: 'Lawyers', city: 'New York', state: 'New York', cuisine: 'Personal Injury' },
                  { industry: 'Salons', city: 'Los Angeles', state: 'California', cuisine: '' },
                  { industry: 'Restaurants', city: 'Austin', state: 'Texas', cuisine: 'Texas Smoked Brisket' },
                  { industry: 'Restaurants', city: 'Nashville', state: 'Tennessee', cuisine: 'Nashville Hot Chicken' },
                ].map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setFilters({
                        ...filters,
                        industry: preset.industry,
                        city: preset.city,
                        state: preset.state,
                        cuisine: preset.cuisine,
                      });
                    }}
                    className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-900/80 text-emerald-400 hover:text-emerald-300 border border-slate-700 hover:border-emerald-500/40 transition-colors cursor-pointer"
                  >
                    {preset.cuisine ? `${preset.cuisine} (${preset.industry})` : preset.industry} in {preset.city}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Results Display */}
          {!isLoading && places.length > 0 && (
            <div>
              {/* Split View */}
              {viewMode === 'split' && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                  {/* Left Column: Cards List */}
                  <div className="lg:col-span-7 space-y-4 max-h-[700px] overflow-y-auto pr-1">
                    {places.map((place) => (
                      <RestaurantCard
                        key={place.id}
                        place={place}
                        prospect={prospectsMap[place.id]}
                        isSelected={place.id === selectedPlaceId}
                        onInspect={(p) => setInspectingPlace(p)}
                        onUpdateSocials={handleUpdatePlaceSocials}
                      />
                    ))}
                  </div>

                  {/* Right Column: Sticky Map */}
                  <div className="lg:col-span-5 sticky top-20">
                    <MapView
                      places={places}
                      selectedPlaceId={selectedPlaceId}
                      onSelectPlace={(p) => setSelectedPlaceId(p.id)}
                      onInspectPlace={(p) => setInspectingPlace(p)}
                      prospectsMap={prospectsMap}
                    />
                  </div>
                </div>
              )}

              {/* Grid Only */}
              {viewMode === 'grid' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {places.map((place) => (
                    <RestaurantCard
                      key={place.id}
                      place={place}
                      prospect={prospectsMap[place.id]}
                      isSelected={place.id === selectedPlaceId}
                      onInspect={(p) => setInspectingPlace(p)}
                      onUpdateSocials={handleUpdatePlaceSocials}
                    />
                  ))}
                </div>
              )}

              {/* Map Only */}
              {viewMode === 'map' && (
                <MapView
                  places={places}
                  selectedPlaceId={selectedPlaceId}
                  onSelectPlace={(p) => setSelectedPlaceId(p.id)}
                  onInspectPlace={(p) => setInspectingPlace(p)}
                  prospectsMap={prospectsMap}
                />
              )}
            </div>
          )}
        </div>
      ) : (
        /* Prospects Table Tab */
        <ProspectsTable
          prospects={prospects}
          onEditProspect={(p) => {
            // Find or reconstruct DiscoveredPlace for modal including socials
            const placeObj: DiscoveredPlace = {
              id: p.placeId,
              displayName: p.businessName,
              formattedAddress: `${p.city}, ${p.state}`,
              city: p.city,
              state: p.state,
              category: p.category,
              googleMapsUri: p.googleMapsUri,
              websiteUri: p.websiteUri,
              nationalPhoneNumber: p.nationalPhoneNumber,
              rating: p.rating,
              userRatingCount: p.userRatingCount,
              socials:
                p.socials ||
                (p.instagramUrl || p.instagramHandle
                  ? {
                      instagram: p.instagramUrl,
                      instagramHandle: p.instagramHandle,
                      facebook: p.facebookUrl,
                      tiktok: p.tiktokUrl,
                      source: 'manual_entry',
                    }
                  : undefined),
              rawSource: 'Google Maps Places API (New)',
            };
            setInspectingPlace(placeObj);
          }}
          onDeleteProspect={onDeleteProspect}
          onUpdateStatus={onUpdateProspectStatus}
          onOpenExport={onOpenExport}
        />
      )}

      {/* Review Inspection Modal */}
      {inspectingPlace && (
        <InspectionModal
          place={inspectingPlace}
          existingProspect={prospectsMap[inspectingPlace.id]}
          onSave={onSaveProspect}
          onClose={() => setInspectingPlace(null)}
        />
      )}
    </div>
  );
};

export default function App() {
  const [quotaExceeded, setQuotaExceeded] = useState(false);
  const [activeTab, setActiveTab] = useState<'search' | 'prospects'>(() => {
    try {
      const saved = sessionStorage.getItem('replynation_active_tab');
      if (saved === 'search' || saved === 'prospects') return saved;
    } catch {
      // ignore
    }
    return 'search';
  });

  useEffect(() => {
    try {
      sessionStorage.setItem('replynation_active_tab', activeTab);
    } catch {
      // ignore
    }
  }, [activeTab]);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showComplianceModal, setShowComplianceModal] = useState(false);

  // Local storage backed prospects list
  const [prospects, setProspects] = useState<ProspectResearch[]>(() => {
    try {
      const saved = localStorage.getItem('replynation_prospects');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error('Error loading saved prospects:', e);
    }
    return [];
  });

  // Save prospects to localStorage on changes
  useEffect(() => {
    try {
      localStorage.setItem('replynation_prospects', JSON.stringify(prospects));
    } catch (e) {
      console.error('Error saving prospects:', e);
    }
  }, [prospects]);

  // Listen for the custom 'gmp-quota-exceeded' event from main.tsx or services
  useEffect(() => {
    const handleQuota = () => {
      setQuotaExceeded(true);
    };
    window.addEventListener('gmp-quota-exceeded', handleQuota);
    return () => {
      window.removeEventListener('gmp-quota-exceeded', handleQuota);
    };
  }, []);

  const handleSaveProspect = (savedProspect: ProspectResearch) => {
    setProspects((prev) => {
      const idx = prev.findIndex((p) => p.placeId === savedProspect.placeId);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = savedProspect;
        return copy;
      }
      return [savedProspect, ...prev];
    });
  };

  const handleEditProspect = (prospect: ProspectResearch) => {
    // Switch to search or open inspection
  };

  const handleDeleteProspect = (placeId: string) => {
    setProspects((prev) => prev.filter((p) => p.placeId !== placeId));
  };

  const handleUpdateStatus = (placeId: string, status: ContactStatus) => {
    setProspects((prev) =>
      prev.map((p) => (p.placeId === placeId ? { ...p, contactStatus: status } : p))
    );
  };

  return (
    <APIProvider apiKey={GOOGLE_MAPS_API_KEY}>
      <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans">
        {/* Tier 2 Quota Exceeded Sticky Banner */}
        <QuotaBanner
          visible={quotaExceeded}
          onDismiss={() => setQuotaExceeded(false)}
        />

        {/* Global Navigation Header */}
        <Header
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          prospects={prospects}
          onOpenExport={() => setShowExportModal(true)}
          onOpenCompliance={() => setShowComplianceModal(true)}
        />

        {/* Main Application Content */}
        <main className="flex-1">
          <SearchEngine
            onQuotaExceeded={() => setQuotaExceeded(true)}
            activeTab={activeTab}
            prospects={prospects}
            onSaveProspect={handleSaveProspect}
            onEditProspect={handleEditProspect}
            onDeleteProspect={handleDeleteProspect}
            onUpdateProspectStatus={handleUpdateStatus}
            onOpenExport={() => setShowExportModal(true)}
            onOpenCompliance={() => setShowComplianceModal(true)}
          />
        </main>

        {/* Compliance Footer */}
        <footer className="border-t border-slate-800 bg-slate-950/80 text-slate-400 text-xs py-6 mt-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="space-y-1 text-center sm:text-left">
              <div className="font-semibold text-slate-200">
                ReplyNation Prospect Finder
              </div>
              <p className="text-[11px] text-slate-400">
                Powered by Google Maps Platform Places API (New) &amp; Google GenAI. Not affiliated with Google LLC.
              </p>
            </div>

            <div className="flex items-center gap-4 text-xs">
              <button
                onClick={() => setShowComplianceModal(true)}
                className="hover:text-emerald-400 transition-colors flex items-center gap-1 cursor-pointer"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Compliance &amp; Attributions</span>
              </button>
              <a
                href="https://cloud.google.com/maps-platform/terms?utm_campaign=gmp_mcp_codeassist_v1_aistudio"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-emerald-400 transition-colors inline-flex items-center gap-1"
              >
                <span>Terms of Service</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        </footer>

        {/* Export Modal */}
        {showExportModal && (
          <ExportModal
            prospects={prospects}
            onClose={() => setShowExportModal(false)}
          />
        )}

        {/* Compliance & Attributions Modal */}
        {showComplianceModal && (
          <ComplianceModal onClose={() => setShowComplianceModal(false)} />
        )}
      </div>
    </APIProvider>
  );
}
