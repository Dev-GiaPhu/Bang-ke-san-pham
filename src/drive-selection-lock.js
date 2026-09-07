/* GP Statistical — one-time repair, then immutable Drive-folder identity. */
(function(){
  const STORE='ventek-design-tracker-v2',FOLDER='application/vnd.google-apps.folder';
  const ASSET=/\.(png|jpe?g|webp|gif|bmp|tiff?|svg|pdf|ai|psd|eps|indd|zip)$/i;
  const IMG=/\.(png|jpe?g|webp|gif|bmp|tiff?|svg)$/i;
  const read=()=>{try{return JSON.parse(localStorage.getItem(STORE)||'[]')}catch{return[]}};
  const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\\/g,'/').replace(/\s+/g,' ').trim().toLowerCase();
  const idFromUrl=s=>{const m=String(s||'').match(/\/folders\/([\w-]+)/)||String(s||'').match(/[?&]id=([\w-]+)/);return m?m[1]:''};
  const url=id=>`https://drive.google.com/drive/folders/${id}`;
  const path=(root,p)=>[root,...(p||[])].filter(Boolean).join(' / ');
  async function api(token,u){const r=await fetch(u,{headers:{Authorization:`Bearer ${token}`});if(!r.ok)throw Error();return r.json()}
  async function tree(token,rootId){
    const root=await api(token,`https://www.googleapis.com/drive/v3/files/${rootId}?fields=id,name,mimeType,webViewLink`);
    const folders=new Map(),files=[];
    async function walk(id,p){
      folders.set(id,{id,name:p[p.length-1]||root.name,path:[...p]});
      let page='';do{
        const q=encodeURIComponent(`'${id}' in parents and trashed = false`),fields=encodeURIComponent('nextPageToken,files(id,name,mimeType,modifiedTime,version,size,webViewLink,thumbnailLink)');
        let u=`https://www.googleapis.com/drive/v3/files?q=${q}&pageSize=1000&fields=${fields}`;if(page)u+=`&pageToken=${encodeURIComponent(page)}`;
        const d=await api(token,u);for(const f of d.files||[]){if(f.mimeType===FOLDER)await walk(f.id,[...p,f.name]);else if(ASSET.test(f.name))files.push({...f,folderPath:[...p]})}page=d.nextPageToken||'';
      }while(page)
    }
    await walk(rootId,[]);return{root,folders,files};
  }
  function exactFolder(t,r){
    const desired=norm(r.sourceFolderPath||'');if(desired){const hits=[...t.folders.values()].filter(f=>norm(path(t.root.name,f.path))===desired);if(hits.length===1)return hits[0]}
    return r.driveVariantFolderId?t.folders.get(r.driveVariantFolderId)||null:null;
  }
  function assets(t,id){return t.files.filter(f=>f.folderPath.some((_,i)=>false)||false).filter(f=>{
    const v=[...f.folderPath];const folder=t.folders.get(id);return folder&&norm(path(t.root.name,v))!==''&&v.join('\0')===folder.path.join('\0');
  }).map(f=>({id:f.id,name:f.name,mimeType:f.mimeType||'',modifiedTime:f.modifiedTime||'',version:f.version||'',size:f.size||'',webViewLink:f.webViewLink||`https://drive.google.com/open?id=${f.id}`,thumbnailLink:f.thumbnailLink||'',folderPath:f.folderPath.join(' / '),role:/final/i.test(f.name)?'final':/mockup/i.test(f.name)?'mockup':/source/i.test(f.name)?'source':'asset'}))}
  function directAssets(t,id){
    const folder=t.folders.get(id);if(!folder)return[];
    const exact=folder.path.join('\0');
    return t.files.filter(f=>f.folderPath.join('\0')===exact).map(f=>({id:f.id,name:f.name,mimeType:f.mimeType||'',modifiedTime:f.modifiedTime||'',version:f.version||'',size:f.size||'',webViewLink:f.webViewLink||`https://drive.google.com/open?id=${f.id}`,thumbnailLink:f.thumbnailLink||'',folderPath:f.folderPath.join(' / '),role:/final/i.test(f.name)?'final':/mockup/i.test(f.name)?'mockup':/source/i.test(f.name)?'source':'asset'}));
  }
  function previews(a){return a.filter(x=>IMG.test(x.name)).sort((x,y)=>(x.role==='final'?-1:0)-(y.role==='final'?-1:0)||String(y.modifiedTime).localeCompare(String(x.modifiedTime))).slice(0,2)}
  let once=false;
  async function repairOnce(){
    if(once||!window.__gpDriveToken)return;once=true;
    const rs=read(),roots=[...new Set(rs.map(r=>r.driveRootFolderId||idFromUrl(r.driveRootFolderUrl||r.driveFolderUrl)).filter(Boolean))];let changed=false;
    for(const rootId of roots){let t;try{t=await tree(window.__gpDriveToken,rootId)}catch{continue}
      for(const r of rs.filter(x=>(x.driveRootFolderId||idFromUrl(x.driveRootFolderUrl||x.driveFolderUrl))===rootId)){
        const f=exactFolder(t,r);if(!f)continue;const a=directAssets(t,f.id),p=previews(a),newPath=path(t.root.name,f.path),next={driveRootFolderId:rootId,driveRootFolderUrl:r.driveRootFolderUrl||t.root.webViewLink||url(rootId),driveVariantFolderId:f.id,driveFolderUrl:url(f.id),sourceFolderPath:newPath,assets:a,previewAssets:p,previewFileId:p[0]?.id||'',previewFileName:p[0]?.name||'',drivePresent:true,lastDriveSync:new Date().toISOString(),driveIdentityLocked:true};
        if(r.driveVariantFolderId!==f.id||r.sourceFolderPath!==newPath||JSON.stringify(r.assets||[])!==JSON.stringify(a)){Object.assign(r,next);changed=true}
      }
    }
    if(changed){window.__gpManualDriveWrite=true;localStorage.setItem(STORE,JSON.stringify(rs));window.__gpManualDriveWrite=false;window.dispatchEvent(new Event('gp-drive-identity-fixed'))}
  }
  const nativeSet=Storage.prototype.setItem;
  Storage.prototype.setItem=function(k,v){
    if(k!==STORE||window.__gpManualDriveWrite)return nativeSet.call(this,k,v);
    try{const old=read(),next=JSON.parse(v),byId=new Map(old.map(r=>[r.id,r]));const merged=next.map(r=>{const p=byId.get(r.id);if(!p?.driveIdentityLocked)return r;if(r.driveVariantFolderId!==p.driveVariantFolderId||r.driveFolderUrl!==p.driveFolderUrl||r.sourceFolderPath!==p.sourceFolderPath||JSON.stringify(r.assets||[])!==JSON.stringify(p.assets||[]))return {...r,driveRootFolderId:p.driveRootFolderId,driveRootFolderUrl:p.driveRootFolderUrl,driveVariantFolderId:p.driveVariantFolderId,driveFolderUrl:p.driveFolderUrl,sourceFolderPath:p.sourceFolderPath,assets:p.assets,previewAssets:p.previewAssets,previewFileId:p.previewFileId,previewFileName:p.previewFileName,drivePresent:p.drivePresent,driveIdentityLocked:true};return r});return nativeSet.call(this,k,JSON.stringify(merged))}catch{return nativeSet.call(this,k,v)}
  };
  document.addEventListener('click',e=>{if(e.target.closest?.('#confirm'))window.__gpManualDriveWrite=true;setTimeout(()=>window.__gpManualDriveWrite=false,1500)},true);
  window.addEventListener('gp-drive-connected',()=>setTimeout(repairOnce,450));
  window.addEventListener('load',()=>setTimeout(repairOnce,1200));
})();
