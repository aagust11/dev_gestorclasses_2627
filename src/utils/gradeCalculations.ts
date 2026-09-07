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

export type CalculationMode = 'mean' | 'median' | 'mode';
export const QUAL_ORDER = ['NA', 'AS', 'AN', 'AE'] as const;
const round = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const valid = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);
const clamp = (n: number, max = 4) => Math.max(0, Math.min(max, n));

export function getCompSettings(subject?: Subject): CompetencyEvaluationSettings {
  return {
    values: { ...DEFAULT_COMP_SETTINGS.values, ...subject?.compSettings?.values },
    thresholds: { ...DEFAULT_COMP_SETTINGS.thresholds, ...subject?.compSettings?.thresholds },
    maxFailedCompetencies: subject?.compSettings?.maxFailedCompetencies ?? DEFAULT_COMP_SETTINGS.maxFailedCompetencies,
  };
}

// All three methods honour relative weights. Tied modes choose the lower score.
export function weightedStatistic(entries: { score: number; weight: number }[], mode: CalculationMode = 'mean'): number | null {
  const xs = entries.filter(x => valid(x.score) && valid(x.weight) && x.weight > 0).sort((a,b) => a.score-b.score);
  if (!xs.length) return null;
  const total = xs.reduce((s,x) => s+x.weight, 0);
  if (mode === 'mean') return xs.reduce((s,x) => s+x.score*x.weight, 0)/total;
  if (mode === 'mode') {
    const weights = new Map<number,number>();
    xs.forEach(x => weights.set(round(x.score), (weights.get(round(x.score)) || 0)+x.weight));
    let best = xs[0].score, max = -1;
    weights.forEach((w,score) => { if (w > max) { best=score; max=w; } });
    return best;
  }
  let cumulative = 0;
  for (let i=0;i<xs.length;i++) {
    cumulative += xs[i].weight;
    if (Math.abs(cumulative-total/2) < 1e-9 && xs[i+1]) return (xs[i].score+xs[i+1].score)/2;
    if (cumulative > total/2) return xs[i].score;
  }
  return xs[xs.length-1].score;
}

export function filterActivitiesForPeriod(activities: CurricularActivity[], subjectId: string, periodId: string, terms: Term[]): CurricularActivity[] {
  const acts = activities.filter(a => a.subjectId === subjectId);
  if (periodId === 'annual') return acts;
  const term = terms.find(t => t.id === periodId);
  if (!term) return [];
  return acts.filter(a => !!a.endDate && a.endDate >= term.startDate && a.endDate <= term.endDate);
}

// Raw numeric scores take precedence over their cached qualitative equivalent.
export function getCriterionScore(act: CurricularActivity, studentId: string, criterionId: string, subject: Subject): number | null {
  const settings = getCompSettings(subject), g = act.grades?.[studentId], cg = g?.criteriaGrades?.[criterionId];
  if (cg) {
    if (valid(cg.rawScore)) {
      const max = act.criteriaMaxScores?.[criterionId] ?? cg.maxScore ?? 10;
      return max > 0 ? clamp(cg.rawScore/max*4) : null;
    }
    if (cg.competencialScore) return settings.values[cg.competencialScore];
    if (valid(cg.normalizedScore)) return clamp(cg.normalizedScore);
    return null;
  }
  // A partially graded activity must not fill its ungraded criteria with its summary.
  if (g?.criteriaGrades) return null;
  if (act.numericGradingType === 'competencial' && g?.competencialScore) return settings.values[g.competencialScore];
  if (valid(g?.score)) return clamp(g.score/10*4);
  return g?.competencialScore ? settings.values[g.competencialScore] : null;
}

export function getActivityScore(act: CurricularActivity, studentId: string, subject: Subject): number | null {
  if (act.criteriaIds?.length) {
    return weightedStatistic(act.criteriaIds.map(id => ({ score: getCriterionScore(act,studentId,id,subject), weight: act.criteriaWeights?.[id] ?? 1 })).filter(x => valid(x.score)));
  }
  const g=act.grades?.[studentId], settings=getCompSettings(subject);
  if (act.numericGradingType === 'competencial' && g?.competencialScore) return settings.values[g.competencialScore];
  if (valid(g?.score)) return clamp(g.score/10*4);
  return g?.competencialScore ? settings.values[g.competencialScore] : null;
}

function computeCompetencial(subject: Subject, activities: CurricularActivity[], competencies: Competency[], criteria: EvalCriterion[], existing: Record<string,TermStudentGrades> | undefined, mode: CalculationMode) {
  const result: Record<string,TermStudentGrades>={}, settings=getCompSettings(subject);
  const asGrade=(score: number) => ({score,qual: scoreToCompetencial(score, settings.thresholds)});
  for (const st of subject.students) {
    const old=existing?.[st.id];
    const ca: TermStudentGrades['criteria']={}, ce: TermStudentGrades['competencies']={};
    for (const cr of criteria) {
      const manual=old?.criteria?.[cr.id];
      if (manual?.isManual && valid(manual.score)) { ca[cr.id]={...asGrade(manual.score),isManual:true}; continue; }
      const entries=activities.filter(a=>a.criteriaIds?.includes(cr.id)).map(a=>({score:getCriterionScore(a,st.id,cr.id,subject),weight:(a.weight ?? 1)*(a.criteriaWeights?.[cr.id] ?? 1)}));
      const score=weightedStatistic(entries,mode);
      if (score !== null) ca[cr.id]=asGrade(score);
    }
    for (const comp of competencies) {
      const manual=old?.competencies?.[comp.id];
      if (manual?.isManual && valid(manual.score)) { ce[comp.id]={...asGrade(manual.score),isManual:true}; continue; }
      const score=weightedStatistic(criteria.filter(c=>c.competencyId===comp.id && ca[c.id]).map(c=>({score:ca[c.id].score,weight:1})),mode);
      if (score !== null) ce[comp.id]=asGrade(score);
    }
    const failed=Object.values(ce).filter(x=>x.score < settings.thresholds.AS).length;
    const autoFailed=!!settings.maxFailedCompetencies && failed>=settings.maxFailedCompetencies;
    const score=weightedStatistic(Object.values(ce).map(x=>({score:x.score,weight:1})),mode);
    const manual=old?.finalGrade?.isManual && valid(old.finalGrade.score);
    const finalScore=manual ? old.finalGrade.score : score;
    result[st.id]={criteria:ca,competencies:ce,finalGrade:{score:finalScore,qual:finalScore === null ? '' : autoFailed ? 'NA' : scoreToCompetencial(finalScore,settings.thresholds),isManual:manual,failedCECount:failed,autoFailed}};
  }
  return result;
}

export function calculateCompetencialTermGrades(subject: Subject, activities: CurricularActivity[], competencies: Competency[], criteria: EvalCriterion[], existing?: Record<string,TermStudentGrades>, mode: CalculationMode = 'mean'): Record<string,TermStudentGrades> {
  const all=Object.fromEntries((['mean','median','mode'] as const).map(m=>[m,computeCompetencial(subject,activities,competencies,criteria,existing,m)]));
  const result=all[mode];
  for (const st of subject.students) result[st.id].metrics={mean:all.mean[st.id].finalGrade.score,median:all.median[st.id].finalGrade.score,mode:all.mode[st.id].finalGrade.score};
  return result;
}

function computeNumeric(subject: Subject, activities: CurricularActivity[], existing: Record<string,TermStudentGrades> | undefined, mode: CalculationMode) {
  const result: Record<string,TermStudentGrades>={}, settings=getCompSettings(subject);
  for (const st of subject.students) {
    const old=existing?.[st.id], items: NonNullable<TermStudentGrades['items']>={};
    for (const item of subject.numericItems || []) {
      const manual=old?.items?.[item.id];
      if (manual?.isManual && valid(manual.score)) { items[item.id]={...manual}; continue; }
      const score=weightedStatistic(activities.filter(a=>a.numericItemId===item.id).map(a=>{const s=getActivityScore(a,st.id,subject);return {score:s === null ? null : s*2.5,weight:a.weight ?? 1};}),mode);
      if (score !== null) items[item.id]={score};
    }
    const score=weightedStatistic((subject.numericItems || []).filter(i=>items[i.id]).map(i=>({score:items[i.id].score,weight:i.weight})),mode);
    const manual=old?.finalGrade?.isManual && valid(old.finalGrade.score);
    const final=manual ? old.finalGrade.score : score;
    result[st.id]={criteria:{},competencies:{},items,finalGrade:{score:final,qual:final === null ? '' : scoreToCompetencial(final/2.5,settings.thresholds),isManual:manual}};
  }
  return result;
}

export function calculateNumericTermGrades(subject: Subject, activities: CurricularActivity[], existing?: Record<string,TermStudentGrades>, mode: CalculationMode = 'mean'): Record<string,TermStudentGrades> {
  const all=Object.fromEntries((['mean','median','mode'] as const).map(m=>[m,computeNumeric(subject,activities,existing,m)]));
  const result=all[mode];
  for (const st of subject.students) result[st.id].metrics={mean:all.mean[st.id].finalGrade.score,median:all.median[st.id].finalGrade.score,mode:all.mode[st.id].finalGrade.score};
  return result;
}
function workbook(title: string, headers: string[], rows: (string|number|null)[][], sheetName: string) {
  const wb=XLSX.utils.book_new(), ws=XLSX.utils.aoa_to_sheet([[title],[],headers,...rows]);
  ws['!cols']=headers.map((h,index)=>({wch:index===1?28:Math.min(32,Math.max(14,h.length))}));
  if(rows.length)ws['!autofilter']={ref:XLSX.utils.encode_range({r:2,c:0},{r:rows.length+2,c:headers.length-1})};
  XLSX.utils.book_append_sheet(wb,ws,sheetName);
  return wb;
}
const exportNumber=(n:unknown)=>valid(n)?round(n):null;
const safeName=(s:string)=>s.replace(/[^a-zA-Z0-9À-ÿ_-]/g,'_').slice(0,90);

export function buildTermGradesWorkbook(subject: Subject, periodName: string, criteria: EvalCriterion[], competencies: Competency[], grades: Record<string,TermStudentGrades>) {
  const numeric=subject.evaluationType==='numeric';
  const headers=['ID Alumne','Nom Alumne'];
  if(numeric)(subject.numericItems||[]).forEach(i=>headers.push(`${i.code} · ${i.name} (${i.weight}%)`));
  else {
    criteria.forEach(c=>headers.push(`CA ${c.shortLabel||c.key} /4`,`CA ${c.shortLabel||c.key} · Qual.`));
    competencies.forEach(c=>headers.push(`CE ${c.key} /4`,`CE ${c.key} · Qual.`));
    headers.push('CE suspeses','NA pel límit de CE');
  }
  headers.push('Mitjana total','Mediana total','Moda total',`Nota final /${numeric?10:4}`,'Qualificació final','Nota final manual');
  const rows=subject.students.map(st=>{
    const g=grades[st.id],row:(string|number|null)[]=[st.id,st.name];
    if(numeric)(subject.numericItems||[]).forEach(i=>row.push(exportNumber(g?.items?.[i.id]?.score)));
    else {
      criteria.forEach(c=>row.push(exportNumber(g?.criteria?.[c.id]?.score),g?.criteria?.[c.id]?.qual||''));
      competencies.forEach(c=>row.push(exportNumber(g?.competencies?.[c.id]?.score),g?.competencies?.[c.id]?.qual||''));
      row.push(g?.finalGrade.failedCECount??null,g?.finalGrade.autoFailed?'Sí':'');
    }
    row.push(exportNumber(g?.metrics?.mean),exportNumber(g?.metrics?.median),exportNumber(g?.metrics?.mode),exportNumber(g?.finalGrade.score),g?.finalGrade.qual||'',g?.finalGrade.isManual?'Sí':'');
    return row;
  });
  return workbook(`${subject.name} · ${periodName}`,headers,rows,'Qualificacions');
}
export function exportTermGradesToExcel(subject: Subject, periodName: string, criteria: EvalCriterion[], competencies: Competency[], grades: Record<string,TermStudentGrades>) {
  XLSX.writeFile(buildTermGradesWorkbook(subject,periodName,criteria,competencies,grades),`Qualificacions_${safeName(subject.name)}_${safeName(periodName)}.xlsx`);
}
export function buildActivitiesWorkbook(subject:Subject,activities:CurricularActivity[],criteria:EvalCriterion[],students:Subject['students']) {
  const settings=getCompSettings(subject), headers=['ID Alumne','Nom Alumne'];
  activities.forEach(a=>{
    (a.criteriaIds||[]).forEach(id=>{
      const c=criteria.find(c=>c.id===id),label=a.criteriaCustomLabels?.[id]||c?.shortLabel||c?.key||id;
      headers.push(`${a.code} · ${label} · Puntuació`,`${a.code} · ${label} · Màxim`,`${a.code} · ${label} /4`,`${a.code} · ${label} · Qual.`);
    });
    headers.push(`${a.code} · Global /${subject.evaluationType==='numeric'?10:4}`,`${a.code} · Qual.`,`${a.code} · Comentari`);
  });
  const rows=students.map(st=>{
    const row:(string|number|null)[]=[st.id,st.name];
    activities.forEach(a=>{
      (a.criteriaIds||[]).forEach(id=>{
        const cg=a.grades?.[st.id]?.criteriaGrades?.[id],score=getCriterionScore(a,st.id,id,subject);
        row.push(valid(cg?.rawScore)?cg.rawScore:cg?.competencialScore||null,valid(cg?.rawScore)?a.criteriaMaxScores?.[id]??cg.maxScore??10:null,exportNumber(score),score===null?'':scoreToCompetencial(score,settings.thresholds));
      });
      const score=getActivityScore(a,st.id,subject);
      row.push(score===null?null:round(score*(subject.evaluationType==='numeric'?2.5:1)),score===null?'':scoreToCompetencial(score,settings.thresholds),a.grades?.[st.id]?.comment||'');
    });
    return row;
  });
  return workbook(`${subject.name} · Notes de les activitats`,headers,rows,'Activitats');
}
export function exportActivitiesToExcel(subject: Subject, activities: CurricularActivity[], criteria: EvalCriterion[], students: Subject['students']) {
  XLSX.writeFile(buildActivitiesWorkbook(subject,activities,criteria,students),`Activitats_${safeName(subject.name)}.xlsx`);
}
