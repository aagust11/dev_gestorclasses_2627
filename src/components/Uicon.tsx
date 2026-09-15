import React,{useEffect,useRef,useState} from 'react';
import {Link} from 'lucide-react';
import {parseUicon,uiconStyles} from '../utils/uicons';
const loaded=new Map<string,Promise<void>>();
function loadStyle(style:string){
 if(!loaded.has(style))loaded.set(style,new Promise<void>((resolve,reject)=>{
 const link=document.createElement('link');link.rel='stylesheet';link.href='https://cdn-uicons.flaticon.com/4.0.0/uicons-'+style+'/css/uicons-'+style+'.css';
 link.onload=()=>resolve();link.onerror=()=>{loaded.delete(style);link.remove();reject(Error('No disponible'));};document.head.appendChild(link);
 }));
 return loaded.get(style)!;
}
export default function Uicon({value,color}:{value:string;color?:string}){
 const parsed=parseUicon(value),ref=useRef<HTMLElement>(null),[status,setStatus]=useState('loading');
 useEffect(()=>{let active=true;setStatus('loading');if(!parsed){setStatus('error');return;}
 const style=uiconStyles[parsed.split(' ')[1].split('-')[1]];
 loadStyle(style).then(()=>{if(!active)return;const content=ref.current?getComputedStyle(ref.current,'::before').content:'none';setStatus(content&&content!=='none'&&content!=='normal'&&content!=='""'?'ready':'error');}).catch(()=>{if(active)setStatus('error');});
 return()=>{active=false;};},[parsed]);
 return <span className="inline-flex items-center gap-1" style={{color}} title={status==='error'?'Icona no disponible: comprova la classe i la connexió':undefined}>
 <i ref={ref} className={parsed||''} aria-hidden="true" style={{fontSize:20,display:status==='error'?'none':'inline-block'}}/>
 {status!=='ready'&&<Link size={20}/>}
 </span>;
}
