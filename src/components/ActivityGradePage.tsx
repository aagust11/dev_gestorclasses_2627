import RecoveryEditor from './RecoveryEditor';
import RecoveryHistory from './RecoveryHistory';
import RecoverySettingsFields from './RecoverySettingsFields';
import {eligibleRecovery,setRecoveryPending} from '../utils/recoveries';
import {recoverySettings,hasRecovery} from '../utils/recoveryModel';
import {activityGradeLabel} from '../utils/gradeCalculations';
import React,{useState} from 'react';
import {SortButton,sortRows,useTableSort} from './TableSort';
import StudentName from './StudentName';
import {sourceCriterionId,criterionRubric,preserveLegacyCriterionGrades} from '../utils/activityCriteria';
import {AppState,CurricularActivity,Subject,StudentActivityGrade,StudentCriterionGrade,AspectFormat} from '../types';
import DetailPage from './DetailPage';
import {GradeBadge,GradeButtons} from './GradeControls';
import {TestAnswerInputs} from './TestScoringFields';
import {getActivityScore,getCriterionScore,getAspectScore,getCompSettings,scoreToCompetencial,exportActivitiesToExcel} from '../utils/gradeCalculations';

export default function ActivityGradePage({state,activity,subject,onChange,onBack}:{state:AppState;activity:CurricularActivity;subject:Subject;onChange:(s:AppState)=>void;onBack:()=>void}){
 const [recoverStudent,setRecoverStudent]=useState<string|null>(null);
 const [search,setSearch]=useState('');const {sort,toggle}=useTableSort();
 const settings=getCompSettings(subject),completion=activity.assessmentType==='completion';
 const students=sortRows(subject.students.filter(s=>s.name.toLocaleLowerCase().includes(search.toLocaleLowerCase())),sort,s=>s.name);
 const update=(id:string,fn:(g:StudentActivityGrade)=>StudentActivityGrade,commentOnly=false)=>{
  if(activity.recoveries?.[id]&&!commentOnly){window.alert('L’original està conservat a l’historial. Registra un nou intent per rectificar les notes.');return;}
  const prepared=preserveLegacyCriterionGrades(activity);
  const grades={...prepared,[id]:{...fn({...prepared[id]}),evaluatedAt:new Date().toISOString()}};
  onChange({...state,activities:(state.activities||[]).map(a=>a.id===activity.id?{...a,grades}:a)});
 };
 const rows:{id:string;kind:'criterion'|'aspect'|'global'}[]=completion?[{id:'',kind:'global'}]:[
  ...(activity.numericAspects||[]).map(a=>({id:a.id,kind:'aspect' as const})),
  ...(activity.criteriaIds||[]).map(id=>({id,kind:'criterion' as const}))
 ];
 if(!rows.length)rows.push({id:'',kind:'global'});
 const clear=()=>{if(Object.keys(activity.recoveries||{}).length){window.alert('Aquesta activitat té historial de recuperacions. Anul·la els intents individualment amb un motiu; les notes originals es conserven.');return;}if(window.confirm('Esborrar totes les notes, exempcions i comentaris dels alumnes d’aquesta activitat? El comentari general es conservarà.'))onChange({...state,activities:(state.activities||[]).map(a=>a.id===activity.id?{...a,grades:{}}:a)});};
 if(recoverStudent)return <RecoveryEditor state={state} activity={activity} studentId={recoverStudent} onChange={onChange} onBack={()=>setRecoverStudent(null)}/>;
 return <DetailPage title={`Avaluar · ${activity.code}`} subtitle={`${activity.title} · ${subject.name}`} onBack={onBack} actions={<><span className="text-sm text-slate-500 self-center">Desat automàtic</span><button className="ds-button" onClick={()=>exportActivitiesToExcel(subject,[activity],state.criteria,subject.students)}>Exportar Excel</button><button className="ds-button text-rose-700" onClick={clear}>Esborrar notes</button></>}>
  <details className="ds-panel"><summary className="cursor-pointer font-semibold">Política de recuperacions d’aquesta activitat</summary><label className="flex gap-2 my-2"><input type="checkbox" checked={!!activity.recoverySettings} onChange={e=>onChange({...state,activities:state.activities!.map(a=>a.id===activity.id?{...a,recoverySettings:e.target.checked?recoverySettings(subject):undefined}:a)})}/>Configuració pròpia (si no, s’aplica la de l’assignatura)</label>{activity.recoverySettings&&<RecoverySettingsFields value={recoverySettings(subject,activity)} onChange={recoverySettings=>onChange({...state,activities:state.activities!.map(a=>a.id===activity.id?{...a,recoverySettings}:a)})}/>}</details>
  <div className="ds-panel">
   <label htmlFor="activity-grading-comment" className="block text-sm font-semibold mb-2">Comentari general de l’activitat</label>
   <textarea id="activity-grading-comment" rows={2} className="block w-full resize-y" placeholder="Data de correcció, observacions generals…" value={activity.gradingComment||''} onChange={e=>{const gradingComment=e.target.value;onChange({...state,activities:(state.activities||[]).map(a=>a.id===activity.id?{...a,gradingComment}:a)});}}/>
  </div>
  <div className="ds-panel flex flex-wrap justify-between gap-3 items-center"><input aria-label="Cercar alumne" placeholder="Cercar alumne…" value={search} onChange={e=>setSearch(e.target.value)}/><span className="text-sm">{subject.students.length} alumnes · Lliurament {activity.endDate}</span><span className="text-sm">{completion?'Fet / No fet · seguiment sense nota numèrica':`AS ≥ ${settings.thresholds.AS} · AN ≥ ${settings.thresholds.AN} · AE ≥ ${settings.thresholds.AE} /4`}</span></div>
  {!!activity.numericAspects?.length&&!completion&&<p className="text-sm text-slate-600">Els subítems determinen la nota de l’ítem numèric. Els criteris vinculats s’avaluen separadament per al seguiment competencial.</p>}
  <div className="grade-table-wrap"><table className="grade-table"><thead><tr><th aria-sort={sort.direction==='asc'?'ascending':'descending'}><SortButton label="Alumne/a" column="name" sort={sort} onSort={toggle}/></th><th>Criteri / aspecte</th><th>Qualificació</th><th>Activitat</th><th>Comentari de l’alumne</th></tr></thead>
  {students.map((st,index)=>{const g=activity.grades?.[st.id]||{},total=getActivityScore(activity,st.id,subject);return <tbody key={st.id} className={`activity-student-group ${index%2?'student-even':'student-odd'}`}>{rows.map(({id,kind},row)=>{
   const aspect=kind==='aspect'?activity.numericAspects?.find(a=>a.id===id):undefined;
   const cr=kind==='criterion'?state.criteria.find(c=>c.id===sourceCriterionId(activity,id)):undefined;
   const cg=kind==='aspect'?g.aspectGrades?.[id]:kind==='criterion'?g.criteriaGrades?.[id]:undefined;
   const format:AspectFormat=aspect?.format||(kind==='criterion'?activity.criteriaGradingType?.[id]||'competencial':activity.numericGradingType||'numeric');
   const max=aspect?.maxScore??(kind==='criterion'?activity.criteriaMaxScores?.[id]??10:10);
   const label=completion?'Realització':aspect?.label||(kind==='criterion'?activity.criteriaCustomLabels?.[id]||cr?.key||id:'Nota global');
   const score=kind==='aspect'?getAspectScore(activity,st.id,id,subject):kind==='criterion'?getCriterionScore(activity,st.id,id,subject):total;
   const test=aspect?.test||(kind==='criterion'?activity.criteriaTests?.[id]:activity.numericTest);
   const write=(grade:StudentCriterionGrade|undefined)=>update(st.id,old=>{
    if(kind==='global'){delete old.score;delete old.competencialScore;delete old.testAnswers;if(grade){old.score=grade.rawScore;old.competencialScore=grade.competencialScore;old.testAnswers=grade.testAnswers;}}
    else{const field=kind==='aspect'?'aspectGrades':'criteriaGrades';old[field]={...old[field]};if(grade)old[field][id]=grade;else delete old[field][id];if(kind==='criterion'){delete old.score;delete old.competencialScore;}}
    return old;
   });
   const stateLabel=g.status==='not_submitted'?'NP':g.status==='exempt'?'Exempt':undefined;
   return <tr key={kind+id}>{row===0&&<td rowSpan={rows.length} className="student-cell"><span className="text-slate-400 mr-2">{index+1}</span><StudentName official state={state} student={st}/><RecoveryHistory activity={activity} studentId={st.id} state={state} onChange={onChange}/>{eligibleRecovery(activity,st.id,subject)&&recoverySettings(subject,activity).enabled&&<div className="flex flex-wrap gap-2 mt-2"><button className="ds-button" onClick={()=>setRecoverStudent(st.id)}>Registrar recuperació</button><label className="text-xs flex items-center gap-1"><input type="checkbox" checked={!!activity.recoveries?.[st.id]?.pending} onChange={e=>onChange(setRecoveryPending(state,activity,st.id,e.target.checked))}/>Pendent de recuperació</label></div>}{hasRecovery(activity,st.id)&&<p className="text-xs text-violet-700 mt-1">Vigent: {activityGradeLabel(activity,st.id,subject)}</p>}<span className="inline-flex gap-1 ml-2" role="group" aria-label={`Estat de l’activitat de ${st.name}`}>{(['not_submitted','exempt'] as const).map(status=><button key={status} disabled={!!activity.recoveries?.[st.id]} type="button" aria-pressed={g.status===status} title={status==='not_submitted'?'No presentat: compta com a 0 en activitats amb nota. Torna a prémer per retirar-ho.':'Exempt: no entra als càlculs ni al total d’activitats avaluades. Torna a prémer per retirar-ho.'} onClick={()=>update(st.id,old=>({...old,status:old.status===status?undefined:status}))} className={`px-2 py-1 rounded border text-xs ${g.status===status?(status==='not_submitted'?'bg-black text-white border-black':'bg-yellow-100 text-yellow-900 border-yellow-400'):'bg-white text-slate-600 border-slate-300'}`}>{status==='not_submitted'?'NP':'Exempt'}</button>)}</span></td>}
   <td title={cr?.description}><strong>{label}</strong>{kind!=='global'&&<small className="block text-slate-500">{aspect?'Subítem':cr?.key} · pes {aspect?.weight??activity.criteriaWeights?.[id]??1}</small>}</td>
   <td>{activity.recoveries?.[st.id]&&<small className="block text-slate-500">Evidència original conservada</small>}<fieldset disabled={!!activity.recoveries?.[st.id]}>{stateLabel?<span className="inline-flex items-center gap-2"><GradeBadge qual={stateLabel}/>{stateLabel==='NP'&&!completion&&<span>0</span>}</span>:completion?<div className="flex gap-2">{(['done','not_done'] as const).map(value=><button key={value} type="button" aria-pressed={g.completion===value} className={`ds-button ${g.completion===value?(value==='done'?'bg-emerald-100 text-emerald-800':'bg-rose-100 text-rose-800'):''}`} onClick={()=>{update(st.id,old=>({...old,completion:old.completion===value?undefined:value}));}}>{value==='done'?'Fet':'No fet'}</button>)}</div>:format==='test'?<TestAnswerInputs confirmClear={false} label={`${st.name}: ${label}`} value={kind==='global'?g.testAnswers:cg?.testAnswers} config={test} onChange={testAnswers=>write(testAnswers?{testAnswers}:undefined)}/>:format==='numeric'?<div className="flex items-center gap-2"><input className="score-input" aria-label={`${st.name}: ${label}`} type="number" min="0" max={max} step="0.01" value={(kind==='global'?g.score:cg?.rawScore)??''} onChange={e=>{const value=e.target.value===''?undefined:Math.max(0,Math.min(max,Number(e.target.value)));write(value===undefined?undefined:{rawScore:value,maxScore:max});}}/><span>/{max}</span>{kind!=='global'&&<span className="inline-flex items-center gap-2 border-l pl-2 text-sm text-slate-600"><span>{score===null?'—':score.toFixed(2)} /4</span>{score!==null&&<GradeBadge description={criterionRubric(activity,id,cr)[scoreToCompetencial(score,settings.thresholds)]} qual={scoreToCompetencial(score,settings.thresholds)}/>}</span>}</div>:<GradeButtons confirmClear={false} descriptions={criterionRubric(activity,id,cr)} label={`${st.name}: ${label}`} value={kind==='global'?g.competencialScore:cg?.competencialScore} onChange={q=>write((kind==='global'?g.competencialScore:cg?.competencialScore)===q?undefined:{competencialScore:q})}/>}</fieldset></td>
   {row===0&&<><td rowSpan={rows.length}>{hasRecovery(activity,st.id)?<span>{activityGradeLabel(activity,st.id,subject)}</span>:stateLabel?<span className="inline-flex items-center gap-2"><GradeBadge qual={stateLabel}/>{stateLabel==='NP'&&!completion&&<span>0</span>}</span>:completion?<GradeBadge qual={g.completion==='done'?'Fet':g.completion==='not_done'?'No fet':undefined}/>:total===null?'—':<div><b>{(total*(subject.evaluationType==='numeric'?2.5:1)).toFixed(2)}</b><span className="block"><GradeBadge qual={scoreToCompetencial(total,settings.thresholds)}/></span></div>}</td><td rowSpan={rows.length}><textarea rows={2} aria-label={`Comentari ${st.name}`} placeholder="Comentari…" value={g.comment||''} onChange={e=>update(st.id,old=>({...old,comment:e.target.value}),true)}/></td></>}
   </tr>;
  })}</tbody>;})}</table>{!students.length&&<p className="p-6 text-slate-500">No hi ha alumnes per mostrar.</p>}</div>
 </DetailPage>;
}
