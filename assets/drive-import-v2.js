import { DRIVE } from './config.js';

(function(){
  const API='https://www.googleapis.com/drive/v3/files';
  const esc=v=>String(v??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#039;'}[c]));
  const getKey=()=>String(DRIVE?.apiKey||'').trim();
  const idOf=s=>{s=String(s||'').trim();if(/^[A-Za-z0-9_-]{10,}$/.test(s))return s;return s.match(/\/folders\/([A-Za-z0-9_-]+)/)?.[1]||s.match(/[?&]id=([A-Za-z0-9_-]+)/)?.[1]||null};
  const clean=n=>String(n||'').replace(/\.[^.]+$/,'').replace(/[_-]+/g,' ').replace(/\s+/g,' ').trim();
  const rx=(re,s)=>s.match(re)?.[1]||'';
  const size=n=>{const m=String(n).match(/(\d+(?:[.,]\d+)?)\s*[x×*]\s*(\d+(?:[.,]\d+)?)(?:\s*[x×*]\s*(\d+(?:[.,]\d+)?))?\s*(mm|cm|m)?/i);return m?m.slice(1).filter(Boolean).join(' x '):''};
  const vol=n=>{const m=String(n).match(/(\d+(?:[.,]\d+)?)\s*(ml|mL|l|L)\b/i);return m?m[1].replace(',','.')+' '+m[2]:''};
  const qty=n=>rx(/(?:sl|qty|quantity|so\s*luong)\s*[:_-]?\s*(\d+)/i,n)||rx(/(?:^|[^\d])x\s*(\d+)\b/i,n)||'1';

  async function json(url){
    const r=await fetch(url);
    let d={}; try{d=await r.json()}catch{}
    if(!r.ok){
      if(r.status===400) throw Error(d?.error?.message||'Google Drive không chấp nhận yêu cầu.');
      if(r.status===403) throw Error('Không có quyền truy cập Google Drive. Hãy đặt thư mục và các file cần quét thành “Bất kỳ ai có liên kết đều có thể xem”, đồng thời kiểm tra Google Drive API đã bật.');
      if(r.status===404) throw Error('Không tìm thấy thư mục Drive hoặc thư mục chưa được công khai.');
      throw Error(d?.error?.message||`Google Drive API lỗi HTTP ${r.status}.`);
    }
    return d;
  }

  async function list(parent){
    let files=[],token='';
    do{
      const u=new URL(API);
      u.searchParams.set('q',`'${parent}' in parents and trashed=false`);
      u.searchParams.set('pageSize','1000');
      u.searchParams.set('fields','nextPageToken,files(id,name,mimeType,webViewLink,webContentLink,thumbnailLink,size,modifiedTime,parents)');
      u.searchParams.set('orderBy','folder,name');
      if(token)u.searchParams.set('pageToken',token);
      u.searchParams.set('supportsAllDrives','true');
      u.searchParams.set('includeItemsFromAllDrives','true');
      u.searchParams.set('key',getKey());
      const d=await json(u);
      files.push(...(d.files||[]));
      token=d.nextPageToken||'';
    }while(token);
    return files;
  }

  async function get(id){
    const u=new URL(API+'/'+encodeURIComponent(id));
    u.searchParams.set('fields','id,name,mimeType,webViewLink,webContentLink,thumbnailLink,size,modifiedTime,parents');
    u.searchParams.set('supportsAllDrives','true');
    u.searchParams.set('key',getKey());
    return json(u);
  }

  async function walk(rootId,maxDepth,maxFiles){
    const root=await get(rootId);
    if(root.mimeType!=='application/vnd.google-apps.folder')throw Error('Link phải trỏ tới một thư mục Google Drive.');
    const out=[];
    async function visit(id,path,depth){
      if(out.length>=maxFiles)return;
      const files=await list(id);
      for(const f of files){
        if(out.length>=maxFiles)return;
        const p=path+' / '+f.name;
        if(f.mimeType==='application/vnd.google-apps.folder'){
          if(depth<maxDepth)await visit(f.id,p,depth+1);
        }else out.push({...f,__path:p,__folder:path});
      }
    }
    await visit(rootId,root.name,0);
    return{root,files:out};
  }

  function row(f){
    const image=/^image\//i.test(f.mimeType||'');
    return{
      'Sản phẩm':clean(f.name),
      'Kích thước':size(f.name),
      'Thể tích':vol(f.name),
      'Số lượng':qty(f.name),
      'Designer':rx(/(?:designer|design)\s*[:_-]\s*([^/]+)/i,f.__folder||''),
      'Ngày':f.modifiedTime?new Date(f.modifiedTime).toLocaleDateString('vi-VN'):'',
      'Đường dẫn Drive':f.webViewLink||`https://drive.google.com/file/d/${f.id}/view`,
      'Hình ảnh':image?`https://drive.google.com/thumbnail?id=${encodeURIComponent(f.id)}&sz=w800`:'',
      '__fileId':f.id,__mime:f.mimeType,__fileName:f.name,__folder:f.__folder||''
    };
  }

  function styles(){
    if(document.getElementById('drive-v2-style'))return;
    const s=document.createElement('style');s.id='drive-v2-style';
    s.textContent=`.d2-list{max-height:55vh;overflow:auto;border:1px solid #e5e7eb;border-radius:14px}.d2-row{display:grid;grid-template-columns:32px 64px minmax(0,1fr) auto;gap:12px;align-items:center;padding:10px 12px;border-bottom:1px solid #edf0f5}.d2-thumb{width:56px;height:56px;border-radius:10px;object-fit:cover;background:#f2f4f7}.d2-meta{font-size:12px;color:#667085;line-height:1.45;margin-top:3px}.d2-edit{display:grid;grid-template-columns:150px 1fr;gap:8px;padding:9px 0;border-bottom:1px solid #edf0f5}.d2-edit:last-child{border-bottom:0}.d2-toolbar{display:flex;gap:8px;align-items:center;justify-content:space-between;flex-wrap:wrap}.drive-error{padding:14px;background:#fef2f2;color:#b42318;border-radius:12px;line-height:1.5}.drive-note{padding:12px 14px;background:#eff6ff;border-radius:12px;font-size:13px;color:#1e3a8a}@media(max-width:700px){.d2-row{grid-template-columns:30px 52px 1fr}.d2-row>.d2-act{grid-column:3}.d2-edit{grid-template-columns:1fr}}`;
    document.head.appendChild(s);
  }

  async function save(data){
    try{
      const [{getApps,getApp,initializeApp},{getFirestore,doc,updateDoc,serverTimestamp}]=await Promise.all([
        import('https://www.gstatic.com/firebasejs/12.8.0/firebase-app.js'),
        import('https://www.gstatic.com/firebasejs/12.8.0/firebase-firestore.js')
      ]);
      const {FIREBASE}=await import('./config.js');
      const app=getApps().length?getApp():initializeApp(FIREBASE);
      const db=getFirestore(app);
      const id=new URLSearchParams(location.search).get('id');
      if(id)await updateDoc(doc(db,'sheets',id),{rows:data.rows,columns:data.columns,name:data.name,updatedAt:serverTimestamp()});
    }catch(e){console.warn('Drive import auto-save failed',e)}
  }

  async function driveImport(data,render){
    styles();
    const key=getKey();
    const m=document.createElement('div');m.className='modal-backdrop';
    m.innerHTML=`<div class="modal modal-wide"><div class="modal-head"><div><div class="eyebrow">GOOGLE DRIVE</div><h2>Import từ Google Drive</h2><div class="muted">Dán link thư mục công khai. Người dùng không cần nhập API key.</div></div><button class="btn" id="d2close">Đóng</button></div><div class="field"><label>Link thư mục Google Drive</label><input class="input" id="d2link" placeholder="https://drive.google.com/drive/folders/..." autocomplete="off"></div><div id="d2msg" style="margin-top:12px"></div><div id="d2results" style="margin-top:12px"></div><div class="actions" style="margin-top:14px"><button class="btn primary" id="d2scan">Quét</button><button class="btn" id="d2import" style="display:none">Import mục đã chọn</button></div></div>`;
    document.body.appendChild(m);
    m.querySelector('#d2close').onclick=()=>m.remove();

    m.querySelector('#d2scan').onclick=async()=>{
      try{
        if(!key)throw Error('Hệ thống chưa được cấu hình Google Drive API key.');
        const rootId=idOf(m.querySelector('#d2link').value);
        if(!rootId)throw Error('Link Drive không hợp lệ.');
        m.querySelector('#d2msg').innerHTML='<div class="drive-note">Đang kiểm tra quyền truy cập và quét thư mục…</div>';
        m.querySelector('#d2results').innerHTML='';
        const {root,files}=await walk(rootId,DRIVE.maxDepth||8,DRIVE.maxFiles||500);
        const rows=files.filter(f=>f.mimeType!=='application/vnd.google-apps.shortcut').map(row);
        window.__d2Rows=rows;window.__d2Sel=new Set(rows.map((_,i)=>i));
        const result=m.querySelector('#d2results');
        result.innerHTML=`<div class="d2-toolbar"><div><b>${rows.length}</b> mục tìm thấy trong <b>${esc(root.name)}</b></div><div><label><input type="checkbox" id="d2all" checked> Chọn tất cả</label> <button class="btn" id="d2edit" style="display:none">Chỉnh sửa mục đã chọn</button></div></div><div class="d2-list">${rows.map((r,i)=>`<div class="d2-row"><input type="checkbox" class="d2check" data-i="${i}" checked><div>${r['Hình ảnh']?`<img class="d2-thumb" src="${esc(r['Hình ảnh'])}" alt="">`:'<div class="d2-thumb" style="display:grid;place-items:center;font-size:11px">FILE</div>'}</div><div><b>${esc(r['Sản phẩm'])}</b><div class="d2-meta">${esc(r.__folder)}<br>Kích thước: ${esc(r['Kích thước']||'—')} · Thể tích: ${esc(r['Thể tích']||'—')} · SL: ${esc(r['Số lượng']||'1')}<br>${esc(r.__fileName)}</div></div><div class="d2-act"><a class="btn" href="${esc(r['Đường dẫn Drive'])}" target="_blank" rel="noopener">Mở</a></div></div>`).join('')}</div>`;
        const all=m.querySelector('#d2all'),edit=m.querySelector('#d2edit'),importBtn=m.querySelector('#d2import');
        const sync=()=>{all.checked=window.__d2Sel.size===rows.length;all.indeterminate=window.__d2Sel.size>0&&window.__d2Sel.size<rows.length;edit.style.display=window.__d2Sel.size?'inline-flex':'none';importBtn.style.display=window.__d2Sel.size?'inline-flex':'none'};
        all.onchange=()=>{m.querySelectorAll('.d2check').forEach(x=>{x.checked=all.checked;const i=+x.dataset.i;all.checked?window.__d2Sel.add(i):window.__d2Sel.delete(i)});sync()};
        m.querySelectorAll('.d2check').forEach(x=>x.onchange=()=>{const i=+x.dataset.i;x.checked?window.__d2Sel.add(i):window.__d2Sel.delete(i);sync()});
        edit.onclick=()=>{const chosen=[...window.__d2Sel];const fields=['Sản phẩm','Kích thước','Thể tích','Số lượng','Designer','Ngày'];result.innerHTML+=`<div class="card" style="margin-top:12px"><h3>Chỉnh sửa ${chosen.length} mục</h3>${fields.map(f=>`<div class="d2-edit"><label>${f}</label><input class="input" data-bulk="${esc(f)}" placeholder="Để trống = giữ nguyên"></div>`).join('')}<div class="actions" style="margin-top:10px"><button class="btn primary" id="d2apply">Áp dụng</button></div></div>`;m.querySelector('#d2apply').onclick=()=>{m.querySelectorAll('[data-bulk]').forEach(inp=>{if(inp.value!=='')chosen.forEach(i=>window.__d2Rows[i][inp.dataset.bulk]=inp.value)});render();m.remove()}};
        sync();m.querySelector('#d2msg').innerHTML=`<div class="drive-note">Đã quét ${rows.length} mục. Chỉ những mục được tick mới được import.</div>`;
      }catch(e){m.querySelector('#d2msg').innerHTML=`<div class="drive-error">${esc(e.message)}</div>`}
    };
    m.querySelector('#d2import').onclick=async()=>{const chosen=[...(window.__d2Sel||[])].map(i=>window.__d2Rows[i]).filter(Boolean);chosen.forEach(r=>data.rows.push({...r}));render();await save(data);m.remove();const t=document.createElement('div');t.className='toast show';t.textContent=`Đã import ${chosen.length} mục từ Google Drive.`;document.body.appendChild(t);setTimeout(()=>t.remove(),2500)};
  }
  window.driveImport=driveImport;
})();
