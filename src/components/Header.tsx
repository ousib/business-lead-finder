import React from 'react';
import { Bot, MessageSquare, Download, ShieldCheck, Database, MapPin } from 'lucide-react';
import { ProspectResearch } from '../types';

interface HeaderProps {
  activeTab: 'search' | 'prospects';
  setActiveTab: (tab: 'search' | 'prospects') => void;
  prospects: ProspectResearch[];
  onOpenExport: () => void;
  onOpenCompliance: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  prospects,
  onOpenExport,
  onOpenCompliance,
}) => {
  const highCount = prospects.filter((p) => p.opportunityLevel === 'HIGH').length;
  const verifiedCount = prospects.filter((p) => p.hasManualInspection).length;

  return (
    <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 via-teal-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-emerald-500/20 text-white font-extrabold text-lg">
              <MessageSquare className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg text-white tracking-tight">
                  ReplyNation
                </span>
                <span className="bg-emerald-500/10 text-emerald-400 text-[11px] font-semibold px-2 py-0.5 rounded-full border border-emerald-500/20">
                  Prospect Finder
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">
                AI Google Review Response Lead Discovery & Manual Verification
              </p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center bg-slate-800/80 p-1 rounded-xl border border-slate-700/60">
            <button
              onClick={() => setActiveTab('search')}
              className={`flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                activeTab === 'search'
                  ? 'bg-emerald-500 text-slate-950 shadow-sm shadow-emerald-500/20'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <MapPin className="w-3.5 h-3.5" />
              <span>Search Places</span>
            </button>
            <button
              onClick={() => setActiveTab('prospects')}
              className={`flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all relative ${
                activeTab === 'prospects'
                  ? 'bg-emerald-500 text-slate-950 shadow-sm shadow-emerald-500/20'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <Database className="w-3.5 h-3.5" />
              <span>Researched Pipeline</span>
              {prospects.length > 0 && (
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    activeTab === 'prospects'
                      ? 'bg-slate-950 text-emerald-400'
                      : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  }`}
                >
                  {prospects.length}
                </span>
              )}
            </button>
          </div>

          {/* Actions & Compliance */}
          <div className="flex items-center gap-2">
            <button
              onClick={onOpenCompliance}
              className="hidden md:flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 px-2.5 py-1.5 rounded-lg border border-slate-800 hover:border-slate-700 bg-slate-800/40 transition-colors"
              title="Google Maps Platform Terms & Attribution Compliance"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Compliance</span>
            </button>

            <button
              onClick={onOpenExport}
              disabled={prospects.length === 0}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:hover:bg-indigo-600 text-white shadow-md shadow-indigo-600/20 transition-all cursor-pointer disabled:cursor-not-allowed"
              title="Export researched prospects to CSV with security escaping"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
              {prospects.length > 0 && (
                <span className="bg-indigo-800/80 text-[10px] px-1.5 py-0.2 rounded">
                  {prospects.length}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
