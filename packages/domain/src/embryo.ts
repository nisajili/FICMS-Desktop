export type EmbryoQuality = 'GOOD' | 'FAIR' | 'POOR';

export interface EmbryoGradeParts {
  blastocystStage?: number; // 1-6
  innerCellMass?: 'A' | 'B' | 'C';
  trophectoderm?: 'A' | 'B' | 'C';
}

export interface EmbryoGradeResult {
  grade: string;
  quality: EmbryoQuality;
  notes: string[];
}

/**
 * Configurable blastocyst grading (Gardner scale). A clinic may override the
 * mapping; the defaults below are widely used and safe to ship as a baseline.
 */
export function gradeBlastocyst(parts: EmbryoGradeParts): EmbryoGradeResult {
  const notes: string[] = [];
  const stage = parts.blastocystStage ?? 0;
  const icm = parts.innerCellMass ?? 'C';
  const te = parts.trophectoderm ?? 'C';

  let quality: EmbryoQuality = 'POOR';
  if (stage >= 3) {
    const score =
      (icm === 'A' ? 2 : icm === 'B' ? 1 : 0) + (te === 'A' ? 2 : te === 'B' ? 1 : 0);
    if (stage >= 5 && score >= 3) quality = 'GOOD';
    else if (stage >= 4 && score >= 2) quality = 'FAIR';
  }
  if (stage < 3) notes.push('Not yet a full blastocyst.');
  return { grade: `${stage}${icm}${te}`, quality, notes };
}

export const CULTURE_DAYS = [1, 2, 3, 4, 5, 6] as const;

export const EMBRYO_STAGES_BY_DAY: Record<number, string[]> = {
  1: ['2PN', '2PNx', '1PN', '0PN'],
  2: ['2-cell', '3-cell', '4-cell'],
  3: ['6-cell', '8-cell', 'compact', 'morula'],
  4: ['early blastocyst', 'blastocyst'],
  5: ['hatching blastocyst', 'hatched blastocyst'],
  6: ['hatched blastocyst']
};
