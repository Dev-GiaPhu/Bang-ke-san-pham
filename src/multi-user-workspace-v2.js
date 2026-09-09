(function(){
  if(window.__GP_MULTI_USER_WORKSPACE_V2__)return;
  window.__GP_MULTI_USER_WORKSPACE_V2__=true;
  const FIREBASE='https://www.gstatic.com/firebasejs/12.18.0/';
  const CENTRAL='gp-statistical';
  let auth=null,db=null,mod=null;

  function getOverlay(){return document.getElementById('gp-multi-user-app')}
  function addStyle(){if(document.getElementById('gp-mw-v2-style'))return;const s=document.createElement('style');s.id='gp-mw-v2-style';s.textContent=`
    #gp-multi-user-app .gp-mw-card.table-card{overflow:hidden}
    #gp-multi-user-app .gp-mw-modal{position:fixed;inset:0;z-index:2147483600}
    #gp-multi-user-app .gp-mw-modal-backdrop{position:absolute;inset:0;background:rgba(19,34,56,.48);display:grid;place-items:center;padding:20px}
    #gp-multi-user-app .gp-mw-modal-card{width:min(760px,96vw);max-height:92vh;overflow:auto;background:#fff;border-radius:18px;padding:22px;box-shadow:0 24px 70px rgba(0,0,0,.22)}
    #gp-multi-user-app .gp-mw-modal-card header,#gp-multi-user-app .gp-mw-modal-card footer{display:flex;align-items:center;justify-content:space-between;gap:12px}
    #gp-multi-user-app .gp-mw-modal-card header{margin-bottom:18px}
    #gp-multi-user-app .gp-mw-modal-card h2{margin:0 0 5px}
    #gp-multi-user-app .gp-mw-modal-card p{margin:0;color:#697586;line-height:1.5}
    #gp-multi-user-app .gp-mw-modal-card button{border:1px solid #d5cfc6;background:#fff;padding:9px 13px;border-radius:9px;cursor:pointer}
    #gp-multi-user-app .gp-mw-modal-card footer button:last-child{background:#f36b3c;color:#fff;border-color:#f36b3c;font-weight:700}
    #gp-multi-user-app .gp-mw-form{display:grid;grid-template-columns:1fr 1fr;gap:14px}
    #gp-multi-user-app .gp-mw-form label{display:grid;gap:6px;color:#384354;font-size:13px;font-weight:700}
    #gp-multi-user-app .gp-mw-form input,#gp-multi-user-app .gp-mw-form textarea{width:100%;box-sizing:border-box;border:1px solid #d7d2c9;border-radius:10px;padding:10px 11px;font:inherit;font-weight:400}
    #gp-multi-user-app .gp-mw-form textarea{min-height:90px;resize:vertical}
    #gp-multi-user-app .mw-work{grid-column:1/-1;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
    #gp-multi-user-app .mw-work>span{grid-column:1/-1;color:#384354;font-size:13px;font-weight:700}
    #gp-multi-user-app .mw-work label{display:flex;align-items:center;gap:7px;border:1px solid #e4ded6;border-radius:9px;padding:9px;font-weight:500}
    #gp-multi-user-app .mw-other{grid-column:1/-1}
    #gp-multi-user-app .gp-mw-stat-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;margin-top:18px}
    #gp-multi-user-app .gp-mw-stat-panel{border:1px solid #ded8cf;border-radius:16px;background:#fff;padding:18px}
    #gp-multi-user-app .gp-mw-stat-panel h3{margin:0 0 14px;font-size:15px}
    #gp-multi-user-app .gp-mw-stat-line{display:grid;grid-template-columns:minmax(100px,1fr) minmax(80px,2fr) 40px;gap:8px;align-items:center;margin:10px 0;font-size:12px}
    #gp-multi-user-app .gp-mw-stat-track{height:8px;background:#ece7df;border-radius:99px;overflow:hidden}.gp-mw-stat-track i{display:block;height:100%;background:#f36b3c;border-radius:99px}
    @media(max-width:640px){#gp-multi-user-app .gp-mw-form{grid-template-columns:1fr}.gp-mw-work{grid-template-columns:1fr 1fr!important}.gp-mw-stat-grid{grid-template-columns:1fr}}
  `;document.head.appendChild(s)}

  async function init(){
    const [A,U,F]=await Promise.all([import(FIREBASE+'firebase-app.js'),import(FIREBASE+'firebase-auth.js'),import(FIREBASE+'firebase-firestore.js')]);
    mod={...A,...U,...F};const app=mod.getApps()[0]||mod.initializeApp({apiKey:'AIzaSyCVY90upeKcuR5u8VPzqNmI-TFe2CDSL14',authDomain:'gp-statistical.firebaseapp.com',projectId:'gp-statistical',storageBucket:'gp-statistical.firebasestorage.app',messagingSenderId:'870570090818',appId:'1:870570090818:web:0a140685c61b3ec95ea8db'});auth=mod.getAuth(app);db=mod.getFirestore(app);addStyle();watch();}

  function watch(){const mo=new MutationObserver(()=>{const o=getOverlay();if(!o)return;const personal=o.querySelector('.gp-mw-table-wrap');if(personal&&!personal.closest('.table-card')){personal.closest('.gp-mw-card')?.classList.add('table-card')}decorate();});mo.observe(document.body,{subtree:true,childList:true});setInterval(decorate,1200);}

  function decorate(){const o=getOverlay();if(!o||o.classList.contains('gp-mw-hidden'))return;const nav=o.querySelector('nav');if(nav&&!nav.querySelector('[data-gp-mw-tab="stats"]')){const b=document.createElement('button');b.dataset.gpMwTab='stats';b.innerHTML='◒ <span>Thống kê</span>';nav.appendChild(b);b.onclick=()=>{window.__GP_MW_TAB__='stats';renderStats()}};if(window.__GP_MW_TAB__==='stats')renderStats();}

  function currentPersonalRows(){const o=getOverlay();const rows=o?.querySelectorAll('tbody tr')||[];return [...rows].map(tr=>{const cells=[...tr.cells];return{customer:(cells[2]?.innerText||'').trim(),product:(cells[3]?.innerText||'').trim(),qty:Number((cells[6]?.innerText||'').replace(/[^0-9.-]/g,''))||0,designer:(cells[7]?.innerText||'').trim(),work:(cells[8]?.innerText||'').trim()}}).filter(r=>r.product)}
  function renderStats(){const o=getOverlay();if(!o)return;const existing=o.querySelector('.gp-mw-stats-page');if(existing)existing.remove();const rows=currentPersonalRows();const by=field=>{const m={};rows.forEach(r=>{const key=r[field];if(key)m[key]=(m[key]||0)+1});return Object.entries(m).sort((a,b)=>b[1]-a[1]).slice(0,12)};const max=n=>Math.max(1,...n.map(x=>x[1]));const panel=(title,data)=>`<section class="gp-mw-stat-panel"><h3>${title}</h3>${data.length?data.map(([k,n])=>`<div class="gp-mw-stat-line"><span>${esc(k)}</span><div class="gp-mw-stat-track"><i style="width:${Math.max(6,n*100/max(data))}%"></i></div><b>${n}</b></div>`).join(''):'<div class="empty">Chưa có dữ liệu.</div>'}</section>`;const wrap=document.createElement('div');wrap.className='gp-mw-stats-page';wrap.innerHTML=`<div class="gp-mw-card" style="padding:20px"><h2 style="margin:0">Thống kê bảng kê của tôi</h2><p style="margin:6px 0 0;color:#697586">Tổng ${rows.length} sản phẩm · ${rows.reduce((s,r)=>s+r.qty,0)} sản phẩm theo số lượng.</p><div class="gp-mw-stat-grid">${panel('Theo khách hàng',by('customer'))}${panel('Theo người thực hiện',by('designer'))}${panel('Theo công việc',by('work'))}</div></div>`;const main=o.querySelector('main');main?.appendChild(wrap)}
  const esc=v=>String(v??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#039;'}[c]));

  // The strongest revocation boundary: remove membership + stale invite + create a deny record in one batch.
  document.addEventListener('click',async e=>{
    const b=e.target.closest?.('[data-md]');if(!b||!auth||!db)return;
    e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
    const uid=b.dataset.md;const memberRef=mod.doc(db,'workspaces',CENTRAL,'members',uid);const snap=await mod.getDoc(memberRef);if(!snap.exists())return;
    const email=String(snap.data().email||'').trim();const batch=mod.writeBatch(db);batch.delete(memberRef);if(email)batch.delete(mod.doc(db,'workspaces',CENTRAL,'invites',email));if(email)batch.set(mod.doc(db,'workspaces',CENTRAL,'revoked',email),{email,memberUid:uid,revokedBy:auth.currentUser?.uid||'',revokedAt:mod.serverTimestamp()},{merge:true});await batch.commit();
    if(auth.currentUser?.uid===uid)try{await mod.signOut(auth)}catch{};
    const r=b.closest('.member-row');r?.remove();
  },true);

  document.addEventListener('click',async e=>{
    const b=e.target.closest?.('#sendInvite');if(!b||!auth?.currentUser)return;const email=document.querySelector('#invEmail')?.value?.trim();if(!email)return;try{await mod.deleteDoc(mod.doc(db,'workspaces',CENTRAL,'revoked',email))}catch{}
  },true);

  init().catch(e=>console.error('[GP] multi-user v2',e));
})();