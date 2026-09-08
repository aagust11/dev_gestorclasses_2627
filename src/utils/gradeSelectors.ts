import {AppState,CalculationMode,Subject,TermStudentGrades} from '../types';
import {calculateSubjectMode,filterActivitiesForPeriod} from './gradeCalculations';
import {findTermRecord} from './termRecords';
type Grades=Record<string,TermStudentGrades>;
type Entry={refs:unknown[];fingerprint:string;results:Map<string,Grades>};
const cache=new WeakMap<Subject,Entry>();
let calculations=0;
export const gradeCalculationCount=()=>calculations;

// State updates are immutable. Unrelated comments and profile changes retain all
// dependencies. Activity comments may change the array but not the grade fingerprint.
function context(state:AppState,subject:Subject):Entry {
  const refs=[state.activities,state.criteria,state.competencies,state.config.terms,state.termGradesRecords];
  const old=cache.get(subject);
  if(old&&refs.every((r,i)=>r===old.refs[i]))return old;
  const activities=(state.activities||[]).filter(a=>a.subjectId===subject.id).map(a=>({id:a.id,endDate:a.endDate,weight:a.weight,criteriaIds:a.criteriaIds,criteriaReferences:a.criteriaReferences,criteriaWeights:a.criteriaWeights,criteriaMaxScores:a.criteriaMaxScores,numericItemId:a.numericItemId,numericGradingType:a.numericGradingType,grades:Object.fromEntries(Object.entries(a.grades||{}).map(([id,g])=>[id,{score:g.score,competencialScore:g.competencialScore,status:g.status,criteriaGrades:g.criteriaGrades}]))}));
  const fingerprint=JSON.stringify([activities,state.criteria,state.competencies,state.config.terms,(state.termGradesRecords||[]).filter(r=>r.subjectId===subject.id)],(key,value)=>key==='metrics'?undefined:value);
  const entry={refs,fingerprint,results:old?.fingerprint===fingerprint?old.results:new Map<string,Grades>()};
  cache.set(subject,entry);return entry;
}
export function periodGrades(state:AppState,subject:Subject,periodId:string,method:CalculationMode,automatic=false):Grades {
  const entry=context(state,subject),key=JSON.stringify([periodId,method,automatic]);
  const cached=entry.results.get(key);if(cached)return cached;
  const record=findTermRecord(state.termGradesRecords,subject.id,periodId,method);
  // Clearing grades suppresses effective results everywhere until recalculation.
  if(!automatic&&record?.cleared){const empty={};entry.results.set(key,empty);return empty;}
  const competencies=state.competencies.filter(c=>c.subjectId===subject.id||c.subjectId===subject.parentId);
  const criteria=state.criteria.filter(c=>competencies.some(ce=>ce.id===c.competencyId));
  const activities=filterActivitiesForPeriod(state.activities||[],subject.id,periodId,state.config.terms);
  const result=calculateSubjectMode(subject,activities,competencies,criteria,automatic?undefined:record?.students,method);
  calculations++;entry.results.set(key,result);return result;
}
