import './firebase-init.js';

(function () {
  var root = document.getElementById('app');

  function showFatal(error) {
    if (!root) return;
    console.error('GP Statistical startup error:', error);
    var wrap = document.createElement('div');
    wrap.className = 'gate';
    wrap.innerHTML = '<div class="gate-card"><div class="gate-kicker">GP STATISTICAL</div><h1>Chưa thể mở trang.</h1><p>Trang gặp sự cố khi khởi động. Hãy tải lại trang; nếu vẫn xảy ra, gửi ảnh màn hình này để được hỗ trợ.</p><details><summary>Thông tin chi tiết</summary><pre id="gp-startup-error"></pre></details><button class="btn" id="gp-startup-retry">Tải lại trang</button></div>';
    root.replaceChildren(wrap);
    var pre = document.getElementById('gp-startup-error');
    if (pre) pre.textContent = String((error && error.stack) || (error && error.message) || error || 'Không có thông tin chi tiết.');
    var btn = document.getElementById('gp-startup-retry');
    if (btn) btn.onclick = function () { location.reload(); };
  }

  function waitForGoogleIdentity() {
    return new Promise(function (resolve) {
      var started = Date.now();
      function check() {
        if (window.google && window.google.accounts && window.google.accounts.oauth2 && window.google.accounts.oauth2.initTokenClient) {
          resolve();
          return;
        }
        if (Date.now() - started >= 10000) {
          resolve();
          return;
        }
        setTimeout(check, 100);
      }
      check();
    });
  }

  waitForGoogleIdentity()
    .then(function () { return import('./drive-stabilizer.js?v=20260908-42'); })
    .then(function () { return import('./production-suite.js?v=20260908-42'); })
    .then(function () { return import('./public-share-stabilizer.js?v=20260908-42'); })
    .then(function () { return import('./permission-mail.js?v=20260908-42'); })
    .then(function () { return import('./production-runtime.js?v=20260908-42'); })
    .catch(showFatal);
})();
