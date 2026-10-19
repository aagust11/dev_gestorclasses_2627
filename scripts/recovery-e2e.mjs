// Synthetic pupils only; real browser, app persistence and navigation.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import path from 'node:path';
import {getInitialState} from '../src/initialState.ts';
import {DEFAULT_COMP_SETTINGS} from '../src/utils/gradeCalculations.ts';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const types={'.js':'text/javascript','.css':'text/css','.html':'text/html','.svg':'image/svg+xml'};
const server=createServer(async(req,res)=>{
 const pathname=new URL(req.url,'http://localhost').pathname;
 const file=path.resolve('dist',pathname.slice('/dev_gestorclasses_2627/'.length)||'index.html');
 if(!pathname.startsWith('/dev_gestorclasses_2627/')||!file.startsWith(path.resolve('dist')+path.sep)){res.writeHead(404);res.end();return;}
 try{res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');res.end(await readFile(file));}catch{res.writeHead(404);res.end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const APP=`http://127.0.0.1:${server.address().port}/dev_gestorclasses_2627/`;
const browser=await chromium.launch({headless:true});
const context=await browser.newContext();const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
 const state=getInitialState();
 state.subjects=[{id:'s',name:'Tecnologia de prova',color:'#123456',isGeneral:false,parentId:null,evaluationType:'competencial',compSettings:{...DEFAULT_COMP_SETTINGS,maxFailedCompetencies:0},students:[{id:'u',name:'Alumne U'},{id:'v',name:'Alumne V'}]}];
 state.studentRegistry={u:state.subjects[0].students[0],v:state.subjects[0].students[1]};state.schedule=[];state.sessionLogs=[];state.plans=[];
 state.competencies=[{id:'ce',subjectId:'s',key:'CE1',description:'Competència prova'}];state.criteria=[{id:'ca',competencyId:'ce',key:'CA1',description:'Criteri prova'}];
 state.config.terms=[{id:'pre',name:'Preavaluació',startDate:'2026-09-01',endDate:'2026-10-15',isPreassessment:true,parentTermId:'t1'},{id:'t1',name:'Primer trimestre',startDate:'2026-09-01',endDate:'2026-12-20'}];
 state.activities=[{id:'a',subjectId:'s',code:'A1',title:'Dossier prova',description:'',startDate:'2026-09-01',endDate:'2026-10-01',termId:'pre',status:'auto',weight:2,resources:[],criteriaIds:['ca'],criteriaCustomLabels:{ca:'Exercici 1'},criteriaGradingType:{ca:'numeric'},criteriaMaxScores:{ca:20},grades:{u:{status:'not_submitted'},v:{criteriaGrades:{ca:{rawScore:5}}}}}];
 await context.addInitScript(state=>{if(!localStorage.getItem('gestor_classes_app_state'))localStorage.setItem('gestor_classes_app_state',JSON.stringify(state));},state);
 await page.goto(APP);
 await page.locator('#nav-item-qualificacions').click();
 await page.getByLabel('Període',{exact:true}).selectOption('pre');
 page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'Tancar avaluació',exact:true}).click();
 await page.getByText('Avaluació tancada',{exact:true}).waitFor();
 await page.waitForFunction(()=>JSON.parse(localStorage.getItem('gestor_classes_app_state')).periodSnapshots?.length===1);
 await page.locator('#nav-item-activitats').click();
 await page.getByRole('button',{name:/Obrir dossier/}).first().click();
 const corrected=page.locator('summary').filter({hasText:'Corregides'});if(await corrected.count())await corrected.first().click();
 await page.getByRole('button',{name:/Qualificar/}).first().click();
 await page.getByRole('button',{name:'Registrar recuperació',exact:true}).first().click();
 await page.getByRole('checkbox',{name:'Exercici 1',exact:true}).check();
 await page.getByLabel('Nota real /20',{exact:true}).fill('20');
 await page.getByRole('button',{name:'Desar recuperació',exact:true}).click();
 await page.waitForFunction(()=>JSON.parse(localStorage.getItem('gestor_classes_app_state')).activities[0].recoveries?.u?.attempts.length===1);
 let saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('gestor_classes_app_state')));
 assert.equal(saved.activities[0].recoveries.u.attempts[0].results[0].computableQual,'AN');assert.equal(saved.activities[0].grades.u.status,'not_submitted');assert.equal(saved.periodSnapshots[0].grades.mean.u.finalGrade.score,0);
 await page.reload();await page.locator('#nav-item-qualificacions').click();await page.getByLabel('Període',{exact:true}).selectOption('pre');await page.getByText('Avaluació tancada',{exact:true}).waitFor();
 await page.getByLabel('Període',{exact:true}).selectOption('t1');await page.getByText('Avaluació oberta',{exact:true}).waitFor();
 // A second browser tab reads the same persisted recovery, with no web page/extension bridge.
 const second=await context.newPage();await second.goto(APP);await second.locator('#nav-item-qualificacions').click();
 assert.equal(await second.evaluate(()=>JSON.parse(localStorage.getItem('gestor_classes_app_state')).activities[0].recoveries.u.attempts[0].results[0].computableQual),'AN');
 await second.close();
 await page.getByLabel('Període',{exact:true}).selectOption('pre');page.once('dialog',d=>d.accept('Rectificació de prova'));await page.getByRole('button',{name:'Reobrir per rectificar',exact:true}).click();
 await page.waitForFunction(()=>JSON.parse(localStorage.getItem('gestor_classes_app_state')).periodSnapshots?.length===2);
 assert.deepEqual(errors,[]);console.log('PASS: close preassessment, record NP→AE→AN recovery, persist/reload, second tab, explicit rectification.');
}catch(e){console.error(await page.locator('body').innerText());throw e;}finally{await browser.close();await new Promise(r=>server.close(r));}
