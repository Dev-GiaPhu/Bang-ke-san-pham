/* GP Statistical — restore an already-authorized Google Drive grant silently on reload. */
(function(){
  const SETTINGS='ventek-design-settings-v2';
  const SCOPE='https://www.googleapis.com/auth/drive.readonly';
  const read=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key)||JSON.stringify(fallback))}catch{return fallback}};
  let client=null;
  let requesting=false;
  let booted=false;

  function emitToken(token){
    if(!token)return;
    window.__gpDriveToken=token;
    window.__gpDriveAuthenticatedAt=Date.now();
    window.dispatchEvent(new Event('gp-drive-connected'));
  }

  function boot(){
    if(requesting)return;
    const settings=read(SETTINGS,{});
    const clientId=String(settings.googleClientId||'').trim();
    if(!clientId || !window.google?.accounts?.oauth2?.initTokenClient)return;

    if(!client){
      client=google.accounts.oauth2.initTokenClient({
        client_id:clientId,
        scope:SCOPE,
        include_granted_scopes:true,
        callback:response=>{
          requesting=false;
          if(response?.access_token){
            booted=true;
            emitToken(response.access_token);
          }
          // A silent request can legitimately fail with interaction_required.
          // Never open Google's account picker/login automatically on reload.
        }
      });
    }

    requesting=true;
    try{
      // Empty prompt = reuse the existing Google grant without showing a login/consent UI.
      client.requestAccessToken({prompt:''});
    }catch(e){
      requesting=false;
    }
  }

  function start(){
    if(booted)return;
    boot();
    // GIS is async. Keep trying briefly until it is available.
    let attempts=0;
    const timer=setInterval(()=>{
      attempts++;
      if(booted || attempts>40){clearInterval(timer);return;}
      boot();
    },500);
  }

  // main.js is a module and may initialize after this classic script.
  window.addEventListener('gp-drive-connected',()=>{booted=true});
  window.addEventListener('load',()=>setTimeout(start,150));
  start();
})();
