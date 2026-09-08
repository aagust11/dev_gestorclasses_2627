import {ImportIssue,ImportValidationError,parseImportJson,readImportFile,assertValidImport,inspectImport} from './utils/importValidation';
import {OrphanItem,removeOrphanData} from './utils/orphanData';
import {combineSharedState,EditConflict,withSharedWrite} from './utils/sharedEditing';
import {noticeKey,reviewedNotices,reviewNotice} from './utils/noticePreferences';
import DataManagement from './components/DataManagement';
import {SHARED_STATE_KEY,FILE_LINK_KEY,recoveryRaw,removeRecoveryCopies,normalizeState} from './storage';
import {prepareImportedState,triggerRawJsonDownload} from './storage';
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
  saveToFileHandle,
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
  const acknowledged=useRef(localState);
  const queue=useRef<Promise<void>>(Promise.resolve());
  const pending=useRef(0);
  const failed=useRef(false);
  const [canEdit,setCanEdit]=useState(false);
  const [blocked,setBlocked]=useState(false);
  const [busy,setBusy]=useState(false);
  const [saveStatus,setSaveStatus]=useState<'saved'|'saving'|'error'>('saved');
  const [saveError,setSaveError]=useState('');
  const [editError,setEditError]=useState('');
  const [editIssues,setEditIssues]=useState<ImportIssue[]>([]);
  const [importIssues,setImportIssues]=useState<ImportIssue[]>([]);
  const [importError,setImportError]=useState('');
  const [conflicts,setConflicts]=useState<string[]>([]);
  const [copies,setCopies]=useState<ReturnType<typeof recoveryCopies>>([]);
  const [availableHandle,setAvailableHandle]=useState<any>(null);
  const [reviewed,setReviewed]=useState<string[]>(reviewedNotices);
  const install=(state:AppState)=>{current.current=state;setLocalState(state);};
  const fail=(e:any)=>{failed.current=true;setSaveStatus('error');setSaveError(e.message||String(e));if(e instanceof EditConflict)setConflicts(e.paths);};
  const importFailed=(e:any)=>{setImportError(e.message||String(e));setImportIssues(e instanceof ImportValidationError?e.report.issues:[]);setActiveView('dades');};
  const approveImport=(value:unknown)=>{
    const prepared=prepareImportedState(value);setImportIssues(prepared.report.issues);setImportError('');
    if(prepared.report.issues.length&&!confirm(['El fitxer té avisos.',...prepared.report.issues.slice(0,8).map(i=>i.path+': '+i.message),'Vols continuar conservant aquestes dades?'].join(String.fromCharCode(10))))return null;
    return syncStudentRegistry(prepared.state);
  };
  const latest=()=>syncStudentRegistry(loadStateFromLocalStorage());
  const refreshFile=async()=>{
    const handle=await getFileHandle();
    if(localStorage.getItem(FILE_LINK_KEY)==='yes'&&handle){setLinkedFileHandle(handle);setLinkedFileName(handle.name);setAvailableHandle(null);}
    else {setLinkedFileHandle(null);setLinkedFileName(null);setAvailableHandle(handle||null);}
  };
  const writeLinked=async(state:AppState)=>{
    if(localStorage.getItem(FILE_LINK_KEY)!=='yes')return;
    const handle=await getFileHandle();
    if(!handle)throw Error('No es troba el fitxer enllaçat. Torna’l a seleccionar o oblida l’enllaç.');
    if(await handle.queryPermission({mode:'readwrite'})!=='granted')throw Error('Cal renovar el permís del fitxer. Prem «Renovar permís» o continua només al navegador.');
    await saveToFileHandle(handle,state);
  };
  const roster=(s:AppState)=>JSON.stringify(s.subjects.map(x=>[x.id,x.students.map(st=>st.id)]));
  const saveChange=(base:AppState,next:AppState,preferLocal=false)=>{
    let localCommitted=false;
    pending.current++;setSaveStatus('saving');
    queue.current=queue.current.then(async()=>{
      if(failed.current)return;
      await withSharedWrite(navigator.locks,async()=>{
        const remote=latest();
        const merged=syncStudentRegistry(combineSharedState(base,next,remote,false,preferLocal));
        assertValidImport(merged);
        if(!remote.identityVersion||roster(remote)!==roster(merged))createRecoveryCopy(remote,'Abans de modificar matrícules o identitats');
        saveStateToLocalStorage(merged);
        localCommitted=true;
        acknowledged.current=next;
        // Every tab writes the same shared target while holding the transaction lock.
        await writeLinked(merged);
      });
    }).catch(e=>{if(!localCommitted)acknowledged.current=base;fail(e);}).finally(()=>{
      pending.current--;
      if(!pending.current&&!failed.current){try{const state=latest();install(state);acknowledged.current=state;setSaveError('');setConflicts([]);setSaveStatus('saved');}catch(e){fail(e);}}
    });
    return queue.current;
  };
  useEffect(()=>{
    let mounted=true;
    try{const loaded=loadStateFromLocalStorage(report=>setImportIssues(report.issues));const state=syncStudentRegistry(loaded);install(state);acknowledged.current=state;setCanEdit(!!navigator.locks);}
    catch(e){setBlocked(true);importFailed(e);setCanEdit(!!navigator.locks);}
    void refreshFile().catch(e=>setSaveError(e.message));
    const changed=(event:StorageEvent)=>{
      if(!mounted||event.storageArea!==localStorage)return;
      if(event.key===FILE_LINK_KEY)void refreshFile().catch(e=>setSaveError(e.message));
      if((event.key===SHARED_STATE_KEY||event.key===null)&&!pending.current&&!failed.current){try{const state=latest();install(state);acknowledged.current=state;setBlocked(false);}catch(e){importFailed(e);setBlocked(true);}}
    };
    window.addEventListener('storage',changed);
    return()=>{mounted=false;window.removeEventListener('storage',changed);};
  },[]);
  useEffect(()=>{
    const guard=(e:BeforeUnloadEvent)=>{if(saveStatus!=='saved'){e.preventDefault();e.returnValue='';}};
    window.addEventListener('beforeunload',guard);return()=>window.removeEventListener('beforeunload',guard);
  },[saveStatus]);
  const triggerStateUpdate=(next:AppState,draftBase?:AppState)=>{
    if(blocked||busy||!canEdit||failed.current)return false;
    try{assertValidImport(next);}catch(e){setEditError('Canvi no desat: corregeix els camps indicats.');setEditIssues(e instanceof ImportValidationError?e.report.issues:[]);return false;}
    setEditError('');setEditIssues([]);
    const base=draftBase||current.current,normalized=syncStudentRegistry(next);
    install(normalized);void saveChange(base,normalized);return true;
  };
  const retry=async(preferLocal=false)=>{
    if(!canEdit||busy)return;
    await queue.current;
    if(preferLocal&&!confirm('Vols aplicar els canvis d’aquesta pestanya als camps en conflicte? Es conservarà una còpia de la versió compartida.'))return;
    failed.current=false;setSaveError('');setConflicts([]);
    if(preferLocal){try{await withSharedWrite(navigator.locks,async()=>{createRecoveryCopy(latest(),'Abans de resoldre un conflicte');});}catch(e){fail(e);return;}}
    await saveChange(acknowledged.current,current.current,preferLocal);
  };
  const discard=async()=>{
    if(!confirm('Vols descartar els canvis pendents d’aquesta pestanya i carregar la versió compartida? Pots descarregar-los abans en JSON.'))return;
    await queue.current;
    try{const state=latest();install(state);acknowledged.current=state;failed.current=false;setBlocked(false);setSaveError('');setConflicts([]);setSaveStatus('saved');}catch(e){importFailed(e);}
  };
  const replaceState=async(value:unknown,reason:string)=>{
    if(!canEdit||failed.current){setActiveView('dades');return;}
    const base=current.current;
    const rawBase=readStoredRaw();
    setBusy(true);
    try{
      const next=approveImport(value);if(!next)return;
      await queue.current;if(failed.current)return;
      await withSharedWrite(navigator.locks,async()=>{
        const remote=blocked?base:latest();
        if(blocked&&readStoredRaw()!==rawBase)throw new EditConflict(['La còpia compartida ha canviat mentre es preparava la recuperació.']);
        if(!blocked)combineSharedState(base,next,remote,true);
        if(blocked){const raw=readStoredRaw();if(raw)localStorage.setItem('gestor_classes_unreadable_recovery',raw);}
        else createRecoveryCopy(remote,reason);
        const replacement={...next,workspaceGeneration:crypto.randomUUID()};
        assertValidImport(replacement);
        saveStateToLocalStorage(replacement);install(replacement);acknowledged.current=replacement;setBlocked(false);setStudentId(null);
        await writeLinked(replacement);
      });
      setSaveError('');setSaveStatus('saved');
    }catch(e){fail(e);}finally{setBusy(false);}
  };
  const connect=async(handle:any,keepCurrent=false)=>{
    if(!canEdit||failed.current)return;
    const base=current.current,rawBase=readStoredRaw();setBusy(true);
    try{
      if(!await verifyPermission(handle,true))throw Error('No hi ha permís per escriure al fitxer.');
      const loaded=approveImport(await readImportFile(await handle.getFile()));if(!loaded)return;
      if(!confirm(keepCurrent?'Enllaçar el fitxer conservant les dades compartides? Es copiarà el contingut anterior del fitxer.':'Carregar el fitxer a totes les pestanyes? Es conservarà la versió compartida actual.'))return;
      await queue.current;if(failed.current)return;
      await withSharedWrite(navigator.locks,async()=>{
        const remote=blocked?base:latest();
        if(blocked&&readStoredRaw()!==rawBase)throw new EditConflict(['La còpia compartida ha canviat mentre es preparava l’enllaç.']);
        if(!blocked&&!keepCurrent)combineSharedState(base,loaded,remote,true);
        createRecoveryCopy(loaded,'Fitxer abans d’enllaçar');
        if(!blocked)createRecoveryCopy(remote,'Dades abans d’enllaçar');
        const state=keepCurrent?remote:{...loaded,workspaceGeneration:crypto.randomUUID()};
        assertValidImport(state);
        await setFileHandle(handle);localStorage.setItem(FILE_LINK_KEY,'yes');
        saveStateToLocalStorage(state);install(state);acknowledged.current=state;setBlocked(false);await writeLinked(state);
      });
      await refreshFile();setSaveError('');setSaveStatus('saved');
    }catch(e){if(e instanceof ImportValidationError)importFailed(e);else fail(e);}finally{setBusy(false);}
  };
  const handleRegisterFileHandle=async()=>{
    if(!canEdit)return;
    if(!('showOpenFilePicker' in window)){fileInputRef.current?.click();return;}
    try{const [handle]=await (window as any).showOpenFilePicker({types:[{description:'Fitxer de dades JSON',accept:{'application/json':['.json']}}],multiple:false});if(handle)await connect(handle);}catch(e){if(e.name!=='AbortError')fail(e);}
  };
  const handleReleaseFileHandle=async()=>{
    if(!canEdit)return;
    setBusy(true);
    try{await queue.current;await withSharedWrite(navigator.locks,async()=>{await removeFileHandle();localStorage.setItem(FILE_LINK_KEY,'no');});await refreshFile();setSaveError('');}
    catch(e){fail(e);}finally{setBusy(false);}
    // File failure can be retried against browser storage without discarding pending edits.
  };
  const renewPermission=async()=>{try{const handle=await getFileHandle();if(!handle)throw Error('Selecciona de nou el fitxer.');if(!await verifyPermission(handle,true))throw Error('Permís no concedit.');await retry();}catch(e){fail(e);}};
  const handleFallbackImportJson=async(e:React.ChangeEvent<HTMLInputElement>)=>{
    const file=e.target.files?.[0];e.target.value='';if(!file)return;
    try{await replaceState(await readImportFile(file),'Abans d’importar JSON');}catch(e){importFailed(e);}
  };
  const handleExportBackup=()=>triggerJsonDownload(current.current,'docentsuite_dades_curs.json');
  const handleResetCourseState=()=>{if(confirm('Restablir el curs a totes les pestanyes? Es conservarà una còpia recuperable.'))void replaceState(getInitialState(),'Abans de restablir el curs');};
  const openRecovery=()=>{try{setCopies(recoveryCopies());}catch(e){setSaveError(e.message);}};
  const removeOrphan=async(item:OrphanItem)=>{
    if(!canEdit||blocked||busy||failed.current)throw Error('Resol primer el desat pendent.');
    setBusy(true);
    let committed=false;
    try{
      await queue.current;
      if(failed.current)throw Error('Resol primer el desat pendent.');
      await withSharedWrite(navigator.locks,async()=>{
        const remote=latest();
        const next=removeOrphanData(remote,item);
        assertValidImport(next);
        createRecoveryCopy(remote,'Abans d’eliminar una dada desvinculada: '+item.title);
        saveStateToLocalStorage(next);committed=true;
        install(next);acknowledged.current=next;
        setImportIssues(inspectImport(next).issues);setImportError('');setCopies(recoveryCopies());
        setSaveStatus('saving');
        await writeLinked(next);
      });
      setSaveStatus('saved');setSaveError('');
    }catch(e){
      if(committed){fail(e);throw Error('Eliminat al navegador i amb còpia recuperable, però falta desar al fitxer. Resol el desat pendent abans de continuar.');}
      throw e;
    }finally{setBusy(false);}
  };
  const clearCopies=async()=>{
    if(!confirm('Eliminar només les còpies recuperables d’aquest navegador? Les dades actuals es conservaran. Es descarregarà abans un arxiu amb les còpies.'))return;
    try{await withSharedWrite(navigator.locks,async()=>{triggerRawJsonDownload(recoveryRaw(),'copies_recuperables_arxiu.json');removeRecoveryCopies();});setCopies([]);setSaveError('');}catch(e){fail(e);}
  };
  const liveIssues=React.useMemo(()=>blocked?[]:inspectImport(localState).issues,[localState,blocked]);
  const notices=[
    ...(saveError?[{kind:'save',message:saveError}]:[]),
    ...(editError?[{kind:'edit',message:editError+' '+editIssues.map(i=>i.path+': '+i.message).join(' · ')}]:[]),
    ...(importError?[{kind:'import',message:importError+' '+importIssues.map(i=>i.path+': '+i.message).join(' · ')}]:[]),
    ...(!importError&&liveIssues.length?[{kind:'import',message:`Hi ha ${liveIssues.length} avisos de dades. Consulta «Revisar dades desvinculades» per veure el contingut i decidir què conserves.\n`+[...new Set(liveIssues.map(i=>i.message))].join('\n')}]:[]),
    ...(availableHandle?[{kind:'file',message:'Fitxer anterior: '+availableHandle.name}]:[])
  ].map(n=>({...n,key:noticeKey(n.kind,n.message)}));
  const review=(key:string)=>{try{setReviewed(reviewNotice(reviewed,key));}catch(e){setSaveError('No s’ha pogut recordar que l’avís està revisat: '+e.message);}};
  const badge=notices.filter(n=>!reviewed.includes(n.key)).length;

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
        dataBadge={badge?String(badge):undefined}
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
              {activeView === 'dades' && 'Dades i desat'}
            </h1>
            <p className="text-xs text-slate-400 font-medium">DocentSuite Workspace</p>
          </div>
        </header>

        {/* Core Router Body */}
        <main id="main-content-scroll" className="flex-1 p-8 overflow-y-auto max-w-7xl w-full mx-auto">
          {activeView==='dades'?<DataManagement state={localState} onRemoveOrphan={removeOrphan} status={saveStatus} linkedFileName={linkedFileName} availableName={availableHandle?.name} busy={busy} canEdit={canEdit} notices={notices} reviewed={reviewed} onReview={review} conflicts={conflicts} onRetry={()=>void retry()} onKeepLocal={()=>void retry(true)} onDiscard={()=>void discard()} onDownload={handleExportBackup} onForget={()=>void handleReleaseFileHandle()} onConnect={()=>void connect(availableHandle)} onKeepCurrent={()=>void connect(availableHandle,true)} onChooseFile={handleRegisterFileHandle} onRenew={()=>void renewPermission()} onOpenRecovery={openRecovery} copies={copies} onClearCopies={()=>void clearCopies()} onRestore={raw=>{try{void replaceState(parseImportJson(raw),'Abans de restaurar una còpia');}catch(e){importFailed(e);}}} onImport={()=>fileInputRef.current?.click()} onDownloadOriginal={()=>{const raw=readStoredRaw();if(raw)triggerRawJsonDownload(raw,'dades_originals.json');}}/>:<>
          {!canEdit&&<p>Mode consulta: el navegador no permet coordinar el desat entre pestanyes.</p>}
          {busy&&<p role="status">Operació de fitxer en curs…</p>}
          {blocked?<p role="alert">No es poden editar les dades fins a recuperar una còpia vàlida. Obre «Recuperació».</p>:identityConflicts(localState).length?<IdentityReview key={identityConflicts(localState)[0].id} state={localState} onResolve={next=>void replaceState(next,'Abans de resoldre un conflicte d’identitat')}/>:<div inert={busy||!canEdit||saveStatus==='error'}>
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
          </>}
        </main>
      </div>
    </div>
  );
}
