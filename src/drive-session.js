/* GP Statistical — restore an existing Google Drive grant without asking for consent again. */
(function(){
  const SETTINGS='ventek-design-settings-v2',STORE='ventek-design-tracker-v2';
  const read=(k,d)=>{try{return JSON.parse(localStorage.getItem(k)||JSON.stringify(d))}catch{return d}};
  let patched=false,started=false;
  function patchGIS(){
    if(patched||!window.google?.accounts?.oauth2?.initTokenClient)return false;
    const oauth=window.google.accounts.oauth2, original=oauth.initTokenClient.bind(oauth);
    oauth.initTokenClient=function(config){
      const client=original(config), request=client.requestAccessToken.bind(client);
      client.requestAccessToken=function(options={}){
        if(window.__gpSilentDriveBoot) options={...options,prompt:''};
        return request(options);
      };
      return client;
    };
    patched=true;
    return true;
  }
  function shouldRestore(){
    const s=read(SETTINGS,{}),records=read(STORE,[]);
    return !!s.googleClientId && Array.isArray(records) && records.some(r=>r.driveRootFolderId||r.driveFolderUrl||r.driveRootFolderUrl);
  }
  function boot(){
    if(started||!shouldRestore())return;
    if(!patchGIS())return;
    const btn=document.querySelector('#driveConnect');
    if(!btn||btn.dataset.gpAutoConnected)return;
    btn.dataset.gpAutoConnected='1';
    window.__gpSilentDriveBoot=true;
    btn.click();
    setTimeout(()=>{window.__gpSilentDriveBoot=false},15000);
    started=true;
  }
  const observer=new MutationObserver(boot);
  observer.observe(document.documentElement,{childList:true,subtree:true});
  const timer=setInterval(()=>{boot();if(started)clearInterval(timer)},500);
  window.addEventListener('load',()=>setTimeout(boot,300));
})();
