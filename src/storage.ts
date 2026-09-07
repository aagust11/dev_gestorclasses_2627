/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AppState } from './types';
import { getInitialState } from './initialState';

const LOCAL_STORAGE_KEY = 'gestor_classes_app_state';
const DB_NAME = 'GestorClassesDB';
const STORE_NAME = 'handles';
const HANDLE_KEY = 'active_file_handle';

// Simple IndexedDB wrapper for serializing FileSystemFileHandle
function getIDBStore(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function handleTransaction(mode:IDBTransactionMode,operation:(store:IDBObjectStore)=>IDBRequest):Promise<any>{
  const db=await getIDBStore();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(STORE_NAME,mode);let result:any;
    const request=operation(tx.objectStore(STORE_NAME));
    request.onsuccess=()=>{result=request.result;};
    tx.oncomplete=()=>{db.close();resolve(result);};
    tx.onerror=tx.onabort=()=>{db.close();reject(tx.error||Error('No s’ha pogut confirmar el desat de l’enllaç.'));};
  });
}
export async function setFileHandle(handle:any):Promise<void>{await handleTransaction('readwrite',s=>s.put(handle,HANDLE_KEY));}
export async function getFileHandle():Promise<any>{return handleTransaction('readonly',s=>s.get(HANDLE_KEY));}
export async function removeFileHandle():Promise<void>{await handleTransaction('readwrite',s=>s.delete(HANDLE_KEY));}

// Check permission for FileSystemFileHandle
export async function verifyPermission(fileHandle: any, readWrite = true): Promise<boolean> {
  const options: Record<string, string> = {};
  if (readWrite) {
    options.mode = 'readwrite';
  }
  if ((await fileHandle.queryPermission(options)) === 'granted') {
    return true;
  }
  if ((await fileHandle.requestPermission(options)) === 'granted') {
    return true;
  }
  return false;
}

// Load from File System File Handle
export async function loadFromFileHandle(fileHandle: any): Promise<AppState | null> {
  try {
    const file = await fileHandle.getFile();
    const contents = await file.text();
    const state = JSON.parse(contents);
    if (validateState(state)) {
      return normalizeState(state);
    }
  } catch (e) {
    console.error('Error llegint el fitxer JSON enllaçat:', e);
  }
  return null;
}

// Serialize snapshots at enqueue time. A rejected write must not poison the queue.
let writeTail:Promise<unknown>=Promise.resolve();
export function waitForFileWrites(){return writeTail;}
export function saveToFileHandle(fileHandle:any,state:AppState):Promise<boolean> {
  const contents=JSON.stringify(state,null,2);
  const result=writeTail.then(async()=>{
    let writable:any;
    try {writable=await fileHandle.createWritable();await writable.write(contents);await writable.close();return true;}
    catch(error){try{await writable?.abort();}catch{} throw error;}
  });
  writeTail=result.catch(()=>{});return result;
}
const RECOVERY_KEY=LOCAL_STORAGE_KEY+'_recovery';
export type RecoveryCopy={id:string;date:string;reason:string;raw:string};
export function recoveryCopies():RecoveryCopy[]{return JSON.parse(localStorage.getItem(RECOVERY_KEY)||'[]');}
export function createRecoveryCopy(state:AppState,reason:string){
  const copy={id:crypto.randomUUID(),date:new Date().toISOString(),reason,raw:JSON.stringify(state)};
  localStorage.setItem(RECOVERY_KEY,JSON.stringify([copy,...recoveryCopies()].slice(0,3)));
  return copy;
}
export function readStoredRaw(){return localStorage.getItem(LOCAL_STORAGE_KEY);}

// Validate that an object conforms to AppState
export function validateState(obj: any): boolean {
  if (!obj || typeof obj !== 'object') return false;
  if (!obj.config || !Array.isArray(obj.subjects) || !Array.isArray(obj.schedule)) return false;
  if(!obj.subjects.every((s:any)=>s&&typeof s.id==='string'&&Array.isArray(s.students)&&s.students.every((st:any)=>st&&typeof st.id==='string'&&typeof st.name==='string')))return false;
  for(const key of ['sessionLogs','activities','criteria','competencies','plans','termGradesRecords'])if(obj[key]!==undefined&&!Array.isArray(obj[key]))return false;
  return true;
}

// Load general state (handles local storage and file handle lookup)
export function loadStateFromLocalStorage():AppState {
  const raw=localStorage.getItem(LOCAL_STORAGE_KEY);
  if(!raw)return getInitialState();
  const state=JSON.parse(raw);
  if(!validateState(state))throw Error('Les dades del navegador no tenen un format vàlid. Recupera una còpia o importa un fitxer.');
  return normalizeState(state);
}

// Merge state with potential missing root fields
export function normalizeState(loadedState: any): AppState {
  const d = getInitialState();
  return {
    ...loadedState,
    config: {
      ...d.config,
      ...loadedState.config,
      startDate: loadedState.config?.startDate || d.config.startDate,
      endDate: loadedState.config?.endDate || d.config.endDate,
      holidays: loadedState.config?.holidays || d.config.holidays,
      terms: loadedState.config?.terms || d.config.terms,
      timeSlots: loadedState.config?.timeSlots || d.config.timeSlots,
      substitutions: loadedState.config?.substitutions || d.config.substitutions || [],
    },
    subjects: loadedState.subjects || d.subjects,
    schedule: loadedState.schedule || d.schedule,
    competencies: loadedState.competencies || d.competencies,
    criteria: loadedState.criteria || d.criteria,
    sessionLogs: loadedState.sessionLogs || d.sessionLogs,
    plans: loadedState.plans || d.plans,
    activities: loadedState.activities || d.activities || [],
    termGradesRecords: loadedState.termGradesRecords || [],
  };
}

// Write to LocalStorage
export function saveStateToLocalStorage(state:AppState):void {
  localStorage.setItem(LOCAL_STORAGE_KEY,JSON.stringify(state));
}

// Download JSON helper
export function triggerJsonDownload(state: AppState, filename = 'classes_backup.json'): void {
  const stringified = JSON.stringify(state, null, 2);
  const blob = new Blob([stringified], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
