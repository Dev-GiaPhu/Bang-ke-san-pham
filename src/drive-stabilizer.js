import { getApps, getApp } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js';

getAuth(getApps()[0] || getApp());

const KEY = 'gp-drive-token-v2';
let installed = false;

function validToken(token) {
  if (!token) return Promise.reject(new Error('missing'));
  return fetch('https://www.googleapis.com/drive/v3/about?fields=user', {
    headers: { Authorization: `Bearer ${token}` }
  }).then(r => {
    if (!r.ok) throw new Error('expired');
    return r.json();
  });
}

function install() {
  if (installed) return true;
  const oauth = window.google?.accounts?.oauth2;
  if (!oauth?.initTokenClient) return false;
  const original = oauth.initTokenClient.bind(oauth);
  const wrapped = function (config) {
    const cfg = { ...config };
    const userCallback = cfg.callback;
    cfg.callback = response => {
      if (response?.access_token && /drive\.readonly/.test(String(cfg.scope || ''))) {
        try { sessionStorage.setItem(KEY, response.access_token); } catch {}
      }
      userCallback?.(response);
    };
    const client = original(cfg);
    const originalRequest = client.requestAccessToken.bind(client);
    client.requestAccessToken = (params = {}) => {
      const scope = String(cfg.scope || '');
      const silent = params?.prompt === '' && /drive\.readonly/.test(scope);
      if (!silent) return originalRequest(params);

      let saved = '';
      try { saved = sessionStorage.getItem(KEY) || ''; } catch {}
      if (!saved) {
        cfg.callback({ error: 'login_required', error_description: 'Kết nối Google Drive chưa được lưu trong phiên này.' });
        return;
      }
      validToken(saved)
        .then(() => cfg.callback({ access_token: saved, expires_in: 1800, scope }))
        .catch(() => {
          try { sessionStorage.removeItem(KEY); } catch {}
          cfg.callback({ error: 'login_required', error_description: 'Kết nối Google Drive đã hết hạn.' });
        });
    };
    return client;
  };
  wrapped.__gpDriveStable = true;
  oauth.initTokenClient = wrapped;
  installed = true;
  window.GPDriveStable = {
    key: KEY,
    clear() { try { sessionStorage.removeItem(KEY); } catch {} }
  };
  return true;
}

function wait() {
  if (!install()) setTimeout(wait, 100);
}
wait();
