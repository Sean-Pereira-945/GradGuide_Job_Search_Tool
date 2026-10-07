import type { CampusHub, VisaRegime } from './types';

export const VISA_REGIMES: VisaRegime[] = [
  {
    id: 'UK_TIER4',
    name: 'UK Student Visa (Tier 4 / Graduate Route)',
    country: 'United Kingdom',
    maxWeeklyHours: 20,
    onCampusOnly: false,
    ruleSummary: 'Strictly capped at 20 hours per week during term-time for degree-level students; full-time permitted during official university vacations.',
  },
  {
    id: 'AU_500',
    name: 'Australia Subclass 500 (Student Visa)',
    country: 'Australia',
    maxWeeklyHours: 24,
    maxFortnightlyHours: 48,
    onCampusOnly: false,
    ruleSummary: 'Capped at 48 hours per fortnight (24h/wk avg) during study terms; unlimited hours during scheduled course breaks.',
  },
  {
    id: 'CA_STUDY',
    name: 'Canada Study Permit (Off-Campus)',
    country: 'Canada',
    maxWeeklyHours: 24,
    onCampusOnly: false,
    ruleSummary: 'Up to 24 hours per week off-campus during regular academic sessions; on-campus employment has no statutory cap.',
  },
  {
    id: 'US_F1',
    name: 'USA F-1 Visa (On-Campus / CPT)',
    country: 'United States',
    maxWeeklyHours: 20,
    onCampusOnly: true,
    ruleSummary: 'Up to 20 hours per week on-campus during the academic term. Off-campus roles require authorized CPT or OPT.',
  },
  {
    id: 'VACATION',
    name: 'Scheduled Semester Vacation / Graduate Visa',
    country: 'All',
    maxWeeklyHours: 40,
    onCampusOnly: false,
    ruleSummary: 'Unrestricted full-time work rights (up to 40+ hrs/wk) during official university vacation periods or on Post-Study Graduate Route visas.',
  },
];

export const CAMPUS_HUBS: CampusHub[] = [
  {
    id: 'london-ucl',
    name: 'London Universities (UCL, LSE, KCL, Imperial, Brunel)',
    shortName: 'London Campus Hub',
    city: 'London',
    country: 'United Kingdom',
    lat: 51.5246,
    lng: -0.1340,
  },
  {
    id: 'midlands-warwick',
    name: 'Midlands Hub (University of Warwick, Birmingham, Nottingham, Loughborough)',
    shortName: 'Midlands Campus Hub',
    city: 'Coventry / Midlands',
    country: 'United Kingdom',
    lat: 52.3793,
    lng: -1.5615,
  },
  {
    id: 'north-leeds',
    name: 'Northern Hub (University of Leeds, Manchester, Sheffield, York)',
    shortName: 'Northern Campus Hub',
    city: 'Leeds / Manchester',
    country: 'United Kingdom',
    lat: 53.8067,
    lng: -1.5550,
  },
  {
    id: 'southwest-bristol',
    name: 'South West & Wales Hub (University of Bristol, Bath, Exeter, Cardiff)',
    shortName: 'Bristol / South West Hub',
    city: 'Bristol',
    country: 'United Kingdom',
    lat: 51.4584,
    lng: -2.6030,
  },
  {
    id: 'scotland-glasgow',
    name: 'Scotland & NI Hub (University of Glasgow, Edinburgh, St Andrews, Ulster)',
    shortName: 'Scotland Campus Hub',
    city: 'Glasgow / Edinburgh',
    country: 'United Kingdom',
    lat: 55.8721,
    lng: -4.2882,
  },
];

// Calculate Haversine distance in kilometers between two lat/lng points
export function calculateDistanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function getCommuteEstimate(campus: CampusHub, jobLat: number, jobLng: number, isRemote = false) {
  if (isRemote) {
    return {
      isLocalToCampus: true,
      distanceKm: 0,
      walkMins: 0,
      transitMins: 0,
      betweenLecturesFit: true,
      summaryLabel: '0m commute (Remote / Campus Dorm)',
    };
  }

  const distanceKm = calculateDistanceKm(campus.lat, campus.lng, jobLat, jobLng);

  // Within ~45km regional university hub
  if (distanceKm > 55) {
    return {
      isLocalToCampus: false,
      distanceKm: Number(distanceKm.toFixed(1)),
      walkMins: null,
      transitMins: null,
      betweenLecturesFit: false,
      summaryLabel: `${Math.round(distanceKm)} km from ${campus.shortName}`,
    };
  }

  const walkMins = Math.max(3, Math.round(distanceKm * 12));
  const transitMins = distanceKm < 0.8 ? walkMins : Math.max(6, Math.round(distanceKm * 2.2 + 6));
  const bestMins = Math.min(walkMins, transitMins);

  return {
    isLocalToCampus: true,
    distanceKm: Number(distanceKm.toFixed(1)),
    walkMins,
    transitMins,
    betweenLecturesFit: bestMins <= 30,
    summaryLabel:
      walkMins <= 20
        ? `${walkMins}m campus walk (${distanceKm.toFixed(1)} km)`
        : `${transitMins}m campus transit (${distanceKm.toFixed(1)} km)`,
  };
}
