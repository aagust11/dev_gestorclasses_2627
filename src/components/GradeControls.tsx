import React from 'react';
import { QUAL_COLORS, QUAL_ORDER } from '../utils/gradeCalculations';
export function GradeBadge({qual}:{qual?:string}) {const c=QUAL_COLORS[qual];return c?<span className={`grade-badge ${c.badge}`}>{qual}</span>:<span className="text-slate-400">—</span>;}
export function GradeButtons({value,onChange,label}:{value?:string;onChange:(q:typeof QUAL_ORDER[number])=>void;label:string}) {return <div className="flex gap-1" role="group" aria-label={label}>{QUAL_ORDER.map(q=><button type="button" key={q} aria-pressed={value===q} aria-label={`${label}: ${q}`} onClick={()=>onChange(q)} className={`grade-choice ${value===q?QUAL_COLORS[q].bg+' '+QUAL_COLORS[q].text:QUAL_COLORS[q].badge}`}>{q}</button>)}</div>;}
