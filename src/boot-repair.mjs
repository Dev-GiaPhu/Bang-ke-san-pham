const VERSION='20260908-66';
const root=document.querySelector('#app');

function escapeHtml(value){
  return String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch]));
}

function showError(error,details={}){
  const message=String(error?.stack||error?.message||error||'Không thể mở GP Statistical.');
  const file=details.file||'Không xác định';
  const line=details.line?`Dòng ${details.line}`:'Không xác định được dòng';
  if(!root)return;
  root.innerHTML=`<div style="min-height:100vh;display:grid;place-items:center;background:#f7f4ee;padding:32px;font-family:Arial,sans-serif;color:#142033"><div style="max-width:980px;width:100%;background:#fffdf9;border:1px solid #ddd6ca;border-radius:28px;padding:36px;box-shadow:0 20px 60px rgba(20,32,51,.10)"><div style="font-size:13px;letter-spacing:4px;font-weight:800;color:#f36b3c">GP STATISTICAL</div><h1 style="font-size:44px;margin:18px 0 10px">Trang chưa thể mở</h1><p style="font-size:18px;color:#697586">Hệ thống gặp sự cố khi khởi động. Không có dữ liệu nào bị xóa.</p><div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:22px 0"><div style="padding:16px 18px;background:#f4f1eb;border-radius:14px"><b>Tệp</b><div style="margin-top:6px">${escapeHtml(file)}</div></div><div style="padding:16px 18px;background:#f4f1eb;border-radius:14px"><b>Vị trí</b><div style="margin-top:6px">${escapeHtml(line)}</div></div></div><details open><summary style="font-weight:700;cursor:pointer">Thông tin để xử lý</summary><pre style="white-space:pre-wrap;margin-top:16px;padding:18px;background:#f4f1eb;border-radius:16px;overflow:auto">${escapeHtml(message)}</pre></details><button onclick="location.reload()" style="margin-top:22px;border:0;border-radius:14px;padding:14px 22px;background:#142033;color:#fff;font-weight:700;cursor:pointer">Tải lại trang</button></div></div>`;
}

function locateLine(error,source){
  const text=String(error?.stack||error?.message||'');
  const match=text.match(/(?:^|\\n).*?:(\\d+)(?::\\d+)?(?:\\)?(?:$|\\n)/m);
  if(match)return Number(match[1]);
  const lines=source.split(/\\r?\\n/);
  const badIndex=source.indexOf("toast(`Đã thêm ${cs.length} mục.`)}catch(e)");
  return badIndex>=0?source.slice(0,badIndex).split(/\\r?\\n/).length:null;
}

function repairKnownSyntax(source){
  const bad="toast(`Đã thêm ${cs.length} mục.`)}catch(e)";
  const good="toast(`Đã thêm ${cs.length} mục.`);};}catch(e)";
  if(!source.includes(bad))return {source,repaired:false,line:null};
  const line=source.slice(0,source.indexOf(bad)).split(/\\r?\\n/).length;
  return {source:source.replace(bad,good),repaired:true,line};
}

async function start(){
  try{
    const url=`./src/gp-app-stable.js?v=${VERSION}`;
    const response=await fetch(url,{cache:'no-store'});
    if(!response.ok)throw new Error(`Không thể tải ứng dụng GP Statistical (${response.status}).`);
    const original=await response.text();
    const fixed=repairKnownSyntax(original);
    const source=fixed.source;

    try{
      const body=source.split(/\\r?\\n/).slice(3).join('\\n');
      new Function(body);
    }catch(syntaxError){
      showError(syntaxError,{file:'src/gp-app-stable.js',line:locateLine(syntaxError,source)||fixed.line});
      return;
    }

    if(fixed.repaired)console.warn('[GP Statistical] repaired syntax in src/gp-app-stable.js at line',fixed.line);
    const blobUrl=URL.createObjectURL(new Blob([source],{type:'text/javascript'}));
    try{await import(blobUrl)}finally{setTimeout(()=>URL.revokeObjectURL(blobUrl),60000)}
  }catch(error){
    showError(error,{file:'src/boot-repair.mjs'});
  }
}

window.addEventListener('error',event=>{
  if(event?.error)showError(event.error,{file:event.filename||'Không xác định'});
});
window.addEventListener('unhandledrejection',event=>{
  if(event?.reason)showError(event.reason,{file:'Không xác định'});
});

start();
