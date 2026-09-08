import {getApps,getApp} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js';
import {getAuth,onAuthStateChanged,signOut} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js';
import {getFirestore,doc,getDoc,setDoc,serverTimestamp} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';

(function(){
  const app=getApps()[0]||getApp();
  const auth=getAuth(app),db=getFirestore(app),W='gp-statistical';
  let attempted=false;
  const renderError=(title,msg,code)=>{
    const root=document.querySelector('#app'); if(!root)return;
    root.innerHTML=`<div class="gate"><div class="gate-card"><div class="gate-kicker">GP STATISTICAL</div><h1>${title}</h1><p>${msg}</p><div class="field-help" style="margin-top:12px">${code?`Mã lỗi: ${code}`:''}</div><div class="actions" style="justify-content:center;margin-top:18px"><button id="authRetry" class="btn primary">Thử lại</button><button id="authLogout" class="btn">Đăng xuất</button></div></div></div>`;
    document.querySelector('#authRetry')?.addEventListener('click',()=>location.reload());
    document.querySelector('#authLogout')?.addEventListener('click',()=>signOut(auth).catch(()=>{}));
  };
  onAuthStateChanged(auth,async u=>{
    if(!u||attempted)return; attempted=true;
    try{
      const ws=await getDoc(doc(db,'workspaces',W));
      if(!ws.exists()) await setDoc(doc(db,'workspaces',W),{name:'GP Statistical',ownerUid:u.uid,createdAt:serverTimestamp()});
    }catch(e){
      const code=e?.code||'';
      const msg=code==='permission-denied'
        ?'Google đã đăng nhập thành công nhưng Firestore đang từ chối quyền. Hãy kiểm tra và Publish firestore.rules trong Firebase Console.'
        :`Google đã đăng nhập thành công nhưng hệ thống không khởi tạo được workspace. ${e?.message||String(e)}`;
      renderError('Đã đăng nhập nhưng chưa vào được hệ thống.',msg,code);
    }
  });
})();
