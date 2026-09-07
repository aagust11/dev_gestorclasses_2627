import React from 'react';
import {AppState} from '../types';
import {hasStudentSupport} from '../utils/studentProfile';
export default function StudentName({state,student}:{state:AppState;student:{id:string;name:string}}) {
  return <>{student.name}{hasStudentSupport(state,student.id)&&<span className="inline-block ml-1 text-violet-700 font-serif font-bold text-lg leading-none" role="img" aria-label="Té PSI o mesures de suport" title="Té PSI o mesures de suport">ψ</span>}</>;
}
