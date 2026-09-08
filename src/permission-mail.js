import { getApps, getApp } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js';
import { getFirestore, doc, getDoc, setDoc, addDoc, collection, serverTimestamp } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';

const app=getApps()[0]||getApp();
const auth=getAuth(app),db=getFirestore(app);
const WORKSPACE='gp-statistical';
const encEmail=email=>btoa(unescape(encodeURIComponent(email))).replace(/=/g,'');
let currentUser=null;
onAuthStateChanged(auth,u=>{currentUser=u||null});

function esc(v){return String(v??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#039;'}[c]))}
function roleLabel(role){return role==='editor'?'Có thể chỉnh sửa':'Chỉ xem'}
function toast(m){if(typeof window.toast==='function')return window.toast(m);let x=document.querySelector('.toast');if(!x){x=document.createElement('div');x.className='toast';document.body.appendChild(x)}x.textContent=m;x.classList.add('show');setTimeout(()=>x.classList.remove('show'),2800)}

async function workspaceClientId(){const s=await getDoc(doc(db,'workspaces',WORKSPACE));return s.exists()?(s.data().settings?.googleClientId||''):''}
function gmailToken(clientId,prompt){return new Promise((resolve,reject)=>{try{const c=google.accounts.oauth2.initTokenClient({client_id:clientId,scope:'https://www.googleapis.com/auth/gmail.send',include_granted_scopes:true,callback:r=>r?.access_token?resolve(r.access_token):reject(Object.assign(new Error(r?.error_description||r?.error||'Không thể gửi thư'),{code:r?.error||''}))});c.requestAccessToken({prompt:prompt||''})}catch(e){reject(e)}})}
function mimeToBase64Url(s){return btoa(unescape(encodeURIComponent(s))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')}
async function sendViaGmail(to,subject,html,text){const clientId=await workspaceClientId();if(!clientId||!window.google?.accounts?.oauth2)throw new Error('Chưa thiết lập quyền gửi thư từ Gmail.');let token;try{token=await gmailToken(clientId,'')}catch(e){if(e?.code!=='consent_required'&&e?.code!=='access_denied')throw e;token=await gmailToken(clientId,'consent')}const mime=[`To: ${to}`,`Subject: =?UTF-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`,`MIME-Version: 1.0`,`Content-Type: text/html; charset=UTF-8`,`Content-Transfer-Encoding: 8bit`,'',html].join('\r\n');const r=await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({raw:mimeToBase64Url(mime)})});if(!r.ok){let msg='Gmail không thể gửi thư.';try{msg=(await r.json()).error?.message||msg}catch{}throw new Error(msg)}return true}

async function submitInvite(){
  if(!currentUser)throw new Error('Bạn cần đăng nhập để thực hiện thao tác này.');
  const email=(document.querySelector('#gp-invite-email')?.value||'').trim().toLowerCase();
  if(!email||!email.includes('@'))throw new Error('Vui lòng nhập đúng địa chỉ Gmail.');
  const role=document.querySelector('#gp-invite-role')?.value||'viewer';
  const canInvite=(document.querySelector('#gp-invite-caninvite')?.value||'no')==='yes';
  const driveAccess=(document.querySelector('#gp-invite-drive')?.value||'no')==='yes';
  const payload={email,role,canInvite,driveAccess,workspaceId:WORKSPACE,createdBy:currentUser.uid,createdAt:serverTimestamp()};
  await setDoc(doc(db,'workspaces',WORKSPACE,'invites',email),payload,{merge:true});
  await setDoc(doc(db,'workspaces',WORKSPACE,'invites',encEmail(email)),payload,{merge:true});
  const appUrl=`${location.origin}${location.pathname}`;
  const subject='Lời mời tham gia GP Statistical';
  const text=`Bạn được mời tham gia GP Statistical với quyền ${roleLabel(role)}. Mở: ${appUrl}`;
  const html=`<!doctype html><html lang="vi"><body style="margin:0;background:#f4f1ea;font-family:Arial,sans-serif;color:#142033"><div style="max-width:640px;margin:36px auto;padding:38px;background:#fffdf8;border:1px solid #ddd8cd;border-radius:22px"><div style="font-size:12px;font-weight:800;letter-spacing:3px;color:#ef6b3b">GP STATISTICAL</div><h1 style="font-size:34px;line-height:1.1;margin:18px 0 10px">Bạn được mời tham gia bảng kê</h1><p style="font-size:16px;line-height:1.7">Bạn vừa nhận được lời mời tham gia <b>GP Statistical</b>.</p><p style="font-size:15px;line-height:1.7">Quyền được cấp: <b>${roleLabel(role)}</b>.</p><a href="${esc(appUrl)}" style="display:inline-block;margin:20px 0;padding:14px 22px;background:#ef6b3b;color:#fff;text-decoration:none;border-radius:11px;font-weight:700">Mở GP Statistical</a><p style="font-size:13px;color:#6f7784;line-height:1.6">Hãy đăng nhập bằng đúng địa chỉ Gmail đã nhận lời mời.</p></div></body></html>`;

  // Keep a Firestore mail record as a reliable audit/queue record.
  await addDoc(collection(db,'mail'),{to:email,workspaceId:WORKSPACE,inviteEmail:email,createdBy:currentUser.uid,createdAt:serverTimestamp(),message:{subject,text,html}});
  let sent=false;
  try{sent=await sendViaGmail(email,subject,html,text)}catch(e){
    console.warn('GP Gmail send:',e);
    if(e?.message==='Chưa thiết lập quyền gửi thư từ Gmail.')throw e;
  }
  const input=document.querySelector('#gp-invite-email');if(input)input.value='';
  return sent?`Đã gửi lời mời tới ${email}.`:`Đã tạo lời mời cho ${email}. Thư thông báo chưa được gửi vì Gmail chưa được cấp quyền gửi.`;
}

document.addEventListener('click',async event=>{
  const button=event.target?.closest?.('#gp-invite-send');
  if(!button||button.dataset.mailBridge==='1')return;
  event.preventDefault();event.stopImmediatePropagation();button.dataset.mailBridge='1';
  const old=button.textContent;button.disabled=true;button.textContent='Đang gửi…';
  try{toast(await submitInvite())}catch(e){toast(e.message||String(e))}
  finally{button.disabled=false;button.textContent=old;button.dataset.mailBridge=''}
},true);
