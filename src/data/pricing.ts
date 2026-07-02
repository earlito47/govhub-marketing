// Canonical pricing — ported from the product app's single source of truth
// (strata-parse/src/lib/pricing.ts), with Stripe/env wiring removed. Drives the
// pricing page, the PricingTable component, and the SoftwareApplication
// AggregateOffer schema.

export type PlanId = 'solo' | 'pro' | 'team';

export interface Plan {
  id: PlanId;
  name: string;
  description: string;
  monthlyUsd: number;
  annualUsd: number; // ~2 months free vs monthly
  proposalsPerMonth: number;
  features: string[];
  popular?: boolean;
}

export const TRIAL_DAYS = 14;

export const PLANS: Plan[] = [
  {
    id: 'solo',
    name: 'Solo',
    description: 'For independent consultants getting started.',
    monthlyUsd: 129,
    annualUsd: 1290,
    proposalsPerMonth: 3,
    features: [
      '3 proposals per month',
      'AI Intelligence Brief on every RFP',
      'Form autofill',
      'Email support',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    description: 'For teams responding to RFPs regularly.',
    monthlyUsd: 349,
    annualUsd: 3490,
    proposalsPerMonth: 15,
    popular: true,
    features: [
      '15 proposals per month',
      'Everything in Solo',
      'Custom templates & themes',
      'Compliance checking',
      'Priority support',
    ],
  },
  {
    id: 'team',
    name: 'Team',
    description: 'For agencies and growing BD teams.',
    monthlyUsd: 699,
    annualUsd: 6990,
    proposalsPerMonth: 50,
    features: [
      '50 proposals per month',
      'Everything in Pro',
      'Team collaboration',
      'API access',
      'Dedicated success manager',
    ],
  },
];

export const formatUsd = (n: number) =>
  `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;

// For AggregateOffer schema + the "how much does it cost" FAQ.
export const PRICE_RANGE = {
  low: PLANS[0].monthlyUsd,
  high: PLANS[PLANS.length - 1].monthlyUsd,
  currency: 'USD',
  offerCount: PLANS.length,
};
