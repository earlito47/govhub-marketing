// Entity -> URL slug / display-title mapping for every Insights page type.
// NAICS titles are the Census 2022 classification; agency names + slugs are the
// canonical strings from USAspending's /references/toptier_agencies/ endpoint
// (so the `agencies` filter matches exactly); state codes are USPS two-letter.

// ---- NAICS ----------------------------------------------------------------
export const NAICS_TITLES = {
  '541511': 'Custom Computer Programming Services',
  '541512': 'Computer Systems Design Services',
  '541519': 'Other Computer Related Services',
};

export const PILOT_NAICS_CODES = Object.keys(NAICS_TITLES);

export function naicsHref(code) {
  return `/insights/naics/${code}/`;
}

export function naicsTitle(code) {
  return NAICS_TITLES[code] ?? code;
}

export function relatedNaicsLinks(code) {
  return PILOT_NAICS_CODES.filter((c) => c !== code).map((c) => ({
    label: `NAICS ${c}: ${naicsTitle(c)}`,
    href: naicsHref(c),
  }));
}

// ---- Agencies (toptier) ---------------------------------------------------
// slug -> exact toptier `agency_name` accepted by the `agencies` filter.
// Military departments (Army/Navy/Air Force) are subtiers of Defense and are
// covered by the Department of Defense page (spec 8: "otherwise DoD only").
export const AGENCIES = {
  'department-of-defense': 'Department of Defense',
  'department-of-veterans-affairs': 'Department of Veterans Affairs',
  'department-of-homeland-security': 'Department of Homeland Security',
  'department-of-health-and-human-services': 'Department of Health and Human Services',
  'general-services-administration': 'General Services Administration',
  'national-aeronautics-and-space-administration': 'National Aeronautics and Space Administration',
  'department-of-energy': 'Department of Energy',
  'department-of-justice': 'Department of Justice',
  'department-of-state': 'Department of State',
  'department-of-the-treasury': 'Department of the Treasury',
  'department-of-agriculture': 'Department of Agriculture',
  'department-of-transportation': 'Department of Transportation',
  'department-of-the-interior': 'Department of the Interior',
  'department-of-commerce': 'Department of Commerce',
  'department-of-education': 'Department of Education',
};

export const AGENCY_SLUGS = Object.keys(AGENCIES);

// Common abbreviations — used in SERP titles (which the check-meta guard caps
// at 70 chars) and as high-value search keywords ("DoD contracts", "VA
// contracts"). H1s and body copy use the full agency name.
export const AGENCY_ABBR = {
  'department-of-defense': 'DoD',
  'department-of-veterans-affairs': 'VA',
  'department-of-homeland-security': 'DHS',
  'department-of-health-and-human-services': 'HHS',
  'general-services-administration': 'GSA',
  'national-aeronautics-and-space-administration': 'NASA',
  'department-of-energy': 'DOE',
  'department-of-justice': 'DOJ',
  'department-of-state': 'State Dept.',
  'department-of-the-treasury': 'Treasury',
  'department-of-agriculture': 'USDA',
  'department-of-transportation': 'DOT',
  'department-of-the-interior': 'Interior Dept.',
  'department-of-commerce': 'Commerce Dept.',
  'department-of-education': 'Education Dept.',
};

export function agencyAbbr(slug) {
  return AGENCY_ABBR[slug] ?? agencyShort(slug);
}

export function agencyHref(slug) {
  return `/insights/agency/${slug}/`;
}

export function agencyName(slug) {
  return AGENCIES[slug] ?? slug;
}

// A short label for titles/breadcrumbs (drops the leading "Department of ").
export function agencyShort(slug) {
  const name = agencyName(slug);
  return name.replace(/^Department of (the )?/, '');
}

export function relatedAgencyLinks(slug, limit = 6) {
  return AGENCY_SLUGS.filter((s) => s !== slug)
    .slice(0, limit)
    .map((s) => ({ label: agencyName(s), href: agencyHref(s) }));
}

// ---- States (place of performance) ----------------------------------------
// slug -> { name, code } where code is the USPS two-letter place-of-performance
// state code accepted by the `place_of_performance_locations` filter.
export const STATES = {
  alabama: { name: 'Alabama', code: 'AL' },
  alaska: { name: 'Alaska', code: 'AK' },
  arizona: { name: 'Arizona', code: 'AZ' },
  arkansas: { name: 'Arkansas', code: 'AR' },
  california: { name: 'California', code: 'CA' },
  colorado: { name: 'Colorado', code: 'CO' },
  connecticut: { name: 'Connecticut', code: 'CT' },
  delaware: { name: 'Delaware', code: 'DE' },
  'district-of-columbia': { name: 'District of Columbia', code: 'DC' },
  florida: { name: 'Florida', code: 'FL' },
  georgia: { name: 'Georgia', code: 'GA' },
  hawaii: { name: 'Hawaii', code: 'HI' },
  idaho: { name: 'Idaho', code: 'ID' },
  illinois: { name: 'Illinois', code: 'IL' },
  indiana: { name: 'Indiana', code: 'IN' },
  iowa: { name: 'Iowa', code: 'IA' },
  kansas: { name: 'Kansas', code: 'KS' },
  kentucky: { name: 'Kentucky', code: 'KY' },
  louisiana: { name: 'Louisiana', code: 'LA' },
  maine: { name: 'Maine', code: 'ME' },
  maryland: { name: 'Maryland', code: 'MD' },
  massachusetts: { name: 'Massachusetts', code: 'MA' },
  michigan: { name: 'Michigan', code: 'MI' },
  minnesota: { name: 'Minnesota', code: 'MN' },
  mississippi: { name: 'Mississippi', code: 'MS' },
  missouri: { name: 'Missouri', code: 'MO' },
  montana: { name: 'Montana', code: 'MT' },
  nebraska: { name: 'Nebraska', code: 'NE' },
  nevada: { name: 'Nevada', code: 'NV' },
  'new-hampshire': { name: 'New Hampshire', code: 'NH' },
  'new-jersey': { name: 'New Jersey', code: 'NJ' },
  'new-mexico': { name: 'New Mexico', code: 'NM' },
  'new-york': { name: 'New York', code: 'NY' },
  'north-carolina': { name: 'North Carolina', code: 'NC' },
  'north-dakota': { name: 'North Dakota', code: 'ND' },
  ohio: { name: 'Ohio', code: 'OH' },
  oklahoma: { name: 'Oklahoma', code: 'OK' },
  oregon: { name: 'Oregon', code: 'OR' },
  pennsylvania: { name: 'Pennsylvania', code: 'PA' },
  'rhode-island': { name: 'Rhode Island', code: 'RI' },
  'south-carolina': { name: 'South Carolina', code: 'SC' },
  'south-dakota': { name: 'South Dakota', code: 'SD' },
  tennessee: { name: 'Tennessee', code: 'TN' },
  texas: { name: 'Texas', code: 'TX' },
  utah: { name: 'Utah', code: 'UT' },
  vermont: { name: 'Vermont', code: 'VT' },
  virginia: { name: 'Virginia', code: 'VA' },
  washington: { name: 'Washington', code: 'WA' },
  'west-virginia': { name: 'West Virginia', code: 'WV' },
  wisconsin: { name: 'Wisconsin', code: 'WI' },
  wyoming: { name: 'Wyoming', code: 'WY' },
};

export const STATE_SLUGS = Object.keys(STATES);

export function stateHref(slug) {
  return `/insights/state/${slug}/`;
}

export function stateName(slug) {
  return STATES[slug]?.name ?? slug;
}

export function stateCode(slug) {
  return STATES[slug]?.code ?? null;
}

export function relatedStateLinks(slug, limit = 6) {
  return STATE_SLUGS.filter((s) => s !== slug)
    .slice(0, limit)
    .map((s) => ({ label: `${stateName(s)} federal contracts`, href: stateHref(s) }));
}
