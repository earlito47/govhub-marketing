// Entity -> URL slug / display-title mapping.
// Phase 1 only covers the three pilot NAICS codes; agency/state maps are added
// when those page types are built (Section 8 of the spec).

// Official 2022 NAICS titles (Census Bureau classification — not sourced from
// USAspending, so this is independent of the live-API verification blocker).
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

// Related-page links must only point at entities that actually have a page.
// At this phase that's just the other pilot NAICS codes.
export function relatedNaicsLinks(code) {
  return PILOT_NAICS_CODES.filter((c) => c !== code).map((c) => ({
    label: `NAICS ${c}: ${naicsTitle(c)}`,
    href: naicsHref(c),
  }));
}
