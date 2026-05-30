/**
 * Demo data for the Recourse UI video.
 *
 * Facts: the sample_data deposit case (Jamie Watson v. Patrick Sullivan,
 * Flat 6 Wellington Court — £980.77 paid 13 Apr 2024, never protected).
 * Law: the real verified claims + statute text from the Recourse grounding
 * store (Housing Act 2004 ss.213–214, fetched from legislation.gov.uk).
 * Engine figures: deterministic (penalty 1–3×, 6-year limitation longstop).
 */

export interface RecourseClaim {
  claimId: string;
  rendered: string;
  verified: boolean;
  citation: string;
  uri: string;
  sourceText: string;
  quote: string;
}

export interface LetterBlock {
  t: "h2" | "h3" | "p" | "meta";
  s: string;
}

export const recourse = {
  brand: {
    product: "Recourse",
    tagline: "From breach to a court-ready letter — every sentence traceable to the Act.",
  },
  caseMeta: {
    tenant: "Jamie Alexander Watson",
    landlord: "Mr Patrick James Sullivan",
    property: "Flat 6, 14 Wellington Court, Edgbaston, Birmingham B16 9PJ",
    deposit: "£980.77",
    problem: "Deposit never protected in any scheme",
  },
  documents: [
    { name: "tenancy_agreement.pdf", kind: "pdf" },
    { name: "bank_statement_deposit_payment.pdf", kind: "pdf" },
    { name: "dps_search_result.png", kind: "img" },
    { name: "mydeposits_search_result.png", kind: "img" },
    { name: "tds_search_result.png", kind: "img" },
  ],
  extracted: [
    { label: "Deposit amount", value: "£980.77" },
    { label: "Date landlord received it", value: "13 April 2024" },
    { label: "Protected in a scheme?", value: "No — DPS, mydeposits, TDS all blank" },
    { label: "Prescribed information given?", value: "No" },
    { label: "Tenancy type", value: "Assured shorthold (AST)" },
  ],
  engines: {
    deposit: "£980.77",
    penaltyLow: "£980.77",
    penaltyHigh: "£2,942.31",
    protectionDeadline: "13 May 2024 (missed)",
    limitationDeadline: "13 May 2030",
    daysRemaining: "1,444 days",
    status: "AMPLE TIME",
  },
  assessment: {
    branch: "Deposit not protected → county court claim",
    escalationTone: "watch" as const,
    escalationTitle: "You can do this yourself — for now",
    escalationReason:
      "Send the Letter Before Claim first. Bring in a solicitor before issuing — the 1–3× penalty is at the court's discretion.",
    nextMoveLabel: "DO THIS FIRST",
    nextMoveTitle: "Send your Letter Before Claim",
    nextMoveWhy: "It's drafted and verified below. It gives the landlord a clear deadline to return your money.",
    nextMoveDue: "Send by 6 June 2026",
  },
  verifyBar: "5 / 5 legal statements verified against primary legislation",
  verifyChip: "recorded · offline",
  letter: {
    blocks: [
      { t: "h2", s: "Letter Before Claim" },
      { t: "meta", s: "To: Mr Patrick James Sullivan · From: Jamie Alexander Watson" },
      { t: "meta", s: "Re: Tenancy deposit — Flat 6, 14 Wellington Court, Edgbaston, Birmingham B16 9PJ" },
      { t: "h3", s: "Introduction" },
      { t: "p", s: "I am writing about the deposit you took for my tenancy. This letter is a formal Letter Before Claim. I would prefer to resolve this matter without court proceedings, and I am giving you the opportunity to do so before any claim is issued." },
      { t: "h3", s: "The facts" },
      { t: "p", s: "You took a deposit of £980.77 from me at the start of my assured shorthold tenancy on 13 April 2024. To date, that deposit has not been protected in a government-authorised tenancy deposit scheme, and I was not given the prescribed information that the law requires." },
      { t: "h3", s: "Why this is a breach" },
      { t: "p", s: "The law requires a landlord to protect a tenancy deposit in an authorised scheme within 30 days of receiving it. The landlord must also give the tenant the prescribed information about the scheme within 30 days. By failing to do so, you have not complied with your statutory obligations under the Housing Act 2004." },
      { t: "h3", s: "What I am claiming" },
      { t: "p", s: "Where section 213(3) or (6) has not been complied with, the tenant may apply to the county court. On such an application the court may order the deposit to be repaid to the applicant within 14 days. The court must also order the landlord to pay a penalty of between one and three times the deposit within 14 days. For my deposit of £980.77, that is between £980.77 and £2,942.31." },
      { t: "h3", s: "Next steps" },
      { t: "p", s: "Please respond by 20 June 2026. If I do not hear from you, I may issue a claim in the county court under CPR Part 8 (claim form N208) without further notice to you. This letter is sent on a without-prejudice-save-as-to-costs basis." },
    ] as LetterBlock[],
  },
  claims: [
    {
      claimId: "R1",
      rendered: "The law requires a landlord to protect a tenancy deposit in an authorised scheme within 30 days of receiving it.",
      verified: true,
      citation: "Housing Act 2004, s.213(3)",
      uri: "https://www.legislation.gov.uk/ukpga/2004/34/section/213",
      sourceText: "Where a landlord receives a tenancy deposit in connection with a shorthold an assured tenancy, the initial requirements of an authorised scheme must be complied with by the landlord in relation to the deposit within the period of 30 days beginning with the date on which it is received.",
      quote: "the initial requirements of an authorised scheme must be complied with by the landlord in relation to the deposit within the period of 30 days beginning with the date on which it is received",
    },
    {
      claimId: "R2",
      rendered: "The landlord must also give the tenant the prescribed information about the scheme within 30 days.",
      verified: true,
      citation: "Housing Act 2004, s.213(6)",
      uri: "https://www.legislation.gov.uk/ukpga/2004/34/section/213",
      sourceText: "The information required by subsection (5) must be given to the tenant and any relevant person — in the prescribed form or in a form substantially to the same effect, and within the period of 30 days beginning with the date on which the deposit is received by the landlord.",
      quote: "within the period of 30 days beginning with the date on which the deposit is received by the landlord",
    },
    {
      claimId: "R4",
      rendered: "Where section 213(3) or (6) has not been complied with, the tenant may apply to the county court.",
      verified: true,
      citation: "Housing Act 2004, s.214(1)(a)",
      uri: "https://www.legislation.gov.uk/ukpga/2004/34/section/214",
      sourceText: "An application may be made to the county court on the grounds that section 213(3) or (6) has not been complied with in relation to the deposit, or that the tenant has been notified that the deposit is held but is not satisfied.",
      quote: "that section 213(3) or (6) has not been complied with in relation to the deposit",
    },
    {
      claimId: "R6",
      rendered: "On such an application the court may order the deposit to be repaid to the applicant within 14 days.",
      verified: true,
      citation: "Housing Act 2004, s.214(3A)",
      uri: "https://www.legislation.gov.uk/ukpga/2004/34/section/214",
      sourceText: "The court may order the person who appears to the court to be holding the deposit to repay all or part of it to the applicant within the period of 14 days beginning with the date of the making of the order.",
      quote: "to repay all or part of it to the applicant within the period of 14 days beginning with the date of the making of the order",
    },
    {
      claimId: "R7",
      rendered: "The court must also order the landlord to pay a penalty of between one and three times the deposit within 14 days.",
      verified: true,
      citation: "Housing Act 2004, s.214(4)",
      uri: "https://www.legislation.gov.uk/ukpga/2004/34/section/214",
      sourceText: "The court must order the landlord to pay to the applicant a sum of money not less than the amount of the deposit and not more than three times the amount of the deposit within the period of 14 days beginning with the date of the making of the order.",
      quote: "not less than the amount of the deposit and not more than three times the amount of the deposit within the period of 14 days",
    },
  ] as RecourseClaim[],
  /** Claim featured in the provenance-drawer scene. */
  drawerClaimId: "R7",
};

export type RecourseData = typeof recourse;
