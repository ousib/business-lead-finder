import React, { useState } from 'react';
import { X, Download, ShieldCheck, FileSpreadsheet, Check } from 'lucide-react';
import { ProspectResearch } from '../types';
import { computeLeadOpportunity } from '../utils/leadScoring';

interface ExportModalProps {
  prospects: ProspectResearch[];
  onClose: () => void;
}

/**
 * Escapes CSV field value to prevent CSV / Spreadsheet Formula Injection (CWE-1236)
 * and conforms to RFC 4180.
 */
function sanitizeCsvCell(value: unknown): string {
  if (value === null || value === undefined) {
    return '""';
  }

  let str = String(value).trim();

  // Guard against spreadsheet formula injection:
  // If the cell starts with =, +, -, @, tab, or carriage return, prepend a single quote (')
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }

  // Escape any existing double quotes by doubling them
  const escaped = str.replace(/"/g, '""');
  return `"${escaped}"`;
}

export const ExportModal: React.FC<ExportModalProps> = ({ prospects, onClose }) => {
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [hasExported, setHasExported] = useState(false);

  const handleDownloadCsv = () => {
    if (!agreedToTerms) return;

    // Define compliant CSV headers (strictly excluding restricted Google review texts)
    const headers = [
      'Business Name',
      'City',
      'State',
      'Category',
      'Official Website',
      'Instagram Handle',
      'Instagram URL',
      'Facebook URL',
      'TikTok URL',
      'Social Discovery Source',
      'Public Phone',
      'Google Maps URL',
      'Google Place ID',
      'Overall Rating',
      'Rating Count',
      'Date Researched',
      'Reviews Inspected Count',
      'Negative Reviews Count',
      'Negative With Owner Replies',
      'Verified Unanswered Negative Reviews',
      'Opportunity Rating',
      'Lead Score (0-100)',
      'Prospect Tier',
      'Opportunity Rationale',
      'Evidence Notes',
      'Contact Status',
      'Contact Email',
      'Email Verification',
      'Verification Status',
    ];

    const rows = prospects.map((p) => {
      const analysis = computeLeadOpportunity(
        {
          displayName: p.businessName,
          city: p.city,
          state: p.state,
          rating: p.rating,
          userRatingCount: p.userRatingCount,
          websiteUri: p.websiteUri,
          nationalPhoneNumber: p.nationalPhoneNumber,
          socials: p.socials,
        },
        p
      );

      return [
        sanitizeCsvCell(p.businessName),
        sanitizeCsvCell(p.city),
        sanitizeCsvCell(p.state),
        sanitizeCsvCell(p.category),
        sanitizeCsvCell(p.websiteUri || 'N/A'),
        sanitizeCsvCell(p.instagramHandle || p.socials?.instagramHandle || 'N/A'),
        sanitizeCsvCell(p.instagramUrl || p.socials?.instagram || 'N/A'),
        sanitizeCsvCell(p.facebookUrl || p.socials?.facebook || 'N/A'),
        sanitizeCsvCell(p.tiktokUrl || p.socials?.tiktok || 'N/A'),
        sanitizeCsvCell(p.socials?.source || 'unscanned'),
        sanitizeCsvCell(p.nationalPhoneNumber || 'N/A'),
        sanitizeCsvCell(p.googleMapsUri),
        sanitizeCsvCell(p.placeId),
        sanitizeCsvCell(p.rating !== undefined ? p.rating.toString() : 'N/A'),
        sanitizeCsvCell(p.userRatingCount !== undefined ? p.userRatingCount.toString() : 'N/A'),
        sanitizeCsvCell(p.dateInspected),
        sanitizeCsvCell(p.reviewsInspectedCount),
        sanitizeCsvCell(p.negativeReviewsCount),
        sanitizeCsvCell(p.negativeWithRepliesCount),
        sanitizeCsvCell(p.unansweredNegativeCount),
        sanitizeCsvCell(p.opportunityLevel),
        sanitizeCsvCell(analysis.leadScore),
        sanitizeCsvCell(analysis.tierLabel),
        sanitizeCsvCell(p.opportunityRationale),
        sanitizeCsvCell(p.inspectionNotes || 'None'),
        sanitizeCsvCell(p.contactStatus),
        sanitizeCsvCell(p.contactEmail || 'N/A'),
        sanitizeCsvCell(p.contactEmail ? analysis.emailConfidence : 'N/A'),
        sanitizeCsvCell(p.verificationStatus),
      ];
    });

    const csvContent =
      '\uFEFF' + // UTF-8 BOM for Excel compatibility
      headers.map(sanitizeCsvCell).join(',') +
      '\r\n' +
      rows.map((r) => r.join(',')).join('\r\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const timestamp = new Date().toISOString().split('T')[0];
    link.setAttribute('href', url);
    link.setAttribute('download', `replynation_prospects_${timestamp}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setHasExported(true);
    setTimeout(() => {
      onClose();
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">Export Researched Prospects</h3>
              <p className="text-xs text-slate-400">
                Generate compliant CSV file for {prospects.length} business lead(s)
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
        <div className="p-5 space-y-4 text-xs text-slate-300">
          <div className="p-3.5 rounded-xl bg-indigo-950/30 border border-indigo-500/30 space-y-2">
            <div className="font-semibold text-indigo-300 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-indigo-400" />
              <span>Google Maps Platform & Data Compliance Gate</span>
            </div>
            <p className="text-[11px] leading-relaxed text-slate-300">
              In accordance with Google Maps Platform Terms of Service, this export:
            </p>
            <ul className="list-disc list-inside space-y-1 text-[11px] text-slate-400">
              <li>
                <strong className="text-slate-200">Excludes raw Google review text</strong>,
                customer author profiles, and copyrighted imagery.
              </li>
              <li>
                Retains business names, permitted Place IDs, public contact links, and{' '}
                <strong className="text-slate-200">human-verified checklist metrics</strong>.
              </li>
              <li>
                Implements formula injection sanitization (<code className="text-indigo-300 font-mono">= + - @</code> guards).
              </li>
              <li>
                Is intended for manual sales research only; automated unsolicited messaging is prohibited.
              </li>
            </ul>
          </div>

          {/* Acknowledgement Checkbox */}
          <label className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-800/80 border border-slate-700 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={agreedToTerms}
              onChange={(e) => setAgreedToTerms(e.target.checked)}
              className="mt-0.5 rounded border-slate-600 text-indigo-600 focus:ring-indigo-500 w-4 h-4 bg-slate-900"
            />
            <span className="text-xs text-slate-300">
              I have reviewed the Google Maps Platform terms and confirm that this export will be
              used solely for manual business evaluation and authorized prospecting.
            </span>
          </label>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-900/90 border-t border-slate-800 flex items-center justify-between gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Cancel
          </button>

          <button
            onClick={handleDownloadCsv}
            disabled={!agreedToTerms || prospects.length === 0 || hasExported}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:hover:bg-indigo-600 text-white shadow-lg shadow-indigo-600/20 transition-all cursor-pointer"
          >
            {hasExported ? (
              <>
                <Check className="w-4 h-4 text-emerald-400" />
                <span>Downloaded!</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span>Download Secure CSV</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
