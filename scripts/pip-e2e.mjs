// Isolated Chromium profile; synthetic pupils only. No real repository/user data.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile,mkdtemp,rm,cp,writeFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {getInitialState} from '../src/initialState.ts';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const profile=await mkdtemp(path.join(tmpdir(),'aula-extension-'));
const types={'.js':'text/javascript','.css':'text/css','.html':'text/html','.svg':'image/svg+xml','.png':'image/png','.woff2':'font/woff2'};
const server=createServer(async(req,res)=>{
 const relative=new URL(req.url,'http://localhost').pathname.slice('/dev_gestorclasses_2627/'.length)||'index.html';
 const filename=path.resolve('dist',relative);
 if(!req.url.startsWith('/dev_gestorclasses_2627/')||!filename.startsWith(path.resolve('dist')+path.sep)){res.writeHead(404);res.end();return;}
 try{res.setHeader('Content-Type',types[path.extname(filename)]||'application/octet-stream');res.end(await readFile(filename));}catch{res.writeHead(404);res.end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin=`http://127.0.0.1:${server.address().port}`,APP=origin+'/dev_gestorclasses_2627/';
// Only the deployment origin is substituted in an isolated test copy. All extension and app code is real.
const extension=path.join(profile,'extension');await cp(path.resolve('EXTENSIO_DESCARREGABLE'),extension,{recursive:true});
for(const file of ['manifest.json','service-worker.js']){const filename=path.join(extension,file);await writeFile(filename,(await readFile(filename,'utf8')).replaceAll('https://aagust11.github.io',origin));}
const context=await chromium.launchPersistentContext(path.join(profile,'browser'),{channel:'chromium',headless:false,args:[`--disable-extensions-except=${extension}`,`--load-extension=${extension}`]});


try{
 const state=getInitialState();state.subjects=[{id:'s',name:'Classe de prova',color:'#123456',students:[{id:'u',name:'Alumne Prova'}]}];state.studentRegistry={u:state.subjects[0].students[0]};state.schedule=[];state.sessionLogs=[];state.activities=[];state.criteria=[];state.competencies=[];
 await context.addInitScript(({state,origin})=>{if(location.origin===origin&&!localStorage.getItem('gestor_classes_app_state'))localStorage.setItem('gestor_classes_app_state',JSON.stringify(state));},{state,origin});
 const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker'),id=new URL(worker.url()).host;
 const popup=await context.newPage();await popup.goto(`chrome-extension://${id}/popup.html`);
 await popup.getByRole('button',{name:'Finestra flotant · Sempre visible',exact:true}).click();
 let owner;for(let i=0;i<200&&!owner;i++){owner=context.pages().find(p=>p.url().startsWith(APP));if(!owner)await new Promise(r=>setTimeout(r,100));}assert.ok(owner);
 await owner.waitForFunction(()=>window.documentPictureInPicture?.window||document.getElementById('aula-pip-activation'),{timeout:20000});
 if(await owner.locator('#aula-pip-activation').count()){console.log('Browser requested an additional activation click');await owner.getByRole('button',{name:'Activar finestra sempre visible',exact:true}).click();}
 await owner.waitForFunction(()=>window.documentPictureInPicture?.window?.document.querySelector('iframe')?.contentDocument?.querySelector('#nav-item-qualificacions'));
 assert.equal(await owner.evaluate(()=>window.documentPictureInPicture.window.closed),false);
 // Real PiP stays open when another tab is focused.
 const other=await context.newPage();await other.goto('about:blank');await other.bringToFront();
 assert.equal(await owner.evaluate(()=>!!window.documentPictureInPicture.window&&!window.documentPictureInPicture.window.closed),true);
 await owner.evaluate(()=>window.documentPictureInPicture.window.document.querySelector('iframe').contentDocument.querySelector('#nav-item-qualificacions').click());
 await owner.waitForFunction(()=>window.documentPictureInPicture.window.document.querySelector('iframe').contentDocument.querySelector('textarea[placeholder^="Valoració global del grup"]'));
 await owner.evaluate(()=>{const frame=window.documentPictureInPicture.window.document.querySelector('iframe'),input=frame.contentDocument.querySelector('textarea[placeholder^="Valoració global del grup"]');Object.getOwnPropertyDescriptor(frame.contentWindow.HTMLTextAreaElement.prototype,'value').set.call(input,'Desat des de PiP');input.dispatchEvent(new frame.contentWindow.Event('input',{bubbles:true}));});
 await owner.waitForFunction(()=>JSON.stringify(JSON.parse(localStorage.getItem('gestor_classes_app_state')).groupPeriodComments).includes('Desat des de PiP'));
 await owner.evaluate(()=>window.documentPictureInPicture.window.close());await owner.locator('#nav-item-qualificacions').click();
 await owner.getByRole('textbox',{name:/Comentari del grup/}).waitFor();assert.equal(await owner.getByRole('textbox',{name:/Comentari del grup/}).inputValue(),'Desat des de PiP');
 // Web button uses the same native API, without the extension.
 await owner.locator('#open-pip-window').click();await owner.waitForFunction(()=>!!window.documentPictureInPicture.window);await owner.evaluate(()=>window.documentPictureInPicture.window.close());
 console.log('PASS: real document Picture-in-Picture, extension activation, tab switching, shared saving, close and web reopening.');
}catch(e){for(const p of context.pages())console.error(p.url(),await p.locator('body').innerText().catch(()=>''));throw e;}finally{await context.close();await new Promise(r=>server.close(r));await rm(profile,{recursive:true,force:true});}
