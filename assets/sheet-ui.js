import { FIREBASE } from './config.js';
import { initializeApp, getApps, getApp } from 'https://www.gstatic.com/firebasejs/12.8.0/firebase-app.js';
import { getAuth, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/12.8.0/firebase-auth.js';
import { getFirestore, doc, getDoc, updateDoc, setDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/12.8.0/firebase-firestore.js';

const app = getApps().length ? getApp() : initializeApp(FIREBASE);
const auth = getAuth(app);
const db = getFirestore(app);
const qs = new URLSearchParams(location.search);
const sid = qs.get('id');
const token = qs.get('token');
const mode = document.body.dataset.mode || 'owner';
const $ = (s) => document.querySelector(s);
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const DEF = ['Sản phẩm','Kích thước','Thể tích','Số lượng','Designer','Ngày','Đường dẫn Drive','Hình ảnh','Ghi chú'];
let selectedCells = new Set();
let selectedRows = new Set();
let anchor = null;
let drag = false;
let activeCell = null;
let current = null;
let renderNow = null;

document.head.insertAdjacentHTML('beforeend', `<style>
.sheetgrid{width:100%;max-width:100%;overflow:auto;border:1px solid #dbe2ea;border-radius:12px;background:#fff;position:relative}
.sheetgrid table{border-collapse:collapse;table-layout:fixed;width:max-content;min-width:100%}
.sheetgrid th,.sheetgrid td{border:1px solid #dbe2ea;box-sizing:border-box}
.sheetgrid th{position:relative;height:56px;padding:4px 10px;background:#f5f8fc;text-align:center;white-space:normal;user-select:none;font-size:13px;font-weight:800;vertical-align:middle}
.sheetgrid td{padding:0;background:#fff;height:56px;vertical-align:middle;text-align:center}
.sheetgrid .stt{width:66px;min-width:66px;max-width:66px;position:sticky;left:0;background:#f5f8fc;z-index:5;text-align:center}
.sheetgrid thead .stt{z-index:8}
.sheetgrid .pic{width:132px;min-width:132px;max-width:132px;padding:6px;text-align:center}
.sheetgrid .pic .btn{margin-top:5px;padding:5px 8px;font-size:11px}
.sheetgrid .img-stack{display:flex;flex-wrap:wrap;gap:4px;align-items:center;justify-content:center;max-width:118px;margin:0 auto}
.sheetgrid .img-mini{display:block;width:52px;height:52px;max-width:52px;max-height:52px;min-width:0;min-height:0;object-fit:contain;border:1px solid #dbe2ea;border-radius:7px;background:#fff}
.sheetgrid .noimg{width:106px;height:58px;display:grid;place-items:center;border:1px dashed #cbd5e1;border-radius:8px;color:#98a2b3;font-size:11px;margin:auto}
.sheetgrid .cell{min-height:54px;width:100%;padding:9px 10px;outline:0;text-align:center;display:flex;align-items:center;justify-content:center;white-space:pre-wrap;overflow-wrap:anywhere;cursor:text;user-select:text}
.sheetgrid .cell.selected{background:#eaf2ff!important;box-shadow:inset 0 0 0 2px #4a90e2}
.sheetgrid .cell:focus{box-shadow:inset 0 0 0 2px #2563eb}
.sheetgrid th.prod,.sheetgrid td.prod{min-width:250px}.sheetgrid th.note,.sheetgrid td.note{min-width:220px}.sheetgrid th.drive,.sheetgrid td.drive{min-width:280px}
.sheetgrid .drive-link,.sheetgrid .drive-edit{height:54px;min-height:54px;width:100%;padding:9px 10px;display:flex;align-items:center;justify-content:center;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:text}
.sheetgrid .drive-link{color:#175cd3;text-decoration:underline}
.sheetgrid .designer{height:42px!important;margin:6px 7px;width:calc(100% - 14px)!important;text-align:center}
.sheetgrid .colck{display:block;margin:0 auto 3px;width:15px;height:15px}
.sheetgrid .resize{position:absolute;right:-1px;top:0;width:7px;height:100%;cursor:col-resize;z-index:9}
.sheetgrid .resize:hover{background:#2563eb55}
.fmtmenu{position:fixed;z-index:9999;width:330px;max-height:80vh;overflow:auto;background:#fff;border:1px solid #d0d5dd;border-radius:12px;box-shadow:0 14px 45px rgba(16,24,40,.18);padding:12px}
.fmtrow{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:8px 0}.fmtmenu label{font-size:12px;color:#475467;display:flex;flex-direction:column;gap:4px}.fmtmenu input[type=color]{height:34px;width:100%}.fmtmenu button{border:1px solid #d0d5dd;background:#fff;border-radius:8px;padding:8px;cursor:pointer}.fmtmenu .on{background:#eff6ff;border-color:#84adff}.format-note{font-size:12px;color:#667085;margin-top:4px}.imgmodal textarea{width:100%;min-height:110px}.imglist{max-height:260px;overflow:auto;display:grid;gap:7px;margin:9px 0}.imgitem{display:grid;grid-template-columns:55px 1fr auto;gap:8px;align-items:center;border:1px solid #eaecf0;border-radius:8px;padding:6px}.imgitem img{width:50px;height:50px;object-fit:contain;border-radius:6px;background:#fff}.sheet-v3-toolbar{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.sheet-v3-toolbar .tools{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}.public{padding:10px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;margin-bottom:12px}.empty{padding:34px!important;text-align:center;color:#667085}.row-selected{background:#eff6ff!important}
@media(max-width:850px){.sheet-v3-toolbar{flex-direction:column}.sheet-v3-toolbar .tools{justify-content:flex-start}.fmtmenu{width:calc(100vw - 20px)}}
</style>`);

function shell(title, user, role) {
  document.body.innerHTML = `<div class="app"><aside class="sidebar"><div class="logo"><b>GP</b><span>STATISTICAL</span></div><nav class="nav"><a href="index.html">⌂<span>Trang chủ</span></a><a href="my-sheets.html">▦<span>Bảng kê của tôi</span></a><a href="shared-sheets.html">↗<span>Bảng kê được chia sẻ</span></a><a href="statistics.html">◔<span>Thống kê</span></a><a href="settings.html">⚙<span>Cài đặt</span></a><a href="donate.html">♥<span>Donate</span></a></nav><div class="account"><b>${esc(user?.displayName || 'Khách')}</b><small>${esc(user?.email || '')}</small>${user ? '<button id="logout">Đăng xuất</button>' : ''}</div></aside><main class="main"><header class="top"><div><div class="eyebrow">BẢNG KÊ</div><h1>${esc(title)}</h1><div class="muted">${esc(role || '')}</div></div></header><div id="content"></div></main></div>`;
  $('#logout')?.addEventListener('click', async () => { await signOut(auth); location.href = 'login.html'; });
}
function toast(msg) { const t = document.createElement('div'); t.className = 'toast show'; t.textContent = msg; document.body.append(t); setTimeout(() => t.remove(), 2200); }
function modal(html) { const m = document.createElement('div'); m.className = 'modal-backdrop'; m.innerHTML = `<div class="modal modal-wide">${html}</div>`; document.body.append(m); return m; }
function images(v) { if (Array.isArray(v)) return v.filter(Boolean); if (!v) return []; try { const a = JSON.parse(v); return Array.isArray(a) ? a.filter(Boolean) : [String(v)]; } catch { return [String(v)]; } }
function setImages(row, arr) { row['Hình ảnh'] = arr.length ? (arr.length === 1 ? arr[0] : arr) : ''; }
function key(i,c) { return `${i}|${c}`; }
function parseKey(k) { const p = k.indexOf('|'); return [Number(k.slice(0,p)), k.slice(p+1)]; }
function styleOf(d,i,c) { return d.cellStyles?.[key(i,c)] || {}; }
function styleCss(s) { return `font-family:${s.fontFamily || 'inherit'};font-size:${s.fontSize || 12}px;color:${s.color || 'inherit'};background:${s.background || 'transparent'};font-weight:${s.bold ? 700 : 400};font-style:${s.italic ? 'italic' : 'normal'};text-decoration:${s.underline ? 'underline' : 'none'};text-align:center;`; }
function autoType(v) { v = String(v ?? '').trim(); if (!v) return 'text'; if (/^[-+]?\d+(?:[.,]\d+)?$/.test(v)) return 'number'; if (/^\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}$/.test(v) || /^\d{4}-\d{2}-\d{2}$/.test(v)) return 'date'; return 'text'; }
function normalize(x) {
  const columns = [...new Set([...(x.columns || []), ...DEF])];
  const rows = (x.rows || []).map(r => Object.fromEntries(columns.map(c => [c, r?.[c] ?? ''])));
  const columnTypes = { ...(x.columnTypes || {}) }, columnWidths = { ...(x.columnWidths || {}) }, cellStyles = { ...(x.cellStyles || {}) };
  columns.forEach(c => { if (!columnWidths[c]) columnWidths[c] = c === 'Sản phẩm' ? 250 : c === 'Hình ảnh' ? 132 : c === 'Đường dẫn Drive' ? 280 : c === 'Ghi chú' ? 220 : 150; if (!columnTypes[c]) { const first = rows.map(r => r[c]).find(v => String(v ?? '').trim()); columnTypes[c] = c === 'Ngày' || autoType(first) === 'date' ? 'date' : c === 'Số lượng' || autoType(first) === 'number' ? 'number' : 'text'; } });
  return { name: x.name || 'Bảng kê', columns, rows, columnTypes, columnWidths, cellStyles };
}
function dataCols(d) { return d.columns.filter(c => c !== 'Hình ảnh'); }
function selectedRowIndexes() { const rows = new Set(selectedRows); selectedCells.forEach(k => rows.add(parseKey(k)[0])); return [...rows].sort((a,b) => a-b); }
function rowSelectionFor(d, i, on) { const cols = dataCols(d); if (on) { selectedRows.add(i); cols.forEach(c => selectedCells.add(key(i,c))); } else { selectedRows.delete(i); cols.forEach(c => selectedCells.delete(key(i,c))); } }
function selectRectangle(d, a, b, additive = false) { const cols = dataCols(d), i1 = Math.min(a.i,b.i), i2 = Math.max(a.i,b.i), j1 = Math.min(cols.indexOf(a.c),cols.indexOf(b.c)), j2 = Math.max(cols.indexOf(a.c),cols.indexOf(b.c)); if (!additive) selectedCells.clear(); for (let i=i1;i<=i2;i++) for(let j=j1;j<=j2;j++) if(cols[j]) selectedCells.add(key(i,cols[j])); }
function selectCell(d, i, c, extend, toggle) { const k = key(i,c); if (extend && anchor) selectRectangle(d, anchor, {i,c}, toggle); else if (toggle) { selectedCells.has(k) ? selectedCells.delete(k) : selectedCells.add(k); anchor = {i,c}; } else { selectedCells = new Set([k]); anchor = {i,c}; } activeCell = {i,c}; }
function updateMeta(root) {
  const distinctRows = new Set([...selectedCells].map(k => parseKey(k)[0]));
  const m = root.querySelector('#meta');
  if (m) m.textContent = `${current.rows.length} dòng · ${selectedRows.size} hàng · ${selectedCells.size} ô`;
  const b = root.querySelector('#bulk'), del = root.querySelector('#del');
  if (b) b.disabled = !currentEditable || !selectedCells.size;
  if (del) del.disabled = !currentEditable || !(selectedRows.size || selectedCells.size);
  root.querySelectorAll('.ck').forEach(x => x.checked = selectedRows.has(+x.dataset.i));
  root.querySelectorAll('.colck').forEach(x => { const c = x.dataset.col; x.checked = current.rows.length > 0 && current.rows.every((_,i) => selectedCells.has(key(i,c))); });
  if (distinctRows.size) root.querySelectorAll('tbody tr').forEach((tr) => { const i = tr.dataset.row; if (i !== undefined) tr.classList.toggle('row-selected', distinctRows.has(+i)); });
}
let currentEditable = false;

function openImages(d, i, draw) {
  const old = images(d.rows[i]['Hình ảnh']);
  const m = modal(`<div class="modal-head"><div><div class="eyebrow">HÌNH ẢNH</div><h2>Ảnh sản phẩm</h2><div class="muted">Chọn nhiều file, kéo thả nhiều ảnh hoặc dán nhiều URL — mỗi dòng một ảnh.</div></div><button class="btn" id="close">Đóng</button></div><div class="field"><label>URL ảnh</label><textarea id="urls" placeholder="https://.../1.jpg\nhttps://.../2.jpg"></textarea></div><div class="field"><label>Chọn nhiều file</label><input id="files" type="file" accept="image/*" multiple></div><div class="field"><div id="drop" style="border:1px dashed #98a2b3;border-radius:10px;padding:14px;text-align:center">Kéo thả nhiều ảnh vào đây</div></div><div id="list" class="imglist"></div><div class="tools"><button class="btn danger" id="clear">Xóa tất cả</button><button class="btn primary" id="save">Lưu ảnh</button></div>`);
  const urls = m.querySelector('#urls'), list = m.querySelector('#list'), drop = m.querySelector('#drop');
  urls.value = old.filter(x => /^https?:/i.test(x)).join('\n');
  let files = [];
  const redraw = () => { const arr = [...urls.value.split(/\n+/).map(x => x.trim()).filter(Boolean), ...files]; list.innerHTML = arr.map((x,n) => `<div class="imgitem"><img src="${esc(x)}"><div>Ảnh ${n+1}<br><span class="muted">${x.startsWith('data:') ? 'Ảnh tải lên' : esc(x)}</span></div><button class="btn danger" data-rm="${n}">×</button></div>`).join(''); list.querySelectorAll('[data-rm]').forEach(btn => btn.onclick = () => { const next = arr.filter((_,j) => j !== +btn.dataset.rm); urls.value = next.filter(x => /^https?:/i.test(x)).join('\n'); files = next.filter(x => x.startsWith('data:')); redraw(); }); };
  const readFiles = fs => [...fs].filter(f => f.type.startsWith('image/')).forEach(f => { const fr = new FileReader(); fr.onload = () => { const im = new Image(); im.onload = () => { const cv = document.createElement('canvas'), s = Math.min(1, 1000 / im.width, 1000 / im.height); cv.width = Math.max(1, Math.round(im.width*s)); cv.height = Math.max(1, Math.round(im.height*s)); cv.getContext('2d').drawImage(im,0,0,cv.width,cv.height); files.push(cv.toDataURL('image/jpeg',.82)); redraw(); }; im.src = fr.result; }; fr.readAsDataURL(f); });
  m.querySelector('#files').onchange = e => readFiles(e.target.files); drop.ondragover = e => { e.preventDefault(); drop.style.background = '#eff6ff'; }; drop.ondragleave = () => { drop.style.background = ''; }; drop.ondrop = e => { e.preventDefault(); drop.style.background = ''; readFiles(e.dataTransfer.files); }; urls.oninput = redraw; m.querySelector('#clear').onclick = () => { urls.value = ''; files = []; redraw(); }; m.querySelector('#close').onclick = () => m.remove(); m.querySelector('#save').onclick = () => { setImages(d.rows[i],[...new Set([...urls.value.split(/\n+/).map(x => x.trim()).filter(Boolean),...files])]); m.remove(); draw(); }; redraw();
}

function formatMenu(d, i, c, target, e) {
  document.querySelector('.fmtmenu')?.remove();
  const k = key(i,c); if (!selectedCells.has(k)) selectCell(d,i,c,false,false);
  const m = document.createElement('div'); m.className = 'fmtmenu'; const s0 = styleOf(d,i,c);
  m.innerHTML = `<b>Định dạng ${selectedCells.size} ô</b><div class="format-note">Áp dụng cho toàn bộ ô đang chọn.</div><div class="fmtrow"><label>Font<select id="font"><option>Arial</option><option>Inter</option><option>Times New Roman</option><option>Georgia</option><option>Courier New</option></select></label><label>Cỡ chữ<select id="size"><option>10</option><option>11</option><option>12</option><option>14</option><option>16</option><option>18</option><option>20</option><option>24</option></select></label></div><div class="fmtrow"><label>Màu chữ<input id="color" type="color"></label><label>Màu nền<input id="bg" type="color"></label></div><div class="fmtrow"><button id="b"><b>B</b></button><button id="it"><i>I</i></button><button id="u"><u>U</u></button><button id="clearfmt">Xóa định dạng</button></div><div class="fmtrow"><button id="text">Văn bản</button><button id="num">Số</button><button id="date">Ngày</button><button id="auto">Tự động</button></div><button class="btn primary" id="ok" style="width:100%;margin-top:6px">Áp dụng</button>`;
  document.body.append(m); m.querySelector('#font').value = s0.fontFamily || 'Arial'; m.querySelector('#size').value = String(s0.fontSize || 12); m.querySelector('#color').value = s0.color || '#111827'; m.querySelector('#bg').value = s0.background || '#ffffff';
  [['b','bold'],['it','italic'],['u','underline']].forEach(([id,p]) => { m.querySelector('#'+id).classList.toggle('on',!!s0[p]); m.querySelector('#'+id).onclick = () => m.querySelector('#'+id).classList.toggle('on'); });
  m.querySelector('#clearfmt').onclick = () => { selectedCells.forEach(k => delete d.cellStyles[k]); m.remove(); renderNow?.(); };
  m.querySelector('#ok').onclick = () => { const style = {fontFamily:m.querySelector('#font').value,fontSize:+m.querySelector('#size').value,color:m.querySelector('#color').value,background:m.querySelector('#bg').value,bold:m.querySelector('#b').classList.contains('on'),italic:m.querySelector('#it').classList.contains('on'),underline:m.querySelector('#u').classList.contains('on')}; selectedCells.forEach(k => d.cellStyles[k] = {...style}); m.remove(); renderNow?.(); };
  [['text','text'],['num','number'],['date','date'],['auto','auto']].forEach(([id,t]) => m.querySelector('#'+id).onclick = () => { selectedCells.forEach(k => { const [ri,col] = parseKey(k); d.columnTypes[col] = t === 'auto' ? (col === 'Ngày' ? 'date' : col === 'Số lượng' ? 'number' : autoType(d.rows[ri][col])) : t; }); m.remove(); renderNow?.(); });
  const r = target.getBoundingClientRect(); m.style.left = Math.min(innerWidth-340,Math.max(8,r.left))+'px'; m.style.top = Math.min(innerHeight-520,Math.max(8,r.bottom+6))+'px'; updateMeta($('#content'));
}
function headerMenu(d, col, e) {
  e.preventDefault(); document.querySelector('.fmtmenu')?.remove(); const m = document.createElement('div'); m.className = 'fmtmenu'; m.innerHTML = `<b>Cột: ${esc(col)}</b><div class="format-note">Kiểu dữ liệu nội bộ, không hiện nhãn trong bảng.</div><div class="fmtrow"><button data-t="text">Văn bản</button><button data-t="number">Số</button><button data-t="date">Ngày</button><button data-t="auto">Tự động</button></div>`; document.body.append(m); m.querySelectorAll('[data-t]').forEach(b => b.onclick = () => { d.columnTypes[col] = b.dataset.t; m.remove(); renderNow?.(); }); m.style.left = Math.min(innerWidth-340,Math.max(8,e.clientX))+'px'; m.style.top = Math.min(innerHeight-220,Math.max(8,e.clientY))+'px';
}
function bulkEdit(d) {
  if (!selectedCells.size) return toast('Hãy chọn ít nhất một ô hoặc hàng.');
  const cols = [...new Set([...selectedCells].map(k => parseKey(k)[1]))].filter(c => c !== 'Đường dẫn Drive' && c !== 'Hình ảnh');
  const m = modal(`<div class="modal-head"><div><div class="eyebrow">CHỈNH SỬA NHANH</div><h2>${selectedCells.size} ô đang chọn</h2></div><button class="btn" id="close">Đóng</button></div>${cols.map(c => `<div class="field"><label>${esc(c)}</label><input class="input" data-bulk="${esc(c)}" placeholder="Bỏ trống = không đổi"></div>`).join('')}<div class="actions"><button class="btn primary" id="ok">Áp dụng</button></div>`); m.querySelector('#close').onclick = () => m.remove(); m.querySelector('#ok').onclick = () => { m.querySelectorAll('[data-bulk]').forEach(inp => { if (inp.value === '') return; selectedCells.forEach(k => { const [ri,col] = parseKey(k); if (col === inp.dataset.bulk) d.rows[ri][col] = inp.value; }); }); m.remove(); renderNow?.(); toast('Đã cập nhật ô đã chọn.'); };
}
function rowsForExport(d) { const idx = selectedRowIndexes(); return idx.length ? idx.map(i => d.rows[i]).filter(Boolean) : d.rows; }
function print(d) { const root = location.origin + location.pathname.replace(/\/[^/]*$/, '/'); sessionStorage.setItem('gp_print_payload', JSON.stringify({name:d.name,columns:d.columns,rows:rowsForExport(d),sourceUrl:root,generatedAt:new Date().toLocaleString('vi-VN'),columnWidths:d.columnWidths,columnTypes:d.columnTypes,cellStyles:d.cellStyles})); window.open('print.html','_blank'); }
function excel(d) { if (!window.ExcelJS) return toast('ExcelJS chưa tải xong'); const wb = new ExcelJS.Workbook(), ws = wb.addWorksheet('Bảng kê'), cs = d.columns.filter(c => c !== 'Hình ảnh'), rows = rowsForExport(d); ws.columns = [{header:'STT',key:'stt',width:7}, ...cs.map(c => ({header:c,key:c,width:Math.max(10,Math.round((d.columnWidths[c]||150)/8))}))]; rows.forEach((r,i) => { const row = ws.addRow({stt:i+1,...r}); cs.forEach((c,j) => { const src = d.rows.indexOf(r), s = styleOf(d,src,c), cell = row.getCell(j+2); cell.alignment = {horizontal:'center',vertical:'middle',wrapText:true}; cell.font = {name:s.fontFamily||'Arial',size:s.fontSize||12,bold:!!s.bold,italic:!!s.italic,underline:s.underline?'single':undefined,color:s.color?{argb:'FF'+s.color.replace('#','')}:undefined}; if (s.background) cell.fill = {type:'pattern',pattern:'solid',fgColor:{argb:'FF'+s.background.replace('#','')}}; }); }); wb.xlsx.writeBuffer().then(b => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([b])); a.download = (d.name||'bang-ke')+'.xlsx'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href),1000); }); }

function table(d, editable, owner, publicToken) {
  current = d; currentEditable = editable; const c = $('#content');
  const render = () => {
    renderNow = render; const cols = dataCols(d), q = (c.querySelector('#search')?.value || '').trim().toLowerCase();
    const colSpec = [`<col style="width:66px">`,`<col style="width:${d.columnWidths['Hình ảnh']}px">`,...cols.map(col => `<col style="width:${d.columnWidths[col]||150}px">`)].join('');
    const headers = `<th class="stt"><input id="all" type="checkbox"><br><b>STT</b></th><th class="pic"><b>Hình ảnh</b><div class="resize" data-col="Hình ảnh"></div></th>` + cols.map(col => `<th data-head="${esc(col)}" class="${col==='Sản phẩm'?'prod':col==='Ghi chú'?'note':col==='Đường dẫn Drive'?'drive':''}"><input class="colck" type="checkbox" data-col="${esc(col)}"><span>${esc(col)}</span><div class="resize" data-col="${esc(col)}"></div></th>`).join('');
    const body = d.rows.map((r,i) => { if (q && !Object.values(r).join(' ').toLowerCase().includes(q)) return ''; const im = images(r['Hình ảnh']); const cells = cols.map(col => { const w = d.columnWidths[col]||150, k = key(i,col), s = styleOf(d,i,col); if (col==='Designer' && editable) return `<td style="width:${w}px"><input class="input designer" list="designers" data-des="${i}" value="${esc(r[col])}" placeholder="Chọn hoặc gõ"></td>`; if (col==='Đường dẫn Drive') return r[col] ? `<td class="drive" style="width:${w}px"><div class="drive-link" data-drive="${i}" data-col="${esc(col)}" title="${esc(r[col])}">${esc(r[col])}</div></td>` : `<td class="drive" style="width:${w}px"><div class="drive-edit" ${editable?'contenteditable="true"':''} data-drive-edit="${i}" data-col="${esc(col)}"></div></td>`; return `<td style="width:${w}px"><div class="cell ${selectedCells.has(k)?'selected':''}" ${editable?'contenteditable="true"':''} data-i="${i}" data-c="${esc(col)}" style="${styleCss(s)}">${esc(r[col]||'')}</div></td>`; }).join(''); return `<tr data-row="${i}"><td class="stt"><input class="ck" type="checkbox" data-i="${i}" ${selectedRows.has(i)?'checked':''}><br>${i+1}</td><td class="pic"><div class="img-stack">${im.length ? im.map(x => `<img class="img-mini" src="${esc(x)}" alt="">`).join('') : '<div class="noimg">Chưa có ảnh</div>'}</div>${editable ? `<button class="btn" data-img="${i}">${im.length ? `Sửa ảnh (${im.length})` : 'Thêm ảnh'}</button>` : ''}</td>${cells}</tr>`; }).join('');
    c.querySelector('#grid').innerHTML = `<div class="sheetgrid"><table><colgroup>${colSpec}</colgroup><thead><tr>${headers}</tr></thead><tbody>${body || `<tr><td colspan="${d.columns.length+1}" class="empty">Chưa có dữ liệu.</td></tr>`}</tbody></table></div><datalist id="designers">${[...new Set(d.rows.map(r => r.Designer).filter(Boolean))].map(x => `<option value="${esc(x)}">`).join('')}</datalist>`;
    c.querySelector('#all').onchange = e => { selectedRows.clear(); selectedCells.clear(); if (e.target.checked) d.rows.forEach((_,i) => rowSelectionFor(d,i,true)); render(); };
    c.querySelectorAll('.ck').forEach(x => x.onchange = () => { rowSelectionFor(d,+x.dataset.i,x.checked); updateMeta(c); });
    c.querySelectorAll('.colck').forEach(x => x.onchange = () => { const col = x.dataset.col; if (x.checked) d.rows.forEach((_,i) => selectedCells.add(key(i,col))); else d.rows.forEach((_,i) => selectedCells.delete(key(i,col))); updateMeta(c); });
    c.querySelectorAll('.cell[contenteditable]').forEach(el => {
      el.onmousedown = e => { if (e.button !== 0) return; const i = +el.dataset.i, col = el.dataset.c; selectCell(d,i,col,e.shiftKey,e.ctrlKey||e.metaKey); drag = true; document.body.style.userSelect='none'; e.preventDefault(); el.focus(); updateMeta(c); };
      el.onmouseenter = () => { if (!drag || !anchor) return; selectRectangle(d,anchor,{i:+el.dataset.i,c:el.dataset.c}); updateMeta(c); };
      el.oninput = () => { d.rows[+el.dataset.i][el.dataset.c] = el.textContent; };
      el.oncontextmenu = e => { e.preventDefault(); formatMenu(d,+el.dataset.i,el.dataset.c,el,e); updateMeta(c); };
    });
    window.onmouseup = () => { drag=false; document.body.style.userSelect=''; };
    c.querySelectorAll('.designer').forEach(x => x.oninput = () => { d.rows[+x.dataset.des].Designer = x.value; });
    c.querySelectorAll('[data-img]').forEach(x => x.onclick = () => openImages(d,+x.dataset.img,render));
    c.querySelectorAll('[data-drive]').forEach(x => x.onclick = () => { if (!editable) return; const i = +x.dataset.drive; x.className='drive-edit'; x.removeAttribute('data-drive'); x.setAttribute('data-drive-edit',i); x.contentEditable='true'; x.textContent=d.rows[i]['Đường dẫn Drive']||''; x.focus(); x.oninput=()=>d.rows[i]['Đường dẫn Drive']=x.textContent.trim(); x.onblur=()=>render(); });
    c.querySelectorAll('[data-drive-edit]').forEach(x => { x.onclick=()=>{ if(editable) x.focus(); }; x.oninput=()=>{ d.rows[+x.dataset.driveEdit][x.dataset.col] = x.textContent.trim(); }; });
    c.querySelectorAll('[data-head]').forEach(h => h.oncontextmenu=e=>headerMenu(d,h.dataset.head,e));
    c.querySelectorAll('.resize').forEach(h => h.onmousedown = e => { e.preventDefault(); e.stopPropagation(); const col=h.dataset.col,start=e.clientX,startW=d.columnWidths[col]||150; const move=v=>{d.columnWidths[col]=Math.max(70,Math.min(700,startW+v.clientX-start));}; const up=()=>{removeEventListener('mousemove',move);removeEventListener('mouseup',up);render();}; addEventListener('mousemove',move); addEventListener('mouseup',up); });
    updateMeta(c);
  };
  window.__sheetRender = render;
  c.innerHTML = `${mode==='public' ? `<div class="public">Đang xem công khai. <a href="login.html?return=${encodeURIComponent(location.href)}">Đăng nhập Google để chỉnh sửa</a></div>` : ''}<section class="card sheet-editor"><div class="sheet-v3-toolbar"><div><h2>${esc(d.name)}</h2><span id="meta" class="muted"></span></div><div class="tools"><button class="btn" id="add" ${editable?'':'disabled'}>＋ Hàng</button><button class="btn" id="col" ${editable?'':'disabled'}>＋ Cột</button><button class="btn" id="drive" ${editable?'':'disabled'}>↗ Import Drive</button><button class="btn" id="share" ${mode==='owner'?'':'disabled'}>⌯ Chia sẻ</button><button class="btn" id="bulk" disabled>Chỉnh sửa đã chọn</button><button class="btn danger" id="del" disabled>Xóa đã chọn</button><button class="btn" id="excel">Excel</button><button class="btn" id="pdf">PDF / In</button><button class="btn primary" id="save" ${editable?'':'disabled'}>Lưu</button></div></div><input class="input" id="search" placeholder="Tìm sản phẩm, designer, ghi chú..." style="margin:12px 0"><div id="grid"></div></section>`;
  render(); $('#search').oninput = render;
  $('#add').onclick = () => { d.rows.push(Object.fromEntries(d.columns.map(c => [c,'']))); render(); };
  $('#col').onclick = () => { const n = prompt('Tên cột mới'); if (n?.trim() && !d.columns.includes(n.trim())) { const col=n.trim(); d.columns.push(col); d.columnTypes[col]='text'; d.columnWidths[col]=150; d.rows.forEach(r=>r[col]=''); render(); } };
  $('#bulk').onclick = () => bulkEdit(d);
  $('#del').onclick = () => { if (selectedRows.size) { [...selectedRows].sort((a,b)=>b-a).forEach(i=>d.rows.splice(i,1)); selectedRows.clear(); selectedCells.clear(); anchor=null; render(); toast('Đã xóa các hàng được chọn.'); return; } if (!selectedCells.size) return toast('Hãy chọn ô trước.'); selectedCells.forEach(k => { const [i,col]=parseKey(k); if (d.rows[i] && col!=='Hình ảnh') d.rows[i][col]=''; }); selectedCells.clear(); anchor=null; render(); toast('Đã xóa nội dung các ô được chọn.'); };
  $('#drive').onclick = () => window.driveImport?.(d,render);
  $('#share').onclick = () => window.__shareOverride?.();
  $('#save').onclick = async () => { try { await updateDoc(doc(db,'sheets',sid),{name:d.name,columns:d.columns,rows:d.rows,columnTypes:d.columnTypes,columnWidths:d.columnWidths,cellStyles:d.cellStyles,updatedAt:serverTimestamp()}); if (publicToken) await setDoc(doc(db,'publicShares',publicToken),{token:publicToken,ownerId:owner,sheetId:sid,name:d.name,columns:d.columns,rows:d.rows,columnTypes:d.columnTypes,columnWidths:d.columnWidths,cellStyles:d.cellStyles,updatedAt:serverTimestamp()}); toast('Đã lưu'); } catch(e) { toast('Lưu thất bại: '+(e.message||e)); } };
  $('#pdf').onclick = () => print(d); $('#excel').onclick = () => excel(d);
}

async function boot() {
  try {
    if (mode === 'public') { const s = await getDoc(doc(db,'publicShares',token)); if (!s.exists()) return shell('Bảng kê',null,'Liên kết không hợp lệ'); current=normalize(s.data()); shell(current.name,null,'Xem công khai'); table(current,false,s.data().ownerId,token); return; }
    onAuthStateChanged(auth, async u => { if (!u) { location.href='login.html?return='+encodeURIComponent(location.href); return; } try { const s=await getDoc(doc(db,'sheets',sid)); if(!s.exists()) return shell('Bảng kê',u,'Không tìm thấy bảng kê'); if(mode==='owner' && s.data().ownerId!==u.uid) return location.href='my-sheets.html'; if(mode==='shared'){ const q=await getDoc(doc(db,'sheetPermissions',`${sid}_${u.uid}`)); if(!q.exists()) return location.href='shared-sheets.html'; current=normalize(s.data()); shell(current.name,u,q.data().role==='editor'?'Có thể chỉnh sửa':'Chỉ xem'); table(current,q.data().role==='editor',s.data().ownerId,s.data().publicShare?.token); return; } current=normalize(s.data()); shell(current.name,u,'Chủ sở hữu'); table(current,true,u.uid,s.data().publicShare?.token||null); } catch(e){ shell('Bảng kê',u,'Không thể tải bảng kê'); toast('Không thể tải bảng kê: '+(e.message||e)); } });
  } catch(e) { shell('Bảng kê',null,'Không thể tải bảng kê'); toast('Không thể tải bảng kê: '+(e.message||e)); }
}
boot();
