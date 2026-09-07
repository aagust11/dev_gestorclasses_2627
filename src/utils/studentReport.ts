import {AppState, CalculationMode, TermStudentGrades} from '../types';
import {studentPeriodGrade,studentSessionHistory,sessionComments} from './studentProfile';
export const reportMethods:CalculationMode[]=['mean','median','mode'];
export const reportMethodNames={mean:'Mitjana',median:'Mediana',mode:'Moda'};
export type ReportGrade={score?:number|null;qual?:string;isManual?:boolean};
export const gradeText=(g?:ReportGrade)=>g?.score==null?'Pendent':`${g.score.toFixed(2)} ${g.qual||''}`.trim();
export const comparedGradeText=(g?:ReportGrade,auto?:ReportGrade)=>`${gradeText(g)}${g?.isManual?` (manual; calculada: ${gradeText(auto)})`:''}`;
export function buildStudentReport(state:AppState,studentId:string) {
  const subjects=state.subjects.filter(s=>!s.isGeneral&&s.students.some(st=>st.id===studentId));
  const student=subjects.flatMap(s=>s.students).find(st=>st.id===studentId);
  if(!student)throw new Error('Alumne no disponible');
  const periods=[...state.config.terms.map(t=>({id:t.id,name:t.name})),{id:'annual',name:'Curs complet'}];
  const evaluations=subjects.filter(s=>!s.isParent).flatMap(subject=>periods.map(period=>{
    const actual=Object.fromEntries(reportMethods.map(m=>[m,studentPeriodGrade(state,subject,studentId,period.id,m)])) as Record<CalculationMode,TermStudentGrades>;
    const automatic=Object.fromEntries(reportMethods.map(m=>[m,studentPeriodGrade(state,subject,studentId,period.id,m,true)])) as Record<CalculationMode,TermStudentGrades>;
    const competencies=state.competencies.filter(c=>c.subjectId===subject.id||c.subjectId===subject.parentId).sort((a,b)=>a.key.localeCompare(b.key,'ca',{numeric:true}));
    return {subject,period,actual,automatic,competencies,comment:state.periodComments?.[subject.id]?.[period.id]?.[studentId]||''};
  }));
  const history=studentSessionHistory(state,studentId);
  return {name:student.name,subjects:subjects.map(s=>s.name),notes:state.studentProfiles?.[studentId]?.notes||'',supportMeasures:state.studentProfiles?.[studentId]?.supportMeasures?.trim()||'',additionalComments:state.studentProfiles?.[studentId]?.additionalComments?.trim()||'',evaluations,history,
    totals:{absent:history.filter(l=>l.studentLog.status==='absent').length,late:history.filter(l=>['late10','lateMore10'].includes(l.studentLog.status)).length,pos:history.reduce((n,l)=>n+sessionComments(l.studentLog,'pos').length,0),incident:history.reduce((n,l)=>n+sessionComments(l.studentLog,'incident').length,0)}};
}
export type StudentReport=ReturnType<typeof buildStudentReport>;
export function reportSections(report:StudentReport) {
  const sections:{title:string;headers:string[];rows:string[][]}[]=[];
  for(const id of [...new Set(report.evaluations.map(e=>e.subject.id))]){
    const evaluations=report.evaluations.filter(e=>e.subject.id===id);
    const name=evaluations[0].subject.name;
    sections.push({title:`Notes · ${name}`,headers:['Període',...reportMethods.map(m=>reportMethodNames[m]),'Comentari'],rows:evaluations.map(e=>[`${e.period.name} (/${e.subject.evaluationType==='numeric'?10:4})`,...reportMethods.map(m=>comparedGradeText(e.actual[m]?.finalGrade,e.automatic[m]?.finalGrade)),e.comment])});
    for(const e of evaluations)if(e.competencies.length)sections.push({title:`Competències · ${name} · ${e.period.name} (0–4)`,headers:['Competència',...reportMethods.map(m=>reportMethodNames[m])],rows:e.competencies.map(c=>[`${c.key} · ${c.description}`,...reportMethods.map(m=>comparedGradeText(e.actual[m]?.competencies[c.id],e.automatic[m]?.competencies[c.id]))])});
  }
  const statuses={present:'Present',absent:'Falta',late10:'Retard fins a 10 min',lateMore10:'Retard superior a 10 min'};
  sections.push({title:'Registres de les sessions',headers:['Data / assignatura','Assistència','Positius','Comentaris','Incidències'],rows:report.history.map(l=>[`${l.date.split('-').reverse().join('/')} · ${report.evaluations.find(e=>e.subject.id===l.subjectId)?.subject.name||''}`,statuses[l.studentLog.status]||'',...(['pos','regular','incident'] as const).map(k=>sessionComments(l.studentLog,k).join('\n'))])});
  return sections;
}

export function annualProposals(state:AppState,subject:import('../types').Subject,studentId:string,method:CalculationMode) {
  const terms=state.config.terms.map(term=>({term,actual:studentPeriodGrade(state,subject,studentId,term.id,method)?.finalGrade,automatic:studentPeriodGrade(state,subject,studentId,term.id,method,true)?.finalGrade}));
  const available=terms.filter(t=>t.actual?.score!=null);
  const score=available.length?available.reduce((n,t)=>n+t.actual.score,0)/available.length:null;
  return {terms,termScore:score,count:available.length,total:terms.length,fromActivities:studentPeriodGrade(state,subject,studentId,'annual',method,true)?.finalGrade};
}
