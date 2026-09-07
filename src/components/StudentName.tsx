import React, {useEffect, useId, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import {AppState} from '../types';
import {hasStudentSupport} from '../utils/studentProfile';

function SupportDialog({name,measures,onClose}:{name:string;measures:string;onClose:()=>void}) {
  const dialog=useRef<HTMLDialogElement>(null);
  const headingId=useId();
  useEffect(()=>{
    const element=dialog.current;
    const previous=document.activeElement as HTMLElement|null;
    element?.showModal();
    return ()=>{element?.close();previous?.focus();};
  },[]);
  return createPortal(<dialog ref={dialog} aria-labelledby={headingId} className="support-dialog" onCancel={e=>{e.preventDefault();onClose();}} onClick={e=>{e.stopPropagation();if(e.target===e.currentTarget){const rect=e.currentTarget.getBoundingClientRect();if(e.clientX<rect.left||e.clientX>rect.right||e.clientY<rect.top||e.clientY>rect.bottom)onClose();}}} onKeyDown={e=>e.stopPropagation()}>
    <header className="flex items-start justify-between gap-4 border-b border-slate-200 pb-3 mb-4"><div><h2 id={headingId} className="font-bold text-lg">Mesures de suport</h2><p className="text-sm text-slate-600">{name}</p></div><button type="button" autoFocus className="ds-button" onClick={onClose} aria-label="Tancar mesures de suport">Tancar</button></header>
    <p className="whitespace-pre-wrap text-sm leading-relaxed">{measures||'Aquest alumne té informació al PSI, però no té mesures de suport escrites. Pots consultar el PSI des de la seva fitxa.'}</p>
  </dialog>,document.body);
}

export default function StudentName({state,student}:{state:AppState;student:{id:string;name:string}}) {
  const [open,setOpen]=useState(false);
  const measures=state.studentProfiles?.[student.id]?.supportMeasures?.trim()||'';
  const activate=(event:React.SyntheticEvent)=>{event.preventDefault();event.stopPropagation();setOpen(true);};
  return <>{student.name}{hasStudentSupport(state,student.id)&&<><span className="inline-block ml-1 text-violet-700 font-serif font-bold text-lg leading-none cursor-pointer rounded focus:outline-2 focus:outline-violet-700" role="button" tabIndex={0} aria-label={`Veure mesures de suport de ${student.name}`} aria-haspopup="dialog" aria-expanded={open} title={measures||'Té informació al PSI. Clica per veure les mesures de suport.'} onClick={activate} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){activate(e);}}} onKeyUp={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.stopPropagation();}}}>ψ</span>{open&&<SupportDialog name={student.name} measures={measures} onClose={()=>setOpen(false)}/>}</>}</>;
}
