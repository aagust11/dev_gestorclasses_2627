import {CalculationMode,TermGradesRecord} from '../types';

// Older exports omitted the method. Only their exact legacy suffix supplies it.
export function recordMethod(r:TermGradesRecord):CalculationMode {
  if(r.calculationMode)return r.calculationMode;
  for(const mode of ['median','mode'] as const)if(r.id===`${r.subjectId}_${r.periodId}_${mode}`)return mode;
  return 'mean';
}
export function recordKey(r:TermGradesRecord):string {return JSON.stringify([r.subjectId,r.periodId,recordMethod(r)]);}
export function findTermRecord(records:TermGradesRecord[]|undefined,subjectId:string,periodId:string,method:CalculationMode){
  return records?.find(r=>r.subjectId===subjectId&&r.periodId===periodId&&recordMethod(r)===method);
}
export function putTermRecord(records:TermGradesRecord[]|undefined,next:TermGradesRecord):TermGradesRecord[]{
  return [...(records||[]).filter(r=>recordKey(r)!==recordKey(next)),next];
}
