export const EXTENSION_PROTOCOL=1;
export const REQUEST_CHANNEL='aula-extension-request';
export const RESPONSE_CHANNEL='aula-extension-response';
export const EVENT_CHANNEL='aula-extension-event';
export const actions=['GET_CONTEXT','GET_SESSION','SET_ATTENDANCE','MARK_ALL_PRESENT','MARK_PENDING_PRESENT','ADD_ANNOTATION','OPEN_SESSION'] as const;
export type ExtensionRequest={version:number;requestId:string;action:typeof actions[number];payload?:Record<string,unknown>};
export type ExtensionResponse={version:number;requestId:string;ok:boolean;data?:unknown;error?:string;warning?:string;safeToClose?:boolean};
