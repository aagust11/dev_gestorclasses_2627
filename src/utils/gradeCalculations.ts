/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as XLSX from 'xlsx';
import { 
  Subject, 
  Competency, 
  EvalCriterion, 
  CurricularActivity, 
  Term, 
  TermStudentGrades, 
  TermGradesRecord,
  CompetencyEvaluationSettings 
} from '../types';

export const DEFAULT_COMP_SETTINGS: CompetencyEvaluationSettings = {
  values: {
    AE: 4.0,
    AN: 3.0,
    AS: 2.0,
    NA: 1.0,
  },
  thresholds: {
    AE: 3.75,
    AN: 2.75,
    AS: 2.00,
  },
  maxFailedCompetencies: 2,
};

// Standard colors for NA, AS, AN, AE
export const QUAL_COLORS = {
  NA: {
    bg: 'bg-rose-500',
    text: 'text-white',
    badge: 'bg-rose-100 text-rose-800 border-rose-200',
    border: 'border-rose-400',
    hex: '#ef4444' // Vermell
  },
  AS: {
    bg: 'bg-amber-400',
    text: 'text-amber-950',
    badge: 'bg-amber-100 text-amber-900 border-amber-200',
    border: 'border-amber-400',
    hex: '#f59e0b' // Groc
  },
  AN: {
    bg: 'bg-emerald-500',
    text: 'text-white',
    badge: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    border: 'border-emerald-400',
    hex: '#10b981' // Verd
  },
  AE: {
    bg: 'bg-blue-600',
    text: 'text-white',
    badge: 'bg-blue-100 text-blue-800 border-blue-200',
    border: 'border-blue-400',
    hex: '#2563eb' // Blau
  }
};

/**
 * Basic statistical calculations
 */
export function calculateMean(numbers: number[]): number | null {
  if (!numbers || numbers.length === 0) return null;
  const sum = numbers.reduce((acc, val) => acc + val, 0);
  return parseFloat((sum / numbers.length).toFixed(2));
}

export function calculateMedian(numbers: number[]): number | null {
  if (!numbers || numbers.length === 0) return null;
  const sorted = [...numbers].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 !== 0) {
    return parseFloat(sorted[mid].toFixed(2));
  }
  return parseFloat(((sorted[mid - 1] + sorted[mid]) / 2).toFixed(2));
}

export function calculateMode(values: (string | number)[]): string | number | null {
  if (!values || values.length === 0) return null;
  const counts: Record<string, number> = {};
  values.forEach(v => {
    const key = String(v);
    counts[key] = (counts[key] || 0) + 1;
  });

  let maxCount = 0;
  let bestVal: string = String(values[0]);

  // Order preference for competencials: AE > AN > AS > NA if tie
  const compPriority: Record<string, number> = { AE: 4, AN: 3, AS: 2, NA: 1 };

  Object.entries(counts).forEach(([val, count]) => {
    if (count > maxCount) {
      maxCount = count;
      bestVal = val;
    } else if (count === maxCount) {
      // Tie breaker
      if (compPriority[val] && compPriority[bestVal]) {
        if (compPriority[val] > compPriority[bestVal]) {
          bestVal = val;
        }
      }
    }
  });

  // Try returning number if original was number
  const numVal = Number(bestVal);
  if (!isNaN(numVal) && !compPriority[bestVal]) {
    return numVal;
  }
  return bestVal;
}

/**
 * Score conversion between 0-4 and AE, AN, AS, NA
 */
export function scoreToCompetencial(
  score: number | null | undefined, 
  thresholds = DEFAULT_COMP_SETTINGS.thresholds
): 'AE' | 'AN' | 'AS' | 'NA' {
  if (score === null || score === undefined || isNaN(score)) return 'NA';
  if (score >= thresholds.AE) return 'AE';
  if (score >= thresholds.AN) return 'AN';
  if (score >= thresholds.AS) return 'AS';
  return 'NA';
}

export function competencialToScore(
  qual: 'AE' | 'AN' | 'AS' | 'NA' | string | undefined, 
  values = DEFAULT_COMP_SETTINGS.values
): number {
  if (qual === 'AE') return values.AE;
  if (qual === 'AN') return values.AN;
  if (qual === 'AS') return values.AS;
  return values.NA;
}

/**
 * Filter activities applicable to a given period (term or annual)
 */
export function filterActivitiesForPeriod(
  activities: CurricularActivity[],
  subjectId: string,
  periodId: string, // 't1', 't2', 't3' or 'annual'
  terms: Term[]
): CurricularActivity[] {
  // Direct activities for this subject
  const subActs = activities.filter(a => a.subjectId === subjectId);

  if (periodId === 'annual') {
    return subActs;
  }

  const term = terms.find(t => t.id === periodId);
  if (!term) return subActs;

  return subActs.filter(a => {
    // Only count activities where the deadline is within the term dates (or matches termId)
    if (a.termId === periodId) return true;
    if (a.endDate && a.endDate >= term.startDate && a.endDate <= term.endDate) return true;
    return false;
  });
}

/**
 * Calculate grades for competencial subject
 */
export function calculateCompetencialTermGrades(
  subject: Subject,
  relevantActivities: CurricularActivity[],
  competencies: Competency[],
  criteria: EvalCriterion[],
  existingStudentData?: Record<string, TermStudentGrades>
): Record<string, TermStudentGrades> {
  const result: Record<string, TermStudentGrades> = {};
  const compSettings = subject.compSettings || DEFAULT_COMP_SETTINGS;
  const students = subject.students || [];

  // Index criteria by ID
  const criteriaMap = new Map<string, EvalCriterion>();
  criteria.forEach(c => criteriaMap.set(c.id, c));

  // Index competencies
  const compCriteriaMap = new Map<string, EvalCriterion[]>();
  competencies.forEach(comp => {
    const compCrit = criteria.filter(cr => cr.competencyId === comp.id);
    compCriteriaMap.set(comp.id, compCrit);
  });

  students.forEach(student => {
    const existing = existingStudentData?.[student.id];
    const criteriaResults: Record<string, { score: number; qual: string; isManual?: boolean }> = {};

    // 1. Calculate each Criterion grade
    criteria.forEach(crit => {
      // If manual override exists, preserve it unless recalced
      if (existing?.criteria?.[crit.id]?.isManual) {
        criteriaResults[crit.id] = { ...existing.criteria[crit.id] };
        return;
      }

      let weightedSum = 0;
      let totalWeight = 0;

      relevantActivities.forEach(act => {
        if (!act.criteriaIds.includes(crit.id)) return;

        const grade = act.grades?.[student.id];
        if (!grade) return;

        const critGrade = grade.criteriaGrades?.[crit.id];
        let score0to4: number | null = null;

        if (critGrade) {
          if (critGrade.competencialScore) {
            score0to4 = competencialToScore(critGrade.competencialScore, compSettings.values);
          } else if (typeof critGrade.rawScore === 'number') {
            const maxScore = act.criteriaMaxScores?.[crit.id] || 10;
            score0to4 = (critGrade.rawScore / maxScore) * 4;
          } else if (typeof critGrade.normalizedScore === 'number') {
            score0to4 = critGrade.normalizedScore;
          }
        } else if (typeof grade.score === 'number') {
          // Fallback legacy global activity score (0-10 -> 0-4)
          score0to4 = (grade.score / 10) * 4;
        } else if (grade.competencialScore) {
          score0to4 = competencialToScore(grade.competencialScore, compSettings.values);
        }

        if (score0to4 !== null && !isNaN(score0to4)) {
          const actWeight = act.weight || 1;
          const critWeight = act.criteriaWeights?.[crit.id] ?? 1;
          const combinedWeight = actWeight * critWeight;

          weightedSum += score0to4 * combinedWeight;
          totalWeight += combinedWeight;
        }
      });

      if (totalWeight > 0) {
        const avgScore = parseFloat((weightedSum / totalWeight).toFixed(2));
        criteriaResults[crit.id] = {
          score: avgScore,
          qual: scoreToCompetencial(avgScore, compSettings.thresholds)
        };
      } else if (existing?.criteria?.[crit.id]) {
        criteriaResults[crit.id] = { ...existing.criteria[crit.id] };
      } else {
        criteriaResults[crit.id] = {
          score: compSettings.values.NA,
          qual: 'NA'
        };
      }
    });

    // 2. Calculate each Competency grade
    const competencyResults: Record<string, { score: number; qual: string; isManual?: boolean }> = {};
    const competencyScoresList: number[] = [];
    const competencyQualsList: string[] = [];
    let failedCECount = 0;

    competencies.forEach(comp => {
      if (existing?.competencies?.[comp.id]?.isManual) {
        competencyResults[comp.id] = { ...existing.competencies[comp.id] };
        competencyScoresList.push(existing.competencies[comp.id].score);
        competencyQualsList.push(existing.competencies[comp.id].qual);
        if (existing.competencies[comp.id].qual === 'NA') {
          failedCECount++;
        }
        return;
      }

      const compCrits = compCriteriaMap.get(comp.id) || [];
      const critScores: number[] = [];

      compCrits.forEach(cr => {
        const res = criteriaResults[cr.id];
        if (res && typeof res.score === 'number') {
          critScores.push(res.score);
        }
      });

      if (critScores.length > 0) {
        const compAvg = calculateMean(critScores) || compSettings.values.NA;
        const compQual = scoreToCompetencial(compAvg, compSettings.thresholds);

        competencyResults[comp.id] = {
          score: compAvg,
          qual: compQual
        };
        competencyScoresList.push(compAvg);
        competencyQualsList.push(compQual);
        if (compQual === 'NA') {
          failedCECount++;
        }
      } else {
        competencyResults[comp.id] = {
          score: compSettings.values.NA,
          qual: 'NA'
        };
        competencyScoresList.push(compSettings.values.NA);
        competencyQualsList.push('NA');
        failedCECount++;
      }
    });

    // 3. Final Overall Grade
    const meanFinal = calculateMean(competencyScoresList) || compSettings.values.NA;
    const medianFinal = calculateMedian(competencyScoresList) || compSettings.values.NA;
    const modeFinal = calculateMode(competencyQualsList) || 'NA';

    const maxFailed = compSettings.maxFailedCompetencies;
    const autoFailed = maxFailed !== undefined && maxFailed > 0 && failedCECount >= maxFailed;

    let finalQual = scoreToCompetencial(meanFinal, compSettings.thresholds);
    if (autoFailed) {
      finalQual = 'NA';
    }

    // Check if final was manually set
    const finalScore = existing?.finalGrade?.isManual ? existing.finalGrade.score : meanFinal;
    const finalQualResult = existing?.finalGrade?.isManual ? existing.finalGrade.qual : finalQual;

    result[student.id] = {
      criteria: criteriaResults,
      competencies: competencyResults,
      finalGrade: {
        score: finalScore,
        qual: finalQualResult,
        isManual: existing?.finalGrade?.isManual,
        failedCECount,
        autoFailed
      },
      metrics: {
        mean: meanFinal,
        median: medianFinal,
        mode: modeFinal
      }
    };
  });

  return result;
}

/**
 * Calculate grades for numeric subject with items
 */
export function calculateNumericTermGrades(
  subject: Subject,
  relevantActivities: CurricularActivity[],
  existingStudentData?: Record<string, TermStudentGrades>
): Record<string, TermStudentGrades> {
  const result: Record<string, TermStudentGrades> = {};
  const students = subject.students || [];
  const items = subject.numericItems || [];

  students.forEach(student => {
    const existing = existingStudentData?.[student.id];
    const itemResults: Record<string, { score: number; isManual?: boolean }> = {};
    let weightedItemSum = 0;
    let totalItemWeight = 0;
    const itemScoresList: number[] = [];

    items.forEach(item => {
      if (existing?.items?.[item.id]?.isManual) {
        itemResults[item.id] = { ...existing.items[item.id] };
        weightedItemSum += existing.items[item.id].score * (item.weight || 0);
        totalItemWeight += item.weight || 0;
        itemScoresList.push(existing.items[item.id].score);
        return;
      }

      // Activities linked to this item
      const itemActs = relevantActivities.filter(a => a.numericItemId === item.id);
      let actSum = 0;
      let actWeightSum = 0;

      itemActs.forEach(act => {
        const grade = act.grades?.[student.id];
        if (!grade) return;

        let numScore: number | null = null;
        if (typeof grade.score === 'number') {
          numScore = grade.score;
        } else if (grade.competencialScore) {
          // Map competencial to 10
          if (grade.competencialScore === 'AE') numScore = 10;
          else if (grade.competencialScore === 'AN') numScore = 7.5;
          else if (grade.competencialScore === 'AS') numScore = 5.0;
          else numScore = 2.5;
        }

        if (numScore !== null) {
          const w = act.weight || 1;
          actSum += numScore * w;
          actWeightSum += w;
        }
      });

      const itemScore = actWeightSum > 0 ? parseFloat((actSum / actWeightSum).toFixed(2)) : 0;
      itemResults[item.id] = { score: itemScore };
      itemScoresList.push(itemScore);

      weightedItemSum += itemScore * (item.weight || 0);
      totalItemWeight += item.weight || 0;
    });

    const finalNumeric = totalItemWeight > 0 ? parseFloat((weightedItemSum / totalItemWeight).toFixed(2)) : 0;
    const mean = calculateMean(itemScoresList) || 0;
    const median = calculateMedian(itemScoresList) || 0;
    const mode = calculateMode(itemScoresList) || 0;

    let qualText = finalNumeric >= 8.5 ? 'Excel·lent' :
                   finalNumeric >= 7.0 ? 'Notable' :
                   finalNumeric >= 5.0 ? 'Aprovat' : 'Suspès';

    result[student.id] = {
      criteria: {},
      competencies: {},
      items: itemResults,
      finalGrade: {
        score: existing?.finalGrade?.isManual ? existing.finalGrade.score : finalNumeric,
        qual: existing?.finalGrade?.isManual ? existing.finalGrade.qual : qualText,
        isManual: existing?.finalGrade?.isManual
      },
      metrics: {
        mean,
        median,
        mode
      }
    };
  });

  return result;
}

/**
 * EXCEL EXPORT: Term or Annual Grades Table
 */
export function exportTermGradesToExcel(
  subject: Subject,
  periodName: string,
  criteria: EvalCriterion[],
  competencies: Competency[],
  gradesData: Record<string, TermStudentGrades>
) {
  const isCompetencial = subject.evaluationType !== 'numeric';
  const students = subject.students || [];

  const headers = ['ID Alumne', 'Nom Alumne'];

  if (isCompetencial) {
    // Criteria headers
    criteria.forEach(cr => {
      headers.push(`CA: ${cr.shortLabel || cr.key} (${cr.key})`);
    });

    // Competencies headers
    competencies.forEach(comp => {
      headers.push(`CE: ${comp.key} (Nota 0-4)`);
      headers.push(`CE: ${comp.key} (Qual.)`);
    });

    headers.push('CE Suspeses (NA)');
    headers.push('Mitjana Final');
    headers.push('Mediana Final');
    headers.push('Moda Final');
    headers.push('Qualificació Final');
  } else {
    // Numeric items headers
    (subject.numericItems || []).forEach(it => {
      headers.push(`Item: ${it.name} (${it.weight}%)`);
    });
    headers.push('Mitjana Items');
    headers.push('Mediana Items');
    headers.push('Moda Items');
    headers.push('Nota Final (0-10)');
    headers.push('Qualificació');
  }

  const rows: any[][] = [];

  students.forEach(st => {
    const data = gradesData[st.id];
    const row: any[] = [st.id, st.name];

    if (!data) {
      rows.push(row);
      return;
    }

    if (isCompetencial) {
      criteria.forEach(cr => {
        const crData = data.criteria?.[cr.id];
        row.push(crData ? `${crData.score} (${crData.qual})` : '-');
      });

      competencies.forEach(comp => {
        const compData = data.competencies?.[comp.id];
        row.push(compData ? compData.score : '-');
        row.push(compData ? compData.qual : '-');
      });

      row.push(data.finalGrade?.failedCECount ?? 0);
      row.push(data.metrics?.mean ?? data.finalGrade?.score ?? '-');
      row.push(data.metrics?.median ?? '-');
      row.push(data.metrics?.mode ?? '-');
      row.push(data.finalGrade?.qual ?? '-');
    } else {
      (subject.numericItems || []).forEach(it => {
        const itData = data.items?.[it.id];
        row.push(itData ? itData.score : 0);
      });
      row.push(data.metrics?.mean ?? '-');
      row.push(data.metrics?.median ?? '-');
      row.push(data.metrics?.mode ?? '-');
      row.push(data.finalGrade?.score ?? '-');
      row.push(data.finalGrade?.qual ?? '-');
    }

    rows.push(row);
  });

  // Create workbook
  const wb = XLSX.utils.book_new();
  const wsData = [
    [`DocentSuite - Qualificacions: ${subject.name} - ${periodName}`],
    [`Generat el: ${new Date().toLocaleDateString('ca-ES')} ${new Date().toLocaleTimeString('ca-ES')}`],
    [],
    headers,
    ...rows
  ];

  const ws = XLSX.utils.aoa_to_sheet(wsData);
  XLSX.utils.book_append_sheet(wb, ws, 'Qualificacions');

  const fileName = `Qualificacions_${subject.name.replace(/[^a-zA-Z0-9]/g, '_')}_${periodName.replace(/[^a-zA-Z0-9]/g, '_')}.xlsx`;
  XLSX.writeFile(wb, fileName);
}

/**
 * EXCEL EXPORT: Activities Grid Table
 */
export function exportActivitiesToExcel(
  subject: Subject,
  activities: CurricularActivity[],
  criteria: EvalCriterion[],
  students: Subject['students']
) {
  const wb = XLSX.utils.book_new();
  const headers = ['ID Alumne', 'Nom Alumne'];

  activities.forEach(act => {
    if (act.criteriaIds && act.criteriaIds.length > 0) {
      act.criteriaIds.forEach(critId => {
        const cr = criteria.find(c => c.id === critId);
        headers.push(`${act.code} [${cr?.shortLabel || cr?.key || critId}]`);
      });
    } else {
      headers.push(`${act.code}: ${act.title}`);
    }
    headers.push(`${act.code} (Comentari)`);
  });

  const rows: any[][] = [];

  students.forEach(st => {
    const row: any[] = [st.id, st.name];

    activities.forEach(act => {
      const grade = act.grades?.[st.id];

      if (act.criteriaIds && act.criteriaIds.length > 0) {
        act.criteriaIds.forEach(critId => {
          const crGrade = grade?.criteriaGrades?.[critId];
          if (crGrade?.competencialScore) {
            row.push(crGrade.competencialScore);
          } else if (crGrade?.rawScore !== undefined) {
            row.push(crGrade.rawScore);
          } else if (grade?.score !== undefined) {
            row.push(grade.score);
          } else {
            row.push('-');
          }
        });
      } else {
        if (grade?.competencialScore) {
          row.push(grade.competencialScore);
        } else if (grade?.score !== undefined) {
          row.push(grade.score);
        } else {
          row.push('-');
        }
      }

      row.push(grade?.comment || '');
    });

    rows.push(row);
  });

  const wsData = [
    [`DocentSuite - Tauler d'Activitats: ${subject.name}`],
    [`Generat el: ${new Date().toLocaleDateString('ca-ES')}`],
    [],
    headers,
    ...rows
  ];

  const ws = XLSX.utils.aoa_to_sheet(wsData);
  XLSX.utils.book_append_sheet(wb, ws, 'Activitats');

  const fileName = `Activitats_${subject.name.replace(/[^a-zA-Z0-9]/g, '_')}.xlsx`;
  XLSX.writeFile(wb, fileName);
}
