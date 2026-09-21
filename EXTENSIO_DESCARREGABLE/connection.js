// The port is a lifecycle signal only. No pupil data or persistent copies.
let port,timer,closed=false;
function connect(){
  if(closed)return;
  port=chrome.runtime.connect({name:'aula-ui-session'});
  clearInterval(timer);timer=setInterval(()=>{try{port.postMessage({keepAlive:true});}catch{}},20000);
  port.onDisconnect.addListener(()=>{clearInterval(timer);if(!closed)setTimeout(connect,1000);});
}
connect();
window.addEventListener('pagehide',()=>{closed=true;clearInterval(timer);port?.disconnect();});
