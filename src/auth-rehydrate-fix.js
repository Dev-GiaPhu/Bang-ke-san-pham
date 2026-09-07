/* GP Statistical — reliably bridge a still-active session to main.js after reload. */
(function(){
  const TOKEN_KEY='gp-statistical-session-token',SESSION_KEY='gp-statistical-session-active';
  const MAX_CACHED_AGE=50*60*1000;
  function read(){try{return JSON.parse(localStorage.getItem(TOKEN_KEY)||'null')}catch{return null}}
  function restore(){
    if(localStorage.getItem(SESSION_KEY)!=='1')return false;
    const saved=read();
    if(!saved?.token)return false;
    const age=Date.now()-Number(saved.savedAt||0);
    /* Never resurrect an access token that is old enough to be expired. GIS
       must silently obtain a fresh token in that case. */
    if(saved.savedAt && age>MAX_CACHED_AGE)return false;
    window.__gpDriveToken=saved.token;
    window.__gpDriveAuthenticatedAt=saved.savedAt||Date.now();
    window.dispatchEvent(new Event('gp-drive-connected'));
    return true;
  }
  /* main.js is an ES module and can finish after the classic scripts. Bridge
     the cached session several times during startup so the event cannot be
     lost, but stop after startup and never keep injecting an expired token. */
  const times=[100,300,600,1000,1600,2400];
  times.forEach(ms=>setTimeout(restore,ms));
  window.addEventListener('load',()=>times.forEach(ms=>setTimeout(restore,ms)));
})();
