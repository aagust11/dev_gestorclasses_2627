import React,{useEffect,useRef,useState} from 'react';
import {compactBookmarkImage,importBookmarkImageUrl,validBookmarkImage} from '../utils/bookmarkImages';
export default function BookmarkImagePicker({value,onChange,onBusy}:{value?:string;onChange:(value:string|undefined)=>void;onBusy:(busy:boolean)=>void}){
 const [url,setUrl]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const generation=useRef(0);
 useEffect(()=>()=>{generation.current++;},[]);
 const run=async(task:()=>Promise<string>)=>{const id=++generation.current;setError('');setBusy(true);onBusy(true);try{const image=await task();if(id===generation.current)onChange(image);}catch(e){if(id===generation.current)setError((e as Error).message);}finally{if(id===generation.current){setBusy(false);onBusy(false);}}};
 return <fieldset className="space-y-2 border rounded-lg p-3"><legend className="text-sm font-semibold px-1">Icona personalitzada</legend>
 <div className="flex flex-wrap items-center gap-3"><a className="ds-button" href="https://www.flaticon.com/" target="_blank" rel="noopener noreferrer">Buscar a Flaticon ↗</a>
 <label className="ds-field">Pujar imatge<input disabled={busy} type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>{const file=e.target.files?.[0];e.target.value='';if(file)void run(()=>compactBookmarkImage(file));}}/></label></div>
 <div className="flex items-end gap-2"><label className="ds-field flex-1">URL directa de la imatge<input type="url" value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://…/icona.png"/></label><button className="ds-button" type="button" disabled={busy||!url.trim()} onClick={()=>void run(()=>importBookmarkImageUrl(url))}>Carregar imatge</button></div>
 <p className="text-xs text-slate-500">PNG, JPG o WebP, fins a 2 MB. Es guarda una còpia petita al fitxer de dades. La URL ha de ser la de la imatge, no la pàgina de Flaticon.</p>
 {busy&&<p role="status">Preparant la icona…</p>}{error&&<p role="alert" className="text-rose-700 text-sm">{error}</p>}
 {value&&validBookmarkImage(value)&&<div className="flex items-center gap-3"><img src={value} alt="Previsualització de la icona" width={48} height={48} className="object-contain"/><button type="button" className="ds-button" disabled={busy} onClick={()=>onChange(undefined)}>Utilitzar icona de la llista</button></div>}
 </fieldset>;
}
