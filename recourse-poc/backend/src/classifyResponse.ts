/**
 * Classifies a counterparty's free-text reply into the negotiation engine's
 * response enum. "Model suggests, code decides": Claude maps the message to a
 * category, then the deterministic playbook routes on it. Offline (no key /
 * USE_FIXTURE) a keyword heuristic stands in, so the paste-and-route flow works
 * in the demo without an API key.
 *
 * Domain-aware: the same four categories apply to every playbook, but the
 * counterparty and subject differ (a landlord disputing deposit deductions vs.
 * an employer denying an unfair-dismissal claim). The `domain` colours the
 * prompt so the model reasons about the right dispute instead of forcing every
 * reply into deposit language. The enum VALUES are unchanged for back-compat
 * (the frontend re-labels them per domain via negCopy); only the framing moves.
 */
import Anthropic from "@anthropic-ai/sdk";

export type LandlordResponseCategory = "agrees_in_full" | "disputes_deductions" | "silent" | "unknown";
const VALID: LandlordResponseCategory[] = ["agrees_in_full", "disputes_deductions", "silent", "unknown"];

export interface Classification {
  landlordResponse: LandlordResponseCategory;
  rationale: string;
  source: "model" | "heuristic";
}

const MODEL_ID = process.env.MODEL_ID || "claude-opus-4-8";

/**
 * Per-domain wording for the classifier prompt. (The frontend keeps the richer
 * negCopy; the classifier only needs who replied and what about.) Could later
 * move onto the Playbook interface as a single source of truth.
 */
interface DomainCopy {
  counterparty: string; // who is replying, e.g. "employer"
  subject: string; // what they are pursuing, e.g. "an unfair dismissal claim"
}
const DOMAIN_COPY: Record<string, DomainCopy> = {
  deposit_return: { counterparty: "landlord", subject: "the return of a tenancy deposit" },
  housing_disrepair: { counterparty: "landlord", subject: "outstanding repairs or disrepair" },
  unfair_dismissal: { counterparty: "employer", subject: "an unfair dismissal or discrimination claim" },
  employment_termination: { counterparty: "employer", subject: "a dismissal or redundancy claim" },
  unpaid_wages: { counterparty: "employer", subject: "unpaid wages or commission" },
  faulty_goods: { counterparty: "trader", subject: "a refund or repair for faulty goods" },
  consumer_services: { counterparty: "supplier", subject: "a service not delivered or done badly" },
  unfair_terms: { counterparty: "company", subject: "an unfair contract term or disputed debt" },
  flight_delay: { counterparty: "airline", subject: "flight delay or cancellation compensation" },
  building_dispute: { counterparty: "contractor", subject: "defective or unfinished building work" },
  small_claims_nuisance: { counterparty: "other party", subject: "a nuisance or property-damage claim" },
};
const DEFAULT_COPY: DomainCopy = { counterparty: "other side", subject: "the claim" };

function copyFor(domain?: string): DomainCopy {
  return (domain && DOMAIN_COPY[domain]) || DEFAULT_COPY;
}

export async function classifyLandlordResponse(message: string, domain?: string): Promise<Classification> {
  const text = (message ?? "").trim();
  if (!text) return { landlordResponse: "unknown", rationale: "No message was provided.", source: "heuristic" };

  const offline = !process.env.ANTHROPIC_API_KEY || process.env.USE_FIXTURE === "1";
  if (offline) return heuristic(text);

  const { counterparty, subject } = copyFor(domain);
  try {
    const client = new Anthropic();
    const res = await client.messages.create({
      model: MODEL_ID,
      max_tokens: 300,
      system:
        `You classify a UK ${counterparty}'s reply to someone pursuing ${subject}. ` +
        `Map the reply to exactly one category: ` +
        `"agrees_in_full" = the ${counterparty} agrees to resolve it in full (e.g. pay, refund, reinstate, or settle the claim as asked); ` +
        `"disputes_deductions" = the ${counterparty} pushes back — denies or disputes the claim, blames the other side, or offers only part / a lower settlement; ` +
        `"silent" = no substantive reply or only a holding response; ` +
        `"unknown" = you genuinely cannot tell. Report only what the message says.`,
      tool_choice: { type: "tool", name: "classify" },
      tools: [
        {
          name: "classify",
          description: "Classify the reply.",
          input_schema: {
            type: "object",
            properties: {
              category: { type: "string", enum: VALID },
              rationale: { type: "string", description: `One plain-English sentence citing what the ${counterparty} said.` },
            },
            required: ["category", "rationale"],
          },
        },
      ],
      messages: [{ role: "user", content: `Reply from the ${counterparty}:\n"""${text}"""` }],
    });
    const block = res.content.find((b) => b.type === "tool_use");
    if (block && block.type === "tool_use") {
      const input = block.input as { category?: string; rationale?: string };
      const category = (VALID as string[]).includes(input.category ?? "")
        ? (input.category as LandlordResponseCategory)
        : "unknown";
      return { landlordResponse: category, rationale: input.rationale ?? "", source: "model" };
    }
  } catch {
    /* fall through to the heuristic */
  }
  return heuristic(text);
}

/**
 * Domain-neutral keyword heuristic for the offline demo. Recognises the generic
 * shapes of a pushback (deny / dispute / partial offer / blame) and a full
 * resolution (agree / pay / refund / reinstate / settle in full), across any
 * playbook. Pushback is checked first so "we do not agree …" routes correctly.
 */
function heuristic(text: string): Classification {
  const t = text.toLowerCase();

  const disputes =
    /\b(dispute|disputed|deny|denies|denied|reject|rejected|refuse|refused|contest|blame|not (our|your|their|my) fault)\b/.test(t) ||
    /\b(do not|don'?t|cannot|can'?t|won'?t|will not) (agree|accept)\b/.test(t) ||
    /\bdisagree\b/.test(t) ||
    /\b(without (admission|prejudice)|admission of liability|liabilit)\b/.test(t) ||
    /\b(offer you|partial|propose|counter[- ]?offer|settlement of|settle for|deduct|deduction|withhold|retain|minus)\b/.test(t) ||
    /\b(damage|cleaning|broken|repair|unpaid|invoice|owe[ds]?)\b/.test(t);

  const agrees =
    /\b(agree|agreed|refund|reinstate|reinstatement)\b/.test(t) ||
    /\bpay (you )?(back|in full)\b/.test(t) ||
    /\breturn (it|the|your|the full)\b/.test(t) ||
    /\b(full amount|in full)\b/.test(t) ||
    /\bhappy to (return|refund|pay|resolve|reinstate|settle)\b/.test(t) ||
    /\b(settle (it|this|the claim) in full|resolve (it|this) (in full|fully))\b/.test(t);

  if (agrees && !disputes)
    return { landlordResponse: "agrees_in_full", rationale: "Reads as an agreement to resolve the matter in full.", source: "heuristic" };
  if (disputes)
    return { landlordResponse: "disputes_deductions", rationale: "Reads as the other side pushing back, denying, or offering only part.", source: "heuristic" };
  return { landlordResponse: "unknown", rationale: "Couldn't classify this confidently — please pick the closest option.", source: "heuristic" };
}
