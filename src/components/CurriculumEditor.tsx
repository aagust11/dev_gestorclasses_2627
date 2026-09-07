import React, { useState } from 'react';
import { AppState, RubricDescriptions } from '../types';
import { QUAL_ORDER, QUAL_COLORS } from '../utils/gradeCalculations';
import DetailPage from './DetailPage';

export type CurriculumTarget = { kind:'competency'|'criterion'; id:string };
export default function CurriculumEditor({state,target,onChange,onBack}:{state:AppState;target:CurriculumTarget;onChange:(s:AppState)=>void;onBack:()=>void}) {
  const isCriterion=target.kind==='criterion';
  const criterion=isCriterion?state.criteria.find(c=>c.id===target.id):undefined;
  const competency=!isCriterion?state.competencies.find(c=>c.id===target.id):undefined;
  const original=criterion || competency;
  const [key,setKey]=useState(original?.key||'');
  const [description,setDescription]=useState(original?.description||'');
  const [rubric,setRubric]=useState<RubricDescriptions>(criterion?.rubric||{});
  const [error,setError]=useState('');
  if(!original) return <DetailPage title="Element no disponible" onBack={onBack}><p>Aquest element ja no existeix.</p></DetailPage>;
  const save=(e:React.FormEvent)=>{
    e.preventDefault();
    if(!key.trim() || !description.trim()) {setError('Indica un codi i una descripció.');return;}
    const duplicate=isCriterion?state.criteria.some(c=>c.id!==target.id&&c.competencyId===criterion.competencyId&&c.key.trim().toLowerCase()===key.trim().toLowerCase()):state.competencies.some(c=>c.id!==target.id&&c.subjectId===competency.subjectId&&c.key.trim().toLowerCase()===key.trim().toLowerCase());
    if(duplicate){setError('Ja hi ha un altre element amb aquest codi.');return;}
    if(isCriterion)onChange({...state,criteria:state.criteria.map(c=>c.id===target.id?{...c,key:key.trim(),description:description.trim(),shortLabel:key.trim(),rubric}:c)});
    else onChange({...state,competencies:state.competencies.map(c=>c.id===target.id?{...c,key:key.trim(),description:description.trim()}:c)});
    onBack();
  };
  return <DetailPage title={isCriterion?'Editar criteri d’avaluació':'Editar competència'} subtitle={original.key} onBack={onBack}>
    <form className="ds-panel space-y-4" onSubmit={save}>
      <label className="ds-field">{isCriterion?'Codi / text breu identificatiu':'Codi'}<input required value={key} onChange={e=>setKey(e.target.value)}/></label>
      <label className="ds-field">Descripció<textarea required rows={4} value={description} onChange={e=>setDescription(e.target.value)}/></label>
      {isCriterion&&<fieldset className="grid md:grid-cols-2 gap-3"><legend className="font-bold mb-2">Descripcions dels nivells</legend>{QUAL_ORDER.map(q=><label className="ds-field" key={q}><span className={`grade-badge ${QUAL_COLORS[q].badge}`}>{q}</span><textarea rows={3} value={rubric[q]||''} placeholder={`Què ha de demostrar l’alumne per obtenir ${q}?`} onChange={e=>setRubric({...rubric,[q]:e.target.value})}/></label>)}<p className="text-sm text-slate-500 md:col-span-2">S’utilitzen a les activitats que no tenen una descripció pròpia per a aquest nivell. Pots personalitzar-les per cada aspecte de l’activitat.</p></fieldset>}
      <p className="text-sm text-slate-500">Editar el codi o la descripció manté les vinculacions amb les activitats i les notes existents.</p>
      {error&&<p role="alert" className="text-rose-700">{error}</p>}
      <button type="submit" className="ds-button ds-primary">Desar canvis</button>
    </form>
  </DetailPage>;
}
