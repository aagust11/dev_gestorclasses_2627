import {AppState,CurricularActivity} from '../types';
import {getActivityScore,getCriterionScore} from './gradeCalculations';
import {toIsoDate} from './dateHelpers';
export function resolveActivityStatus(state:AppState,activity:CurricularActivity,today=toIsoDate(new Date())){
  const subject=state.subjects.find(s=>s.id===activity.subjectId);
  const complete=(a:CurricularActivity,id:string)=>{
    if(a.grades?.[id]?.status==='exempt')return true;
    const owner=state.subjects.find(s=>s.id===a.subjectId);if(!owner)return false;
    return a.criteriaIds?.length?a.criteriaIds.every(c=>getCriterionScore(a,id,c,owner)!==null):getActivityScore(a,id,owner)!==null;
  };
  const enrolments=subject?.isParent?state.subjects.filter(s=>s.parentId===subject.id).flatMap(s=>s.students.map(student=>({student,subject:s}))):(subject?.students||[]).map(student=>({student,subject:subject!}));
  const gradedStudents=enrolments.filter(({student,subject:group})=>{
    const copy=subject?.isParent?(state.activities||[]).find(a=>a.subjectId===group.id&&a.code===activity.code):undefined;
    return complete(copy||activity,student.id);
  }).length;
  const isAuto=!activity.status||activity.status==='auto';
  const effectiveStatus=!isAuto?activity.status:enrolments.length>0&&gradedStudents===enrolments.length?'corrected':activity.startDate&&today<activity.startDate?'not_open':activity.endDate&&today>activity.endDate?'pending_correction':'open';
  return {effectiveStatus:effectiveStatus as 'not_open'|'open'|'pending_correction'|'corrected',isAuto,totalStudents:enrolments.length,gradedStudents};
}
export function activitiesOverview(state:AppState,period='annual',today=toIsoDate(new Date())){
  const term=state.config.terms.find(t=>t.id===period);
  const inPeriod=(a:CurricularActivity)=>period==='annual'||!!term&&a.endDate>=term.startDate&&a.endDate<=term.endDate;
  return state.subjects.filter(s=>!s.isGeneral).map(subject=>{
    const direct=(state.activities||[]).filter(a=>a.subjectId===subject.id);
    const own=direct.filter(inPeriod);
    const inherited=(state.activities||[]).filter(a=>a.subjectId===subject.parentId&&!direct.some(d=>d.code===a.code)&&inPeriod(a));
    const counts={not_open:0,open:0,pending_correction:0,corrected:0};
    own.forEach(a=>counts[resolveActivityStatus(state,a,today).effectiveStatus]++);
    return {subject,...counts,total:own.length,inherited:inherited.length};
  });
}
