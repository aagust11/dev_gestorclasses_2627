import RecoveryHistory from './RecoveryHistory';
import {closedPeriod,periodCommentsFor,effectiveActivityStatus} from '../utils/recoveryModel';
import React from 'react';
import {AppState,Subject,Student,CalculationMode,CurricularActivity} from '../types';
import DetailPage from './DetailPage';
import StudentName from './StudentName';
import GradeComparison from './GradeComparison';
import {ReportGrade} from '../utils/studentReport';
import {GradeBadge} from './GradeControls';
import {periodGrades} from '../utils/gradeSelectors';
import {findTermRecord} from '../utils/termRecords';
import {annualProposals} from '../utils/studentReport';
import {sourceCriterionId} from '../utils/activityCriteria';
import {activityGradeLabel,activitySummary,getAspectScore,getCriterionScore,getCompSettings,scoreToCompetencial} from '../utils/gradeCalculations';

export type QualificationColumn={id:string;label:string;type:'criterion'|'competency'|'item'|'final';description?:string};
const methods:CalculationMode[]=['mean','median','mode'];
const names={mean:'Mitjana',median:'Mediana',mode:'Moda'};
const order=new Intl.Collator('ca',{numeric:true,sensitivity:'base'});
const fmt=(n:number|null|undefined)=>n==null?'—':n.toFixed(2);

export default function StudentQualificationPage({state,subject,student,students,activities,periodId,method,onPeriod,onMethod,onStudent,onBack,onComment,onEdit,onActivity}:{
 state:AppState;subject:Subject;student:Student;students:Student[];activities:CurricularActivity[];periodId:string;method:CalculationMode;
 onPeriod:(id:string)=>void;onMethod:(m:CalculationMode)=>void;onStudent:(id:string)=>void;onBack:()=>void;onComment:(id:string,text:string)=>void;onEdit:(column:QualificationColumn)=>void;onActivity:(id:string)=>void;
}){
 const locked=closedPeriod(state,subject.id,periodId);
 const index=students.findIndex(s=>s.id===student.id),numeric=subject.evaluationType==='numeric',settings=getCompSettings(subject);
 const term=state.config.terms.find(t=>t.id===periodId),periodName=periodId==='annual'?'Curs complet':term?.name||'';
 const all=Object.fromEntries(methods.map(m=>[m,periodGrades(state,subject,periodId,m)[student.id]]));
 const grade=all[method],automatic=periodGrades(state,subject,periodId,method,true)[student.id];
 const competencies=(locked?.competencies||state.competencies).filter(c=>c.subjectId===subject.id||c.subjectId===subject.parentId).sort((a,b)=>order.compare(a.key,b.key));
 const criteria=(locked?.criteria||state.criteria).filter(c=>competencies.some(ce=>ce.id===c.competencyId)).sort((a,b)=>order.compare(a.key,b.key));
 const summary=activitySummary(activities,student.id,subject),annual=periodId==='annual'?annualProposals(state,subject,student.id,method):null;
 const editGrade=(column:QualificationColumn,g:ReportGrade|undefined,auto:ReportGrade|undefined)=><button type="button" disabled={!!locked} className="grade-cell-button" aria-label={`Modificar ${column.label} de ${student.name}`} onClick={()=>onEdit(column)}><GradeComparison grade={g} automatic={auto}/></button>;
 return <DetailPage title={<StudentName official state={state} student={student}/>} subtitle={`${subject.name} · ${periodName} · ${index+1}/${students.length}`} onBack={onBack} actions={<>
  <button className="ds-button" disabled={index<=0} onClick={()=>onStudent(students[index-1].id)}>← Anterior</button>
  <button className="ds-button ds-primary" disabled={index>=students.length-1} onClick={()=>onStudent(students[index+1].id)}>Següent →</button>
 </>}>
  <div className="ds-panel flex flex-wrap gap-3 items-end">
   <label className="ds-field flex-1">Alumne/a<select value={student.id} onChange={e=>onStudent(e.target.value)}>{students.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
   <label className="ds-field">Període<select aria-label="Període" value={periodId} onChange={e=>onPeriod(e.target.value)}>{state.config.terms.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}<option value="annual">Curs complet</option></select></label>
   <label className="ds-field">Mètode<select value={method} onChange={e=>onMethod(e.target.value as CalculationMode)}>{methods.map(m=><option key={m} value={m}>{names[m]}</option>)}</select></label>
  </div>
  {state.config.terms.some(t=>t.isPreassessment&&t.parentTermId===periodId)&&<p className="text-sm text-slate-600">Aquest trimestre inclou la preavaluació i la resta del trimestre, sense duplicar activitats.</p>}
  {findTermRecord(state.termGradesRecords,subject.id,periodId,method)?.cleared&&<p className="text-sm text-amber-800">Notes esborrades. Pots recuperar el càlcul des de la vista general.</p>}
  <section className="ds-panel space-y-3"><h3 className="font-bold">Qualificació del període · escala 0–{numeric?10:4}</h3>
   <div className="grid grid-cols-2 md:grid-cols-4 gap-3"><div className="border rounded p-3"><h4 className="text-sm font-semibold">Nota final · {names[method]}</h4>{editGrade({id:'final',label:'Nota final',type:'final'},grade?.finalGrade,automatic?.finalGrade)}{grade?.finalGrade.autoFailed&&<small className="text-rose-700">{grade.finalGrade.failedCECount} CE suspeses</small>}</div>
   {methods.map(m=><div key={m} className="border rounded p-3"><h4 className="text-sm font-semibold">{names[m]} total</h4><GradeComparison grade={all[m]?.finalGrade} automatic={periodGrades(state,subject,periodId,m,true)[student.id]?.finalGrade}/></div>)}</div>
   <p className="text-xs text-slate-500">Els totals coincideixen amb la vista general. ✎ indica una nota manual; a sota es mostra el càlcul automàtic.</p>
   <label className="ds-field">Comentari del període<textarea rows={3} className="w-full resize-y" readOnly={!!locked} value={periodCommentsFor(state,subject.id,periodId)[student.id]||''} placeholder="Comentari compartit amb la vista general i els tres mètodes…" onChange={e=>onComment(student.id,e.target.value)}/></label>
   <p className="text-xs text-slate-500">Desat automàtic · NP / avaluades: {summary.np} / {summary.evaluated} · Fet: {summary.done} · No fet: {summary.notDone}</p>
  </section>
  {annual&&<section className="ds-panel space-y-3"><h3 className="font-bold">Trimestres i propostes de curs</h3><div className="flex flex-wrap gap-6">{annual.terms.map(t=><div key={t.term.id}><h4 className="font-semibold text-sm">{t.term.name}</h4><GradeComparison grade={t.actual} automatic={t.automatic}/></div>)}<div><h4 className="font-semibold text-sm">Proposta per trimestres</h4><GradeComparison grade={annual.termScore==null?undefined:{score:annual.termScore,qual:scoreToCompetencial(annual.termScore/(numeric?2.5:1),settings.thresholds)}}/><small>{annual.count}/{annual.total} trimestres</small></div><div><h4 className="font-semibold text-sm">Proposta per {numeric?'ítems':'competències'}</h4><GradeComparison grade={annual.fromActivities}/></div></div></section>}
  {numeric&&<section className="ds-panel space-y-2"><h3 className="font-bold">Ítems numèrics · escala 0–10</h3>{(subject.numericItems||[]).map(item=><div key={item.id} className="flex justify-between border-b py-2"><span>{item.code} · {item.name} · {item.weight}%</span>{editGrade({id:item.id,label:item.code,type:'item'},grade?.items?.[item.id],automatic?.items?.[item.id])}</div>)}</section>}
  <section className="ds-panel space-y-2"><h3 className="font-bold">Competències i criteris · escala 0–4</h3>{competencies.map(ce=><div key={ce.id} className="border rounded overflow-hidden"><div className="bg-slate-100 flex items-center justify-between gap-3 p-2"><div><strong>{ce.key}</strong><p className="text-sm text-slate-600">{ce.description}</p></div>{editGrade({id:ce.id,label:ce.key,type:'competency'},grade?.competencies?.[ce.id],automatic?.competencies?.[ce.id])}</div><details className="p-2"><summary className="cursor-pointer text-sm">Criteris avaluats</summary>{criteria.filter(c=>c.competencyId===ce.id&&grade?.criteria?.[c.id]?.score!=null).map(c=><div key={c.id} className="flex justify-between gap-3 border-b p-2 text-sm"><span><em>{c.key}</em> · {c.description}</span>{editGrade({id:c.id,label:c.key,type:'criterion'},grade?.criteria?.[c.id],automatic?.criteria?.[c.id])}</div>)}</details></div>)}{!competencies.length&&<p className="text-sm text-slate-500">No hi ha competències configurades.</p>}</section>
  <section className="space-y-3"><h3 className="font-bold">Activitats del període ({activities.length})</h3>{activities.map(a=>{
   const g={...a.grades?.[student.id],status:effectiveActivityStatus(a,student.id)},label=activityGradeLabel(a,student.id,subject);
   const slots=[...(a.numericAspects||[]).map(x=>({id:x.id,label:x.label,score:getAspectScore(a,student.id,x.id,subject)})),...(a.criteriaIds||[]).map(id=>({id,label:a.criteriaCustomLabels?.[id]||criteria.find(c=>c.id===sourceCriterionId(a,id))?.key||id,score:getCriterionScore(a,student.id,id,subject)}))];
   return <article key={a.id} className="ds-panel space-y-2"><div className="flex flex-wrap justify-between gap-2"><div><h4 className="font-semibold">{a.code} · {a.title}</h4><p className="text-xs text-slate-500">Lliurament: {a.endDate||'Sense data'} · Pes: {a.weight}</p></div><div className="flex gap-3 items-center">{['NP','Exempt','Fet','No fet'].includes(label)?<GradeBadge qual={label}/>:<strong>{label}</strong>}<RecoveryHistory state={state} activity={a} studentId={student.id}/><button disabled={!!locked} className="ds-button" onClick={()=>onActivity(a.id)}>Qualificar activitat</button></div></div>
   {a.assessmentType!=='completion'&&<div className="flex flex-wrap gap-3">{slots.map((slot,i)=><div key={`${i}:${slot.id}`} className="bg-slate-50 border rounded px-2 py-1 text-sm"><span className="font-medium mr-2">{slot.label}</span>{g?.status?<GradeBadge qual={g.status==='exempt'?'Exempt':'NP'}/>:<>{fmt(slot.score)} /4 {slot.score!=null&&<GradeBadge qual={scoreToCompetencial(slot.score,settings.thresholds)}/>}</>}</div>)}</div>}
   <p className="text-sm whitespace-pre-wrap"><strong>Comentari de l’alumne: </strong>{g?.comment||'—'}</p>
   {a.gradingComment&&<p className="text-sm whitespace-pre-wrap text-slate-600"><strong>Comentari general: </strong>{a.gradingComment}</p>}
  </article>;
  })}{!activities.length&&<p className="ds-panel text-slate-500">No hi ha activitats amb lliurament dins d’aquest període.</p>}</section>
 </DetailPage>;
}
