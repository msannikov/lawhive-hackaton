import type { NextMove as NextMoveT } from "../types";
import { formatDate } from "../lib/date";

interface Props {
  nextMove: NextMoveT;
  onOpenTool: (id: string) => void;
}

export default function NextMove({ nextMove, onOpenTool }: Props) {
  return (
    <button type="button" className="next-move" onClick={() => onOpenTool(nextMove.toolId)}>
      <span className="next-move-label">Your next move</span>
      <span className="next-move-title">{nextMove.title}</span>
      <span className="next-move-why">{nextMove.rationale}</span>
      <span className="next-move-due">
        By <strong>{formatDate(nextMove.deadline)}</strong>
      </span>
    </button>
  );
}
