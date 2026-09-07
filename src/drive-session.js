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
    if(requesting||booted)return;
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
          /* Silent acquisition may fail with interaction_required. In that case
             stay signed out; never open Google's account picker automatically. */
        }
      });
    }

    requesting=true;
    try{
      /* Empty prompt reuses the existing Google grant without UI. */
      client.requestAccessToken({prompt:''});
    }catch(e){
      requesting=false;
    }
  }

  function start(){
    if(booted)return;
    boot();
    /* GIS is async. Keep trying briefly until it is available. */
    let attempts=0;
    const timer=setInterval(()=>{
      attempts++;
      if(booted || attempts>40){clearInterval(timer);return;}
      boot();
    },500);
  }

  /* Do NOT mark the OAuth refresher as booted merely because another script
     restored a cached access token. Cached tokens expire; GIS must still be
     allowed to silently obtain a fresh token on reload. */
  window.addEventListener('load',()=>setTimeout(start,150));
  start();
})();
