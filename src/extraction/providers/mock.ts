/**
 * Offline development stub. It does NOT read the documents — it returns a fixed
 * fixture so the end-to-end pipeline (extract → validate → matchToolset) can run
 * without API keys. Production uses {@link ClaudeProvider} / {@link GeminiProvider}.
 *
 * The fixture is the correct extraction for the bundled sample_data case, so
 * `npm run example` produces the real assessment offline.
 */

import type { CaseInput, ExtractionProvider, ExtractionResult } from "../types.ts";
import { normalizeTenantCase } from "../validate.ts";

export class MockProvider implements ExtractionProvider {
  readonly name = "mock";

  async extract(input: CaseInput): Promise<ExtractionResult> {
    const warnings = ["MockProvider: returning fixture, documents were not read."];
    const raw = {
      tenant: {
        name: "Jamie Alexander Watson",
        address: "Flat 6, 14 Wellington Court, Edgbaston, Birmingham B16 9PJ",
      },
      landlord: {
        name: "Mr Patrick James Sullivan",
        email: "patrick.sullivan58@hotmail.com",
        phone: "07811 442 309",
        address: "28 Holyhead Road, Handsworth, Birmingham B21 0LJ",
      },
      property: {
        address: "Flat 6, 14 Wellington Court, Edgbaston, Birmingham B16 9PJ",
        postcode: "B16 9PJ",
      },
      deposit: { amount: 980.77, currency: "GBP", paidDate: "2024-04-13" },
      tenancy: { startDate: "2024-04-17", endDate: "2025-04-16", ended: true },
      protection: {
        protectedInScheme: false,
        scheme: null,
        dateProtected: null,
        prescribedInformationGiven: false,
        schemeSearches: [
          { scheme: "DPS", searched: true, found: false },
          { scheme: "mydeposits", searched: true, found: false },
          { scheme: "TDS", searched: true, found: false },
        ],
      },
      landlordResponse: "unknown",
      forwardingAddressProvided: true,
      evidence: [
        { field: "deposit.amount", value: 980.77, source: "tenancy_agreement.pdf, Particulars item 7" },
        { field: "deposit.paidDate", value: "2024-04-13", source: "bank_statement_deposit_payment.pdf, 13 Apr FPO P SULLIVAN" },
        { field: "protection.prescribedInformationGiven", value: false, source: "tenancy_agreement.pdf, Schedule 1 (c)+(h) blank" },
        { field: "protection.schemeSearches", value: "no record found x3", source: "dps/mydeposits/tds_search_result.png" },
      ],
    };

    const tenantCase = normalizeTenantCase(raw, input, warnings);
    return { tenantCase, evidence: raw.evidence as any, provider: this.name, warnings };
  }
}
