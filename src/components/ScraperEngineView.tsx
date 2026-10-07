import React, { useState } from 'react';
import { RefreshCw, ExternalLink, CheckCircle2, AlertTriangle, Search } from 'lucide-react';
import type { ScraperTargetRun } from '../types';

interface ScraperEngineViewProps {
  runs: ScraperTargetRun[];
  lastScrapedAt: string;
  isScraping: boolean;
  onRunScraper: (liveKeyword?: string) => Promise<void>;
}

export const ScraperEngineView: React.FC<ScraperEngineViewProps> = ({
  runs,
  lastScrapedAt,
  isScraping,
  onRunScraper,
}) => {
  const [liveKeyword, setLiveKeyword] = useState('');

  const handleKeywordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!liveKeyword.trim()) return;
    await onRunScraper(liveKeyword.trim());
    setLiveKeyword('');
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Live Job Sources & Real-Time Discovery Feed
          </h1>
          <p className="mt-1.5 text-sm text-slate-600 max-w-2xl">
            Every job listing in GradGuide is scraped in real time from public university, hospitality, retail, and tech job boards. Click any source below to open its live external board directly.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500 font-mono tabular-nums">
            Last synced: {lastScrapedAt ? new Date(lastScrapedAt).toLocaleTimeString() : 'Syncing...'}
          </span>
          <button
            onClick={() => onRunScraper()}
            disabled={isScraping}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isScraping ? 'animate-spin' : ''}`} />
            {isScraping ? 'Scraping Live Boards...' : 'Refresh All Live Sources'}
          </button>
        </div>
      </div>

      {/* On-Demand Live Keyword Scraper */}
      <div className="p-5 bg-white border border-slate-200 rounded-lg">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              Scrape Additional Live Roles by Keyword
            </h2>
            <p className="text-xs text-slate-600 mt-0.5">
              Enter any role or keyword (e.g., <span className="font-medium text-slate-800">barista</span>, <span className="font-medium text-slate-800">student ambassador</span>, <span className="font-medium text-slate-800">research assistant</span>, <span className="font-medium text-slate-800">receptionist</span>) to scrape live matching listings right now.
            </p>
          </div>
          <form onSubmit={handleKeywordSubmit} className="flex items-center gap-2 w-full lg:w-auto">
            <div className="relative flex-1 lg:w-80">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={liveKeyword}
                onChange={(e) => setLiveKeyword(e.target.value)}
                placeholder="e.g., student ambassador, cafe, tutor..."
                className="w-full pl-8 pr-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-md focus:outline-none focus:border-slate-900"
              />
            </div>
            <button
              type="submit"
              disabled={isScraping || !liveKeyword.trim()}
              className="px-4 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Scrape Live Now
            </button>
          </form>
        </div>
      </div>

      {/* Live Sources Table */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">
            Connected Live Job Sources ({runs.length})
          </h2>
          <span className="text-xs text-slate-500">
            100% live external job boards — zero static or hardcoded listings
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500 bg-slate-50/60">
                <th className="py-3 px-5">Live Source Feed</th>
                <th className="py-3 px-4">Category Coverage</th>
                <th className="py-3 px-4 text-right">Live Roles Extracted</th>
                <th className="py-3 px-4 text-right">Response Time</th>
                <th className="py-3 px-4 text-right">Status</th>
                <th className="py-3 px-5 text-right">Source Link</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-sm">
              {runs.map((run) => (
                <tr key={run.targetId} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3.5 px-5">
                    <div className="font-semibold text-slate-900">{run.name}</div>
                    <div className="text-xs text-slate-500 font-mono truncate max-w-md">
                      {run.url}
                    </div>
                  </td>
                  <td className="py-3.5 px-4 text-xs text-slate-700">{run.categoryFocus}</td>
                  <td className="py-3.5 px-4 text-right font-mono tabular-nums font-semibold text-slate-900">
                    {run.jobsExtracted}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono tabular-nums text-xs text-slate-600">
                    {run.durationMs} ms
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    {run.status === 'success' ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Live Connected
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        {run.errorMessage || 'Error'}
                      </span>
                    )}
                  </td>
                  <td className="py-3.5 px-5 text-right">
                    <a
                      href={run.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-semibold text-slate-900 hover:text-emerald-700 transition-colors"
                    >
                      Open Source
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
