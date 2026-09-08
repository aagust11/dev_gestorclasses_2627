import React,{useMemo,useState} from 'react';
import {AppState} from '../types';
import {findOrphanData,OrphanItem,orphanLabels} from '../utils/orphanData';

export default function OrphanDataReview({state,disabled,onRemove}:{state:AppState;disabled:boolean;onRemove:(item:OrphanItem)=>Promise<void>}){
  const items=useMemo(()=>findOrphanData(state),[state]);
  const [query,setQuery]=useState('');
  const [selected,setSelected]=useState<OrphanItem|null>(null);
  const [confirmed,setConfirmed]=useState(false);
  const [working,setWorking]=useState(false);
  const [message,setMessage]=useState('');
  const [error,setError]=useState('');
  const open=(item:OrphanItem)=>{setSelected(item);setConfirmed(false);setError('');setMessage('');};
  const remove=async()=>{if(!selected||!confirmed)return;setWorking(true);setError('');try{await onRemove(selected);setSelected(null);setConfirmed(false);setMessage('Dada eliminada. La versió anterior és a «Còpies recuperables».');}catch(e){setError((e as Error).message);}finally{setWorking(false);}};
  return <section className="ds-panel space-y-3">
    <h3 className="font-semibold">Revisar dades desvinculades · {items.length}</h3>
    <p className="text-sm text-slate-600">Són dades conservades del diari o de l’avaluació que han perdut una referència. Pots conservar-les o revisar què contenen abans d’eliminar-les.</p>
    {message&&<p role="status" className="text-emerald-700">{message}</p>}
    {selected?<>
      <button className="ds-button" disabled={working} onClick={()=>{setSelected(null);setError('');}}>← Tornar al llistat</button>
      <h4 className="font-semibold">{selected.title}</h4><p>{selected.reason}</p>
      <dl className="divide-y max-h-[55vh] overflow-auto">{selected.details.map(([label,value],i)=><div key={i} className="py-2 grid sm:grid-cols-[14rem_1fr] gap-2"><dt className="font-medium text-sm">{label}</dt><dd className="text-sm whitespace-pre-wrap break-words">{value||'Sense informació'}</dd></div>)}</dl>
      <div className="rounded border border-rose-200 bg-rose-50 p-3 space-y-2"><h4 className="font-semibold">Què s’eliminarà?</h4><p>{selected.impact}</p><p className="text-sm">Abans es desarà una còpia recuperable. Si no es pot crear, no s’eliminarà res.</p><label className="flex gap-2 items-start"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)} disabled={working}/>He revisat la informació i vull eliminar aquesta dada.</label><button className="ds-button text-rose-700" disabled={disabled||working||!confirmed} onClick={()=>void remove()}>{working?'Eliminant…':'Crear còpia i eliminar aquesta dada'}</button></div>
      {error&&<p role="alert" className="text-rose-700">{error}</p>}
    </>:<>
      <input className="w-full border rounded p-2" aria-label="Buscar dades desvinculades" placeholder="Buscar per activitat, assignatura, data o identificador…" value={query} onChange={e=>setQuery(e.target.value)}/>
      <div className="max-h-[55vh] overflow-auto divide-y">{items.filter(i=>(i.title+' '+i.reason+' '+i.parentId+' '+(i.childId||'')).toLocaleLowerCase('ca').includes(query.toLocaleLowerCase('ca'))).map(i=><div key={i.key} className="py-2 flex items-center justify-between gap-3 odd:bg-slate-50"><div className="min-w-0"><p className="text-xs text-slate-500">{orphanLabels[i.kind]}</p><p className="text-sm font-medium break-words">{i.title}</p><p className="text-xs text-slate-600">{i.reason}</p></div><button className="ds-button shrink-0" onClick={()=>open(i)}>Veure i decidir</button></div>)}</div>
      {!items.length&&<p className="text-sm text-slate-500">No s’han detectat criteris d’activitat, franges ni registres del diari desvinculats.</p>}
    </>}
  </section>;
}
