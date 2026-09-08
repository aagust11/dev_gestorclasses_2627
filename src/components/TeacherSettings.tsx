import React,{useState} from 'react';
import {AppState} from '../types';

export default function TeacherSettings({state,onChange}:{state:AppState;onChange:(state:AppState)=>boolean|void}){
  const first=[...state.config.terms].filter(t=>!t.isPreassessment).sort((a,b)=>a.startDate.localeCompare(b.startDate))[0];
  const previous=state.config.terms.find(t=>t.isPreassessment);
  const [name,setName]=useState(state.config.teacherProfile?.fullName||'');
  const [email,setEmail]=useState(state.config.teacherProfile?.email||'');
  const [enabled,setEnabled]=useState(!!previous);
  const [end,setEnd]=useState(previous?.endDate||first?.startDate||'');
  const [message,setMessage]=useState('');
  return <section className="space-y-4"><h2 className="text-xl font-bold">Perfil Docent i preavaluació</h2>
    <form className="ds-panel space-y-3" onSubmit={e=>{e.preventDefault();const accepted=onChange({...state,config:{...state.config,teacherProfile:{fullName:name.trim(),email:email.trim()}}});setMessage(accepted===false?'No s’han pogut confirmar els canvis. Revisa Dades i desat.':'Perfil actualitzat.');}}><h3 className="font-semibold">Perfil Docent</h3><p className="text-sm">El nom complet i el correu apareixeran als informes individuals i de grup.</p><label className="ds-field">Nom i cognoms<input required value={name} onChange={e=>setName(e.target.value)}/></label><label className="ds-field">Correu de contacte<input type="email" required value={email} onChange={e=>setEmail(e.target.value)}/></label><button className="ds-button" type="submit">Desar perfil</button></form>
    <form className="ds-panel space-y-3" onSubmit={e=>{e.preventDefault();if(!first)return;if(!enabled&&previous&&!confirm('Desactivar la preavaluació? Les seves notes manuals es conservaran, però el període deixarà de ser seleccionable fins que el tornis a activar.'))return;const terms=state.config.terms.filter(t=>!t.isPreassessment);if(enabled)terms.unshift({id:previous?.id||'preassessment',name:'Preavaluació',isPreassessment:true,parentTermId:first.id,startDate:first.startDate,endDate:end});const accepted=onChange({...state,config:{...state.config,terms}});setMessage(accepted===false?'No s’han pogut confirmar les dates. Revisa Dades i desat.':'Preavaluació actualitzada.');}}><h3 className="font-semibold">Preavaluació dins del primer trimestre</h3><label className="flex gap-2"><input type="checkbox" checked={enabled} onChange={e=>setEnabled(e.target.checked)} disabled={!first}/>Activar preavaluació</label><p className="text-sm">Comença amb {first?.name||'el primer trimestre'} ({first?.startDate}). Té una nota pròpia. El trimestre inclou les activitats de preavaluació i la resta, una sola vegada cadascuna.</p>{enabled&&<label className="ds-field">Últim dia de preavaluació<input type="date" required min={first?.startDate} max={first?.endDate} value={end} onChange={e=>setEnd(e.target.value)}/></label>}<button className="ds-button" type="submit" disabled={!first}>Desar preavaluació</button></form>
    <p role="status">{message}</p>
  </section>;
}
