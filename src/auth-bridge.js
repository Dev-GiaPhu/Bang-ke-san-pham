/* GP Statistical — closes the timing gap between Google GIS and the main module. */
(function(){
  function sync(){
    if(window.__gpDriveToken){
      window.dispatchEvent(new Event('gp-drive-connected'));
      return true;
    }
    return false;
  }
  sync();
  let tries=0;
  const timer=setInterval(()=>{
    tries++;
    if(sync() || tries>60)clearInterval(timer);
  },500);
})();
