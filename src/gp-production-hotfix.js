(function(){
  const CLIENT_ID='763681707769-62cc0421i7fuvqo27vbh94e6ql5otuk1.apps.googleusercontent.com';
  const CACHE_PREFIX='gp-production-oauth:';
  const MIN_VALID_MS=15000;

  function scopeKey(scope){return String(scope||'').trim().split(/\s+/).filter(Boolean).sort().join(' ')}
  function read(scope){
    try{
      const x=JSON.parse(sessionStorage.getItem(CACHE_PREFIX+scopeKey(scope))||'null');
      if(x?.accessToken&&Number(x.expiresAt||0)>Date.now()+MIN_VALID_MS)return x.accessToken;
    }catch{}
    return null;
  }
  function save(scope,response){
    if(!response?.access_token)return;
    const expiresAt=Date.now()+Math.max(60,Number(response.expires_in||3600)-60)*1000;
    const key=scopeKey(scope);
    const value=JSON.stringify({accessToken:response.access_token,expiresAt});
    try{sessionStorage.setItem(CACHE_PREFIX+key,value)}catch{}
    if(key.includes('https://www.googleapis.com/auth/drive'))try{sessionStorage.setItem('gpDriveToken',response.access_token)}catch{}
  }

  function install(){
    const oauth=window.google?.accounts?.oauth2;
    if(!oauth?.initTokenClient)return false;
    if(oauth.initTokenClient.__gpProductionHotfix)return true;

    const original=oauth.initTokenClient.bind(oauth);
    function patched(config){
      const scope=String(config?.scope||'');
      const originalCallback=config?.callback;
      const wrappedConfig={
        ...config,
        client_id:CLIENT_ID,
        callback:function(response){
          save(scope,response);
          if(response?.access_token&&scope.includes('https://www.googleapis.com/auth/drive')){
            try{sessionStorage.setItem('gpDriveToken',response.access_token)}catch{}
          }
          return originalCallback?.(response);
        }
      };
      const client=original(wrappedConfig);
      if(client&&typeof client.requestAccessToken==='function'&&!client.requestAccessToken.__gpProductionHotfix){
        const request=client.requestAccessToken.bind(client);
        const patchedRequest=function(options){
          const opts=options||{};
          if(opts.prompt==='consent'||opts.prompt==='select_account')return request(opts);
          const token=read(scope);
          if(token){
            originalCallback?.({access_token:token,expires_in:3600,scope});
            return;
          }
          return request(opts);
        };
        patchedRequest.__gpProductionHotfix=true;
        client.requestAccessToken=patchedRequest;
      }
      return client;
    }
    patched.__gpProductionHotfix=true;
    oauth.initTokenClient=patched;
    window.__GP_PRODUCTION_OAUTH_HOTFIX__=true;
    return true;
  }

  let tries=0;
  const timer=setInterval(function(){
    if(install()||++tries>240)clearInterval(timer);
  },250);
  install();
})();
