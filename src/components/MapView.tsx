import React, { useEffect } from 'react';
import { Map, AdvancedMarker, Pin, useMap } from '@vis.gl/react-google-maps';
import { DiscoveredPlace, ProspectResearch } from '../types';
import { Star, ExternalLink, ClipboardCheck } from 'lucide-react';

interface MapViewProps {
  places: DiscoveredPlace[];
  selectedPlaceId?: string;
  onSelectPlace: (place: DiscoveredPlace) => void;
  onInspectPlace: (place: DiscoveredPlace) => void;
  prospectsMap: Record<string, ProspectResearch>;
}

// Helper to center and fit bounds on place updates
const MapBoundsAdjuster: React.FC<{ places: DiscoveredPlace[] }> = ({ places }) => {
  const map = useMap();

  useEffect(() => {
    if (!map || places.length === 0) return;

    const bounds = new google.maps.LatLngBounds();
    let hasCoords = false;

    places.forEach((p) => {
      if (p.location && typeof p.location.lat === 'number' && typeof p.location.lng === 'number') {
        bounds.extend({ lat: p.location.lat, lng: p.location.lng });
        hasCoords = true;
      }
    });

    if (hasCoords) {
      map.fitBounds(bounds, { top: 40, right: 40, bottom: 40, left: 40 });
      // Don't zoom in excessively if there's only 1 place
      const listener = google.maps.event.addListenerOnce(map, 'idle', () => {
        const zoom = map.getZoom();
        if (zoom && zoom > 16) {
          map.setZoom(16);
        }
      });
      return () => {
        google.maps.event.removeListener(listener);
      };
    }
  }, [map, places]);

  return null;
};

export const MapView: React.FC<MapViewProps> = ({
  places,
  selectedPlaceId,
  onSelectPlace,
  onInspectPlace,
  prospectsMap,
}) => {
  const defaultCenter = { lat: 39.8283, lng: -98.5795 }; // Center of US

  const selectedPlace = places.find((p) => p.id === selectedPlaceId);

  return (
    <div className="relative w-full h-[540px] rounded-2xl overflow-hidden border border-slate-700/80 shadow-2xl bg-slate-900">
      <Map
        mapId="DEMO_MAP_ID"
        defaultCenter={defaultCenter}
        defaultZoom={4}
        gestureHandling="greedy"
        disableDefaultUI={false}
        internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
        className="w-full h-full"
      >
        <MapBoundsAdjuster places={places} />

        {places.map((place) => {
          if (!place.location) return null;
          const isSelected = place.id === selectedPlaceId;
          const prospect = prospectsMap[place.id];
          const opportunity = prospect?.opportunityLevel;

          let pinBg = '#6366f1'; // indigo default
          let pinBorder = '#4338ca';
          let glyphColor = '#ffffff';

          if (opportunity === 'HIGH') {
            pinBg = '#10b981'; // emerald
            pinBorder = '#047857';
          } else if (opportunity === 'MEDIUM') {
            pinBg = '#f59e0b'; // amber
            pinBorder = '#b45309';
          } else if (opportunity === 'LOW') {
            pinBg = '#64748b'; // slate
            pinBorder = '#475569';
          }

          return (
            <AdvancedMarker
              key={place.id}
              position={{ lat: place.location.lat, lng: place.location.lng }}
              onClick={() => onSelectPlace(place)}
              title={place.displayName}
            >
              <Pin
                background={pinBg}
                borderColor={pinBorder}
                glyphColor={glyphColor}
                scale={isSelected ? 1.25 : 1.0}
              />
            </AdvancedMarker>
          );
        })}
      </Map>

      {/* Selected Place Overlay Card */}
      {selectedPlace && (
        <div className="absolute bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:max-w-sm bg-slate-900/95 backdrop-blur-md border border-slate-700 p-4 rounded-xl shadow-2xl z-20 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h4 className="font-bold text-sm text-white">{selectedPlace.displayName}</h4>
              <p className="text-xs text-slate-400 truncate">{selectedPlace.formattedAddress}</p>
            </div>
            {prospectsMap[selectedPlace.id] && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shrink-0">
                {prospectsMap[selectedPlace.id].opportunityLevel}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 text-xs text-amber-400 font-semibold">
            <Star className="w-3.5 h-3.5 fill-amber-400" />
            <span>{selectedPlace.rating ? selectedPlace.rating.toFixed(1) : 'N/A'}</span>
            <span className="text-slate-400">
              ({selectedPlace.userRatingCount ? selectedPlace.userRatingCount.toLocaleString() : '0'}{' '}
              reviews)
            </span>
          </div>

          <div className="flex items-center gap-2 pt-2 border-t border-slate-800">
            <a
              href={selectedPlace.googleMapsUri}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 text-center py-1.5 px-2 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors inline-flex items-center justify-center gap-1"
            >
              <ExternalLink className="w-3 h-3" />
              <span>Google Maps</span>
            </a>
            <button
              onClick={() => onInspectPlace(selectedPlace)}
              className="flex-1 py-1.5 px-2 rounded-lg text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition-colors inline-flex items-center justify-center gap-1 cursor-pointer"
            >
              <ClipboardCheck className="w-3 h-3" />
              <span>Checklist</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
