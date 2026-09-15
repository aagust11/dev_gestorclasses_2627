import React,{useState} from 'react';
import {AppState,SessionLog,StudentLog} from '../types';
import SessionView from './SessionView';
import {diaryBlock,blockLogs,combineBlockLogs,effectiveSessionLogs,getDayBlocks,storeBlockLog} from '../utils/sessionBlocks';
import {classroomName} from '../utils/studentNames';
import {attendanceLabels} from '../utils/attendance';

type Props={state:AppState;scheduleItemId:string;dateStr:string;onBackToTimeline:()=>void;onNavigateToSession:(id:string,date:string)=>void;onChangeState:(state:AppState,base?:AppState)=>boolean|void;onSaveSessionLog:(log:SessionLog)=>void};
export default function SessionBlockPage(p:Props){
  const visualBlock=getDayBlocks(p.state,p.dateStr).find(b=>b.id===p.scheduleItemId||b.memberIds.includes(p.scheduleItemId));
  if(!visualBlock)return <SessionView {...p}/>;
  const block=diaryBlock(p.state,visualBlock,p.dateStr);
  const logs=blockLogs(p.state,block,p.dateStr);
  if(logs.length>1)return <Review key={JSON.stringify(logs)} {...p} block={block} logs={logs}/>;
  const projected={...p.state,sessionLogs:effectiveSessionLogs(p.state)};
  return <SessionView {...p} state={projected} scheduleItemId={block.id} displayStart={visualBlock.startTime} displayEnd={visualBlock.endTime}
    onChangeState={next=>p.onChangeState({...next,sessionLogs:p.state.sessionLogs},p.state)}
    onSaveSessionLog={log=>p.onChangeState(storeBlockLog(p.state,block,p.dateStr,log),p.state)}/>;
}
function Review(p:Props & {block:ReturnType<typeof getDayBlocks>[number];logs:SessionLog[]}){
  const {log,conflicts}=combineBlockLogs(p.block,p.dateStr,p.logs);
  const [choices,setChoices]=useState<Record<string,{status?:StudentLog['status'];score?:number}>>({});
  const [error,setError]=useState('');
  const ready=conflicts.every(c=>(c.statuses.length<=1||choices[c.studentId]?.status!==undefined)&&(c.scores.length<=1||choices[c.studentId]?.score!==undefined));
  const save=()=>{
    if(!ready||!confirm('Unificar aquests registres en un únic bloc? Es conservaran els comentaris i es crearà una còpia recuperable abans del canvi.'))return;
    const attendance={...log.attendance};
    for(const c of conflicts)attendance[c.studentId]={...attendance[c.studentId],...choices[c.studentId]};
    try{p.onChangeState(storeBlockLog(p.state,p.block,p.dateStr,{...log,attendance}),p.state);}catch(e){setError((e as Error).message);}
  };
  return <section className="space-y-4"><header className="page-heading"><div><h2 className="text-xl font-bold">Unificar el registre de la sessió</h2><p>{p.dateStr} · {p.block.startTime}–{p.block.endTime}</p></div><button className="ds-button" onClick={p.onBackToTimeline}>Tornar</button></header>
    <p className="ds-panel">Aquestes franges tenen {p.logs.length} registres previs. Es conservaran tots els comentaris en un sol diari. Revisa les diferències abans d’unificar-los. Als resums, una assistència contradictòria es mostra pendent fins que la resolguis.</p>
    {p.logs.map(l=><details className="ds-panel" key={l.id}><summary className="cursor-pointer font-semibold">Registre original · {l.scheduleItemId}</summary><p className="whitespace-pre-wrap">{l.comments||'Sense diari'}</p><p className="whitespace-pre-wrap">{l.nextSessionNotes||'Sense previsió'}</p><ul>{Object.entries(l.attendance||{}).map(([id,a])=><li key={id}>{p.state.studentRegistry?.[id]?.name||id}: {attendanceLabels[a.status]}{a.score!=null?' · nota '+a.score:''}{(['pos','regular','incident'] as const).flatMap(k=>a[`${k}Comments`]??(a[`${k}Comment`]?[a[`${k}Comment`]!]:[])).map((c,i)=><p key={i} className="text-sm whitespace-pre-wrap">{c}</p>)}</li>)}</ul></details>)}
    {conflicts.map(c=><div className="ds-panel flex flex-wrap gap-3 items-center" key={c.studentId}><b>{p.state.studentRegistry?.[c.studentId]?classroomName(p.state.studentRegistry[c.studentId]):c.studentId}</b>
      {c.statuses.length>1&&<label>Assistència del bloc<select aria-label={'Assistència '+c.studentId} value={choices[c.studentId]?.status||''} onChange={e=>setChoices({...choices,[c.studentId]:{...choices[c.studentId],status:e.target.value as StudentLog['status']}})}><option value="" disabled>Escull el registre correcte</option>{Object.entries(attendanceLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>}
      {c.scores.length>1&&<label>Nota històrica de sessió<select aria-label={'Nota '+c.studentId} value={choices[c.studentId]?.score??''} onChange={e=>setChoices({...choices,[c.studentId]:{...choices[c.studentId],score:Number(e.target.value)}})}><option value="" disabled>Escull la nota correcta</option>{c.scores.map(s=><option key={s} value={s!}>{s}</option>)}</select></label>}</div>)}
    {error&&<p role="alert">{error}</p>}<button className="ds-button" disabled={!ready} onClick={save}>Unificar i obrir el diari</button>
  </section>;
}
