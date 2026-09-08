import { getApps, getApp } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js';
import { getFirestore, doc, getDoc, setDoc, addDoc, collection, getDocs, serverTimestamp } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';

const app = getApps()[0] || getApp();
const auth = getAuth(app);
const db = getFirestore(app);
const WORKSPACE = 'gp-statistical';
const DRIVE_FULL_SESSION = 'gp-drive-full-token-v1';
const DRIVE_CLIENT_LOCAL = 'gp-member-drive-client-v1';
const INVITE_KEY = email => btoa(unescape(encodeURIComponent(String(email).toLowerCase()))).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 120) || 'invite';
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const norm = v => String(v ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();

function toast(message) {
  if (typeof window.toast === 'function') return window.toast(message);
  let x = document.querySelector('.toast');
  if (!x) { x = document.createElement('div'); x.className = 'toast'; document.body.appendChild(x); }
  x.textContent = message;
  x.classList.add('show');
  clearTimeout(x._gpTimer);
  x._gpTimer = setTimeout(() => x.classList.remove('show'), 3000);
}

function isOwner() {
  return document.querySelector('.connection span')?.textContent?.trim() === 'Chủ sở hữu';
}

function patchStats(root) {
  root.querySelectorAll('.stat').forEach(card => {
    const label = card.querySelector(':scope > span')?.textContent?.trim();
    if (label !== 'TỔNG SỐ SẢN PHẨM') return;
    card.classList.add('gp-product-stat');
    const breakdown = [...card.children].find(x => x.tagName === 'DIV' && !x.classList.contains('stat-breakdown'));
    if (!breakdown) return;
    breakdown.classList.add('gp-stat-breakdown');
  });
}

function rowData(tr) {
  const cells = tr.children;
  const work = [...(cells[7]?.querySelectorAll('.pill') || [])].map(x => x.textContent.trim()).filter(Boolean);
  return {
    customer: cells[1]?.textContent.trim() || '',
    product: cells[2]?.textContent.trim() || '',
    volume: cells[4]?.textContent.trim() || '',
    designer: cells[6]?.textContent.trim() || '',
    work,
    month: (cells[8]?.textContent.trim() || '').slice(0, 7),
    search: norm(tr.dataset.rowText || '')
  };
}

function shareRows(page) {
  return [...page.querySelectorAll('.table-card tbody tr[data-row="1]'.replace('1]','1"]'))];
}

function refreshPublicFilterOptions(bar, rows) {
  const collect = field => [...new Set(rows.map(rowData).flatMap(x => Array.isArray(x[field]) ? x[field] : [x[field]]).filter(Boolean))].sort((a,b) => a.localeCompare(b, 'vi'));
  const configs = [
    ['customer', 'Tất cả khách hàng'],
    ['designer', 'Tất cả người thực hiện'],
    ['work', 'Tất cả loại công việc'],
    ['month', 'Tất cả tháng']
  ];
  configs.forEach(([field, allLabel]) => {
    const select = bar.querySelector(`[data-gp-public-${field}]`);
    if (!select) return;
    const old = select.value;
    const values = collect(field);
    select.innerHTML = `<option value="">${allLabel}</option>${values.map(v => `<option value="${esc(v)}">${esc(v)}</option>`).join('')}`;
    if (values.includes(old)) select.value = old;
  });
}

function applyPublicFilters(page) {
  const bar = page.querySelector('[data-gp-public-filter]');
  if (!bar) return;
  const customer = bar.querySelector('[data-gp-public-customer]')?.value || '';
  const designer = bar.querySelector('[data-gp-public-designer]')?.value || '';
  const work = bar.querySelector('[data-gp-public-work]')?.value || '';
  const month = bar.querySelector('[data-gp-public-month]')?.value || '';
  const search = norm(bar.querySelector('[data-gp-public-search]')?.value || '');
  page.querySelectorAll('.table-card tbody tr[data-row="1"]').forEach(tr => {
    const x = rowData(tr);
    tr.hidden = !!(
      (customer && x.customer !== customer) ||
      (designer && x.designer !== designer) ||
      (work && !x.work.includes(work)) ||
      (month && x.month !== month) ||
      (search && !x.search.includes(search))
    );
  });
}

function patchPublicShare() {
  const page = document.querySelector('.shared-page');
  if (!page) return;

  // The public page used to render a second copy of Chia sẻ / Excel / PDF in tableCard.
  page.querySelector('.table-card > .toolbar .actions')?.remove();

  let bar = page.querySelector('[data-gp-public-filter]');
  if (!bar) {
    const old = page.querySelector(':scope > .filters');
    bar = document.createElement('div');
    bar.className = 'filters gp-filterbar';
    bar.setAttribute('data-gp-public-filter', '1');
    bar.innerHTML = `
      <select class="input" data-gp-public-customer><option value="">Tất cả khách hàng</option></select>
      <select class="input" data-gp-public-designer><option value="">Tất cả người thực hiện</option></select>
      <select class="input" data-gp-public-work><option value="">Tất cả loại công việc</option></select>
      <select class="input" data-gp-public-month><option value="">Tất cả tháng</option></select>
      <input class="input wide" data-gp-public-search placeholder="Tìm kiếm…">
      <button class="btn ghost" data-gp-public-clear>Xóa lọc</button>`;
    const oldSearch = old?.querySelector('input')?.value || '';
    if (oldSearch) bar.querySelector('[data-gp-public-search]').value = oldSearch;
    old?.replaceWith(bar);
  }

  const rows = [...page.querySelectorAll('.table-card tbody tr[data-row="1"]')];
  refreshPublicFilterOptions(bar, rows);
  if (bar.dataset.gpBound !== '1') {
    bar.dataset.gpBound = '1';
    bar.addEventListener('input', () => applyPublicFilters(page));
    bar.addEventListener('change', () => applyPublicFilters(page));
    bar.querySelector('[data-gp-public-clear]').onclick = () => {
      bar.querySelectorAll('select').forEach(s => s.value = '');
      bar.querySelector('[data-gp-public-search]').value = '';
      applyPublicFilters(page);
    };
  }
  applyPublicFilters(page);
}

async function workspaceData() {
  const snap = await getDoc(doc(db, 'workspaces', WORKSPACE));
  return snap.exists() ? (snap.data() || {}) : {};
}

async function validDriveToken(token) {
  if (!token) return false;
  try {
    const r = await fetch('https://www.googleapis.com/drive/v3/about?fields=user', {headers:{Authorization:`Bearer ${token}`} });
    return r.ok;
  } catch { return false; }
}

async function requestFullDriveToken(clientId) {
  if (!clientId) throw Error('Chưa có mã ứng dụng Google Drive của workspace.');
  if (!window.google?.accounts?.oauth2?.initTokenClient) throw Error('Google Drive chưa sẵn sàng.');
  return new Promise((resolve, reject) => {
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: 'https://www.googleapis.com/auth/drive',
      include_granted_scopes: true,
      callback: r => r?.access_token ? resolve(r.access_token) : reject(Error(r?.error_description || r?.error || 'Không thể cấp quyền quản lý Google Drive.'))
    });
    client.requestAccessToken({prompt:'consent'});
  });
}

async function ownerDriveToken() {
  let token = '';
  try { token = sessionStorage.getItem(DRIVE_FULL_SESSION) || ''; } catch {}
  if (await validDriveToken(token)) return token;
  try { sessionStorage.removeItem(DRIVE_FULL_SESSION); } catch {}
  const ws = await workspaceData();
  const settings = ws.settings || {};
  const clientId = settings.googleClientId || '';
  if (!clientId) throw Error('Chưa cấu hình Google Drive Client ID.');
  token = await requestFullDriveToken(clientId);
  try { sessionStorage.setItem(DRIVE_FULL_SESSION, token); } catch {}
  return token;
}

async function drivePermissionExists(token, folderId, email) {
  const u = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(folderId)}/permissions?fields=permissions(id,type,emailAddress,role)&pageSize=100&supportsAllDrives=true`;
  const r = await fetch(u, {headers:{Authorization:`Bearer ${token}`} });
  if (!r.ok) return false;
  const j = await r.json();
  return (j.permissions || []).some(p => p.type === 'user' && String(p.emailAddress || '').toLowerCase() === email);
}

async function grantDriveFolder(token, folderId, email, role) {
  if (!folderId) return false;
  const lower = email.toLowerCase();
  if (await drivePermissionExists(token, folderId, lower)) return true;
  const u = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(folderId)}/permissions?sendNotificationEmail=true&supportsAllDrives=true&fields=id,emailAddress,role,type`;
  const r = await fetch(u, {
    method:'POST',
    headers:{Authorization:`Bearer ${token}`, 'Content-Type':'application/json'},
    body:JSON.stringify({type:'user',role:role==='editor'?'writer':'reader',emailAddress:lower})
  });
  if (r.ok) return true;
  // Existing/inherited permissions are harmless for this workflow.
  if (r.status === 400 || r.status === 409) return true;
  let msg = '';
  try { msg = (await r.json()).error?.message || ''; } catch {}
  throw Error(msg || `Google Drive không thể cấp quyền (${r.status}).`);
}

async function autoProvisionDrive(email, role) {
  const products = await getDocs(collection(db, 'workspaces', WORKSPACE, 'products'));
  const roots = [...new Set(products.docs.map(d => d.data()?.driveRootFolderId).filter(Boolean))];
  if (!roots.length) return {count:0, roots:[]};
  const token = await ownerDriveToken();
  const done = [];
  for (const root of roots) {
    try { if (await grantDriveFolder(token, root, email, role)) done.push(root); } catch (e) { console.warn('Drive permission', root, e); }
  }
  return {count:done.length, roots:done};
}

async function correctedInvite() {
  if (!isOwner()) return false;
  const input = document.querySelector('#gp-invite-email');
  const email = input?.value.trim().toLowerCase() || '';
  if (!email || !email.includes('@')) { toast('Nhập đúng địa chỉ Gmail.'); return true; }
  const role = document.querySelector('#gp-invite-role')?.value === 'editor' ? 'editor' : 'viewer';
  const canInvite = document.querySelector('#gp-invite-caninvite')?.value === 'yes';
  const driveAccess = document.querySelector('#gp-invite-drive')?.value === 'yes';
  const owner = auth.currentUser;
  if (!owner?.uid) { toast('Phiên đăng nhập đã hết.'); return true; }
  try {
    const payload = {
      email,
      role,
      canInvite,
      driveAccess,
      workspaceId: WORKSPACE,
      createdBy: owner.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    // Raw e-mail key is required by Firestore rules for self-acceptance; encoded key is kept for backward compatibility.
    await setDoc(doc(db, 'workspaces', WORKSPACE, 'invites', email), payload, {merge:true});
    await setDoc(doc(db, 'workspaces', WORKSPACE, 'invites', INVITE_KEY(email)), payload, {merge:true});

    let driveResult = {count:0};
    let driveMessage = 'Không cấp Drive.';
    if (driveAccess) {
      driveResult = await autoProvisionDrive(email, role);
      driveMessage = driveResult.count ? `Đã cấp Drive cho ${driveResult.count} thư mục.` : 'Chưa có thư mục Drive nào để cấp.';
    }

    const appUrl = `${location.origin}${location.pathname}`;
    await addDoc(collection(db, 'mail'), {
      to: email,
      workspaceId: WORKSPACE,
      inviteEmail: email,
      createdBy: owner.uid,
      createdAt: serverTimestamp(),
      message: {
        subject: 'Lời mời tham gia GP Statistical',
        text: `Bạn được mời tham gia GP Statistical với quyền ${role === 'editor' ? 'có thể chỉnh sửa' : 'chỉ xem'}. Mở: ${appUrl}`,
        html: `<div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;padding:32px;color:#142033"><div style="font-size:12px;font-weight:800;letter-spacing:3px;color:#ef6b3b">GP STATISTICAL</div><h1 style="font-size:34px;margin:18px 0 8px">Bạn được mời tham gia</h1><p>Bạn được mời với quyền <b>${role === 'editor' ? 'có thể chỉnh sửa' : 'chỉ xem'}</b>.</p><p><a href="${esc(appUrl)}" style="display:inline-block;background:#ef6b3b;color:#fff;text-decoration:none;padding:13px 20px;border-radius:10px;font-weight:700">Mở GP Statistical</a></p><p style="font-size:13px;color:#6f7784">Đăng nhập bằng đúng địa chỉ Gmail nhận được lời mời.</p>${driveAccess ? `<p style="font-size:13px;color:#6f7784">Quyền Google Drive được hệ thống cấp tự động; không cần thêm thủ công trong Google Drive.</p>` : ''}</div>`
      }
    });
    input.value = '';
    toast(`Đã mời ${email}. ${driveMessage}`);
  } catch (e) {
    toast(e.message || String(e));
  }
  return true;
}

function patchMemberDriveSettings() {
  const card = [...document.querySelectorAll('.card')].find(x => x.querySelector('h2')?.textContent?.trim() === 'Kết nối Google Drive');
  if (!card || isOwner()) return;
  const p = card.querySelector('.field-help');
  if (p) p.innerHTML = 'Quyền Google Drive được quản trị viên cấp theo Gmail. Bạn không cần nhập mã của quản trị viên.';
  const actions = card.querySelector('.actions');
  if (!actions) return;
  const oldInput = actions.querySelector('#gp-client');
  const oldSave = actions.querySelector('#gp-save-client');
  oldInput?.remove(); oldSave?.remove();
  if (!actions.querySelector('[data-gp-drive-status]')) {
    const panel = document.createElement('div');
    panel.setAttribute('data-gp-drive-status','1');
    panel.className = 'gp-drive-member-panel';
    panel.innerHTML = `<div class="gp-drive-status"><b>✓ Quyền Drive đã được cấp theo tài khoản</b><span>Các thư mục được quản trị viên chia sẻ sẽ mở bằng chính Gmail này.</span></div><details class="gp-drive-advanced"><summary>Mã kết nối riêng (chỉ dùng khi quản trị viên cung cấp)</summary><input id="gp-member-drive-client" class="input" placeholder="Nhập mã client riêng nếu được yêu cầu"><button class="btn" type="button" data-gp-save-member-client>Lưu mã này trên thiết bị</button></details>`;
    actions.prepend(panel);
    try { panel.querySelector('#gp-member-drive-client').value = localStorage.getItem(DRIVE_CLIENT_LOCAL) || ''; } catch {}
    panel.querySelector('[data-gp-save-member-client]').onclick = () => {
      try { localStorage.setItem(DRIVE_CLIENT_LOCAL, panel.querySelector('#gp-member-drive-client').value.trim()); } catch {}
      toast('Đã lưu mã kết nối riêng trên thiết bị.');
    };
  }
  const connectBtn = actions.querySelector('#gp-test-drive');
  if (connectBtn) {
    connectBtn.textContent = 'Mở Drive đã được cấp';
    connectBtn.onclick = async () => {
      const product = await getDocs(collection(db, 'workspaces', WORKSPACE, 'products'));
      const url = product.docs.map(d => d.data()?.driveRootFolderUrl || d.data()?.driveFolderUrl).find(Boolean);
      if (url) window.open(url, '_blank', 'noopener');
      else toast('Chưa có thư mục Drive nào được cấp cho workspace.');
    };
  }
}

function installPatches() {
  const observer = new MutationObserver(() => {
    patchStats(document);
    patchPublicShare();
    patchMemberDriveSettings();
  });
  observer.observe(document.documentElement, {subtree:true, childList:true});
  patchStats(document);
  patchPublicShare();
  patchMemberDriveSettings();

  document.addEventListener('click', e => {
    const invite = e.target.closest?.('#gp-invite-send');
    if (invite) {
      e.preventDefault();
      e.stopImmediatePropagation();
      correctedInvite();
    }
  }, true);
}

installPatches();
window.GPProductionHotfix = { driveFullSessionKey: DRIVE_FULL_SESSION };
