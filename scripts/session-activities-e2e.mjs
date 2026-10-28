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

 state.config.timeSlots=[{id:'slot',name:'Classe',startTime:'09:00',endTime:'10:00'}];
 state.schedule=[1,2,3,4,5].map(dayOfWeek=>({id:'session'+dayOfWeek,subjectId:'s',timeSlotId:'slot',dayOfWeek}));
 const year=new Date().getFullYear();state.config.startDate=`${year}-01-01`;state.config.endDate=`${year}-12-31`;state.config.holidays=[];state.config.substitutions=[];
 state.activities[0].startDate=`${year}-01-01`;state.activities[0].endDate=`${year}-12-31`;state.activities[0].description='Informació detallada de la prova';
 await context.addInitScript(state=>{if(!localStorage.getItem('gestor_classes_app_state'))localStorage.setItem('gestor_classes_app_state',JSON.stringify(state));},state);
 await page.goto(APP);
 await page.locator('#horari-view-root button').filter({hasText:'Tecnologia de prova'}).first().click();
 await page.locator('summary').filter({hasText:'Activitats en curs'}).click();
 await page.getByRole('button',{name:'Veure activitat A1: Dossier prova',exact:true}).click();
 await page.getByRole('heading',{name:'A1 · Dossier prova',exact:true}).waitFor();
 assert.match(await page.locator('body').innerText(),/Informació detallada de la prova/);
 await page.getByRole('button',{name:'Tornar',exact:true}).click();
 await page.locator('#session-view-root').waitFor();
 await page.getByRole('button',{name:'Programació d’activitats',exact:true}).click();
 await page.getByRole('button',{name:'← Tornar a la sessió',exact:true}).waitFor();
 assert.equal(await page.getByRole('button',{name:'Obrir dossier',exact:true}).count(),0);
 assert.match(await page.locator('body').innerText(),/Dossier d.Activitats/);
 await page.getByRole('button',{name:'← Tornar a la sessió',exact:true}).click();
 await page.locator('#session-view-root').waitFor();assert.deepEqual(errors,[]);
 console.log('PASS: session activity information, direct subject dossier and return to original session.');
}catch(e){console.error(await page.locator('body').innerText());throw e;}finally{await browser.close();await new Promise(r=>server.close(r));}
