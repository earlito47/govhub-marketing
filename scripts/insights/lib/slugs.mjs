// Entity -> URL slug / display-title mapping for every Insights page type.
// NAICS titles are the Census 2022 classification; agency names + slugs are the
// canonical strings from USAspending's /references/toptier_agencies/ endpoint
// (so the `agencies` filter matches exactly); state codes are USPS two-letter.

// ---- NAICS ----------------------------------------------------------------
// Census 2022 classification titles. Codes chosen for federal-contracting
// weight across the major buying families — IT/professional services (541),
// facilities/support (561), construction (23), defense manufacturing (334/336),
// and health (325/339/621). Every code was verified to return non-zero FY2026
// obligations live before being added.
export const NAICS_TITLES = {
  // Professional, scientific & technical services (541)
  '541511': 'Custom Computer Programming Services',
  '541512': 'Computer Systems Design Services',
  '541519': 'Other Computer Related Services',
  '541330': 'Engineering Services',
  '541715': 'Research and Development in the Physical, Engineering, and Life Sciences',
  '541611': 'Administrative Management and General Management Consulting Services',
  '541618': 'Other Management Consulting Services',
  '541690': 'Other Scientific and Technical Consulting Services',
  '541990': 'All Other Professional, Scientific, and Technical Services',
  '541380': 'Testing Laboratories',
  // Administrative & support services (561)
  '561210': 'Facilities Support Services',
  '561612': 'Security Guards and Patrol Services',
  '561720': 'Janitorial Services',
  '561110': 'Office Administrative Services',
  // Construction (23)
  '236220': 'Commercial and Institutional Building Construction',
  '237310': 'Highway, Street, and Bridge Construction',
  '238210': 'Electrical Contractors and Other Wiring Installation Contractors',
  // Defense & transportation-equipment manufacturing (334/336)
  '336411': 'Aircraft Manufacturing',
  '336412': 'Aircraft Engine and Engine Parts Manufacturing',
  '336611': 'Ship Building and Repairing',
  '334511': 'Search, Detection, Navigation, Guidance, Aeronautical, and Nautical System and Instrument Manufacturing',
  // Health & life sciences (325/339/621)
  '325412': 'Pharmaceutical Preparation Manufacturing',
  '339112': 'Surgical and Medical Instrument Manufacturing',
  '621511': 'Medical Laboratories',
  // Education & training (611)
  '611430': 'Professional and Management Development Training',
};

export const NAICS_CODES = Object.keys(NAICS_TITLES);
// Back-compat alias: the pipeline entry points still import this name.
export const PILOT_NAICS_CODES = NAICS_CODES;

export function naicsHref(code) {
  return `/insights/naics/${code}/`;
}

export function naicsTitle(code) {
  return NAICS_TITLES[code] ?? code;
}

export function relatedNaicsLinks(code, limit = 6) {
  // Prefer codes in the same 3-digit subsector (e.g. all 541xxx together), then
  // fill the rest from other families, so the block is relevant but capped.
  const prefix = code.slice(0, 3);
  const others = NAICS_CODES.filter((c) => c !== code);
  const sameFamily = others.filter((c) => c.slice(0, 3) === prefix);
  const rest = others.filter((c) => c.slice(0, 3) !== prefix);
  return [...sameFamily, ...rest].slice(0, limit).map((c) => ({
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

// ---- Set-aside programs (typeofsetaside) -----------------------------------
// slug -> program metadata. `codes` are the FPDS type-of-set-aside codes the
// USAspending `set_aside_type_codes` filter accepts (verified live 2026-07-13:
// each group returned non-zero FY2026 obligations). `name` is the full program
// name; `short`/`abbr` drive SERP titles and breadcrumbs.
export const SET_ASIDES = {
  '8a': {
    name: '8(a) Business Development',
    short: '8(a)',
    abbr: '8(a)',
    codes: ['8A', '8AN'],
    blurb:
      'contracts reserved for firms in the SBA 8(a) Business Development program (set-aside and sole-source)',
  },
  wosb: {
    name: 'Women-Owned Small Business',
    short: 'WOSB',
    abbr: 'WOSB',
    codes: ['WOSB', 'WOSBSS', 'EDWOSB', 'EDWOSBSS'],
    blurb:
      'contracts set aside for women-owned and economically disadvantaged women-owned small businesses (WOSB/EDWOSB)',
  },
  sdvosb: {
    name: 'Service-Disabled Veteran-Owned Small Business',
    short: 'SDVOSB',
    abbr: 'SDVOSB',
    codes: ['SDVOSBC', 'SDVOSBS'],
    blurb:
      'contracts set aside for service-disabled veteran-owned small businesses (set-aside and sole-source)',
  },
  hubzone: {
    name: 'HUBZone',
    short: 'HUBZone',
    abbr: 'HUBZone',
    codes: ['HZC', 'HZS'],
    blurb:
      'contracts set aside for firms certified in the SBA HUBZone program (set-aside and sole-source)',
  },
};

export const SET_ASIDE_SLUGS = Object.keys(SET_ASIDES);

export function setasideHref(slug) {
  return `/insights/set-aside/${slug}/`;
}

export function setaside(slug) {
  return SET_ASIDES[slug] ?? null;
}

export function setasideName(slug) {
  return SET_ASIDES[slug]?.name ?? slug;
}

export function relatedSetasideLinks(slug) {
  return SET_ASIDE_SLUGS.filter((s) => s !== slug).map((s) => ({
    label: `${SET_ASIDES[s].name} set-aside contracts`,
    href: setasideHref(s),
  }));
}
