// Opt-in diagnostics only. No financial values are retained by this module.
// Nested CPU spans and asynchronous wall spans must not be added together.
export function profileSync(name, action) {
  const observe=globalThis.__finizePerformance;
  if(typeof observe!=='function')return action();
  const start=performance.now();
  try{return action();}finally{try{observe(name,performance.now()-start);}catch{}}
}
export function profileStart(name) {
  const observe=globalThis.__finizePerformance;
  if(typeof observe!=='function')return ()=>{};
  const start=performance.now();
  return ()=>{try{observe(name,performance.now()-start);}catch{}};
}
export function profileCount(name, count=1) {
  try{globalThis.__finizePerformance?.(name,0,{count});}catch{}
}
