import {syncStudentRegistry,identityConflicts} from './utils/studentIdentity';
import {IdentityReview} from './components/IdentityReview';
import {createRecoveryCopy,recoveryCopies,readStoredRaw,waitForFileWrites} from './storage';
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Download, 
  Upload, 
  RotateCcw, 
  FileJson, 
  Check, 
  HardDrive,
  BookOpen,
  CalendarCheck,
  AlertCircle
} from 'lucide-react';
import { AppState, SessionLog } from './types';
import { getInitialState } from './initialState';
import { 
  loadStateFromLocalStorage, 
  saveStateToLocalStorage, 
  triggerJsonDownload,
  getFileHandle,
  setFileHandle,
  removeFileHandle,
  verifyPermission,
  loadFromFileHandle,
  saveToFileHandle,
  validateState,
  normalizeState
} from './storage';

// Import Views
import Sidebar from './components/Sidebar';
import HorariView from './components/HorariView';
import SessionView from './components/SessionView';
import PlansView from './components/PlansView';
import ConfiguracioView from './components/ConfiguracioView';
import ClassesView from './components/ClassesView';
import RendimentView from './components/RendimentView';
import ActivitatsView from './components/ActivitatsView';
import StudentsView from './components/StudentsView';
import QualificacionsView from './components/QualificacionsView';

export default function App() {
  const [localState, setLocalState] = useState<AppState>(getInitialState());
  const [configSubjectId, setConfigSubjectId] = useState<string | null>(null);
  const [studentId,setStudentId]=useState<string|null>(null);
  const openStudent=(id:string)=>{setStudentId(id);setActiveView('alumnat');};
  const [activeView, setActiveView] = useState<string>('horari');
  
  // Sibling states for showing detailed individual Session Journal Logs
  const [selectedSessionSlotId, setSelectedSessionSlotId] = useState<string | null>(null);
  const [selectedSessionDate, setSelectedSessionDate] = useState<string | null>(null);

  // File System Access states
  const [linkedFileHandle, setLinkedFileHandle] = useState<any>(null);
  const [linkedFileName, setLinkedFileName] = useState<string | null>(null);

  // File Input Ref for traditional fallback uplinks
  const fileInputRef = useRef<HTMLInputElement>(null);

  const current=useRef(localState);
  const handleRef=useRef<any>(null);
  const revision=useRef(0);
  const [saveStatus,setSaveStatus]=useState<'saved'|'saving'|'error'>('saved');
  const [saveError,setSaveError]=useState('');
  const [blocked,setBlocked]=useState(false);
  const [busy,setBusy]=useState(false);
  const [showRecovery,setShowRecovery]=useState(false);
  const [copies,setCopies]=useState<ReturnType<typeof recoveryCopies>>([]);
  const [availableHandle,setAvailableHandle]=useState<any>(null);
  const fail=(e:any)=>{setSaveStatus('error');setSaveError(e?.message||String(e));};
  const install=(next:AppState)=>{current.current=next;setLocalState(next);};
  const snapshot=(reason:string)=>{createRecoveryCopy(current.current,reason);};
  const persist=async(next:AppState,target=handleRef.current)=>{
    const seq=++revision.current;setSaveStatus('saving');setSaveError('');
    const errors:string[]=[];
    try{saveStateToLocalStorage(next);}catch(e){errors.push('Navegador: '+e.message);}
    if(target)try{await saveToFileHandle(target,next);}catch(e){errors.push('Fitxer: '+e.message);}
    if(seq!==revision.current)return;
    if(errors.length)fail(Error(errors.join(' · ')));else setSaveStatus('saved');
  };
  useEffect(()=>{
    try{
      const loaded=loadStateFromLocalStorage();
      if(!loaded.identityVersion){createRecoveryCopy(loaded,'Abans de migrar les identitats');}
      const normalized=syncStudentRegistry(loaded);install(normalized);if(!identityConflicts(normalized).length)void persist(normalized,null);
    }catch(e){setBlocked(true);fail(e);}
    // Finding a handle must never replace newer browser data or edits made during startup.
    getFileHandle().then(h=>{if(h)setAvailableHandle(h);}).catch(e=>setSaveError('No s’ha pogut recuperar l’enllaç al fitxer: '+e.message));
  },[]);
  useEffect(()=>{
    const guard=(e:BeforeUnloadEvent)=>{if(saveStatus!=='saved'){e.preventDefault();e.returnValue='';}};
    window.addEventListener('beforeunload',guard);return()=>window.removeEventListener('beforeunload',guard);
  },[saveStatus]);
  const triggerStateUpdate=(next:AppState)=>{
    if(blocked||busy)return;
    try {
      const roster=(s:AppState)=>JSON.stringify(s.subjects.map(x=>[x.id,x.students.map(st=>st.id)]));
      if(roster(next)!==roster(current.current)||JSON.stringify(Object.keys(next.studentRegistry||{}))!==JSON.stringify(Object.keys(current.current.studentRegistry||{})))snapshot('Abans de modificar les matrícules o unificar fitxes');
      const normalized=syncStudentRegistry(next);install(normalized);void persist(normalized);
    }catch(e){fail(e);}
  };
  const replaceState=async(next:AppState,reason:string,target=handleRef.current)=>{
    setBusy(true);
    try{
      await waitForFileWrites();
      if(!blocked)snapshot(reason);
      else {const raw=readStoredRaw();if(raw)localStorage.setItem('gestor_classes_unreadable_recovery',raw);}
      if(!next.identityVersion)createRecoveryCopy(next,'Original importat abans de migrar identitats');
      const normalized=syncStudentRegistry(next);install(normalized);setBlocked(false);setStudentId(null);
      await persist(normalized,target);
    }catch(e){fail(e);}finally{setBusy(false);}
  };
  const connect=async(handle:any,keepCurrent=false)=>{
    setBusy(true);
    try{
      await waitForFileWrites();
      if(!await verifyPermission(handle,true))throw Error('No hi ha permís per escriure al fitxer.');
      const loaded=await loadFromFileHandle(handle);
      if(!loaded)throw Error('El fitxer no és vàlid. No s’ha modificat ni enllaçat.');
      if(!confirm(keepCurrent?'Vols enllaçar aquest fitxer i desar-hi les dades actuals? Es conservarà una còpia del contingut anterior del fitxer.':'Vols carregar les dades d’aquest fitxer i activar-hi el desat? La còpia actual del navegador es conservarà abans de substituir-la.'))return;
      if(!blocked)snapshot('Abans de carregar el fitxer enllaçat');
      else {const raw=readStoredRaw();if(raw)localStorage.setItem('gestor_classes_unreadable_recovery',raw);}
      if(keepCurrent||!loaded.identityVersion)createRecoveryCopy(loaded,'Fitxer original abans d’enllaçar');
      await setFileHandle(handle);handleRef.current=handle;setLinkedFileHandle(handle);setLinkedFileName(handle.name);setAvailableHandle(null);
      const normalized=syncStudentRegistry(keepCurrent?current.current:loaded);install(normalized);setBlocked(false);setStudentId(null);
      await persist(normalized,handle);
    }catch(e){fail(e);}finally{setBusy(false);}
  };
  const handleRegisterFileHandle=async()=>{
    if(!('showOpenFilePicker' in window)){fileInputRef.current?.click();return;}
    try{const [handle]=await (window as any).showOpenFilePicker({types:[{description:'Fitxer de dades JSON',accept:{'application/json':['.json']}}],multiple:false});if(handle)await connect(handle);}catch(e){if(e.name!=='AbortError')fail(e);}
  };
  const handleReleaseFileHandle=async()=>{
    setBusy(true);try{await waitForFileWrites();await removeFileHandle();handleRef.current=null;setLinkedFileHandle(null);setLinkedFileName(null);await persist(current.current,null);}catch(e){fail(e);}finally{setBusy(false);}
  };
  const handleFallbackImportJson=async(e:React.ChangeEvent<HTMLInputElement>)=>{
    const file=e.target.files?.[0];e.target.value='';if(!file)return;
    setBusy(true);
    try{const parsed=JSON.parse(await file.text());if(!validateState(parsed))throw Error('Estructura JSON invàlida; no s’han substituït dades.');await replaceState(normalizeState(parsed),'Abans d’importar JSON');}catch(e){fail(e);}finally{setBusy(false);}
  };
  const handleExportBackup=()=>triggerJsonDownload(current.current,'docentsuite_dades_curs.json');
  const handleResetCourseState=()=>{
    if(confirm('Vols restablir el curs? Es conservarà una còpia recuperable de les dades actuals.'))void replaceState(getInitialState(),'Abans de restablir el curs');
  };
  const openRecovery=()=>{try{setCopies(recoveryCopies());setShowRecovery(v=>!v);}catch(e){fail(e);}};

  // Handler for opening class details from Horari
  const handleSelectSessionFromGrid = (scheduleItemId: string, date: string) => {
    setSelectedSessionSlotId(scheduleItemId);
    setSelectedSessionDate(date);
    setActiveView('session_log'); // Virtual router view for logging class diary
  };

  return (
    <div id="app-viewport" className="min-h-screen bg-[#F8FAFC] text-slate-800 flex pl-56 font-sans antialiased selection:bg-blue-600/10 selection:text-blue-600">
      
      {/* Fallback hidden file input */}
      <input 
        type="file" 
        ref={fileInputRef} 
        accept=".json" 
        className="hidden" 
        onChange={handleFallbackImportJson} 
      />

      {/* Persistent Sidebar */}
      <Sidebar 
        activeView={activeView === 'session_log' ? 'horari' : activeView}
        onViewChange={(view) => {
          setConfigSubjectId(null);
          setActiveView(view);
          setSelectedSessionSlotId(null);
          setSelectedSessionDate(null);
        }}
      />

      {/* Main Workspace Frame container */}
      <div id="workspace-frame" className="flex-1 min-h-screen flex flex-col">
        <header id="workspace-header" className="bg-white border-b border-slate-200/80 px-8 py-4 sticky top-0 z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-1.5 uppercase tracking-wide">
              {activeView === 'horari' && 'Horari'}
              {activeView === 'classes' && 'Catàleg de Grups'}
              {activeView === 'alumnat' && 'Alumnat'}
              {activeView === 'planols' && 'Plànols'}
              {activeView === 'rendiment' && 'Informe de Rendiment i Qualificacions'}
              {activeView === 'configuracio' && 'Configuració'}
              {activeView === 'activitats' && 'Activitats'}
              {activeView === 'qualificacions' && 'Qualificacions'}
              {activeView === 'session_log' && 'Registre de Classe Actiu'}
            </h1>
            <p className="text-xs text-slate-400 font-medium">DocentSuite Workspace</p>
          </div>
        </header>

        <div className="px-8 py-2 border-b bg-white text-sm space-y-2">
          <div className="flex flex-wrap items-center gap-3"><span role="status" aria-live="polite" className={saveStatus==='error'?'text-rose-700 font-bold':saveStatus==='saving'?'text-amber-700':'text-emerald-700'}>{saveStatus==='saving'?'Desant…':saveStatus==='error'?'Error de desat':'Desat'} · {linkedFileName?`Navegador i ${linkedFileName}`:'Navegador'}</span><button className="ds-button" disabled={busy||blocked} onClick={()=>void persist(current.current)}>Tornar a desar</button><button className="ds-button" disabled={blocked} onClick={handleExportBackup}>Descarregar JSON actual</button><button className="ds-button" onClick={openRecovery}>Recuperació</button></div>
          {saveError&&<p role="alert" className="text-rose-700">{saveError}. Conserva aquesta pestanya oberta i descarrega una còpia si el problema persisteix.</p>}
          {availableHandle&&<div>Hi ha un fitxer anterior: {availableHandle.name}. S’ha mantingut la còpia del navegador. <button className="ds-button" disabled={busy} onClick={()=>void connect(availableHandle)}>Carregar i tornar a enllaçar</button><button className="ds-button" disabled={busy||blocked} onClick={()=>void connect(availableHandle,true)}>Enllaçar conservant les dades actuals</button><button className="ds-button" onClick={()=>setAvailableHandle(null)}>Continuar al navegador</button></div>}
          {showRecovery&&<section className="ds-panel space-y-2"><h2 className="font-bold">Còpies recuperables · darreres 3 substitucions</h2><p>Es desen en aquest navegador. Exporta també còpies JSON fora del navegador.</p>{copies.map(c=><div key={c.id} className="flex gap-3 items-center"><span>{new Date(c.date).toLocaleString('ca')} · {c.reason}</span><button className="ds-button" onClick={()=>triggerJsonDownload(JSON.parse(c.raw),`recuperacio_${c.id}.json`)}>Descarregar</button><button className="ds-button" disabled={busy} onClick={()=>{if(confirm('Vols restaurar aquesta còpia? Es conservarà la versió actual.')){void replaceState(normalizeState(JSON.parse(c.raw)),'Abans de restaurar una còpia');setShowRecovery(false);}}}>Restaurar</button></div>)}<button className="ds-button" onClick={()=>fileInputRef.current?.click()}>Importar JSON</button>{blocked&&<button className="ds-button" onClick={()=>{const raw=readStoredRaw();if(raw){const url=URL.createObjectURL(new Blob([raw],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='dades_originals_sense_modificar.json';a.click();URL.revokeObjectURL(url);}}}>Descarregar dades originals</button>}</section>}
        </div>
        {/* Core Router Body */}
        <main id="main-content-scroll" className="flex-1 p-8 overflow-y-auto max-w-7xl w-full mx-auto">
          {busy&&<p role="status">Operació de fitxer en curs…</p>}
          {blocked?<p role="alert">No es poden editar les dades fins a recuperar una còpia vàlida. Obre «Recuperació».</p>:identityConflicts(localState).length?<IdentityReview key={identityConflicts(localState)[0].id} state={localState} onResolve={next=>void replaceState(next,'Abans de resoldre un conflicte d’identitat')}/>:<div inert={busy}>
          {activeView === 'horari' && (
            <HorariView 
              state={localState}
              onSelectSession={handleSelectSessionFromGrid}
              onNavigateToConfig={() => setActiveView('configuracio')}
              onChangeState={triggerStateUpdate}
            />
          )}

          {activeView === 'alumnat' && <StudentsView state={localState} onChange={triggerStateUpdate} selectedId={studentId} onSelect={setStudentId} onSession={handleSelectSessionFromGrid}/>}
          {activeView === 'classes' && (
            <ClassesView 
              onOpenStudent={openStudent}
              state={localState}
              onNavigateToConfig={(id) => { setConfigSubjectId(id || null); setActiveView('configuracio'); }}
              onNavigateToPlans={() => setActiveView('planols')}
            />
          )}

          {activeView === 'planols' && (
            <PlansView 
              state={localState}
              onChangeState={triggerStateUpdate}
            />
          )}

          {activeView === 'rendiment' && (
            <RendimentView 
              state={localState}
            />
          )}

          {activeView === 'activitats' && (
            <ActivitatsView 
              state={localState}
              onChangeState={triggerStateUpdate}
            />
          )}

          {activeView === 'qualificacions' && (
            <QualificacionsView 
              state={localState}
              onChangeState={triggerStateUpdate}
            />
          )}

          {activeView === 'configuracio' && (
            <ConfiguracioView 
              initialSubjectId={configSubjectId}
              state={localState}
              onChangeState={triggerStateUpdate}
              linkedFileName={linkedFileName}
              onSelectFile={handleRegisterFileHandle}
              onDisconnectFile={handleReleaseFileHandle}
              onExportBackup={handleExportBackup}
              onImportBackup={() => fileInputRef.current?.click()}
              onResetState={handleResetCourseState}
            />
          )}

          {activeView === 'session_log' && selectedSessionSlotId && selectedSessionDate && (
            <SessionView 
              state={localState}
              scheduleItemId={selectedSessionSlotId}
              dateStr={selectedSessionDate}
              onBackToTimeline={() => {
                setActiveView('horari');
                setSelectedSessionSlotId(null);
                setSelectedSessionDate(null);
              }}
              onNavigateToSession={(scId, dt) => {
                setSelectedSessionSlotId(scId);
                setSelectedSessionDate(dt);
              }}
              onChangeState={triggerStateUpdate}
              onSaveSessionLog={(updatedLog) => {
                // Find existing log
                const filtered = localState.sessionLogs.filter(l => l.id !== updatedLog.id);
                triggerStateUpdate({
                  ...localState,
                  sessionLogs: [...filtered, updatedLog]
                });
              }}
            />
          )}
          </div>}
        </main>
      </div>
    </div>
  );
}
