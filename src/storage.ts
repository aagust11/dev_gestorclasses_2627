import {assertValidImport,inspectImport,parseImportJson,readImportFile,ImportReport} from './utils/importValidation';
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
export async function loadFromFileHandle(fileHandle:any):Promise<AppState> {
  const file=await fileHandle.getFile();
  return normalizeState(await readImportFile(file));
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
export function recoveryCopies():RecoveryCopy[]{
  const copies=JSON.parse(localStorage.getItem(RECOVERY_KEY)||'[]');
  if(!Array.isArray(copies)||copies.some(c=>!c||typeof c.id!=='string'||typeof c.date!=='string'||typeof c.reason!=='string'||typeof c.raw!=='string'))throw Error('El registre de còpies recuperables està malmès; no s’ha modificat. Descarrega les dades actuals abans de continuar.');
  return copies;
}
export function createRecoveryCopy(state:AppState,reason:string){
  const copy={id:crypto.randomUUID(),date:new Date().toISOString(),reason,raw:JSON.stringify(state)};
  localStorage.setItem(RECOVERY_KEY,JSON.stringify([copy,...recoveryCopies()].slice(0,3)));
  return copy;
}
export function readStoredRaw(){return localStorage.getItem(LOCAL_STORAGE_KEY);}

// Validate that an object conforms to AppState
export function validateState(obj:unknown):boolean {return inspectImport(obj).valid;}

// Load general state (handles local storage and file handle lookup)
export function loadStateFromLocalStorage(onReport?:(report:ImportReport)=>void):AppState {
  const raw=localStorage.getItem(LOCAL_STORAGE_KEY);
  if(!raw)return getInitialState();
  const prepared=prepareImportedState(parseImportJson(raw));
  onReport?.(prepared.report);
  return prepared.state;
}

// Merge state with potential missing root fields
export function normalizeState(loadedState:unknown):AppState {return prepareImportedState(loadedState).state;}
export function prepareImportedState(loadedState:any):{state:AppState;report:ImportReport}{
  const report=assertValidImport(loadedState);
  return {state:completeLegacyState(loadedState),report};
}
function completeLegacyState(loadedState: any): AppState {
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
    subjects: loadedState.subjects.map((s:any)=>({color:'#3b82f6',isGeneral:false,parentId:null,...s})),
    schedule: loadedState.schedule || d.schedule,
    competencies: (loadedState.competencies || []).map((c:any)=>({description:'',...c})),
    criteria: (loadedState.criteria || []).map((c:any)=>({description:'',...c})),
    sessionLogs: (loadedState.sessionLogs || []).map((l:any)=>({comments:'',...l,attendance:Object.fromEntries(Object.entries(l.attendance||{}).map(([id,log]:any)=>[id,{status:'pending',...log}]))})),
    plans: (loadedState.plans || []).map((p:any)=>({name:p.id,seats:{},teacherDesk:null,...p})),
    activities: (loadedState.activities || []).map((a:any)=>({code:a.id,description:'',startDate:'',endDate:'',termId:'',status:'auto',weight:1,resources:[],criteriaIds:[],...a})),
    termGradesRecords: (loadedState.termGradesRecords || []).map((r:any)=>({...r,students:Object.fromEntries(Object.entries(r.students||{}).map(([id,g]:any)=>[id,{criteria:{},competencies:{},...g}]))})),
  };
}

// Write to LocalStorage
export function saveStateToLocalStorage(state:AppState):void {
  localStorage.setItem(LOCAL_STORAGE_KEY,JSON.stringify(state));
}

// Download JSON helper
export function triggerJsonDownload(state: AppState, filename = 'classes_backup.json'): void {
  triggerRawJsonDownload(JSON.stringify(state,null,2),filename);
}
export function triggerRawJsonDownload(raw:string,filename:string):void {
  const blob = new Blob([raw], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
