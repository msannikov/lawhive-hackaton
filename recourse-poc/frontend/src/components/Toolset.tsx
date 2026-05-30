import type { Tool } from "../types";
import ToolCard from "./ToolCard";

interface Props {
  tools: Tool[];
  onOpenTool: (id: string) => void;
}

export default function Toolset({ tools, onOpenTool }: Props) {
  return (
    <div className="tool-grid">
      {tools.map((t) => (
        <ToolCard key={t.id} tool={t} onOpen={() => onOpenTool(t.id)} />
      ))}
    </div>
  );
}
