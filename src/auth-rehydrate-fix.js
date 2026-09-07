/* GP Statistical — bridge the cached session to main.js once after modules initialize. */
(function(){
  const TOKEN_KEY='gp-statistical-session-token',SESSION_KEY='gp-statistical-session-active';
  let done=false;
  function restoreOnce(){
    if(done||localStorage.getItem(SESSION_KEY)!=='1')return;
    let saved=null;
    try{saved=JSON.parse(localStorage.getItem(TOKEN_KEY)||'null')}catch{}
    if(!saved?.token)return;
    done=true;
    window.__gpDriveToken=saved.token;
    window.__gpDriveAuthenticatedAt=saved.savedAt||Date.now();
    window.dispatchEvent(new Event('gp-drive-connected'));
  }
  /* main.js is an ES module. Re-emit the cached session only once after the
     module has had time to install its listener. Never keep re-injecting an
     expired token after main.js has received a 401. */
  window.addEventListener('load',()=>setTimeout(restoreOnce,300));
  setTimeout(restoreOnce,600);
})();
