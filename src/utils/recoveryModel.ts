import {ActivityRecovery,CurricularActivity,RecoveryPolicy,RecoverySettings,RecoverySlot,Subject,CompetencyEvaluationSettings,AppState} from '../types';
export const DEFAULT_RECOVERY:RecoverySettings={enabled:true,policy:'lower_level',applyToNA:false,allowExceptions:true,afterClosureOnly:true,updateOpenPeriods:true};
export const recoverySettings=(subject:Subject,activity?:CurricularActivity):RecoverySettings=>({...DEFAULT_RECOVERY,...subject.recoverySettings,...activity?.recoverySettings});
export const policyNames={none:'Sense penalització',lower_level:'Reducció d’un nivell',cap_as:'Qualificació màxima AS'};
export function recoveryQual(score:number,t:CompetencyEvaluationSettings['thresholds']):'NA'|'AS'|'AN'|'AE'{return score>=t.AE?'AE':score>=t.AN?'AN':score>=t.AS?'AS':'NA';}
// A half-open target band must never round up into the next level internally.
// Preserve relative position within each source band; cap the upper endpoint.
export function recoveryScore(score:number,policy:RecoveryPolicy,t:CompetencyEvaluationSettings['thresholds']):number{
 if(policy==='none'||score<t.AN)return score;
 const below=(upper:number,lower:number)=>upper-Math.max(Number.EPSILON*8,Math.min(0.000001,(upper-lower)/1000000));
 if(policy==='cap_as')return Math.min(score,below(t.AN,t.AS));
 const ae=score>=t.AE,lo=ae?t.AE:t.AN,hi=ae?4:t.AE,targetLo=ae?t.AN:t.AS,targetHi=ae?t.AE:t.AN;
 const ratio=hi===lo?0:Math.min(1,Math.max(0,(score-lo)/(hi-lo)));
 return Math.min(targetLo+ratio*(targetHi-targetLo),below(targetHi,targetLo));
}
export function recoverySlots(a:CurricularActivity):RecoverySlot[]{
 const slots:RecoverySlot[]=[...(a.numericAspects||[]).map(x=>({key:'aspect:'+x.id,kind:'aspect' as const,id:x.id,label:x.label,format:x.format,max:x.maxScore,test:x.test})),...(a.criteriaIds||[]).map(id=>({key:'criterion:'+id,kind:'criterion' as const,id,label:a.criteriaCustomLabels?.[id]||id,format:a.criteriaGradingType?.[id]||'competencial',max:a.criteriaMaxScores?.[id]||10,test:a.criteriaTests?.[id]}))];
 return slots.length?slots:[{key:'global',kind:'global',id:'',label:'Nota global',format:a.numericGradingType||'numeric',max:10,test:a.numericTest}];
}
export function activeAttempts(r?:ActivityRecovery){return (r?.attempts||[]).filter(a=>a.applied&&!r?.annulments.some(v=>v.attemptId===a.id)).sort((a,b)=>a.recordedAt.localeCompare(b.recordedAt)||a.id.localeCompare(b.id));}
export function recoveryResult(a:CurricularActivity,studentId:string,key:string){return activeAttempts(a.recoveries?.[studentId]).flatMap(x=>x.results).filter(x=>x.slot.key===key).at(-1);}
export const hasRecovery=(a:CurricularActivity,id:string)=>activeAttempts(a.recoveries?.[id]).length>0;
export const effectiveActivityStatus=(a:CurricularActivity,id:string)=>hasRecovery(a,id)?undefined:a.grades?.[id]?.status;
export function latestPeriodEvent(state:AppState,subjectId:string,periodId:string){return (state.periodSnapshots||[]).filter(x=>x.subjectId===subjectId&&x.periodId===periodId).sort((a,b)=>a.at.localeCompare(b.at)||a.id.localeCompare(b.id)).at(-1);}
export function closedPeriod(state:AppState,subjectId:string,periodId:string){const e=latestPeriodEvent(state,subjectId,periodId);return e?.action==='close'?e:undefined;}
export function periodActivitySource(state:AppState,subjectId:string,periodId:string){return closedPeriod(state,subjectId,periodId)?.activities||state.activities||[];}
export function periodCommentsFor(state:AppState,subjectId:string,periodId:string){return closedPeriod(state,subjectId,periodId)?.comments||state.periodComments?.[subjectId]?.[periodId]||{};}

/** Keep the meaning of original evidence stable, including parent-to-child edits. */
export function preservesRecoveryEvidence(before:CurricularActivity,after:CurricularActivity):boolean{
 if(!Object.keys(before.recoveries||{}).length)return true;
 if((before.assessmentType||'graded')!==(after.assessmentType||'graded'))return false;
 const signature=(a:CurricularActivity,s:RecoverySlot)=>JSON.stringify([s.key,s.format,s.max,s.format==='test'?(s.test||{questions:10,correct:1,blank:0,incorrect:-0.25}):null,s.kind==='criterion'?(a.criteriaReferences?.[s.id]||s.id):null]);
 const next=recoverySlots(after);
 return recoverySlots(before).every(slot=>next.some(s=>signature(before,slot)===signature(after,s)));
}
