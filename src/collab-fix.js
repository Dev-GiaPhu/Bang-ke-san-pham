import {getApps,getApp} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js';
import {getAuth,onAuthStateChanged} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js';
import {getFirestore,collection,doc,getDocs,onSnapshot,query,orderBy,updateDoc,deleteDoc,setDoc,serverTimestamp} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';

(function(){
  const W='gp-statistical';
  const app=getApps()[0]||getApp();
  const auth=getAuth(app),db=getFirestore(app);
  let owner=false,user=null;

  function toast(m){let x=document.querySelector('.toast');if(!x){x=document.createElement('div');x.className='toast';document.body.appendChild(x)}x.textContent=m;x.classList.add('show');setTimeout(()=>x.classList.remove('show'),2500)}
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));

  async function refreshRole(u){
    user=u; owner=false;
    if(!u)return;
    const snap=await getDocs(collection(db,'workspaces',W,'members'));
    const me=snap.docs.find(d=>d.id===u.uid);
    owner=me?.data()?.role==='owner';
    renderMembers(snap.docs.map(d=>d.data()));
  }

  function renderMembers(members){
    const box=document.querySelector('#members');
    if(!box)return;
    box.innerHTML=members.length?members.map(m=>{
      const isSelf=m.uid===user?.uid;
      const can=owner&&!isSelf;
      return `<div class="stat-line"><span><b>${esc(m.displayName||m.email||m.uid)}</b><br><small>${esc(m.email||'')}</small></span><span class="member-controls">${can?`<select class="select member-role" data-uid="${esc(m.uid)}"><option value="viewer" ${m.role==='viewer'?'selected':''}>Người xem</option><option value="editor" ${m.role==='editor'?'selected':''}>Người chỉnh sửa</option><option value="owner" ${m.role==='owner'?'selected':''}>Chủ sở hữu</option></select><button class="btn small danger" data-remove-member="${esc(m.uid)}">Thu hồi</button>`:`<b>${esc(m.role||'member')}</b>`}</span></div>`
    }).join(''):'<div class="empty">Chưa có thành viên.</div>';
    box.querySelectorAll('.member-role').forEach(s=>s.onchange=async()=>{
      try{await updateDoc(doc(db,'workspaces',W,'members',s.dataset.uid),{role:s.value,updatedAt:serverTimestamp()});toast('Đã cập nhật quyền')}catch(e){toast('Không thể thay đổi quyền: '+e.message)}});
    box.querySelectorAll('[data-remove-member]').forEach(b=>b.onclick=async()=>{
      if(!confirm('Thu hồi quyền truy cập của thành viên này?'))return;
      try{await deleteDoc(doc(db,'workspaces',W,'members',b.dataset.removeMember));toast('Đã thu hồi quyền');await refreshRole(user)}catch(e){toast('Không thể thu hồi: '+e.message)}});
  }

  function patchInvite(){
    const old=document.querySelector('#invite');
    if(!old||old.dataset.collabPatched)return;
    old.dataset.collabPatched='1';
    old.addEventListener('click',async e=>{
      if(!owner)return;
      e.stopImmediatePropagation();e.preventDefault();
      const email=(document.querySelector('#inviteEmail')?.value||'').trim().toLowerCase(),role=document.querySelector('#inviteRole')?.value||'viewer';
      if(!email){toast('Nhập email trước.');return}
      try{await setDoc(doc(db,'workspaces',W,'invites',email),{email,role,workspaceId:W,createdBy:user.uid,createdAt:serverTimestamp()});toast(`Đã tạo lời mời ${email}`)}catch(err){toast('Không thể tạo lời mời: '+err.message)}
    },true);
  }

  function patchDelete(){
    document.querySelectorAll('[data-del]').forEach(b=>{
      if(b.dataset.collabDelete)return;b.dataset.collabDelete='1';
      b.addEventListener('click',async e=>{
        e.stopImmediatePropagation();e.preventDefault();
        const id=b.dataset.del;if(!confirm('Xóa sản phẩm?'))return;
        try{
          await deleteDoc(doc(db,'workspaces',W,'products',id));
          const shares=await getDocs(collection(db,'workspaces',W,'shares'));
          for(const s of shares.docs){await deleteDoc(doc(db,'workspaces',W,'shares',s.id,'products',id)).catch(()=>{})}
          toast('Đã xóa');
        }catch(err){toast('Không thể xóa: '+err.message)}
      },true)
    })
  }

  function patchShareSearch(){
    const input=document.querySelector('#shareSearch');
    if(!input||input.dataset.collabSearch)return;
    input.dataset.collabSearch='1';
    input.addEventListener('input',()=>{
      const q=String(input.value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
      document.querySelectorAll('.shared-page .table tbody tr').forEach(tr=>{
        const text=String(tr.textContent||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
        tr.style.display=!q||text.includes(q)?'':'none';
      });
    },true);
  }

  const mo=new MutationObserver(()=>{patchInvite();patchDelete();patchShareSearch()});mo.observe(document.body,{childList:true,subtree:true});
  onAuthStateChanged(auth,u=>refreshRole(u).catch(()=>{}));
})();
