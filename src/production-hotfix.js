import { getApps, getApp } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js';
import { getFirestore, doc, getDoc, setDoc, updateDoc, deleteDoc, collection, getDocs, writeBatch, serverTimestamp } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';

const app=getApps()[0]||getApp();
const auth=getAuth(app);
const db=getFirestore(app);
const WORKSPACE='gp-statistical';
const DRIVE_SESSION='gp-drive-token-v1';
const EMAIL_KEY=e=>btoa(unescape(encodeURIComponent(e))).replace(/[^a-zA-Z0-9_-]/g,'').slice(0,120)||'invite';
const norm=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim().toLowerCase();
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
let gisPatched=false;

function patchGoogleTokenClient(){
  try{
    const oauth=window.google?.accounts?.oauth2;
    if(!oauth?.initTokenClient||oauth.initTokenClient.__gpWrapped)return false;
    const original=oauth.initTokenClient.bind(oauth);
    function wrapped(config){
      const cfg={...config};
      const userCallback=cfg.callback;
      cfg.callback=(response)=>{
        if(response?.access_token && /drive\.readonly/.test(String(cfg.scope||''))){try{sessionStorage.setItem(DRIVE_SESSION,response.access_token)}catch{}}
        return userCallback?.(response);
      };
      const client=original(cfg);
      const origRequest=client.requestAccessToken.bind(client);
      client.requestAccessToken=(params={})=>{
        const silent=params?.prompt==='' && /drive\.readonly/.test(String(cfg.scope||''));
        if(silent){
          let saved='';try{saved=sessionStorage.getItem(DRIVE_SESSION)||''}catch{}
          if(saved){
            fetch('https://www.googleapis.com/drive/v3/about?fields=user',{headers:{Authorization:`Bearer ${saved}`}})
              .then(r=>{if(!r.ok)throw Error('expired');return r.json()})
              .then(()=>cfg.callback({access_token:saved,expires_in:1800,scope:cfg.scope}))
              .catch(()=>{try{sessionStorage.removeItem(DRIVE_SESSION)}catch{};origRequest(params)});
            return;
          }
        }
        return origRequest(params);
      };
      return client;
    }
    wrapped.__gpWrapped=true;
    oauth.initTokenClient=wrapped;
    gisPatched=true;
    return true;
  }catch{return false}
}
function waitForGIS(){if(patchGoogleTokenClient())return;setTimeout(waitForGIS,250)}
waitForGIS();

async function ensureInvitedMember(user){
  if(!user?.email)return;
  const email=user.email.toLowerCase();
  const member=await getDoc(doc(db,'workspaces',WORKSPACE,'members',user.uid));
  if(member.exists())return;
  let inv=await getDoc(doc(db,'workspaces',WORKSPACE,'invites',email));
  if(!inv.exists())inv=await getDoc(doc(db,'workspaces',WORKSPACE,'invites',EMAIL_KEY(email)));
  if(!inv.exists())return;
  const x=inv.data();
  if(String(x.email||'').toLowerCase()!==email)return;
  await setDoc(doc(db,'workspaces',WORKSPACE,'members',user.uid),{uid:user.uid,email:user.email,displayName:user.displayName||'',role:x.role||'viewer',canInvite:!!x.canInvite,driveAccess:!!x.driveAccess,createdAt:serverTimestamp(),updatedAt:serverTimestamp()},{merge:true});
  await updateDoc(inv.ref,{acceptedBy:user.uid,acceptedAt:serverTimestamp()}).catch(()=>{});
}
onAuthStateChanged(auth,u=>{if(u)setTimeout(()=>ensureInvitedMember(u).catch(()=>{}),250)});

function toast(message){if(typeof window.toast==='function')window.toast(message);else{const x=document.querySelector('.toast');if(x){x.textContent=message;x.classList.add('show');setTimeout(()=>x.classList.remove('show'),2500)}}}
function formatMonth(value){const m=String(value||'').match(/^(\d{4})-(\d{2})$/);return m?`${m[2]}/${m[1]}`:''}
function formatDay(value){const m=String(value||'').match(/^\d{4}-\d{2}-(\d{2})$/);return m?m[1]:''}
function parseMonth(v){const m=String(v||'').trim().match(/^(\d{1,2})\/(\d{4})$/);if(!m)return '';const mm=Number(m[1]);return mm>=1&&mm<=12?`${m[2]}-${String(mm).padStart(2,'0')}`:''}
function buildDate(month,day){return month&&/^\d{2}$/.test(day)?`${month}-${day}`:''}

async function openEditor(id,fromShare=false){
  let record=null;let share='';
  if(fromShare){share=(location.hash.match(/^#share=([A-Za-z0-9_-]+)$/)||[])[1]||'';if(!share)return;const snap=await getDoc(doc(db,'workspaces',WORKSPACE,'shares',share,'products',id));if(!snap.exists())return;record=snap.data()}
  else{const snap=await getDoc(doc(db,'workspaces',WORKSPACE,'products',id));if(!snap.exists())return;record=snap.data()}
  const local=(()=>{try{return JSON.parse(localStorage.getItem('ventek-design-settings-v2')||'{}')}catch{return{}}})();
  const types=Array.from(new Set([...(local.editTypes||['Design mới','Sửa thông tin','Update thông tin','Sửa kích thước']),'Khác']));
  const other=(record.editTypes||[]).find(x=>String(x).startsWith('Khác:'));
  const w=document.createElement('div');w.className='modal-backdrop';
  w.innerHTML=`<div class="modal large"><div class="modal-head"><div><h2>Sửa thông tin sản phẩm</h2><div class="muted">Thay đổi này chỉ cập nhật bảng kê.</div></div><button class="btn" data-gp-close>Đóng</button></div><div class="form-grid"><label class="field"><label>Khách hàng</label><input id="hx-c" class="input" value="${esc(record.customer||'')}"></label><label class="field"><label>Tháng</label><input id="hx-month" class="input" inputmode="numeric" maxlength="7" placeholder="MM/YYYY" value="${esc(formatMonth(record.month)||formatMonth(String(record.date||'').slice(0,7)))}"></label><label class="field"><label>Ngày</label><input id="hx-day" class="input" inputmode="numeric" maxlength="2" placeholder="DD" value="${esc(formatDay(record.date))}"></label><label class="field"><label>Số lượng</label><input id="hx-q" class="input" type="number" min="0" step="1" value="${esc(record.quantity??1)}"></label><label class="field"><label>Tên sản phẩm</label><input id="hx-p" class="input" value="${esc(record.productName||'')}"></label><label class="field"><label>Thể tích</label><input id="hx-v" class="input" value="${esc(record.volume||'')}"></label><label class="field"><label>Kích thước</label><input id="hx-s" class="input" value="${esc(record.size||'')}"></label><label class="field"><label>Người thực hiện</label><input id="hx-user" class="input" list="hx-designers" value="${esc(record.designer||'')}" placeholder="Chọn hoặc nhập tên"><datalist id="hx-designers"></datalist></label></div><label class="field"><label>Loại công việc</label><div id="hx-types" class="check-grid">${types.map((x,i)=>`<label class="check"><input type="checkbox" data-hx-type="${i}" ${x==='Khác'?(other?'checked':''):(record.editTypes||[]).includes(x)?'checked':''}><span>${esc(x)}</span></label>`).join('')}</div><div id="hx-other" class="other-work" ${other?'':'hidden'}><label>Chi tiết công việc khác</label><input id="hx-other-text" class="input" value="${esc(other?String(other).slice(5).trim():'')}" placeholder="Nhập nội dung…"></div></label><div class="actions" style="justify-content:flex-end;margin-top:18px"><button class="btn" data-gp-close>Hủy</button><button class="btn primary" id="hx-save">Lưu thay đổi</button></div></div>`;
  document.body.appendChild(w);
  const dl=w.querySelector('#hx-designers');Array.from(new Set([...(local.designers||[]),record.designer||''].filter(Boolean))).forEach(x=>{const o=document.createElement('option');o.value=x;dl.appendChild(o)});
  const otherIndex=types.indexOf('Khác');w.querySelectorAll('[data-hx-type]').forEach(c=>c.onchange=()=>{if(Number(c.dataset.hxType)===otherIndex)w.querySelector('#hx-other').hidden=!c.checked});
  const close=()=>w.remove();w.querySelectorAll('[data-gp-close]').forEach(b=>b.onclick=close);
  w.querySelector('#hx-month').oninput=e=>{e.target.value=e.target.value.replace(/[^0-9/]/g,'').slice(0,7)};w.querySelector('#hx-day').oninput=e=>{e.target.value=e.target.value.replace(/\D/g,'').slice(0,2)};
  w.querySelector('#hx-save').onclick=async()=>{try{const month=parseMonth(w.querySelector('#hx-month').value);if(!month)throw Error('Tháng phải có dạng MM/YYYY.');const day=w.querySelector('#hx-day').value;const date=day?buildDate(month,day):'';const chosen=[...w.querySelectorAll('[data-hx-type]:checked')].map(x=>types[Number(x.dataset.hxType)]).filter(Boolean);if(chosen.includes('Khác')){const detail=w.querySelector('#hx-other-text').value.trim();if(!detail)throw Error('Hãy nhập chi tiết cho công việc khác.');chosen.splice(chosen.indexOf('Khác'),1,`Khác: ${detail}`)}const next={...record,customer:w.querySelector('#hx-c').value.trim(),month,date,quantity:Math.max(0,Number(w.querySelector('#hx-q').value)||0),productName:w.querySelector('#hx-p').value.trim(),volume:w.querySelector('#hx-v').value.trim(),size:w.querySelector('#hx-s').value.trim(),designer:w.querySelector('#hx-user').value.trim(),editTypes:chosen,updatedAt:serverTimestamp()};await setDoc(doc(db,'workspaces',WORKSPACE,'products',id),next,{merge:true});const shares=await getDocs(collection(db,'workspaces',WORKSPACE,'shares'));for(const sh of shares.docs){if(sh.data().active===true)await setDoc(doc(db,'workspaces',WORKSPACE,'shares',sh.id,'products',id),next,{merge:true})}close();toast('Đã lưu thay đổi')}catch(e){toast(e.message||String(e))}};
}

async function hardDeleteShare(id,row){row?.remove();try{const q=await getDocs(collection(db,'workspaces',WORKSPACE,'shares',id,'products'));for(let i=0;i<q.docs.length;i+=400){const b=writeBatch(db);q.docs.slice(i,i+400).forEach(x=>b.delete(x.ref));await b.commit()}await deleteDoc(doc(db,'workspaces',WORKSPACE,'shares',id));toast('Đã xóa liên kết')}catch(e){toast(e.message||String(e));location.reload()}}

function patchStats(root){root.querySelectorAll('.stat-products').forEach(box=>{const legacy=box.querySelector(':scope > div:not(.stat-breakdown)');if(!legacy||box.querySelector('.stat-breakdown'))return;const text=legacy.textContent.trim();const out=document.createElement('div');out.className='stat-breakdown';const re=/([^:]+):\s*(\d+)/g;let m;let found=false;while((m=re.exec(text))){found=true;const row=document.createElement('div');row.className='stat-breakdown-row';row.innerHTML=`<span>${esc(m[1].trim())}</span><b>${m[2]}</b>`;out.appendChild(row)}if(found){legacy.remove();box.appendChild(out)}})}
function patchSettings(){const c=document.querySelector('#gp-client');if(!c)return;const action=c.closest('.actions');const role=document.querySelector('.connection span')?.textContent||'';if(action&&role!=='Chủ sở hữu'){c.remove();action.querySelector('#gp-save-client')?.remove()}}
function patchEditButtons(){document.querySelectorAll('[data-gp-edit]').forEach(b=>{if(b.dataset.gpHotfix==='1')return;b.dataset.gpHotfix='1';b.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();openEditor(b.dataset.gpEdit,!!location.hash.match(/^#share=/)).catch(err=>toast(err.message||String(err)))},true)})}
function patchShareDeletes(){document.querySelectorAll('[data-share-delete]').forEach(b=>{if(b.dataset.gpHotfix==='1')return;b.dataset.gpHotfix='1';b.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();hardDeleteShare(b.dataset.shareDelete,b.closest('[data-share-row]'))},true)})}
function installDomPatch(){patchStats(document);patchSettings();patchEditButtons();patchShareDeletes();const obs=new MutationObserver(()=>{patchStats(document);patchSettings();patchEditButtons();patchShareDeletes()});obs.observe(document.documentElement,{subtree:true,childList:true})}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',installDomPatch,{once:true});else installDomPatch();
window.GPProductionHotfix={gisPatched:()=>gisPatched,driveSessionKey:DRIVE_SESSION};
