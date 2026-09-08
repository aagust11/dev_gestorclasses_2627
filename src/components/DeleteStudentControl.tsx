import React,{useState} from 'react';
import {AppState,Student} from '../types';
import DetailPage from './DetailPage';

export type DeleteStudentAction=(id:string,name:string,reviewed:AppState)=>Promise<void>;
export default function DeleteStudentControl({state,student,onDelete}:{state:AppState;student:Student;onDelete:DeleteStudentAction}){
  const [reviewed,setReviewed]=useState<AppState|null>(null);
  const [name,setName]=useState('');
  const [working,setWorking]=useState(false);
  const [error,setError]=useState('');
  const remove=async()=>{if(!reviewed||name!==student.name||working)return;setWorking(true);setError('');try{await onDelete(student.id,name,reviewed);}catch(e){setError((e as Error).message);setWorking(false);}};
  if(!reviewed)return <section className="ds-panel border-rose-200"><h3 className="font-bold">Eliminar l’alumne</h3><p className="text-sm my-2">Elimina la fitxa i tots els registres individuals de totes les assignatures.</p><button className="ds-button text-rose-700" onClick={()=>{setReviewed(state);setName('');setError('');}}>Revisar l’eliminació completa</button></section>;
  const id=student.id;
  const counts=[['Matrícules',reviewed.subjects.filter(s=>s.students.some(st=>st.id===id)).length],['Registres de sessió',reviewed.sessionLogs.filter(l=>Object.hasOwn(l.attendance,id)).length],['Activitats amb qualificació o comentari',(reviewed.activities||[]).filter(a=>Object.hasOwn(a.grades||{},id)).length],['Registres de notes de trimestre / curs',(reviewed.termGradesRecords||[]).filter(r=>Object.hasOwn(r.students,id)).length],['Comentaris de període',Object.values(reviewed.periodComments||{}).reduce((n,periods)=>n+Object.values(periods).filter(p=>Object.hasOwn(p,id)).length,0)]];
  return <div role="dialog" aria-modal="true" aria-label="Confirmar eliminació de l’alumne" className="fixed inset-0 z-50 bg-white overflow-auto p-4 sm:p-8"><DetailPage title="Eliminar l’alumne i tots els seus registres" subtitle={student.name} onBack={()=>{if(!working)setReviewed(null);}}>
    <div className="space-y-4 max-w-3xl"><ul className="list-disc pl-5">{counts.map(([label,count])=><li key={label}>{label}: {count}</li>)}</ul><p>També s’eliminaran la informació personal, el PSI, les mesures de suport, els comentaris individuals i els seients assignats. Les activitats, les sessions i els comentaris generals de classe es conservaran per als altres alumnes.</p>
    <p className="text-sm">Es crearà una còpia recuperable abans de l’eliminació. Aquesta còpia i els JSON descarregats anteriorment encara poden contenir les dades de l’alumne.</p>
    <label className="ds-field">Per confirmar, escriu exactament: <strong>{student.name}</strong><input autoFocus autoComplete="off" spellCheck={false} value={name} disabled={working} onChange={e=>setName(e.target.value)} aria-label="Nom i cognoms per confirmar l’eliminació"/></label>
    <div className="flex gap-2"><button className="ds-button" disabled={working} onClick={()=>setReviewed(null)}>Cancel·lar</button><button className="ds-button text-rose-700" disabled={working||name!==student.name} onClick={()=>void remove()}>{working?'Eliminant…':'Eliminar l’alumne i tots els seus registres'}</button></div>{error&&<p role="alert" className="text-rose-700">{error}</p>}</div>
  </DetailPage></div>;
}
