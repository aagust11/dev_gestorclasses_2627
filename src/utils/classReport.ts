import {AppState,Subject,CalculationMode} from '../types';
import {periodGrades} from './gradeSelectors';
import {subjectAttendance} from './attendance';
import {getCompSettings,scoreToCompetencial} from './gradeCalculations';
import {comparedGradeText} from './studentReport';
import {ReportDocument} from './reportDocument';
export function classPeriodSummary(state:AppState,subject:Subject,periodId:string,method:CalculationMode){
  const grades=periodGrades(state,subject,periodId,method),automatic=periodGrades(state,subject,periodId,method,true);
  const counts={AE:0,AN:0,AS:0,NA:0};let pending=0;
  for(const student of subject.students){const grade=grades[student.id]?.finalGrade;if(grade?.score==null){pending++;continue;}const qual=grade.qual||scoreToCompetencial(grade.score/(subject.evaluationType==='numeric'?2.5:1),getCompSettings(subject).thresholds);if(qual in counts)counts[qual as keyof typeof counts]++;else pending++;}
  const total=subject.students.length;return {grades,automatic,counts,pending,total,percentages:Object.fromEntries(Object.entries(counts).map(([q,n])=>[q,total?100*n/total:0])) as Record<keyof typeof counts,number>};
}
export function buildClassReport(state:AppState,subject:Subject,periodId:string,method:CalculationMode):ReportDocument{
  const name=periodId==='annual'?'Curs complet':state.config.terms.find(t=>t.id===periodId)?.name||periodId;
  const summary=classPeriodSummary(state,subject,periodId,method),attendance=subjectAttendance(state,subject,periodId);
  const periods=[...state.config.terms].sort((a,b)=>a.startDate.localeCompare(b.startDate)||a.endDate.localeCompare(b.endDate));
  const evolution=periods.map(t=>({term:t,data:classPeriodSummary(state,subject,t.id,method)}));
  const annual=classPeriodSummary(state,subject,'annual',method);
  const distribution=(s:typeof summary)=>(['AE','AN','AS','NA'] as const).map(q=>`${s.counts[q]} (${s.percentages[q].toFixed(1)}%)`);
  return {title:`Informe de grup · ${subject.name} · ${name}`,filename:`Informe_${subject.name}_${name}`,teacher:state.config.teacherProfile,intro:[`Mètode: ${{mean:'Mitjana',median:'Mediana',mode:'Moda'}[method]}. Alumnat actiu: ${summary.total}. NA: ${summary.counts.NA}. Sense nota: ${summary.pending}.`,`Percentatges sobre tot l’alumnat actiu (${summary.total}); les notes pendents no es compten com a NA. Es respecten les notes manuals.`,`L’evolució compara el mateix alumnat actiu actual en cada període. La preavaluació està inclosa en el primer trimestre: no és un trimestre addicional.`],sections:[
    {title:'Distribució de qualificacions',headers:['Total','AE','AN','AS','NA','Sense nota'],rows:[[String(summary.total),...distribution(summary),String(summary.pending)]]},
    {title:'Evolució per períodes',headers:['Període','AE','AN','AS','NA','Sense nota'],rows:[...evolution.map(({term,data})=>[term.name,...distribution(data),String(data.pending)]),['Curs',...distribution(annual),String(annual.pending)]]},
    {title:'Seguiment individual del període',headers:['Alumne','Nota','Faltes','Retards','Comentari'],rows:subject.students.map(st=>[st.name,comparedGradeText(summary.grades[st.id]?.finalGrade,summary.automatic[st.id]?.finalGrade),String(attendance[st.id]?.absent||0),String(attendance[st.id]?.late||0),state.periodComments?.[subject.id]?.[periodId]?.[st.id]||''])},
    {title:'Evolució individual',headers:['Alumne',...periods.map(t=>t.name),'Curs'],rows:subject.students.map(st=>[st.name,...evolution.map(e=>comparedGradeText(e.data.grades[st.id]?.finalGrade,e.data.automatic[st.id]?.finalGrade)),comparedGradeText(annual.grades[st.id]?.finalGrade,annual.automatic[st.id]?.finalGrade)])}
  ]};
}
