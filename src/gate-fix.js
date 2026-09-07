/* GP Statistical — harden the unauthenticated gate layout. */
(function(){
  function fix(){
    const gate=document.querySelector('.gate');
    if(!gate)return;

    /* The product title already contains GP. Remove the decorative kicker/duplicate GP. */
    gate.querySelectorAll('.gate-kicker,.gate-logo,.gate-brand').forEach(el=>el.remove());

    const title=gate.querySelector('h1');
    if(title && /GP\s+Statistical/i.test(title.textContent||'')){
      gate.querySelectorAll('*').forEach(el=>{
        if(el===title || title.contains(el))return;
        if(el.children.length===0 && /^GP$/i.test((el.textContent||'').trim()))el.remove();
      });
    }

    /* Never allow the action button and explanatory copy to sit on the same line. */
    const button=gate.querySelector('button,.btn');
    if(button){
      button.style.display='flex';
      button.style.width='fit-content';
      button.style.maxWidth='100%';
      button.style.margin='0';
      let next=button.nextElementSibling;
      if(next){
        next.style.display='block';
        next.style.maxWidth='720px';
        next.style.marginTop='16px';
      }
    }

    gate.querySelectorAll('p,span').forEach(el=>{
      el.style.maxWidth='720px';
      el.style.whiteSpace='normal';
      el.style.overflowWrap='anywhere';
      el.style.wordBreak='normal';
    });
  }

  const observer=new MutationObserver(fix);
  observer.observe(document.documentElement,{childList:true,subtree:true});
  fix();
  window.addEventListener('load',()=>setTimeout(fix,50));
})();
