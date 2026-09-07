/* GP Statistical — compact, document-style summary */
(function(){
  const STORE='ventek-design-tracker-v2';
  const load=(k,d)=>{try{return JSON.parse(localStorage.getItem(k)||JSON.stringify(d))}catch{return d}};
  function active(){
    const records=load(STORE,[]),month=document.querySelector('#monthFilter')?.value||'',search=String(document.querySelector('#searchFilter')?.value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim(),customer=document.querySelector('#customerFilter')?.value||'';
    return records.filter(r=>{
      if(month&&r.month!==month)return false;if(customer&&r.customer!==customer)return false;
      if(search){const h=String(`${r.customer} ${r.productName} ${r.volume} ${r.size} ${r.designer} ${(r.editTypes||[]).join(' ')}`).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();if(!h.includes(search))return false}return true;
    });
  }
  function apply(){
    const grid=document.querySelector('.grid');if(!grid)return;
    const rows=active(),types=new Map();rows.forEach(r=>(r.editTypes||[]).forEach(t=>types.set(t,(types.get(t)||0)+1)));
    const parts=[...types.entries()].filter(([,n])=>n>0);
    grid.className='summary-card-wrap';
    grid.innerHTML=`<section class="summary-card"><div class="summary-main"><span>TỔNG SỐ SẢN PHẨM</span><strong>${rows.length}</strong></div>${parts.length?`<div class="summary-breakdown"><span>Trong đó</span>${parts.map(([name,n])=>`<div><b>${n}</b><span>${String(name).replace(/</g,'&lt;').replace(/>/g,'&gt;')}</span></div>`).join('')}</div>`:''}</section>`;
  }
  const style=document.createElement('style');style.textContent=`.summary-card-wrap{display:block;margin:18px 0}.summary-card{background:#fffdf8;border:1px solid #ddd8cd;border-radius:16px;padding:18px 22px;display:flex;align-items:center;gap:34px}.summary-main{min-width:190px;border-right:1px solid #ddd8cd;padding-right:34px}.summary-main span,.summary-breakdown>span{display:block;font-size:10px;font-weight:900;letter-spacing:.08em;color:#6f7784}.summary-main strong{display:block;margin-top:5px;font-size:36px;line-height:1;color:#142033}.summary-breakdown{display:flex;align-items:center;gap:18px;flex-wrap:wrap}.summary-breakdown>span{margin-right:0}.summary-breakdown>div{display:flex;align-items:baseline;gap:7px;padding-left:16px;border-left:1px solid #ddd8cd}.summary-breakdown b{font-size:20px;color:#142033}.summary-breakdown div span{font-size:11px;color:#6f7784;font-weight:700}@media(max-width:600px){.summary-card{align-items:flex-start;flex-direction:column;gap:14px}.summary-main{width:100%;border-right:0;border-bottom:1px solid #ddd8cd;padding:0 0 14px}.summary-breakdown{gap:12px}.summary-breakdown>div{padding-left:10px}}@media print{.summary-card{border:0;padding:0;margin:0 0 4mm}.summary-main{border:0;padding:0}.summary-breakdown{display:none}}`;document.head.appendChild(style);
  new MutationObserver(apply).observe(document.body,{childList:true,subtree:true});window.addEventListener('load',apply);setTimeout(apply,150);
})();
