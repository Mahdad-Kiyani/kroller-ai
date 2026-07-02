import { CoveragePosition } from '@prisma/client';

export interface NeighbourDecision {
  decidedPosition: string | null;
  decidedComment: string | null;
  distance: number; // cosine distance 0..2 (0 = identical)
}
export interface PositionSuggestion {
  position: CoveragePosition;
  comment: string;
  score: number; // 0..1 confidence from similarity
}

/**
 * Turns retrieved precedent (past human decisions on similar warranties) into a single
 * suggestion: similarity-weighted majority vote on position, representative comment from
 * the closest matching precedent, and a confidence score from the nearest distance.
 * Pure + deterministic ⇒ fully unit-tested.
 */
export class SuggestionPolicy {
  static fromNeighbours(neighbours: NeighbourDecision[]): PositionSuggestion | null {
    const decided = neighbours.filter(
      (n): n is NeighbourDecision & { decidedPosition: string } => n.decidedPosition !== null,
    );
    if (decided.length === 0) return null;

    const weight = (d: number) => 1 / (1 + Math.max(0, d)); // closer ⇒ heavier
    const tally = new Map<string, number>();
    for (const n of decided) {
      tally.set(n.decidedPosition, (tally.get(n.decidedPosition) ?? 0) + weight(n.distance));
    }

    let winner = decided[0].decidedPosition;
    let best = -Infinity;
    for (const [pos, w] of tally) {
      if (w > best) {
        best = w;
        winner = pos;
      }
    }

    const ofWinner = decided.filter((n) => n.decidedPosition === winner).sort((a, b) => a.distance - b.distance);
    const nearest = ofWinner[0];
    const score = Math.max(0, Math.min(1, weight(nearest.distance)));

    const precedentNote = `${ofWinner.length}/${decided.length} similar warranties in past deals were ${winner}.`;
    const comment = nearest.decidedComment ? `${precedentNote} e.g. "${nearest.decidedComment}"` : precedentNote;

    return { position: winner as CoveragePosition, comment, score };
  }
}
