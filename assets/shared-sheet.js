import { FIREBASE } from './config.js';
import { initializeApp, getApps, getApp } from 'https://www.gstatic.com/firebasejs/12.8.0/firebase-app.js';
import { getAuth, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/12.8.0/firebase-auth.js';
import { getFirestore, doc, getDoc, updateDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/12.8.0/firebase-firestore.js';

const app = getApps().length ? getApp() : initializeApp(FIREBASE);
const auth = getAuth(app);
const db = getFirestore(app);
const esc = v => String(v ?? '').replace(/[&<>\"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '\"':'&quot;', "'":'&#039;' }[c]));
const defaultCols = ['Sản phẩm','Kích thước','Thể tích','Số lượng','Designer','Ngày','Đường dẫn Drive','Hình ảnh'];
const params = new URLSearchParams(location.search);
const sheetId = params.get('id');

function toast(message) {
  let el = document.getElementById('sharedToast');
  if (!el) { el = document.createElement('div'); el.id='sharedToast'; el.className='toast'; document.body.appendChild(el); }
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(window.__sharedToast);
  window.__sharedToast = setTimeout(() => el.classList.remove('show'), 2600);
}

function shell(user, role) {
  document.body.innerHTML = `<div class="app">
    <aside class="sidebar">
      <div class="logo"><b>GP</b><span>STATISTICAL</span></div>
      <nav class="nav">
        <a href="index.html">⌂<span>Trang chủ</span></a>
        <a href="my-sheets.html">▦<span>Bảng kê của tôi</span></a>
        <a class="active" href="shared-sheets.html">↗<span>Bảng kê được chia sẻ</span></a>
        <a href="statistics.html">◔<span>Thống kê</span></a>
        <a href="settings.html">⚙<span>Cài đặt</span></a>
        <a href="donate.html">♥<span>Donate</span></a>
      </nav>
      <div class="account"><b>${esc(user.displayName || 'Tài khoản')}</b><small>${esc(user.email || '')}</small><button id="logout">Đăng xuất</button></div>
    </aside>
    <main class="main">
      <header class="top"><div><div class="eyebrow">ĐƯỢC CHIA SẺ</div><h1 id="pageTitle">Bảng kê</h1><div class="muted"><span id="roleBadge">Quyền: ${esc(role)}</span></div></div><div class="actions"><a class="btn" href="notifications.html">🔔</a></div></header>
      <div id="sharedContent"></div>
    </main>
  </div>`;
  document.getElementById('logout').onclick = async () => { await signOut(auth); location.href='login.html'; };
}

function errorView(title, text) {
  document.getElementById('sharedContent').innerHTML = `<section class="card empty-state"><div class="empty-icon">!</div><h2>${esc(title)}</h2><p class="muted">${esc(text)}</p><a class="btn" href="shared-sheets.html">Quay lại bảng kê được chia sẻ</a></section>`;
}

function renderTable(data, editable) {
  const content = document.getElementById('sharedContent');
  content.innerHTML = `<section class="card sheet-editor">
    <div class="toolbar">
      <div><div class="eyebrow">BẢNG KÊ</div><h2 id="titleEdit"></h2><span class="muted" id="meta"></span></div>
      <div class="sheet-tools">
        <button class="btn" id="back">← Quay lại</button>
        <button class="btn" id="addRow" ${editable?'':'disabled'}>＋ Hàng</button>
        <button class="btn" id="addCol" ${editable?'':'disabled'}>＋ Cột</button>
        <button class="btn" id="exportXlsx">Excel</button>
        <button class="btn" id="exportPdf">PDF</button>
        <button class="btn primary" id="save" ${editable?'':'disabled'}>Lưu</button>
      </div>
    </div>
    <div class="filters"><input class="input" id="find" placeholder="Tìm trong bảng kê..."></div>
    <div id="table"></div>
  </section>`;
  document.getElementById('titleEdit').textContent = data.name;
  document.getElementById('back').onclick = () => location.href='shared-sheets.html';

  const render = () => {
    const q = (document.getElementById('find').value || '').trim().toLowerCase();
    document.getElementById('table').innerHTML = `<div class="table-wrap"><table class="sheet-table"><thead><tr>${data.columns.map(c=>`<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${
      data.rows.length ? data.rows.map((r,i)=>{
        const text = data.columns.map(c=>r[c] || '').join(' ').toLowerCase();
        return `<tr ${q&&!text.includes(q)?'hidden':''}>${data.columns.map(c=>`<td class="cell" ${editable?'contenteditable="true"':''} data-i="${i}" data-c="${encodeURIComponent(c)}">${esc(r[c] || '')}</td>`).join('')}</tr>`;
      }).join('') : `<tr><td colspan="${data.columns.length}" class="empty">Bảng kê chưa có dữ liệu.</td></tr>`
    }</tbody></table></div>`;
    document.getElementById('meta').textContent = `${data.rows.length} dòng · ${editable?'Có quyền chỉnh sửa':'Chỉ xem'}`;
    if (editable) document.querySelectorAll('.cell').forEach(cell => cell.addEventListener('input', () => data.rows[+cell.dataset.i][decodeURIComponent(cell.dataset.c)] = cell.textContent.trim()));
  };

  document.getElementById('find').oninput = render;
  document.getElementById('addRow').onclick = () => { data.rows.push(Object.fromEntries(data.columns.map(c=>[c,'']))); render(); };
  document.getElementById('addCol').onclick = () => { const name=prompt('Tên cột mới'); if(name?.trim() && !data.columns.includes(name.trim())) { data.columns.push(name.trim()); data.rows.forEach(r=>r[name.trim()]=''); render(); } };
  document.getElementById('save').onclick = async () => { try { await updateDoc(doc(db,'sheets',sheetId), {name:data.name,columns:data.columns,rows:data.rows,updatedAt:serverTimestamp()}); toast('Đã lưu thay đổi.'); } catch(e) { toast('Không thể lưu thay đổi: '+e.message); } };
  document.getElementById('exportXlsx').onclick = () => exportExcel(data);
  document.getElementById('exportPdf').onclick = () => exportPdf(data);
  render();
}

async function exportExcel(data) {
  if (!window.ExcelJS) return toast('Không tải được thư viện Excel.');
  const wb = new ExcelJS.Workbook(); const ws = wb.addWorksheet('Bảng kê');
  ws.addRow(data.columns); data.rows.forEach(r=>ws.addRow(data.columns.map(c=>r[c]||'')));
  ws.getRow(1).font={bold:true}; ws.columns.forEach(c=>c.width=Math.max(14, Math.min(40, (c.header||'').length+12)));
  const blob = new Blob([await wb.xlsx.writeBuffer()], {type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`${data.name||'bang-ke'}.xlsx`; a.click(); URL.revokeObjectURL(a.href);
}

function exportPdf(data) {
  const jsPDF = window.jspdf?.jsPDF; if(!jsPDF) return toast('Không tải được thư viện PDF.');
  const pdf = new jsPDF({orientation:'landscape',unit:'mm',format:'a4'});
  pdf.setFontSize(14); pdf.text(data.name || 'Bảng kê', 10, 12);
  pdf.autoTable({head:[data.columns],body:data.rows.map(r=>data.columns.map(c=>r[c]||'')),startY:18,styles:{fontSize:7}});
  pdf.save(`${data.name||'bang-ke'}.pdf`);
}

async function load(user) {
  if (!sheetId) { location.href='shared-sheets.html'; return; }
  const permRef = doc(db,'sheetPermissions',`${sheetId}_${user.uid}`);
  const permSnap = await getDoc(permRef);
  if (!permSnap.exists()) { shell(user,'viewer'); errorView('Không có quyền truy cập','Bảng kê này không còn được chia sẻ cho tài khoản của bạn.'); return; }
  const permission = permSnap.data();
  const role = permission.role === 'editor' ? 'editor' : 'viewer';
  shell(user, role);
  const sheetSnap = await getDoc(doc(db,'sheets',sheetId));
  if (!sheetSnap.exists()) { errorView('Không tìm thấy bảng kê','Bảng kê có thể đã bị xóa bởi chủ sở hữu.'); return; }
  const raw = sheetSnap.data();
  const data = {name:raw.name||'Bảng kê',columns:[...(raw.columns||defaultCols)],rows:[...(raw.rows||[])]};
  document.getElementById('pageTitle').textContent = data.name;
  renderTable(data, role==='editor');
}

onAuthStateChanged(auth, async user => {
  if (!user) { location.href='login.html'; return; }
  try { await load(user); } catch (e) { shell(user,'viewer'); errorView('Không thể mở bảng kê',e.message || 'Đã xảy ra lỗi.'); }
});
