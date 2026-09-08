import { getApps, getApp } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js';
import { getFirestore, doc, onSnapshot } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';

const app=getApps()[0]||getApp();
const db=getFirestore(app);
const W='gp-statistical';
let stop=null,blocked=false;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
function shareId(){const m=location.hash.match(/^#share=([A-Za-z0-9_-]+)$/);return m?.[1]||''}
function showBlocked(message){blocked=true;const root=document.querySelector('#app');if(!root)return;root.innerHTML=`<div class="gate"><div class="gate-card"><div class="gate-kicker">GP STATISTICAL</div><h1>Liên kết không còn khả dụng.</h1><p>${esc(message)}</p></div></div>`}
function watch(){if(stop){stop();stop=null}blocked=false;const id=shareId();if(!id)return;stop=onSnapshot(doc(db,'workspaces',W,'shares',id),snap=>{if(!snap.exists()||snap.data().active!==true)showBlocked('Liên kết này đã được ẩn hoặc thu hồi.');},()=>showBlocked('Liên kết này không còn khả dụng.'))}
const mo=new MutationObserver(()=>{if(blocked&&shareId()){const root=document.querySelector('#app');if(root&&!root.querySelector('.gate-card h1'))showBlocked('Liên kết này đã được ẩn hoặc thu hồi.')}});
mo.observe(document.body,{childList:true,subtree:true});
window.addEventListener('hashchange',watch);
watch();
