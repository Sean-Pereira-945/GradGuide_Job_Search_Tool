import React, { useEffect, useState, useMemo } from 'react';
import {
  Search,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  Plus,
  Check,
  SlidersHorizontal,
} from 'lucide-react';
import type {
  ApplicationStage,
  JobCategory,
  JobListing,
  JobType,
  ScrapeResponse,
  ScraperTargetRun,
  TrackedApplication,
  VisaRegimeId,
} from './types';
import { CAMPUS_HUBS, VISA_REGIMES, getCommuteEstimate } from './constants';
import { ScraperEngineView } from './components/ScraperEngineView';
import { VisaShiftPlannerView } from './components/VisaShiftPlannerView';

type ActiveTab = 'discover' | 'planner' | 'sources';

const JOB_TYPES: ('All' | JobType)[] = ['All', 'Part-time / Casual', 'Internship', 'Full-time'];

const JOB_CATEGORIES: ('All' | JobCategory)[] = [
  'All',
  'Cafe & Hospitality',
  'Retail & Customer Service',
  'Campus & Tutoring',
  'Delivery & Logistics',
  'Internship & Grad',
  'Full-time',
];

const LANGUAGE_FILTERS = ['All', 'Conversational', 'Intermediate', 'Fluent / Academic'] as const;

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('discover');
  const [jobs, setJobs] = useState<JobListing[]>([]);
  const [runs, setRuns] = useState<ScraperTargetRun[]>([]);
  const [lastScrapedAt, setLastScrapedAt] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isScraping, setIsScraping] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Student Context Controls (Features 1, 2, 3)
  const [selectedVisaId, setSelectedVisaId] = useState<VisaRegimeId>('UK_TIER4');
  const [selectedCampusId, setSelectedCampusId] = useState<string>('london-ucl');

  // Search & Filter States
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedJobType, setSelectedJobType] = useState<'All' | JobType>('All');
  const [selectedCategory, setSelectedCategory] = useState<'All' | JobCategory>('All');
  const [onlyVisaCompliant, setOnlyVisaCompliant] = useState<boolean>(false);
  const [onlyNearCampus, setOnlyNearCampus] = useState<boolean>(false);
  const [onlyVerifiedPayroll, setOnlyVerifiedPayroll] = useState<boolean>(false);
  const [languageFilter, setLanguageFilter] = useState<typeof LANGUAGE_FILTERS[number]>('All');

  // Selected job for detail inspection panel
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

  // Saved / Tracked Applications in localStorage (clean, no hardcoded fake IDs)
  const [trackedApps, setTrackedApps] = useState<TrackedApplication[]>(() => {
    try {
      const saved = localStorage.getItem('gradguide_live_tracked_apps_v2');
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore storage errors
    }
    return [];
  });

  useEffect(() => {
    try {
      localStorage.setItem('gradguide_live_tracked_apps_v2', JSON.stringify(trackedApps));
    } catch {
      // ignore storage errors
    }
  }, [trackedApps]);

  const activeVisa = useMemo(
    () => VISA_REGIMES.find((v) => v.id === selectedVisaId) || VISA_REGIMES[0],
    [selectedVisaId]
  );

  const activeCampus = useMemo(
    () => CAMPUS_HUBS.find((c) => c.id === selectedCampusId) || CAMPUS_HUBS[0],
    [selectedCampusId]
  );

  // Fetch live scraped listings from backend
  const fetchScrapedJobs = async (forceRefresh = false) => {
    try {
      if (forceRefresh) {
        setIsScraping(true);
      } else {
        setIsLoading(true);
      }
      setErrorMsg(null);
      const res = await fetch(`/api/jobs${forceRefresh ? '?refresh=true' : ''}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: ScrapeResponse = await res.json();
      setJobs(data.jobs);
      setRuns(data.runs);
      setLastScrapedAt(data.lastScrapedAt);
      if (data.jobs.length > 0) {
        setSelectedJobId((prev) =>
          prev && data.jobs.some((j) => j.id === prev) ? prev : data.jobs[0].id
        );
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to run live scraper');
    } finally {
      setIsLoading(false);
      setIsScraping(false);
    }
  };

  const handleRunLiveKeywordScraper = async (liveKeyword?: string) => {
    try {
      setIsScraping(true);
      setErrorMsg(null);
      const res = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ liveKeyword }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: ScrapeResponse = await res.json();
      setJobs(data.jobs);
      setRuns(data.runs);
      setLastScrapedAt(data.lastScrapedAt);
      if (liveKeyword && data.jobs.length > 0) {
        setSelectedJobId(data.jobs[0].id);
        setActiveTab('discover');
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Live scrape failed');
    } finally {
      setIsScraping(false);
    }
  };

  useEffect(() => {
    fetchScrapedJobs(false);
  }, []);

  // Calculate current committed weekly hours from tracked applications that exist in live jobs
  const committedWeeklyHours = useMemo(() => {
    return trackedApps.reduce((acc, app) => {
      const exists = jobs.some((j) => j.id === app.jobId);
      return exists ? acc + app.committedWeeklyHours : acc;
    }, 0);
  }, [trackedApps, jobs]);

  const remainingVisaHours = Math.max(0, activeVisa.maxWeeklyHours - committedWeeklyHours);

  // Filter and enrich jobs with live Visa Compliance & Campus Proximity calculations
  const filteredJobs = useMemo(() => {
    return jobs
      .map((job) => {
        const isRemote = job.location.toLowerCase().includes('remote');
        const commute = getCommuteEstimate(activeCampus, job.lat, job.lng, isRemote);
        const fitsVisaCap = job.weeklyHoursMin <= activeVisa.maxWeeklyHours;
        const fitsRemainingHours = job.weeklyHoursMin <= remainingVisaHours;
        const violatesF1OnCampus = activeVisa.onCampusOnly && !job.isOnCampus;
        const isVisaCompliant = fitsVisaCap && !violatesF1OnCampus;

        return {
          job,
          commute,
          isVisaCompliant,
          fitsRemainingHours,
          violatesF1OnCampus,
        };
      })
      .filter(({ job, commute, isVisaCompliant }) => {
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchTitle = job.title.toLowerCase().includes(q);
          const matchEmployer = job.employer.toLowerCase().includes(q);
          const matchLoc =
            job.location.toLowerCase().includes(q) || job.city.toLowerCase().includes(q);
          const matchCat = job.category.toLowerCase().includes(q);
          if (!matchTitle && !matchEmployer && !matchLoc && !matchCat) return false;
        }

        if (selectedJobType !== 'All' && job.jobType !== selectedJobType) return false;
        if (selectedCategory !== 'All' && job.category !== selectedCategory) return false;
        if (onlyVisaCompliant && !isVisaCompliant) return false;
        if (onlyNearCampus && !commute.isLocalToCampus) return false;
        if (
          onlyVerifiedPayroll &&
          job.trustInfo.status !== 'Verified University / Enterprise Payroll'
        ) {
          return false;
        }
        if (languageFilter !== 'All' && job.trustInfo.languageComfort !== languageFilter) {
          return false;
        }

        return true;
      });
  }, [
    jobs,
    activeCampus,
    activeVisa,
    remainingVisaHours,
    searchQuery,
    selectedJobType,
    selectedCategory,
    onlyVisaCompliant,
    onlyNearCampus,
    onlyVerifiedPayroll,
    languageFilter,
  ]);

  const activeJobItem = useMemo(() => {
    return (
      filteredJobs.find((item) => item.job.id === selectedJobId) ||
      filteredJobs[0] ||
      null
    );
  }, [filteredJobs, selectedJobId]);

  // Handlers for Tracked Applications
  const handleToggleTrackJob = (job: JobListing) => {
    const exists = trackedApps.some((a) => a.jobId === job.id);
    if (exists) {
      setTrackedApps((prev) => prev.filter((a) => a.jobId !== job.id));
    } else {
      setTrackedApps((prev) => [
        ...prev,
        {
          jobId: job.id,
          stage: 'Saved',
          committedWeeklyHours: job.weeklyHoursMin,
          notes: '',
          updatedAt: new Date().toISOString(),
        },
      ]);
    }
  };

  const handleUpdateStage = (jobId: string, stage: ApplicationStage) => {
    setTrackedApps((prev) =>
      prev.map((a) => (a.jobId === jobId ? { ...a, stage, updatedAt: new Date().toISOString() } : a))
    );
  };

  const handleUpdateHours = (jobId: string, committedWeeklyHours: number) => {
    setTrackedApps((prev) =>
      prev.map((a) =>
        a.jobId === jobId
          ? { ...a, committedWeeklyHours, updatedAt: new Date().toISOString() }
          : a
      )
    );
  };

  const handleUpdateNotes = (jobId: string, notes: string) => {
    setTrackedApps((prev) =>
      prev.map((a) => (a.jobId === jobId ? { ...a, notes, updatedAt: new Date().toISOString() } : a))
    );
  };

  const handleRemoveTracked = (jobId: string) => {
    setTrackedApps((prev) => prev.filter((a) => a.jobId !== jobId));
  };

  const resetAllFilters = () => {
    setSearchQuery('');
    setSelectedJobType('All');
    setSelectedCategory('All');
    setOnlyVisaCompliant(false);
    setOnlyNearCampus(false);
    setOnlyVerifiedPayroll(false);
    setLanguageFilter('All');
  };

  const validTrackedCount = useMemo(
    () => trackedApps.filter((a) => jobs.some((j) => j.id === a.jobId)).length,
    [trackedApps, jobs]
  );

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      {/* Top Bar Contract: Zone 1 (Single-element Brand), Zone 2 (Clean Nav Links), Zone 3 (Primary Action) */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-200 px-6 py-3.5 flex items-center justify-between">
        <a
          href="#discover"
          onClick={(e) => {
            e.preventDefault();
            setActiveTab('discover');
          }}
          className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
        >
          GradGuide
        </a>

        <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600">
          <button
            onClick={() => setActiveTab('discover')}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'discover'
                ? 'text-slate-900 font-semibold underline underline-offset-8 decoration-2 decoration-slate-900'
                : 'hover:text-slate-900'
            }`}
          >
            Job Discovery ({jobs.length})
          </button>
          <button
            onClick={() => setActiveTab('planner')}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'planner'
                ? 'text-slate-900 font-semibold underline underline-offset-8 decoration-2 decoration-slate-900'
                : 'hover:text-slate-900'
            }`}
          >
            Visa & Shift Planner ({validTrackedCount})
          </button>
          <button
            onClick={() => setActiveTab('sources')}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'sources'
                ? 'text-slate-900 font-semibold underline underline-offset-8 decoration-2 decoration-slate-900'
                : 'hover:text-slate-900'
            }`}
          >
            Live Job Sources ({runs.length})
          </button>
        </nav>

        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchScrapedJobs(true)}
            disabled={isScraping}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isScraping ? 'animate-spin' : ''}`} />
            {isScraping ? 'Syncing Live Jobs...' : 'Refresh Live Jobs'}
          </button>
        </div>
      </header>

      {/* Mobile Tab Bar */}
      <div className="md:hidden flex items-center gap-2 px-4 py-2 bg-white border-b border-slate-200 overflow-x-auto">
        <button
          onClick={() => setActiveTab('discover')}
          className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap shrink-0 ${
            activeTab === 'discover' ? 'bg-slate-900 text-white' : 'text-slate-600'
          }`}
        >
          Jobs ({jobs.length})
        </button>
        <button
          onClick={() => setActiveTab('planner')}
          className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap shrink-0 ${
            activeTab === 'planner' ? 'bg-slate-900 text-white' : 'text-slate-600'
          }`}
        >
          Shift Planner ({validTrackedCount})
        </button>
        <button
          onClick={() => setActiveTab('sources')}
          className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap shrink-0 ${
            activeTab === 'sources' ? 'bg-slate-900 text-white' : 'text-slate-600'
          }`}
        >
          Live Sources ({runs.length})
        </button>
      </div>

      {/* Student Profile Context Bar: Powers the 3 Original Features */}
      <section className="bg-white border-b border-slate-200 px-6 py-3.5">
        <div className="max-w-[1400px] mx-auto flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4">
            {/* Feature 1 Selector: Student Visa Regime */}
            <div className="flex items-center gap-2">
              <label
                htmlFor="visa-select"
                className="text-xs font-semibold text-slate-700 whitespace-nowrap"
              >
                01. Visa Work-Hour Regime:
              </label>
              <select
                id="visa-select"
                value={selectedVisaId}
                onChange={(e) => setSelectedVisaId(e.target.value as VisaRegimeId)}
                className="px-2.5 py-1.5 text-xs font-medium bg-slate-50 border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:border-slate-900"
              >
                {VISA_REGIMES.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name} (Max {v.maxWeeklyHours}h/wk)
                  </option>
                ))}
              </select>
            </div>

            {/* Feature 2 Selector: University Campus Hub */}
            <div className="flex items-center gap-2">
              <label
                htmlFor="campus-select"
                className="text-xs font-semibold text-slate-700 whitespace-nowrap"
              >
                02. Anchor Campus Region:
              </label>
              <select
                id="campus-select"
                value={selectedCampusId}
                onChange={(e) => setSelectedCampusId(e.target.value)}
                className="px-2.5 py-1.5 text-xs font-medium bg-slate-50 border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:border-slate-900"
              >
                {CAMPUS_HUBS.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Live Roster Budget Readout */}
          <div className="flex items-center gap-5 text-xs border-t lg:border-t-0 pt-2.5 lg:pt-0 border-slate-100">
            <div className="flex items-center gap-2">
              <span className="text-slate-500">Tracked Roster Hours:</span>
              <span
                className={`font-mono tabular-nums font-semibold ${
                  committedWeeklyHours > activeVisa.maxWeeklyHours
                    ? 'text-red-600'
                    : 'text-slate-900'
                }`}
              >
                {committedWeeklyHours}h / {activeVisa.maxWeeklyHours}h wk
              </span>
            </div>
            <span className="text-slate-300" aria-hidden="true">
              ·
            </span>
            <button
              onClick={() => setActiveTab('planner')}
              className="text-emerald-700 font-semibold hover:underline whitespace-nowrap cursor-pointer"
            >
              Open Shift Simulator &rarr;
            </button>
          </div>
        </div>
      </section>

      {/* Main Content Container */}
      <main className="flex-1 max-w-[1400px] w-full mx-auto px-6 py-6">
        {errorMsg && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between text-xs text-red-800">
            <span>Live Feed Notice: {errorMsg}</span>
            <button
              onClick={() => fetchScrapedJobs(true)}
              className="font-semibold underline cursor-pointer"
            >
              Retry Sync
            </button>
          </div>
        )}

        {activeTab === 'discover' && (
          <div className="space-y-6">
            {/* Search & Multi-Dimensional Filter Controls */}
            <div className="p-5 bg-white border border-slate-200 rounded-lg space-y-4">
              <div className="flex flex-col lg:flex-row gap-3">
                {/* Search Input */}
                <div className="relative flex-1 flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Filter live jobs by title, university/employer, catering, retail, library, intern, or city..."
                      className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900 focus:bg-white transition-colors"
                    />
                  </div>
                  {searchQuery.trim().length > 2 && (
                    <button
                      onClick={() => handleRunLiveKeywordScraper(searchQuery.trim())}
                      disabled={isScraping}
                      className="px-3.5 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      {isScraping ? 'Scraping...' : `Scrape "${searchQuery.trim()}" Live`}
                    </button>
                  )}
                </div>

                {/* Segmented Job Type Filter (Core Requirement: Part-time/casual, Internship, Full-time) */}
                <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg overflow-x-auto">
                  {JOB_TYPES.map((type) => (
                    <button
                      key={type}
                      onClick={() => setSelectedJobType(type)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        selectedJobType === type
                          ? 'bg-white text-slate-900 shadow-xs font-semibold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              {/* Everyday Job Category Tabs (Cafes, Retail, Campus/Tutoring, Delivery, Internships) */}
              <div className="flex items-center justify-between gap-4 flex-wrap pt-1 border-t border-slate-100">
                <div className="flex items-center gap-1.5 overflow-x-auto py-1">
                  {JOB_CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        selectedCategory === cat
                          ? 'bg-slate-900 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>

                {/* Language Comfort Filter */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500 whitespace-nowrap">English Comfort:</span>
                  <select
                    value={languageFilter}
                    onChange={(e) =>
                      setLanguageFilter(e.target.value as typeof LANGUAGE_FILTERS[number])
                    }
                    className="px-2.5 py-1 text-xs font-medium bg-slate-50 border border-slate-300 rounded text-slate-800 focus:outline-none focus:border-slate-900"
                  >
                    {LANGUAGE_FILTERS.map((lang) => (
                      <option key={lang} value={lang}>
                        {lang === 'All' ? 'All English Levels' : lang}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 3 Original Student Feature Filter Toggles */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100">
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 mr-1">
                    <SlidersHorizontal className="w-3.5 h-3.5" />
                    Student Smart Filters:
                  </span>

                  <button
                    onClick={() => setOnlyVisaCompliant(!onlyVisaCompliant)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      onlyVisaCompliant
                        ? 'bg-emerald-50 border-emerald-600 text-emerald-900 font-semibold'
                        : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {onlyVisaCompliant ? '✓ ' : ''}Fits {activeVisa.maxWeeklyHours}h/wk Term Visa Cap
                  </button>

                  <button
                    onClick={() => setOnlyNearCampus(!onlyNearCampus)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      onlyNearCampus
                        ? 'bg-emerald-50 border-emerald-600 text-emerald-900 font-semibold'
                        : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {onlyNearCampus ? '✓ ' : ''}Near {activeCampus.shortName} (or Remote)
                  </button>

                  <button
                    onClick={() => setOnlyVerifiedPayroll(!onlyVerifiedPayroll)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      onlyVerifiedPayroll
                        ? 'bg-emerald-50 border-emerald-600 text-emerald-900 font-semibold'
                        : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {onlyVerifiedPayroll ? '✓ ' : ''}Official University Payroll Only
                  </button>
                </div>

                <div className="flex items-center gap-3 text-xs text-slate-500">
                  <span className="font-mono tabular-nums">
                    Showing {filteredJobs.length} of {jobs.length} live listings
                  </span>
                  {(searchQuery ||
                    selectedJobType !== 'All' ||
                    selectedCategory !== 'All' ||
                    onlyVisaCompliant ||
                    onlyNearCampus ||
                    onlyVerifiedPayroll ||
                    languageFilter !== 'All') && (
                    <button
                      onClick={resetAllFilters}
                      className="text-slate-900 font-semibold hover:underline cursor-pointer"
                    >
                      Reset filters
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Split Workspace: Left Job Feed + Right Detailed Inspection Panel */}
            {isLoading ? (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-7 space-y-3">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <div
                      key={n}
                      className="h-32 bg-white border border-slate-200 rounded-lg p-5 animate-pulse flex flex-col justify-between"
                    >
                      <div className="h-4 bg-slate-200 rounded w-2/3" />
                      <div className="h-3 bg-slate-100 rounded w-1/2" />
                      <div className="h-3 bg-slate-100 rounded w-3/4" />
                    </div>
                  ))}
                </div>
                <div className="lg:col-span-5 h-[480px] bg-white border border-slate-200 rounded-lg p-6 animate-pulse" />
              </div>
            ) : filteredJobs.length === 0 ? (
              <div className="p-12 bg-white border border-slate-200 rounded-lg text-center space-y-3">
                <h3 className="text-base font-semibold text-slate-900">
                  No Live Scraped Jobs Match Your Current Filters
                </h3>
                <p className="text-sm text-slate-600 max-w-md mx-auto">
                  Try resetting your active filters or click "Scrape Live" with your custom search term to pull fresh postings from external boards.
                </p>
                <div className="flex items-center justify-center gap-3 pt-2">
                  <button
                    onClick={resetAllFilters}
                    className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    Reset All Filters
                  </button>
                  {searchQuery.trim() && (
                    <button
                      onClick={() => handleRunLiveKeywordScraper(searchQuery.trim())}
                      className="px-4 py-2 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-600 rounded-lg hover:bg-emerald-100 transition-colors cursor-pointer"
                    >
                      Scrape "{searchQuery.trim()}" Live
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Left Column: High-Density Live Listing Feed */}
                <div className="lg:col-span-7 bg-white border border-slate-200 rounded-lg divide-y divide-slate-200 overflow-hidden">
                  {filteredJobs.map(({ job, commute, isVisaCompliant, violatesF1OnCampus }) => {
                    const isSelected = activeJobItem?.job.id === job.id;
                    const isTracked = trackedApps.some((a) => a.jobId === job.id);

                    return (
                      <article
                        key={job.id}
                        onClick={() => setSelectedJobId(job.id)}
                        className={`p-5 transition-colors cursor-pointer ${
                          isSelected ? 'bg-slate-100/90' : 'hover:bg-slate-50/90'
                        }`}
                      >
                        {/* Top Kicker: Unboxed clean metadata with middle dot separators */}
                        <div className="flex items-center justify-between gap-2 text-xs text-slate-500 mb-1.5">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-medium text-slate-700">{job.category}</span>
                            <span aria-hidden="true">·</span>
                            <span>{job.jobType}</span>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono tabular-nums">{job.postedDate}</span>
                          </div>
                          <a
                            href={job.applyUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            title="Open live job posting in new tab"
                            className="inline-flex items-center gap-1 font-medium text-slate-600 hover:text-emerald-700 transition-colors shrink-0"
                          >
                            <span>Open Live Job</span>
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        </div>

                        {/* Primary Title & Pay Rate */}
                        <div className="flex items-baseline justify-between gap-4">
                          <h2 className="text-base font-bold text-slate-900 leading-snug">
                            {job.title}
                          </h2>
                          <span className="font-mono tabular-nums text-sm font-bold text-emerald-700 shrink-0">
                            {job.payDisplay.split('(')[0].trim()}
                          </span>
                        </div>

                        {/* Employer & Location */}
                        <div className="mt-1 text-xs text-slate-600 flex items-center gap-1.5 flex-wrap">
                          <span className="font-semibold text-slate-800">{job.employer}</span>
                          <span aria-hidden="true">·</span>
                          <span>{job.location}</span>
                        </div>

                        {/* 3 Student Features Summary Line */}
                        <div className="mt-3 pt-3 border-t border-slate-200/70 flex items-center justify-between gap-3 flex-wrap text-xs">
                          <div className="flex items-center gap-2 flex-wrap text-slate-600">
                            {/* Feature 1: Visa Hour Status */}
                            <span
                              className={`inline-flex items-center gap-1 font-medium ${
                                isVisaCompliant ? 'text-emerald-700' : 'text-amber-700'
                              }`}
                            >
                              {isVisaCompliant ? (
                                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                              ) : (
                                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                              )}
                              <span className="font-mono tabular-nums">
                                {job.weeklyHoursMin}–{job.weeklyHoursMax}h/wk
                              </span>
                              {violatesF1OnCampus
                                ? '(F-1 CPT Req.)'
                                : isVisaCompliant
                                ? '(Fits Term Cap)'
                                : '(Vacation / Grad Visa)'}
                            </span>

                            <span aria-hidden="true">·</span>

                            {/* Feature 2: Campus Commute */}
                            <span
                              className={`font-mono tabular-nums ${
                                commute.isLocalToCampus
                                  ? 'text-slate-900 font-medium'
                                  : 'text-slate-500'
                              }`}
                            >
                              {commute.summaryLabel}
                            </span>

                            <span aria-hidden="true">·</span>

                            {/* Feature 3: Employer Trust Status */}
                            <span className="text-slate-600">{job.trustInfo.status}</span>
                          </div>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleTrackJob(job);
                            }}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                              isTracked
                                ? 'bg-slate-900 border-slate-900 text-white'
                                : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100'
                            }`}
                          >
                            {isTracked ? (
                              <>
                                <Check className="w-3 h-3" />
                                In Shift Planner
                              </>
                            ) : (
                              <>
                                <Plus className="w-3 h-3" />
                                Add to Shift Planner
                              </>
                            )}
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>

                {/* Right Column: Sticky Listing Inspector + Student Intelligence Breakdown */}
                {activeJobItem && (
                  <aside className="lg:col-span-5 lg:sticky lg:top-20 bg-white border border-slate-200 rounded-lg p-6 space-y-6">
                    {/* Header */}
                    <div className="border-b border-slate-200 pb-4 space-y-2">
                      <div className="text-xs text-slate-500 flex items-center gap-1.5 flex-wrap">
                        <span>{activeJobItem.job.category}</span>
                        <span aria-hidden="true">·</span>
                        <span>{activeJobItem.job.jobType}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums">
                          {activeJobItem.job.postedDate}
                        </span>
                        {activeJobItem.job.closesDate && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono tabular-nums text-amber-700">
                              {activeJobItem.job.closesDate}
                            </span>
                          </>
                        )}
                      </div>

                      <h2 className="text-xl font-bold text-slate-900 leading-snug">
                        {activeJobItem.job.title}
                      </h2>

                      <div className="text-sm font-semibold text-slate-800">
                        {activeJobItem.job.employer}
                        {activeJobItem.job.department
                          ? ` · ${activeJobItem.job.department}`
                          : ''}{' '}
                        ·{' '}
                        <span className="font-normal text-slate-600">
                          {activeJobItem.job.location}
                        </span>
                      </div>

                      <div className="pt-1 font-mono tabular-nums text-base font-bold text-emerald-700">
                        {activeJobItem.job.payDisplay}
                      </div>

                      <div className="pt-3 flex items-center gap-3 flex-wrap">
                        <a
                          href={activeJobItem.job.applyUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
                        >
                          View Original Job Posting
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>

                        <button
                          onClick={() => handleToggleTrackJob(activeJobItem.job)}
                          className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold border border-slate-300 rounded-lg text-slate-800 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          {trackedApps.some((a) => a.jobId === activeJobItem.job.id)
                            ? '✓ Tracked in Shift Planner'
                            : '+ Track & Simulate Hours'}
                        </button>
                      </div>
                    </div>

                    {/* 3 International Student Intelligence Diagnostics */}
                    <div className="space-y-3 text-xs border-b border-slate-200 pb-5">
                      <div className="font-semibold text-slate-900 text-sm">
                        International Student Fit Diagnostics
                      </div>

                      {/* 1. Visa Work-Hour Check */}
                      <div className="flex items-start justify-between gap-4 py-1.5 border-b border-slate-100">
                        <span className="text-slate-500">01. Visa Roster Impact:</span>
                        <span className="text-right font-medium text-slate-900">
                          Est.{' '}
                          <span className="font-mono tabular-nums">
                            {activeJobItem.job.weeklyHoursMin}–{activeJobItem.job.weeklyHoursMax}h/wk
                          </span>{' '}
                          ({activeJobItem.job.shiftFlexibility})
                        </span>
                      </div>

                      {/* 2. Campus Proximity */}
                      <div className="flex items-start justify-between gap-4 py-1.5 border-b border-slate-100">
                        <span className="text-slate-500">
                          02. Proximity to {activeCampus.shortName}:
                        </span>
                        <span className="text-right font-mono tabular-nums font-medium text-slate-900">
                          {activeJobItem.commute.summaryLabel}
                        </span>
                      </div>

                      {/* 3. Wage Shield & Trust */}
                      <div className="flex items-start justify-between gap-4 py-1.5 border-b border-slate-100">
                        <span className="text-slate-500">03. Employer Trust & Pay:</span>
                        <span className="text-right font-medium text-emerald-700 max-w-[260px]">
                          {activeJobItem.job.trustInfo.awardComplianceNote}
                        </span>
                      </div>

                      {/* Language Comfort */}
                      <div className="flex items-start justify-between gap-4 py-1.5">
                        <span className="text-slate-500">English Comfort Level:</span>
                        <span className="text-right font-medium text-slate-900">
                          {activeJobItem.job.trustInfo.languageComfort} · Formal Payroll Verified
                        </span>
                      </div>
                    </div>

                    {/* Role Description & Traceable Source */}
                    <div className="space-y-3 text-sm text-slate-700">
                      <h3 className="text-xs font-semibold text-slate-900">
                        Live Listing Summary & Direct Source Verification
                      </h3>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        {activeJobItem.job.description}
                      </p>
                      <ul className="list-disc list-inside space-y-1 text-xs text-slate-600">
                        {activeJobItem.job.requirements.map((req, idx) => (
                          <li key={idx}>{req}</li>
                        ))}
                      </ul>
                      <div className="pt-2">
                        <a
                          href={activeJobItem.job.applyUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs font-mono text-emerald-700 hover:underline break-all"
                        >
                          {activeJobItem.job.applyUrl}
                          <ExternalLink className="w-3 h-3 shrink-0" />
                        </a>
                      </div>
                    </div>
                  </aside>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'planner' && (
          <VisaShiftPlannerView
            jobs={jobs}
            trackedApps={trackedApps}
            activeVisa={activeVisa}
            onUpdateStage={handleUpdateStage}
            onUpdateHours={handleUpdateHours}
            onUpdateNotes={handleUpdateNotes}
            onRemoveTracked={handleRemoveTracked}
            onNavigateToJobs={() => setActiveTab('discover')}
          />
        )}

        {activeTab === 'sources' && (
          <ScraperEngineView
            runs={runs}
            lastScrapedAt={lastScrapedAt}
            isScraping={isScraping}
            onRunScraper={handleRunLiveKeywordScraper}
          />
        )}
      </main>

      {/* Quiet Footer */}
      <footer className="mt-auto border-t border-slate-200 bg-white px-6 py-4 text-xs text-slate-500">
        <div className="max-w-[1400px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>
            GradGuide International Student Job Discovery · 100% Live Scraped Postings
          </span>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setActiveTab('sources')}
              className="hover:text-slate-900 transition-colors cursor-pointer"
            >
              View Connected Live Job Boards ({runs.length})
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
