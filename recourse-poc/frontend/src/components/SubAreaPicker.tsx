import type { TaxonomyArea, TaxonomyLeaf } from "../types";

interface Props {
  area: TaxonomyArea;
  onPick: (leaf: TaxonomyLeaf) => void;
  onBack: () => void;
}

export default function SubAreaPicker({ area, onPick, onBack }: Props) {
  return (
    <section>
      <button className="back-link" onClick={onBack}>
        ← All areas
      </button>
      <h2 className="section-title">
        {area.icon} {area.label}
      </h2>
      <p className="section-sub">Which best describes your situation?</p>
      <div className="picker">
        {area.subAreas.map((s) => {
          const live = s.status === "live";
          return (
            <button
              key={s.id}
              className={"case-card" + (live ? "" : " coming-soon")}
              onClick={() => live && onPick(s)}
              disabled={!live}
            >
              <span className="card-label">{s.label}</span>
              {s.blurb && <span className="card-blurb">{s.blurb}</span>}
              {!live && <span className="badge coming">Coming soon</span>}
            </button>
          );
        })}
      </div>
    </section>
  );
}
