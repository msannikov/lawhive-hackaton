import type { TaxonomyArea } from "../types";

export type Step = "landing" | "subarea" | "intake" | "assessment" | "toolDetail";

const ORDER: Step[] = ["landing", "subarea", "intake", "assessment"];

interface Props {
  step: Step;
  area: TaxonomyArea | null;
  onNavigate: (s: Step) => void;
}

export default function Stepper({ step, area, onNavigate }: Props) {
  // toolDetail lives "inside" the assessment step for the breadcrumb.
  const effective: Step = step === "toolDetail" ? "assessment" : step;
  const labels: Record<Step, string> = {
    landing: "Problem area",
    subarea: area ? area.label : "Topic",
    intake: "Your details",
    assessment: "Your plan",
    toolDetail: "Your plan",
  };
  const currentIdx = ORDER.indexOf(effective);

  return (
    <nav className="stepper" aria-label="Progress">
      {ORDER.map((s, i) => {
        const reached = i <= currentIdx;
        const isCurrent = s === effective;
        const clickable = i < currentIdx;
        return (
          <span className="step-wrap" key={s}>
            <button
              className={"step" + (isCurrent ? " current" : "") + (reached ? " reached" : "")}
              disabled={!clickable}
              onClick={() => clickable && onNavigate(s)}
            >
              <span className="step-num">{i + 1}</span>
              {labels[s]}
            </button>
            {i < ORDER.length - 1 && <span className="step-sep" aria-hidden>›</span>}
          </span>
        );
      })}
    </nav>
  );
}
