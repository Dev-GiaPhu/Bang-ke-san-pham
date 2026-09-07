const get=(id)=>document.getElementById(id);
function enhanceSettings(){
  document.querySelectorAll('settings-card').forEach(card=>{
    if(card.dataset.ready)return;
    card.dataset.ready='1';
    const title=card.getAttribute('title')||'Danh mục',input=card.getAttribute('input')||'',button=card.getAttribute('button')||'',placeholder=card.getAttribute('placeholder')||'';
    const children=card.innerHTML;
    card.innerHTML=`<div class="card-inner"><div class="section-head"><h2>${title}</h2></div><div class="filters"><input class="input" id="${input}" placeholder="${placeholder}"><button class="btn primary" id="${button}">Thêm</button></div><div class="pill-list">${children}</div></div>`;
  });
  const customer=get('customerFilter');
  if(customer){const f=stateSafeCustomer(); if(f)customer.value=f;}
}
function stateSafeCustomer(){try{return (window.__gpCustomerFilter||'')}catch{return''}}
const observer=new MutationObserver(()=>enhanceSettings());
observer.observe(document.body,{childList:true,subtree:true});
enhanceSettings();
