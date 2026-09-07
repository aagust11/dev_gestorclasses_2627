import test from 'node:test';
import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';
import { Subject, CurricularActivity, EvalCriterion, Competency } from '../src/types';
import { DEFAULT_COMP_SETTINGS, getCompSettings, getCriterionScore, getActivityScore, calculateCompetencialTermGrades, calculateNumericTermGrades, filterActivitiesForPeriod, weightedStatistic, scoreToCompetencial, buildActivitiesWorkbook, buildTermGradesWorkbook } from '../src/utils/gradeCalculations';
import { getInitialState } from '../src/initialState';
import { loadStateFromLocalStorage, saveStateToLocalStorage } from '../src/storage';
import { getLastDayBeforeDeliveryActivities } from '../src/utils/dateHelpers';

const sub=():Subject=>({id:'s',name:'Matemàtiques',color:'#2563eb',isGeneral:false,parentId:null,students:[{id:'u',name:'Alumne A'}],evaluationType:'competencial',compSettings:{...structuredClone(DEFAULT_COMP_SETTINGS),maxFailedCompetencies:0}});
const comps:Competency[]=[{id:'ce1',subjectId:'s',key:'CE1',description:'Competència 1'}];
const criteria:EvalCriterion[]=[{id:'ca1',competencyId:'ce1',key:'CA1',shortLabel:'P1-CA1',description:'Criteri 1'},{id:'ca2',competencyId:'ce1',key:'CA2',description:'Criteri 2'}];
const act=(patch:Partial<CurricularActivity>={}):CurricularActivity=>({id:'a',subjectId:'s',code:'P1',title:'Pràctica',description:'',startDate:'2026-09-01',endDate:'2026-10-01',status:'auto',termId:'t1',weight:1,resources:[],criteriaIds:['ca1'],...patch});
const numericGrade=(value:number,max=10)=>({u:{criteriaGrades:{ca1:{rawScore:value,maxScore:max}}}});
const calc=(s:Subject,as:CurricularActivity[],cs=criteria)=>calculateCompetencialTermGrades(s,as,comps,cs).u;

test('Els llindars són inclusius i no es classifiquen amb una nota arrodonida',()=>{
  const thresholds={AS:2,AN:2.8,AE:3.7};
  assert.equal(scoreToCompetencial(1.9999,thresholds),'NA');
  assert.equal(scoreToCompetencial(2,thresholds),'AS');
  assert.equal(scoreToCompetencial(2.8,thresholds),'AN');
  assert.equal(scoreToCompetencial(3.7,thresholds),'AE');
});

test('Una nota numèrica conserva el seu valor exacte encara que tingui un equivalent qualitatiu desat',()=>{
  const a=act({criteriaMaxScores:{ca1:20},grades:{u:{criteriaGrades:{ca1:{rawScore:13,competencialScore:'AS',normalizedScore:2,maxScore:20}}}}});
  assert.equal(getCriterionScore(a,'u','ca1',sub()),2.6);
  assert.equal(calc(sub(),[a]).criteria.ca1.score,2.6);
});

test('Ponderació CA: pes activitat × pes criteri i màxim numèric propi',()=>{
  const as=[act({weight:2,criteriaWeights:{ca1:3},criteriaMaxScores:{ca1:20},grades:numericGrade(10,20)}),act({id:'b',weight:1,criteriaWeights:{ca1:2},grades:numericGrade(10)})];
  // (2 * 6 + 4 * 2) / 8 = 2.5
  assert.equal(calc(sub(),as).criteria.ca1.score,2.5);
});

test('Zero és una nota vàlida; pes zero exclou; criteri sense nota no suspèn',()=>{
  const s=sub();s.compSettings!.maxFailedCompetencies=1;
  const g=calc(s,[act({grades:numericGrade(0)}),act({id:'b',weight:0,grades:numericGrade(10)})]);
  assert.equal(g.criteria.ca1.score,0);
  assert.equal(g.criteria.ca2,undefined);
  assert.equal(g.finalGrade.score,0);
  assert.equal(g.finalGrade.failedCECount,1);
  const empty=calc(s,[]);
  assert.equal(empty.finalGrade.score,null);
  assert.equal(empty.finalGrade.failedCECount,0);
  assert.equal(empty.finalGrade.autoFailed,false);
});

test('Una activitat parcial no inventa la nota dels criteris pendents',()=>{
  const a=act({criteriaIds:['ca1','ca2'],grades:{u:{score:8,competencialScore:'AN',criteriaGrades:{ca1:{rawScore:8}}}}});
  assert.equal(getCriterionScore(a,'u','ca2',sub()),null);
});

test('Canviar els valors de càlcul actualitza totes les puntuacions competencials',()=>{
  const s=sub();s.compSettings!.values.AS=2.4;
  const a=act({grades:{u:{criteriaGrades:{ca1:{competencialScore:'AS',normalizedScore:2}}}}});
  assert.equal(calc(s,[a]).finalGrade.score,2.4);
  s.compSettings!.thresholds.AN=2.3;
  assert.equal(calc(s,[a]).finalGrade.qual,'AN');
});

test('El trimestre es decideix només per termini; el curs inclou totes les activitats',()=>{
  const terms=[{id:'t1',name:'T1',startDate:'2026-09-01',endDate:'2026-12-20'},{id:'t2',name:'T2',startDate:'2027-01-01',endDate:'2027-03-30'}];
  const as=[act({id:'a',endDate:'2026-12-20',termId:'t2'}),act({id:'b',endDate:'2027-01-10',termId:'t1'}),act({id:'c',endDate:'2026-12-25'})];
  assert.deepEqual(filterActivitiesForPeriod(as,'s','t1',terms).map(a=>a.id),['a']);
  assert.deepEqual(filterActivitiesForPeriod(as,'s','t2',terms).map(a=>a.id),['b']);
  assert.equal(filterActivitiesForPeriod(as,'s','annual',terms).length,3);
  assert.equal(filterActivitiesForPeriod(as,'s','invalid',terms).length,0);
});

test('Mitjana, mediana i moda recomputen els CA i CE, no només la casella final',()=>{
  const as=[0,4,4].map((n,i)=>act({id:String(i),grades:numericGrade(n,4),criteriaMaxScores:{ca1:4}}));
  const mean=calculateCompetencialTermGrades(sub(),as,comps,criteria,undefined,'mean').u;
  const median=calculateCompetencialTermGrades(sub(),as,comps,criteria,undefined,'median').u;
  const mode=calculateCompetencialTermGrades(sub(),as,comps,criteria,undefined,'mode').u;
  assert.ok(Math.abs(mean.criteria.ca1.score-8/3)<1e-10);
  assert.equal(median.criteria.ca1.score,4);assert.equal(mode.criteria.ca1.score,4);
  assert.equal(mean.metrics!.median,4);assert.equal(mean.metrics!.mode,4);
  assert.equal(weightedStatistic([{score:0,weight:3},{score:4,weight:1}],'median'),0);
  assert.equal(weightedStatistic([{score:0,weight:1},{score:4,weight:1}],'mode'),0);
});

test('CA i CE manuals es conserven, actualitzen els dependents i el límit de CE força NA',()=>{
  const s=sub(), as=[act({grades:numericGrade(10)})];
  let g=calc(s,as);
  g.criteria.ca1={score:1,qual:'NA',isManual:true};
  g=calculateCompetencialTermGrades(s,as,comps,criteria,{u:g}).u;
  assert.equal(g.competencies.ce1.score,1);assert.equal(g.finalGrade.score,1);
  g.competencies.ce1={score:3,qual:'AN',isManual:true};
  g=calculateCompetencialTermGrades(s,as,comps,criteria,{u:g}).u;
  assert.equal(g.finalGrade.score,3);
  s.compSettings!.maxFailedCompetencies=1;
  g.competencies.ce1={score:1,qual:'NA',isManual:true};
  g.finalGrade={score:4,qual:'AE',isManual:true};
  g=calculateCompetencialTermGrades(s,as,comps,criteria,{u:g}).u;
  assert.equal(g.finalGrade.qual,'NA');assert.equal(g.finalGrade.autoFailed,true);
});

test('Ítems numèrics ponderen activitats, percentatges, notes competencials i criteris',()=>{
  const s=sub();s.evaluationType='numeric';s.numericItems=[{id:'exam',code:'EX',name:'Exàmens',weight:60},{id:'work',code:'TR',name:'Treball',weight:40}];s.compSettings!.values.AS=2.4;
  const as=[act({criteriaIds:[],numericItemId:'exam',weight:1,grades:{u:{score:4}}}),act({id:'b',criteriaIds:[],numericItemId:'exam',weight:3,grades:{u:{score:8}}}),act({id:'c',criteriaIds:[],numericItemId:'work',numericGradingType:'competencial',grades:{u:{competencialScore:'AS',score:5}}})];
  const g=calculateNumericTermGrades(s,as).u;
  assert.equal(g.items!.exam.score,7);assert.equal(g.items!.work.score,6);assert.equal(g.finalGrade.score,6.6);assert.equal(g.metrics!.mean,6.6);
  const b=act({numericItemId:'exam',criteriaIds:['ca1','ca2'],criteriaWeights:{ca1:1,ca2:3},grades:{u:{criteriaGrades:{ca1:{rawScore:0},ca2:{rawScore:10}}}}});
  assert.equal(getActivityScore(b,'u',s),3);assert.equal(calculateNumericTermGrades(s,[b]).u.finalGrade.score,7.5);
});

test('Excel: els valors numèrics són números i cada alumne ocupa una fila',()=>{
  const s=sub(), a=act({criteriaCustomLabels:{ca1:'P1 · Expressió'},criteriaMaxScores:{ca1:20},grades:{u:{criteriaGrades:{ca1:{rawScore:13,maxScore:20}},comment:'Comentari únic'}}});
  const wb=buildActivitiesWorkbook(s,[a],criteria,s.students), rows=XLSX.utils.sheet_to_json<any[]>(wb.Sheets.Activitats,{header:1});
  assert.equal(rows.length,4);assert.ok(rows[2].some(h=>String(h).includes('P1 · Expressió')));assert.equal(rows[3][2],13);assert.equal(rows[3][3],20);assert.equal(rows[3][4],2.6);assert.equal(rows[3].at(-1),'Comentari únic');
  const bytes=XLSX.write(wb,{type:'buffer',bookType:'xlsx'});assert.equal(XLSX.read(bytes,{type:'buffer'}).SheetNames[0],'Activitats');
  const g=calc(s,[a]);const term=buildTermGradesWorkbook(s,'T1',criteria,comps,{u:g});const rs=XLSX.utils.sheet_to_json<any[]>(term.Sheets.Qualificacions,{header:1});assert.equal(rs[3][2],2.6);assert.equal(typeof rs[3][2],'number');
});

test('La recàrrega conserva les notes manuals, els llindars i la configuració completa',()=>{
  const state=getInitialState();state.subjects=[sub()];state.config.autoClassNotifications=true;state.termGradesRecords=[{id:'s_t1_mean',subjectId:'s',periodId:'t1',students:{u:calc(sub(),[act({grades:numericGrade(8)})])}}];state.termGradesRecords[0].students.u.criteria.ca1.isManual=true;
  const map=new Map<string,string>();Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{setItem:(k:string,v:string)=>map.set(k,v),getItem:(k:string)=>map.get(k)}});
  saveStateToLocalStorage(state);const loaded=loadStateFromLocalStorage();assert.deepEqual(loaded.termGradesRecords,JSON.parse(JSON.stringify(state.termGradesRecords)));assert.equal(loaded.config.autoClassNotifications,true);assert.deepEqual(getCompSettings(loaded.subjects[0]),getCompSettings(state.subjects[0]));
});

test('L’avís de lliurament no apareix en una classe anterior a l’inici de l’activitat',()=>{
  const state=getInitialState();state.subjects=[sub()];state.config.startDate='2026-09-01';state.config.endDate='2026-09-30';state.config.holidays=[];state.schedule=[{id:'slot',subjectId:'s',dayOfWeek:1,timeSlotId:state.config.timeSlots[0].id}];state.activities=[act({startDate:'2026-09-08',endDate:'2026-09-10'})];assert.deepEqual(getLastDayBeforeDeliveryActivities(state,'s','2026-09-07'),[]);
});

test('Un CA repetit té notes, pesos i màxims independents i s’agrega al CA original',()=>{
  const s=sub(), a=act({criteriaIds:['first','second'],criteriaReferences:{first:'ca1',second:'ca1'},criteriaWeights:{first:1,second:3},criteriaMaxScores:{first:20,second:10},criteriaCustomLabels:{first:'Expressió oral',second:'Expressió escrita'},grades:{u:{criteriaGrades:{first:{rawScore:10},second:{competencialScore:'AE'}}}}});
  assert.equal(getCriterionScore(a,'u','first',s),2);
  assert.equal(getCriterionScore(a,'u','second',s),4);
  assert.equal(getActivityScore(a,'u',s),3.5);
  assert.equal(calc(s,[a]).criteria.ca1.score,3.5);
  assert.equal(calc(s,[a]).competencies.ce1.score,3.5);
  const rows=XLSX.utils.sheet_to_json<any[]>(buildActivitiesWorkbook(s,[a],criteria,s.students).Sheets.Activitats,{header:1});
  assert.ok(rows[2].includes('P1 · Expressió oral · Puntuació'));
  assert.ok(rows[2].includes('P1 · Expressió escrita · Puntuació'));
  assert.equal(rows[3][2],10);assert.equal(rows[3][6],'AE');
  a.criteriaIds.reverse();assert.equal(calc(s,[a]).criteria.ca1.score,3.5);
  a.criteriaIds=['first'];assert.equal(calc(s,[a]).criteria.ca1.score,2);
});

test('Les repeticions pendents no hereten una nota antiga ni la d’una altra repetició',()=>{
  const a=act({criteriaIds:['ca1','new'],criteriaReferences:{new:'ca1'},grades:{u:{score:8}}});
  assert.equal(getCriterionScore(a,'u','ca1',sub()),3.2);
  assert.equal(getCriterionScore(a,'u','new',sub()),null);
  assert.equal(calc(sub(),[a]).criteria.ca1.score,3.2);
});

test('Les descripcions per aspecte sobreescriuen només els nivells personalitzats',async()=>{
  const {criterionRubric,sourceCriterionId}=await import('../src/utils/activityCriteria');
  const a=act({criteriaIds:['one','two'],criteriaReferences:{one:'ca1',two:'ca1'},criteriaRubrics:{one:{AS:'Descriu el procediment'},two:{AS:'Justifica el resultat'}}});
  const cr={...criteria[0],rubric:{NA:'No ho resol',AS:'Ho resol',AE:'Ho explica amb precisió'}};
  assert.equal(criterionRubric(a,'one',cr).AS,'Descriu el procediment');
  assert.equal(criterionRubric(a,'two',cr).AS,'Justifica el resultat');
  assert.equal(criterionRubric(a,'one',cr).AE,'Ho explica amb precisió');
  assert.equal(sourceCriterionId(a,'one'),cr.id);
  cr.key='CA-renovat';cr.description='Descripció nova';
  assert.equal(calc(sub(),[{...a,grades:{u:{criteriaGrades:{one:{rawScore:8}}}}}],[cr]).criteria.ca1.score,3.2);
});

test('Editar una activitat antiga preserva les notes globals dels criteris originals',async()=>{
  const {preserveLegacyCriterionGrades}=await import('../src/utils/activityCriteria');
  const original=act({criteriaMaxScores:{ca1:20},grades:{u:{score:8,comment:'Conservar'}}});
  const updated={...original,criteriaIds:['ca1','extra'],criteriaReferences:{extra:'ca1'},grades:preserveLegacyCriterionGrades(original)};
  assert.equal(getCriterionScore(updated,'u','ca1',sub()),3.2);
  assert.equal(getCriterionScore(updated,'u','extra',sub()),null);
  updated.grades.u.criteriaGrades.extra={rawScore:10};
  assert.equal(getCriterionScore(updated,'u','ca1',sub()),3.2);
  assert.equal(updated.grades.u.comment,'Conservar');
  assert.equal(original.grades.u.criteriaGrades,undefined);
});
