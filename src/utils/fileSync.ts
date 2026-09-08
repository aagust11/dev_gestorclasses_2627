import {AppState} from '../types';
import {normalizeState,saveToFileHandle} from '../storage';
import {assertValidImport,readImportFile} from './importValidation';
import {syncStudentRegistry} from './studentIdentity';
import {combineSharedState,EditConflict,equal} from './sharedEditing';

export const FILE_POLL_MS=15000;
const prepare=(state:AppState)=>syncStudentRegistry(normalizeState(state));
export function mergeFileStates(base:AppState|null,local:AppState,remote:AppState,preferLocal=false):AppState{
  local=prepare(local);remote=prepare(remote);base=base&&prepare(base);
  if(equal(local,remote))return remote;
  if(!base)throw Error('Aquest enllaç encara no té una versió de referència segura. A «Dades i desat», carrega el fitxer o torna’l a seleccionar i decideix quina versió vols conservar. No s’ha sobreescrit el fitxer.');
  if(equal(local,base))return remote;
  if(equal(remote,base))return local;
  if((local as any).workspaceGeneration!==(base as any).workspaceGeneration||(remote as any).workspaceGeneration!==(base as any).workspaceGeneration)
    throw new EditConflict(['S’ha importat, restaurat o eliminat informació en una altra versió. Carrega el fitxer o conserva explícitament les dades del navegador després de descarregar les dues versions.']);
  const merged=syncStudentRegistry(combineSharedState(base,local,remote,false,preferLocal));
  assertValidImport(merged);return merged;
}
export async function readFileSnapshot(handle:any){
  const file=await handle.getFile();
  // Read and validate the exact bytes used for the optimistic concurrency check.
  let raw='';
  const state=prepare(await readImportFile({size:file.size,text:async()=>{raw=await file.text();return raw;}}) as AppState);
  return {raw,state};
}
type SyncOptions={preferLocal?:boolean;backup:(state:AppState,reason:string)=>void|Promise<void>;commit:(state:AppState)=>void|Promise<void>};
/** Must run under the same Web Lock as browser writes. OneDrive has no cross-device lock. */
export async function synchronizeFile(handle:any,local:AppState,base:AppState|null,options:SyncOptions):Promise<AppState>{
  const snapshot=await readFileSnapshot(handle);
  const merged=mergeFileStates(base,local,snapshot.state,options.preferLocal);
  assertValidImport(merged);
  const external=base&&!equal(prepare(base),snapshot.state);
  if(external&&!equal(local,snapshot.state)){
    await options.backup(local,'Navegador abans de combinar canvis del fitxer');
    await options.backup(snapshot.state,'Fitxer abans de combinar canvis entre dispositius');
  }
  if(!equal(merged,snapshot.state)){
    await saveToFileHandle(handle,merged,async()=>{
      if(await (await handle.getFile()).text()!==snapshot.raw)throw Error('El fitxer ha canviat durant el desat. S’ha aturat l’escriptura; torna a comprovar el fitxer.');
    });
    const verified=await readFileSnapshot(handle);
    if(!equal(verified.state,prepare(merged)))throw Error('El fitxer ha canviat just després del desat. Els canvis locals es conserven; torna a comprovar-lo.');
  }
  // Commit browser data BEFORE advancing the baseline, so an interruption is retryable.
  await options.commit(merged);
  return merged;
}
