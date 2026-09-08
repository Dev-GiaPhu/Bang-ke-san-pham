(function(){
  const CLIENT_ID='763681707769-62cc0421i7fuvqo27vbh94e6ql5otuk1.apps.googleusercontent.com';
  let installed=false;
  function install(){
    if(installed||!window.google?.accounts?.oauth2?.initTokenClient)return false;
    const oauth=window.google.accounts.oauth2;
    const original=oauth.initTokenClient.bind(oauth);
    oauth.initTokenClient=function(config){
      return original({...config,client_id:CLIENT_ID});
    };
    installed=true;
    window.__GP_OAUTH_CLIENT_ID__=CLIENT_ID;
    return true;
  }
  if(!install()){
    let tries=0;
    const timer=setInterval(()=>{if(install()||++tries>120)clearInterval(timer)},250);
  }
})();
