import { getApps, getApp } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js';
import { getFirestore, collection, getDocs, getDoc, doc, onSnapshot, writeBatch, deleteDoc } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';

const app = getApps()[0] || getApp();
const db = getFirestore(app);
const W = 'gp-statistical';
const root = document.getElementById('app');
let rendered = false;
let unsubscribe = null;
let timer = null;
const esc = v => String(v ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const norm = v => String(v ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim().toLowerCase();
const shareId = () => (location.hash.match(/^#share=([A-Za-z0-9_-]+)$/) || [])[1] || '';
const imageUrl = a => a?.thumbnailLink || (a?.id ? `https://drive.google.com/thumbnail?id=${encodeURIComponent(a.id)}&sz=w1600` : '');

async function read(id){
  const s = await getDoc(doc(db,'workspaces',W,'shares',id));
  if(!s.exists() || s.data().active !== true) throw Error('Liên kết này đã bị ẩn hoặc đã được xóa.');
  const q = await getDocs(collection(db,'workspaces',W,'shares',id,'products'));
  return {share:{id:s.id,...s.data()},rows:q.docs.map(x=>x.data())};
}

function draw(data, share){
  const q = norm(window.__gpShareSearch || '');
  const filtered = data.filter(r => !q || norm(`${r.customer} ${r.productName} ${r.volume} ${r.size} ${r.designer} ${(r.editTypes || []).join(' ')}`).includes(q));
  const customers=[...new Set(data.map(r=>r.customer).filter(Boolean))].sort();
  const designers=[...new Set(data.map(r=>r.designer).filter(Boolean))].sort();
  const types=[...new Set(data.flatMap(r=>r.editTypes||[]))].sort();
  root.innerHTML=`<main style="min-height:100vh;background:#f7f4ee;color:#142033;padding:36px;box-sizing:border-box;font-family:Inter,Arial,sans-serif"><div style="max-width:1500px;margin:auto"><div style="display:flex;justify-content:space-between;gap:24px;align-items:flex-end;flex-wrap:wrap;border-bottom:1px solid #ddd5c8;padding-bottom:24px"><div><div style="font-size:12px;font-weight:800;letter-spacing:3px;color:#ef6b3b">GP STATISTICAL · CHIA SẺ</div><h1 style="font-size:48px;line-height:1;margin:12px 0">${esc(share.name||'Danh sách sản phẩm')}</h1><div style="color:#737c89">${filtered.length} sản phẩm · Dữ liệu cập nhật theo bảng kê hiện tại</div></div><div style="display:flex;gap:10px;flex-wrap:wrap"><button id="ps-copy" style="padding:12px 16px;border:1px solid #d9d1c4;border-radius:12px;background:white;font-weight:700">Chia sẻ</button><button id="ps-xlsx" style="padding:12px 16px;border:1px solid #d9d1c4;border-radius:12px;background:white;font-weight:700">Xuất Excel</button><button id="ps-pdf" style="padding:12px 16px;border:1px solid #d9d1c4;border-radius:12px;background:white;font-weight:700">Xuất PDF / A4</button></div></div><div style="display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px;margin:20px 0"><select id="ps-c" style="padding:12px;border:1px solid #d9d1c4;border-radius:12px;background:white"><option value="">Tất cả khách hàng</option>${customers.map(x=>`<option>${esc(x)}</option>`).join('')}</select><select id="ps-d" style="padding:12px;border:1px solid #d9d1c4;border-radius:12px;background:white"><option value="">Tất cả người thực hiện</option>${designers.map(x=>`<option>${esc(x)}</option>`).join('')}</select><select id="ps-t" style="padding:12px;border:1px solid #d9d1c4;border-radius:12px;background:white"><option value="">Tất cả loại công việc</option>${types.map(x=>`<option>${esc(x)}</option>`).join('')}</select><input id="ps-search" value="${esc(window.__gpShareSearch||'')}" placeholder="Tìm kiếm…" style="padding:12px;border:1px solid #d9d1c4;border-radius:12px;background:white"><button id="ps-clear" style="padding:12px;border:1px solid #d9d1c4;border-radius:12px;background:white;font-weight:700">Xóa lọc</button></div><div style="overflow:auto;background:white;border:1px solid #ddd5c8;border-radius:18px"><table style="width:100%;border-collapse:collapse;min-width:1100px"><thead><tr>${['Hình','Khách hàng','Sản phẩm','Kích thước','Thể tích','SL','Người thực hiện','Công việc','Ngày','Drive'].map(x=>`<th style="text-align:left;padding:15px;border-bottom:1px solid #ddd5c8;background:#faf8f3;font-size:12px;letter-spacing:.8px">${x}</th>`).join('')}</tr></thead><tbody>${filtered.map(r=>`<tr><td style="padding:10px;border-bottom:1px solid #eee"><div style="display:flex;gap:8px">${(r.previewAssets||[]).slice(0,2).map(a=>`<button class="ps-img" data-id="${esc(a.id)}" style="padding:0;border:0;background:none"><img src="${esc(imageUrl(a))}" alt="" style="width:70px;height:70px;object-fit:cover;border-radius:12px;border:1px solid #ddd5c8" onerror="this.src='https://drive.google.com/thumbnail?id=${encodeURIComponent(a.id)}&sz=w1600'"></button>`).join('')}</div></td><td style="padding:12px;border-bottom:1px solid #eee">${esc(r.customer)}</td><td style="padding:12px;border-bottom:1px solid #eee"><b>${esc(r.productName)}</b><div style="font-size:12px;color:#8b929b">${esc(r.sourceFolderPath||'')}</div></td><td style="padding:12px;border-bottom:1px solid #eee">${esc(r.size||'—')}</td><td style="padding:12px;border-bottom:1px solid #eee">${esc(r.volume||'—')}</td><td style="padding:12px;border-bottom:1px solid #eee">${esc(r.quantity||0)}</td><td style="padding:12px;border-bottom:1px solid #eee">${esc(r.designer||'')}</td><td style="padding:12px;border-bottom:1px solid #eee">${(r.editTypes||[]).map(x=>`<span style="display:inline-block;padding:5px 8px;background:#f3e8df;border-radius:999px;margin:2px;font-size:12px">${esc(x)}</span>`).join('')}</td><td style="padding:12px;border-bottom:1px solid #eee">${esc(r.date||'')}</td><td style="padding:12px;border-bottom:1px solid #eee">${r.driveVariantFolderId?`<a href="https://drive.google.com/drive/folders/${encodeURIComponent(r.driveVariantFolderId)}" target="_blank" rel="noopener" style="color:#d8582d;font-weight:700;text-decoration:none">Mở thư mục ↗</a>`:'—'}</td></tr>`).join('')||'<tr><td colspan="10" style="padding:50px;text-align:center;color:#777">Không có dữ liệu phù hợp.</td></tr>'}</tbody></table></div></div></main>`;
  root.querySelector('#ps-copy').onclick=()=>navigator.clipboard?.writeText(location.href).then(()=>alert('Đã sao chép liên kết'));
  root.querySelector('#ps-search').oninput=e=>{window.__gpShareSearch=e.target.value;draw(data,share)};
  root.querySelector('#ps-c').onchange=e=>{window.__gpShareCustomer=e.target.value;applyFilters(data,share)};
  root.querySelector('#ps-d').onchange=e=>{window.__gpShareDesigner=e.target.value;applyFilters(data,share)};
  root.querySelector('#ps-t').onchange=e=>{window.__gpShareType=e.target.value;applyFilters(data,share)};
  root.querySelector('#ps-clear').onclick=()=>{window.__gpShareSearch='';window.__gpShareCustomer='';window.__gpShareDesigner='';window.__gpShareType='';draw(data,share)};
  root.querySelectorAll('.ps-img').forEach(b=>b.onclick=()=>{const a=data.flatMap(r=>r.previewAssets||[]).find(x=>x.id===b.dataset.id);if(!a)return;const m=document.createElement('div');m.style='position:fixed;inset:0;background:rgba(10,15,24,.85);display:grid;place-items:center;z-index:9999;padding:30px';m.innerHTML=`<div style="max-width:1200px;max-height:90vh;text-align:center"><button style="float:right;background:white;border:0;border-radius:50%;width:40px;height:40px;font-size:24px" id="pc">×</button><img src="${esc(imageUrl(a))}" style="max-width:90vw;max-height:80vh;object-fit:contain;border-radius:14px"><div style="color:white;margin-top:10px">${esc(a.name||'')}</div></div>`;document.body.appendChild(m);m.querySelector('#pc').onclick=()=>m.remove();m.onclick=e=>{if(e.target===m)m.remove()}});
  root.querySelector('#ps-xlsx').onclick=()=>{if(!window.XLSX)return alert('Chức năng xuất Excel chưa sẵn sàng.');const rows=[['STT','KHÁCH HÀNG','TÊN SẢN PHẨM','KÍCH THƯỚC','THỂ TÍCH','SỐ LƯỢNG','NGƯỜI THỰC HIỆN','CÔNG VIỆC','NGÀY'],...filtered.map((r,i)=>[i+1,r.customer||'',r.productName||'',r.size||'',r.volume||'',Number(r.quantity||0),r.designer||'',(r.editTypes||[]).join(', '),r.date||''])];const ws=XLSX.utils.aoa_to_sheet(rows),wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,'Bảng kê');XLSX.writeFile(wb,'GP-Statistical-Chia-se.xlsx')};
  root.querySelector('#ps-pdf').onclick=()=>window.print();
}
function applyFilters(data,share){const c=window.__gpShareCustomer||'',d=window.__gpShareDesigner||'',t=window.__gpShareType||'',q=norm(window.__gpShareSearch||'');const f=data.filter(r=>(!c||r.customer===c)&&(!d||r.designer===d)&&(!t||(r.editTypes||[]).includes(t))&&(!q||norm(`${r.customer} ${r.productName} ${r.volume} ${r.size} ${r.designer} ${(r.editTypes||[]).join(' ')}`).includes(q)));draw(f,share)}
async function mount(){const id=shareId();if(!id)return false;try{const {share,rows}=await read(id);rendered=true;draw(rows,share);if(unsubscribe)unsubscribe();unsubscribe=onSnapshot(collection(db,'workspaces',W,'shares',id,'products'),qs=>draw(qs.docs.map(x=>x.data()),share));return true}catch(e){root.innerHTML=`<main style="min-height:100vh;display:grid;place-items:center;background:#f7f4ee;font-family:Inter,Arial"><div style="background:white;border:1px solid #ddd5c8;border-radius:24px;padding:40px;max-width:620px"><div style="font-size:12px;font-weight:800;letter-spacing:3px;color:#ef6b3b">GP STATISTICAL</div><h1>Không thể mở liên kết</h1><p>${esc(e.message||'Không thể tải dữ liệu chia sẻ.')}</p></div></main>`;return true}}
function watch(){const id=shareId();if(id){mount();if(timer)clearInterval(timer);timer=setInterval(()=>{if(shareId()===id && (!root || !root.textContent.trim()))mount()},3000)}else{if(timer)clearInterval(timer);if(unsubscribe){unsubscribe();unsubscribe=null}}}
window.addEventListener('hashchange',watch);watch();

// Remove stale share rows immediately and permanently when an owner presses Xóa.
document.addEventListener('click',async e=>{
  const b=e.target.closest('button');if(!b||String(b.textContent).trim()!=='Xóa')return;
  const row=b.closest('[data-share-row],.share-row,article,section,li,div');
  const link=row?.querySelector?.('a[href*="#share="]');
  const id=(link?.href.match(/#share=([A-Za-z0-9_-]+)/)||[])[1];
  if(!id)return;
  e.preventDefault();e.stopImmediatePropagation();
  try{const q=await getDocs(collection(db,'workspaces',W,'shares',id,'products'));for(let i=0;i<q.docs.length;i+=400){const batch=writeBatch(db);q.docs.slice(i,i+400).forEach(x=>batch.delete(x.ref));await batch.commit()}await deleteDoc(doc(db,'workspaces',W,'shares',id));row.remove()}catch(err){console.error(err)}
},true);
