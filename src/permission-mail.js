import { getApps, getApp } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js';
import { getFirestore, doc, setDoc, addDoc, collection, serverTimestamp } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';

const auth = getAuth(getApps()[0] || getApp());
const db = getFirestore(getApps()[0] || getApp());
const WORKSPACE = 'gp-statistical';
const encEmail = email => btoa(unescape(encodeURIComponent(email))).replace(/=/g,'');
let currentUser = null;
onAuthStateChanged(auth, u => { currentUser = u || null; });

function esc(v){return String(v??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#039;'}[c]))}
function roleLabel(role){return role==='editor'?'Có thể chỉnh sửa':'Chỉ xem'}

async function submitInvite(){
  if(!currentUser) throw new Error('Bạn cần đăng nhập để thực hiện thao tác này.');
  const email=(document.querySelector('#gp-invite-email')?.value||'').trim().toLowerCase();
  if(!email||!email.includes('@')) throw new Error('Vui lòng nhập đúng địa chỉ Gmail.');
  const role=document.querySelector('#gp-invite-role')?.value||'viewer';
  const canInvite=(document.querySelector('#gp-invite-caninvite')?.value||'no')==='yes';
  const driveAccess=(document.querySelector('#gp-invite-drive')?.value||'no')==='yes';
  const payload={email,role,canInvite,driveAccess,workspaceId:WORKSPACE,createdBy:currentUser.uid,createdAt:serverTimestamp()};
  const rawRef=doc(db,'workspaces',WORKSPACE,'invites',email);
  const encodedRef=doc(db,'workspaces',WORKSPACE,'invites',encEmail(email));
  await setDoc(rawRef,payload,{merge:true});
  await setDoc(encodedRef,payload,{merge:true});
  const appUrl=`${location.origin}${location.pathname}`;
  await addDoc(collection(db,'mail'),{
    to:email,
    workspaceId:WORKSPACE,
    inviteEmail:email,
    createdAt:serverTimestamp(),
    message:{
      subject:'Lời mời tham gia GP Statistical',
      text:`Bạn được mời tham gia GP Statistical với quyền ${roleLabel(role)}. Mở: ${appUrl}`,
      html:`<!doctype html><html lang="vi"><body style="margin:0;background:#f4f1ea;font-family:Arial,sans-serif;color:#142033"><div style="max-width:640px;margin:36px auto;padding:38px;background:#fffdf8;border:1px solid #ddd8cd;border-radius:22px"><div style="font-size:12px;font-weight:800;letter-spacing:3px;color:#ef6b3b">GP STATISTICAL</div><h1 style="font-size:34px;line-height:1.1;margin:18px 0 10px">Bạn được mời tham gia bảng kê</h1><p style="font-size:16px;line-height:1.7">Bạn vừa nhận được lời mời tham gia <b>GP Statistical</b>.</p><p style="font-size:15px;line-height:1.7">Quyền được cấp: <b>${roleLabel(role)}</b>.</p><a href="${esc(appUrl)}" style="display:inline-block;margin:20px 0;padding:14px 22px;background:#ef6b3b;color:#fff;text-decoration:none;border-radius:11px;font-weight:700">Mở GP Statistical</a><p style="font-size:13px;color:#6f7784;line-height:1.6">Hãy đăng nhập bằng đúng địa chỉ Gmail đã nhận lời mời.</p></div></body></html>`
    }
  });
  const input=document.querySelector('#gp-invite-email'); if(input) input.value='';
  return `Đã gửi lời mời tới ${email}`;
}

// Capture the invitation action before the legacy handler so the raw-email
// invitation record is always created. The existing UI remains unchanged.
document.addEventListener('click', async event => {
  const button=event.target?.closest?.('#gp-invite-send');
  if(!button || button.dataset.mailBridge==='1') return;
  event.preventDefault();
  event.stopImmediatePropagation();
  button.dataset.mailBridge='1';
  const old=button.textContent; button.disabled=true; button.textContent='Đang gửi…';
  try { const msg=await submitInvite(); if(typeof window.toast==='function') window.toast(msg); }
  catch(e) { if(typeof window.toast==='function') window.toast(e.message||String(e)); }
  finally { button.disabled=false; button.textContent=old; button.dataset.mailBridge=''; }
}, true);
