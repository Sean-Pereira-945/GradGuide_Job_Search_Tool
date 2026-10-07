import React from 'react';
import { Trash2, ExternalLink, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import type {
  ApplicationStage,
  JobListing,
  TrackedApplication,
  VisaRegime,
} from '../types';

interface VisaShiftPlannerViewProps {
  jobs: JobListing[];
  trackedApps: TrackedApplication[];
  activeVisa: VisaRegime;
  onUpdateStage: (jobId: string, stage: ApplicationStage) => void;
  onUpdateHours: (jobId: string, hours: number) => void;
  onUpdateNotes: (jobId: string, notes: string) => void;
  onRemoveTracked: (jobId: string) => void;
  onNavigateToJobs: () => void;
}

const STAGES: ApplicationStage[] = ['Saved', 'Applied', 'Trial Shift / Interview', 'Offer'];

export const VisaShiftPlannerView: React.FC<VisaShiftPlannerViewProps> = ({
  jobs,
  trackedApps,
  activeVisa,
  onUpdateStage,
  onUpdateHours,
  onUpdateNotes,
  onRemoveTracked,
  onNavigateToJobs,
}) => {
  const enriched = trackedApps
    .map((app) => {
      const job = jobs.find((j) => j.id === app.jobId);
      return job ? { app, job } : null;
    })
    .filter((item): item is { app: TrackedApplication; job: JobListing } => item !== null);

  // Sum hours for active applications (or all tracked roles so student can simulate roster combinations)
  const totalCommittedWeeklyHours = enriched.reduce(
    (sum, item) => sum + item.app.committedWeeklyHours,
    0
  );

  const estimatedWeeklyGross = enriched.reduce(
    (sum, item) => sum + item.app.committedWeeklyHours * item.job.hourlyRateEquivalent,
    0
  );

  const hasOffCampusViolation =
    activeVisa.onCampusOnly && enriched.some((item) => !item.job.isOnCampus);

  const isOverCap = totalCommittedWeeklyHours > activeVisa.maxWeeklyHours;
  const remainingHours = Math.max(0, activeVisa.maxWeeklyHours - totalCommittedWeeklyHours);
  const utilizationPct = Math.min(
    100,
    Math.round((totalCommittedWeeklyHours / activeVisa.maxWeeklyHours) * 100)
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Visa Work-Hour Cap & Shift Tracker
          </h1>
          <p className="mt-1.5 text-sm text-slate-600 max-w-2xl">
            International students often combine a casual cafe/retail job with campus tutoring. Simulate your weekly shift hours across saved applications to prevent accidental student visa breaches.
          </p>
        </div>

        <div className="text-right">
          <div className="text-xs text-slate-500">Active Visa Regime</div>
          <div className="text-sm font-semibold text-slate-900">{activeVisa.name}</div>
        </div>
      </div>

      {/* Visa Compliance Meter Bar */}
      <div className="p-6 bg-white border border-slate-200 rounded-lg space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              {isOverCap || hasOffCampusViolation ? (
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
              ) : (
                <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
              )}
              <span className="text-sm font-semibold text-slate-900">
                {isOverCap
                  ? `Visa Cap Exceeded by ${(totalCommittedWeeklyHours - activeVisa.maxWeeklyHours).toFixed(1)} hrs/wk`
                  : hasOffCampusViolation
                  ? 'F-1 Off-Campus Restriction Alert: Off-campus role requires CPT/OPT authorization'
                  : `Visa Compliant — ${remainingHours.toFixed(1)} hrs/wk remaining under cap`}
              </span>
            </div>
            <p className="text-xs text-slate-600">{activeVisa.ruleSummary}</p>
          </div>

          <div className="flex items-center gap-8 border-t lg:border-t-0 pt-3 lg:pt-0 border-slate-100">
            <div>
              <div className="text-xs text-slate-500">Planned Weekly Hours</div>
              <div
                className={`text-xl font-bold font-mono tabular-nums ${
                  isOverCap ? 'text-red-600' : 'text-slate-900'
                }`}
              >
                {totalCommittedWeeklyHours.toFixed(1)} / {activeVisa.maxWeeklyHours}h
              </div>
            </div>
            {activeVisa.maxFortnightlyHours && (
              <div>
                <div className="text-xs text-slate-500">Fortnightly Equivalent</div>
                <div
                  className={`text-xl font-bold font-mono tabular-nums ${
                    totalCommittedWeeklyHours * 2 > activeVisa.maxFortnightlyHours
                      ? 'text-red-600'
                      : 'text-slate-900'
                  }`}
                >
                  {(totalCommittedWeeklyHours * 2).toFixed(1)} / {activeVisa.maxFortnightlyHours}h
                </div>
              </div>
            )}
            <div>
              <div className="text-xs text-slate-500">Est. Weekly Gross Pay</div>
              <div className="text-xl font-bold font-mono tabular-nums text-emerald-700">
                ${estimatedWeeklyGross.toFixed(0)}/wk
              </div>
            </div>
          </div>
        </div>

        {/* Visual Progress Bar */}
        <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-200 ${
              isOverCap
                ? 'bg-red-600'
                : utilizationPct > 85
                ? 'bg-amber-600'
                : 'bg-emerald-600'
            }`}
            style={{ width: `${utilizationPct}%` }}
          />
        </div>
      </div>

      {/* Tracked Applications Table */}
      {enriched.length === 0 ? (
        <div className="p-12 bg-white border border-slate-200 rounded-lg text-center space-y-3">
          <Clock className="w-8 h-8 text-slate-400 mx-auto" />
          <h3 className="text-base font-semibold text-slate-900">
            No Roles Tracked in Your Shift Planner Yet
          </h3>
          <p className="text-sm text-slate-600 max-w-md mx-auto">
            Add casual, part-time, or internship roles from the Job Discovery tab to simulate your weekly roster and track your application status.
          </p>
          <button
            onClick={onNavigateToJobs}
            className="mt-2 px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Browse Scraped Jobs
          </button>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500 bg-slate-50/60">
                  <th className="py-3 px-5">Role & Employer</th>
                  <th className="py-3 px-4">Application Stage</th>
                  <th className="py-3 px-4">Hourly Rate</th>
                  <th className="py-3 px-4">Weekly Shift Allocation</th>
                  <th className="py-3 px-4">Trial Shift / Interview Notes</th>
                  <th className="py-3 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm">
                {enriched.map(({ app, job }) => (
                  <tr key={job.id} className="hover:bg-slate-50/80">
                    <td className="py-3.5 px-5">
                      <div className="font-semibold text-slate-900">{job.title}</div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {job.employer} · {job.category} · {job.isOnCampus ? 'On-Campus' : 'Off-Campus'}
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <select
                        value={app.stage}
                        onChange={(e) =>
                          onUpdateStage(job.id, e.target.value as ApplicationStage)
                        }
                        className="px-2.5 py-1.5 text-xs font-medium bg-slate-50 border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:border-slate-900"
                      >
                        {STAGES.map((stage) => (
                          <option key={stage} value={stage}>
                            {stage}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-3.5 px-4 font-mono tabular-nums text-xs text-slate-700">
                      {job.currencySymbol}
                      {job.hourlyRateEquivalent.toFixed(2)}/hr
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <input
                          type="range"
                          min={0}
                          max={40}
                          step={1}
                          value={app.committedWeeklyHours}
                          onChange={(e) =>
                            onUpdateHours(job.id, parseFloat(e.target.value))
                          }
                          className="w-24 accent-slate-900 cursor-pointer"
                        />
                        <span className="font-mono tabular-nums text-xs font-semibold text-slate-900 w-14">
                          {app.committedWeeklyHours} hrs/wk
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5 font-mono tabular-nums">
                        Employer range: {job.weeklyHoursMin}–{job.weeklyHoursMax}h/wk
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <input
                        type="text"
                        value={app.notes}
                        onChange={(e) => onUpdateNotes(job.id, e.target.value)}
                        placeholder="Add trial shift time or manager name..."
                        className="w-full min-w-[180px] px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded focus:outline-none focus:border-slate-900"
                      />
                    </td>
                    <td className="py-3.5 px-5 text-right">
                      <div className="inline-flex items-center gap-2">
                        <a
                          href={job.applyUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Open Employer Portal"
                          className="p-1.5 text-slate-500 hover:text-slate-900 transition-colors"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                        <button
                          onClick={() => onRemoveTracked(job.id)}
                          title="Remove from planner"
                          className="p-1.5 text-slate-400 hover:text-red-600 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
