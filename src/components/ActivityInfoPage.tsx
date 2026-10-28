import React from 'react';
import {AppState,CurricularActivity} from '../types';
import DetailPage from './DetailPage';
import {sourceCriterionId} from '../utils/activityCriteria';
export default function ActivityInfoPage({state,activity,onBack,onOpenActivities}:{state:AppState;activity:CurricularActivity;onBack:()=>void;onOpenActivities?:()=>void}){
 const subject=state.subjects.find(s=>s.id===activity.subjectId);
 return <DetailPage title={`${activity.code} · ${activity.title}`} subtitle={subject?.name} onBack={onBack} actions={onOpenActivities&&<button className="ds-button" onClick={onOpenActivities}>Programació d’activitats de la classe</button>}>
 <div className="ds-panel flex flex-wrap gap-4 text-sm"><span>Inici: <b>{activity.startDate||'Sense data'}</b></span><span>Lliurament: <b>{activity.endDate||'Sense data'}</b></span><span>Pes: <b>{activity.weight}</b></span><span>{activity.assessmentType==='completion'?'Fet / No fet':'Activitat avaluable'}</span></div>
 <section className="ds-panel"><h3 className="font-bold mb-2">Descripció</h3><p className="whitespace-pre-wrap">{activity.description||'Sense descripció.'}</p></section>
 {!!activity.resources?.length&&<section className="ds-panel"><h3 className="font-bold mb-2">Recursos</h3><ul className="space-y-2">{activity.resources.map(r=><li key={r.id}>{/^https?:\/\//i.test(r.url)?<a className="text-blue-700 underline" href={r.url} target="_blank" rel="noopener noreferrer">{r.title||r.url} ↗</a>:<span>{r.title} · {r.url}</span>}</li>)}</ul></section>}
 {!!activity.criteriaIds?.length&&<section className="ds-panel"><h3 className="font-bold mb-2">Criteris d’avaluació</h3><ul className="space-y-3">{activity.criteriaIds.map(id=>{const c=state.criteria.find(c=>c.id===sourceCriterionId(activity,id));return <li key={id}><b>{activity.criteriaCustomLabels?.[id]||c?.key||id}</b><p className="text-sm whitespace-pre-wrap">{c?.description||'Criteri històric no disponible a la configuració actual.'}</p><small>Pes: {activity.criteriaWeights?.[id]??1} · Format: {activity.criteriaGradingType?.[id]||'competencial'}</small></li>;})}</ul></section>}
 {!!activity.numericAspects?.length&&<section className="ds-panel"><h3 className="font-bold mb-2">Aspectes avaluables</h3>{activity.numericAspects.map(a=><p key={a.id}>{a.label} · Pes {a.weight} · {a.format} · Màxim {a.maxScore}</p>)}</section>}
 {activity.gradingComment&&<section className="ds-panel"><h3 className="font-bold mb-2">Comentari general de l’activitat</h3><p className="whitespace-pre-wrap">{activity.gradingComment}</p></section>}
 </DetailPage>;
}
