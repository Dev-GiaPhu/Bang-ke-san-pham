import './firebase-init.js';

const root = document.querySelector('#app');

function showFatal(error) {
  console.error('GP Statistical startup error:', error);
  if (!root) return;
  root.innerHTML = `
    <div class="gate">
      <div class="gate-card">
        <div class="gate-kicker">GP STATISTICAL</div>
        <h1>Chưa thể mở trang.</h1>
        <p>Trang gặp sự cố khi khởi động. Hãy tải lại trang; nếu vẫn xảy ra, gửi ảnh màn hình này để được hỗ trợ.</p>
        <details style="margin:18px 0;text-align:left">
          <summary>Thông tin chi tiết</summary>
          <pre style="white-space:pre-wrap;word-break:break-word;margin-top:10px">${String(error?.stack || error?.message || error)}</pre>
        </details>
        <button class="btn" onclick="location.reload()">Tải lại trang</button>
      </div>
    </div>`;
}

try {
  await import('./production-suite.js');
  await import('./permission-mail.js');
  await import('./production-runtime.js');
} catch (error) {
  showFatal(error);
}
