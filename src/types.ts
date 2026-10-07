export type JobType = 'Part-time / Casual' | 'Internship' | 'Full-time';

export type JobCategory =
  | 'Cafe & Hospitality'
  | 'Retail & Customer Service'
  | 'Campus & Tutoring'
  | 'Delivery & Logistics'
  | 'Internship & Grad'
  | 'Full-time';

export type VisaRegimeId = 'UK_TIER4' | 'AU_500' | 'CA_STUDY' | 'US_F1' | 'VACATION';

export interface VisaRegime {
  id: VisaRegimeId;
  name: string;
  country: string;
  maxWeeklyHours: number;
  maxFortnightlyHours?: number;
  onCampusOnly: boolean;
  ruleSummary: string;
}

export interface CampusHub {
  id: string;
  name: string;
  shortName: string;
  city: string;
  country: string;
  lat: number;
  lng: number;
}

export interface EmployerTrustInfo {
  status: 'Verified University / Enterprise Payroll' | 'Licensed Visa Sponsor' | 'Standard Verified Listing';
  awardComplianceNote: string;
  sponsorshipTrackRecord: boolean;
  payslipVerified: boolean;
  languageComfort: 'Conversational' | 'Intermediate' | 'Fluent / Academic';
}

export interface JobListing {
  id: string;
  title: string;
  employer: string;
  department?: string;
  location: string;
  city: string;
  country: string;
  lat: number;
  lng: number;
  payDisplay: string;
  hourlyRateEquivalent: number;
  currencySymbol: string;
  jobType: JobType;
  category: JobCategory;
  postedDate: string;
  closesDate?: string;
  weeklyHoursMin: number;
  weeklyHoursMax: number;
  isOnCampus: boolean;
  shiftFlexibility: 'Between Lectures' | 'Evenings & Weekends' | 'Flexible Roster' | 'Fixed Business Hours';
  sourceName: string;
  sourceUrl: string;
  applyUrl: string;
  description: string;
  requirements: string[];
  trustInfo: EmployerTrustInfo;
}

export interface ScraperTargetRun {
  targetId: string;
  name: string;
  url: string;
  categoryFocus: string;
  status: 'success' | 'error';
  jobsExtracted: number;
  durationMs: number;
  timestamp: string;
  errorMessage?: string;
}

export interface ScrapeResponse {
  jobs: JobListing[];
  runs: ScraperTargetRun[];
  lastScrapedAt: string;
  totalExtracted: number;
}

export type ApplicationStage = 'Saved' | 'Applied' | 'Trial Shift / Interview' | 'Offer';

export interface TrackedApplication {
  jobId: string;
  stage: ApplicationStage;
  committedWeeklyHours: number;
  notes: string;
  updatedAt: string;
}
