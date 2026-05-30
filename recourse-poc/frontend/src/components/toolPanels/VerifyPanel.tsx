import type { Facts } from "../../types";

const SCHEMES = [
  { name: "DPS (Deposit Protection Service)", url: "https://www.depositprotection.com/" },
  { name: "mydeposits", url: "https://www.mydeposits.co.uk/" },
  { name: "TDS (Tenancy Deposit Scheme)", url: "https://www.tenancydepositscheme.com/" },
];

function get(facts: Facts, path: string): unknown {
  return path.split(".").reduce<any>((o, k) => (o == null ? undefined : o[k]), facts);
}

export default function VerifyPanel({ facts }: { facts: Facts }) {
  const surname = String(get(facts, "tenant.name") ?? "").trim().split(/\s+/).pop() ?? "";
  const postcode = String(get(facts, "property.postcode") ?? "");
  const amount = get(facts, "deposit.amount");
  const paid = String(get(facts, "deposit.paidDate") ?? "");

  return (
    <div className="panel verify-panel">
      <p>Run the official “is my deposit protected?” search on all three government-backed schemes. Use these details:</p>
      <ul className="verify-details">
        <li>
          <span>Surname</span>
          <strong>{surname || "—"}</strong>
        </li>
        <li>
          <span>Postcode</span>
          <strong>{postcode || "—"}</strong>
        </li>
        <li>
          <span>Deposit amount</span>
          <strong>{amount != null ? `£${amount}` : "—"}</strong>
        </li>
        <li>
          <span>Date paid</span>
          <strong>{paid || "—"}</strong>
        </li>
      </ul>
      <div className="scheme-links">
        {SCHEMES.map((s) => (
          <a key={s.name} className="scheme-link" href={s.url} target="_blank" rel="noreferrer">
            Check {s.name} ↗
          </a>
        ))}
      </div>
      <p className="field-help">
        Screenshot every result. “No record found” on all three is your evidence that the deposit was never protected.
      </p>
    </div>
  );
}
