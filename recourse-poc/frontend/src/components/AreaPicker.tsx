import type { Taxonomy, TaxonomyArea } from "../types";

interface Props {
  taxonomy: Taxonomy;
  onPick: (a: TaxonomyArea) => void;
}

export default function AreaPicker({ taxonomy, onPick }: Props) {
  return (
    <section>
      <h2 className="section-title">What do you need help with?</h2>
      <p className="section-sub">Pick the area closest to your problem. More are on the way.</p>
      <div className="picker">
        {taxonomy.areas.map((a) => {
          const live = a.status === "live";
          return (
            <button
              key={a.id}
              className={"case-card area-card" + (live ? "" : " coming-soon")}
              onClick={() => live && onPick(a)}
              disabled={!live}
            >
              <span className="area-icon" aria-hidden>
                {a.icon}
              </span>
              <span className="card-label">{a.label}</span>
              <span className="card-blurb">{a.blurb}</span>
              {!live && <span className="badge coming">Coming soon</span>}
            </button>
          );
        })}
      </div>
    </section>
  );
}
