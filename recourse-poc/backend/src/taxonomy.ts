/**
 * The funnel taxonomy: a broad catalogue of legal problem areas (credibility),
 * of which only a few are actually live. A leaf is "live" only when it maps to a
 * registered playbook AND we have an intake schema for it — so the catalogue can
 * advertise breadth without ever routing a user into a dead end.
 *
 * Add a real path by registering a playbook (src/playbooks/registry.ts) and an
 * intake schema (intakeSchemas.ts); the matching leaf flips to live automatically.
 */
import { PLAYBOOKS } from "../../../src/playbooks/registry.ts";
import { INTAKE_SCHEMAS } from "./intakeSchemas.ts";

export type LeafStatus = "live" | "coming_soon";

export interface TaxonomyLeaf {
  id: string;
  label: string;
  blurb?: string;
  /** Set on live leaves; selects the playbook to run. */
  domain?: string;
  status: LeafStatus;
}

export interface TaxonomyArea {
  id: string;
  label: string;
  icon: string;
  blurb: string;
  status: LeafStatus;
  subAreas: TaxonomyLeaf[];
}

export interface Taxonomy {
  areas: TaxonomyArea[];
}

/** A leaf is live only if its domain has both a playbook and an intake schema. */
function leafStatus(domain?: string): LeafStatus {
  return domain && domain in PLAYBOOKS && domain in INTAKE_SCHEMAS ? "live" : "coming_soon";
}

interface RawArea {
  id: string;
  label: string;
  icon: string;
  blurb: string;
  subAreas: Array<{ id: string; label: string; blurb?: string; domain?: string }>;
}

// The catalogue. Sub-areas with a `domain` become live once that domain is ready.
const RAW_AREAS: RawArea[] = [
  {
    id: "housing_tenancy",
    label: "Housing & Tenancy",
    icon: "🏠",
    blurb: "Deposits, repairs, eviction and renting problems.",
    subAreas: [
      {
        id: "deposit_return",
        label: "Tenancy deposit return or dispute",
        blurb: "Get your deposit back, or challenge unfair deductions.",
        domain: "deposit_return",
      },
      { id: "repairs", label: "Repairs & disrepair", blurb: "Damp, mould, broken heating, unsafe conditions." },
      { id: "eviction", label: "Eviction / Section 21", blurb: "You've been served notice to leave." },
      { id: "rent_increase", label: "Rent increases", blurb: "Your landlord wants to put the rent up." },
      { id: "agreement", label: "Tenancy agreement issues", blurb: "Unfair terms or a contract dispute." },
      { id: "harassment", label: "Harassment / illegal eviction", blurb: "Landlord harassment or lockouts." },
    ],
  },
  {
    id: "employment",
    label: "Employment & Work",
    icon: "💼",
    blurb: "Dismissal, redundancy, pay and workplace disputes.",
    subAreas: [
      {
        id: "termination",
        label: "Dismissal or redundancy",
        blurb: "You've lost your job and think it may be unfair.",
        domain: "employment_termination",
      },
      { id: "unpaid_wages", label: "Unpaid wages", blurb: "Money you're owed by an employer." },
      { id: "discrimination", label: "Discrimination at work", blurb: "Unfair treatment at work." },
    ],
  },
  { id: "consumer", label: "Consumer & Faulty Goods", icon: "🛒", blurb: "Faulty products, bad services, refunds.", subAreas: [] },
  { id: "debt", label: "Debt & Money", icon: "💷", blurb: "Debt claims, unpaid invoices, money owed.", subAreas: [] },
  { id: "neighbours", label: "Neighbours & Nuisance", icon: "🔊", blurb: "Noise, boundaries and nuisance disputes.", subAreas: [] },
  { id: "family", label: "Family & Relationships", icon: "👪", blurb: "Separation, children and family matters.", subAreas: [] },
  { id: "immigration", label: "Immigration", icon: "🪪", blurb: "Visas, status and immigration applications.", subAreas: [] },
  { id: "probate", label: "Wills & Probate", icon: "📜", blurb: "Wills, estates and probate.", subAreas: [] },
  { id: "small_claims", label: "Small Claims", icon: "⚖️", blurb: "Money claims under £10,000.", subAreas: [] },
];

export function getTaxonomy(): Taxonomy {
  const areas: TaxonomyArea[] = RAW_AREAS.map((a) => {
    const subAreas: TaxonomyLeaf[] = a.subAreas.map((s) => ({
      id: s.id,
      label: s.label,
      blurb: s.blurb,
      domain: s.domain,
      status: leafStatus(s.domain),
    }));
    const status: LeafStatus = subAreas.some((s) => s.status === "live") ? "live" : "coming_soon";
    return { id: a.id, label: a.label, icon: a.icon, blurb: a.blurb, status, subAreas };
  });
  return { areas };
}
