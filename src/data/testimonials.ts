// Social proof — ANONYMIZED, role-based (per the "genericize" content decision).
//
// The source site used named people, named employers, and specific win-rate /
// dollar figures that could not be verified and conflicted across pages. Those
// have been removed. What remains is qualitative, role-based framing with no
// invented numbers, so nothing unverifiable ships on an indexed page.
//
// REPLACE with real, permissioned customer quotes when available — ideally with
// a name, title, and (verified) metric. Until then these read as representative
// use cases, not attributed endorsements. `Testimonials.astro` renders nothing
// if this array is empty, so it is safe to clear it entirely.

export interface Testimonial {
  quote: string;
  role: string;
  orgType: string;
  metric?: string; // leave undefined unless the number is verified
}

export const testimonials: Testimonial[] = [
  {
    quote:
      'GovHub cut the time we spend on a federal response dramatically. The compliance checks catch requirements we used to miss under deadline pressure.',
    role: 'Proposal Manager',
    orgType: 'defense systems integrator',
  },
  {
    quote:
      'We can pursue more opportunities than we used to. The AI gives us a usable first draft of the technical narrative instead of a blank page.',
    role: 'Business Development Director',
    orgType: 'federal IT services firm',
  },
  {
    quote:
      'The compliance review gave us the confidence to bid on larger contracts we would have passed on before.',
    role: 'Contracts Manager',
    orgType: 'aerospace engineering firm',
  },
];
