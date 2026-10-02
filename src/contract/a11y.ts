// src/contract/a11y.ts — generated; see index.ts
//
// The accessibility product's shared vocabulary: the regulatory dates, the
// remediation market rate, and the response shapes.
//
// It lives in the contract package rather than the API because the marketing
// pages render these numbers too, and a deadline that disagrees with itself
// between the product and the page selling it is worse than having neither.

/**
 * Regulatory deadlines.
 *
 * NEVER hardcode these anywhere else, and never trust a secondary source for
 * them. BOTH sets have now moved, in two separate interim final rules six
 * months apart, and almost every page on the internet is wrong about at least
 * one of them:
 *
 *   - DOJ pushed the ADA Title II dates out a year on 20 April 2026.
 *   - HHS pushed Section 504 out a year on 11 May 2026 — the very day the
 *     original deadline fell. An earlier version of this file, written from
 *     an April 2026 source, still said that deadline had passed and had not
 *     been extended, and the healthcare landing page was built on that claim.
 *     It was caught only by re-verifying before publishing.
 *
 * Secondary sources disagree even now: two reputable ones give 11 May 2028 and
 * 10 May 2028 for small HHS recipients. The Federal Register says 10 May 2028.
 * That one-day spread is the argument for citing the rule and not a summary of
 * it, so every entry carries the document number it came from.
 *
 * Being the page that is right, dated, and visibly maintained is the entire
 * link-earning strategy, and that only works if `lastVerified` is honest.
 * Re-verify against the Federal Register before any marketing push, and move
 * `lastVerified` when you do — even if nothing changed. The stamp is the point.
 */
export const DEADLINES = {
  lastVerified: '2026-09-27',
  source: 'https://www.federalregister.gov/',
  standard: 'WCAG 2.1 Level AA',
  entries: [
    {
      id: 'title-ii-large',
      who: 'Public entities serving a population of 50,000 or more',
      deadline: '2027-04-26',
      rule: 'ADA Title II',
      note: 'Originally 22 April 2026. Extended by the DOJ interim final rule published 20 April 2026.',
      citation: 'DOJ interim final rule, 20 April 2026 (FR doc. 2026-07663)',
      source:
        'https://www.federalregister.gov/documents/2026/04/20/2026-07663/extension-of-compliance-dates-for-nondiscrimination-on-the-basis-of-disability-accessibility-of-web',
    },
    {
      id: 'hhs-504-large',
      who: 'Recipients of HHS funding with 15 or more employees — hospitals, health systems, most clinics',
      deadline: '2027-05-11',
      rule: 'HHS Section 504',
      note: 'Originally 11 May 2026. Extended by one year, by an HHS interim final rule published on that same date.',
      citation: 'HHS interim final rule, 11 May 2026 (FR doc. 2026-09266)',
      source:
        'https://www.federalregister.gov/documents/2026/05/11/2026-09266/extension-of-compliance-dates-for-nondiscrimination-on-the-basis-of-disability-accessibility-of-web',
    },
    {
      id: 'title-ii-small',
      who: 'Public entities serving under 50,000, and special districts',
      deadline: '2028-04-26',
      rule: 'ADA Title II',
      note: 'Originally 22 April 2026. Extended by the same DOJ rule.',
      citation: 'DOJ interim final rule, 20 April 2026 (FR doc. 2026-07663)',
      source:
        'https://www.federalregister.gov/documents/2026/04/20/2026-07663/extension-of-compliance-dates-for-nondiscrimination-on-the-basis-of-disability-accessibility-of-web',
    },
    {
      id: 'hhs-504-small',
      who: 'Recipients of HHS funding with fewer than 15 employees',
      deadline: '2028-05-10',
      rule: 'HHS Section 504',
      note: 'Originally 10 May 2027. Extended by one year by the same HHS rule.',
      citation: 'HHS interim final rule, 11 May 2026 (FR doc. 2026-09266)',
      source:
        'https://www.federalregister.gov/documents/2026/05/11/2026-09266/extension-of-compliance-dates-for-nondiscrimination-on-the-basis-of-disability-accessibility-of-web',
    },
  ],
} as const;

/** Days until a deadline; negative when it has passed. */
export function daysUntil(deadline: string, now: Date = new Date()): number {
  const target = new Date(`${deadline}T00:00:00Z`).getTime();
  return Math.ceil((target - now.getTime()) / 86_400_000);
}

/**
 * The published market rate for PDF remediation, per page.
 *
 * $5-$25 is the range the brief cites and it matches what the established
 * remediation vendors quote publicly. It is reported as a RANGE and never
 * collapsed to a point estimate, because the spread between a clean tagged
 * document needing a title and a scanned document needing rebuilding from
 * scratch really is five-fold, and a single number would be a fiction that
 * someone would then put in a budget.
 */
export const REMEDIATION_RATE = {
  lowCentsPerPage: 500,
  highCentsPerPage: 2500,
  source: 'Published per-page pricing from established PDF remediation vendors, 2026.',
  lastVerified: '2026-09-27',
} as const;

/**
 * How much more a scanned page costs to remediate than a tagged one.
 *
 * Here rather than in the API's constants file for the same reason the rate
 * itself is: the cost calculator on the marketing site does this arithmetic
 * too, and a calculator that quotes a different number from the product's own
 * estimate is worse than having no calculator.
 *
 * A scan has no text layer, so remediation is not correction — the document is
 * rebuilt. That is a different job with a different price, and it is why the
 * estimate is reported as a range rather than a single figure.
 */
export const SCANNED_MULTIPLIER = 2.5;

export const A11Y_SEVERITIES = ['blocker', 'major', 'minor', 'pass'] as const;
export type A11ySeverity = (typeof A11Y_SEVERITIES)[number];

export const SCAN_STATUSES = ['queued', 'crawling', 'checking', 'succeeded', 'failed'] as const;
export type ScanStatus = (typeof SCAN_STATUSES)[number];

/** Which layer found it. `geometric` is the half a conformance validator cannot do. */
export const FINDING_LAYERS = ['machine', 'geometric'] as const;
export type FindingLayer = (typeof FINDING_LAYERS)[number];

export interface A11yFinding {
  check_id: string;
  severity: A11ySeverity;
  /** Empty for a document-level finding — "not tagged" is not on a page. */
  pages: number[];
  /** Written for the person approving the budget. */
  message: string;
  /** Spec citation plus the concrete fix, for whoever does the remediation. */
  technical_detail: string;
  /**
   * How many times this check failed in the document.
   *
   * Reported separately from `pages` because one finding can stand for
   * hundreds of occurrences — a single document in the validator spike
   * produced 1,535 for one check — and a report that emitted a row for each
   * would be unreadable. Occurrence count is volume, not severity, and the
   * report must never let the two be confused.
   */
  occurrences: number;
  /** WCAG 2.1 success criteria, e.g. ["1.3.1"]. */
  wcag: string[];
  layer: FindingLayer;
}

export interface A11yDocumentResult {
  url: string;
  pages: number | null;
  severity: A11ySeverity;
  /** 0-100, lower is worse. Comparable between documents. */
  score: number;
  cost_low_usd: number;
  cost_high_usd: number;
  priority: number;
  findings: A11yFinding[];
}

export interface A11yScanResponse {
  id: string;
  status: ScanStatus;
  /** PDFs the crawl found. May exceed `checked` on a capped plan. */
  discovered: number | null;
  checked: number;
  failing: number;
  /** Present once the scan succeeds. */
  report_url?: string;
  total_cost_low_usd?: number;
  total_cost_high_usd?: number;
  documents?: A11yDocumentResult[];
}

/** The accessibility tiers. Separate from `plans` — a different product, a different unit. */
export const A11Y_PLANS = [
  {
    id: 'a11y_free',
    name: 'Free scan',
    maxDocuments: 25,
    priceCents: 0,
    recurring: false,
    public: true,
  },
  {
    id: 'a11y_once',
    name: 'One-off report',
    maxDocuments: 1_000,
    priceCents: 4_900,
    // Kept non-recurring on purpose: a small district with a fixed budget
    // cannot sign a subscription, and losing them entirely to make the pricing
    // table tidier would be a bad trade.
    recurring: false,
    public: true,
  },
  {
    id: 'a11y_monitor',
    name: 'Monitor',
    maxDocuments: 10_000,
    priceCents: 14_900,
    recurring: true,
    public: true,
  },
  {
    id: 'a11y_scale',
    name: 'Scale',
    maxDocuments: 50_000,
    priceCents: 39_900,
    recurring: true,
    public: true,
  },
] as const;

export type A11yPlanId = (typeof A11Y_PLANS)[number]['id'];

/** The ids as a plain array, for narrowing a database row back to the union. */
export const A11Y_PLAN_IDS = A11Y_PLANS.map((plan) => plan.id) as readonly A11yPlanId[];

export const A11Y_PLAN_BY_ID: Readonly<Record<A11yPlanId, (typeof A11Y_PLANS)[number]>> =
  Object.fromEntries(A11Y_PLANS.map((plan) => [plan.id, plan])) as Readonly<
    Record<A11yPlanId, (typeof A11Y_PLANS)[number]>
  >;

/**
 * What you send to start a scan.
 *
 * Exactly one of `domain`, `sitemap` or `urls` — the same "one input" rule the
 * render and extract contracts enforce, for the same reason: a body that
 * specifies two sources has no correct interpretation, and picking one silently
 * is how a customer scans the wrong thing and only finds out from the invoice.
 */
export interface A11yScanSource {
  /** A bare hostname (`example.gov`) or an origin. Sitemap first, bounded crawl as fallback. */
  domain?: string;
  /** A sitemap URL, when you know it and it is not where we would look. */
  sitemap?: string;
  /** An explicit list, when you already know which documents you care about. */
  urls?: string[];
}

export interface A11yScanOptions {
  /** Clamped to the plan, never refused. The remainder is reported as the gap. */
  max_documents?: number;
  crawl_depth?: number;
  /**
   * Accepted only as `true`.
   *
   * robots.txt is obeyed without exception and this cannot be turned off. The
   * field exists so a reader can see that in the request shape rather than
   * having to trust the docs; sending `false` is an error rather than a setting
   * that is quietly ignored, because believing you had disabled it would be
   * worse than not being offered it.
   */
  respect_robots?: true;
}

export interface A11yScanRequest {
  source: A11yScanSource;
  options?: A11yScanOptions;
}

/** What `POST /v1/a11y/scan` answers with. A scan takes minutes; there is nothing else to return. */
export interface A11yScanAccepted {
  id: string;
  status: ScanStatus;
  discovered: null;
}
