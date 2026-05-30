/**
 * Classifies a landlord's free-text reply into the engine's landlordResponse
 * enum. "Model suggests, code decides": Claude maps the message to a category,
 * then the deterministic playbook routes on it. Offline (no key / USE_FIXTURE)
 * a keyword heuristic stands in, so the paste-and-route flow works in the demo
 * without an API key.
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

export async function classifyLandlordResponse(message: string): Promise<Classification> {
  const text = (message ?? "").trim();
  if (!text) return { landlordResponse: "unknown", rationale: "No message was provided.", source: "heuristic" };

  const offline = !process.env.ANTHROPIC_API_KEY || process.env.USE_FIXTURE === "1";
  if (offline) return heuristic(text);

  try {
    const client = new Anthropic();
    const res = await client.messages.create({
      model: MODEL_ID,
      max_tokens: 300,
      system:
        "You classify a UK landlord's reply to a tenant who asked for their tenancy deposit back. " +
        "Any proposed deduction or partial offer is disputes_deductions. Report only what the message says.",
      tool_choice: { type: "tool", name: "classify" },
      tools: [
        {
          name: "classify",
          description: "Classify the landlord's reply.",
          input_schema: {
            type: "object",
            properties: {
              category: { type: "string", enum: VALID },
              rationale: { type: "string", description: "One plain-English sentence citing what the landlord said." },
            },
            required: ["category", "rationale"],
          },
        },
      ],
      messages: [{ role: "user", content: `Landlord's reply:\n"""${text}"""` }],
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

function heuristic(text: string): Classification {
  const t = text.toLowerCase();
  const disputes = /deduct|damage|cleaning|withhold|keep|retain|owe|dispute|broken|repair|unpaid|invoice|offer you|partial|propose|minus/.test(t);
  const agrees = /agree|refund|pay (you )?back|return (it|the|your|in full|the full)|full amount|transfer (the|your) deposit|happy to return|send (it|the deposit) back/.test(t);
  if (agrees && !disputes)
    return { landlordResponse: "agrees_in_full", rationale: "Mentions returning or refunding the deposit in full.", source: "heuristic" };
  if (disputes)
    return { landlordResponse: "disputes_deductions", rationale: "Mentions deductions, damage, or keeping part of the deposit.", source: "heuristic" };
  return { landlordResponse: "unknown", rationale: "Couldn't classify this confidently — please pick the closest option.", source: "heuristic" };
}
