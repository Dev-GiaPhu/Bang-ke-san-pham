/* GP Statistical — automatically restore an existing Google Drive grant on every page load. */
(function(){
  const SETTINGS='ventek-design-settings-v2';
  const read=(k,d)=>{try{return JSON.parse(localStorage.getItem(k)||JSON.stringify(d))}catch{return d}};
  let patched=false,success=false,booting=false;

  function hasGoogleGrant(){
    return !!read(SETTINGS,{}).googleClientId;
  }

  function patchGIS(){
    if(patched)return true;
    if(!window.google?.accounts?.oauth2?.initTokenClient)return false;
    const oauth=window.google.accounts.oauth2;
    const original=oauth.initTokenClient.bind(oauth);
    oauth.initTokenClient=function(config){
      const client=original(config);
      const request=client.requestAccessToken.bind(client);
      client.requestAccessToken=function(options={}){
        if(window.__gpSilentDriveBoot) options={...options,prompt:''};
        return request(options);
      };
      return client;
    };
    patched=true;
    return true;
  }

  function tryAutoConnect(){
    if(success||booting||!hasGoogleGrant()||!patchGIS())return;
    const btn=document.querySelector('#driveConnect');
    if(!btn)return;
    booting=true;
    window.__gpSilentDriveBoot=true;
    btn.dataset.gpAutoConnecting='1';
    btn.click();
    setTimeout(()=>{
      window.__gpSilentDriveBoot=false;
      booting=false;
    },8000);
  }

  function watch(){
    tryAutoConnect();
    if(success)clearInterval(timer);
  }

  const observer=new MutationObserver(watch);
  observer.observe(document.documentElement,{childList:true,subtree:true});
  const timer=setInterval(watch,500);
  window.addEventListener('load',()=>setTimeout(watch,500));
})();
