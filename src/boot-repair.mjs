const VERSION='20260908-64';
const root=document.querySelector('#app');
function showError(error){
  const message=String(error?.stack||error?.message||error||'Không thể mở GP Statistical.');
  if(!root)return;
  root.innerHTML=`<div style="min-height:100vh;display:grid;place-items:center;background:#f7f4ee;padding:32px;font-family:Arial,sans-serif;color:#142033"><div style="max-width:900px;width:100%;background:#fffdf9;border:1px solid #ddd6ca;border-radius:28px;padding:36px;box-shadow:0 20px 60px rgba(20,32,51,.10)"><div style="font-size:13px;letter-spacing:4px;font-weight:800;color:#f36b3c">GP STATISTICAL</div><h1 style="font-size:48px;margin:18px 0 10px">Trang chưa thể mở</h1><p style="font-size:19px;color:#697586">Hệ thống gặp sự cố khi khởi động. Không có dữ liệu nào bị xóa.</p><details open><summary style="font-weight:700;cursor:pointer">Thông tin để xử lý</summary><pre style="white-space:pre-wrap;margin-top:16px;padding:18px;background:#f4f1eb;border-radius:16px;overflow:auto">${message.replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]))}</pre></details><button onclick="location.reload()" style="margin-top:22px;border:0;border-radius:14px;padding:14px 22px;background:#142033;color:#fff;font-weight:700;cursor:pointer">Tải lại trang</button></div></div>`;
}
async function start(){
  try{
    const url=`./src/gp-app-stable.js?v=${VERSION}`;
    const response=await fetch(url,{cache:'no-store'});
    if(!response.ok)throw new Error(`Không thể tải ứng dụng GP Statistical (${response.status}).`);
    let source=await response.text();
    const marker="document.querySelector('#addScanned').onclick=async()=>{";
    const startAt=source.indexOf(marker);
    if(startAt!==-1){
      const catchAt=source.indexOf('catch(e){',startAt);
      if(catchAt!==-1){
        const before=source.slice(0,catchAt);
        const tail=source.slice(catchAt);
        if(!/\};\}$/.test(before.slice(-8))&&!/\};\s*\}$/.test(before.slice(-12))){
          source=before+'};}'+tail;
        }
      }
    }
    const blob=new Blob([source],{type:'text/javascript'});
    const blobUrl=URL.createObjectURL(blob);
    await import(blobUrl);
    setTimeout(()=>URL.revokeObjectURL(blobUrl),60000);
  }catch(error){showError(error)}
}
start();
