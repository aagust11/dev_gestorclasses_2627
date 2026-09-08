import React,{useState} from 'react';
import {ArrowUp,ArrowDown,ArrowUpDown} from 'lucide-react';
export type SortState={key:string;direction:'asc'|'desc'};
const collator=new Intl.Collator('ca',{numeric:true,sensitivity:'base'});
export function sortRows<T>(rows:readonly T[],sort:SortState,value:(row:T,key:string)=>string|number|null|undefined):T[]{
  return [...rows].sort((a,b)=>{const x=value(a,sort.key),y=value(b,sort.key);if(x==null)return y==null?0:1;if(y==null)return -1;const n=typeof x==='number'&&typeof y==='number'?x-y:collator.compare(String(x),String(y));return sort.direction==='asc'?n:-n;});
}
export function useTableSort(key='name'){
  const [sort,setSort]=useState<SortState>({key,direction:'asc'});
  const toggle=(key:string)=>setSort(old=>({key,direction:old.key===key&&old.direction==='asc'?'desc':'asc'}));
  return {sort,toggle};
}
export function SortButton({label,column,sort,onSort,compact=false}:{label:string;column:string;sort:SortState;onSort:(key:string)=>void;compact?:boolean}){
  const active=sort.key===column,Icon=active?(sort.direction==='asc'?ArrowUp:ArrowDown):ArrowUpDown;
  return <button type="button" className="inline-flex items-center gap-1 font-semibold" onClick={()=>onSort(column)} title={`Ordenar ${label}: ${active&&sort.direction==='asc'?'descendent':'ascendent'}`} aria-label={`Ordenar ${label}: ${active&&sort.direction==='asc'?'descendent':'ascendent'}`}>{!compact&&label}<Icon size={14} aria-hidden="true"/></button>;
}
