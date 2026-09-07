/* GP Statistical — closes OAuth timing gaps and repairs legacy Drive links. */
(function(){
  const SETTINGS='ventek-design-settings-v2';
  const STORE='ventek-design-tracker-v2';
  const FOLDER='application/vnd.google-apps.folder';
  const SCOPE='https://www.googleapis.com/auth/drive.readonly';
  const read=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key)||JSON.stringify(fallback))}catch{return fallback}};
  const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
  const volume=s=>{const m=String(s||'').match(/((?:\d+(?:[.,]\d+)?)\s?(?:ml|cl|l|lit|liter|litre))/i);return m?m[1].replace(/\s+/g,'').replace(/lit(?:er|re)?$/i,'L').replace(/l$/i,'L'):''};
  const size=s=>{const m=String(s||'').match(/\b(\d{2,5}\s*[x×]\s*\d{2,5}|A[0-6])\b/i);return m?m[1].replace(/\s+/g,'').replace('×','x').toUpperCase():''};
  const idFromUrl=s=>{const m=String(s||'').match(/\/folders\/([\w-]+)/)||String(s||'').match(/[?&]id=([\w-]+)/);return m?m[1]:''};
  const folderUrl=id=>`https://drive.google.com/drive/folders/${id}`;
  let client=null,requesting=false,booted=false;

  function emitToken(token){
    if(!token)return;
    window.__gpDriveToken=token;
    window.__gpDriveAuthenticatedAt=Date.now();
    window.dispatchEvent(new Event('gp-drive-connected'));
    repairLegacyLinks(token).catch(()=>{});
  }

  function boot(){
    if(requesting)return;
    const clientId=String(read(SETTINGS,{}).googleClientId||'').trim();
    if(!clientId || !window.google?.accounts?.oauth2?.initTokenClient)return;
    if(!client){
      client=google.accounts.oauth2.initTokenClient({
        client_id:clientId,
        scope:SCOPE,
        include_granted_scopes:true,
        callback:r=>{
          requesting=false;
          if(r?.access_token){booted=true;emitToken(r.access_token)}
        }
      });
    }
    requesting=true;
    try{client.requestAccessToken({prompt:''})}catch(e){requesting=false}
  }

  async function api(url,token){
    const r=await fetch(url,{headers:{Authorization:`Bearer ${token}`}});
    if(!r.ok)throw Error(`Drive ${r.status}`);
    return r.json();
  }

  async function folderTree(rootId,token){
    const out=[];
    async function walk(id,path){
      let page='';
      do{
        const q=encodeURIComponent(`'${id}' in parents and trashed = false`);
        const fields=encodeURIComponent('nextPageToken,files(id,name,mimeType,webViewLink)');
        let url=`https://www.googleapis.com/drive/v3/files?q=${q}&pageSize=1000&fields=${fields}`;
        if(page)url+=`&pageToken=${encodeURIComponent(page)}`;
        const data=await api(url,token);
        for(const f of data.files||[]){
          const p=[...path,f.name];
          if(f.mimeType===FOLDER){out.push({id:f.id,name:f.name,path:p});await walk(f.id,p)}
        }
        page=data.nextPageToken||'';
      }while(page);
    }
    await walk(rootId,[]);
    return out;
  }

  function patchVisibleLinks(records){
    document.querySelectorAll('.table tbody tr').forEach(row=>{
      const cells=row.querySelectorAll('td');
      if(cells.length<11)return;
      const product=norm(cells[2]?.querySelector('strong')?.textContent||cells[2]?.textContent||'');
      const volumeText=norm(cells[4]?.textContent||'');
      const sizeText=norm(cells[3]?.textContent||'');
      const record=records.find(r=>norm(r.productName)===product && norm(r.volume)===volumeText && norm(r.size)===sizeText);
      if(record?.driveVariantFolderId){
        const a=row.querySelector('a.link');
        if(a)a.href=folderUrl(record.driveVariantFolderId);
      }
    });
  }

  async function repairLegacyLinks(token){
    const records=read(STORE,[]);
    const legacy=records.filter(r=>!r.driveVariantFolderId && (r.driveRootFolderId||r.driveRootFolderUrl||r.driveFolderUrl));
    if(!legacy.length)return;
    const roots=[...new Set(legacy.map(r=>r.driveRootFolderId||idFromUrl(r.driveRootFolderUrl||r.driveFolderUrl)).filter(Boolean))];
    let changed=false;
    for(const rootId of roots){
      let folders=[];
      try{folders=await folderTree(rootId,token)}catch{continue}
      for(const r of legacy.filter(x=>(x.driveRootFolderId||idFromUrl(x.driveRootFolderUrl||x.driveFolderUrl))===rootId)){
        const wantV=volume(r.volume),wantS=size(r.size);
        if(!wantV&&!wantS)continue;
        const candidates=folders.filter(f=>{
          const fv=volume(f.name),fs=size(f.name);
          return (wantV&&fv===wantV)||(wantS&&fs===wantS);
        });
        if(candidates.length!==1)continue;
        r.driveVariantFolderId=candidates[0].id;
        r.driveFolderUrl=folderUrl(candidates[0].id);
        r.driveRootFolderId=rootId;
        r.driveRootFolderUrl=r.driveRootFolderUrl||folderUrl(rootId);
        changed=true;
      }
    }
    if(changed){
      localStorage.setItem(STORE,JSON.stringify(records));
      patchVisibleLinks(records);
      window.dispatchEvent(new Event('gp-drive-links-repaired'));
    }
  }

  window.addEventListener('gp-drive-connected',()=>{booted=true;repairLegacyLinks(window.__gpDriveToken).catch(()=>{})});
  window.__gpRestoreDriveSession=boot;
  let attempts=0;
  const timer=setInterval(()=>{attempts++;if(booted||attempts>40){clearInterval(timer);return}boot()},500);
  window.addEventListener('load',()=>setTimeout(boot,150));
  boot();
})();
