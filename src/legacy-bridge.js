/* Global compatibility bridge for the current Firebase app.
   app-v4.js references old() and saveClient(). Those identifiers must exist
   before the module runs. */
var old = window.old = function(){
  try{
    const raw=localStorage.getItem('ventek-design-tracker-v2');
    const data=raw?JSON.parse(raw):[];
    return Array.isArray(data)?data:[];
  }catch{return []}
};

var saveClient = window.saveClient = function(){
  try{
    const input=document.querySelector('#clientId');
    const value=(input?.value||'').trim();
    const settingsKey='ventek-design-settings-v2';
    let settings={};
    try{settings=JSON.parse(localStorage.getItem(settingsKey)||'{}')}catch{}
    settings.googleClientId=value;
    localStorage.setItem(settingsKey,JSON.stringify(settings));
    const toast=document.querySelector('.toast')||(()=>{const x=document.createElement('div');x.className='toast';document.body.appendChild(x);return x})();
    toast.textContent=value?'Đã lưu Google Drive OAuth Client ID':'Đã xóa Google Drive OAuth Client ID';
    toast.classList.add('show');setTimeout(()=>toast.classList.remove('show'),2500);
  }catch(e){console.error('saveClient failed',e)}
};

window.addEventListener('unhandledrejection',e=>{
  const err=e?.reason;
  const msg=String(err?.message||err||'Lỗi không xác định');
  const code=err?.code||'';
  if(!document.querySelector('#app'))return;
  if(document.querySelector('.fatal-auth-error'))return;
  const card=document.createElement('div');
  card.className='gate fatal-auth-error';
  card.innerHTML=`<div class="gate-card"><div class="gate-kicker">GP STATISTICAL</div><h1>Không thể mở hệ thống.</h1><p>${msg.replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]))}</p><div class="field-help" style="margin-top:12px">${code?'Mã lỗi: '+code:''}</div><div class="actions" style="justify-content:center;margin-top:18px"><button id="fatalRetry" class="btn primary">Thử lại</button></div></div>`;
  document.body.appendChild(card);
  card.querySelector('#fatalRetry')?.addEventListener('click',()=>location.reload());
  setTimeout(()=>card.remove(),15000);
});
