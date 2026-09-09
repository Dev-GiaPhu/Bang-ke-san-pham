const { onRequest } = require('firebase-functions/v2/https');
const { setGlobalOptions } = require('firebase-functions/v2');
const admin = require('firebase-admin');
const crypto = require('crypto');

admin.initializeApp();
setGlobalOptions({ region: 'asia-southeast1', maxInstances: 10, timeoutSeconds: 60 });
const db = admin.firestore();

const cors = (res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
};
const body = (req) => (req.body && typeof req.body === 'object' ? req.body : {});
const hash = (value) => crypto.createHash('sha256').update(String(value)).digest('hex');
const makeOtp = () => String(crypto.randomInt(100000, 1000000));

async function verifyBearer(req) {
  const token = String(req.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) throw Object.assign(new Error('Phiên đăng nhập không hợp lệ.'), { status: 401 });
  return admin.auth().verifyIdToken(token);
}

async function sendResend(to, otp) {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error('RESEND_API_KEY chưa được cấu hình trong backend.');
  const from = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';
  const html = `<!doctype html><html lang="vi"><body style="margin:0;background:#f4f6f9;padding:32px;font-family:Arial,sans-serif;color:#152033"><div style="max-width:560px;margin:auto;background:#fff;border:1px solid #dde3ec;border-radius:20px;padding:32px"><div style="font-size:11px;font-weight:900;letter-spacing:.18em;color:#2563eb">GP STATISTICAL</div><h1 style="font-size:28px;margin:10px 0 18px">Mã xác thực email</h1><p>Nhập mã sau vào GP Statistical:</p><div style="font-size:38px;font-weight:900;letter-spacing:10px;padding:18px 0">${otp}</div><p style="color:#667085">Mã có hiệu lực trong 10 phút và chỉ dùng một lần.</p></div></body></html>`;
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: `GP Statistical <${from}>`, to: [to], subject: 'Mã xác thực GP Statistical', html })
  });
  if (!response.ok) {
    console.error('Resend:', response.status, await response.text());
    throw new Error('Dịch vụ email không gửi được mã.');
  }
}

exports.sendVerification = onRequest(async (req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).send('');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' });
  try {
    const decoded = await verifyBearer(req);
    const email = String(body(req).email || '').trim().toLowerCase();
    if (email !== String(decoded.email || '').toLowerCase() || !decoded.email_verified) return res.status(403).json({ error: 'Gmail Google chưa được xác thực hoặc không khớp phiên đăng nhập.' });
    if (!email.endsWith('@gmail.com')) return res.status(400).json({ error: 'Chỉ chấp nhận Gmail.' });
    const ref = db.collection('verificationSessions').doc(decoded.uid);
    const previous = await ref.get();
    if (previous.exists) {
      const last = previous.data()?.sentAt?.toMillis?.() || 0;
      if (Date.now() - last < 60_000) return res.status(429).json({ error: 'Vui lòng chờ 60 giây trước khi gửi lại mã.' });
    }
    const otp = makeOtp();
    await ref.set({ uid: decoded.uid, email, codeHash: hash(`${decoded.uid}:${otp}`), attempts: 0, expiresAt: admin.firestore.Timestamp.fromMillis(Date.now() + 10 * 60 * 1000), sentAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
    await sendResend(email, otp);
    res.json({ ok: true });
  } catch (e) { console.error(e); res.status(e.status || 500).json({ error: e.message || 'Không gửi được mã xác thực.' }); }
});

exports.verifyGoogle = onRequest(async (req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).send('');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' });
  try {
    const decoded = await verifyBearer(req);
    const email = String(body(req).email || '').trim().toLowerCase();
    const code = String(body(req).code || '').trim();
    if (email !== String(decoded.email || '').toLowerCase()) return res.status(403).json({ error: 'Email không khớp tài khoản Google.' });
    if (!/^\d{6}$/.test(code)) return res.status(400).json({ error: 'Mã xác thực phải gồm đúng 6 số.' });
    const ref = db.collection('verificationSessions').doc(decoded.uid);
    const snap = await ref.get();
    if (!snap.exists) return res.status(400).json({ error: 'Không tìm thấy phiên xác thực. Hãy gửi lại mã.' });
    const v = snap.data();
    if (v.expiresAt.toMillis() < Date.now()) return res.status(400).json({ error: 'Mã đã hết hạn. Hãy gửi mã mới.' });
    if ((v.attempts || 0) >= 5) return res.status(429).json({ error: 'Bạn đã nhập sai quá số lần cho phép.' });
    if (hash(`${decoded.uid}:${code}`) !== v.codeHash) {
      await ref.update({ attempts: admin.firestore.FieldValue.increment(1) });
      return res.status(400).json({ error: 'Mã xác thực không đúng.' });
    }
    await db.collection('users').doc(decoded.uid).set({ uid: decoded.uid, email: decoded.email || email, displayName: decoded.name || '', photoURL: decoded.picture || '', emailVerified: true, notificationEmail: true, createdAt: admin.firestore.FieldValue.serverTimestamp(), verifiedAt: admin.firestore.FieldValue.serverTimestamp(), updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
    await ref.delete();
    res.json({ ok: true });
  } catch (e) { console.error(e); res.status(e.status || 500).json({ error: e.message || 'Không xác thực được email.' }); }
});

function folderIdFromUrl(raw) {
  const text = String(raw || '').trim();
  const folder = text.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (folder) return folder[1];
  const id = text.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  return id ? id[1] : null;
}
async function driveFetch(path, params = {}) {
  const key = process.env.GOOGLE_DRIVE_API_KEY;
  if (!key) throw Object.assign(new Error('GOOGLE_DRIVE_API_KEY chưa được cấu hình trong backend.'), { status: 500 });
  const url = new URL(`https://www.googleapis.com/drive/v3/${path}`);
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') url.searchParams.set(k, String(v));
  url.searchParams.set('key', key);
  const r = await fetch(url);
  const text = await r.text();
  if (!r.ok) {
    let detail = '';
    try { detail = JSON.parse(text)?.error?.message || ''; } catch {}
    throw Object.assign(new Error(detail || 'Không thể truy cập Google Drive.'), { status: r.status === 401 || r.status === 403 || r.status === 404 ? 403 : r.status, driveStatus: r.status });
  }
  return JSON.parse(text);
}
async function listChildren(parentId) {
  const files = []; let token = '';
  do {
    const d = await driveFetch('files', { q: `'${parentId}' in parents and trashed = false`, pageSize: 1000, fields: 'nextPageToken,files(id,name,mimeType,webViewLink,thumbnailLink,size,modifiedTime)', ...(token ? { pageToken: token } : {}) });
    files.push(...(d.files || [])); token = d.nextPageToken || '';
  } while (token);
  return files;
}

exports.scanDrive = onRequest(async (req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).send('');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' });
  try {
    await verifyBearer(req);
    const rootId = folderIdFromUrl(body(req).url);
    if (!rootId) return res.status(400).json({ error: 'Link Google Drive không hợp lệ. Hãy dán link thư mục.' });
    const root = await driveFetch(`files/${rootId}`, { fields: 'id,name,mimeType,webViewLink' });
    if (root.mimeType !== 'application/vnd.google-apps.folder') return res.status(400).json({ error: 'Link phải trỏ tới một thư mục Google Drive.' });

    const queue = [{ id: root.id, path: [root.name], depth: 0 }];
    const rows = []; let visited = 0;
    while (queue.length && visited < 1000 && rows.length < 1000) {
      const current = queue.shift(); visited++;
      const children = await listChildren(current.id);
      const folders = children.filter(f => f.mimeType === 'application/vnd.google-apps.folder');
      const files = children.filter(f => f.mimeType !== 'application/vnd.google-apps.folder');
      if (files.length) {
        const text = `${current.path.join(' / ')} ${files.map(f => f.name).join(' ')}`;
        const volume = (text.match(/\b\d+(?:[.,]\d+)?\s*(?:ml|l|kg|g)\b/i) || [])[0] || '';
        const size = (text.match(/\b\d{2,5}\s*[x×]\s*\d{2,5}(?:\s*[x×]\s*\d{2,5})?\b/i) || [])[0] || '';
        const quantity = Number((text.match(/(?:qty|quantity|sl)\s*[:_-]?\s*(\d+)/i) || [])[1] || 1);
        const images = files.filter(f => String(f.mimeType || '').startsWith('image/')).slice(0, 8);
        rows.push({ id: current.id, name: current.path[current.path.length - 1], productName: current.path[current.path.length - 1], volume, size, quantity, path: current.path.join(' / '), url: `https://drive.google.com/drive/folders/${current.id}`, images: images.map(f => ({ id: f.id, name: f.name, url: `https://drive.google.com/thumbnail?id=${f.id}&sz=w1000`, driveUrl: f.webViewLink || `https://drive.google.com/open?id=${f.id}` })), files: files.slice(0, 30).map(f => ({ id: f.id, name: f.name, mimeType: f.mimeType, url: f.webViewLink || `https://drive.google.com/open?id=${f.id}` })) });
      }
      for (const folder of folders) if (current.depth < 8) queue.push({ id: folder.id, path: [...current.path, folder.name], depth: current.depth + 1 });
    }
    res.json({ ok: true, root: { id: root.id, name: root.name, url: root.webViewLink || `https://drive.google.com/drive/folders/${root.id}` }, scannedFolders: visited, items: rows });
  } catch (e) {
    console.error(e);
    if (e.status === 403) return res.status(403).json({ error: 'Không thể truy cập thư mục Google Drive. Hãy vào Chia sẻ → Quyền truy cập chung → Anyone with the link → Viewer rồi thử lại.', code: 'DRIVE_NOT_PUBLIC' });
    res.status(e.status || 500).json({ error: e.message || 'Không thể quét Google Drive.' });
  }
});
