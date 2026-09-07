/* GP Statistical — harden the unauthenticated gate layout. */
(function(){
  function fix(){
    const gate=document.querySelector('.gate');
    if(!gate)return;

    /* The product title already contains GP. Remove decorative duplicate branding. */
    gate.querySelectorAll('.gate-kicker,.gate-logo,.gate-brand').forEach(el=>el.remove());

    const title=gate.querySelector('h1');
    if(title && /GP\s+Statistical/i.test(title.textContent||'')){
      gate.querySelectorAll('*').forEach(el=>{
        if(el===title || title.contains(el))return;
        if(el.children.length===0 && /^GP$/i.test((el.textContent||'').trim()))el.remove();
      });
    }

    const card=gate.querySelector('.gate-card')||gate.firstElementChild;
    if(card){
      /* If explanatory text was emitted as a raw text node beside the button,
         turn it into a block so it can never wrap around the button. */
      [...card.childNodes].forEach(node=>{
        if(node.nodeType!==Node.TEXT_NODE)return;
        const text=node.textContent.trim();
        if(!text)return;
        const copy=document.createElement('div');
        copy.className='gate-note gate-runtime-copy';
        copy.textContent=text;
        node.replaceWith(copy);
      });
    }

    const button=gate.querySelector('button,.btn');
    if(button){
      button.style.display='flex';
      button.style.width='fit-content';
      button.style.maxWidth='100%';
      button.style.margin='0';
    }

    gate.querySelectorAll('p,.gate-note,span').forEach(el=>{
      el.style.display='block';
      el.style.maxWidth='720px';
      el.style.whiteSpace='normal';
      el.style.overflowWrap='break-word';
      el.style.wordBreak='normal';
    });

    const copy=gate.querySelector('.gate-runtime-copy');
    if(copy)copy.style.marginTop='16px';
  }

  const observer=new MutationObserver(fix);
  observer.observe(document.documentElement,{childList:true,subtree:true});
  fix();
  window.addEventListener('load',()=>setTimeout(fix,50));
})();
