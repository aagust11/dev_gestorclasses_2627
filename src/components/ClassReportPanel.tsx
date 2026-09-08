import React,{useMemo,useState} from 'react';
import {AppState,Subject,CalculationMode} from '../types';
import {buildClassReport} from '../utils/classReport';
import {downloadReport} from '../utils/reportDocument';
export default function ClassReportPanel({state,subject,period,method}:{state:AppState;subject:Subject;period:string;method:CalculationMode}){
  const report=useMemo(()=>buildClassReport(state,subject,period,method),[state,subject,period,method]);
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  const download=async(format:'word'|'pdf')=>{setBusy(true);setError('');try{await downloadReport(report,format);}catch(e){setError((e as Error).message);}finally{setBusy(false);}};
  return <section className="ds-panel space-y-3"><h3 className="font-bold">Informe de grup · {subject.name}</h3><p className="text-sm">Selecciona l’assignatura, el període i el mètode als filtres d’aquesta vista. «Curs complet» genera l’informe anual.</p>{!state.config.teacherProfile?.fullName&&<p className="text-amber-800 text-sm">Configura el Perfil Docent per incloure el teu nom i correu als informes.</p>}<div className="flex gap-2"><button className="ds-button" disabled={busy} onClick={()=>void download('word')}>Informe Word</button><button className="ds-button" disabled={busy} onClick={()=>void download('pdf')}>Informe PDF</button></div>{report.sections.slice(0,2).map(section=><div key={section.title}><h4 className="font-semibold">{section.title}</h4><div className="overflow-auto"><table className="grade-table"><thead><tr>{section.headers.map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{section.rows.map((row,i)=><tr key={i}>{row.map((c,j)=><td key={j}>{c}</td>)}</tr>)}</tbody></table></div></div>)}<p className="text-xs text-slate-500">{report.intro.slice(1).join(' ')}</p>{error&&<p role="alert" className="text-rose-700">{error}</p>}</section>;
}
