import React, { useState } from 'react';
import {
  Search,
  Filter,
  ExternalLink,
  Trash2,
  Edit3,
  Star,
  CheckCircle,
  AlertTriangle,
  HelpCircle,
  Mail,
  Phone,
  Globe,
  Download,
  Building,
  Instagram,
  Facebook,
  Share2,
} from 'lucide-react';
import { ProspectResearch, OpportunityLevel, ContactStatus } from '../types';

interface ProspectsTableProps {
  prospects: ProspectResearch[];
  onEditProspect: (prospect: ProspectResearch) => void;
  onDeleteProspect: (placeId: string) => void;
  onUpdateStatus: (placeId: string, status: ContactStatus) => void;
  onOpenExport: () => void;
}

export const ProspectsTable: React.FC<ProspectsTableProps> = ({
  prospects,
  onEditProspect,
  onDeleteProspect,
  onUpdateStatus,
  onOpenExport,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [opportunityFilter, setOpportunityFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [socialFilter, setSocialFilter] = useState<string>('ALL');

  const filteredProspects = prospects.filter((p) => {
    const matchesSearch =
      p.businessName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.city.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.instagramHandle && p.instagramHandle.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesOpp =
      opportunityFilter === 'ALL' || p.opportunityLevel === opportunityFilter;

    const matchesStatus =
      statusFilter === 'ALL' || p.contactStatus === statusFilter;

    const hasInstagram = Boolean(p.instagramUrl || p.instagramHandle || p.socials?.instagram);
    const matchesSocial =
      socialFilter === 'ALL' ||
      (socialFilter === 'WITH_INSTAGRAM' && hasInstagram) ||
      (socialFilter === 'NO_INSTAGRAM' && !hasInstagram);

    return matchesSearch && matchesOpp && matchesStatus && matchesSocial;
  });

  const highCount = prospects.filter((p) => p.opportunityLevel === 'HIGH').length;
  const mediumCount = prospects.filter((p) => p.opportunityLevel === 'MEDIUM').length;
  const totalUnanswered = prospects.reduce(
    (acc, p) => acc + (p.unansweredNegativeCount || 0),
    0
  );
  const withInstagramCount = prospects.filter(
    (p) => p.instagramUrl || p.instagramHandle || p.socials?.instagram
  ).length;

  return (
    <div className="space-y-4">
      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-3.5">
          <span className="text-[11px] text-slate-400 font-medium block">
            Total Pipeline Leads
          </span>
          <span className="text-xl font-extrabold text-white font-mono mt-0.5 block">
            {prospects.length}
          </span>
        </div>

        <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-3.5">
          <span className="text-[11px] text-emerald-400 font-medium block">
            HIGH Opportunities
          </span>
          <span className="text-xl font-extrabold text-emerald-400 font-mono mt-0.5 block">
            {highCount}
          </span>
        </div>

        <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-3.5">
          <span className="text-[11px] text-pink-400 font-medium block flex items-center gap-1">
            <Instagram className="w-3 h-3" />
            <span>Instagram Found</span>
          </span>
          <span className="text-xl font-extrabold text-pink-400 font-mono mt-0.5 block">
            {withInstagramCount}
          </span>
        </div>

        <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-3.5">
          <span className="text-[11px] text-slate-400 font-medium block">
            Unanswered Negative Reviews
          </span>
          <span className="text-xl font-extrabold text-amber-300 font-mono mt-0.5 block">
            {totalUnanswered}
          </span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex-1 min-w-[240px]">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by business name, city, industry, or @instagram..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Opportunity Filter */}
          <div className="flex items-center gap-1.5 text-xs text-slate-300">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <span className="hidden sm:inline">Opportunity:</span>
            <select
              value={opportunityFilter}
              onChange={(e) => setOpportunityFilter(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
            >
              <option value="ALL">All Levels</option>
              <option value="HIGH">High Priority</option>
              <option value="MEDIUM">Medium Priority</option>
              <option value="LOW">Low Priority</option>
              <option value="UNVERIFIED">Unverified</option>
            </select>
          </div>

          {/* Social Filter */}
          <div className="flex items-center gap-1.5 text-xs text-slate-300">
            <span className="hidden sm:inline">Instagram:</span>
            <select
              value={socialFilter}
              onChange={(e) => setSocialFilter(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-pink-500"
            >
              <option value="ALL">All Socials</option>
              <option value="WITH_INSTAGRAM">Has Instagram</option>
              <option value="NO_INSTAGRAM">No Instagram</option>
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1.5 text-xs text-slate-300">
            <span className="hidden sm:inline">Outreach:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
            >
              <option value="ALL">All Statuses</option>
              <option value="Not Contacted">Not Contacted</option>
              <option value="Email Drafted">Email Drafted</option>
              <option value="Outreached">Outreached</option>
              <option value="In Discussion">In Discussion</option>
              <option value="Not Interested">Not Interested</option>
            </select>
          </div>

          <button
            onClick={onOpenExport}
            disabled={prospects.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition-all cursor-pointer disabled:opacity-40"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Table / List */}
      {filteredProspects.length === 0 ? (
        <div className="text-center py-12 bg-slate-800/40 border border-slate-800 rounded-2xl p-6">
          <Building className="w-10 h-10 text-slate-600 mx-auto mb-2" />
          <h3 className="text-base font-bold text-white">No researched prospects found</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            {prospects.length === 0
              ? 'Start by searching for businesses in the "Search Places" tab and clicking "Research Prospect" to record your manual review checklist.'
              : 'No prospects match your current search and filter criteria.'}
          </p>
        </div>
      ) : (
        <div className="bg-slate-800/90 border border-slate-700/80 rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-700/80 bg-slate-900/80 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-4">Business &amp; Location</th>
                  <th className="py-3 px-3">Rating &amp; Volume</th>
                  <th className="py-3 px-3">Review Inspection</th>
                  <th className="py-3 px-3">Opportunity</th>
                  <th className="py-3 px-3">Social &amp; Instagram</th>
                  <th className="py-3 px-3">Contact</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/60 text-slate-300">
                {filteredProspects.map((p) => {
                  const igLink = p.instagramUrl || p.socials?.instagram;
                  const igHandle =
                    p.instagramHandle ||
                    p.socials?.instagramHandle ||
                    (igLink ? `@${igLink.split('instagram.com/')[1]?.replace(/\/$/, '')}` : undefined);
                  const fbLink = p.facebookUrl || p.socials?.facebook;
                  const ttLink = p.tiktokUrl || p.socials?.tiktok;

                  return (
                    <tr key={p.placeId} className="hover:bg-slate-800/60 transition-colors">
                      {/* Business & Location */}
                      <td className="py-3.5 px-4 max-w-[210px]">
                        <div className="font-bold text-white text-sm">{p.businessName}</div>
                        <div className="text-slate-400 text-[11px] truncate">{p.city}, {p.state}</div>
                        {p.category && (
                          <span className="inline-block mt-1 text-[10px] px-1.5 py-0.2 rounded bg-slate-700 text-slate-300">
                            {p.category}
                          </span>
                        )}
                      </td>

                      {/* Rating & Volume */}
                      <td className="py-3.5 px-3">
                        <div className="flex items-center gap-1 font-semibold text-amber-400">
                          <Star className="w-3.5 h-3.5 fill-amber-400" />
                          <span>{p.rating ? p.rating.toFixed(1) : 'N/A'}</span>
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {p.userRatingCount?.toLocaleString() || '0'} reviews
                        </div>
                      </td>

                      {/* Review Inspection Counts */}
                      <td className="py-3.5 px-3">
                        {p.hasManualInspection ? (
                          <div className="space-y-0.5">
                            <div className="font-semibold text-white">
                              {p.reviewsInspectedCount} checked • {p.negativeReviewsCount} negative
                            </div>
                            <div className="text-amber-400 font-mono text-[11px] font-bold">
                              {p.unansweredNegativeCount} Unanswered
                            </div>
                            <div className="text-[10px] text-slate-500">
                              Inspected {p.dateInspected}
                            </div>
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-500 italic">
                            Not inspected
                          </span>
                        )}
                      </td>

                      {/* Opportunity Level */}
                      <td className="py-3.5 px-3">
                        {p.opportunityLevel === 'HIGH' && (
                          <span className="inline-block px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            HIGH
                          </span>
                        )}
                        {p.opportunityLevel === 'MEDIUM' && (
                          <span className="inline-block px-2 py-0.5 rounded text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            MEDIUM
                          </span>
                        )}
                        {p.opportunityLevel === 'LOW' && (
                          <span className="inline-block px-2 py-0.5 rounded text-[11px] font-medium bg-slate-700 text-slate-300 border border-slate-600">
                            LOW
                          </span>
                        )}
                        {p.opportunityLevel === 'UNVERIFIED' && (
                          <span className="inline-block px-2 py-0.5 rounded text-[11px] font-medium bg-purple-500/20 text-purple-300 border border-purple-500/30">
                            UNVERIFIED
                          </span>
                        )}
                      </td>

                      {/* Social & Instagram */}
                      <td className="py-3.5 px-3 max-w-[170px] space-y-1">
                        {igLink ? (
                          <a
                            href={igLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-pink-500/15 border border-pink-500/30 text-pink-300 hover:text-white text-[11px] font-mono group"
                            title={`Open Instagram: ${igHandle || igLink}`}
                          >
                            <Instagram className="w-3 h-3 text-pink-400 group-hover:scale-110 transition-transform" />
                            <span className="truncate max-w-[110px]">{igHandle || 'Instagram'}</span>
                            <ExternalLink className="w-2 h-2 text-pink-400" />
                          </a>
                        ) : (
                          <span className="text-[10px] text-slate-500 italic block">
                            No IG found
                          </span>
                        )}

                        <div className="flex items-center gap-1.5">
                          {fbLink && (
                            <a
                              href={fbLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-400 hover:text-blue-300"
                              title="Facebook"
                            >
                              <Facebook className="w-3 h-3" />
                            </a>
                          )}
                          {ttLink && (
                            <a
                              href={ttLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-cyan-400 hover:text-cyan-300"
                              title="TikTok"
                            >
                              <Share2 className="w-3 h-3" />
                            </a>
                          )}
                          {p.websiteUri && (
                            <a
                              href={p.websiteUri}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-slate-400 hover:text-emerald-400"
                              title="Official Website"
                            >
                              <Globe className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                      </td>

                      {/* Contact Discovery */}
                      <td className="py-3.5 px-3 max-w-[160px] space-y-0.5">
                        {p.contactEmail ? (
                          <div className="flex items-center gap-1 text-[11px] text-indigo-300 truncate">
                            <Mail className="w-3 h-3 shrink-0" />
                            <span className="truncate">{p.contactEmail}</span>
                          </div>
                        ) : null}
                        {p.nationalPhoneNumber ? (
                          <div className="flex items-center gap-1 text-[11px] text-slate-400">
                            <Phone className="w-3 h-3 shrink-0" />
                            <span>{p.nationalPhoneNumber}</span>
                          </div>
                        ) : null}
                      </td>

                      {/* Status Dropdown */}
                      <td className="py-3.5 px-3">
                        <select
                          value={p.contactStatus}
                          onChange={(e) =>
                            onUpdateStatus(p.placeId, e.target.value as ContactStatus)
                          }
                          className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-[11px] text-white focus:outline-none focus:border-indigo-500 cursor-pointer"
                        >
                          <option value="Not Contacted">Not Contacted</option>
                          <option value="Email Drafted">Email Drafted</option>
                          <option value="Outreached">Outreached</option>
                          <option value="In Discussion">In Discussion</option>
                          <option value="Not Interested">Not Interested</option>
                        </select>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right space-x-1 whitespace-nowrap">
                        <a
                          href={p.googleMapsUri}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
                          title="Open on Google Maps"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>

                        <button
                          onClick={() => onEditProspect(p)}
                          className="inline-flex p-1.5 rounded-lg text-emerald-400 hover:text-emerald-300 hover:bg-slate-700 transition-colors cursor-pointer"
                          title="Edit Review & Social Checklist"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => onDeleteProspect(p.placeId)}
                          className="inline-flex p-1.5 rounded-lg text-rose-400 hover:text-rose-300 hover:bg-slate-700 transition-colors cursor-pointer"
                          title="Remove from pipeline"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
