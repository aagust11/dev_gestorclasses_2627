import React, { useEffect, useRef } from 'react';
import { ArrowLeft } from 'lucide-react';

export default function DetailPage({title,subtitle,onBack,children,actions}:{title:React.ReactNode;subtitle?:string;onBack:()=>void;children:React.ReactNode;actions?:React.ReactNode}) {
  const heading=useRef<HTMLHeadingElement>(null);
  useEffect(()=>{
    const workspace=heading.current?.closest('#main-content-scroll');
    if(workspace)workspace.scrollTo(0,0);else window.scrollTo(0,0);
    heading.current?.focus({preventScroll:true});
  },[]);
  return <section className="detail-page space-y-4">
    <header className="page-heading">
      <div className="flex items-center gap-3"><button type="button" className="ds-button" onClick={onBack}><ArrowLeft size={16}/>Tornar</button><div><h2 ref={heading} tabIndex={-1} className="text-xl font-bold outline-none">{title}</h2>{subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}</div></div>
      <div className="flex flex-wrap gap-2">{actions}</div>
    </header>
    {children}
  </section>;
}
