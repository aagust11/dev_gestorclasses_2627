import React,{useState} from 'react';
import {Link,Table,FileText,Folder,Calendar,Users,BookOpen,Star,Video,BarChart,Check,Globe,Plus,Pencil,Trash2} from 'lucide-react';
import {AppState,Subject} from '../types';
import {Bookmark,bookmarkIcons,bookmarkColors,bookmarkFamily,visibleBookmarks,safeBookmarkUrl,saveBookmark} from '../utils/bookmarks';
const icons={link:Link,sheet:Table,file:FileText,folder:Folder,calendar:Calendar,users:Users,book:BookOpen,star:Star,video:Video,chart:BarChart,check:Check,globe:Globe};
const labels={link:'Enllaç',sheet:'Full de càlcul',file:'Document',folder:'Carpeta',calendar:'Calendari',users:'Persones',book:'Llibre',star:'Estrella',video:'Vídeo',chart:'Gràfic',check:'Tasques',globe:'Web'};
const colors={blue:'#2563eb',green:'#15803d',amber:'#b45309',purple:'#7e22ce',rose:'#be123c',slate:'#475569'};
type Props={state:AppState;subject:Subject;onChangeState?:(next:AppState,base?:AppState)=>boolean|void};
export default function BookmarkBar({state,subject,onChangeState}:Props){
 const [draft,setDraft]=useState<{base:AppState;ownerId:string;link:Bookmark}|null>(null);
 const [error,setError]=useState('');
 const family=bookmarkFamily(state,subject),hasFamily=state.subjects.filter(s=>bookmarkFamily(state,s)===family).length>1||subject.isParent;
 const begin=(ownerId:string,link:Bookmark)=>{setError('');setDraft({base:state,ownerId,link:{...link}});};
 if(draft)return <section className="ds-panel space-y-3"><header className="flex justify-between items-center"><h3 className="font-bold">Configurar accés ràpid</h3><button className="ds-button" onClick={()=>setDraft(null)}>Tornar</button></header>
 <form className="space-y-3" onSubmit={e=>{e.preventDefault();try{if(onChangeState?.(saveBookmark(draft.base,draft.ownerId,draft.link),draft.base)!==false)setDraft(null);}catch(e){setError((e as Error).message);}}}>
 <label className="ds-field">Nom<input required value={draft.link.label} onChange={e=>setDraft({...draft,link:{...draft.link,label:e.target.value}})}/></label>
 <label className="ds-field">Enllaç<input required type="text" placeholder="https://…" value={draft.link.url} onChange={e=>setDraft({...draft,link:{...draft.link,url:e.target.value}})}/></label>
 <fieldset><legend className="text-sm font-semibold mb-2">Icona</legend><div className="flex flex-wrap gap-2">{bookmarkIcons.map(key=>{const Icon=icons[key];return <button type="button" key={key} title={labels[key]} aria-label={labels[key]} aria-pressed={(draft.link.icon||'link')===key} className={'p-2 rounded border '+((draft.link.icon||'link')===key?'bg-blue-100 border-blue-600':'border-slate-200')} onClick={()=>setDraft({...draft,link:{...draft.link,icon:key}})}><Icon size={20}/></button>;})}</div></fieldset>
 <label className="ds-field">Color<select value={draft.link.color||'blue'} onChange={e=>setDraft({...draft,link:{...draft.link,color:e.target.value}})}>{bookmarkColors.map((key,i)=><option key={key} value={key}>{['Blau','Verd','Ocre','Lila','Rosa','Gris'][i]}</option>)}</select></label>
 {hasFamily&&<label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={!!draft.link.shared} onChange={e=>setDraft({...draft,link:{...draft.link,shared:e.target.checked}})}/>Compartir amb el grup mare i tots els seus subgrups. Els canvis d’aquest accés s’aplicaran a tots.</label>}
 {draft.ownerId!==subject.id&&<p className="text-sm text-slate-500">Aquest accés pertany a {state.subjects.find(s=>s.id===draft.ownerId)?.name}. Si deixes de compartir-lo, només hi apareixerà.</p>}
 {error&&<p role="alert" className="text-rose-700">{error}</p>}<button className="ds-button ds-primary" type="submit">Desar accés</button>
 </form></section>;
 const entries=visibleBookmarks(state,subject);
 return <section className="ds-panel space-y-3"><header className="flex items-center justify-between gap-2"><h3 className="font-bold">Accessos ràpids</h3>{onChangeState&&<button className="ds-button" onClick={()=>begin(subject.id,{id:'link_'+crypto.randomUUID(),label:'',url:'',icon:'link',color:'blue',shared:false})}><Plus size={16}/>Afegir</button>}</header>
 <div className="flex flex-wrap gap-2">{entries.map(({owner,link})=>{const Icon=icons[link.icon as keyof typeof icons]||Link,url=safeBookmarkUrl(link.url);return <div key={owner.id+':'+link.id} className="flex items-center rounded-lg border border-slate-200 bg-white" style={{borderLeft:'4px solid '+(colors[link.color as keyof typeof colors]||colors.blue)}}>
 {url?<a href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-3 py-2 font-medium text-sm" title={link.url+(link.shared?' · Compartit amb el grup':'')}><Icon size={20} style={{color:colors[link.color as keyof typeof colors]||colors.blue}}/>{link.label}{link.shared&&<Users size={12} aria-label="Compartit"/>}</a>:<span className="px-3 text-sm">{link.label} · URL no vàlid</span>}
 {onChangeState&&<><button className="p-2 text-slate-500" aria-label={'Editar '+link.label} onClick={()=>begin(owner.id,link)}><Pencil size={14}/></button><button className="p-2 text-rose-700" aria-label={'Eliminar '+link.label} onClick={()=>{if(window.confirm('Eliminar l’accés «'+link.label+'»?'+(link.shared?' Desapareixerà de tot el grup.':'')))onChangeState({...state,subjects:state.subjects.map(s=>s.id===owner.id?{...s,generalLinks:(s.generalLinks||[]).filter(l=>l.id!==link.id)}:s)},state);}}><Trash2 size={14}/></button></>}
 </div>;})}</div>{!entries.length&&<p className="text-sm text-slate-500">Afegeix documents, fulls de càlcul o webs. Estaran disponibles a totes les sessions d’aquesta assignatura.</p>}
 {!!subject.generalNotes?.length&&<details><summary className="text-sm cursor-pointer">Anotacions permanents anteriors ({subject.generalNotes.length})</summary>{subject.generalNotes.map((note,i)=><p key={i} className="text-sm whitespace-pre-wrap p-2">{note}</p>)}</details>}
 </section>;
}
