import React from 'react';
import { AppState } from '../types';
export default function CriteriaLabels({state,subjectId,onChange}:{state:AppState;subjectId:string;onChange:(s:AppState)=>void}) {
  const ids=state.competencies.filter(c=>c.subjectId===subjectId).map(c=>c.id);
  const criteria=state.criteria.filter(c=>ids.includes(c.competencyId)).sort((a,b)=>(a.order??0)-(b.order??0));
  const move=(index:number,delta:number)=>{const list=[...criteria];[list[index],list[index+delta]]=[list[index+delta],list[index]];onChange({...state,criteria:state.criteria.map(c=>{const i=list.findIndex(x=>x.id===c.id);return i<0?c:{...c,order:i};})});};
  if (!criteria.length) return null;
  return <section className="ds-panel space-y-2"><h3 className="font-bold">Identificadors i ordre dels criteris</h3><p className="text-sm text-slate-500">Es desen en editar. A cada activitat pots concretar un altre text per avaluar.</p>{criteria.map((c,index)=><div key={c.id} className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-2"><span className="font-mono text-sm" title={c.description}>{c.key}</span><input aria-label={`Text breu ${c.key}`} value={c.shortLabel ?? c.key} onChange={e=>onChange({...state,criteria:state.criteria.map(x=>x.id===c.id?{...x,shortLabel:e.target.value}:x)})}/><button className="ds-button" type="button" disabled={index===0} aria-label={`Pujar ${c.key}`} onClick={()=>move(index,-1)}>↑</button><button className="ds-button" type="button" disabled={index===criteria.length-1} aria-label={`Baixar ${c.key}`} onClick={()=>move(index,1)}>↓</button></div>)}</section>;
}
