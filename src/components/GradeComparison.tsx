import React from 'react';
import {ReportGrade,gradeText} from '../utils/studentReport';
import {GradeBadge} from './GradeControls';
export default function GradeComparison({grade,automatic}:{grade?:ReportGrade;automatic?:ReportGrade}) {
  return <div>{grade?.score==null?<span className="text-slate-400">—</span>:<div className="flex items-center gap-2"><b>{grade.score.toFixed(2)}{grade.isManual?' ✎':''}</b><GradeBadge qual={grade.qual}/></div>}{grade?.isManual&&<small className="block text-slate-500 mt-1">Calculada: {gradeText(automatic)}</small>}</div>;
}
