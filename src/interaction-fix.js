(function(){
  function bindDashboardActions(){
    document.querySelectorAll('.recent [data-edit],.recent [data-delete]').forEach(btn=>{
      if(btn.dataset.interactionFix==='1')return;
      btn.dataset.interactionFix='1';
      btn.addEventListener('click',function(e){
        e.preventDefault();
        e.stopImmediatePropagation();
        const id=this.dataset.edit||this.dataset.delete;
        document.querySelector('[data-view="list"]')?.click();
        setTimeout(()=>document.querySelector(`[data-${this.dataset.edit?'edit':'delete'}="${CSS.escape(id)}"]`)?.click(),50);
      },true);
    });
  }

  function bindSearch(){
    const input=document.querySelector('#searchFilter');
    if(!input||input.dataset.searchFix==='1')return;
    input.dataset.searchFix='1';
    let timer=0;
    let composing=false;
    input.addEventListener('compositionstart',()=>{composing=true;clearTimeout(timer)},true);
    input.addEventListener('compositionend',()=>{composing=false},true);
    input.addEventListener('input',e=>{
      if(e.__gpSearchSynthetic)return;
      e.stopImmediatePropagation();
      if(composing||e.isComposing)return;
      clearTimeout(timer);
      timer=setTimeout(()=>{
        const start=input.selectionStart,end=input.selectionEnd;
        const evt=new Event('input',{bubbles:true});
        Object.defineProperty(evt,'__gpSearchSynthetic',{value:true});
        input.dispatchEvent(evt);
        const next=document.querySelector('#searchFilter');
        if(next){next.focus();try{next.setSelectionRange(start,end)}catch{}}
      },250);
    },true);
    input.addEventListener('keydown',e=>{
      if(e.key!=='Enter')return;
      e.preventDefault();
      clearTimeout(timer);
      const start=input.selectionStart,end=input.selectionEnd;
      const evt=new Event('input',{bubbles:true});
      Object.defineProperty(evt,'__gpSearchSynthetic',{value:true});
      input.dispatchEvent(evt);
      const next=document.querySelector('#searchFilter');
      if(next){next.focus();try{next.setSelectionRange(start,end)}catch{}}
    },true);
  }

  function bind(){bindDashboardActions();bindSearch()}
  new MutationObserver(bind).observe(document.body,{childList:true,subtree:true});
  window.addEventListener('load',bind);
  setTimeout(bind,50);
})();
