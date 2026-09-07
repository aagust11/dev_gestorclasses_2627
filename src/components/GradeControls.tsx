import React from 'react';
import { RubricDescriptions } from '../types';
import { QUAL_COLORS, QUAL_ORDER } from '../utils/gradeCalculations';

export function GradeBadge({qual,description}:{qual?:string;description?:string}) {
  const color=QUAL_COLORS[qual];
  return color ? <span title={description} className={`grade-badge ${color.badge}`}>{qual}</span> : <span className="text-slate-400">—</span>;
}

export function GradeButtons({value,onChange,label,descriptions}:{value?:string;onChange:(q:typeof QUAL_ORDER[number])=>void;label:string;descriptions?:RubricDescriptions}) {
  return <div className="flex gap-1" role="group" aria-label={label}>
    {QUAL_ORDER.map(q=><button type="button" key={q}
      title={descriptions?.[q] ? `${q}: ${descriptions[q]}` : `${q}: sense descripció configurada`}
      aria-pressed={value===q}
      aria-label={`${label}: ${q}${descriptions?.[q] ? '. '+descriptions[q] : ''}`}
      onClick={()=>onChange(q)}
      className={`grade-choice ${value===q?QUAL_COLORS[q].bg+' '+QUAL_COLORS[q].text:QUAL_COLORS[q].badge}`}>{q}</button>)}
  </div>;
}
