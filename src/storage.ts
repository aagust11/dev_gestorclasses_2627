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

export async function setFileHandle(handle: any): Promise<void> {
  try {
    const db = await getIDBStore();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(handle, HANDLE_KEY);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (e) {
    console.error('No s\'ha pogut desar el handle del fitxer a IndexedDB:', e);
  }
}

export async function getFileHandle(): Promise<any> {
  try {
    const db = await getIDBStore();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(HANDLE_KEY);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } catch (e) {
    console.warn('IdDB no disponible:', e);
    return null;
  }
}

export async function removeFileHandle(): Promise<void> {
  try {
    const db = await getIDBStore();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(HANDLE_KEY);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (e) {
    console.error(e);
  }
}

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
      return state;
    }
  } catch (e) {
    console.error('Error llegint el fitxer JSON enllaçat:', e);
  }
  return null;
}

// Save to File System File Handle
export async function saveToFileHandle(fileHandle: any, state: AppState): Promise<boolean> {
  try {
    const writable = await fileHandle.createWritable();
    await writable.write(JSON.stringify(state, null, 2));
    await writable.close();
    return true;
  } catch (e) {
    console.error('Error escrivint al fitxer enllaçat:', e);
    return false;
  }
}

// Validate that an object conforms to AppState
export function validateState(obj: any): boolean {
  if (!obj || typeof obj !== 'object') return false;
  if (!obj.config || !Array.isArray(obj.subjects) || !Array.isArray(obj.schedule)) return false;
  return true;
}

// Load general state (handles local storage and file handle lookup)
export function loadStateFromLocalStorage(): AppState {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw) {
      const state = JSON.parse(raw);
      if (validateState(state)) {
        return mergeMissingDefaultState(state);
      }
    }
  } catch (e) {
    console.error('Error llegint el LocalStorage:', e);
  }
  return getInitialState();
}

// Merge state with potential missing root fields
function mergeMissingDefaultState(loadedState: any): AppState {
  const d = getInitialState();
  return {
    config: {
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
  };
}

// Write to LocalStorage
export function saveStateToLocalStorage(state: AppState): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error('Error desant al LocalStorage:', e);
  }
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
