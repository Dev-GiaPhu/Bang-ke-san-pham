/* GP Statistical — bridge restored session to main.js after module initialization. */
(function(){
  const TOKEN_KEY='gp-statistical-session-token',SESSION_KEY='gp-statistical-session-active';
  function restore(){
    if(localStorage.getItem(SESSION_KEY)!=='1')return;
    let saved=null;try{saved=JSON.parse(localStorage.getItem(TOKEN_KEY)||'null')}catch{}
    if(!saved?.token)return;
    window.__gpDriveToken=saved.token;
    window.__gpDriveAuthenticatedAt=saved.savedAt||Date.now();
    window.dispatchEvent(new Event('gp-drive-connected'));
  }
  /* main.js is an ES module and can finish after runtime-fix.js. Re-emit the
     restored session after it has installed its listener, without showing OAuth UI. */
  window.addEventListener('load',()=>{
    [100,350,800,1500].forEach(ms=>setTimeout(restore,ms));
  });
  [250,750,1250].forEach(ms=>setTimeout(restore,ms));
})();
