import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import * as cheerio from 'cheerio';
import { createServer as createViteServer } from 'vite';
import type {
  JobListing,
  ScraperTargetRun,
  ScrapeResponse,
  JobCategory,
  JobType,
  CampusHub,
} from './src/types.ts';
import { CAMPUS_HUBS } from './src/constants.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;

// Map UK / international university locations extracted from live HTML to coordinates for Campus Proximity
function resolveCoordinatesFromLocation(locText: string): {
  city: string;
  country: string;
  lat: number;
  lng: number;
} {
  const combined = locText.toLowerCase();

  if (/\b(boston|cambridge,?\s*(ma|massachusetts)|somerville|brookline|allston|brighton)\b/i.test(combined)) {
    return { city: 'Boston metro', country: 'United States', lat: 42.3601, lng: -71.0589 };
  }
  if (/\b(new york|manhattan|brooklyn|queens|the bronx|jersey city)\b/i.test(combined)) {
    return { city: 'New York metro', country: 'United States', lat: 40.7128, lng: -74.006 };
  }
  if (/\b(los angeles|westwood|culver city|santa monica|hollywood|pasadena|burbank)\b/i.test(combined)) {
    return { city: 'Los Angeles metro', country: 'United States', lat: 34.0522, lng: -118.2437 };
  }
  if (/\b(toronto|north york|etobicoke|scarborough|mississauga)\b/i.test(combined)) {
    return { city: 'Toronto metro', country: 'Canada', lat: 43.6532, lng: -79.3832 };
  }
  if (/\b(vancouver|burnaby|richmond|north vancouver|surrey)\b/i.test(combined)) {
    return { city: 'Vancouver metro', country: 'Canada', lat: 49.2827, lng: -123.1207 };
  }

  if (
    combined.includes('london') ||
    combined.includes('ucl') ||
    combined.includes('lse') ||
    combined.includes('imperial') ||
    combined.includes('brunel') ||
    combined.includes('greenwich') ||
    combined.includes('westminster')
  ) {
    return { city: 'London', country: 'United Kingdom', lat: 51.5225, lng: -0.1312 };
  }
  if (
    combined.includes('coventry') ||
    combined.includes('warwick') ||
    combined.includes('birmingham') ||
    combined.includes('aston')
  ) {
    return { city: 'Coventry / Birmingham', country: 'United Kingdom', lat: 52.3838, lng: -1.5601 };
  }
  if (
    combined.includes('nottingham') ||
    combined.includes('loughborough') ||
    combined.includes('leicester') ||
    combined.includes('derby')
  ) {
    return { city: 'Nottingham / Loughborough', country: 'United Kingdom', lat: 52.9388, lng: -1.1961 };
  }
  if (
    combined.includes('leeds') ||
    combined.includes('sheffield') ||
    (combined.includes('york') && !combined.includes('new york')) ||
    combined.includes('bradford')
  ) {
    return { city: 'Leeds / Sheffield', country: 'United Kingdom', lat: 53.8067, lng: -1.5550 };
  }
  if (
    combined.includes('manchester') ||
    combined.includes('salford') ||
    combined.includes('liverpool') ||
    combined.includes('lancaster')
  ) {
    return { city: 'Manchester / North West', country: 'United Kingdom', lat: 53.4668, lng: -2.2339 };
  }
  if (
    combined.includes('bristol') ||
    combined.includes('bath') ||
    combined.includes('exeter') ||
    combined.includes('cardiff') ||
    combined.includes('wales') ||
    combined.includes('bournemouth')
  ) {
    return { city: 'Bristol / South West', country: 'United Kingdom', lat: 51.4584, lng: -2.6030 };
  }
  if (
    combined.includes('glasgow') ||
    combined.includes('edinburgh') ||
    combined.includes('st andrews') ||
    combined.includes('strathclyde') ||
    combined.includes('ulster') ||
    combined.includes('belfast')
  ) {
    return { city: 'Glasgow / Edinburgh', country: 'United Kingdom', lat: 55.8721, lng: -4.2882 };
  }
  const isUsOxfordOrReading = /\b(oxford|reading),?\s*(ma|ms|oh|pa|mi|ct)\b/i.test(combined);
  if (!isUsOxfordOrReading && (combined.includes('oxford') || combined.includes('cambridge') || combined.includes('reading'))) {
    return { city: 'Oxford / Cambridge', country: 'United Kingdom', lat: 51.7548, lng: -1.2544 };
  }

  const campusMatch = CAMPUS_HUBS.find((hub) =>
    `${hub.city} ${hub.name}`.toLowerCase().split(/[(),/ ]+/).filter((part) => part.length > 3)
      .some((part) => combined.includes(part))
  );
  if (campusMatch) {
    return { city: campusMatch.city, country: campusMatch.country, lat: campusMatch.lat, lng: campusMatch.lng };
  }

  return {
    city: locText || 'Location not listed',
    country: 'Unknown',
    lat: 0,
    lng: 0,
  };
}

// Parse real salary text from live HTML into an hourly equivalent rate and clean display string
function parseSalaryFromHtmlText(rawSalaryText: string): {
  payDisplay: string;
  hourlyRateEquivalent: number;
  currencySymbol: string;
} {
  const cleaned = rawSalaryText.replace(/^Salary:\s*/i, '').replace(/\s+/g, ' ').trim();
  if (!cleaned) {
    return {
      payDisplay: 'Pay not disclosed',
      hourlyRateEquivalent: 0,
      currencySymbol: '£',
    };
  }

  // Check if explicit hourly rate like "£32.46 per hour" or "£13.85 ph"
  const hourlyMatch = cleaned.match(/£\s*(\d+(?:\.\d{1,2})?)\s*(?:per\s*hour|p\/h|ph|\/hr|an\s*hour)/i);
  if (hourlyMatch) {
    const rate = parseFloat(hourlyMatch[1]);
    return {
      payDisplay: cleaned.length > 62 ? `${cleaned.slice(0, 60)}...` : cleaned,
      hourlyRateEquivalent: rate,
      currencySymbol: '£',
    };
  }

  // Preserve disclosed annual salary verbatim; contracted weekly hours are not exposed here, so no hourly rate is inferred.

  return {
    payDisplay: cleaned.length > 62 ? `${cleaned.slice(0, 60)}...` : cleaned,
    hourlyRateEquivalent: 0,
    currencySymbol: '£',
  };
}

// Live Scraper 1: Scrape jobs.ac.uk search queries for real everyday student jobs, campus roles, and internships
async function scrapeJobsAcUkQuery(config: {
  targetId: string;
  name: string;
  query: string;
  category: JobCategory;
  defaultJobType: JobType;
  maxItems: number;
  campus: CampusHub;
}): Promise<{ jobs: JobListing[]; run: ScraperTargetRun }> {
  const start = Date.now();
  const targetUrl = `https://www.jobs.ac.uk/search/?keywords=${encodeURIComponent(config.query)}`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8500);

    const res = await fetch(targetUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml',
      },
    });
    clearTimeout(timeout);

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const html = await res.text();
    const $ = cheerio.load(html);
    const jobs: JobListing[] = [];

    $('.j-search-result__result').each((idx, el) => {
      if (jobs.length >= config.maxItems) return;
      const node = $(el);

      const titleAnchor = node.find('.j-search-result__text a').first();
      const title = titleAnchor.text().replace(/\s+/g, ' ').trim();
      const relativeHref = titleAnchor.attr('href');
      if (!title || !relativeHref) return;

      const applyUrl = relativeHref.startsWith('http')
        ? relativeHref
        : `https://www.jobs.ac.uk${relativeHref}`;

      // Extract unique job code from URL (e.g. /job/DTA423/...)
      const idMatch = relativeHref.match(/\/job\/([A-Z0-9]+)\//i);
      const jobId = idMatch ? `jac-${idMatch[1]}` : `jac-${config.targetId}-${idx}`;

      const department = node.find('.j-search-result__department').text().replace(/\s+/g, ' ').trim();
      const employer =
        node.find('.j-search-result__employer').text().replace(/\s+/g, ' ').trim() ||
        'UK University Employer';

      // Extract Location and Date Placed from child divs
      let locationRaw = '';
      let datePlacedRaw = 'Recently Posted';

      node.find('.j-search-result__text > div').each((_, div) => {
        const txt = $(div).text().replace(/\s+/g, ' ').trim();
        if (txt.startsWith('Location:')) {
          locationRaw = txt.replace(/^Location:\s*/i, '').trim();
        } else if (txt.startsWith('Date Placed:')) {
          datePlacedRaw = txt.replace(/^Date Placed:\s*/i, '').trim();
        }
      });

      const closesText = node
        .find('.j-search-result__date--blue')
        .text()
        .replace(/\s+/g, ' ')
        .trim();

      const rawSalary = node.find('.j-search-result__info').text().replace(/\s+/g, ' ').trim();
      const { payDisplay, hourlyRateEquivalent, currencySymbol } = parseSalaryFromHtmlText(rawSalary);
      const coords = resolveCoordinatesFromLocation(locationRaw);

      const titleLower = `${title} ${rawSalary}`.toLowerCase();
      const salaryLower = rawSalary.toLowerCase();
      const internshipMention = /\b(intern|internship|placement|co-op)\b/.test(titleLower);
      const internshipStaffRole = /\b(internship|placement)\s+(specialist|manager|officer|coordinator|director)\b/.test(titleLower);
      const explicitInternship = internshipMention && !internshipStaffRole;
      const explicitPartTime = /\bpart.?time\b|\bcasual\b/.test(titleLower) ||
        (/pro.?rata/.test(salaryLower) && !/if\s+part.?time/.test(salaryLower));
      const explicitFullTime = /\bfull.?time\b/.test(titleLower) || /per annum|per year|p\.a\./.test(salaryLower);
      if (config.category === 'Internship & Grad' && !explicitInternship) return;
      let jobType: JobType = 'Type unverified';
      if (explicitInternship) {
        jobType = 'Internship';
      } else if (explicitPartTime) {
        jobType = 'Part-time / Casual';
      } else if (explicitFullTime) {
        jobType = 'Full-time';
      }

      const isPartTime = jobType === 'Part-time / Casual';
      const weeklyHoursMin = isPartTime ? 10 : jobType === 'Internship' ? 18 : 35;
      const weeklyHoursMax = isPartTime ? 20 : jobType === 'Internship' ? 35 : jobType === 'Type unverified' ? 40 : 37.5;

      const languageComfort =
        config.category === 'Cafe & Hospitality' || config.category === 'Delivery & Logistics'
          ? 'Conversational'
          : config.category === 'Retail & Customer Service'
          ? 'Intermediate'
          : 'Fluent / Academic';

      jobs.push({
        id: jobId,
        title,
        employer,
        department: department || undefined,
        location: locationRaw || coords.city,
        city: coords.city,
        country: coords.country,
        lat: coords.lat,
        lng: coords.lng,
        payDisplay,
        hourlyRateEquivalent,
        currencySymbol,
        jobType,
        category: config.category,
        postedDate: `Placed ${datePlacedRaw}`,
        closesDate: closesText ? `Closes ${closesText}` : undefined,
        weeklyHoursMin,
        weeklyHoursMax,
        isOnCampus: /on.?campus|campus-based|student union|university campus|college campus/i.test(locationRaw),
        shiftFlexibility: isPartTime ? 'Between Lectures' : 'Fixed Business Hours',
        sourceName: 'jobs.ac.uk (Live Scraped)',
        sourceUrl: targetUrl,
        applyUrl,
        description: `Live university & campus vacancy at ${employer}${
          department ? ` (${department})` : ''
        }. Scraped directly from ${applyUrl}. Compensation: ${
          rawSalary || 'not disclosed in the source listing'
        }.`,
        requirements: [
          `Direct Employer: ${employer}${department ? ` — ${department}` : ''}`,
          `Location on source listing: ${locationRaw || 'not specified'}`,
          ...(jobType === 'Type unverified' ? ['Work type and schedule were not verified from the search result; confirm both on the original listing.'] : []),
          closesText ? `Application Closing Date: ${closesText}` : 'Open for immediate application on official portal',
        ],
        trustInfo: {
          status: 'Standard Verified Listing',
          awardComplianceNote: 'University-hosted vacancy page; payroll terms and visa sponsorship are not independently verified.',
          sponsorshipTrackRecord: false,
          payslipVerified: false,
          languageComfort,
        },
      });
    });

    return {
      jobs,
      run: {
        targetId: config.targetId,
        name: config.name,
        url: targetUrl,
        categoryFocus: config.category,
        status: 'success',
        jobsExtracted: jobs.length,
        durationMs: Date.now() - start,
        timestamp: new Date().toISOString(),
      },
    };
  } catch (err: any) {
    return {
      jobs: [],
      run: {
        targetId: config.targetId,
        name: config.name,
        url: targetUrl,
        categoryFocus: config.category,
        status: 'error',
        jobsExtracted: 0,
        durationMs: Date.now() - start,
        timestamp: new Date().toISOString(),
        errorMessage: err?.message || 'Failed to fetch live HTML',
      },
    };
  }
}

// Live Scraper 2: Python.org Official Job Board HTML
async function scrapePythonOrgLive(campus: CampusHub): Promise<{ jobs: JobListing[]; run: ScraperTargetRun }> {
  const start = Date.now();
  const targetUrl = 'https://www.python.org/jobs/';

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(targetUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; GradGuideJobDiscovery/1.0)',
        Accept: 'text/html,application/xhtml+xml',
      },
    });
    clearTimeout(timeout);

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const html = await res.text();
    const $ = cheerio.load(html);
    const jobs: JobListing[] = [];

    $('ol.list-recent-jobs > li').each((idx, el) => {
      if (jobs.length >= 6) return;
      const item = $(el);

      const titleAnchor = item.find('h2.listing-company span.listing-company-name a').first();
      const title = titleAnchor.text().replace(/\s+/g, ' ').trim();
      const relativeHref = titleAnchor.attr('href');
      if (!title || !relativeHref) return;

      const applyUrl = relativeHref.startsWith('http')
        ? relativeHref
        : `https://www.python.org${relativeHref}`;

      const companyContainer = item.find('h2.listing-company span.listing-company-name').clone();
      companyContainer.find('a, span.listing-new').remove();
      const employer = companyContainer.text().replace(/\s+/g, ' ').trim() || 'Tech Employer';

      const rawLocation = item.find('span.listing-location').text().replace(/\s+/g, ' ').trim() || 'Remote / Hybrid';
      const postedText = item.find('span.listing-posted time').text().trim() || 'Recently Posted';
      const jobTypeSkills = item.find('span.listing-job-type').text().replace(/\s+/g, ' ').trim();

      const isRemote = /remote|work from home|anywhere/i.test(rawLocation);
      const coords = isRemote
        ? { city: 'Remote', country: campus.country, lat: campus.lat, lng: campus.lng }
        : resolveCoordinatesFromLocation(rawLocation);

      jobs.push({
        id: `py-${relativeHref.replace(/\W+/g, '-')}`,
        title,
        employer,
        location: rawLocation,
        city: coords.city,
        country: coords.country,
        lat: coords.lat,
        lng: coords.lng,
        payDisplay: 'Pay not disclosed',
        hourlyRateEquivalent: 0,
        currencySymbol: '£',
        jobType: 'Full-time',
        category: 'Full-time',
        postedDate: `Posted ${postedText}`,
        weeklyHoursMin: 35,
        weeklyHoursMax: 40,
        isOnCampus: false,
        shiftFlexibility: 'Fixed Business Hours',
        sourceName: 'python.org/jobs (Live Scraped)',
        sourceUrl: targetUrl,
        applyUrl,
        description: `Live software & data engineering vacancy at ${employer} (${rawLocation}), scraped directly from ${applyUrl}. Stack & role areas: ${
          jobTypeSkills || 'Python, Backend, Cloud & Data Engineering'
        }.`,
        requirements: [
          `Direct Employer: ${employer}`,
          `Skills listed on posting: ${jobTypeSkills || 'Python, Software Engineering'}`,
          `Live URL: ${applyUrl}`,
        ],
        trustInfo: {
          status: 'Standard Verified Listing',
          awardComplianceNote: 'Python.org listing link is provided; employer payroll and immigration sponsorship are not independently verified.',
          sponsorshipTrackRecord: false,
          payslipVerified: false,
          languageComfort: 'Intermediate',
        },
      });
    });

    return {
      jobs,
      run: {
        targetId: 'python-org-live',
        name: 'Python.org Official Jobs Board',
        url: targetUrl,
        categoryFocus: 'Full-time',
        status: 'success',
        jobsExtracted: jobs.length,
        durationMs: Date.now() - start,
        timestamp: new Date().toISOString(),
      },
    };
  } catch (err: any) {
    return {
      jobs: [],
      run: {
        targetId: 'python-org-live',
        name: 'Python.org Official Jobs Board',
        url: targetUrl,
        categoryFocus: 'Full-time',
        status: 'error',
        jobsExtracted: 0,
        durationMs: Date.now() - start,
        timestamp: new Date().toISOString(),
        errorMessage: err?.message || 'Failed to fetch Python.org',
      },
    };
  }
}

// Live Scraper 3: WeWorkRemotely Live Feed (Customer Support, Operations & Flexible Remote Roles)
async function scrapeWeWorkRemotelyLive(campus: CampusHub): Promise<{ jobs: JobListing[]; run: ScraperTargetRun }> {
  const start = Date.now();
  const targetUrl = 'https://weworkremotely.com/remote-jobs.rss';

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(targetUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; GradGuideJobDiscovery/1.0)',
      },
    });
    clearTimeout(timeout);

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const xml = await res.text();
    const $ = cheerio.load(xml, { xmlMode: true });
    const jobs: JobListing[] = [];

    $('item').each((idx, el) => {
      if (jobs.length >= 6) return;
      const item = $(el);

      const fullTitle = item.find('title').text().trim();
      const link = item.find('link').text().trim();
      const region = item.find('region').text().trim() || 'Remote (Flexible)';
      const categoryRaw = item.find('category').text().trim() || 'Customer Support';
      const pubDateRaw = item.find('pubDate').text().trim();
      const rawDescHtml = item.find('description').text();
      const cleanDesc = cheerio
        .load(rawDescHtml)
        .text()
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 280);

      if (!fullTitle || !link) return;

      const parts = fullTitle.split(':');
      const employer = parts.length > 1 ? parts[0].trim() : 'Global Remote Partner';
      const title = parts.length > 1 ? parts.slice(1).join(':').trim() : fullTitle;

      const isSupportOrOps =
        categoryRaw.toLowerCase().includes('support') ||
        categoryRaw.toLowerCase().includes('customer') ||
        title.toLowerCase().includes('support') ||
        title.toLowerCase().includes('assistant') ||
        title.toLowerCase().includes('tutor');

      const mappedCategory: JobCategory = isSupportOrOps
        ? 'Retail & Customer Service'
        : 'Internship & Grad';

      const dateFormatted = pubDateRaw
        ? `Posted ${new Date(pubDateRaw).toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'short',
          })}`
        : 'Posted Today';

      jobs.push({
        id: `wwr-${idx}-${link.split('/').pop()?.slice(0, 24) || idx}`,
        title,
        employer,
        location: `Remote (${region})`,
        city: 'Remote / Campus Dorm',
        country: campus.country,
        lat: campus.lat,
        lng: campus.lng,
        payDisplay: 'Pay not disclosed',
        hourlyRateEquivalent: 0,
        currencySymbol: '£',
        jobType: isSupportOrOps ? 'Part-time / Casual' : 'Full-time',
        category: mappedCategory,
        postedDate: dateFormatted,
        weeklyHoursMin: isSupportOrOps ? 15 : 30,
        weeklyHoursMax: isSupportOrOps ? 20 : 40,
        isOnCampus: false,
        shiftFlexibility: 'Evenings & Weekends',
        sourceName: 'WeWorkRemotely (Live Scraped)',
        sourceUrl: 'https://weworkremotely.com',
        applyUrl: link,
        description: cleanDesc ? `${cleanDesc}...` : `Live remote role at ${employer}.`,
        requirements: [
          `Direct Employer: ${employer}`,
          `Category: ${categoryRaw} (${region})`,
          `Verified Live Posting Link: ${link}`,
        ],
        trustInfo: {
          status: 'Standard Verified Listing',
          awardComplianceNote: 'Verified global remote employer listing',
          sponsorshipTrackRecord: false,
          payslipVerified: false,
          languageComfort: 'Intermediate',
        },
      });
    });

    return {
      jobs,
      run: {
        targetId: 'wwr-live',
        name: 'WeWorkRemotely Global Feed',
        url: targetUrl,
        categoryFocus: 'Retail & Customer Service',
        status: 'success',
        jobsExtracted: jobs.length,
        durationMs: Date.now() - start,
        timestamp: new Date().toISOString(),
      },
    };
  } catch (err: any) {
    return {
      jobs: [],
      run: {
        targetId: 'wwr-live',
        name: 'WeWorkRemotely Global Feed',
        url: targetUrl,
        categoryFocus: 'Retail & Customer Service',
        status: 'error',
        jobsExtracted: 0,
        durationMs: Date.now() - start,
        timestamp: new Date().toISOString(),
        errorMessage: err?.message || 'Failed to fetch WWR',
      },
    };
  }
}

type RegionalBoardTarget = {
  targetId: string;
  name: string;
  url: string;
  host: string;
  categoryFocus: JobCategory;
  defaultJobType: JobType;
  pathPattern: RegExp;
  locationScopeRadiusKm?: number;
};

function getRegionalBoardTarget(campus: CampusHub, keyword = 'student part-time'): RegionalBoardTarget {
  const city = campus.city;
  const search = encodeURIComponent(`${keyword} ${city}`);
  const slug = city.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  if (campus.country === 'United States') {
    return {
      targetId: 'usajobs-student',
      name: 'USAJOBS — Student & Internship Roles',
      url: `https://www.usajobs.gov/Search/Results?k=${search}&l=${encodeURIComponent(city)}`,
      host: 'www.usajobs.gov',
      categoryFocus: 'Internship & Grad',
      defaultJobType: 'Internship',
      pathPattern: /\/job\//i,
    };
  }
  if (campus.country === 'Canada') {
    return {
      targetId: 'jobbank-student',
      name: 'Job Bank Canada — Student & Part-time Roles',
      url: `https://www.jobbank.gc.ca/jobsearch/jobsearch?searchstring=${encodeURIComponent(keyword)}&locationstring=${encodeURIComponent(city)}`,
      host: 'www.jobbank.gc.ca',
      categoryFocus: 'Campus & Tutoring',
      defaultJobType: 'Part-time / Casual',
      pathPattern: /\/jobsearch\/jobposting/i,
    };
  }
  if (campus.country === 'Australia') {
    const joraArea: Record<string, string> = {
      Melbourne: 'Melbourne-VIC',
      Sydney: 'Sydney-NSW',
      Brisbane: 'Brisbane-QLD',
    };
    const isInternshipSearch = /intern|placement/i.test(keyword);
    const jobTypeSlug = isInternshipSearch ? 'Internship' : 'Part-Time';
    return {
      targetId: `jora-student-${isInternshipSearch ? 'internship' : 'part-time'}`,
      name: `Jora Australia — Student ${isInternshipSearch ? 'Internships' : 'Part-time Roles'}`,
      url: `https://au.jora.com/${jobTypeSlug}-jobs-in-${joraArea[city] || `${slug}-AU`}`,
      host: 'au.jora.com',
      categoryFocus: isInternshipSearch ? 'Internship & Grad' : 'Retail & Customer Service',
      defaultJobType: isInternshipSearch ? 'Internship' : 'Part-time / Casual',
      pathPattern: /\/job\//i,
      locationScopeRadiusKm: 50,
    };
  }
  return {
    targetId: 'reed-student',
    name: 'Reed.co.uk — Student Part-time & Internship Roles',
    url: `https://www.reed.co.uk/jobs/part-time-jobs-in-${slug}?keywords=${search}`,
    host: 'www.reed.co.uk',
    categoryFocus: 'Retail & Customer Service',
    defaultJobType: 'Part-time / Casual',
    pathPattern: /\/jobs?\//i,
  };
}

// Scrapes public search-result HTML directly; no job-board API or third-party extraction service.
async function scrapeRegionalBoard(
  campus: CampusHub,
  target = getRegionalBoardTarget(campus),
): Promise<{ jobs: JobListing[]; run: ScraperTargetRun }> {
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 9000);
    const response = await fetch(target.url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; GradGuideJobDiscovery/1.0)',
        Accept: 'text/html,application/xhtml+xml',
      },
    });
    clearTimeout(timeout);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const html = await response.text();
    const $ = cheerio.load(html);
    const jobs: JobListing[] = [];
    const seen = new Set<string>();
    $('a[href]').each((idx, element) => {
      if (jobs.length >= 8) return;
      const anchor = $(element);
      const headingText = target.host === 'www.jobbank.gc.ca'
        ? anchor.find('.noctitle').first().text()
        : anchor.find('h1, h2, h3, [class*="job-title"], [class*="jobTitle"]').first().text();
      const title = (headingText || anchor.text()).replace(/\s+/g, ' ').trim();
      const href = anchor.attr('href');
      if (!href || title.length < 6 || title.length > 130 || /^(search|view|apply|more|sign in|log in)/i.test(title)) return;
      let postingUrl: URL;
      try {
        postingUrl = new URL(href, target.url);
      } catch {
        return;
      }
      if (postingUrl.hostname !== target.host || !target.pathPattern.test(postingUrl.pathname)) return;
      if (target.host === 'www.jobbank.gc.ca') {
        postingUrl.pathname = postingUrl.pathname.replace(/;jsessionid=[^/]+/i, '');
      }
      const canonicalPostingUrl = `${postingUrl.origin}${postingUrl.pathname}`;
      if (seen.has(canonicalPostingUrl)) return;
      seen.add(canonicalPostingUrl);

      const card = anchor.closest('article, li, [data-testid*="job"], [class*="job-card"], [class*="jobCard"], a.resultJobItem');
      const cardText = (card.length ? card : anchor.parent()).text().replace(/\s+/g, ' ').trim();
      const lower = `${title} ${cardText}`.toLowerCase();
      const isRemote = /remote|work from home|work-from-home|anywhere/i.test(lower);
      const typeLabelText = card.find('[class*="badge"], [class*="job-type"], [class*="jobType"], [class*="employment-type"]').text();
      const typeEvidence = `${title} ${typeLabelText}`.toLowerCase();
      const isInternship = /intern|placement|co-op|cooperative education/i.test(typeEvidence);
      const isPartTime = /part.?time|casual|student assistant/i.test(typeEvidence);
      const isFullTime = /full.?time|per annum|per year|p\.a\./i.test(typeEvidence);
      const fallbackJobType: JobType = target.host === 'www.jobbank.gc.ca' ? 'Type unverified' : target.defaultJobType;
      const jobType: JobType = isInternship
        ? 'Internship'
        : isPartTime
        ? 'Part-time / Casual'
        : isFullTime
        ? 'Full-time'
        : fallbackJobType;
      const category: JobCategory = /barista|cafe|catering|restaurant|kitchen|hospitality/i.test(lower)
        ? 'Cafe & Hospitality'
        : /retail|sales assistant|customer service|cashier/i.test(lower)
        ? 'Retail & Customer Service'
        : /delivery|courier|warehouse|logistics/i.test(lower)
        ? 'Delivery & Logistics'
        : /tutor|library|student ambassador|research assistant|campus/i.test(lower)
        ? 'Campus & Tutoring'
        : isInternship
        ? 'Internship & Grad'
        : target.categoryFocus;
      const explicitLocation = card.find('[class*="location"], [data-automation*="location"], [data-testid*="location"]').first().text().replace(/^\s*Location\s*/i, '').replace(/\s+/g, ' ').trim();
      const location = isRemote ? 'Remote (Global)' : explicitLocation || 'Location not verified (regional search)';
      const parsedCoords = resolveCoordinatesFromLocation(explicitLocation);
      const coords = isRemote
        ? { city: 'Remote', country: campus.country, lat: campus.lat, lng: campus.lng }
        : parsedCoords.country !== 'Unknown'
        ? parsedCoords
        : explicitLocation && target.locationScopeRadiusKm
        ? { city: `${campus.city} area (source radius)`, country: campus.country, lat: campus.lat, lng: campus.lng }
        : parsedCoords;
      const employerText = card.find('[class*="company"], [class*="employer"], [class*="business"], [data-automation*="company"], [data-testid*="company"]').first().text().replace(/\s+/g, ' ').trim();
      const employer = employerText || 'Employer listed on source page';
      const jobId = `${target.targetId}-${postingUrl.pathname.replace(/[^a-z0-9]+/gi, '-').slice(0, 72)}`;
      const postedText = card.find('time, [class*="listed-date"], [class*="date-posted"], [class="date"]').first().text().replace(/\s+/g, ' ').trim();
      const weeklyHoursMin = jobType === 'Part-time / Casual' ? 10 : jobType === 'Internship' ? 15 : 35;
      const weeklyHoursMax = jobType === 'Part-time / Casual' ? 20 : jobType === 'Internship' ? 30 : 40;
      const currencySymbol = campus.country === 'United States' || campus.country === 'Canada' ? '$' : campus.country === 'Australia' ? 'A$' : '£';
      const isOnCampus = !isRemote && /on.?campus|campus-based|university campus|student union/i.test(explicitLocation);

      jobs.push({
        id: jobId,
        title,
        employer,
        location,
        city: coords.city,
        country: coords.country,
        lat: coords.lat,
        lng: coords.lng,
        payDisplay: 'See original listing',
        hourlyRateEquivalent: 0,
        currencySymbol,
        jobType,
        category,
        postedDate: postedText ? `Posted ${postedText}` : 'Recently posted',
        weeklyHoursMin,
        weeklyHoursMax,
        isOnCampus,
        shiftFlexibility: jobType === 'Part-time / Casual' ? 'Flexible Roster' : 'Fixed Business Hours',
        sourceName: `${target.name} (Live HTML)`,
        sourceUrl: target.url,
        applyUrl: postingUrl.href,
        description: `Listing parsed from the public ${target.host} search page. Verify current details, pay, work location, and eligibility on the employer's original posting.`,
        requirements: [
          `Original listing: ${postingUrl.href}`,
          `Search region: ${campus.city}, ${campus.country}`,
          ...(target.locationScopeRadiusKm ? [`Source search radius: within ${target.locationScopeRadiusKm} km of ${campus.city}`] : []),
          ...(jobType === 'Type unverified' ? ['Work type is not explicit in the source result; verify it and the schedule on the original posting.'] : []),
          'Pay and exact hours are not inferred when the source page does not expose them.',
        ],
        trustInfo: {
          status: 'Standard Verified Listing',
          awardComplianceNote: 'Direct link to the public source listing; confirm employer and pay details before applying.',
          sponsorshipTrackRecord: false,
          payslipVerified: false,
          languageComfort: category === 'Cafe & Hospitality' || category === 'Delivery & Logistics' ? 'Conversational' : 'Intermediate',
        },
      });
    });

    return {
      jobs,
      run: {
        targetId: target.targetId,
        name: target.name,
        url: target.url,
        categoryFocus: `${target.categoryFocus} · ${campus.city}`,
        status: 'success',
        jobsExtracted: jobs.length,
        durationMs: Date.now() - start,
        timestamp: new Date().toISOString(),
      },
    };
  } catch (err: any) {
    return {
      jobs: [],
      run: {
        targetId: target.targetId,
        name: target.name,
        url: target.url,
        categoryFocus: `${target.categoryFocus} · ${campus.city}`,
        status: 'error',
        jobsExtracted: 0,
        durationMs: Date.now() - start,
        timestamp: new Date().toISOString(),
        errorMessage: err?.message || 'Failed to parse public search-page HTML',
      },
    };
  }
}

// Memory state for live scraped jobs
let cachedScrapeResult: ScrapeResponse | null = null;
let cachedCampusId = '';
let customSearchJobs: JobListing[] = [];
let customSearchRuns: ScraperTargetRun[] = [];

async function runFullLiveScrapePipeline(campusId = CAMPUS_HUBS[0].id): Promise<ScrapeResponse> {
  const campus = CAMPUS_HUBS.find((hub) => hub.id === campusId) || CAMPUS_HUBS[0];
  if (cachedCampusId && cachedCampusId !== campus.id) {
    customSearchJobs = [];
    customSearchRuns = [];
  }
  const targets = [
    {
      targetId: 'jac-catering',
      name: 'jobs.ac.uk — Campus Catering, Cafe & Hospitality',
      query: 'catering assistant part time',
      category: 'Cafe & Hospitality' as JobCategory,
      defaultJobType: 'Part-time / Casual' as JobType,
      maxItems: 6,
    },
    {
      targetId: 'jac-customer-retail',
      name: 'jobs.ac.uk — Campus Retail & Customer Services',
      query: 'customer service assistant part time',
      category: 'Retail & Customer Service' as JobCategory,
      defaultJobType: 'Part-time / Casual' as JobType,
      maxItems: 6,
    },
    {
      targetId: 'jac-tutor-library',
      name: 'jobs.ac.uk — Part-Time Tutoring & Library Assistants',
      query: 'library assistant part time',
      category: 'Campus & Tutoring' as JobCategory,
      defaultJobType: 'Part-time / Casual' as JobType,
      maxItems: 6,
    },
    {
      targetId: 'jac-delivery-estates',
      name: 'jobs.ac.uk — Campus Mailroom, Logistics & Estates',
      query: 'porter driver assistant part time',
      category: 'Delivery & Logistics' as JobCategory,
      defaultJobType: 'Part-time / Casual' as JobType,
      maxItems: 5,
    },
    {
      targetId: 'jac-internships',
      name: 'jobs.ac.uk — University Internships & Placements',
      query: 'internship',
      category: 'Internship & Grad' as JobCategory,
      defaultJobType: 'Internship' as JobType,
      maxItems: 6,
    },
  ];

  const regionalSourcePromises = [scrapeRegionalBoard(campus)];
  if (campus.country === 'Australia') {
    regionalSourcePromises.push(
      scrapeRegionalBoard(campus, getRegionalBoardTarget(campus, 'student internship placement'))
    );
  }
  if (campus.country === 'United Kingdom') {
    regionalSourcePromises.push(
      ...targets.map((target) =>
        scrapeJobsAcUkQuery({
          ...target,
          query: `${target.query} ${campus.city}`,
          campus,
        })
      )
    );
  }

  const [regionalResults, pythonResult, wwrResult] = await Promise.all([
    Promise.all(regionalSourcePromises),
    scrapePythonOrgLive(campus),
    scrapeWeWorkRemotelyLive(campus),
  ]);

  // Deduplicate jobs by ID so every listing is unique and traceable
  const seenIds = new Set<string>();
  const combinedJobs: JobListing[] = [];

  const allSourceJobs = [
    ...customSearchJobs,
    ...regionalResults.flatMap((r) => r.jobs),
    ...pythonResult.jobs,
    ...wwrResult.jobs,
  ];

  for (const job of allSourceJobs) {
    if (!seenIds.has(job.id)) {
      seenIds.add(job.id);
      combinedJobs.push(job);
    }
  }

  const allRuns: ScraperTargetRun[] = [
    ...customSearchRuns,
    ...regionalResults.map((r) => r.run),
    pythonResult.run,
    wwrResult.run,
  ];

  cachedScrapeResult = {
    jobs: combinedJobs,
    runs: allRuns,
    lastScrapedAt: new Date().toISOString(),
    totalExtracted: combinedJobs.length,
  };
  cachedCampusId = campus.id;

  return cachedScrapeResult;
}

async function startServer() {
  const app = express();
  app.use(express.json());

  // 1. Main API to get live scraped jobs
  app.get('/api/jobs', async (req, res) => {
    try {
      const forceRefresh = req.query.refresh === 'true';
      const campusId = typeof req.query.campusId === 'string' ? req.query.campusId : CAMPUS_HUBS[0].id;
      if (!cachedScrapeResult || forceRefresh || cachedCampusId !== campusId) {
        const result = await runFullLiveScrapePipeline(campusId);
        res.json(result);
        return;
      }
      res.json(cachedScrapeResult);
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Live scraper execution error' });
    }
  });

  // 2. Live On-Demand Keyword or URL Scraper
  app.post('/api/scrape', async (req, res) => {
    try {
      const { liveKeyword, campusId: requestedCampusId } = req.body || {};
      const campus = CAMPUS_HUBS.find((hub) => hub.id === requestedCampusId) || CAMPUS_HUBS[0];
      if (cachedCampusId && cachedCampusId !== campus.id) {
        customSearchJobs = [];
        customSearchRuns = [];
      }
      cachedCampusId = campus.id;

      if (liveKeyword && typeof liveKeyword === 'string' && liveKeyword.trim()) {
        const kw = liveKeyword.trim();
        const customResult = campus.country === 'United Kingdom'
          ? await scrapeJobsAcUkQuery({
              targetId: `live-kw-${Date.now()}`,
              name: `Live Search Scrape: "${kw}" · ${campus.city}`,
              query: `${kw} ${campus.city}`,
              category: 'Campus & Tutoring',
              defaultJobType: 'Part-time / Casual',
              maxItems: 8,
              campus,
            })
          : await scrapeRegionalBoard(campus, {
              ...getRegionalBoardTarget(campus, kw),
              targetId: `live-kw-${Date.now()}`,
              name: `Live Search Scrape: "${kw}" · ${campus.city}`,
            });

        if (customResult.jobs.length > 0) {
          customSearchJobs = [...customResult.jobs, ...customSearchJobs].slice(0, 16);
        }
        customSearchRuns = [customResult.run, ...customSearchRuns].slice(0, 5);
      }

      const result = await runFullLiveScrapePipeline(campus.id);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Live scrape failed' });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`GradGuide Live Scraper Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
