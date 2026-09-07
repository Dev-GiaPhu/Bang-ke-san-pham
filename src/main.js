const STORE = 'ventek-design-tracker-v2';
const SETTINGS = 'ventek-design-settings-v2';
const defaultSettings = {
  designers: ['Gia Phú'],
  editTypes: ['Design mới', 'Sửa thông tin', 'Update thông tin', 'Sửa kích thước'],
  googleClientId: '',
  pageSize: 50
};
const state = {
  view: 'dashboard',
  records: load(STORE, []),
  settings: { ...defaultSettings, ...load(SETTINGS, {}) },
  month: new Date().toISOString().slice(0, 7),
  search: '',
  filters: [],
  token: null,
  tokenClient: null,
  scanRows: [],
  imageCache: new Map(),
  loadingImages: new Set()
};

const app = document.querySelector('#app');
const esc = (v = '') => String(v).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;' }[c]));
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);
function load(key, fallback) { try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); } catch { return fallback; } }
function save() { localStorage.setItem(STORE, JSON.stringify(state.records)); localStorage.setItem(SETTINGS, JSON.stringify(state.settings)); }
function monthLabel(m) { if (!m) return ''; const [y, mo] = m.split('-'); return `${mo}/${y}`; }
function normalize(s) { return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim(); }
function isAssetFolder(name) { return /^(?:0?[1-9]|10)\s*[-_.]\s*(final|mockup|source|draft|preview|output|print|artwork|file)$/i.test(name.trim()) || /^(final|mockup|source|draft|preview|output)$/i.test(name.trim()); }
function isVolumeOnly(s) { return /^\d+(?:[.,]\d+)?\s?(?:ml|cl|l|lit|liter|litre)$/i.test(s.trim()); }
function isSizeOnly(s) { return /^(?:A[0-6]|\d{2,5}\s*[x×]\s*\d{2,5})$/i.test(s.trim()); }
function parseVolume(s) { const m = String(s || '').match(/(?<!\w)(\d+(?:[.,]\d+)?)\s?(ml|cl|l|lit|liter|litre)(?!\w)/i); return m ? m[0].replace(/\s+/g, '').replace(/lit(?:er|re)?$/i, 'L').replace(/l$/i, 'L') : ''; }
function parseSize(s) { const m = String(s || '').match(/\b\d{2,5}\s*[x×]\s*\d{2,5}\b/i) || String(s || '').match(/\bA[0-6]\b/i); return m ? m[0].replace(/\s+/g, '').replace('×','x').toUpperCase() : ''; }
function cleanProductName(s) {
  return String(s || '').replace(/\.[^.]+$/, '').replace(/(?:[_-])\d{1,4}$/,'').replace(/__+/g,'_').replace(/[_-]+$/,'').replace(/^[_-]+/,'').trim();
}
function parseDriveItem(file, folderPath = []) {
  const raw = cleanProductName(file.name);
  const volume = parseVolume(raw) || parseVolume(folderPath.slice().reverse().find(isVolumeOnly) || '');
  const size = parseSize(raw) || parseSize(folderPath.slice().reverse().find(isSizeOnly) || '');
  let product = raw
    .replace(/(?<!\w)\d+(?:[.,]\d+)?\s?(?:ml|cl|l|lit|liter|litre)(?!\w)/ig, '')
    .replace(/\b\d{2,5}\s*[x×]\s*\d{2,5}\b/ig, '')
    .replace(/\bA[0-6]\b/ig, '')
    .replace(/__+/g, '_').replace(/[_-]+/g, ' ').trim();
  const generic = !product || /^(final|mockup|source|draft|preview|output|artwork|design|image|img|01|02|03)$/i.test(product);
  if (generic) {
    const candidate = [...folderPath].reverse().find(p => p && !isAssetFolder(p) && !isVolumeOnly(p) && !isSizeOnly(p));
    product = candidate || '';
  }
  return {
    id: uid(), productName: cleanProductName(product), volume, size, quantity: 1,
    sourceFileName: file.name, sourceFolderPath: folderPath.join(' / '),
    driveFileId: file.id, driveImageUrl: '', driveFolderUrl: folderPath._folderUrl || '', mimeType: file.mimeType || '',
    thumbnailLink: file.thumbnailLink || ''
  };
}
function extractDriveId(input) {
  const url = String(input || '').trim();
  const patterns = [/\/folders\/([a-zA-Z0-9_-]+)/, /[?&]id=([a-zA-Z0-9_-]+)/, /\/d\/([a-zA-Z0-9_-]+)/];
  for (const p of patterns) { const m = url.match(p); if (m) return m[1]; }
  if (/^[a-zA-Z0-9_-]{10,}$/.test(url)) return url;
  return '';
}
function driveUrl(id) { return `https://drive.google.com/drive/folders/${id}`; }
async function driveFetch(url) {
  if (!state.token) throw new Error('Chưa kết nối Google Drive.');
  const res = await fetch(url, { headers: { Authorization: `Bearer ${state.token}` } });
  if (res.status === 401) { state.token = null; throw new Error('Phiên Google Drive đã hết hạn. Hãy kết nối lại.'); }
  if (!res.ok) { let detail = ''; try { detail = (await res.json()).error?.message || ''; } catch {} throw new Error(detail || `Google Drive trả về lỗi ${res.status}.`); }
  return res.json();
}
async function listFolder(folderId, path = [], out = []) {
  let pageToken = '';
  do {
    const params = new URLSearchParams({ q: `'${folderId}' in parents and trashed = false`, pageSize: '1000', fields: 'nextPageToken,files(id,name,mimeType,thumbnailLink,webViewLink,modifiedTime,size)' });
    if (pageToken) params.set('pageToken', pageToken);
    const data = await driveFetch(`https://www.googleapis.com/drive/v3/files?${params}`);
    for (const file of data.files || []) {
      if (file.mimeType === 'application/vnd.google-apps.folder') await listFolder(file.id, [...path, file.name], out);
      else out.push({ ...file, folderPath: path });
    }
    pageToken = data.nextPageToken || '';
  } while (pageToken);
  return out;
}
async function scanDrive(folderUrl, statusEl) {
  const folderId = extractDriveId(folderUrl);
  if (!folderId) throw new Error('Link Drive không hợp lệ hoặc không chứa Folder ID.');
  if (!state.token) await connectDrive(true);
  statusEl.className = 'scan-status'; statusEl.textContent = 'Đang quét toàn bộ thư mục và các thư mục con…';
  const root = await driveFetch(`https://www.googleapis.com/drive/v3/files/${folderId}?fields=id,name,mimeType,webViewLink`);
  if (root.mimeType !== 'application/vnd.google-apps.folder') throw new Error('Link phải trỏ tới một thư mục Google Drive.');
  const files = await listFolder(folderId, [root.name]);
  const images = files.filter(f => /^image\//i.test(f.mimeType || '') || /\.(png|jpe?g|webp|gif|bmp|tiff?)$/i.test(f.name));
  const grouped = new Map();
  for (const file of images) {
    const parsed = parseDriveItem(file, file.folderPath);
    parsed.driveFolderUrl = root.webViewLink || driveUrl(folderId);
    const key = normalize(`${parsed.productName}|${parsed.volume}|${parsed.size}`);
    if (!grouped.has(key)) grouped.set(key, parsed);
    else {
      const existing = grouped.get(key);
      if (!existing.driveFileId || /mockup|preview|draft/i.test(existing.sourceFileName)) Object.assign(existing, parsed);
    }
  }
  state.scanRows = [...grouped.values()].filter(r => r.productName || r.volume || r.size);
  statusEl.className = 'scan-status ok'; statusEl.textContent = `Đã đọc ${files.length} file, tìm thấy ${images.length} ảnh và gom thành ${state.scanRows.length} sản phẩm/variant.`;
  renderScanPreview();
}
async function connectDrive(silent = false) {
  if (!state.settings.googleClientId) { openSettings('drive'); throw new Error('Chưa cấu hình Google OAuth Client ID.'); }
  if (!window.google?.accounts?.oauth2) throw new Error('Google Identity Services chưa tải xong. Hãy tải lại trang.');
  return new Promise((resolve, reject) => {
    state.tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: state.settings.googleClientId,
      scope: 'https://www.googleapis.com/auth/drive.readonly',
      callback: response => { if (response.error) reject(new Error(response.error)); else { state.token = response.access_token; render(); resolve(response.access_token); } }
    });
    state.tokenClient.requestAccessToken({ prompt: silent ? '' : 'consent' });
  });
}
async function loadImage(fileId) {
  if (!state.token || state.imageCache.has(fileId) || state.loadingImages.has(fileId)) return;
  state.loadingImages.add(fileId);
  try {
    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`, { headers: { Authorization: `Bearer ${state.token}` } });
    if (!res.ok) throw new Error();
    const blob = await res.blob(); state.imageCache.set(fileId, URL.createObjectURL(blob)); render();
  } catch {} finally { state.loadingImages.delete(fileId); }
}
function imgFor(r) {
  if (r.driveImageUrl) return r.driveImageUrl;
  if (r.driveFileId && state.imageCache.has(r.driveFileId)) return state.imageCache.get(r.driveFileId);
  if (r.driveFileId && state.token) loadImage(r.driveFileId);
  return '';
}
function activeRecords() {
  return state.records.filter(r => {
    if (state.month && r.month !== state.month) return false;
    if (state.search && !normalize(`${r.productName} ${r.volume} ${r.size} ${r.designer}`).includes(normalize(state.search))) return false;
    return state.filters.every(f => {
      const value = String(r[f.field] ?? (f.field === 'editTypes' ? r.editTypes.join(', ') : '')).toLowerCase();
      const target = String(f.value || '').toLowerCase();
      if (f.op === 'contains') return value.includes(target);
      if (f.op === 'equals') return value === target;
      if (f.op === 'not') return value !== target;
      return true;
    });
  });
}
function render() {
  const data = activeRecords();
  if (state.view === 'dashboard') renderDashboard(data); else if (state.view === 'list') renderList(data); else if (state.view === 'stats') renderStats(data); else renderSettings();
}
function sidebar() { return `<aside class="sidebar"><div class="brand">VENTEK <span>DESIGN</span></div><div class="nav">${[['dashboard','▦ Tổng quan'],['list','▤ Danh sách'],['stats','◒ Thống kê'],['settings','⚙ Cài đặt']].map(([v,t])=>`<button class="${state.view===v?'active':''}" data-view="${v}">${t}</button>`).join('')}<button id="addNav">＋ Thêm sản phẩm</button></div><div class="side-bottom"><div class="connection"><strong><span class="status-dot ${state.token?'ok':''}"></span>${state.token?'Google Drive đã kết nối':'Drive chưa kết nối'}</strong>${state.token?'Có thể quét folder Drive riêng tư.':'Cấu hình OAuth trong Cài đặt.'}</div></div></aside>`; }
function layout(content) { app.innerHTML = `<div class="shell">${sidebar()}<main class="main">${content}</main></div>`; document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{state.view=b.dataset.view;render()}); document.querySelector('#addNav')?.addEventListener('click', openAddModal); }
function header(title, sub) { return `<div class="top"><div><h1 class="title">${title}</h1><div class="muted">${sub}</div></div><div class="actions"><button class="btn" id="driveConnect">${state.token?'Drive đã kết nối':'Kết nối Google Drive'}</button><button class="btn primary" id="addBtn">＋ Thêm sản phẩm</button></div></div>`; }
function filterBar() { return `<div class="filters"><input class="input" id="monthFilter" type="month" value="${esc(state.month)}"><input class="input wide" id="searchFilter" placeholder="Tìm sản phẩm, thể tích, kích thước, người thực hiện…" value="${esc(state.search)}"><button class="btn" id="moreFilter">${state.filters.length?'Bộ lọc nâng cao ('+state.filters.length+')':'Bộ lọc nâng cao'}</button><button class="btn" id="clearFilter">Xóa lọc</button></div>`; }
function bindCommon() { document.querySelector('#addBtn')?.addEventListener('click', openAddModal); document.querySelector('#driveConnect')?.addEventListener('click',()=>state.token?toast('Google Drive đang kết nối.'):connectDrive(false).catch(e=>toast(e.message))); document.querySelector('#monthFilter')?.addEventListener('change',e=>{state.month=e.target.value;render()}); document.querySelector('#searchFilter')?.addEventListener('input',e=>{state.search=e.target.value;render()}); document.querySelector('#moreFilter')?.addEventListener('click',openFilterModal); document.querySelector('#clearFilter')?.addEventListener('click',()=>{state.search='';state.filters=[];render()}); }
function renderDashboard(data) {
  const qty=data.reduce((n,r)=>n+(Number(r.quantity)||0),0), fresh=data.filter(r=>r.editTypes.includes('Design mới')).length;
  const designers=[...new Set(data.map(r=>r.designer).filter(Boolean))];
  layout(`${header('Bảng kê sản phẩm',`Tháng ${monthLabel(state.month)} · ${data.length} dòng đang hiển thị`)}${filterBar()}<section class="grid"><div class="card"><div class="muted">Tổng sản phẩm / variant</div><div class="metric">${data.length}</div></div><div class="card"><div class="muted">Tổng số lượng</div><div class="metric">${qty}</div></div><div class="card"><div class="muted">Design mới</div><div class="metric">${fresh}</div></div><div class="card"><div class="muted">Chỉnh sửa / Update</div><div class="metric">${Math.max(0,data.length-fresh)}</div></div></section><div class="chart-grid"><div class="card"><div class="section-head"><h2>Theo người thực hiện</h2><span class="count">${designers.length} người</span></div>${barList(designers.map(d=>[d,data.filter(r=>r.designer===d).length]))}</div><div class="card"><div class="section-head"><h2>Theo loại công việc</h2></div>${barList(state.settings.editTypes.map(t=>[t,data.filter(r=>r.editTypes.includes(t)).length]).filter(x=>x[1]>0))}</div></div><div class="card" style="margin-top:14px"><div class="section-head"><h2>Sản phẩm gần đây</h2><button class="btn" id="goList">Xem toàn bộ</button></div>${miniTable(data.slice(0,8))}</div>`); bindCommon(); document.querySelector('#goList').onclick=()=>{state.view='list';render()}; }
function barList(items){const max=Math.max(1,...items.map(x=>x[1]));return items.length?`<div class="bar-list">${items.map(([name,n])=>`<div class="bar-line"><span>${esc(name)}</span><div class="bar-track"><div class="bar-fill" style="width:${Math.round(n/max*100)}%"></div></div><b>${n}</b></div>`).join('')}</div>`:'<div class="empty">Chưa có dữ liệu.</div>';}
function miniTable(data){return `<div class="table-card"><table class="table"><thead><tr><th>Hình</th><th>Sản phẩm</th><th>Thể tích</th><th>Kích thước</th><th>Designer</th><th>Công việc</th></tr></thead><tbody>${data.length?data.map(rowHtml).join(''):'<tr><td colspan="6" class="empty">Chưa có sản phẩm.</td></tr>'}</tbody></table></div>`;}
function rowHtml(r){const src=imgFor(r);return `<tr><td>${src?`<img class="thumb clickable" data-open-image="${esc(r.driveFileId||'')}" src="${esc(src)}">`:'<div class="thumb"></div>'}</td><td><b>${esc(r.productName||'Chưa có tên')}</b><div class="muted">${esc(r.sourceFileName||'')}</div></td><td>${esc(r.volume||'—')}</td><td>${esc(r.size||'—')}</td><td>${esc(r.designer||'—')}</td><td>${(r.editTypes||[]).map(x=>`<span class="pill">${esc(x)}</span>`).join('')}</td></tr>`;}
function renderList(data){layout(`${header('Danh sách sản phẩm',`Dữ liệu tháng ${monthLabel(state.month)}`)}${filterBar()}<div class="card table-card"><div class="toolbar"><span class="count">${data.length} sản phẩm / variant</span><div class="actions"><button class="btn" id="exportBtn">Xuất JSON</button><button class="btn" id="csvBtn">Xuất CSV</button></div></div><table class="table"><thead><tr><th>Hình</th><th>Sản phẩm</th><th>Size</th><th>Thể tích</th><th>SL</th><th>Designer</th><th>Công việc</th><th>Ngày</th><th></th></tr></thead><tbody>${data.length?data.map(r=>{const src=imgFor(r);return `<tr><td>${src?`<img class="thumb clickable" src="${esc(src)}" data-open-image="${esc(r.driveFileId||'')}">`:'<div class="thumb"></div>'}</td><td><b>${esc(r.productName||'')}</b><div class="muted">${esc(r.sourceFileName||'')}</div></td><td>${esc(r.size||'—')}</td><td>${esc(r.volume||'—')}</td><td>${esc(r.quantity)}</td><td>${esc(r.designer||'—')}</td><td>${(r.editTypes||[]).map(x=>`<span class="pill">${esc(x)}</span>`).join('')}</td><td class="no-wrap">${esc(r.date||'—')}</td><td><div class="edit-actions"><button class="btn" data-edit="${r.id}">Sửa</button><button class="btn danger" data-delete="${r.id}">Xóa</button></div></td></tr>`}).join(''):'<tr><td colspan="9" class="empty">Chưa có dữ liệu trong bộ lọc hiện tại.</td></tr>'}</tbody></table></div>`); bindCommon(); document.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>editRecord(b.dataset.edit)); document.querySelectorAll('[data-delete]').forEach(b=>b.onclick=()=>deleteRecord(b.dataset.delete)); document.querySelector('#exportBtn').onclick=exportJson; document.querySelector('#csvBtn').onclick=exportCsv; }
function renderStats(data){const byMonth={};state.records.forEach(r=>{byMonth[r.month]=(byMonth[r.month]||0)+1});layout(`${header('Thống kê',`Tổng hợp theo bộ lọc hiện tại · ${data.length} sản phẩm`)}${filterBar()}<div class="card"><div class="section-head"><h2>Thống kê chi tiết</h2><span class="count">${monthLabel(state.month)}</span></div><div class="grid"><div><div class="muted">Số dòng</div><div class="metric">${data.length}</div></div><div><div class="muted">Số lượng</div><div class="metric">${data.reduce((a,r)=>a+Number(r.quantity||0),0)}</div></div><div><div class="muted">Design mới</div><div class="metric">${data.filter(r=>r.editTypes.includes('Design mới')).length}</div></div><div><div class="muted">Designer</div><div class="metric">${new Set(data.map(r=>r.designer)).size}</div></div></div></div><div class="chart-grid"><div class="card"><div class="section-head"><h2>Designer</h2></div>${barList(state.settings.designers.map(d=>[d,data.filter(r=>r.designer===d).length]).filter(x=>x[1]))}</div><div class="card"><div class="section-head"><h2>Loại công việc</h2></div>${barList(state.settings.editTypes.map(t=>[t,data.filter(r=>r.editTypes.includes(t)).length]).filter(x=>x[1]))}</div></div>`);bindCommon();}
function renderSettings(){layout(`${header('Cài đặt','Danh sách designer, loại công việc và kết nối Google Drive')}<div class="card"><div class="section-head"><h2>Google Drive</h2><span class="count">Read-only</span></div><div class="field"><label>Google OAuth Client ID</label><input class="input wide" id="clientId" value="${esc(state.settings.googleClientId)}" placeholder="1234567890-xxxxx.apps.googleusercontent.com"><div class="field-help">Tạo OAuth Client ID loại Web application trong Google Cloud, thêm domain triển khai vào Authorized JavaScript origins.</div></div><div class="actions" style="margin-top:12px"><button class="btn primary" id="saveClient">Lưu & kiểm tra</button>${state.token?'<button class="btn" id="disconnect">Ngắt kết nối</button>':''}</div></div><div class="chart-grid"><div class="card"><div class="section-head"><h2>Người thực hiện</h2></div><div class="filters"><input class="input" id="newDesigner" placeholder="Tên designer"><button class="btn primary" id="addDesigner">Thêm</button></div><div>${state.settings.designers.map((d,i)=>`<span class="pill">${esc(d)} <button data-remove-designer="${i}" style="border:0;background:none;cursor:pointer">×</button></span>`).join('')}</div></div><div class="card"><div class="section-head"><h2>Loại chỉnh sửa</h2></div><div class="filters"><input class="input" id="newEdit" placeholder="Ví dụ: Chỉnh màu"><button class="btn primary" id="addEdit">Thêm</button></div><div>${state.settings.editTypes.map((d,i)=>`<span class="pill">${esc(d)} <button data-remove-edit="${i}" style="border:0;background:none;cursor:pointer">×</button></span>`).join('')}</div></div></div><div class="card" style="margin-top:14px"><div class="section-head"><h2>Sao lưu dữ liệu</h2></div><div class="actions"><button class="btn" id="backup">Xuất toàn bộ dữ liệu</button><label class="btn">Nhập JSON<input id="restore" type="file" accept="application/json" hidden></label><button class="btn danger" id="clearAll">Xóa toàn bộ dữ liệu</button></div></div>`); document.querySelector('#saveClient').onclick=()=>{state.settings.googleClientId=document.querySelector('#clientId').value.trim();save();toast('Đã lưu Google Client ID');render()};document.querySelector('#disconnect')?.addEventListener('click',()=>{state.token=null;render()});document.querySelector('#addDesigner').onclick=()=>{const v=document.querySelector('#newDesigner').value.trim();if(v&&!state.settings.designers.includes(v)){state.settings.designers.push(v);save();render()}};document.querySelector('#addEdit').onclick=()=>{const v=document.querySelector('#newEdit').value.trim();if(v&&!state.settings.editTypes.includes(v)){state.settings.editTypes.push(v);save();render()}};document.querySelectorAll('[data-remove-designer]').forEach(b=>b.onclick=()=>{state.settings.designers.splice(Number(b.dataset.removeDesigner),1);save();render()});document.querySelectorAll('[data-remove-edit]').forEach(b=>b.onclick=()=>{state.settings.editTypes.splice(Number(b.dataset.removeEdit),1);save();render()});document.querySelector('#backup').onclick=exportJson;document.querySelector('#restore').onchange=restoreJson;document.querySelector('#clearAll').onclick=()=>{if(confirm('Xóa toàn bộ dữ liệu sản phẩm? Không thể hoàn tác.')){state.records=[];save();render()}};}
function openSettings(focus){state.view='settings';render();setTimeout(()=>document.querySelector('#clientId')?.focus(),50);}
function openFilterModal(){const wrap=document.createElement('div');wrap.className='modal-backdrop';wrap.innerHTML=`<div class="modal small"><div class="modal-head"><div><h2>Bộ lọc nâng cao</h2><div class="muted">Các điều kiện được áp dụng theo AND.</div></div><button class="btn" id="x">Đóng</button></div><div class="filter-builder" id="fb"></div><div class="actions" style="justify-content:space-between;margin-top:14px"><button class="btn" id="addCond">＋ Thêm điều kiện</button><button class="btn primary" id="apply">Áp dụng</button></div></div>`;document.body.appendChild(wrap);const fields=[['designer','Người thực hiện'],['productName','Tên sản phẩm'],['volume','Thể tích'],['size','Kích thước'],['editTypes','Loại công việc']];function draw(){wrap.querySelector('#fb').innerHTML=state.filters.map((f,i)=>`<div class="filter-row"><select class="select" data-f="field" data-i="${i}">${fields.map(([v,l])=>`<option value="${v}" ${f.field===v?'selected':''}>${l}</option>`).join('')}</select><select class="select" data-f="op" data-i="${i}"><option value="equals" ${f.op==='equals'?'selected':''}>Bằng</option><option value="contains" ${f.op==='contains'?'selected':''}>Chứa</option><option value="not" ${f.op==='not'?'selected':''}>Khác</option></select><input class="input" data-f="value" data-i="${i}" value="${esc(f.value)}" placeholder="Giá trị"><button class="btn danger" data-del="${i}">×</button></div>`).join('')||'<div class="muted">Chưa có điều kiện.</div>';wrap.querySelectorAll('[data-f]').forEach(el=>el.oninput=()=>{state.filters[Number(el.dataset.i)][el.dataset.f]=el.value});wrap.querySelectorAll('[data-del]').forEach(b=>b.onclick=()=>{state.filters.splice(Number(b.dataset.del),1);draw()})}draw();wrap.querySelector('#x').onclick=()=>wrap.remove();wrap.querySelector('#addCond').onclick=()=>{state.filters.push({field:'designer',op:'equals',value:''});draw()};wrap.querySelector('#apply').onclick=()=>{wrap.remove();render()};}
function openAddModal(){const wrap=document.createElement('div');wrap.className='modal-backdrop';wrap.innerHTML=`<div class="modal"><div class="modal-head"><div><h2>Thêm sản phẩm từ Google Drive</h2><div class="muted">Bạn tự quản lý folder Drive. App chỉ đọc folder bạn cung cấp.</div></div><button class="btn" id="close">Đóng</button></div><div class="form-grid"><div class="field"><label>Tháng</label><input class="input" id="m" type="month" value="${esc(state.month)}"></div><div class="field"><label>Người thực hiện</label><select class="select" id="d">${state.settings.designers.map(x=>`<option>${esc(x)}</option>`).join('')}</select></div><div class="field"><label>Loại chỉnh sửa</label><select class="select multi" id="e" multiple size="4">${state.settings.editTypes.map(x=>`<option>${esc(x)}</option>`).join('')}</select></div></div><div class="field"><label>Link folder Google Drive</label><div class="drive-row"><input class="input wide" id="drive" placeholder="https://drive.google.com/drive/folders/..."/><button class="btn primary" id="scan">Đọc Drive</button></div><div class="field-help">App quét cả thư mục con, bỏ qua Final/Mockup/Source như asset riêng và gom các file cùng sản phẩm + thể tích + kích thước thành một variant.</div></div><div id="status" class="scan-status">Chưa quét Drive.</div><div id="preview"></div><div class="actions" style="justify-content:flex-end;margin-top:18px"><button class="btn" id="cancel">Hủy</button><button class="btn primary" id="confirm" disabled>Xác nhận & thêm</button></div></div>`;document.body.appendChild(wrap);state.scanRows=[];wrap.querySelector('#close').onclick=wrap.querySelector('#cancel').onclick=()=>wrap.remove();wrap.querySelector('#scan').onclick=async()=>{try{await scanDrive(wrap.querySelector('#drive').value,wrap.querySelector('#status'));}catch(e){const s=wrap.querySelector('#status');s.className='scan-status err';s.textContent=e.message}};wrap.querySelector('#confirm').onclick=()=>{const editTypes=[...wrap.querySelector('#e').selectedOptions].map(x=>x.value);if(!editTypes.length){toast('Chọn ít nhất một loại công việc.');return}const month=wrap.querySelector('#m').value,designer=wrap.querySelector('#d').value,drive=wrap.querySelector('#drive').value;const rows=state.scanRows.map(r=>({...r,id:uid(),month,designer,editTypes,driveFolderUrl:r.driveFolderUrl||drive,date:new Date().toISOString().slice(0,10),createdAt:new Date().toISOString()}));state.records.push(...rows);state.month=month;save();wrap.remove();toast(`Đã thêm ${rows.length} sản phẩm / variant`);state.view='list';render()};}
function renderScanPreview(){const wrap=document.querySelector('.modal');if(!wrap)return;const preview=wrap.querySelector('#preview');preview.innerHTML=`<div class="preview"><table><thead><tr><th>Ảnh</th><th>Tên sản phẩm</th><th>Thể tích</th><th>Kích thước</th><th>Số lượng</th><th>File nguồn</th></tr></thead><tbody>${state.scanRows.map((r,i)=>`<tr><td>${r.driveFileId?`<span class="muted">Ảnh Drive</span>`:'—'}</td><td><input data-scan="productName" data-i="${i}" value="${esc(r.productName)}"></td><td><input data-scan="volume" data-i="${i}" value="${esc(r.volume)}"></td><td><input data-scan="size" data-i="${i}" value="${esc(r.size)}"></td><td><input class="tiny" type="number" min="1" data-scan="quantity" data-i="${i}" value="${esc(r.quantity)}"></td><td><span class="muted">${esc(r.sourceFileName)}</span></td></tr>`).join('')}</tbody></table></div>`;preview.querySelectorAll('[data-scan]').forEach(el=>el.oninput=()=>state.scanRows[Number(el.dataset.i)][el.dataset.scan]=el.value);wrap.querySelector('#confirm').disabled=!state.scanRows.length;}
function editRecord(id){const r=state.records.find(x=>x.id===id);if(!r)return;const wrap=document.createElement('div');wrap.className='modal-backdrop';wrap.innerHTML=`<div class="modal small"><div class="modal-head"><div><h2>Sửa sản phẩm</h2></div><button class="btn" id="x">Đóng</button></div><div class="form-grid" style="grid-template-columns:1fr 1fr"><div class="field"><label>Tên sản phẩm</label><input class="input" id="pn" value="${esc(r.productName)}"></div><div class="field"><label>Thể tích</label><input class="input" id="vo" value="${esc(r.volume)}"></div><div class="field"><label>Kích thước</label><input class="input" id="sz" value="${esc(r.size)}"></div><div class="field"><label>Số lượng</label><input class="input" id="qt" type="number" min="1" value="${esc(r.quantity)}"></div><div class="field"><label>Người thực hiện</label><select class="select" id="ds">${state.settings.designers.map(x=>`<option ${x===r.designer?'selected':''}>${esc(x)}</option>`).join('')}</select></div><div class="field"><label>Ngày thực hiện</label><input class="input" id="dt" type="date" value="${esc(r.date)}"></div></div><div class="field"><label>Loại chỉnh sửa</label><select class="select multi" id="et" multiple size="4">${state.settings.editTypes.map(x=>`<option ${r.editTypes.includes(x)?'selected':''}>${esc(x)}</option>`).join('')}</select></div><div class="actions" style="justify-content:flex-end;margin-top:18px"><button class="btn" id="cancel">Hủy</button><button class="btn primary" id="save">Lưu thay đổi</button></div></div>`;document.body.appendChild(wrap);wrap.querySelector('#x').onclick=wrap.querySelector('#cancel').onclick=()=>wrap.remove();wrap.querySelector('#save').onclick=()=>{Object.assign(r,{productName:wrap.querySelector('#pn').value.trim(),volume:wrap.querySelector('#vo').value.trim(),size:wrap.querySelector('#sz').value.trim(),quantity:Math.max(1,Number(wrap.querySelector('#qt').value)||1),designer:wrap.querySelector('#ds').value,date:wrap.querySelector('#dt').value,editTypes:[...wrap.querySelector('#et').selectedOptions].map(o=>o.value)});save();wrap.remove();render();toast('Đã lưu thay đổi')};}
function deleteRecord(id){if(confirm('Xóa sản phẩm này khỏi bảng kê?')){state.records=state.records.filter(r=>r.id!==id);save();render();toast('Đã xóa')}}
function download(name,text,type='application/json'){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type}));a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}
function exportJson(){download(`ventek-${state.month||'all'}-${Date.now()}.json`,JSON.stringify({version:2,settings:state.settings,records:state.records},null,2));}
function csvEscape(v){return `"${String(v??'').replace(/"/g,'""')}"`;}
function exportCsv(){const cols=['month','date','productName','volume','size','quantity','designer','editTypes','driveFolderUrl','driveFileId','sourceFileName','sourceFolderPath'];const lines=[cols.map(csvEscape).join(','),...activeRecords().map(r=>cols.map(c=>csvEscape(Array.isArray(r[c])?r[c].join(' | '):r[c])).join(','))];download(`ventek-${state.month||'all'}.csv`,lines.join('\n'),'text/csv;charset=utf-8')}
function restoreJson(e){const file=e.target.files?.[0];if(!file)return;const reader=new FileReader();reader.onload=()=>{try{const x=JSON.parse(reader.result);if(!Array.isArray(x.records))throw new Error();state.records=x.records;state.settings={...defaultSettings,...(x.settings||{})};save();render();toast('Đã khôi phục dữ liệu')}catch{toast('File JSON không hợp lệ')}};reader.readAsText(file)}
function toast(text){const x=document.createElement('div');x.className='toast';x.textContent=text;document.body.appendChild(x);setTimeout(()=>x.remove(),2600)}
window.addEventListener('error',e=>{if(e.error)console.error(e.error)});
render();
