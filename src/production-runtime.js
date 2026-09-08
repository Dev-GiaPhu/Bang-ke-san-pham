import { getApps, getApp } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js';
import { getFirestore, collection, getDocs, writeBatch, doc } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';

const app=getApps()[0]||getApp();
const auth=getAuth(app),db=getFirestore(app);
const W='gp-statistical', LEGACY='ventek-design-tracker-v2';
let migratedFor='';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));

async function migrateLegacy(user){
  if(!user||migratedFor===user.uid)return;
  const raw=localStorage.getItem(LEGACY);
  if(!raw)return;
  let legacy=[];try{legacy=JSON.parse(raw)}catch{return}
  if(!Array.isArray(legacy)||!legacy.length)return;
  const snap=await getDocs(collection(db,'workspaces',W,'products'));
  if(!snap.empty){migratedFor=user.uid;return}
  // Only the signed-in owner should move the old local list into the shared workspace.
  const ws=await getDocs(collection(db,'workspaces',W,'members'));
  const me=ws.docs.find(x=>x.id===user.uid);
  if(me?.data()?.role!=='owner')return;
  for(let i=0;i<legacy.length;i+=400){
    const b=writeBatch(db);
    legacy.slice(i,i+400).forEach(r=>{
      const id=r.id||crypto.randomUUID();
      b.set(doc(db,'workspaces',W,'products',id),{...r,id,assets:Array.isArray(r.assets)?r.assets:[],previewAssets:Array.isArray(r.previewAssets)?r.previewAssets:[],editTypes:Array.isArray(r.editTypes)?r.editTypes:(r.editTypes?[r.editTypes]:[]),migratedFromLocal:true});
    });
    await b.commit();
  }
  migratedFor=user.uid;
  if(typeof window.toast==='function')window.toast('Đã đưa bảng kê cũ vào dữ liệu dùng chung.');
}

function imageFallback(img){
  if(img.dataset.gpFallback==='2'){img.replaceWith(Object.assign(document.createElement('span'),{className:'image-empty',textContent:'Không hiển thị được ảnh'}));return}
  const id=img.closest('[data-gp-image]')?.dataset.gpImage;
  if(!id)return;
  const n=Number(img.dataset.gpFallback||0)+1;
  img.dataset.gpFallback=String(n);
  if(n===1){img.src=`https://drive.google.com/thumbnail?id=${encodeURIComponent(id)}&sz=w1600`;return}
  img.src=`https://lh3.googleusercontent.com/d/${encodeURIComponent(id)}=w1600`;
}

document.addEventListener('error',e=>{const img=e.target;if(img instanceof HTMLImageElement&&img.closest('[data-gp-image]'))imageFallback(img)},true);

// Give the monthly view a sensible first value without re-rendering while a user types.
const monthObserver=new MutationObserver(()=>{
  const month=document.querySelector('#gp-month');
  if(month&& !month.value && !sessionStorage.getItem('gp-month-defaulted')){
    month.value=new Date().toISOString().slice(0,7);
    sessionStorage.setItem('gp-month-defaulted','1');
    month.dispatchEvent(new Event('change',{bubbles:true}));
  }
});
monthObserver.observe(document.body,{childList:true,subtree:true});

onAuthStateChanged(auth,u=>migrateLegacy(u).catch(e=>console.warn('GP migration:',e)));
