const views=new Set(['horari','classes','alumnat','activitats','qualificacions','rendiment','planols','configuracio','dades']);
export function floatingView(search:string){const value=new URLSearchParams(search).get('view');return value&&views.has(value)?value:'horari';}
export function openFloatingWindow(view:string){
 if(new URLSearchParams(window.location.search).get('floating')==='1'){window.focus();return true;}
 const url=new URL(window.location.href);url.search='';url.hash='';url.searchParams.set('floating','1');url.searchParams.set('view',views.has(view)?view:'horari');
 const width=Math.min(1000,window.screen.availWidth),height=Math.min(780,window.screen.availHeight);
 const popup=window.open('','aula-floating',`popup=yes,width=${width},height=${height},resizable=yes,scrollbars=yes`);
 if(!popup)return false;
 try{if(new URL(popup.location.href).searchParams.get('floating')!=='1')popup.location.replace(url.href);}catch{popup.location.replace(url.href);}
 popup.focus();return true;
}
