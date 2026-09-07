/* GP Statistical — preserve exact Drive variant identity; never merge duplicate folder names. */
(function(){
  const STORE='ventek-design-tracker-v2';
  const FOLDER='application/vnd.google-apps.folder';
  const ASSET=/\.(png|jpe?g|webp|gif|bmp|tiff?|svg|pdf|ai|psd|eps|indd|zip)$/i;
  const VOL=/((?:\d+(?:[.,]\d+)?)\s?(?:ml|cl|l|lit|liter|litre))/i;
  const SIZ=/\b(\d{2,5}\s*[x×]\s*\d{2,5}|A[0-6])\b/i;
  const ARCHIVE=/^(old\s*version|old|archive|archived|backup|backups|obsolete|deprecated|previous|prev(?:ious)?\s*version)$/i;
  const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
  const volume=s=>{const m=String(s||'').match(VOL);if(!m)return'';return m[1].replace(/\s+/g,'').replace(/lit(?:er|re)?$/i,'L').replace(/l$/i,'L')};
  const size=s=>{const m=String(s||'').match(SIZ);return m?m[1].replace(/\s+/g,'').replace('×','x').toUpperCase():''};
  const idFromUrl=s=>{const m=String(s||'').match(/\/folders\/([\w-]+)/)||String(s||'').match(/[?&]id=([\w-]+)/);return m?m[1]:''};
  const folderUrl=id=>`https://drive.google.com/drive/folders/${id}`;
  const read=()=>{try{return JSON.parse(localStorage.getItem(STORE)||'[]')}catch{return[]}};
  let running=false;

  async function api(token,url){const r=await fetch(url,{headers:{Authorization:`Bearer ${token}`}});if(!r.ok)throw Error(`Drive ${r.status}`);return r.json()}
  async function walk(token,rootId){
    const folders=new Map(),files=[];
    async function visit(id,path,anc){
      folders.set(id,{id,name:path[path.length-1]||'',path:[...path],ancestors:[...anc]});
      let page='';
      do{
        const q=encodeURIComponent(`'${id}' in parents and trashed = false`);
        const fields=encodeURIComponent('nextPageToken,files(id,name,mimeType,modifiedTime,version,size,webViewLink,thumbnailLink)');
        let url=`https://www.googleapis.com/drive/v3/files?q=${q}&pageSize=1000&fields=${fields}`;
        if(page)url+=`&pageToken=${encodeURIComponent(page)}`;
        const data=await api(token,url);
        for(const f of data.files||[]){
          if(f.mimeType===FOLDER)await visit(f.id,[...path,f.name],[...anc,{id:f.id,name:f.name}]);
          else if(ASSET.test(f.name))files.push({...f,folderPath:[...path],ancestors:[...anc]});
        }
        page=data.nextPageToken||'';
      }while(page);
    }
    await visit(rootId,[],[]);
    return{folders,files};
  }
  function nearestVariant(anc){return[...(anc||[])].reverse().find(a=>volume(a.name)||size(a.name))||null}
  function isArchivePath(path){return(path||[]).some(x=>ARCHIVE.test(String(x||'').trim()))}
  function sameVariant(a,b){return volume(a.name)===volume(b.name)&&size(a.name)===size(b.name)&&(volume(a.name)||size(a.name))}
  function assetsForVariant(files,variantId){return files.filter(f=>nearestVariant(f.ancestors)?.id===variantId)}
  function mapAssets(files,variantId){return assetsForVariant(files,variantId).map(f=>({id:f.id,name:f.name,mimeType:f.mimeType||'',modifiedTime:f.modifiedTime||'',version:f.version||'',webViewLink:f.webViewLink||`https://drive.google.com/open?id=${f.id}`,thumbnailLink:f.thumbnailLink||'',folderPath:f.folderPath.join(' / '),role:/final/i.test(f.name)?'final':/mockup/i.test(f.name)?'mockup':/source/i.test(f.name)?'source':'asset'}))}

  async function repair(){
    if(running)return;
    const token=window.__gpDriveToken;
    if(!token)return;
    const records=read();
    const roots=[...new Set(records.map(r=>r.driveRootFolderId||idFromUrl(r.driveRootFolderUrl||r.driveFolderUrl)).filter(Boolean))];
    if(!roots.length)return;
    running=true;
    let changed=false;
    try{
      for(const rootId of roots){
        let tree;try{tree=await walk(token,rootId)}catch{continue}
        const rootChildren=[...tree.folders.values()].filter(f=>f.ancestors.length===1);
        for(const r of records.filter(x=>(x.driveRootFolderId||idFromUrl(x.driveRootFolderUrl||x.driveFolderUrl))===rootId)){
          let chosen=tree.folders.get(r.driveVariantFolderId);
          const currentPath=chosen?.path||String(r.sourceFolderPath||'').split(' / ').filter(Boolean);
          /* If a record was accidentally moved to an archive/Old version duplicate,
             prefer the unique direct-child variant with the same identity. */
          if(chosen&&isArchivePath(currentPath)){
            const direct=rootChildren.filter(f=>sameVariant(f,chosen));
            if(direct.length===1)chosen=direct[0];
          }
          /* Legacy records without an exact folder ID may only resolve to a direct
             child of the supplied root. Nested same-name folders are never guessed. */
          if(!chosen){
            const wantV=volume(r.volume),wantS=size(r.size);
            const direct=rootChildren.filter(f=>{
              const fv=volume(f.name),fs=size(f.name);
              return (wantV&&fv===wantV)||(wantS&&fs===wantS);
            });
            if(direct.length===1)chosen=direct[0];
          }
          if(!chosen)continue;
          const newAssets=mapAssets(tree.files,chosen.id);
          const newPath=chosen.path.join(' / ');
          const oldId=r.driveVariantFolderId||'';
          if(oldId!==chosen.id||r.sourceFolderPath!==newPath||JSON.stringify(r.assets||[])!==JSON.stringify(newAssets)){
            r.driveRootFolderId=rootId;
            r.driveRootFolderUrl=r.driveRootFolderUrl||folderUrl(rootId);
            r.driveVariantFolderId=chosen.id;
            r.driveFolderUrl=folderUrl(chosen.id);
            r.sourceFolderPath=newPath;
            if(newAssets.length)r.assets=newAssets;
            r.previewAssets=newAssets.filter(a=>/\.(png|jpe?g|webp|gif|bmp|tiff?|svg)$/i.test(a.name)).slice(0,2);
            r.previewFileId=r.previewAssets[0]?.id||r.driveFileId||'';
            r.previewFileName=r.previewAssets[0]?.name||r.sourceFileName||'';
            r.drivePresent=true;
            r.lastDriveSync=new Date().toISOString();
            changed=true;
          }
        }
      }
      if(changed){localStorage.setItem(STORE,JSON.stringify(records));window.dispatchEvent(new Event('gp-drive-links-repaired'))}
    }finally{running=false}
  }
  function schedule(){setTimeout(repair,650);setTimeout(repair,1800)}
  window.addEventListener('gp-drive-connected',schedule);
  window.addEventListener('load',()=>setTimeout(repair,1200));
})();
