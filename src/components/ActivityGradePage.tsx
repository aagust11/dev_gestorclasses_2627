import { sourceCriterionId, criterionRubric, preserveLegacyCriterionGrades } from '../utils/activityCriteria';
import React, { useState } from 'react';
import { AppState, CurricularActivity, Subject, StudentActivityGrade } from '../types';
import DetailPage from './DetailPage';
import { GradeBadge, GradeButtons } from './GradeControls';
import { getActivityScore, getCriterionScore, getCompSettings, scoreToCompetencial, exportActivitiesToExcel } from '../utils/gradeCalculations';

export default function ActivityGradePage({state,activity,subject,onChange,onBack}:{state:AppState;activity:CurricularActivity;subject:Subject;onChange:(s:AppState)=>void;onBack:()=>void}) {
  const [search,setSearch]=useState('');
  const settings=getCompSettings(subject), students=subject.students.filter(s=>s.name.toLocaleLowerCase().includes(search.toLocaleLowerCase()));
  const criteria=activity.criteriaIds || [];
  const update=(studentId:string,fn:(g:StudentActivityGrade)=>StudentActivityGrade)=>{
    const prepared=preserveLegacyCriterionGrades(activity);
    const grades={...prepared,[studentId]:fn(prepared[studentId] || {})};
    onChange({...state,activities:(state.activities||[]).map(a=>a.id===activity.id?{...a,grades}:a)});
  };
  const clear=()=>{if(window.confirm('Esborrar totes les notes i comentaris d’aquesta activitat?')) onChange({...state,activities:(state.activities||[]).map(a=>a.id===activity.id?{...a,grades:{}}:a)});};
  return <DetailPage title={`Avaluar · ${activity.code}`} subtitle={`${activity.title} · ${subject.name}`} onBack={onBack} actions={<><span className="text-sm text-slate-500 self-center">Desat automàtic</span><button className="ds-button" onClick={()=>exportActivitiesToExcel(subject,[activity],state.criteria,subject.students)}>Exportar Excel</button><button className="ds-button text-rose-700" onClick={clear}>Esborrar notes</button></>}>
    <div className="ds-panel flex flex-wrap justify-between gap-3 items-center"><input aria-label="Cercar alumne" placeholder="Cercar alumne…" value={search} onChange={e=>setSearch(e.target.value)}/><span className="text-sm text-slate-600">{subject.students.length} alumnes · Lliurament {activity.endDate} · Pes {activity.weight}</span><span className="text-sm">AS ≥ {settings.thresholds.AS} · AN ≥ {settings.thresholds.AN} · AE ≥ {settings.thresholds.AE} /4</span></div>
    <div className="grade-table-wrap"><table className="grade-table"><thead><tr><th>Alumne/a</th><th>Criteri / aspecte</th><th>Qualificació</th><th>Equivalent /4</th><th>Activitat</th><th>Comentari de l’alumne</th></tr></thead>
      {students.map((st,index)=>{const g=activity.grades?.[st.id] || {}, rows=criteria.length?criteria:[''], total=getActivityScore(activity,st.id,subject);return <tbody key={st.id} className={index%2?'bg-slate-50':'bg-white'}>{rows.map((cid,row)=>{
        const cr=state.criteria.find(c=>c.id===sourceCriterionId(activity,cid)), cg=g.criteriaGrades?.[cid], type=cid?(activity.criteriaGradingType?.[cid] || 'competencial'):(activity.numericGradingType || 'numeric'), max=cid?(activity.criteriaMaxScores?.[cid] ?? 10):10;
        const score=cid?getCriterionScore(activity,st.id,cid,subject):total;
        const label=cid?(activity.criteriaCustomLabels?.[cid] || cr?.shortLabel || cr?.key || cid):'Nota global';
        return <tr key={cid || 'global'}>{row===0 && <td rowSpan={rows.length} className="student-cell"><span className="text-slate-400 mr-2">{index+1}</span>{st.name}</td>}<td title={cr?.description}><strong>{label}</strong>{cid && <span className="block text-xs text-slate-500">{cr?.key} · pes {activity.criteriaWeights?.[cid] ?? 1}</span>}</td><td>{type==='numeric'?<div className="flex items-center gap-2"><input className="score-input" aria-label={`${st.name}: ${label}`} type="number" min="0" max={max} step="0.01" value={cid?cg?.rawScore ?? '':g.score ?? ''} onChange={e=>{const value=e.target.value===''?undefined:Math.max(0,Math.min(max,Number(e.target.value)));update(st.id,old=>{
          if(cid){old.criteriaGrades={...old.criteriaGrades}; if(value===undefined) delete old.criteriaGrades[cid]; else old.criteriaGrades[cid]={criterionId:cid,rawScore:value,maxScore:max};delete old.score;delete old.competencialScore;}else{old.score=value;delete old.competencialScore;}return old;
        });}}/><span className="text-slate-500">/{max}</span></div>:<GradeButtons descriptions={criterionRubric(activity,cid,cr)} label={`${st.name}: ${label}`} value={cid?cg?.competencialScore:g.competencialScore} onChange={q=>update(st.id,old=>{if(cid){old.criteriaGrades={...old.criteriaGrades};if(old.criteriaGrades[cid]?.competencialScore===q)delete old.criteriaGrades[cid];else old.criteriaGrades[cid]={criterionId:cid,competencialScore:q};delete old.score;delete old.competencialScore;}else{old.competencialScore=old.competencialScore===q?undefined:q;delete old.score;}return old;})}/>}</td><td>{score===null?'—':<div className="flex items-center gap-2"><span className="tabular-nums">{score.toFixed(2)}</span><GradeBadge description={criterionRubric(activity,cid,cr)[scoreToCompetencial(score,settings.thresholds)]} qual={scoreToCompetencial(score,settings.thresholds)}/></div>}</td>{row===0 && <><td rowSpan={rows.length}>{total===null?'—':<div className="space-y-1"><b>{(total*(subject.evaluationType==='numeric'?2.5:1)).toFixed(2)}</b><span className="block"><GradeBadge qual={scoreToCompetencial(total,settings.thresholds)}/></span></div>}</td><td rowSpan={rows.length}><textarea rows={2} aria-label={`Comentari ${st.name}`} placeholder="Comentari…" value={g.comment||''} onChange={e=>update(st.id,old=>({...old,comment:e.target.value}))}/></td></>}</tr>;
      })}</tbody>})}
    </table>{!students.length && <p className="p-6 text-slate-500">No hi ha alumnes per mostrar.</p>}</div>
  </DetailPage>;
}
