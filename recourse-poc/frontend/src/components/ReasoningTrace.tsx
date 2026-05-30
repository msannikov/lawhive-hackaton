export default function ReasoningTrace({ reasoning }: { reasoning: string[] }) {
  if (!reasoning?.length) return null;
  return (
    <details className="reasoning">
      <summary>Show the reasoning</summary>
      <ol>
        {reasoning.map((r, i) => (
          <li key={i}>{r}</li>
        ))}
      </ol>
    </details>
  );
}
