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
  validateState
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
import QualificacionsView from './components/QualificacionsView';

export default function App() {
  const [localState, setLocalState] = useState<AppState>(getInitialState());
  const [activeView, setActiveView] = useState<string>('horari');
  
  // Sibling states for showing detailed individual Session Journal Logs
  const [selectedSessionSlotId, setSelectedSessionSlotId] = useState<string | null>(null);
  const [selectedSessionDate, setSelectedSessionDate] = useState<string | null>(null);

  // File System Access states
  const [linkedFileHandle, setLinkedFileHandle] = useState<any>(null);
  const [linkedFileName, setLinkedFileName] = useState<string | null>(null);

  // File Input Ref for traditional fallback uplinks
  const fileInputRef = useRef<HTMLInputElement>(null);

  // On mount: Load LocalStorage copy immediately, and check for permanently linked desktop file handles
  useEffect(() => {
    // 1. Initial LocalStorage fetch
    const offlineState = loadStateFromLocalStorage();
    setLocalState(offlineState);

    // 2. Discover any saved desktop file handle
    async function checkFileHandle() {
      try {
        const storedHandle = await getFileHandle();
        if (storedHandle) {
          const hasPermission = await verifyPermission(storedHandle, true);
          if (hasPermission) {
            setLinkedFileHandle(storedHandle);
            setLinkedFileName(storedHandle.name);
            const syncedState = await loadFromFileHandle(storedHandle);
            if (syncedState) {
              setLocalState(syncedState);
              saveStateToLocalStorage(syncedState);
            }
          }
        }
      } catch (err) {
        console.warn('IdDB file permission check skipped:', err);
      }
    }
    checkFileHandle();
  }, []);

  // Mutator wrapper that triggers LocalStorage save AND Desk File write if active
  const triggerStateUpdate = (next: AppState) => {
    setLocalState(next);
    saveStateToLocalStorage(next);

    // If file is linked, auto-save in background
    if (linkedFileHandle) {
      saveToFileHandle(linkedFileHandle, next).then(success => {
        if (!success) {
          console.warn('El canvi no s\'ha pogut desar directament al fitxer del disc dur enllaçat.');
        }
      });
    }
  };

  // Modern File System Linking handler
  const handleRegisterFileHandle = async () => {
    try {
      if ('showOpenFilePicker' in window) {
        const [handle] = await (window as any).showOpenFilePicker({
          types: [{
            description: 'Fitxer de dades JSON',
            accept: { 'application/json': ['.json'] }
          }],
          multiple: false
        });
        if (handle) {
          const allowed = await verifyPermission(handle, true);
          if (allowed) {
            await setFileHandle(handle);
            setLinkedFileHandle(handle);
            setLinkedFileName(handle.name);
            const loaded = await loadFromFileHandle(handle);
            if (loaded) {
              triggerStateUpdate(loaded);
              alert(`Enllaç correcte amb el fitxer: "${handle.name}". Els canvis es desaran de forma completament persistent i auto-desada.`);
            } else {
              // Write our current state into that file if empty or unvalidated
              await saveToFileHandle(handle, localState);
              alert(`S'ha enllaçat "${handle.name}" i s'han escrit les dades actuals com a punt d'inici.`);
            }
          }
        }
      } else {
        // Fallback to uploading file
        fileInputRef.current?.click();
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        fileInputRef.current?.click();
      }
    }
  };

  // Release desktop file handle and fall back to local browser storage only
  const handleReleaseFileHandle = async () => {
    await removeFileHandle();
    setLinkedFileHandle(null);
    setLinkedFileName(null);
    alert('S\'ha desconnectat de l\'arxiu de disc. A partir d\'ara s\'utilitzarà únicament la memòria local temporitzada del navegador.');
  };

  // Traditional standard JSON file uploader parser fallback
  const handleFallbackImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (validateState(parsed)) {
          triggerStateUpdate(parsed);
          alert('S\'han carregat i importat correctament totes les dades del fitxer JSON seleccionat.');
        } else {
          alert('Error: L\'estructura del fitxer JSON no respon al format vàlid d\'esquemes d\'DocentSuite.');
        }
      } catch (err) {
        alert('Error: No s\'ha pogut descodificar el fitxer. Comproveu que sigui un JSON correcte.');
      }
    };
    reader.readAsText(file);
    // Reset file input value
    e.target.value = '';
  };

  // Trigger download copy of the active database
  const handleExportBackup = () => {
    triggerJsonDownload(localState, 'docentsuite_dades_curs.json');
  };

  // Full Reset trigger back to initial default templates
  const handleResetCourseState = () => {
    const confirmReset = window.confirm(
      '⚠️ ATENCIÓ: Es restabliran totes les dades a la configuració d\'origen. Tots els registres de sessions de classe, llistats de matèries i horaris es perdran de manera definitiva. Voleu continuar?'
    );
    if (confirmReset) {
      const fresh = getInitialState();
      triggerStateUpdate(fresh);
      setActiveView('horari');
      setSelectedSessionSlotId(null);
      setSelectedSessionDate(null);
    }
  };

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
              {activeView === 'planols' && 'Plànols'}
              {activeView === 'rendiment' && 'Informe de Rendiment i Qualificacions'}
              {activeView === 'configuracio' && 'Configuració'}
              {activeView === 'activitats' && 'Activitats'}
              {activeView === 'session_log' && 'Registre de Classe Actiu'}
            </h1>
            <p className="text-xs text-slate-400 font-medium">DocentSuite Workspace</p>
          </div>
        </header>

        {/* Core Router Body */}
        <main id="main-content-scroll" className="flex-1 p-8 overflow-y-auto max-w-7xl w-full mx-auto">
          {activeView === 'horari' && (
            <HorariView 
              state={localState}
              onSelectSession={handleSelectSessionFromGrid}
              onNavigateToConfig={() => setActiveView('configuracio')}
              onChangeState={triggerStateUpdate}
            />
          )}

          {activeView === 'classes' && (
            <ClassesView 
              state={localState}
              onNavigateToConfig={() => setActiveView('configuracio')}
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
        </main>
      </div>
    </div>
  );
}
