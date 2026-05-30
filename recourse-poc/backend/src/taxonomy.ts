/**
 * The funnel taxonomy: a broad catalogue of legal problem areas, of which the
 * implemented verticals are live. A leaf is "live" once its domain maps to a
 * registered playbook (the intake schema is derived from the playbook, so a
 * playbook is all that's needed to surface a vertical).
 *
 * Add a real path by registering a playbook in src/playbooks/registry.ts and
 * giving its leaf a `domain`; it flips to live automatically.
 */
import { PLAYBOOKS } from "../../../src/playbooks/registry.ts";

export type LeafStatus = "live" | "coming_soon";

export interface TaxonomyLeaf {
  id: string;
  label: string;
  blurb?: string;
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

/** A leaf is live once its domain maps to a registered playbook. */
function leafStatus(domain?: string): LeafStatus {
  return domain && domain in PLAYBOOKS ? "live" : "coming_soon";
}

interface RawArea {
  id: string;
  label: string;
  icon: string;
  blurb: string;
  subAreas: Array<{ id: string; label: string; blurb?: string; domain?: string }>;
}

// The catalogue. Sub-areas with a `domain` go live once that playbook is registered.
const RAW_AREAS: RawArea[] = [
  {
    id: "housing_tenancy",
    label: "Housing & Tenancy",
    icon: "🏠",
    blurb: "Deposits, repairs, eviction and renting problems.",
    subAreas: [
      { id: "deposit_return", label: "Tenancy deposit return or dispute", blurb: "Get your deposit back, or challenge unfair deductions.", domain: "deposit_return" },
      { id: "housing_disrepair", label: "Repairs & disrepair", blurb: "Damp, mould, leaks or unsafe conditions your landlord won't fix.", domain: "housing_disrepair" },
      { id: "eviction", label: "Eviction / Section 21", blurb: "You've been served notice to leave." },
      { id: "rent_increase", label: "Rent increases", blurb: "Your landlord wants to put the rent up." },
      { id: "harassment", label: "Harassment / illegal eviction", blurb: "Landlord harassment or lockouts." },
    ],
  },
  {
    id: "employment",
    label: "Employment & Work",
    icon: "💼",
    blurb: "Dismissal, redundancy, discrimination and pay.",
    subAreas: [
      { id: "unfair_dismissal", label: "Unfair dismissal or discrimination", blurb: "You were dismissed and believe it was unfair or discriminatory.", domain: "unfair_dismissal" },
      { id: "unpaid_wages", label: "Unpaid wages or commission", blurb: "Money your employer owes you.", domain: "unpaid_wages" },
      { id: "redundancy", label: "Redundancy", blurb: "You've been made redundant.", domain: "employment_termination" },
    ],
  },
  {
    id: "consumer",
    label: "Consumer & Faulty Goods",
    icon: "🛒",
    blurb: "Faulty products, poor services, unfair terms and refunds.",
    subAreas: [
      { id: "faulty_goods", label: "Faulty product or vehicle", blurb: "Something you bought from a trader is faulty.", domain: "faulty_goods" },
      { id: "consumer_services", label: "Service not delivered or done badly", blurb: "A supplier took your money and didn't deliver.", domain: "consumer_services" },
      { id: "unfair_terms", label: "Unfair contract terms", blurb: "An onerous gym/subscription lock-in or charge (and debt chasing).", domain: "unfair_terms" },
    ],
  },
  {
    id: "travel",
    label: "Travel & Flights",
    icon: "✈️",
    blurb: "Flight delays, cancellations and travel disruption.",
    subAreas: [
      { id: "flight_delay", label: "Flight delay or cancellation", blurb: "Claim compensation under UK Regulation 261/2004.", domain: "flight_delay" },
      { id: "package_holiday", label: "Package holiday problems", blurb: "A holiday that wasn't as described." },
    ],
  },
  {
    id: "builders",
    label: "Builders & Tradespeople",
    icon: "🔨",
    blurb: "Building, renovation and home-improvement disputes.",
    subAreas: [
      { id: "building_dispute", label: "Building or renovation dispute", blurb: "Work abandoned, incomplete or defective.", domain: "building_dispute" },
    ],
  },
  {
    id: "neighbours",
    label: "Neighbours & Nuisance",
    icon: "🔊",
    blurb: "Boundaries, nuisance and property damage.",
    subAreas: [
      { id: "small_claims_nuisance", label: "Property damage or nuisance", blurb: "e.g. tree roots, encroachment or subsidence — including live court claims.", domain: "small_claims_nuisance" },
      { id: "noise", label: "Noise & anti-social behaviour", blurb: "Persistent noise or nuisance." },
    ],
  },
  { id: "debt", label: "Debt & Money", icon: "💷", blurb: "Debt claims, unpaid invoices, money owed.", subAreas: [] },
  { id: "family", label: "Family & Relationships", icon: "👪", blurb: "Separation, children and family matters.", subAreas: [] },
  { id: "immigration", label: "Immigration", icon: "🪪", blurb: "Visas, status and immigration applications.", subAreas: [] },
  { id: "probate", label: "Wills & Probate", icon: "📜", blurb: "Wills, estates and probate.", subAreas: [] },
  { id: "small_claims", label: "Other Small Claims", icon: "⚖️", blurb: "Money claims under £10,000.", subAreas: [] },
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
