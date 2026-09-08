/* GP Statistical — stable client-side session bridge.
   IMPORTANT: never start OAuth automatically on page load. A static GitHub Pages
   app cannot keep a Google refresh token securely in the browser. We restore
   only the last access token while it is still plausibly valid, then require
   the user's explicit click once it expires. */
(function(){
  const TOKEN_KEY='gp-statistical-session-token';
  const SESSION_KEY='gp-statistical-session-active';
  const MAX_AGE=50*60*1000;
  const read=(k,d)=>{try{return JSON.parse(localStorage.getItem(k)||JSON.stringify(d))}catch{return d}};
  const clear=()=>{localStorage.removeItem(TOKEN_KEY);localStorage.removeItem(SESSION_KEY);window.__gpDriveToken='';window.__gpDriveAuthenticatedAt=0};
  function restore(){
    if(localStorage.getItem(SESSION_KEY)!=='1')return false;
    const saved=read(TOKEN_KEY,null);
    if(!saved?.token){clear();return false}
    const age=Date.now()-Number(saved.savedAt||0);
    if(saved.savedAt && (age<0 || age>MAX_AGE)){clear();return false}
    window.__gpDriveToken=saved.token;
    window.__gpDriveAuthenticatedAt=saved.savedAt||Date.now();
    window.dispatchEvent(new Event('gp-drive-connected'));
    return true;
  }
  function patchGIS(){
    const oauth=window.google?.accounts?.oauth2;
    if(!oauth?.initTokenClient || oauth.__gpStableWrapped)return;
    const original=oauth.initTokenClient;
    oauth.initTokenClient=function(options){
      const cb=options?.callback;
      return original.call(this,{...options,callback:r=>{if(r?.access_token){localStorage.setItem(TOKEN_KEY,JSON.stringify({token:r.access_token,savedAt:Date.now()}));localStorage.setItem(SESSION_KEY,'1');window.__gpDriveToken=r.access_token;window.__gpDriveAuthenticatedAt=Date.now()}cb?.(r)}})
    };
    oauth.__gpStableWrapped=true;
  }
  window.addEventListener('gp-drive-logout',clear);
  /* The existing runtime layer can still provide the visual UI and wraps GIS.
     We do not call requestAccessToken() here, so reload can never open a Google
     login/consent tab by itself. */
  restore();
  patchGIS();
  let n=0;const timer=setInterval(()=>{patchGIS();if(++n>40)clearInterval(timer)},250);
  const start=()=>setTimeout(()=>{patchGIS();restore()},120);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
