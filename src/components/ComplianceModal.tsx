import React from 'react';
import { X, ShieldCheck, CheckCircle2, AlertTriangle, ExternalLink } from 'lucide-react';

interface ComplianceModalProps {
  onClose: () => void;
}

export const ComplianceModal: React.FC<ComplianceModalProps> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden my-auto max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">Google Maps Platform & Terms Compliance</h3>
              <p className="text-xs text-slate-400">
                Architecture, API Credentials, and Data Verification Standards
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs text-slate-300 leading-relaxed">
          {/* Section: APIs Used */}
          <div className="space-y-2">
            <h4 className="font-bold text-white text-sm flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>APIs and SDKs Utilized</span>
            </h4>
            <div className="bg-slate-800/80 rounded-xl p-3.5 border border-slate-700 space-y-2">
              <div>
                <strong className="text-white block font-medium">1. Places API (New)</strong>
                <p className="text-slate-400 text-[11px]">
                  Utilizes modern <code className="text-emerald-300 font-mono">google.maps.places.Place.searchByText</code> to discover restaurants based on city, state, and cuisine criteria, requesting only authorized field masks (displayName, formattedAddress, googleMapsURI, websiteURI, nationalPhoneNumber, rating, userRatingCount, location, id).
                </p>
              </div>
              <div>
                <strong className="text-white block font-medium">2. Maps JavaScript API</strong>
                <p className="text-slate-400 text-[11px]">
                  Utilizes <code className="text-emerald-300 font-mono">@vis.gl/react-google-maps</code> with <code className="text-emerald-300 font-mono">AdvancedMarkerElement</code> (DEMO_MAP_ID) for interactive geographic visualization.
                </p>
              </div>
              <div>
                <strong className="text-white block font-medium">3. Google GenAI SDK (@google/genai)</strong>
                <p className="text-slate-400 text-[11px]">
                  Uses <code className="text-emerald-300 font-mono">gemini-3.8-flash</code> on the server to objectively evaluate verified human inspection checklists into HIGH, MEDIUM, LOW, or UNVERIFIED opportunity classifications without hallucinating.
                </p>
              </div>
            </div>
          </div>

          {/* Section: Review Status Verification */}
          <div className="p-3.5 rounded-xl bg-amber-950/30 border border-amber-500/30 space-y-1.5">
            <div className="flex items-center gap-1.5 text-amber-300 font-bold">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <span>Notice on Review-Response Status</span>
            </div>
            <p className="text-[11px] text-slate-300">
              The Google Maps Platform API returns a limited subset of reviews and does not report owner reply status. This application never infers owner responsiveness from API omission. Full owner-response verification requires opening the official Google Maps listing link to check manually.
            </p>
          </div>

          {/* Section: Billing and Quota Limitations */}
          <div className="space-y-1.5">
            <h4 className="font-bold text-white text-sm">Billing & Quota Limitations</h4>
            <p className="text-slate-400 text-[11px]">
              During development and testing in Google AI Studio, an auto-provisioned Google Maps demo key is utilized with a starter quota (100 requests per day). For production deployments, apps should be linked to a Google Cloud project with billing enabled and API restrictions applied.
            </p>
          </div>

          {/* Section: Data Retention and Export */}
          <div className="space-y-1.5">
            <h4 className="font-bold text-white text-sm">Data Retention & Safe Export</h4>
            <p className="text-slate-400 text-[11px]">
              No persistent local caching of restricted Google Maps content is performed. Only permitted Google Place IDs, public URLs, and user-recorded checklist metrics are retained for prospect management and CSV export. Raw review texts are excluded from CSV exports to comply with Google Maps Platform policies.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-900 border-t border-slate-800 flex items-center justify-between">
          <a
            href="https://cloud.google.com/maps-platform/terms?utm_campaign=gmp_mcp_codeassist_v1_aistudio"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-emerald-400 hover:underline flex items-center gap-1"
          >
            <span>Google Maps Platform Terms of Service</span>
            <ExternalLink className="w-3 h-3" />
          </a>

          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-white transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
