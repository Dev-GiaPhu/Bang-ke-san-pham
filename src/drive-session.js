/* GP Statistical — silently restore the existing Google Drive OAuth grant on every reload. */
(function(){
  const SETTINGS='ventek-design-settings-v2';
  const read=(k,d)=>{try{return JSON.parse(localStorage.getItem(k)||JSON.stringify(d))}catch{return d}};
  let started=false;
  function boot(){
    if(started)return;
    const clientId=read(SETTINGS,{}).googleClientId;
    if(!clientId||!window.google?.accounts?.oauth2?.initTokenClient)return;
    started=true;
    const client=google.accounts.oauth2.initTokenClient({client_id:clientId,scope:'https://www.googleapis.com/auth/drive.readonly',callback:r=>{if(r.error){started=false;return}window.__gpDriveToken=r.access_token;window.dispatchEvent(new Event('gp-drive-connected'))}});
    client.requestAccessToken({prompt:''});
  }
  const timer=setInterval(()=>{boot();if(started)clearInterval(timer)},300);
  window.addEventListener('load',()=>setTimeout(boot,500));
})();
