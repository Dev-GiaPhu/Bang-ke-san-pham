const STORE = 'ventek-design-tracker-v2';
const SETTINGS = 'ventek-design-settings-v2';
const FOLDER_MIME = 'application/vnd.google-apps.folder';
const IMAGE_EXT = /\.(png|jpe?g|webp|gif|bmp|tiff?|svg)$/i;
const ASSET_EXT = /\.(png|jpe?g|webp|gif|bmp|tiff?|svg|pdf|ai|psd|eps|indd|zip)$/i;
const ASSET_FOLDER_RE = /^(?:\d{1,2}\s*[-_.]\s*)?(final|source|mockup|draft|preview|output|print|artwork|file)$/i;
const VOLUME_RE = /^(?:\d{1,4}(?:[.,]\d+)?)\s?(?:ml|cl|l|lit|liter|litre)$/i;
const SIZE_RE = /^(?:A[0-6]|\d{2,5}\s*[x×]\s*\d{2,5})$/i;
const VOLUME_IN_TEXT = /(?<!\w)(\d+(?:[.,]\d+)?)\s?(ml|cl|l|lit|liter|litre)(?!\w)/i;
const SIZE_IN_TEXT = /\b(\d{2,5}\s*[x×]\s*\d{2,5}|A[0-6])\b/i;
const norm = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
const clean = s => String(s || '').replace(/\.[^.]+$/, '').replace(/^\d{1,2}\s*[-_.]\s*/, '').replace(/[_-]+$/,'').replace(/^[_-]+/,'').trim();
const readJson = (k, fallback) => { try { return JSON.parse(localStorage.getItem(k) || JSON.stringify(fallback)); } catch { return fallback; } };
const writeRecords = records => localStorage.setItem(STORE, JSON.stringify(records));
const writeSettings = settings => localStorage.setItem(SETTINGS, JSON.stringify(settings));
const uid = () => crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
function driveId(input) {
  const s = String(input || '').trim();
  for (const re of [/\/folders\/([\w-]+)/, /[?&]id=([\w-]+)/, /\/d\/([\w-]+)/]) { const m = s.match(re); if (m) return m[1]; }
  return /^[\w-]{10,}$/.test(s) ? s : '';
}
function driveUrl(id) { return `https://drive.google.com/drive/folders/${id}`; }
function parseVolume(s) {
  const m = String(s || '').match(VOLUME_IN_TEXT); if (!m) return '';
  const n = m[1].replace(',', '.'); const unit = m[2].toLowerCase();
  return `${n}${unit === 'ml' ? 'ml' : unit === 'cl' ? 'cl' : 'L'}`;
}
function parseSize(s) { const m = String(s || '').match(SIZE_IN_TEXT); return m ? m[1].replace(/\s+/g,'').replace('×','x').toUpperCase() : ''; }
function productFromFile(fileName, folderPath) {
  const raw = clean(fileName);
  let product = raw.replace(VOLUME_IN_TEXT,'').replace(SIZE_IN_TEXT,'').replace(/\b(final|source|mockup|draft|preview|output|print|artwork|design|image|img)\b/ig,'').replace(/[_-]+/g,' ').replace(/\s{2,}/g,' ').trim();
  if (!product || /^(?:final|source|mockup|draft|preview|output|design|image|img|update)$/i.test(product)) {
    product = [...folderPath].reverse().find(x => x && !ASSET_FOLDER_RE.test(x) && !VOLUME_RE.test(x) && !SIZE_RE.test(x)) || '';
  }
  return clean(product);
}
function nearestVolume(path) { return [...path].reverse().map(parseVolume).find(Boolean) || ''; }
function nearestSize(path) { return [...path].reverse().map(parseSize).find(Boolean) || ''; }
function variantFolderId(file, folderInfo) {
  const folders = folderInfo || [];
  const candidate = [...folders].reverse().find(x => x.id && !ASSET_FOLDER_RE.test(x.name));
  if (!candidate) return '';
  const hasVariantSignal = VOLUME_RE.test(candidate.name.trim()) || SIZE_RE.test(candidate.name.trim()) || parseVolume(candidate.name) || parseSize(candidate.name) || /\b(?:\d+(?:[.,]\d+)?\s?(?:ml|cl|l|lit|liter|litre))\b/i.test(candidate.name);
  return hasVariantSignal ? candidate.id : '';
}
function roleFromPath(file, folderPath) {
  const hit = [...folderPath].reverse().find(x => ASSET_FOLDER_RE.test(x));
  if (hit) return clean(hit).replace(/^\d{1,2}\s*[-_.]\s*/,'').toLowerCase();
  if (/final/i.test(file.name)) return 'final';
  if (/mockup/i.test(file.name)) return 'mockup';
  if (/source/i.test(file.name)) return 'source';
  return 'asset';
}
async function tokenFromGIS(clientId) {
  if (!clientId || !window.google?.accounts?.oauth2) throw new Error('GIS unavailable');
  return new Promise((resolve, reject) => {
    const client = google.accounts.oauth2.initTokenClient({ client_id: clientId, scope: 'https://www.googleapis.com/auth/drive.readonly', callback: r => r.error ? reject(new Error(r.error)) : resolve(r.access_token) });
    client.requestAccessToken({ prompt: '' });
  });
}
async function api(token, url) {
  const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) throw new Error(`Drive API ${r.status}`);
  return r.json();
}
async function walk(token, rootId) {
  const files = [];
  const folders = new Map();
  async function visit(id, path, ancestors) {
    let page = '';
    do {
      const q = encodeURIComponent(`'${id}' in parents and trashed = false`);
      const fields = encodeURIComponent('nextPageToken,files(id,name,mimeType,modifiedTime,version,size,webViewLink,thumbnailLink,parents)');
      let url = `https://www.googleapis.com/drive/v3/files?q=${q}&pageSize=1000&fields=${fields}`;
      if (page) url += `&pageToken=${encodeURIComponent(page)}`;
      const data = await api(token, url);
      for (const f of data.files || []) {
        if (f.mimeType === FOLDER_MIME) {
          const info = { id: f.id, name: f.name };
          folders.set(f.id, { ...info, path: [...path, f.name], ancestors: [...ancestors, info] });
          await visit(f.id, [...path, f.name], [...ancestors, info]);
        } else {
          files.push({ ...f, folderPath: path, ancestors });
        }
      }
      page = data.nextPageToken || '';
    } while (page);
  }
  await visit(rootId, [], []);
  return { files, folders };
}
function buildVariants(root, walked) {
  const groups = new Map();
  for (const file of walked.files) {
    if (!ASSET_EXT.test(file.name) && !file.mimeType) continue;
    const volume = parseVolume(file.name) || nearestVolume(file.folderPath);
    const size = parseSize(file.name) || nearestSize(file.folderPath);
    const productName = productFromFile(file.name, file.folderPath);
    if (!productName && !volume && !size) continue;
    const vId = variantFolderId(file, file.ancestors) || `fallback:${norm(productName)}|${norm(volume)}|${norm(size)}`;
    const key = `${root.id}|${vId}`;
    if (!groups.has(key)) groups.set(key, { productName, volume, size, variantFolderId: vId.startsWith('fallback:') ? '' : vId, assets: [], driveRootFolderId: root.id, driveRootFolderUrl: root.webViewLink || driveUrl(root.id), sourceFolderPath: file.folderPath.join(' / ') });
    const g = groups.get(key);
    if (!g.productName && productName) g.productName = productName;
    if (!g.volume && volume) g.volume = volume;
    if (!g.size && size) g.size = size;
    g.assets.push({ id: file.id, name: file.name, mimeType: file.mimeType || '', modifiedTime: file.modifiedTime || '', version: file.version || '', size: file.size || '', webViewLink: file.webViewLink || `https://drive.google.com/open?id=${file.id}`, thumbnailLink: file.thumbnailLink || '', folderPath: file.folderPath.join(' / '), role: roleFromPath(file, file.folderPath) });
  }
  for (const g of groups.values()) {
    const imageAssets = g.assets.filter(a => IMAGE_EXT.test(a.name) || /^image\//i.test(a.mimeType));
    imageAssets.sort((a,b) => (a.role === 'final' ? -1 : 0) - (b.role === 'final' ? -1 : 0) || String(b.modifiedTime).localeCompare(String(a.modifiedTime)));
    const preview = imageAssets[0] || g.assets[0];
    g.previewFileId = preview?.id || '';
    g.previewFileName = preview?.name || '';
    g.lastDriveModified = g.assets.reduce((m,a) => a.modifiedTime > m ? a.modifiedTime : m, '');
  }
  return [...groups.values()].filter(g => g.productName || g.volume || g.size);
}
function identity(r) {
  if (r.driveVariantFolderId && r.driveRootFolderId) return `folder:${r.driveRootFolderId}:${r.driveVariantFolderId}`;
  if (r.driveFolderId && r.driveRootFolderId) return `folder:${r.driveRootFolderId}:${r.driveFolderId}`;
  return `fallback:${norm(r.productName)}|${norm(r.volume)}|${norm(r.size)}`;
}
function mergeRecord(records, variant, nowMonth) {
  const candidates = records.filter(r => {
    const sameRoot = r.driveRootFolderId && r.driveRootFolderId === variant.driveRootFolderId;
    const sameVariant = variant.variantFolderId && r.driveVariantFolderId === variant.variantFolderId;
    const sameFallback = !variant.variantFolderId && norm(r.productName) === norm(variant.productName) && norm(r.volume) === norm(variant.volume) && norm(r.size) === norm(variant.size);
    return sameRoot && (sameVariant || sameFallback);
  });
  let r = candidates[0];
  if (!r) {
    r = { id: uid(), month: nowMonth, date: new Date().toISOString().slice(0,10), quantity: 1, designer: '', editTypes: [], createdAt: new Date().toISOString(), drivePresent: true };
    records.push(r);
  }
  const oldAssets = new Map((r.assets || []).map(a => [a.id, a]));
  r.productName = variant.productName || r.productName || '';
  r.volume = variant.volume || r.volume || '';
  r.size = variant.size || r.size || '';
  r.driveRootFolderId = variant.driveRootFolderId;
  r.driveRootFolderUrl = variant.driveRootFolderUrl;
  r.driveVariantFolderId = variant.variantFolderId || r.driveVariantFolderId || '';
  r.driveFolderUrl = variant.driveRootFolderUrl;
  r.driveFileId = variant.previewFileId || r.driveFileId || '';
  r.sourceFileName = variant.previewFileName || r.sourceFileName || '';
  r.sourceFolderPath = variant.sourceFolderPath || r.sourceFolderPath || '';
  r.assets = variant.assets.map(a => ({ ...(oldAssets.get(a.id) || {}), ...a }));
  r.drivePresent = true;
  r.lastDriveSync = new Date().toISOString();
  return r;
}
async function syncRoot(rootId, token) {
  const root = await api(token, `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(rootId)}?fields=id,name,mimeType,webViewLink,modifiedTime`);
  if (root.mimeType !== FOLDER_MIME) throw new Error(`Drive link không phải thư mục: ${root.name || rootId}`);
  const walked = await walk(token, rootId);
  return { root, variants: buildVariants(root, walked) };
}
async function autoSync() {
  const settings = readJson(SETTINGS, {});
  const records = readJson(STORE, []);
  const roots = [...new Set(records.map(r => r.driveRootFolderId || driveId(r.driveRootFolderUrl || r.driveFolderUrl)).filter(Boolean))];
  if (!roots.length || !settings.googleClientId) return;
  let token;
  try { token = await tokenFromGIS(settings.googleClientId); } catch { return; }
  let changed = false;
  const month = new Date().toISOString().slice(0,7);
  for (const rootId of roots) {
    try {
      const result = await syncRoot(rootId, token);
      const seen = new Set();
      for (const v of result.variants) { const before = JSON.stringify(v); const r = mergeRecord(records, v, month); seen.add(identity(r)); if (JSON.stringify(v) !== before || r.lastDriveSync) changed = true; }
      const rootRecords = records.filter(r => r.driveRootFolderId === rootId);
      for (const r of rootRecords) if (!seen.has(identity(r))) { r.drivePresent = false; r.lastDriveSync = new Date().toISOString(); changed = true; }
    } catch (e) { console.warn('[Drive Sync]', rootId, e); }
  }
  if (changed) { writeRecords(records); window.dispatchEvent(new CustomEvent('ventek-drive-synced')); setTimeout(() => location.reload(), 150); }
}
function waitForGISAndSync(attempt = 0) {
  if (attempt > 40) return;
  const settings = readJson(SETTINGS, {});
  if (settings.googleClientId && window.google?.accounts?.oauth2) { autoSync(); return; }
  setTimeout(() => waitForGISAndSync(attempt + 1), 250);
}
window.addEventListener('load', () => waitForGISAndSync());
