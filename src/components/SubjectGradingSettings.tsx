import React from 'react';
import { Subject } from '../types';
import { getCompSettings, QUAL_COLORS, QUAL_ORDER } from '../utils/gradeCalculations';

export function validateSubjectGrading(subject: Subject): string | null {
  const s=getCompSettings(subject), t=s.thresholds;
  if (!Object.values(s.values).every(v=>Number.isFinite(v)&&v>=0&&v<=4)) return 'Els valors de càlcul han d’estar entre 0 i 4.';
  if (!(s.values.NA < s.values.AS && s.values.AS < s.values.AN && s.values.AN < s.values.AE)) return 'Els valors han de seguir l’ordre NA < AS < AN < AE.';
  if (!(0 <= t.AS && t.AS < t.AN && t.AN < t.AE && t.AE <=4)) return 'Els llindars han de seguir 0 ≤ AS < AN < AE ≤ 4.';
  if (!Number.isInteger(s.maxFailedCompetencies) || s.maxFailedCompetencies < 0) return 'El límit de CE ha de ser un enter igual o superior a zero.';
  if (subject.evaluationType==='numeric') {
    const items=subject.numericItems || [];
    if (!items.length || items.some(i=>!i.code.trim() || !i.name.trim() || !Number.isFinite(i.weight) || i.weight<0)) return 'Defineix els ítems numèrics amb codi, nom i un pes vàlid.';
    if (Math.abs(items.reduce((n,i)=>n+i.weight,0)-100)>0.001) return 'Els pesos dels ítems han de sumar el 100%.';
    if (new Set(items.map(i=>i.code.trim().toUpperCase())).size!==items.length) return 'Els codis dels ítems han de ser únics.';
  }
  return null;
}
export default function SubjectGradingSettings({subject,onChange}:{subject:Subject;onChange:(s:Subject)=>void}) {
  const settings=getCompSettings(subject), items=subject.numericItems || [];
  return <section className="ds-panel space-y-4 md:col-span-2">
    <h3 className="font-bold text-lg">Avaluació i càlcul de notes</h3>
    <label className="ds-field">Sistema de l’assignatura<select value={subject.evaluationType || 'competencial'} onChange={e=>onChange({...subject,evaluationType:e.target.value as any})}><option value="competencial">Competencial · escala 0–4</option><option value="numeric">Numèric · escala 0–10</option></select></label>
    <div className="grid md:grid-cols-2 gap-4">
      <div><h4 className="font-semibold mb-2">Valor de cada qualificació per fer càlculs</h4><div className="grid grid-cols-4 gap-2">{QUAL_ORDER.map(q=><label className="ds-field" key={q}><span className={`grade-badge ${QUAL_COLORS[q].badge}`}>{q}</span><input aria-label={`Valor ${q}`} type="number" min="0" max="4" step="0.01" required value={Number.isFinite(settings.values[q])?settings.values[q]:''} onChange={e=>onChange({...subject,compSettings:{...settings,values:{...settings.values,[q]:e.target.value==='' ? NaN : Number(e.target.value)}}})}/></label>)}</div></div>
      <div><h4 className="font-semibold mb-2">Nota mínima per assolir cada nivell</h4><div className="grid grid-cols-3 gap-2">{(['AS','AN','AE'] as const).map(q=><label key={q} className="ds-field"><span className={`grade-badge ${QUAL_COLORS[q].badge}`}>{q} a partir de</span><input aria-label={`Llindar ${q}`} type="number" min="0" max="4" step="0.01" required value={Number.isFinite(settings.thresholds[q])?settings.thresholds[q]:''} onChange={e=>onChange({...subject,compSettings:{...settings,thresholds:{...settings.thresholds,[q]:e.target.value==='' ? NaN : Number(e.target.value)}}})}/><span className="text-xs text-slate-500">{Number.isFinite(settings.thresholds[q]) ? (settings.thresholds[q]*2.5).toFixed(2) : '—'} sobre 10</span></label>)}</div><p className="text-sm text-slate-500 mt-2">Escala 0–4. Per sota d’AS, la nota és NA. El límit indicat ja pertany al nivell nou.</p></div>
    </div>
    {subject.evaluationType!=='numeric' && <label className="ds-field max-w-lg">Nombre de CE suspeses que força un NA final<input type="number" min="0" step="1" value={settings.maxFailedCompetencies ?? 0} onChange={e=>onChange({...subject,compSettings:{...settings,maxFailedCompetencies:Number(e.target.value)}})}/><span className="text-sm text-slate-500">S’aplica quan el nombre és igual o superior. 0 desactiva el límit. Les CE sense nota no compten com a suspeses.</span></label>}
    {subject.evaluationType==='numeric' && <div className="space-y-2"><div className="flex justify-between items-center"><h4 className="font-semibold">Ítems · suma {items.reduce((n,i)=>n+i.weight,0)}%</h4><button className="ds-button" type="button" onClick={()=>onChange({...subject,numericItems:[...items,{id:crypto.randomUUID(),code:`I${items.length+1}`,name:'',weight:0}]})}>Afegir ítem</button></div>{items.map((item,index)=><div className="grid grid-cols-[1fr_2fr_1fr_auto] gap-2" key={item.id}><input aria-label={`Codi ítem ${index+1}`} value={item.code} onChange={e=>onChange({...subject,numericItems:items.map(i=>i.id===item.id?{...i,code:e.target.value}:i)})}/><input aria-label={`Nom ítem ${index+1}`} placeholder="Exàmens, pràctiques…" value={item.name} onChange={e=>onChange({...subject,numericItems:items.map(i=>i.id===item.id?{...i,name:e.target.value}:i)})}/><input aria-label={`Pes ítem ${index+1}`} type="number" min="0" max="100" step="0.1" value={item.weight} onChange={e=>onChange({...subject,numericItems:items.map(i=>i.id===item.id?{...i,weight:Number(e.target.value)}:i)})}/><button type="button" className="ds-button text-rose-700" onClick={()=>onChange({...subject,numericItems:items.filter(i=>i.id!==item.id)})}>Eliminar</button></div>)}<p className="text-sm text-slate-500">Els pesos sumen 100% i s’apliquen al trimestre i al curs. Dins de cada ítem, les activitats es ponderen pel seu pes.</p></div>}
  </section>;
}
