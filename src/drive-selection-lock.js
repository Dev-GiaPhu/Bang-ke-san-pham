/* GP Statistical — lock a record to the EXACT folder path selected by the user. */
(function(){
  const STORE='ventek-design-tracker-v2';
  const FOLDER='application/vnd.google-apps.folder';
  const ASSET=/\.(png|jpe?g|webp|gif|bmp|tiff?|svg|pdf|ai|psd|eps|indd|zip)$/i;
  const read=()=>{try{return JSON.parse(localStorage.getItem(STORE)||'[]')}catch{return[]}};
  const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\\/g,'/').replace(/\s+/g,' ').trim().toLowerCase();
  const idFromUrl=s=>{const m=String(s||'').match(/\/folders\/([\w-]+)/)||String(s||'').match(/[?&]id=([\w-]+)/);return m?m[1]:''};
  const url=id=>`https://drive.google.com/drive/folders/${id}`;
  let running=false;

  async function api(token,u){const r=await fetch(u,{headers:{Authorization:`Bearer ${token}`}});if(!r.ok)throw Error(`Drive ${r.status}`);return r.json()}
  async function scan(token,rootId){
    const root=await api(token,`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(rootId)}?fields=id,name,mimeType,webViewLink`);
    const folders=new Map(),files=[];
    async function walk(id,path,anc){
      folders.set(id,{id,name:path[path.length-1]||root.name,path:[...path],ancestors:[...anc]});
      let page='';
      do{
        const q=encodeURIComponent(`'${id}' in parents and trashed = false`);
        const fields=encodeURIComponent('nextPageToken,files(id,name,mimeType,modifiedTime,version,size,webViewLink,thumbnailLink)');
        let u=`https://www.googleapis.com/drive/v3/files?q=${q}&pageSize=1000&fields=${fields}`;
        if(page)u+=`&pageToken=${encodeURIComponent(page)}`;
        const d=await api(token,u);
        for(const f of d.files||[]){
          if(f.mimeType===FOLDER)await walk(f.id,[...path,f.name],[...anc,{id:f.id,name:f.name}]);
          else if(ASSET.test(f.name))files.push({...f,folderPath:[...path],ancestors:[...anc]});
        }
        page=d.nextPageToken||'';
      }while(page);
    }
    await walk(rootId,[],[]);
    return{root,folders,files};
  }
  const fullPath=(root,p)=>[root.name,...(p||[])].filter(Boolean).join(' / ');
  const pathVariants=(rootName,p)=>{
    const full=norm(fullPath(rootName,p));
    const rel=norm((p||[]).join(' / '));
    return{full,rel};
  };
  function assetsFor(files,folderId){
    return files.filter(f=>(f.ancestors||[]).some(a=>a.id===folderId)).map(f=>({
      id:f.id,name:f.name,mimeType:f.mimeType||'',modifiedTime:f.modifiedTime||'',version:f.version||'',
      size:f.size||'',webViewLink:f.webViewLink||`https://drive.google.com/open?id=${f.id}`,
      thumbnailLink:f.thumbnailLink||'',folderPath:f.folderPath.join(' / '),
      role:/final/i.test(f.name)?'final':/mockup/i.test(f.name)?'mockup':/source/i.test(f.name)?'source':'asset'
    }));
  }
  function previews(assets){
    const a=assets.filter(x=>/\.(png|jpe?g|webp|gif|bmp|tiff?|svg)$/i.test(x.name));
    a.sort((x,y)=>(x.role==='final'?-1:0)-(y.role==='final'?-1:0)||String(y.modifiedTime).localeCompare(String(x.modifiedTime)));
    return a.slice(0,2);
  }
  async function repair(){
    if(running)return;
    const token=window.__gpDriveToken;if(!token)return;
    const records=read();
    const roots=[...new Set(records.map(r=>r.driveRootFolderId||idFromUrl(r.driveRootFolderUrl||r.driveFolderUrl)).filter(Boolean))];
    if(!roots.length)return;
    running=true;let changed=false;
    try{
      for(const rootId of roots){
        let tree;try{tree=await scan(token,rootId)}catch{continue}
        for(const r of records.filter(x=>(x.driveRootFolderId||idFromUrl(x.driveRootFolderUrl||x.driveFolderUrl))===rootId)){
          let chosen=null;
          const desired=String(r.sourceFolderPath||'').trim();
          if(desired){
            const want=norm(desired);
            const matches=[...tree.folders.values()].filter(f=>{
              const p=pathVariants(tree.root,f.path);
              return p.full===want||p.rel===want;
            });
            if(matches.length===1)chosen=matches[0];
          }
          /* If the saved path is unambiguous, it is authoritative. Otherwise keep
             the exact saved folder ID. Never choose another same-name folder. */
          if(!chosen&&r.driveVariantFolderId)chosen=tree.folders.get(r.driveVariantFolderId)||null;
          if(!chosen)continue;
          const assets=assetsFor(tree.files,chosen.id);
          const pr=previews(assets);
          const newPath=fullPath(tree.root,chosen.path);
          const next={
            driveRootFolderId:rootId,
            driveRootFolderUrl:r.driveRootFolderUrl||tree.root.webViewLink||url(rootId),
            driveVariantFolderId:chosen.id,
            driveFolderUrl:url(chosen.id),
            sourceFolderPath:newPath,
            drivePresent:true,
            assets,
            previewAssets:pr,
            previewFileId:pr[0]?.id||'',
            previewFileName:pr[0]?.name||'',
            lastDriveSync:new Date().toISOString()
          };
          if(r.driveVariantFolderId!==next.driveVariantFolderId||r.sourceFolderPath!==next.sourceFolderPath||JSON.stringify(r.assets||[])!==JSON.stringify(next.assets)){
            Object.assign(r,next);changed=true;
          }
        }
      }
      if(changed){localStorage.setItem(STORE,JSON.stringify(records));window.dispatchEvent(new Event('gp-drive-selection-locked'))}
    }finally{running=false}
  }

  /* Manual confirmation is the one operation allowed to change folder identity.
     Auto-sync writes are guarded so duplicate names can never overwrite it. */
  document.addEventListener('click',e=>{
    const b=e.target.closest?.('#confirm');
    if(b){window.__gpManualDriveWrite=true;setTimeout(()=>{window.__gpManualDriveWrite=false},2000)}
  },true);
  const nativeSet=Storage.prototype.setItem;
  Storage.prototype.setItem=function(k,v){
    if(k!==STORE||window.__gpManualDriveWrite)return nativeSet.call(this,k,v);
    try{
      const old=read(),next=JSON.parse(v);
      const oldById=new Map(old.map(r=>[r.id,r]));
      const merged=next.map(r=>{
        const prev=oldById.get(r.id);
        if(!prev?.driveVariantFolderId||!r.driveVariantFolderId)return r;
        if(prev.driveVariantFolderId===r.driveVariantFolderId)return r;
        /* A background sync is trying to merge another same-name variant into an
           existing record. Preserve the user's selected folder and its assets. */
        return {...r,
          driveRootFolderId:prev.driveRootFolderId||r.driveRootFolderId,
          driveRootFolderUrl:prev.driveRootFolderUrl||r.driveRootFolderUrl,
          driveVariantFolderId:prev.driveVariantFolderId,
          driveFolderUrl:prev.driveFolderUrl,
          sourceFolderPath:prev.sourceFolderPath,
          assets:prev.assets,
          previewAssets:prev.previewAssets,
          previewFileId:prev.previewFileId,
          previewFileName:prev.previewFileName,
          drivePresent:prev.drivePresent
        };
      });
      return nativeSet.call(this,k,JSON.stringify(merged));
    }catch{return nativeSet.call(this,k,v)}
  };

  const schedule=()=>{setTimeout(repair,900);setTimeout(repair,2200);setTimeout(repair,5000)};
  window.addEventListener('gp-drive-connected',schedule);
  window.addEventListener('gp-drive-links-repaired',schedule);
  window.addEventListener('load',schedule);
})();