// Shared by the web and chrome.scripting. Keep this function self-contained.
export async function openAulaPictureInPicture(appUrl) {
  const api=window.documentPictureInPicture;
  if(!api)return {ok:false,error:'Aquest navegador no ofereix Picture-in-Picture de documents. Fes servir Chrome o Edge d’escriptori actualitzat.'};
  try{
    if(api.window&&!api.window.closed){api.window.focus();return {ok:true};}
    const pip=await api.requestWindow({width:580,height:740});
    pip.document.title='Àula · Sempre visible';
    const style=pip.document.createElement('style');style.textContent='html,body{margin:0;width:100%;height:100%;overflow:hidden}body{display:flex;flex-direction:column;font:12px system-ui}p{margin:0;padding:6px 10px;background:#172554;color:white}iframe{border:0;width:100%;flex:1;min-height:0}';pip.document.head.append(style);
    const hint=pip.document.createElement('p');hint.textContent='Àula · Sempre visible. Mantén oberta la pestanya d’origen.';
    const frame=pip.document.createElement('iframe');frame.title='Àula · Diari i seguiment';
    const url=new URL(appUrl);url.searchParams.set('floating','1');url.searchParams.set('pip-content','1');frame.src=url.href;
    pip.document.body.append(hint,frame);document.getElementById('aula-pip-activation')?.remove();
    return {ok:true};
  }catch(e){
    if(e.name==='NotAllowedError'){
      let panel=document.getElementById('aula-pip-activation');
      if(!panel){panel=document.createElement('div');panel.id='aula-pip-activation';panel.style.cssText='position:fixed;inset:12px 12px auto auto;z-index:2147483647;max-width:360px;padding:16px;background:#172554;color:white;border-radius:12px;box-shadow:0 8px 30px #0005;font:14px system-ui';
        const text=document.createElement('p');text.textContent='El navegador demana un clic aquí per activar Àula sempre visible.';
        const button=document.createElement('button');button.textContent='Activar finestra sempre visible';button.style.cssText='padding:10px;cursor:pointer';button.onclick=async()=>{const result=await openAulaPictureInPicture(appUrl);if(!result.ok)text.textContent=result.error;};
        const cancel=document.createElement('button');cancel.textContent='Cancel·lar';cancel.style.cssText='padding:10px;margin-left:8px;cursor:pointer';cancel.onclick=()=>panel.remove();panel.append(text,button,cancel);document.body.append(panel);
      }
      return {ok:false,needsClick:true,error:'Prem «Activar finestra sempre visible» a Àula.'};
    }
    return {ok:false,error:e.message||'No s’ha pogut activar la finestra sempre visible.'};
  }
}
