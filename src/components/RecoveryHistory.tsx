import React,{useState,useRef,useEffect} from 'react';
import {createPortal} from 'react-dom';
import {AppState,CurricularActivity} from '../types';
import {policyNames} from '../utils/recoveryModel';
import {annulRecovery} from '../utils/recoveries';
function HistoryDialog({activity,studentId,onClose,state,onChange}:{activity:CurricularActivity;studentId:string;onClose:()=>void;state?:AppState;onChange?:(s:AppState)=>void}){
 const ref=useRef<HTMLDialogElement>(null);const r=activity.recoveries![studentId];
 useEffect(()=>{ref.current?.showModal();return()=>ref.current?.close();},[]);
 return createPortal(<dialog ref={ref} onCancel={onClose} className="rounded-xl p-5 max-w-3xl w-full max-h-[85vh] overflow-auto"><header className="flex justify-between gap-3"><h3 className="font-bold">Historial de recuperacions · {activity.code}</h3><button className="ds-button" onClick={onClose}>Tancar</button></header>
 <p className="my-3">Avaluació inicial: <strong>{r.originalQual}</strong> · {r.originalDate||'Data no registrada'} · {state?.studentRegistry?.[studentId]?.name||state?.subjects.flatMap(s=>s.students).find(s=>s.id===studentId)?.name||''}</p>
 {r.attempts.map(a=>{const annulled=r.annulments.find(x=>x.attemptId===a.id);return <section key={a.id} className="border rounded p-3 my-2 space-y-2"><strong>{a.date} · {policyNames[a.policy]}</strong><p className="text-sm">{annulled?`Anul·lat: ${annulled.reason}`:a.applied?'Aplicat als períodes oberts':'Registrat sense aplicar als càlculs'}{a.sourceTaskId&&' · Prova vinculada'}</p>{a.results.map(x=><p key={x.slot.key} className="text-sm">{x.slot.label}: real <b>{x.demonstratedQual}</b> ({x.demonstrated.toFixed(4)} /4) → computable <b>{x.computableQual}</b> ({x.computable.toFixed(4)} /4){x.evidence.rawScore!=null&&` · Original: ${x.evidence.rawScore}/${x.slot.max}`}</p>)}<p className="whitespace-pre-wrap text-sm">{a.observations}</p>{a.exceptionReason&&<p className="text-sm">Excepció: {a.exceptionReason}</p>}{state&&onChange&&!annulled&&<button className="ds-button text-rose-700" onClick={()=>{const reason=window.prompt('Motiu de l’anul·lació. Es conservarà l’intent a l’historial i es recalcularan només els períodes oberts.');if(reason?.trim())onChange(annulRecovery(state,activity.id,studentId,a.id,reason));}}>Anul·lar intent</button>}</section>;})}
 <p className="text-xs text-slate-500">Per rectificar un intent, anul·la’l amb un motiu i registra’n un de nou. Les avaluacions tancades es mantenen.</p>
 </dialog>,document.body);
}
export default function RecoveryHistory({activity,studentId,state,onChange}:{activity:CurricularActivity;studentId:string;state?:AppState;onChange?:(s:AppState)=>void}){
 const [open,setOpen]=useState(false),r=activity.recoveries?.[studentId];if(!r)return null;
 return <><button type="button" className="inline-flex rounded bg-violet-100 text-violet-800 px-2 py-1 text-xs ml-1" aria-label={`Historial de recuperacions de ${activity.code}`} onClick={()=>setOpen(true)}>{r.attempts.length?'R':'Pendent de recuperació'}</button>{r.pending&&r.attempts.length>0&&<small className="text-amber-700 ml-1">Pendent de recuperació</small>}{open&&<HistoryDialog activity={activity} studentId={studentId} state={state} onChange={onChange} onClose={()=>setOpen(false)}/>}</>;
}
