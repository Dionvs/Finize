window.__finizeEarlyErrors=[];
window.addEventListener('error',event=>{
  window.__finizeEarlyErrors.push({type:'error',message:String(event.message||''),filename:String(event.filename||''),line:Number(event.lineno||0),column:Number(event.colno||0),stack:String(event.error?.stack||'')});
  console.error('Finize kon niet volledig starten:',event.message,event.filename?`${event.filename}:${event.lineno||0}`:'');
});
window.addEventListener('unhandledrejection',event=>{
  window.__finizeEarlyErrors.push({type:'rejection',message:String(event.reason?.message||event.reason||''),stack:String(event.reason?.stack||'')});
  console.error('Finize kon een achtergrondtaak niet afronden:',event.reason?.message||String(event.reason||'Onbekende fout'));
});
