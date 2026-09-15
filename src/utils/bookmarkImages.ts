export const MAX_ICON_BYTES=2*1024*1024;
export function validBookmarkImage(value:unknown):boolean{
 return typeof value==='string'&&value.length<=100000&&/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(value);
}
export async function compactBookmarkImage(blob:Blob):Promise<string>{
 if(blob.size>MAX_ICON_BYTES)throw Error('La imatge pot ocupar com a màxim 2 MB.');
 if(!['image/png','image/jpeg','image/webp'].includes(blob.type.toLowerCase()))throw Error('Selecciona una imatge PNG, JPG o WebP.');
 const url=URL.createObjectURL(blob);
 try{
 const img=new Image();
 await new Promise<void>((resolve,reject)=>{img.onload=()=>resolve();img.onerror=()=>reject(Error('No es pot llegir aquesta imatge.'));img.src=url;});
 if(!img.naturalWidth||!img.naturalHeight)throw Error('La imatge és buida.');
 const scale=Math.min(1,128/img.naturalWidth,128/img.naturalHeight);
 const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));
 const ctx=canvas.getContext('2d');if(!ctx)throw Error('No es pot preparar la imatge.');
 ctx.drawImage(img,0,0,canvas.width,canvas.height);
 const result=canvas.toDataURL('image/png');if(!validBookmarkImage(result))throw Error('La icona encara és massa gran. Prova una imatge més senzilla.');
 return result;
 }finally{URL.revokeObjectURL(url);}
}
export async function importBookmarkImageUrl(raw:string):Promise<string>{
 let url:URL;try{url=new URL(raw);}catch{throw Error('Enganxa la URL directa de la imatge.');}
 if(!['https:','http:'].includes(url.protocol)||url.username||url.password)throw Error('La imatge ha de tenir una URL HTTP o HTTPS.');
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
 try{
 const response=await fetch(url.href,{signal:controller.signal,credentials:'omit',referrerPolicy:'no-referrer'});
 if(!response.ok||!response.body)throw Error('No s’ha pogut descarregar la imatge.');
 const reader=response.body.getReader(),chunks:Uint8Array[]=[];let size=0;
 while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>MAX_ICON_BYTES){await reader.cancel();throw Error('La imatge supera els 2 MB.');}chunks.push(value);}
 return await compactBookmarkImage(new Blob(chunks,{type:(response.headers.get('content-type')||'').split(';')[0]}));
 }catch(e){throw Error((e instanceof Error?e.message:'No es pot carregar la imatge.')+' Si el lloc no permet importar-la, descarrega-la i utilitza «Pujar imatge».');}
 finally{clearTimeout(timer);}
}
