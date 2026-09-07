(function(){
  let lastHash=location.hash;
  window.addEventListener('hashchange',()=>{
    if(location.hash===lastHash)return;
    lastHash=location.hash;
    // Reboot the correct mode when navigating back/forward between the
    // management page and a #share= snapshot in the same document.
    location.reload();
  });
})();
