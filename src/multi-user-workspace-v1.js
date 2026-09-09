(function(){
  if(window.__GP_MULTI_USER_WORKSPACE_V1__) return;
  window.__GP_MULTI_USER_WORKSPACE_V1__=true;

  const FIREBASE='https://www.gstatic.com/firebasejs/12.18.0/';
  const CENTRAL='gp-statistical';
  const PERSONAL_PREFIX='personal_';
  const CONFIG={apiKey:'AIzaSyCVY90upeKcuR5u8VPzqNmI-TFe2CDSL14',authDomain:'gp-statistical.firebaseapp.com',projectId:'gp-statistical',storageBucket:'gp-statistical.firebasestorage.app',messagingSenderId:'870570090818',appId:'1:870570090818:web:0a140685c61b3ec95ea8db'};
  let app,auth,db,mod,centralMemberUnsub=null,personalProductsUnsub=null,sharedUnsub=null,personalId='';
  const S={user:null,centralMember:null,products:[],shares:[],tab:'mine',search:'',customer:'',designer:'',type:'',month:'',busy:false};
  const esc=v=>String(v??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#039;'}[c]));
  const norm=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim().toLowerCase();
  const today=()=>{const d=new Date();return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`};
  const month=v=>{const m=String(v||'').match(/^(\d{2})\/(\d{2})\/(\d{4})$/);return m?`${m[3]}-${m[2]}`:''};
  const dateDisplay=v=>{const s=String(v||'');if(/^\d{2}\/\d{2}\/\d{4}$/.test(s))return s;const m=s.match(/^(\d{4})-(\d{2})-(\d{2})$/);return m?`${m[3]}/${m[2]}/${m[1]}`:s||today()};
  const personalWorkspaceId=u=>PERSONAL_PREFIX+u.uid;
  const personalProductRef=id=>mod.doc(db,'workspaces',personalId,'products',id);

  async function init(){
    if(window.firebase?.app?.getApps) app=window.firebase.app.getApps()[0];
    const [A,U,F]=await Promise.all([import(FIREBASE+'firebase-app.js'),import(FIREBASE+'firebase-auth.js'),import(FIREBASE+'firebase-firestore.js')]);
    mod={...A,...U,...F};
    app=mod.getApps()[0]||mod.initializeApp(CONFIG);
    auth=mod.getAuth(app);db=mod.getFirestore(app);
    mod.onAuthStateChanged(auth,handleAuth);
  }

  async function handleAuth(user){
    S.user=user;
    const overlay=document.getElementById('gp-multi-user-app');
    if(!user){overlay?.remove();cleanup();return}
    const centralRef=mod.doc(db,'workspaces',CENTRAL,'members',user.uid);
    centralMemberUnsub?.();
    centralMemberUnsub=mod.onSnapshot(centralRef,async snap=>{
      if(!snap.exists()){
        // Public share pages remain available without membership. The private app session does not.
        if(!location.hash.startsWith('#share=')){
          cleanup();
          try{await mod.signOut(auth)}catch{}
          return;
        }
        return;
      }
      S.centralMember={uid:user.uid,...snap.data()};
      if(S.centralMember.role==='owner'){
        overlay?.remove();
        cleanup(false);
        return;
      }
      await ensurePersonalWorkspace(user);
      mountOverlay();
      loadPersonal();
      loadSharedTables();
    });
  }

  function cleanup(clearRoot=true){centralMemberUnsub?.();centralMemberUnsub=null;personalProductsUnsub?.();personalProductsUnsub=null;sharedUnsub?.();sharedUnsub=null;personalId='';S.centralMember=null;S.products=[];S.shares=[];if(clearRoot)document.getElementById('gp-multi-user-app')?.remove();}

  async function ensurePersonalWorkspace(user){
    personalId=personalWorkspaceId(user);
    const wref=mod.doc(db,'workspaces',personalId);
    const snap=await mod.getDoc(wref);
    if(!snap.exists()){
      await mod.setDoc(wref,{ownerUid:user.uid,name:'Bảng kê của tôi',type:'personal',createdAt:mod.serverTimestamp(),createdBy:user.uid});
      await mod.setDoc(mod.doc(db,'workspaces',personalId,'members',user.uid),{uid:user.uid,email:user.email||'',displayName:user.displayName||'',role:'owner',canInvite:false,driveAccess:false,createdAt:mod.serverTimestamp()});
    }else{
      const m=await mod.getDoc(mod.doc(db,'workspaces',personalId,'members',user.uid));
      if(!m.exists()) await mod.setDoc(mod.doc(db,'workspaces',personalId,'members',user.uid),{uid:user.uid,email:user.email||'',displayName:user.displayName||'',role:'owner',canInvite:false,driveAccess:false,createdAt:mod.serverTimestamp()});
    }
  }

  function loadPersonal(){
    personalProductsUnsub?.();
    personalProductsUnsub=mod.onSnapshot(mod.collection(db,'workspaces',personalId,'products'),snap=>{S.products=snap.docs.map(d=>({id:d.id,...d.data()}));render();});
  }
  function loadSharedTables(){
    sharedUnsub?.();
    sharedUnsub=mod.onSnapshot(mod.collection(db,'workspaces',CENTRAL,'shares'),snap=>{S.shares=snap.docs.map(d=>({id:d.id,...d.data()})).filter(x=>x.active!==false);render();});
  }

  function filteredProducts(){return S.products.filter(r=>{if(S.month&&r.month!==S.month)return false;if(S.customer&&r.customer!==S.customer)return false;if(S.designer&&r.designer!==S.designer)return false;if(S.type&&!(r.editTypes||[]).includes(S.type))return false;const q=norm(S.search);return !q||norm([r.customer,r.productName,r.size,r.volume,r.designer,(r.editTypes||[]).join(' '),r.otherWork||''].join(' ')).includes(q);});}
  function stats(){const rows=filteredProducts(),qty=rows.reduce((s,r)=>s+Number(r.quantity||0),0);return `<div class="gp-mw-stats"><div><span>TỔNG SỐ SẢN PHẨM</span><b>${rows.length}</b></div><div><span>TỔNG SỐ LƯỢNG</span><b>${qty}</b></div><div><span>KHÁCH HÀNG</span><b>${new Set(rows.map(r=>r.customer).filter(Boolean)).size}</b></div></div>`;}
  function filters(){const customers=[...new Set(S.products.map(r=>r.customer).filter(Boolean))].sort(),designers=[...new Set(S.products.map(r=>r.designer).filter(Boolean))].sort(),types=[...new Set(S.products.flatMap(r=>r.editTypes||[]))].sort();return `<div class="gp-mw-filters"><select id="gp-mw-customer"><option value="">Tất cả khách hàng</option>${customers.map(x=>`<option ${S.customer===x?'selected':''} value="${esc(x)}">${esc(x)}</option>`).join('')}</select><select id="gp-mw-designer"><option value="">Tất cả người thực hiện</option>${designers.map(x=>`<option ${S.designer===x?'selected':''} value="${esc(x)}">${esc(x)}</option>`).join('')}</select><select id="gp-mw-type"><option value="">Tất cả loại công việc</option>${types.map(x=>`<option ${S.type===x?'selected':''} value="${esc(x)}">${esc(x)}</option>`).join('')}</select><input id="gp-mw-month" type="month" value="${esc(S.month)}"><input id="gp-mw-search" value="${esc(S.search)}" placeholder="Tìm kiếm…"><button id="gp-mw-clear" type="button">Xóa lọc</button></div>`;}
  function table(){const rows=filteredProducts();return `<div class="gp-mw-card"><div class="gp-mw-card-head"><div><h2>Bảng kê của tôi</h2><span>${rows.length} sản phẩm</span></div><div class="gp-mw-actions"><button id="gp-mw-add">＋ Thêm sản phẩm</button><button data-export="xlsx">Xuất Excel</button><button data-export="pdf">Xuất PDF / A4</button></div></div><div class="gp-mw-table-wrap"><table class="table"><thead><tr><th>Chọn</th><th>Hình</th><th>Khách hàng</th><th>Sản phẩm</th><th>Kích thước</th><th>Thể tích</th><th>SL</th><th>Designer</th><th>Công việc</th><th>Ngày</th><th>Drive</th><th>Thao tác</th></tr></thead><tbody>${rows.length?rows.map(r=>`<tr><td><input type="checkbox" class="gp-mw-row-check"></td><td><div class="thumbs">${(r.previewAssets||[]).slice(0,2).map(a=>`<button class="image-btn" type="button" data-image-id="${esc(a.id)}" data-image-name="${esc(a.name||'')}"><img src="https://drive.google.com/thumbnail?id=${encodeURIComponent(a.id)}&sz=w600" alt=""></button>`).join('')||'—'}</div></td><td>${esc(r.customer||'')}</td><td><strong>${esc(r.productName||'')}</strong></td><td>${esc(r.size||'—')}</td><td>${esc(r.volume||'—')}</td><td>${esc(r.quantity||0)}</td><td>${esc(r.designer||'')}</td><td>${(r.editTypes||[]).map(x=>`<span class="pill">${esc(x)}</span>`).join(' ')}${r.otherWork?`<small>${esc(r.otherWork)}</small>`:''}</td><td>${esc(dateDisplay(r.date))}</td><td>${r.driveVariantFolderId?`<a target="_blank" rel="noopener" href="https://drive.google.com/drive/folders/${encodeURIComponent(r.driveVariantFolderId)}">Mở thư mục ↗</a>`:'—'}</td><td><button type="button" data-gp-mw-edit="${esc(r.id)}">Sửa</button><button type="button" data-gp-mw-delete="${esc(r.id)}">Xóa</button></td></tr>`).join(''):`<tr><td colspan="12" class="empty">Bảng kê của bạn chưa có dữ liệu.</td></tr>`}</tbody></table></div></div>`;}
  function shared(){return `<div class="gp-mw-card"><div class="gp-mw-card-head"><div><h2>Bảng kê được chia sẻ</h2><span>${S.shares.length} bảng kê</span></div></div><div class="gp-mw-shared-grid">${S.shares.map(s=>`<article class="gp-mw-share-card"><div class="gp-mw-share-icon">▤</div><div><h3>${esc(s.name||s.title||'Bảng kê được chia sẻ')}</h3><p>${esc(s.mode==='editor'?'Bạn có thể chỉnh sửa':'Bạn chỉ có quyền xem')} · ${s.active===false?'Đang ẩn':'Đang hoạt động'}</p></div><button type="button" data-gp-open-share="${esc(s.id)}">Mở bảng kê</button></article>`).join('')||'<div class="empty">Chưa có bảng kê nào được chia sẻ với bạn.</div>'}</div></div>`;}
  function render(){if(!S.user||!S.centralMember||S.centralMember.role==='owner')return;if(location.hash.startsWith('#share=')){document.getElementById('gp-multi-user-app')?.classList.add('gp-mw-hidden');return}mountOverlay();const title=S.tab==='mine'?'Bảng kê của tôi':'Bảng kê được chia sẻ';const body=S.tab==='mine'?`${filters()}${stats()}${table()}`:shared();const root=document.getElementById('gp-multi-user-app');root.innerHTML=`<div class="gp-mw-shell"><aside><div class="gp-mw-brand"><span>GP</span><strong>STATISTICAL</strong></div><nav><button class="${S.tab==='mine'?'active':''}" data-gp-mw-tab="mine">▤ <span>Bảng kê của tôi</span></button><button class="${S.tab==='shared'?'active':''}" data-gp-mw-tab="shared">↗ <span>Được chia sẻ</span></button></nav><div class="gp-mw-account"><strong>${esc(S.user.displayName||S.user.email||'')}</strong><span>${esc(S.user.email||'')}</span><button id="gp-mw-logout">Đăng xuất</button></div></aside><main><header><div><div class="eyebrow">GP STATISTICAL</div><h1>${title}</h1><p>Không gian làm việc cá nhân</p></div></header>${body}</main></div>`;bind();}
  function mountOverlay(){let el=document.getElementById('gp-multi-user-app');if(el)return;el=document.createElement('div');el.id='gp-multi-user-app';document.body.appendChild(el);if(!document.getElementById('gp-mw-style')){const st=document.createElement('style');st.id='gp-mw-style';st.textContent=`#gp-multi-user-app{position:fixed;inset:0;z-index:2147483000;background:#f5f1eb;overflow:auto;font-family:Arial,sans-serif;color:#132238}#gp-multi-user-app.gp-mw-hidden{display:none}.gp-mw-shell{min-height:100%;display:grid;grid-template-columns:260px minmax(0,1fr)}.gp-mw-shell aside{background:#132238;color:#fff;padding:28px 18px;display:flex;flex-direction:column}.gp-mw-brand{display:flex;align-items:center;gap:10px;padding:6px 8px 26px}.gp-mw-brand span{width:38px;height:38px;border-radius:12px;display:grid;place-items:center;background:#f36b3c;font-weight:800}.gp-mw-brand strong{letter-spacing:1px}.gp-mw-shell nav{display:grid;gap:7px}.gp-mw-shell nav button{border:0;background:transparent;color:#d8e0eb;padding:12px 13px;border-radius:11px;text-align:left;cursor:pointer;font-size:14px}.gp-mw-shell nav button.active,.gp-mw-shell nav button:hover{background:rgba(255,255,255,.11);color:#fff}.gp-mw-account{margin-top:auto;display:grid;gap:5px;padding:14px 8px;border-top:1px solid rgba(255,255,255,.12)}.gp-mw-account strong{font-size:13px;overflow-wrap:anywhere}.gp-mw-account span{font-size:11px;color:#aeb8c6;overflow-wrap:anywhere}.gp-mw-account button{margin-top:8px;border:1px solid rgba(255,255,255,.2);background:transparent;color:#fff;padding:9px;border-radius:10px;cursor:pointer}.gp-mw-shell main{padding:30px 34px;min-width:0}.gp-mw-shell header{margin-bottom:20px}.gp-mw-shell h1{margin:5px 0}.gp-mw-shell header p{margin:0;color:#697586}.gp-mw-filters{display:grid;grid-template-columns:repeat(5,minmax(0,1fr)) auto;gap:10px;margin-bottom:18px}.gp-mw-filters select,.gp-mw-filters input,.gp-mw-filters button{min-width:0;padding:10px 12px;border:1px solid #d7d2c9;border-radius:10px;background:#fff;font:inherit}.gp-mw-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-bottom:18px}.gp-mw-stats>div,.gp-mw-card{background:#fff;border:1px solid #ded8cf;border-radius:16px}.gp-mw-stats>div{padding:17px}.gp-mw-stats span{display:block;color:#697586;font-size:11px}.gp-mw-stats b{display:block;font-size:28px;margin-top:7px}.gp-mw-card{overflow:hidden}.gp-mw-card-head{padding:18px 20px;border-bottom:1px solid #e7e1d8;display:flex;justify-content:space-between;align-items:center;gap:16px}.gp-mw-card-head h2{margin:0;font-size:18px}.gp-mw-card-head span{color:#697586;font-size:12px}.gp-mw-actions{display:flex;gap:8px;flex-wrap:wrap}.gp-mw-actions button,.gp-mw-share-card button{border:1px solid #d3cec5;background:#fff;padding:9px 12px;border-radius:9px;cursor:pointer}.gp-mw-actions button:first-child{background:#f36b3c;color:#fff;border-color:#f36b3c}.gp-mw-table-wrap{overflow:auto}.gp-mw-table-wrap table{width:100%;min-width:1120px;border-collapse:collapse}.gp-mw-table-wrap th,.gp-mw-table-wrap td{padding:11px 10px;border-bottom:1px solid #ece7df;text-align:left;vertical-align:middle}.gp-mw-table-wrap th{background:#f7f4ef;font-size:12px}.gp-mw-table-wrap td:first-child,.gp-mw-table-wrap th:first-child{width:48px;text-align:center}.gp-mw-table-wrap img{width:52px;height:52px;object-fit:contain;border-radius:8px}.gp-mw-table-wrap td:last-child{white-space:nowrap}.gp-mw-share-card{display:grid;grid-template-columns:48px minmax(0,1fr) auto;gap:14px;align-items:center;padding:17px 20px;border-bottom:1px solid #ece7df}.gp-mw-share-icon{width:44px;height:44px;border-radius:12px;display:grid;place-items:center;background:#f3eee8}.gp-mw-share-card h3{margin:0 0 4px}.gp-mw-share-card p{margin:0;color:#697586;font-size:12px}.gp-mw-hidden{display:none!important}@media(max-width:900px){.gp-mw-shell{grid-template-columns:1fr}.gp-mw-shell aside{position:sticky;top:0;z-index:2;padding:12px 14px}.gp-mw-brand{padding:4px 2px 10px}.gp-mw-account{display:none}.gp-mw-shell nav{grid-template-columns:1fr 1fr}.gp-mw-shell nav button{padding:10px}.gp-mw-shell main{padding:20px 16px}.gp-mw-filters{grid-template-columns:1fr 1fr}.gp-mw-stats{grid-template-columns:1fr 1fr 1fr}}@media(max-width:560px){.gp-mw-filters{grid-template-columns:1fr}.gp-mw-shell main{padding:16px 10px}.gp-mw-stats{grid-template-columns:1fr}.gp-mw-card-head{align-items:flex-start;flex-direction:column}.gp-mw-actions{width:100%}.gp-mw-actions button{flex:1 1 140px}.gp-mw-share-card{grid-template-columns:42px minmax(0,1fr);padding:14px}.gp-mw-share-card button{grid-column:1/-1;width:100%}}`;document.head.appendChild(st)} }
  function bind(){const root=document.getElementById('gp-multi-user-app');if(!root)return;root.querySelectorAll('[data-gp-mw-tab]').forEach(b=>b.onclick=()=>{S.tab=b.dataset.gpMwTab;render()});root.querySelector('#gp-mw-logout')?.addEventListener('click',()=>mod.signOut(auth));root.querySelector('#gp-mw-customer')?.addEventListener('change',e=>{S.customer=e.target.value;render()});root.querySelector('#gp-mw-designer')?.addEventListener('change',e=>{S.designer=e.target.value;render()});root.querySelector('#gp-mw-type')?.addEventListener('change',e=>{S.type=e.target.value;render()});root.querySelector('#gp-mw-month')?.addEventListener('change',e=>{S.month=e.target.value;render()});root.querySelector('#gp-mw-search')?.addEventListener('input',e=>{S.search=e.target.value;render()});root.querySelector('#gp-mw-clear')?.addEventListener('click',()=>{Object.assign(S,{search:'',customer:'',designer:'',type:'',month:''});render()});root.querySelector('#gp-mw-add')?.addEventListener('click',()=>productModal());root.querySelectorAll('[data-gp-mw-edit]').forEach(b=>b.onclick=()=>productModal(S.products.find(x=>x.id===b.dataset.gpMwEdit)));root.querySelectorAll('[data-gp-mw-delete]').forEach(b=>b.onclick=()=>deleteProduct(b.dataset.gpMwDelete));root.querySelectorAll('[data-gp-open-share]').forEach(b=>b.onclick=()=>{location.hash='share='+b.dataset.gpOpenShare;});root.querySelectorAll('[data-export="xlsx"],[data-export="pdf"]').forEach(b=>{b.onclick=null});}
  async function deleteProduct(id){if(!confirm('Xóa sản phẩm này khỏi bảng kê của bạn?'))return;try{await mod.deleteDoc(personalProductRef(id));}catch(e){alert('Không thể xóa sản phẩm.');}}
  function productModal(record){const r=record||{customer:'',productName:'',volume:'',size:'',quantity:1,designer:'',date:today(),editTypes:['Design mới'],otherWork:'',driveVariantFolderId:'',previewAssets:[]};const works=['Design mới','Sửa thông tin','Update thông tin','Sửa kích thước','Khác'];const b=document.createElement('div');b.className='gp-mw-modal';b.innerHTML=`<div class="gp-mw-modal-backdrop"><div class="gp-mw-modal-card"><header><div><h2>${record?'Sửa thông tin':'Thêm sản phẩm'}</h2><p>Các thông tin này thuộc riêng bảng kê của bạn.</p></div><button data-gp-mw-close>Đóng</button></header><div class="gp-mw-form"><label>Khách hàng<input id="mw-customer" value="${esc(r.customer)}"></label><label>Tên sản phẩm<input id="mw-product" value="${esc(r.productName)}"></label><label>Kích thước<input id="mw-size" value="${esc(r.size)}"></label><label>Thể tích<input id="mw-volume" value="${esc(r.volume)}"></label><label>Số lượng<input id="mw-qty" type="number" min="0" value="${esc(r.quantity)}"></label><label>Người thực hiện<input id="mw-designer" value="${esc(r.designer)}"></label><label>Ngày<input id="mw-date" inputmode="numeric" value="${esc(dateDisplay(r.date))}" placeholder="dd/MM/yyyy"></label><div class="mw-work"><span>Loại công việc</span>${works.map(x=>`<label><input type="checkbox" data-mw-work value="${esc(x)}" ${r.editTypes?.includes(x)?'checked':''}>${esc(x)}</label>`).join('')}</div><label class="mw-other">Nội dung khác<textarea id="mw-other">${esc(r.otherWork||'')}</textarea></label></div><footer><button data-gp-mw-close>Hủy</button><button id="mw-save">Lưu</button></footer></div></div>`;document.body.appendChild(b);b.querySelectorAll('[data-gp-mw-close]').forEach(x=>x.onclick=()=>b.remove());b.querySelector('#mw-save').onclick=async()=>{const date=b.querySelector('#mw-date').value.trim();if(!/^(0[1-9]|[12]\d|3[01])\/(0[1-9]|1[0-2])\/\d{4}$/.test(date)){alert('Ngày phải có định dạng dd/MM/yyyy.');return}const data={customer:b.querySelector('#mw-customer').value.trim(),productName:b.querySelector('#mw-product').value.trim(),size:b.querySelector('#mw-size').value.trim(),volume:b.querySelector('#mw-volume').value.trim(),quantity:Number(b.querySelector('#mw-qty').value||0),designer:b.querySelector('#mw-designer').value.trim(),date,month:month(date),editTypes:[...b.querySelectorAll('[data-mw-work]:checked')].map(x=>x.value),otherWork:b.querySelector('#mw-other').value.trim(),createdAt:record?.createdAt||mod.serverTimestamp(),updatedAt:mod.serverTimestamp(),previewAssets:record?.previewAssets||[],driveVariantFolderId:record?.driveVariantFolderId||'',sourceFolderPath:record?.sourceFolderPath||''};try{if(record)await mod.updateDoc(personalProductRef(record.id),data);else await mod.setDoc(mod.doc(mod.collection(db,'workspaces',personalId,'products')),data);b.remove()}catch(e){alert('Không thể lưu sản phẩm.')}};}

  // Prevent a revoked user from being recreated from a stale invitation and provide a clean re-invite path.
  document.addEventListener('click',async e=>{
    const revoke=e.target.closest?.('[data-md]');
    if(revoke&&S.user){
      e.preventDefault();e.stopImmediatePropagation();
      const uid=revoke.dataset.md;const m=await mod.getDoc(mod.doc(db,'workspaces',CENTRAL,'members',uid));if(!m.exists())return;const d=m.data();
      const batch=mod.writeBatch(db);
      batch.delete(mod.doc(db,'workspaces',CENTRAL,'members',uid));
      batch.delete(mod.doc(db,'workspaces',CENTRAL,'invites',String(d.email||'').trim()));
      batch.set(mod.doc(db,'workspaces',CENTRAL,'revoked',String(d.email||'').trim()),{email:String(d.email||'').trim(),revokedBy:S.user.uid,revokedAt:mod.serverTimestamp(),memberUid:uid},{merge:true});
      await batch.commit();
      if(uid===S.user.uid){try{await mod.signOut(auth)}catch{}}
      return;
    }
    const send=e.target.closest?.('#sendInvite');
    if(send&&S.centralMember?.role==='owner'){
      const email=document.querySelector('#invEmail')?.value?.trim();if(email)try{await mod.deleteDoc(mod.doc(db,'workspaces',CENTRAL,'revoked',email));}catch{}
    }
  },true);

  window.addEventListener('hashchange',()=>{const el=document.getElementById('gp-multi-user-app');if(el)el.classList.toggle('gp-mw-hidden',location.hash.startsWith('#share='));if(!location.hash.startsWith('#share=')&&S.centralMember?.role&&S.centralMember.role!=='owner')render();});
  init().catch(e=>console.error('[GP] multi-user workspace init',e));
})();