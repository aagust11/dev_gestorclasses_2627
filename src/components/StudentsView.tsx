import {studentAttendance,attendanceLabels} from '../utils/attendance';
import StudentName from './StudentName';
import React, {useState, useMemo} from 'react';
import {Eye, EyeOff, Search} from 'lucide-react';
import {AppState, CalculationMode} from '../types';
import DetailPage from './DetailPage';
import {GradeBadge} from './GradeControls';
import {buildStudentReport} from '../utils/studentReport';
import {downloadStudentReport} from '../utils/studentReportExport';
import GradeComparison from './GradeComparison';
import {studentPeriodGrade,studentSessionHistory,sessionComments} from '../utils/studentProfile';

const methods:CalculationMode[]=['mean','median','mode'];
const methodNames={mean:'Mitjana',median:'Mediana',mode:'Moda'};
const attendanceNames=attendanceLabels;
const normalize=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase();

export default function StudentsView({state,onChange,selectedId,onSelect,onSession}:{state:AppState;onChange:(s:AppState)=>void;selectedId:string|null;onSelect:(id:string|null)=>void;onSession:(slot:string,date:string)=>void}) {
  const [search,setSearch]=useState('');
  const [group,setGroup]=useState('all');
  const students=[...new Map(state.subjects.filter(s=>!s.isGeneral).flatMap(s=>s.students).map(st=>[st.id,st])).values()].sort((a,b)=>a.name.localeCompare(b.name,'ca'));
  const student=students.find(s=>s.id===selectedId);
  if(student)return <StudentPage key={student.id} state={state} student={student} onChange={onChange} onBack={()=>onSelect(null)} onSession={onSession}/>;
  const visible=students.filter(st=>normalize(st.name).includes(normalize(search.trim()))&&(group==='all'||state.subjects.find(s=>s.id===group)?.students.some(s=>s.id===st.id)));
  return <section className="space-y-4"><header className="page-heading"><h2 className="text-xl font-bold">Alumnat</h2><span className="text-sm text-slate-500">{visible.length} alumnes</span></header><div className="ds-panel flex flex-wrap gap-3"><label className="ds-field flex-1">Cercar alumne<div className="flex items-center gap-2"><Search size={18}/><input className="w-full" type="search" placeholder="Nom o cognoms…" value={search} onChange={e=>setSearch(e.target.value)}/></div></label><label className="ds-field">Grup / assignatura<select value={group} onChange={e=>setGroup(e.target.value)}><option value="all">Tots</option>{state.subjects.filter(s=>!s.isGeneral).map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label></div><div className="grade-table-wrap"><table className="grade-table"><thead><tr><th>Alumne/a</th><th>Grups i assignatures</th><th/></tr></thead><tbody>{visible.map(st=><tr key={st.id}><td><button className="font-semibold text-blue-800" onClick={()=>onSelect(st.id)}><StudentName state={state} student={st}/></button></td><td>{state.subjects.filter(s=>s.students.some(x=>x.id===st.id)).map(s=>s.name).join(' · ')}</td><td><button className="ds-button" onClick={()=>onSelect(st.id)}>Obrir fitxa</button></td></tr>)}</tbody></table>{!visible.length&&<p className="p-4 text-slate-500">No hi ha alumnes per mostrar.</p>}</div></section>;
}

function StudentPage({state,student,onChange,onBack,onSession}:{state:AppState;student:{id:string;name:string};onChange:(s:AppState)=>void;onBack:()=>void;onSession:(slot:string,date:string)=>void}) {
  const [psiVisible,setPsiVisible]=useState(false);
  const [exporting,setExporting]=useState(false);
  const [exportError,setExportError]=useState('');
  const report=useMemo(()=>buildStudentReport(state,student.id),[state,student.id]);
  const exportReport=async(format:'word'|'pdf')=>{setExporting(true);setExportError('');try{await downloadStudentReport(report,format);}catch{setExportError('No s’ha pogut generar l’informe. Torna-ho a provar.');}finally{setExporting(false);}};
  const [period,setPeriod]=useState('annual');
  const [subjectId,setSubjectId]=useState('all');
  const subjects=state.subjects.filter(s=>!s.isGeneral&&s.students.some(st=>st.id===student.id));
  const periods=[...state.config.terms.map(t=>({id:t.id,name:t.name})),{id:'annual',name:'Curs complet'}];
  const profile=state.studentProfiles?.[student.id]||{};
  const saveProfile=(patch:Partial<typeof profile>)=>onChange({...state,studentProfiles:{...state.studentProfiles,[student.id]:{...profile,...patch}}});
  const history=studentSessionHistory(state,student.id,period,subjectId);
  const attendance=studentAttendance(state,student.id,period,subjectId);
  const totals={absent:attendance.absent,late:attendance.late,pos:history.reduce((n,l)=>n+sessionComments(l.studentLog,'pos').length,0),incident:history.reduce((n,l)=>n+sessionComments(l.studentLog,'incident').length,0)};
  return <DetailPage title={<StudentName state={state} student={student}/>} subtitle={subjects.map(s=>s.name).join(' · ')} onBack={onBack} actions={<><button className="ds-button" disabled={exporting} onClick={()=>exportReport('word')}>Informe Word</button><button className="ds-button" disabled={exporting} onClick={()=>exportReport('pdf')}>Informe PDF</button></>}>
    <div className="space-y-4">
      {exportError&&<p role="alert" className="text-rose-700">{exportError}</p>}
      <section className="ds-panel space-y-3"><h3 className="font-bold mb-2">Informació de l’alumne</h3><p className="text-sm text-slate-600 mb-2">{subjects.length} grups / assignatures</p><label className="ds-field">Informació complementària<textarea rows={2} placeholder="Informació útil per al seguiment de l’alumne…" value={profile.notes||''} onChange={e=>saveProfile({notes:e.target.value})}/></label><label className="ds-field">Comentaris addicionals<textarea rows={3} value={profile.additionalComments||''} onChange={e=>saveProfile({additionalComments:e.target.value})} placeholder="Comentaris addicionals per a l’informe de l’alumne…"/></label></section>
      <section className="ds-panel space-y-3"><div className="flex justify-between items-center gap-3"><h3 className="font-bold">PSI i mesures de suport</h3><button className="ds-button" aria-expanded={psiVisible} aria-controls="student-psi" onClick={()=>{setPsiVisible(v=>!v);}}>{psiVisible?<EyeOff size={16}/>:<Eye size={16}/>} {psiVisible?'Ocultar PSI i mesures':'Mostrar PSI i mesures'}</button></div>{psiVisible?<><label id="student-psi" className="ds-field">Contingut del PSI · desat automàtic<textarea rows={8} value={profile.psi||''} onChange={e=>saveProfile({psi:e.target.value})} placeholder="Objectius, mesures i suports, adaptacions i seguiment…"/></label><label className="ds-field">Mesures de suport<textarea rows={3} value={profile.supportMeasures||''} onChange={e=>saveProfile({supportMeasures:e.target.value})} placeholder="Mesures de suport que han de constar a l’informe…"/></label></>:<p className="text-sm text-slate-500">PSI i mesures ocults. Prem «Mostrar PSI i mesures» per consultar-los o editar-los.</p>}<p className="text-xs text-slate-500">Les mesures i els comentaris s’inclouen a l’informe si estan emplenats. El contingut del PSI es manté fora de l’informe.</p></section>
      <section className="ds-panel space-y-3"><h3 className="font-bold">Notes i comentaris del trimestre / curs</h3><div className="grade-table-wrap"><table className="grade-table"><thead><tr><th>Assignatura</th><th>Període</th>{methods.map(m=><th key={m}>{methodNames[m]}</th>)}<th>Comentari del període</th></tr></thead><tbody>{subjects.filter(s=>!s.isParent).flatMap(subject=>periods.map(p=><tr key={subject.id+p.id}><td className="font-semibold">{subject.name}<span className="block text-xs text-slate-500">Escala /{subject.evaluationType==='numeric'?10:4}</span></td><td>{p.name}</td>{methods.map(m=>{const evaluation=report.evaluations.find(e=>e.subject.id===subject.id&&e.period.id===p.id);return <td key={m}><GradeComparison grade={evaluation?.actual[m]?.finalGrade} automatic={evaluation?.automatic[m]?.finalGrade}/></td>;})}<td className="min-w-56 whitespace-pre-wrap text-sm">{state.periodComments?.[subject.id]?.[p.id]?.[student.id]||'—'}</td></tr>))}</tbody></table></div></section>
      <section className="ds-panel space-y-3"><h3 className="font-bold">Avaluació de les competències · escala 0–4</h3><p className="text-sm text-slate-500">Calculades automàticament a partir de les activitats. Sota una nota manual es mostra el càlcul sense modificacions manuals.</p>{report.evaluations.filter(e=>e.competencies.length).map(e=><div key={e.subject.id+e.period.id}><h4 className="font-semibold text-blue-900 mb-2">{e.subject.name} · {e.period.name}</h4><div className="grade-table-wrap"><table className="grade-table"><thead><tr><th>Competència</th>{methods.map(m=><th key={m}>{methodNames[m]}</th>)}</tr></thead><tbody>{e.competencies.map(c=><tr key={c.id}><td><b>{c.key}</b><span className="block text-xs text-slate-500">{c.description}</span></td>{methods.map(m=><td key={m}><GradeComparison grade={e.actual[m]?.competencies[c.id]} automatic={e.automatic[m]?.competencies[c.id]}/></td>)}</tr>)}</tbody></table></div></div>)}</section>
      <section className="ds-panel space-y-3"><div className="flex flex-wrap items-end justify-between gap-3"><h3 className="font-bold">Assistència i seguiment de les sessions</h3><div className="flex flex-wrap gap-2"><label className="ds-field">Període<select value={period} onChange={e=>setPeriod(e.target.value)}>{periods.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label><label className="ds-field">Assignatura<select value={subjectId} onChange={e=>setSubjectId(e.target.value)}><option value="all">Totes</option>{subjects.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label></div></div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">{[[totals.absent,'Faltes','bg-rose-50 text-rose-800'],[totals.late,'Retards','bg-amber-50 text-amber-800'],[totals.pos,'Comentaris positius','bg-emerald-50 text-emerald-800'],[totals.incident,'Incidències','bg-orange-50 text-orange-800']].map(([n,label,color])=><div key={label} className={`rounded-lg p-3 ${color}`}><b className="text-xl mr-2">{n}</b><span className="text-sm">{label}</span></div>)}</div>
        <p className="text-xs text-slate-500">{attendance.recorded} assistències registrades · {attendance.pending} pendents · Assistència: {attendance.rate===null?'—':`${attendance.rate}%`}. Còmput fins avui; les pendents no entren al percentatge.</p>
        <div className="grade-table-wrap"><table className="grade-table"><thead><tr><th>Data</th><th>Assignatura</th><th>Assistència</th><th>Positius</th><th>Comentaris</th><th>Incidències</th></tr></thead><tbody>{history.map(log=><tr key={log.id}><td><button className="text-blue-700 underline whitespace-nowrap" onClick={()=>onSession(log.scheduleItemId,log.date)}>{log.date.split('-').reverse().join('/')}</button></td><td>{subjects.find(s=>s.id===log.subjectId)?.name}</td><td className={log.studentLog.status==='absent'?'text-rose-700 font-semibold':''}>{attendanceNames[log.studentLog.status]||'—'}</td>{(['pos','regular','incident'] as const).map(kind=><td key={kind} className="whitespace-pre-wrap text-sm">{sessionComments(log.studentLog,kind).map((comment,i)=><p key={i} className="mb-1">{comment}</p>)}</td>)}</tr>)}</tbody></table>{!history.length&&<p className="p-4 text-slate-500">No hi ha registres individuals en aquest període.</p>}</div>
      </section>

    </div>
  </DetailPage>;
}
