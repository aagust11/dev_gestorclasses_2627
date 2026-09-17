import React,{useEffect,useState} from 'react';
import {TestAnswers,TestScoring} from '../types';
import {DEFAULT_TEST,testResult} from '../utils/testScoring';
export function TestScoringFields({value=DEFAULT_TEST,onChange}:{value?:TestScoring;onChange:(v:TestScoring)=>void}){
 return <fieldset className="grid grid-cols-2 md:grid-cols-4 gap-2"><legend className="text-sm font-semibold">Puntuació del test</legend>{(['questions','correct','blank','incorrect'] as const).map(key=><label key={key} className="ds-field">{{questions:'Preguntes',correct:'Cada correcta',blank:'Cada blanc',incorrect:'Cada incorrecta'}[key]}<input required type="number" min={key==='questions'?1:key==='correct'?0.01:undefined} max={key==='questions'?100000:undefined} step={key==='questions'?1:0.01} value={Number.isFinite(value[key])?value[key]:''} onChange={e=>onChange({...value,[key]:e.target.value===''?NaN:Number(e.target.value)})}/></label>)}<p className="col-span-full text-xs text-slate-600">Màxim: {value.questions*value.correct} punts. Resultats negatius es computen com a 0. S’han d’indicar totes les respostes, incloent-hi els blancs.</p></fieldset>;
}
export function TestAnswerInputs({value,config=DEFAULT_TEST,label,onChange}:{value?:TestAnswers;config?:TestScoring;label:string;onChange:(v:TestAnswers|undefined)=>void}){
 const [draft,setDraft]=useState(()=>value?{...value}:null);
 useEffect(()=>setDraft(value?{...value}:null),[value]);
 const counts=draft||{correct:0,blank:0,incorrect:0},sum=counts.correct+counts.blank+counts.incorrect,result=testResult(draft||undefined,config);
 const update=(key:keyof TestAnswers,raw:string)=>{
  const next={...counts,[key]:raw===''?0:Math.max(0,Math.floor(Number(raw)))};setDraft(next);
  if(next.correct+next.blank+next.incorrect<=config.questions)onChange(next);
 };
 return <div className="space-y-1"><div className="flex flex-wrap gap-2">{(['correct','blank','incorrect'] as const).map(key=><label key={key} className="text-xs">{{correct:'Correctes',blank:'Blancs',incorrect:'Incorrectes'}[key]}<input className="block w-20" type="number" min="0" max={config.questions} step="1" aria-label={`${label}: ${key==='correct'?'correctes':key==='blank'?'blancs':'incorrectes'}`} value={draft?counts[key]:''} onChange={e=>update(key,e.target.value)}/></label>)}<button type="button" className="text-xs text-rose-700" onClick={()=>{if(window.confirm(`Esborrar les respostes de ${label}?`)){setDraft(null);onChange(undefined);}}}>Esborrar test</button></div><p className={sum>config.questions?'text-xs text-rose-700':'text-xs text-slate-600'}>{sum}/{config.questions} respostes · {sum>config.questions?'Massa respostes: corregeix-les; aquest canvi no s’ha desat.':result?`${result.score.toFixed(2)} / ${result.max} punts · ${result.normalized.toFixed(2)} /4`:'Pendent de completar el test'}</p></div>;
}
