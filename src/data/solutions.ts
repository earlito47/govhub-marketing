// Solutions registry — single source of truth for the /solutions hub, the Nav
// and Footer product menus, the homepage solutions grid, and cross-links between
// feature pages and blog spokes. Detail pages keep their own long-form body copy
// but import their entry here for consistent name/title/description/breadcrumbs.
//
// `title`/`description` are SEO copy (ported from the product app's seo.ts where a
// matching route existed). `wave` maps to the keyword-research build order.

export interface Solution {
  slug: string;
  name: string; // nav / card label
  title: string; // <title> / H1 source
  description: string; // meta description
  primaryKeyword: string; // from GovHub_Keyword_Research.xlsx
  summary: string; // hub-card blurb
  wave: 1 | 2 | 3;
  featured?: boolean; // surfaced on the homepage grid
  relatedSlugs?: string[]; // sibling solution slugs
  relatedPosts?: string[]; // blog spoke slugs (bidirectional linking)
}

export const solutions: Solution[] = [
  {
    slug: 'compliance-matrix-generator',
    name: 'Compliance matrix generator',
    title: 'Free RFP Compliance Matrix Generator | GovHub',
    description:
      'Turn any government RFP into a Section L/M compliance matrix in seconds. Free, browser-based — paste your solicitation, export the matrix. No login, nothing leaves your machine.',
    primaryKeyword: 'RFP compliance matrix generator',
    summary:
      'Paste an RFP and get a structured compliance matrix — requirement, section, L/M category — you can export to CSV. Free and runs entirely in your browser.',
    wave: 1,
    featured: true,
    relatedSlugs: ['rfp-shredding', 'ai-proposal-generator'],
    relatedPosts: ['what-is-a-compliance-matrix', 'what-are-section-l-and-m'],
  },
  {
    slug: 'rfp-shredding',
    name: 'RFP shredding',
    title: 'RFP Shredding Software for Government Proposals | GovHub',
    description:
      "GovHub 'shreds' government solicitations — extracting every requirement, instruction, and evaluation factor into a structured compliance matrix. Purpose-built for federal RFPs.",
    primaryKeyword: 'RFP shredding software',
    summary:
      'Automatically break a solicitation down into every "shall," instruction, and evaluation factor — the first step to a compliant response.',
    wave: 1,
    featured: true,
    relatedSlugs: ['compliance-matrix-generator', 'ai-proposal-generator'],
    relatedPosts: ['what-is-rfp-shredding', 'what-are-section-l-and-m'],
  },
  {
    slug: 'ai-proposal-generator',
    name: 'AI proposal generator',
    title: 'AI Proposal Generator for Govt Contracts | GovHub',
    description:
      "Draft compliant, RFP-tailored government proposal content in minutes with GovHub's AI proposal generator — Section L/M, FAR/DFARS, and Section 508 aware.",
    primaryKeyword: 'AI proposal writer for government contracts',
    summary:
      'Drafts full narrative sections — technical approach, management approach, past performance — against your solicitation and knowledge base.',
    wave: 2,
    featured: true,
    relatedSlugs: ['proposal-sections', 'technical-writer-review'],
    relatedPosts: ['how-to-write-a-government-proposal', 'what-are-section-l-and-m'],
  },
  {
    slug: 'form-autofiller',
    name: 'Form autofiller',
    title: 'Government Form Autofiller (SF330, L-Forms) | GovHub',
    description:
      "Auto-fill SF330s, L-forms, and federal compliance attachments straight from your company profile with GovHub's form autofiller. End manual data entry.",
    primaryKeyword: 'government form autofill',
    summary:
      'Reps & certs, SF-33, SF-1449, and SF330 autofilled from one shared company profile — no more retyping the same data on every response.',
    wave: 2,
    featured: true,
    relatedSlugs: ['sf330', 'ai-proposal-generator'],
    relatedPosts: ['how-to-fill-out-sf330'],
  },
  {
    slug: 'sf330',
    name: 'SF330 software',
    title: 'SF330 Software — Automate the SF330 Form | GovHub',
    description:
      'Complete the SF330 architect-engineer qualifications form faster. GovHub autofills Parts I and II from your company profile and past-performance library.',
    primaryKeyword: 'SF330 software',
    summary:
      'A dedicated workflow for the SF330 A-E qualifications form — Parts I and II populated from your profile, resumes, and project data.',
    wave: 2,
    relatedSlugs: ['form-autofiller'],
    relatedPosts: ['how-to-fill-out-sf330'],
  },
  {
    slug: 'technical-writer-review',
    name: 'Technical writer review',
    title: 'AI Technical Writer & Compliance Review | GovHub',
    description:
      "GovHub's AI technical writing review checks government proposals for compliance drift, evaluation-criteria alignment, and clarity before you submit.",
    primaryKeyword: 'federal technical writing software',
    summary:
      'Reviews every section for compliance drift, Section M alignment, page-limit adherence, and clarity — the pass a senior reviewer would make.',
    wave: 3,
    relatedSlugs: ['ai-proposal-generator', 'proposal-sections'],
    relatedPosts: ['color-team-reviews-pink-red-gold', 'why-proposals-get-rejected'],
  },
  {
    slug: 'template-generator',
    name: 'Template generator',
    title: 'Proposal Template Design Generator | GovHub',
    description:
      'Apply agency-ready, compliant proposal templates instantly. Produce polished government proposal documents — correct formatting, section numbering, page budgets — without a designer.',
    primaryKeyword: 'government proposal template software',
    summary:
      'Compliant formatting, section numbering, and page-limit budgets applied automatically — turn a draft into a submission-ready document.',
    wave: 3,
    relatedSlugs: ['ai-proposal-generator'],
    relatedPosts: [],
  },
  {
    slug: 'proposal-sections',
    name: 'Proposal section generators',
    title: 'Proposal Section Generators (Exec Summary, Tech Approach) | GovHub',
    description:
      "Generate executive summaries, technical and management approach, and staffing narratives tailored to your RFP's evaluation criteria with GovHub.",
    primaryKeyword: 'proposal executive summary generator',
    summary:
      'Section-by-section generators — executive summary, technical approach, management approach, staffing — each written to the evaluation factors.',
    wave: 3,
    relatedSlugs: ['ai-proposal-generator', 'technical-writer-review'],
    relatedPosts: ['how-to-write-a-government-proposal'],
  },
];

export const getSolution = (slug: string) => solutions.find((s) => s.slug === slug);
export const featuredSolutions = () => solutions.filter((s) => s.featured);
