import {recordKey,recordMethod} from './termRecords';
/** Shared validation at import and edit commit boundaries. */
export type ImportIssue={path:string;message:string;severity:'error'|'warning'};
export type ImportReport={issues:ImportIssue[];valid:boolean};
type Check=(value:any,path:string,issue:(path:string,message:string)=>void)=>void;
const record=(v:any)=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const text:Check=(v,p,e)=>{if(typeof v!=='string')e(p,'Ha de ser un text.');};
const id:Check=(v,p,e)=>{if(typeof v!=='string'||!v.trim()||['__proto__','prototype'].includes(v)||Object.hasOwn(Object.prototype,v))e(p,'Falta un identificador no buit.');};
const bool:Check=(v,p,e)=>{if(typeof v!=='boolean')e(p,'Ha de ser cert o fals.');};
const number=(min=-Infinity,max=Infinity,integer=false):Check=>(v,p,e)=>{if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max||(integer&&!Number.isInteger(v)))e(p,`Ha de ser un número ${integer?'enter ':''}vàlid${min!==-Infinity?` ≥ ${min}`:''}${max!==Infinity?` i ≤ ${max}`:''}.`);};
const nullable=(check:Check):Check=>(v,p,e)=>{if(v!==null)check(v,p,e);};
const enumeration=(...values:string[]):Check=>(v,p,e)=>{if(!values.includes(v))e(p,`Valor admès: ${values.join(', ')}.`);};
const list=(check:Check):Check=>(v,p,e)=>{if(!Array.isArray(v)){e(p,'Ha de ser una llista.');return;}v.forEach((x,i)=>check(x,`${p}[${i+1}]`,e));};
const map=(check:Check):Check=>(v,p,e)=>{if(!record(v)){e(p,'Ha de ser un objecte de registres.');return;}Object.entries(v).forEach(([k,x])=>check(x,`${p}[${k}]`,e));};
const object=(fields:Record<string,Check>,required:string[]=[]):Check=>(v,p,e)=>{if(!record(v)){e(p,'Ha de ser un objecte.');return;}for(const k of required)if(v[k]===undefined)e(`${p}.${k}`,'Falta aquest camp obligatori.');for(const [k,check]of Object.entries(fields))if(v[k]!==undefined)check(v[k],`${p}.${k}`,e);};
const date:Check=(v,p,e)=>{if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v)||!Number.isFinite(Date.parse(v))||new Date(v).toISOString().slice(0,10)!==v)e(p,'Data invàlida; cal AAAA-MM-DD i un dia existent.');};
const optionalDate:Check=(v,p,e)=>{if(v!=='')date(v,p,e);};
const time:Check=(v,p,e)=>{if(typeof v!=='string'||(v!==''&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(v)))e(p,'Hora invàlida; cal HH:MM.');};
const level=enumeration('NA','AS','AN','AE');
const rubric=object({NA:text,AS:text,AN:text,AE:text});
const student=object({id,name:text},['id','name']);
const profile=object({notes:text,psi:text,supportMeasures:text,additionalComments:text});
const grade=object({score:nullable(number(0,10)),qual:enumeration('','NA','AS','AN','AE'),isManual:bool,failedCECount:number(0,Infinity,true),autoFailed:bool},['score']);
const criterionGrade=object({criterionId:id,rawScore:nullable(number(0)),maxScore:number(Number.MIN_VALUE),normalizedScore:nullable(number(0,4)),competencialScore:level});
const activityGrade=object({score:nullable(number(0,10)),competencialScore:level,status:enumeration('not_submitted','exempt'),comment:text,criteriaGrades:map(criterionGrade),numericItemId:id});
const termStudent=object({criteria:map(grade),competencies:map(grade),items:map(grade),finalGrade:grade,metrics:object({mean:nullable(number()),median:nullable(number()),mode:(v,p,e)=>{if(typeof v!=='string')nullable(number())(v,p,e);}})});
const subject=object({id,name:text,color:text,isGeneral:bool,isParent:bool,parentId:nullable(id),students:list(student),evaluationType:enumeration('numeric','competencial'),numericItems:list(object({id,name:text,code:text,weight:number(0,100)},['id','name','code','weight'])),compSettings:object({values:object({NA:number(0,4),AS:number(0,4),AN:number(0,4),AE:number(0,4)}),thresholds:object({AS:number(0,4),AN:number(0,4),AE:number(0,4)}),maxFailedCompetencies:number(0,Infinity,true)}),generalNotes:list(text),generalLinks:list(object({id,label:text,url:text},['id','label','url']))},['id','name','students']);
const activity=object({id,subjectId:id,code:text,title:text,description:text,startDate:optionalDate,endDate:optionalDate,status:enumeration('auto','not_open','open','pending_correction','corrected'),termId:text,weight:number(0),resources:list(object({id,title:text,url:text},['id','title','url'])),criteriaIds:list(id),criteriaReferences:map(id),criteriaRubrics:map(rubric),criteriaWeights:map(number(0)),criteriaMaxScores:map(number(Number.MIN_VALUE)),criteriaGradingType:map(enumeration('numeric','competencial')),criteriaCustomLabels:map(text),numericItemId:text,numericGradingType:enumeration('numeric','competencial'),grades:map(activityGrade)},['id','subjectId','title']);
const term=object({id,name:text,startDate:date,endDate:date,isPreassessment:bool,parentTermId:id},['id','name','startDate','endDate']);
const session=object({id,scheduleItemId:id,subjectId:id,date,comments:text,nextSessionNotes:text,attendance:map(object({status:enumeration('present','absent','late10','lateMore10','pending'),score:nullable(number(0,10)),posComment:text,regularComment:text,incidentComment:text,posComments:list(text),regularComments:list(text),incidentComments:list(text)}))},['id','scheduleItemId','subjectId','date']);
const config=object({teacherProfile:object({fullName:text,email:text},['fullName','email']),startDate:date,endDate:date,holidays:list(object({date,endDate:optionalDate,label:text},['date','label'])),terms:list(term),timeSlots:list(object({id,name:text,startTime:time,endTime:time},['id','name'])),substitutions:list(object({id,date,timeSlotId:id,type:enumeration('subject','other'),subjectId:id,customReason:text},['id','date','timeSlotId','type'])),autoClassNotifications:bool,autoClassNotificationMinutes:number(0),reminders:list(object({id,title:text,date,time,type:enumeration('class','calendar','todo'),advanceMinutes:number(0),active:bool},['id','title','date','type','advanceMinutes','active']))});
const schema=object({config,subjects:list(subject),schedule:list(object({id,dayOfWeek:number(1,5,true),timeSlotId:id,subjectId:id},['id','dayOfWeek','timeSlotId','subjectId'])),competencies:list(object({id,subjectId:id,key:text,description:text},['id','subjectId','key'])),criteria:list(object({id,competencyId:id,key:text,description:text,shortLabel:text,order:number(0),rubric},['id','competencyId','key'])),activities:list(activity),sessionLogs:list(session),plans:list(object({id,subjectId:id,name:text,rows:number(1,100,true),cols:number(1,100,true),teacherDesk:nullable(object({x:number(),y:number()},['x','y'])),seats:map(id),corridorRows:list(number(0,100,true)),corridorCols:list(number(0,100,true))},['id','subjectId','rows','cols'])),termGradesRecords:list(object({id,subjectId:id,periodId:id,calculationMode:enumeration('mean','median','mode'),cleared:bool,students:map(termStudent)},['id','subjectId','periodId'])),studentProfiles:map(profile),periodComments:map(map(map(text))),studentRegistry:map(student),enrolments:map(list(id)),identityVersion:number(1,1,true),identityArchive:list(object({legacyId:text,profile},['legacyId','profile']))},['config','subjects','schedule']);

export function inspectImport(value:unknown):ImportReport {
  const issues:ImportIssue[]=[];let errors=false;
  const issue=(severity:'error'|'warning')=>(path:string,message:string)=>{if(severity==='error')errors=true;if(issues.length<100)issues.push({path,message,severity});else if(severity==='error'){const index=issues.findIndex(i=>i.severity==='warning');if(index>=0)issues[index]={path,message,severity};}};
  const error=issue('error'),warn=issue('warning');
  // Iterative scan also covers unknown extension fields, without recursive overflow.
  const queue=[{value,path:'dades',depth:0}];let count=0;
  while(queue.length){const item=queue.pop()!;if(++count>1000000||item.depth>60){error(item.path,'Fitxer massa complex (màxim 60 nivells i 1.000.000 de camps).');break;}
    if(item.value&&typeof item.value==='object')for(const [key,v] of Object.entries(item.value)){if(['__proto__','prototype'].includes(key)||Object.hasOwn(Object.prototype,key))error(item.path,'Conté una clau reservada no admesa.');queue.push({value:v,path:`${item.path}.${key}`,depth:item.depth+1});}}
  if(errors)return {issues,valid:false};
  schema(value,'dades',error);
  if(errors)return {issues,valid:false};
  const d=value as any;
  const pre=(d.config.terms||[]).filter((t:any)=>t.isPreassessment);
  if(pre.length>1)error('config.terms','Només es pot configurar una preavaluació.');
  const first=(d.config.terms||[]).filter((t:any)=>!t.isPreassessment).sort((a:any,b:any)=>a.startDate.localeCompare(b.startDate))[0];
  for(const p of pre)if(!first||p.parentTermId!==first.id||p.startDate!==first.startDate||p.endDate<p.startDate||p.endDate>first.endDate)error('config.terms','La preavaluació ha de començar amb el primer trimestre i acabar dins seu.');
  if(d.config.teacherProfile?.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.config.teacherProfile.email))error('config.teacherProfile.email','Correu de contacte invàlid.');
  const arrays=['subjects','schedule','competencies','criteria','activities','sessionLogs','plans','termGradesRecords'];
  const unique=(rows:any[],path:string)=>{const seen=new Set();rows.forEach((r,i)=>{if(seen.has(r.id))error(`${path}[${i+1}].id`,'Identificador duplicat dins la mateixa llista.');seen.add(r.id);});};
  arrays.forEach(k=>unique(d[k]||[],k));
  const recordKeys=new Set<string>();
  for(const [i,r]of (d.termGradesRecords||[]).entries()){
    const key=recordKey(r);
    if(recordKeys.has(key))error(`termGradesRecords[${i+1}]`,'Hi ha dues notes per a la mateixa assignatura, període i mètode. Cal revisar-les; no se’n descartarà cap automàticament.');
    recordKeys.add(key);
    for(const m of ['mean','median','mode'])if(r.id===`${r.subjectId}_${r.periodId}_${m}`&&recordMethod(r)!==m)error(`termGradesRecords[${i+1}].calculationMode`,'El mètode contradiu l’identificador antic del registre.');
  }
  for(const k of ['terms','timeSlots','substitutions','reminders'])unique(d.config[k]||[],`config.${k}`);
  const subjects=new Map<string,any>(d.subjects.map((s:any)=>[s.id,s]));
  const comps=new Map<string,any>((d.competencies||[]).map((c:any)=>[c.id,c]));
  const criteria=new Map<string,any>((d.criteria||[]).map((c:any)=>[c.id,c]));
  const students=new Set([...Object.keys(d.studentRegistry||{}),...d.subjects.flatMap((s:any)=>s.students.map((st:any)=>st.id))]);
  const refs=(key:string,target:Map<any,any>|Set<any>,v:any,path:string)=>{if(v&&!target.has(v))warn(path,`${key} inexistent; es conserva la referència per no perdre l’històric.`);};
  const range=(x:any,path:string,a='startDate',b='endDate')=>{if(x[a]&&x[b]&&x[a]>x[b])error(path,'La data inicial és posterior a la final.');};
  range(d.config,'config');(d.config.terms||[]).forEach((t:any,i:number)=>range(t,`config.terms[${i+1}]`));(d.config.holidays||[]).forEach((h:any,i:number)=>range(h,`config.holidays[${i+1}]`,'date'));
  const knownStudents=new Map<string,string>();
  d.subjects.forEach((s:any,i:number)=>{
    const path=`subjects[${i+1}]`;refs('Grup mare',subjects,s.parentId,path+'.parentId');unique(s.numericItems||[],path+'.numericItems');
    const local=new Set();for(const st of s.students){if(local.has(st.id)||knownStudents.has(st.id)&&knownStudents.get(st.id)!==st.name)warn(path+'.students','Identitat ambigua: caldrà revisar-la abans d’accedir a les fitxes.');local.add(st.id);knownStudents.set(st.id,st.name);if(d.studentRegistry?.[st.id]&&d.studentRegistry[st.id].name!==st.name)error(path+'.students','El nom no coincideix amb el catàleg per al mateix identificador; cal revisar la identitat.');}
    const values={NA:1,AS:2,AN:3,AE:4,...s.compSettings?.values};if(!(values.NA<values.AS&&values.AS<values.AN&&values.AN<values.AE))error(path+'.compSettings.values','Els valors han de complir NA < AS < AN < AE.');
    const thresholds={AS:2,AN:2.75,AE:3.75,...s.compSettings?.thresholds};if(!(thresholds.AS<thresholds.AN&&thresholds.AN<thresholds.AE))error(path+'.compSettings.thresholds','Els llindars han de complir AS < AN < AE.');
    const items=s.numericItems||[];if(s.evaluationType==='numeric'&&items.length&&Math.abs(items.reduce((n:number,x:any)=>n+x.weight,0)-100)>0.001)warn(path+'.numericItems','Els pesos dels ítems no sumen 100 %. Revisa la configuració.');
  });
  // Linear traversal of parent pointers: cycles cannot enter inheritance helpers.
  const done=new Set<string>();for(const sid of subjects.keys()){const chain=new Set<string>();let id:string|null=sid;while(id&&subjects.has(id)&&!done.has(id)){if(chain.has(id)){error('subjects.parentId','Els grups mare formen un cicle.');break;}chain.add(id);id=subjects.get(id).parentId;}chain.forEach(id=>done.add(id));}
  for(const [key,st]of Object.entries(d.studentRegistry||{}) as any)if(key!==st.id)error(`studentRegistry[${key}].id`,'La clau i l’identificador de l’alumne han de coincidir.');
  for(const [sid,ids]of Object.entries(d.enrolments||{}) as [string,string[]][]){const s=subjects.get(sid);if(!s||JSON.stringify(ids)!==JSON.stringify(s.students.map((st:any)=>st.id)))warn(`enrolments[${sid}]`,'Les matrícules es reconstruiran a partir dels llistats d’assignatura.');}
  (d.competencies||[]).forEach((c:any,i:number)=>refs('Assignatura',subjects,c.subjectId,`competencies[${i+1}].subjectId`));
  (d.criteria||[]).forEach((c:any,i:number)=>refs('Competència',comps,c.competencyId,`criteria[${i+1}].competencyId`));
  const studentMap=(values:any,path:string)=>Object.keys(values||{}).forEach(id=>refs('Alumne',students,id,path));
  (d.activities||[]).forEach((a:any,i:number)=>{
    const p=`activities[${i+1}]`;refs('Assignatura',subjects,a.subjectId,p+'.subjectId');range(a,p);
    if(!a.endDate)warn(p+'.endDate','Sense termini: no entrarà al càlcul d’un trimestre.');
    const seen=new Set();for(const id of a.criteriaIds||[]){if(seen.has(id))error(p+'.criteriaIds','Una repetició necessita un identificador d’aspecte propi.');seen.add(id);const source=criteria.get(a.criteriaReferences?.[id]||id);refs('Criteri',criteria,a.criteriaReferences?.[id]||id,p+'.criteriaIds');const owner=source&&comps.get(source.competencyId)?.subjectId;if(owner&&subjects.has(a.subjectId)&&owner!==a.subjectId&&owner!==subjects.get(a.subjectId).parentId)error(p+'.criteriaIds','El criteri pertany a una altra assignatura, no a aquesta ni al seu grup mare.');}
    if(a.numericItemId)refs('Ítem numèric',new Set((subjects.get(a.subjectId)?.numericItems||[]).map((x:any)=>x.id)),a.numericItemId,p+'.numericItemId');
    studentMap(a.grades,p+'.grades');
    for(const [sid,g]of Object.entries(a.grades||{}) as any)for(const [cid,cg]of Object.entries(g.criteriaGrades||{}) as any){const max=a.criteriaMaxScores?.[cid]??cg.maxScore??10;if(cg.rawScore!=null&&cg.rawScore>max)error(`${p}.grades[${sid}].criteriaGrades[${cid}].rawScore`,'La puntuació supera el màxim del criteri.');}
  });
  const slots=new Set((d.config.timeSlots||[]).map((s:any)=>s.id));const schedules=new Set(d.schedule.map((s:any)=>s.id));
  d.schedule.forEach((s:any,i:number)=>{refs('Assignatura',subjects,s.subjectId,`schedule[${i+1}].subjectId`);if(d.config.timeSlots)refs('Franja',slots,s.timeSlotId,`schedule[${i+1}].timeSlotId`);});
  (d.sessionLogs||[]).forEach((s:any,i:number)=>{refs('Assignatura',subjects,s.subjectId,`sessionLogs[${i+1}].subjectId`);refs('Sessió d’horari',schedules,s.scheduleItemId,`sessionLogs[${i+1}].scheduleItemId`);studentMap(s.attendance,`sessionLogs[${i+1}].attendance`);});
  (d.termGradesRecords||[]).forEach((r:any,i:number)=>{refs('Assignatura',subjects,r.subjectId,`termGradesRecords[${i+1}].subjectId`);studentMap(r.students,`termGradesRecords[${i+1}].students`);for(const [sid,g]of Object.entries(r.students||{}) as any){for(const kind of ['criteria','competencies'])for(const entry of Object.values(g[kind]||{}) as any[])if(entry.score>4)error(`termGradesRecords[${i+1}].students[${sid}].${kind}`,'La nota de criteri o competència supera 4.');if(subjects.has(r.subjectId)&&subjects.get(r.subjectId).evaluationType!=='numeric'&&g.finalGrade?.score>4)error(`termGradesRecords[${i+1}].students[${sid}].finalGrade`,'La nota competencial supera 4.');}});
  (d.plans||[]).forEach((p:any,i:number)=>{refs('Assignatura',subjects,p.subjectId,`plans[${i+1}].subjectId`);for(const [seat,id]of Object.entries(p.seats||{})){refs('Alumne',students,id,`plans[${i+1}].seats`);const coords=seat.split(',').map(Number);if(coords.length!==2||coords.some(n=>!Number.isInteger(n)||n<0)||coords[0]>=p.rows||coords[1]>=p.cols)warn(`plans[${i+1}].seats`,'Hi ha un seient fora de les dimensions del plànol.');}});
  return {issues,valid:!errors};
}
export class ImportValidationError extends Error {
  constructor(public report:ImportReport){super('No s’han carregat les dades.\n'+report.issues.filter(i=>i.severity==='error').map(i=>`${i.path}: ${i.message}`).join('\n'));this.name='ImportValidationError';}
}
export function assertValidImport(value:unknown):ImportReport {const report=inspectImport(value);if(!report.valid)throw new ImportValidationError(report);return report;}
export function parseImportJson(raw:string):unknown {
  if(raw.length>20*1024*1024||new TextEncoder().encode(raw).byteLength>20*1024*1024)throw Error('El JSON supera el límit de 20 MB. No s’han substituït dades.');
  try{return JSON.parse(raw.replace(/^\uFEFF/,''));}catch{throw Error('El fitxer no és un JSON vàlid. No s’han substituït dades.');}
}

export async function readImportFile(file:{size?:number;text:()=>Promise<string>}):Promise<unknown>{
  if(file.size!==undefined&&file.size>20*1024*1024)throw Error('El fitxer supera 20 MB. No s’han substituït dades.');
  return parseImportJson(await file.text());
}
