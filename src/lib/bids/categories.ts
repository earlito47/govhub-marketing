// Bid categories for /bids/{category}/ and /bids/{category}/{state}/.
//
// Chosen from the SEO strategy's keyword clusters 3 and 5: the trades and
// services people search as "<category> bids" (janitorial, roofing, HVAC, lawn
// care, snow removal, construction) and the segments signing up (staffing,
// training, legal, specialty trades, manufacturing). Federal is mostly
// manufactured parts, so those get their own categories rather than one
// catch-all.
//
// A bid joins every category whose NAICS prefix matches its PRIMARY code (the
// source's published code, or the model's most confident guess; the runners-up
// put internet requests under construction), and every category whose keyword
// matches its TITLE. Titles only: summaries say things like "includes
// training" for an equipment buy, which would fill the training hub with
// noise. Order matters only for a bid's primary category (the first match),
// which picks its similar bids, so specific trades come before construction.
//
// Slugs must never equal a state slug or "federal": they share the
// /bids/{segment}/ namespace. load.ts asserts that at build time.

export interface BidCategory {
  slug: string;
  /** Plural noun phrase for "<name> bids". */
  name: string;
  naics: string[];
  keywords?: RegExp;
}

export const CATEGORIES: BidCategory[] = [
  { slug: 'janitorial', name: 'Janitorial and cleaning', naics: ['561720', '561740', '561790'], keywords: /\b(janitor\w*|custodial|cleaning|carpet clean\w*|window wash\w*|pressure wash\w*)\b/i },
  { slug: 'roofing', name: 'Roofing', naics: ['238160'], keywords: /\b(roof|roofs|roofing|re-?roof\w*)\b/i },
  // 238220 is "Plumbing, Heating, and Air-Conditioning Contractors", so it
  // belongs to both HVAC and plumbing.
  { slug: 'hvac', name: 'HVAC', naics: ['238220', '333415'], keywords: /\b(hvac|heating|air condition\w*|chiller\w*|boiler\w*|ventilation|ductwork)\b/i },
  { slug: 'plumbing', name: 'Plumbing', naics: ['238220'], keywords: /\b(plumbing|plumber\w*|backflow|water heater\w*)\b/i },
  { slug: 'electrical', name: 'Electrical', naics: ['238210'], keywords: /\b(electrical|electrician\w*|lighting|led retrofit|generator\w*)\b/i },
  { slug: 'painting', name: 'Painting', naics: ['238320'], keywords: /\b(painting|repaint\w*)\b/i },
  { slug: 'landscaping', name: 'Landscaping and lawn care', naics: ['561730'], keywords: /\b(landscap\w*|lawn\w*|mowing|grounds maintenance|tree (trimming|removal|services?)|turf)\b/i },
  { slug: 'snow-removal', name: 'Snow removal', naics: [], keywords: /\b(snow|de-?icing|salt(ing)? services?)\b/i },
  { slug: 'construction', name: 'Construction', naics: ['236', '237', '238'], keywords: /\b(construction|renovation\w*|paving|asphalt|concrete|bridge\w*|demolition|excavation|sitework|site work|resurfacing|sidewalk\w*)\b/i },
  { slug: 'engineering', name: 'Engineering and architecture', naics: ['54131', '54133', '54134', '54136', '54137'], keywords: /\b(engineering services|architect\w*|a\/e services|surveying|design services)\b/i },
  { slug: 'it-services', name: 'IT and software', naics: ['5415', '5182', '5132', '5112'], keywords: /\b(software|it services|information technology|cyber\w*|cloud|network(ing)? (equipment|services)|computer\w*|website|saas)\b/i },
  { slug: 'telecom', name: 'Telecom, internet and E-Rate', naics: ['517'], keywords: /\b(e-?rate|internet (access|service)|broadband|telecommunication\w*|fiber|wi-?fi)\b/i },
  { slug: 'staffing', name: 'Staffing and temporary labor', naics: ['5613'], keywords: /\b(staffing|temporary (labor|personnel|employment|help)|temp services|nurse staffing)\b/i },
  { slug: 'training', name: 'Training and education services', naics: ['6114', '6116', '6117'], keywords: /\b(training (services|program|course\w*)|instructor\w*|curriculum|professional development|tutoring)\b/i },
  { slug: 'legal', name: 'Legal services', naics: ['5411'], keywords: /\b(legal services|attorney\w*|counsel services|law firm|outside counsel|bond counsel)\b/i },
  { slug: 'consulting', name: 'Consulting', naics: ['5416'], keywords: /\b(consultant\w*|consulting|feasibility study|master plan\w*|strategic plan\w*)\b/i },
  { slug: 'accounting', name: 'Accounting and audit', naics: ['5412'], keywords: /\b(audit\w*|accounting services|actuarial|financial advisor\w*)\b/i },
  { slug: 'marketing', name: 'Marketing and advertising', naics: ['5418'], keywords: /\b(marketing|advertising|public relations|branding|media buy\w*)\b/i },
  { slug: 'healthcare', name: 'Healthcare and medical', naics: ['62', '3391', '3254', '42345'], keywords: /\b(medical|health ?care|clinical|pharmac\w*|dental|ambulance|laboratory services|behavioral health|nursing)\b/i },
  { slug: 'security', name: 'Security services', naics: ['5616'], keywords: /\b(security (guard|services|officer)\w*|surveillance|cctv|access control|alarm monitoring)\b/i },
  { slug: 'food-service', name: 'Food service and catering', naics: ['722', '311'], keywords: /\b(food service\w*|catering|meals?|cafeteria|vending)\b/i },
  { slug: 'vehicles', name: 'Vehicles and fleet', naics: ['3361', '3362', '3363', '4231', '8111'], keywords: /\b(vehicle\w*|trucks?|fleet|buses|bus purchase|police cars?|tires?)\b/i },
  { slug: 'environmental', name: 'Environmental and waste', naics: ['562'], keywords: /\b(environmental|remediation|hazardous|waste|recycling|asbestos|abatement)\b/i },
  { slug: 'printing', name: 'Printing', naics: ['3231'], keywords: /\b(printing|print services)\b/i },
  { slug: 'furniture', name: 'Furniture', naics: ['337'], keywords: /\bfurniture\b/i },
  { slug: 'aircraft-parts', name: 'Aircraft parts', naics: ['3364'] },
  { slug: 'electronics', name: 'Electronic and electrical equipment', naics: ['334', '335'] },
  { slug: 'machinery', name: 'Machinery', naics: ['333'] },
  { slug: 'metal-products', name: 'Metal products and hardware', naics: ['332'] },
];

export const CATEGORY_BY_SLUG = new Map(CATEGORIES.map((c) => [c.slug, c]));

/** Slugs of every category the bid falls in, in CATEGORIES order. */
export function categorize(title: string, naics: string[]): string[] {
  // E-Rate (FCC Form 470) requests are school internet and network purchases
  // whatever code they carry; cabling codes would file them under construction.
  if (/\be-?rate\b/i.test(title)) return ['telecom'];
  const primary = naics[0];
  const out: string[] = [];
  for (const c of CATEGORIES) {
    const byCode = !!primary && c.naics.some((prefix) => primary.startsWith(prefix));
    if (byCode || (c.keywords && c.keywords.test(title))) out.push(c.slug);
  }
  return out;
}
