const { onRequest } = require('firebase-functions/v2/https');
const { setGlobalOptions } = require('firebase-functions/v2');
const admin = require('firebase-admin');
const crypto = require('crypto');

admin.initializeApp();
setGlobalOptions({ region: 'asia-southeast1', maxInstances: 10 });
const db = admin.firestore();
const hash = (value) => crypto.createHash('sha256').update(String(value)).digest('hex');
const otp = () => String(crypto.randomInt(100000, 1000000));
const cors = (res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
};
const body = (req) => (req.body && typeof req.body === 'object' ? req.body : {});

async function verifyGoogleToken(token) {
  if (!token) throw new Error('Thiếu phiên Google.');
  return admin.auth().verifyIdToken(token);
}

async function sendEmail(to, subject, html) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';
  if (!key) throw new Error('Chưa cấu hình RESEND_API_KEY.');
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: `GP Statistical <${from}>`, to: [to], subject, html })
  });
  if (!r.ok) {
    const text = await r.text();
    console.error('Resend error', r.status, text);
    throw new Error('Dịch vụ email không gửi được thư.');
  }
}

exports.sendVerification = onRequest(async (req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).send('');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' });
  try {
    const { token, email } = body(req);
    const decoded = await verifyGoogleToken(token);
    const requestedEmail = String(email || '').trim().toLowerCase();
    const verifiedEmail = String(decoded.email || '').trim().toLowerCase();
    if (!decoded.email_verified || requestedEmail !== verifiedEmail) return res.status(403).json({ error: 'Email Google chưa được xác thực.' });
    if (!/^\S+@gmail\.com$/i.test(verifiedEmail)) return res.status(400).json({ error: 'Chỉ chấp nhận Gmail.' });
    const profile = await db.collection('users').doc(decoded.uid).get();
    if (profile.exists && profile.data()?.emailVerified) return res.status(409).json({ error: 'Tài khoản đã được xác thực.' });
    const value = otp();
    const id = hash(decoded.uid + ':' + verifiedEmail);
    await db.collection('verificationSessions').doc(id).set({
      uid: decoded.uid,
      email: verifiedEmail,
      codeHash: hash(value),
      attempts: 0,
      expiresAt: admin.firestore.Timestamp.fromMillis(Date.now() + 10 * 60 * 1000),
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    await sendEmail(verifiedEmail, 'Mã xác thực GP Statistical', `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto"><h2>GP Statistical</h2><p>Mã xác thực email của bạn:</p><div style="font-size:34px;font-weight:800;letter-spacing:9px;padding:18px 0">${value}</div><p>Mã có hiệu lực trong 10 phút và chỉ dùng một lần.</p></div>`);
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message || 'Không gửi được mã xác thực.' });
  }
});

exports.verifyGoogle = onRequest(async (req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).send('');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' });
  try {
    const { token, email, code } = body(req);
    const decoded = await verifyGoogleToken(token);
    const em = String(email || '').trim().toLowerCase();
    if (decoded.email !== em || !decoded.email_verified) return res.status(403).json({ error: 'Phiên Google không khớp email.' });
    const ref = db.collection('verificationSessions').doc(hash(decoded.uid + ':' + em));
    const snap = await ref.get();
    if (!snap.exists) return res.status(400).json({ error: 'Không tìm thấy mã xác thực hoặc mã đã hết hạn.' });
    const v = snap.data();
    if (v.expiresAt.toMillis() < Date.now()) return res.status(400).json({ error: 'Mã đã hết hạn. Hãy gửi mã mới.' });
    if ((v.attempts || 0) >= 5) return res.status(429).json({ error: 'Đã vượt quá số lần thử.' });
    if (hash(String(code || '')) !== v.codeHash) {
      await ref.update({ attempts: admin.firestore.FieldValue.increment(1) });
      return res.status(400).json({ error: 'Mã xác thực không đúng.' });
    }
    await db.collection('users').doc(decoded.uid).set({
      email: em,
      emailVerified: true,
      displayName: decoded.name || '',
      photoURL: decoded.picture || '',
      notificationEmail: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      verifiedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    await ref.delete();
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message || 'Không xác thực được email.' });
  }
});

function folderIdFromUrl(url) {
  const m = String(url || '').match(/\/folders\/([a-zA-Z0-9_-]+)/) || String(url || '').match(/[?&]id=([a-zA-Z0-9_-]+)/);
  return m ? m[1] : null;
}

async function driveFetch(path, params) {
  const key = process.env.GOOGLE_DRIVE_API_KEY;
  if (!key) throw Object.assign(new Error('Chưa cấu hình Google Drive API key.'), { status: 500 });
  const url = new URL(`https://www.googleapis.com/drive/v3/${path}`);
  Object.entries(params || {}).forEach(([k, v]) => url.searchParams.set(k, v));
  url.searchParams.set('key', key);
  const r = await fetch(url);
  const text = await r.text();
  if (!r.ok) {
    let detail = '';
    try { detail = JSON.parse(text)?.error?.message || ''; } catch {}
    const status = r.status === 403 || r.status === 404 ? 403 : r.status;
    throw Object.assign(new Error(detail || 'Không thể truy cập Google Drive.'), { status });
  }
  return JSON.parse(text);
}

async function listChildren(parentId) {
  let token = '';
  const files = [];
  do {
    const data = await driveFetch('files', {
      q: `'${parentId}' in parents and trashed = false`,
      pageSize: '1000',
      fields: 'nextPageToken,files(id,name,mimeType,webViewLink,thumbnailLink,size,parents,modifiedTime)',
      orderBy: 'folder,name',
      ...(token ? { pageToken: token } : {})
    });
    files.push(...(data.files || []));
    token = data.nextPageToken || '';
  } while (token);
  return files;
}

exports.scanDrive = onRequest(async (req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).send('');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' });
  try {
    const url = String(body(req).url || '').trim();
    const rootId = folderIdFromUrl(url);
    if (!rootId) return res.status(400).json({ error: 'Link Google Drive không hợp lệ. Hãy dán link thư mục.' });
    const root = await driveFetch(`files/${rootId}`, { fields: 'id,name,mimeType,webViewLink' });
    if (root.mimeType !== 'application/vnd.google-apps.folder') return res.status(400).json({ error: 'Link phải trỏ tới một thư mục Google Drive.' });
    const queue = [{ id: root.id, path: [root.name], depth: 0 }];
    const folders = [];
    const allFiles = [];
    const seen = new Set([root.id]);
    while (queue.length) {
      const current = queue.shift();
      const children = await listChildren(current.id);
      folders.push({ ...current, children });
      for (const f of children) {
        allFiles.push({ ...f, path: [...current.path, f.name] });
        if (f.mimeType === 'application/vnd.google-apps.folder' && current.depth < 7 && !seen.has(f.id)) {
          seen.add(f.id);
          queue.push({ id: f.id, path: [...current.path, f.name], depth: current.depth + 1 });
        }
      }
      if (allFiles.length > 5000) break;
    }
    const candidates = [];
    for (const folder of folders) {
      const images = folder.children.filter(f => String(f.mimeType || '').startsWith('image/'));
      const files = folder.children.filter(f => f.mimeType !== 'application/vnd.google-apps.folder');
      if (!images.length && !files.length) continue;
      const joined = folder.path.join(' / ');
      const productName = folder.path[folder.path.length - 1];
      const text = `${joined} ${files.map(f => f.name).join(' ')}`;
      const volume = (text.match(/\b(\d+(?:\.\d+)?)\s*(ml|l|lit|litre|kg|g)\b/i) || [])[0] || '';
      const size = (text.match(/\b(\d{2,5})\s*[x×]\s*(\d{2,5})(?:\s*[x×]\s*(\d{2,5}))?\b/i) || [])[0] || '';
      const quantity = Number((text.match(/(?:qty|quantity|sl|x)\s*[:_-]?\s*(\d+)/i) || [])[1] || 1);
      candidates.push({
        id: folder.id,
        name: productName,
        productName,
        volume,
        size,
        quantity,
        path: joined,
        url: folder.children.find(Boolean)?.parents ? `https://drive.google.com/drive/folders/${folder.id}` : `https://drive.google.com/drive/folders/${folder.id}`,
        images: images.slice(0, 8).map(f => ({ id: f.id, name: f.name, url: `https://drive.google.com/thumbnail?id=${f.id}&sz=w800`, driveUrl: f.webViewLink || `https://drive.google.com/open?id=${f.id}` })),
        files: files.slice(0, 20).map(f => ({ id: f.id, name: f.name, mimeType: f.mimeType, url: f.webViewLink || `https://drive.google.com/open?id=${f.id}` }))
      });
    }
    res.json({ ok: true, root: { id: root.id, name: root.name, url: root.webViewLink || url }, scanned: allFiles.length, items: candidates.slice(0, 1000) });
  } catch (e) {
    console.error(e);
    const status = e.status || 500;
    if (status === 403) return res.status(403).json({ error: 'Không thể truy cập thư mục Google Drive. Hãy vào Chia sẻ → Quyền truy cập chung → Anyone with the link → Viewer rồi thử lại.' });
    res.status(status).json({ error: e.message || 'Không thể quét Google Drive.' });
  }
});
