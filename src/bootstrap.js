import './firebase-init.js';
import './production-hotfix.js';

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

  Promise.resolve()
    .then(function () { return import('./production-suite.js'); })
    .then(function () { return import('./permission-mail.js'); })
    .then(function () { return import('./production-runtime.js'); })
    .catch(showFatal);
})();
