(function(){
  if(window.__GP_EXPORT_PROGRESS_UI__)return;
  window.__GP_EXPORT_PROGRESS_UI__=true;
  let timer=null;
  function ensure(){
    let el=document.getElementById('__gp_export_progress');
    if(el)return el;
    el=document.createElement('div');
    el.id='__gp_export_progress';
    el.innerHTML='<span class="gp-export-spinner" aria-hidden="true"></span><span class="gp-export-message"></span>';
    Object.assign(el.style,{position:'fixed',left:'50%',top:'22px',transform:'translateX(-50%)',zIndex:'2147483647',display:'none',alignItems:'center',gap:'10px',padding:'11px 16px',borderRadius:'12px',background:'#132238',color:'#fff',font:'600 14px/1.2 Arial,sans-serif',boxShadow:'0 10px 28px rgba(0,0,0,.18)',pointerEvents:'none',whiteSpace:'nowrap'});
    const style=document.createElement('style');
    style.textContent='#__gp_export_progress .gp-export-spinner{width:16px;height:16px;border:2px solid rgba(255,255,255,.35);border-top-color:#fff;border-radius:50%;animation:gpExportSpin .8s linear infinite}@keyframes gpExportSpin{to{transform:rotate(360deg)}}';
    document.head.appendChild(style);document.body.appendChild(el);return el;
  }
  function show(message){const el=ensure();el.querySelector('.gp-export-message').textContent=message;el.style.display='flex';clearTimeout(timer);timer=setTimeout(hide,90000);}
  function hide(){clearTimeout(timer);timer=null;document.getElementById('__gp_export_progress')?.remove();}
  document.addEventListener('click',function(e){
    const b=e.target.closest?.('[data-export="pdf"],[data-public-export="pdf"],[data-export="xlsx"],[data-public-export="xlsx"]');
    if(!b)return;
    const type=b.dataset.export||b.dataset.publicExport||'';
    show(type==='pdf'?'Đang chuẩn bị bản in A4…':'Đang tạo file Excel…');
  },true);
  const originalAnchorClick=HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click=function(){
    try{if(this.download)hide();}catch{}
    return originalAnchorClick.call(this);
  };
  window.addEventListener('afterprint',hide);
  window.addEventListener('pagehide',hide);
  window.__GP_EXPORT_PROGRESS_SHOW__=show;
  window.__GP_EXPORT_PROGRESS_HIDE__=hide;
})();
