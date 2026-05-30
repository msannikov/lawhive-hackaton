import type { Tool } from "../../types";

const CHECKLIST = [
  "Your signed tenancy agreement (AST)",
  "Proof you paid the deposit (bank statement line or receipt)",
  "The prescribed-information section of the agreement (blank or served)",
  "Screenshots of all three deposit-scheme searches",
  "Any messages with the landlord about the deposit",
];

export default function EvidencePanel({ tool }: { tool: Tool }) {
  return (
    <div className="panel evidence-panel">
      <p>{tool.nextAction}</p>
      <ul className="checklist">
        {CHECKLIST.map((c, i) => (
          <li key={i}>
            <label>
              <input type="checkbox" /> {c}
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}
