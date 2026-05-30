import type { CaseSummary } from "../types";

interface Props {
  cases: CaseSummary[];
  selected: string | null;
  onPick: (id: string) => void;
}

export default function CasePicker({ cases, selected, onPick }: Props) {
  return (
    <section className="picker">
      {cases.map((c) => (
        <button
          key={c.id}
          className={"case-card" + (selected === c.id ? " active" : "")}
          onClick={() => onPick(c.id)}
        >
          <span className="case-label">{c.label}</span>
          <span className="case-blurb">{c.blurb}</span>
        </button>
      ))}
    </section>
  );
}
