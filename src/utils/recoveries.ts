import {AppState,CurricularActivity,Subject,StudentCriterionGrade,ActivityRecovery,RecoveryAttempt,RecoverySettings,RecoveryTask,PeriodSnapshot} from '../types';
import {getActivityScore,getCompSettings,scoreToCompetencial,filterActivitiesForPeriod} from './gradeCalculations';
import {periodGrades} from './gradeSelectors';
import {DEFAULT_TEST,testResult} from './testScoring';
import {activeAttempts,closedPeriod,latestPeriodEvent,policyNames,recoveryQual,recoveryScore,recoverySettings,recoverySlots} from './recoveryModel';
const clone=<T,>(x:T):T=>JSON.parse(JSON.stringify(x));
export function eligibleRecovery(a:CurricularActivity,id:string,subject:Subject){
 if(a.assessmentType==='completion'||a.grades?.[id]?.status==='exempt')return false;
 if(a.recoveries?.[id])return true;
 const score=getActivityScore(a,id,subject);
 return a.grades?.[id]?.status==='not_submitted'||(score!==null&&scoreToCompetencial(score,getCompSettings(subject).thresholds)==='NA');
}
export function initialRecovery(a:CurricularActivity,id:string,subject:Subject):ActivityRecovery{
 const score=getActivityScore(a,id,subject);
 return clone({original:a.grades?.[id]||{},originalQual:a.grades?.[id]?.status==='not_submitted'?'NP':score===null?'Pendent':scoreToCompetencial(score,getCompSettings(subject).thresholds),originalDate:a.grades?.[id]?.evaluatedAt?.slice(0,10)||'',originalCapturedAt:new Date().toISOString(),attempts:[],annulments:[],pending:false});
}
export type RecoveryInput={date:string;originalDate?:string;observations:string;exceptionReason:string;waive:boolean;sourceTaskId?:string;evidence:Record<string,StudentCriterionGrade>};
export function prepareRecovery(state:AppState,a:CurricularActivity,id:string,input:RecoveryInput):RecoveryAttempt{
 const subject=state.subjects.find(s=>s.id===a.subjectId);if(!subject||!subject.students.some(s=>s.id===id))throw Error('Alumne o assignatura no disponibles.');
 const settings=recoverySettings(subject,a),record=a.recoveries?.[id]||initialRecovery(a,id,subject);
 if(!settings.enabled||!eligibleRecovery(a,id,subject))throw Error('Només es pot recuperar una activitat NP o NA, no una activitat exempta ni Fet / No fet.');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(input.date)||new Date(input.date).toISOString().slice(0,10)!==input.date)throw Error('Indica una data de recuperació vàlida.');
 if(input.originalDate&&input.originalDate>input.date)throw Error('La recuperació no pot precedir l’avaluació original.');
 if(input.waive&&(!settings.allowExceptions||!input.exceptionReason.trim()))throw Error('L’excepció requereix permís a la configuració i una justificació.');
 const wasClosed=(state.periodSnapshots||[]).some(p=>p.action==='close'&&p.subjectId===a.subjectId&&p.at.slice(0,10)<=input.date&&p.activities.some(x=>x.id===a.id));
 const policy=input.waive||(!settings.applyToNA&&record.originalQual!=='NP')||(settings.afterClosureOnly&&!wasClosed)?'none':settings.policy;
 const comp=getCompSettings(subject),slots=recoverySlots(a),keys=Object.keys(input.evidence);
 if(!keys.length||keys.some(key=>!slots.some(s=>s.key===key)))throw Error('Selecciona els criteris o aspectes concrets que recuperes.');
 if(input.sourceTaskId){const task=state.recoveryTasks?.find(t=>t.id===input.sourceTaskId&&!t.archived);const target=task?.targets.find(t=>t.activityId===a.id);if(!task||task.subjectId!==a.subjectId||!task.studentIds.includes(id)||!target||keys.some(k=>!target.slotKeys.includes(k)))throw Error('La correspondència amb la prova vinculada no és vàlida.');}
 const results=keys.map(key=>{
  const slot=slots.find(s=>s.key===key)!,evidence=input.evidence[key];let demonstrated:number;
  if(slot.format==='test'){const result=testResult(evidence.testAnswers,slot.test||DEFAULT_TEST);if(!result)throw Error('Completa totes les respostes del test.');demonstrated=result.normalized;}
  else if(slot.format==='competencial'){if(!evidence.competencialScore)throw Error('Falta una qualificació competencial.');demonstrated=comp.values[evidence.competencialScore];}
  else {if(!Number.isFinite(evidence.rawScore)||evidence.rawScore!<0||evidence.rawScore!>slot.max)throw Error(`Nota fora de l’escala 0–${slot.max}.`);demonstrated=evidence.rawScore!/slot.max*4;}
  const computable=recoveryScore(demonstrated,policy,comp.thresholds);
  return {slot:clone(slot),evidence:clone(evidence),demonstrated,computable,demonstratedQual:recoveryQual(demonstrated,comp.thresholds),computableQual:recoveryQual(computable,comp.thresholds)};
 });
 return clone({id:crypto.randomUUID(),recordedAt:new Date(Math.max(Date.now(),...record.attempts.map(a=>Date.parse(a.recordedAt)+1))).toISOString(),date:input.date,policy,settings,thresholds:comp.thresholds,values:comp.values,observations:input.observations.trim(),exceptionReason:input.waive?input.exceptionReason.trim():'',sourceTaskId:input.sourceTaskId,applied:settings.updateOpenPeriods,results});
}
export function registerRecovery(state:AppState,activityId:string,id:string,input:RecoveryInput):AppState{
 const a=state.activities?.find(a=>a.id===activityId);if(!a)throw Error('Activitat inexistent.');
 const subject=state.subjects.find(s=>s.id===a.subjectId)!,attempt=prepareRecovery(state,a,id,input),record=a.recoveries?.[id]||initialRecovery(a,id,subject);
 const next={...record,originalDate:record.originalDate||input.originalDate||'',pending:false,attempts:[...record.attempts,attempt]};
 return {...state,activities:state.activities!.map(x=>x.id===a.id?{...x,recoveries:{...x.recoveries,[id]:next}}:x)};
}
export function setRecoveryPending(state:AppState,a:CurricularActivity,id:string,pending:boolean):AppState{
 const subject=state.subjects.find(s=>s.id===a.subjectId)!;if(!eligibleRecovery(a,id,subject))throw Error('Aquesta activitat no és recuperable.');
 const record=a.recoveries?.[id]||initialRecovery(a,id,subject);
 const records={...a.recoveries,[id]:{...record,pending}};
 if(!pending&&!record.attempts.length)delete records[id];
 return {...state,activities:state.activities!.map(x=>x.id===a.id?{...x,recoveries:records}:x)};
}
export function annulRecovery(state:AppState,activityId:string,id:string,attemptId:string,reason:string):AppState{
 if(!reason.trim())throw Error('Cal indicar el motiu de l’anul·lació.');
 const a=state.activities?.find(x=>x.id===activityId),r=a?.recoveries?.[id];if(!r?.attempts.some(x=>x.id===attemptId))throw Error('Intent inexistent.');
 if(r.annulments.some(x=>x.attemptId===attemptId))throw Error('Aquest intent ja està anul·lat.');
 return {...state,activities:state.activities!.map(x=>x.id===activityId?{...x,recoveries:{...x.recoveries,[id]:{...r,annulments:[...r.annulments,{id:crypto.randomUUID(),attemptId,at:new Date().toISOString(),reason:reason.trim()}]}}}:x)};
}
export function closeEvaluation(state:AppState,subject:Subject,periodId:string,reason:string):AppState{
 if(closedPeriod(state,subject.id,periodId))throw Error('El període ja està tancat.');
 const methods=['mean','median','mode'] as const;
 const snapshot=clone({id:crypto.randomUUID(),subjectId:subject.id,periodId,action:'close',at:new Date(Math.max(Date.now(),Date.parse(latestPeriodEvent(state,subject.id,periodId)?.at||'1970-01-01')+1)).toISOString(),reason:reason.trim(),subject,activities:filterActivitiesForPeriod(state.activities||[],subject.id,periodId,state.config.terms),competencies:state.competencies.filter(c=>c.subjectId===subject.id||c.subjectId===subject.parentId),criteria:state.criteria,comments:state.periodComments?.[subject.id]?.[periodId]||{},groupComment:state.groupPeriodComments?.[subject.id]?.[periodId]||'',grades:Object.fromEntries(methods.map(m=>[m,periodGrades(state,subject,periodId,m)])),automatic:Object.fromEntries(methods.map(m=>[m,periodGrades(state,subject,periodId,m,true)]))}) as PeriodSnapshot;
 return {...state,periodSnapshots:[...(state.periodSnapshots||[]),snapshot]};
}
export function reopenEvaluation(state:AppState,subjectId:string,periodId:string,reason:string):AppState{
 const snapshot=closedPeriod(state,subjectId,periodId);if(!snapshot||!reason.trim())throw Error('Cal un període tancat i un motiu de rectificació.');
 return {...state,periodSnapshots:[...(state.periodSnapshots||[]),{...clone(snapshot),id:crypto.randomUUID(),at:new Date(Math.max(Date.now(),Date.parse(snapshot.at)+1)).toISOString(),action:'reopen',reason:reason.trim()}]};
}
export function createRecoveryTask(state:AppState,input:Omit<RecoveryTask,'id'>):AppState{
 const subject=state.subjects.find(s=>s.id===input.subjectId);if(!subject||!input.title.trim()||!input.studentIds.length||!input.targets.length)throw Error('Indica títol, participants i correspondències.');
 if(input.studentIds.some(id=>!subject.students.some(s=>s.id===id)))throw Error('Participant aliè al grup.');
 for(const target of input.targets){const a=state.activities?.find(a=>a.id===target.activityId&&a.subjectId===subject.id);if(!a||a.assessmentType==='completion'||!target.slotKeys.length||target.slotKeys.some(k=>!recoverySlots(a).some(s=>s.key===k)))throw Error('Correspondència invàlida amb l’activitat original.');}
 return {...state,recoveryTasks:[...(state.recoveryTasks||[]),{...clone(input),id:crypto.randomUUID(),title:input.title.trim()}]};
}
