import {periodGrades} from '../utils/gradeSelectors';
import {findTermRecord,putTermRecord} from '../utils/termRecords';
import StudentName from './StudentName';
import {annualProposals} from '../utils/studentReport';
import GradeComparison from './GradeComparison';
import { ChevronDown, ChevronRight, RefreshCw } from 'lucide-react';
import {sourceCriterionId} from '../utils/activityCriteria';
import React, { useState } from 'react';
import { AppState, TermStudentGrades, CalculationMode } from '../types';
import { calculateSubjectMode, filterActivitiesForPeriod, getCompSettings, getActivityScore, getCriterionScore, scoreToCompetencial, exportActivitiesToExcel, exportTermGradesToExcel } from '../utils/gradeCalculations';
import DetailPage from './DetailPage';
import ActivityGradePage from './ActivityGradePage';
import { GradeBadge, GradeButtons } from './GradeControls';

type Column = {id:string;label:string;type:'criterion'|'competency'|'item'|'final';description?:string};
const METHODS: CalculationMode[]=['mean','median','mode'];
const METHOD_NAMES={mean:'Mitjana',median:'Mediana',mode:'Moda'};
const identifierOrder=new Intl.Collator('ca',{numeric:true,sensitivity:'base'});
const columnClass=(col:Column)=>`summary-${col.type}${col.type==='competency'||col.type==='final'?' summary-divider':''}`;
const fmt=(n:unknown)=>typeof n==='number' && Number.isFinite(n)?n.toFixed(2):'—';

export default function QualificacionsView({state,onChangeState}:{state:AppState;onChangeState:(s:AppState,base?:AppState)=>void}) {
  const subjects=state.subjects.filter(s=>!s.isGeneral && !s.isParent);
  const [subjectId,setSubjectId]=useState(subjects[0]?.id||'');
  const [periodId,setPeriodId]=useState(state.config.terms[0]?.id||'annual');
  const [view,setView]=useState<'summary'|'activities'>('summary');
  const [method,setMethod]=useState<CalculationMode>('mean');
  const [search,setSearch]=useState('');
  const [expanded,setExpanded]=useState<Record<string,boolean>>({});
  const [gradingId,setGradingId]=useState<string|null>(null);
  const [edit,setEdit]=useState<{studentId:string;column:Column;value:string;base:AppState}|null>(null);
  const subject=subjects.find(s=>s.id===subjectId) || subjects[0];
  if (!subject) return <div className="ds-panel">Crea una assignatura amb alumnat a Configuració per veure les qualificacions.</div>;
  const numeric=subject.evaluationType==='numeric', settings=getCompSettings(subject);
  const periodName=periodId==='annual'?'Curs complet':state.config.terms.find(t=>t.id===periodId)?.name || '';
  const activities=filterActivitiesForPeriod(state.activities||[],subject.id,periodId,state.config.terms).sort((a,b)=>a.endDate.localeCompare(b.endDate)||a.code.localeCompare(b.code));
  const competencies=state.competencies.filter(c=>c.subjectId===subject.id||c.subjectId===subject.parentId).sort((a,b)=>identifierOrder.compare(a.key,b.key));
  const criteria=state.criteria.filter(c=>competencies.some(x=>x.id===c.competencyId)).sort((a,b)=>identifierOrder.compare(a.key,b.key));
  const students=subject.students.filter(st=>st.name.toLocaleLowerCase().includes(search.toLocaleLowerCase()));
  const recordId=(m:CalculationMode)=>`${subject.id}_${periodId}_${m}`;
  const record=(m:CalculationMode)=>findTermRecord(state.termGradesRecords,subject.id,periodId,m);
  const calculate=(m:CalculationMode,existing?:Record<string,TermStudentGrades>)=>calculateSubjectMode(subject,activities,competencies,criteria,existing,m);
  const all=Object.fromEntries(METHODS.map(m=>[m,periodGrades(state,subject,periodId,m)])) as Record<CalculationMode,Record<string,TermStudentGrades>>;
  const data=all[method];
  const annual=periodId==='annual'?Object.fromEntries(students.map(st=>[st.id,annualProposals(state,subject,st.id,method)])):{};
  const expansionKey=(id:string)=>JSON.stringify([subject.id,periodId,id]);
  const evaluatedCriteria=(id:string)=>criteria.filter(c=>c.competencyId===id && METHODS.some(m=>Object.values(all[m]).some(g=>g.criteria?.[c.id]?.score!=null)));
  const comments=state.periodComments?.[subject.id]?.[periodId]||{};
  const setComment=(studentId:string,value:string)=>onChangeState({...state,periodComments:{...state.periodComments,[subject.id]:{...state.periodComments?.[subject.id],[periodId]:{...comments,[studentId]:value}}}});
  const columns:Column[]=numeric?(subject.numericItems||[]).map(i=>({id:i.id,label:`${i.code} · ${i.weight}%`,description:i.name,type:'item'})):competencies.flatMap(c=>[
    ...(expanded[expansionKey(c.id)]?evaluatedCriteria(c.id).map(ca=>({id:ca.id,label:ca.key,description:ca.description,type:'criterion' as const})):[]),
    {id:c.id,label:c.key,description:c.description,type:'competency' as const}
  ]);
  columns.push({id:'final',label:'Nota final',type:'final'});
  const cell=(st:TermStudentGrades|undefined,col:Column)=>col.type==='criterion'?st?.criteria?.[col.id]:col.type==='competency'?st?.competencies?.[col.id]:col.type==='item'?st?.items?.[col.id]:st?.finalGrade;
  const save=(grades:Record<string,TermStudentGrades>,cleared=false)=>onChangeState({...state,termGradesRecords:putTermRecord(state.termGradesRecords,{id:recordId(method),subjectId:subject.id,periodId,calculationMode:method,students:grades,cleared})},edit?.base);
  const recalcColumn=(col:Column)=>{
    const next=structuredClone(data);
    Object.values(next).forEach(st=>{const c=cell(st,col);if(c)c.isManual=false;});
    save(calculate(method,next));
  };
  const clear=()=>{if(window.confirm(`Esborrar les notes calculades i manuals de ${periodName}, en les tres vistes? Les notes originals de les activitats es conserven.`))onChangeState({...state,termGradesRecords:[...(state.termGradesRecords||[]).filter(r=>!(r.subjectId===subject.id&&r.periodId===periodId)),...METHODS.map(m=>({id:recordId(m),subjectId:subject.id,periodId,calculationMode:m,students:{},cleared:true}))]});};
  const exportSummary=()=>{
    const enriched=Object.fromEntries(Object.entries(data).map(([id,g])=>[id,{...g,metrics:{mean:all.mean[id]?.finalGrade.score,median:all.median[id]?.finalGrade.score,mode:all.mode[id]?.finalGrade.score}}]));
    exportTermGradesToExcel(subject,`${periodName} · ${METHOD_NAMES[method]}`,criteria,competencies,enriched,comments);
  };
  const grading=(state.activities||[]).find(a=>a.id===gradingId && a.subjectId===subject.id);
  if(grading) return <ActivityGradePage state={state} activity={grading} subject={subject} onChange={onChangeState} onBack={()=>setGradingId(null)}/>;
  if(edit) {
    const st=subject.students.find(s=>s.id===edit.studentId), max=numeric?10:4;
    const value=Number(edit.value), qual=edit.value===''?'':scoreToCompetencial(value/(numeric?2.5:1),settings.thresholds);
    const submit=(e:React.FormEvent)=>{e.preventDefault();if(edit.value===''||!Number.isFinite(value)||value<0||value>max)return;
      const next=structuredClone(data), g=next[edit.studentId]||{criteria:{},competencies:{},items:{},finalGrade:{score:null,qual:''}};
      const result={score:value,qual,isManual:true};
      if(edit.column.type==='criterion')g.criteria[edit.column.id]=result;
      else if(edit.column.type==='competency')g.competencies[edit.column.id]=result;
      else if(edit.column.type==='item')g.items={...g.items,[edit.column.id]:result};
      else g.finalGrade={...g.finalGrade,...result};
      next[edit.studentId]=g;save(calculate(method,next));setEdit(null);
    };
    return <DetailPage title={`Modificar ${edit.column.label}`} subtitle={`${st?.name} · ${subject.name} · ${periodName} · ${METHOD_NAMES[method]}`} onBack={()=>setEdit(null)}><form className="ds-panel space-y-4 max-w-2xl" onSubmit={submit}><label className="ds-field">Puntuació sobre {max}<input autoFocus required type="number" min="0" max={max} step="0.01" value={edit.value} onChange={e=>setEdit({...edit,value:e.target.value})}/></label><GradeButtons label="Assignar qualificació" value={qual} onChange={q=>setEdit({...edit,value:String(settings.values[q]*(numeric?2.5:1))})}/><p className="text-sm text-slate-500">Aquesta nota queda fixada manualment. Els resultats que en depenen es recalculen respectant les altres notes manuals i el límit de CE suspeses.</p><div className="flex gap-2"><button className="ds-button ds-primary" type="submit">Desar i recalcular</button><button className="ds-button" type="button" onClick={()=>{const next=structuredClone(data),c=cell(next[edit.studentId],edit.column);if(c)c.isManual=false;save(calculate(method,next));setEdit(null);}}>Tornar al càlcul automàtic</button></div></form></DetailPage>;
  }
  return <section className="space-y-4 qualifications-page">
    <header className="page-heading"><div><h2 className="text-xl font-bold">Qualificacions</h2><p className="text-sm text-slate-500">{subject.name} · {periodName} · {subject.students.length} alumnes · {activities.length} activitats</p></div><button className="ds-button" onClick={()=>view==='activities'?exportActivitiesToExcel(subject,activities,criteria,subject.students):exportSummary()}>Exportar Excel</button></header>
    <div className="ds-panel flex flex-wrap gap-3 items-end"><label className="ds-field flex-1 min-w-48">Assignatura<select value={subject.id} onChange={e=>{setSubjectId(e.target.value);setSearch('');}}>{subjects.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label><label className="ds-field">Període<select value={periodId} onChange={e=>setPeriodId(e.target.value)}>{state.config.terms.map(t=><option value={t.id} key={t.id}>{t.name}</option>)}<option value="annual">Curs complet</option></select></label><label className="ds-field">Alumne<input placeholder="Cercar…" value={search} onChange={e=>setSearch(e.target.value)}/></label></div>
    <div className="flex flex-wrap justify-between items-center gap-3"><div className="ds-tabs"><button className={view==='activities'?'active':''} onClick={()=>setView('activities')}>Notes de les activitats</button><button className={view==='summary'?'active':''} onClick={()=>setView('summary')}>Resum del trimestre / curs</button></div>{view==='summary'&&<div className="ds-tabs" aria-label="Mètode de càlcul">{METHODS.map(m=><button key={m} className={method===m?'active':''} onClick={()=>setMethod(m)}>{METHOD_NAMES[m]}</button>)}</div>}</div>
    {view==='activities'?<div className="grade-table-wrap"><table className="grade-table"><thead><tr><th rowSpan={2}>Alumne/a</th>{activities.map(a=><th key={a.id} colSpan={(a.criteriaIds?.length||0)+1} className="text-center"><button className="text-blue-700 font-bold" onClick={()=>setGradingId(a.id)} title={`Avaluar ${a.title}`}>{a.code} · {a.title}</button><span className="block text-xs font-normal">{a.endDate}</span></th>)}</tr><tr>{activities.flatMap(a=>[...(a.criteriaIds||[]).map(id=><th key={a.id+id} title={criteria.find(c=>c.id===sourceCriterionId(a,id))?.description}>{a.criteriaCustomLabels?.[id]||criteria.find(c=>c.id===sourceCriterionId(a,id))?.key||id}</th>),<th key={a.id+'total'}>Global {numeric?'/10':'/4'}</th>])}</tr></thead><tbody>{students.map(st=><tr key={st.id}><td className="student-cell"><StudentName state={state} student={st}/></td>{activities.flatMap(a=>[...(a.criteriaIds||[]).map(id=>{const score=getCriterionScore(a,st.id,id,subject),g=a.grades?.[st.id]?.criteriaGrades?.[id];return <td key={a.id+id}><button className="grade-cell-button" onClick={()=>setGradingId(a.id)}>{a.grades?.[st.id]?.status?<><GradeBadge qual={a.grades[st.id].status==='not_submitted'?'NP':'Exempt'}/>{a.grades[st.id].status==='not_submitted'&&<span>0</span>}</>:score===null?'—':<><span>{g?.rawScore!==undefined?`${fmt(g.rawScore)} / ${a.criteriaMaxScores?.[id]??g.maxScore??10}`:fmt(score)}</span><GradeBadge qual={scoreToCompetencial(score,settings.thresholds)}/></>}</button></td>;}),<td key={a.id+'total'}><button className="grade-cell-button" onClick={()=>setGradingId(a.id)} title={a.grades?.[st.id]?.comment||'Avaluar activitat'}>{(()=>{const score=getActivityScore(a,st.id,subject);return a.grades?.[st.id]?.status?<><GradeBadge qual={a.grades[st.id].status==='not_submitted'?'NP':'Exempt'}/>{a.grades[st.id].status==='not_submitted'&&<b>0</b>}</>:score===null?'—':<><b>{fmt(score*(numeric?2.5:1))}</b><GradeBadge qual={scoreToCompetencial(score,settings.thresholds)}/></>;})()}</button></td>])}</tr>)}</tbody></table>{!activities.length&&<p className="p-6 text-slate-500">No hi ha activitats amb lliurament dins d’aquest període.</p>}</div>:<>
      {record(method)?.cleared&&<p className="text-sm text-amber-800">Notes esborrades: pendents a totes les vistes fins que premis «Calcular des de les activitats».</p>}
      <div className="flex flex-wrap gap-2"><button className="ds-button ds-primary" onClick={()=>{const manual=Object.values(data).some(g=>g.finalGrade.isManual||Object.values(g.criteria).some(c=>c.isManual)||Object.values(g.competencies).some(c=>c.isManual)||Object.values(g.items||{}).some(c=>c.isManual));if(!manual||window.confirm('Recalcular aquesta vista des de les activitats i substituir les notes manuals?'))save(calculate(method));}}>Calcular des de les activitats</button><button className="ds-button" onClick={()=>save(calculate(method,data))}>Recalcular respectant notes manuals</button><button className="ds-button text-rose-700" onClick={clear}>Esborrar notes del període</button></div>
      {periodId==='annual'&&<p className="text-sm text-slate-600">Proposta per trimestres: mitjana amb el mateix pes, emprant les notes manuals quan n’hi ha. Els trimestres pendents no compten. La proposta per {numeric?'ítems':'competències'} es calcula directament amb totes les activitats del curs, sense modificacions manuals. Les propostes no substitueixen la nota final.</p>}
      <p className="text-sm text-slate-600">Escala {numeric?'0–10':'0–4'}. AS ≥ {settings.thresholds.AS*(numeric?2.5:1)} · AN ≥ {settings.thresholds.AN*(numeric?2.5:1)} · AE ≥ {settings.thresholds.AE*(numeric?2.5:1)}{!numeric&&!!settings.maxFailedCompetencies&&` · ${settings.maxFailedCompetencies} CE suspeses o més → NA final`}. <span className="text-amber-700">✎ Nota manual</span></p>
      <div className="grade-table-wrap"><table className="grade-table"><thead><tr><th>Alumne/a</th>{columns.map(col=><th key={col.id} title={col.description} className={columnClass(col)}><div className="flex items-center gap-1">{col.type==='competency'?<button className="inline-flex items-center gap-1" aria-expanded={!!expanded[expansionKey(col.id)]} aria-label={`Mostrar criteris avaluats de ${col.label}`} onClick={()=>setExpanded({...expanded,[expansionKey(col.id)]:!expanded[expansionKey(col.id)]})}>{expanded[expansionKey(col.id)]?<ChevronDown size={16}/>:<ChevronRight size={16}/>} {col.label}<span className="text-xs font-normal">({evaluatedCriteria(col.id).length})</span></button>:<span>{col.label}</span>}<button className="p-1 rounded text-blue-700 hover:bg-blue-100" title={`Recalcular ${col.label}`} aria-label={`Recalcular columna ${col.label}`} onClick={()=>{if(window.confirm(`Recalcular ${col.label} per a tot l’alumnat? Se substituiran les notes manuals d’aquesta columna.`))recalcColumn(col);}}><RefreshCw size={14} aria-hidden="true"/></button></div></th>)}{METHODS.map(m=><th key={m} className="summary-divider summary-total">{METHOD_NAMES[m]} total</th>)}{periodId==='annual'&&<>{state.config.terms.filter(t=>!t.isPreassessment).map(t=><th key={t.id} className="summary-divider">{t.name}</th>)}<th className="summary-divider">Proposta: trimestres</th><th className="summary-divider">Proposta: {numeric?'ítems':'competències'}</th></>}<th className="summary-divider">Comentari del període</th></tr></thead><tbody>{students.map(st=><tr key={st.id}><td className="student-cell"><StudentName state={state} student={st}/></td>{columns.map(col=>{const c=cell(data[st.id],col),q=c&&'qual'in c&&typeof c.qual==='string'?c.qual:undefined;return <td key={col.id} className={`${columnClass(col)} ${c?.isManual?'summary-manual':''}`}><button className="grade-cell-button" onClick={()=>setEdit({base:state,studentId:st.id,column:col,value:c?.score==null?'':String(c.score)})} aria-label={`${st.name}: modificar ${col.label}`}><span>{fmt(c?.score)}{c?.isManual&&<span className="text-amber-700 ml-1">✎</span>}</span>{q&&<GradeBadge qual={q}/>} {col.type==='final'&&periodId==='annual'&&c?.isManual&&<small className="block text-slate-500">Calculada: {fmt(annual[st.id].fromActivities?.score)} {annual[st.id].fromActivities?.qual}</small>}{col.type==='final'&&data[st.id]?.finalGrade.autoFailed&&<span className="text-xs text-rose-700">{data[st.id].finalGrade.failedCECount} CE suspeses</span>}</button></td>;})}{METHODS.map(m=><td key={m} className="summary-divider summary-total"><div className="grade-cell-button"><b>{fmt(all[m][st.id]?.finalGrade.score)}</b><GradeBadge qual={all[m][st.id]?.finalGrade.qual}/></div></td>)}{periodId==='annual'&&<>{annual[st.id].terms.map(t=><td key={t.term.id} className="summary-divider"><GradeComparison grade={t.actual} automatic={t.automatic}/></td>)}<td className="summary-divider"><GradeComparison grade={annual[st.id].termScore==null?undefined:{score:annual[st.id].termScore,qual:scoreToCompetencial(annual[st.id].termScore/(numeric?2.5:1),settings.thresholds)}}/><small className="text-slate-500">{annual[st.id].count}/{annual[st.id].total} trimestres</small></td><td className="summary-divider"><GradeComparison grade={annual[st.id].fromActivities}/></td></>}<td className="summary-divider"><textarea rows={2} className="min-w-56 w-full text-sm" aria-label={`Comentari de ${st.name} · ${periodName}`} placeholder="Comentari compartit entre els tres mètodes…" value={comments[st.id]||''} onChange={e=>setComment(st.id,e.target.value)}/></td></tr>)}</tbody></table>{!students.length&&<p className="p-6 text-slate-500">No hi ha alumnes per mostrar.</p>}</div>
      <details className="text-sm text-slate-600 ds-panel"><summary className="cursor-pointer font-semibold">Com es calculen les notes?</summary><p className="mt-2">El trimestre inclou les activitats segons la data de lliurament. El curs les inclou totes. Un zero és una nota; una cel·la buida queda pendent i no entra al càlcul.</p><p className="mt-2">{numeric?'Cada ítem combina les activitats segons el seu pes; els ítems amb nota es combinen segons els percentatges configurats. Si falta un ítem, els pesos disponibles es renormalitzen.':'Cada CA combina les puntuacions sobre 4 amb el pes de l’activitat × el pes del criteri. Cada CE combina els seus CA amb el mateix pes; la nota final combina les CE avaluades amb el mateix pes.'}</p><p className="mt-2">La mediana i la moda també respecten els pesos a cada nivell. Si hi ha empat en la moda es pren la puntuació menor. Les notes manuals són independents per mètode. Els totals mostren els tres càlculs complets.</p></details>
    </>}
  </section>;
}
