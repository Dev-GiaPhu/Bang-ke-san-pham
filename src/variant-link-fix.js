/* GP Statistical — force Drive links to the recorded variant folder. */
(function(){
  const STORE='ventek-design-tracker-v2';
  const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
  const b64ToBytes=b64=>{b64=b64.replace(/-/g,'+').replace(/_/g,'/');while(b64.length%4)b64+='=';const bin=atob(b64);return Uint8Array.from(bin,c=>c.charCodeAt(0))};
  const b64ToText=b64=>new TextDecoder().decode(b64ToBytes(b64));
  const volume=s=>{const m=String(s||'').match(/((?:\d+(?:[.,]\d+)?)\s?(?:ml|cl|l|lit|liter|litre))/i);return m?m[1].replace(/\s+/g,'').replace(/lit(?:er|re)?$/i,'L').replace(/l$/i,'L'):''};
  const size=s=>{const m=String(s||'').match(/\b(\d{2,5}\s*[x×]\s*\d{2,5}|A[0-6])\b/i);return m?m[1].replace(/\s+/g,'').replace('×','x').toUpperCase():''};
  async function decodeShare(){
    const m=location.hash.match(/^#share=(.+)$/);if(!m)return null;
    let payload=decodeURIComponent(m[1]);
    if(!payload.includes('.'))return null;
    const [mode,data]=payload.split('.',2);
    if(mode==='p')return JSON.parse(b64ToText(data));
    if(mode!=='g'||!('DecompressionStream'in window))return null;
    const ds=new DecompressionStream('gzip'),w=ds.writable.getWriter();w.write(b64ToBytes(data));w.close();
    return JSON.parse(await new Response(ds.readable).text());
  }
  function recordKey(r){return `${norm(r.productName)}|${volume(r.volume)}|${size(r.size)}`}
  function patchMain(){
    let records=[];try{records=JSON.parse(localStorage.getItem(STORE)||'[]')}catch{return}
    document.querySelectorAll('.table tbody tr').forEach(row=>{
      const c=row.querySelectorAll('td');if(c.length<11)return;
      const product=norm(c[2]?.querySelector('strong')?.textContent||c[2]?.textContent);
      const sz=size(c[3]?.textContent);const vol=volume(c[4]?.textContent);
      const r=records.find(x=>recordKey(x)===`${product}|${vol}|${sz}` && x.driveVariantFolderId);
      if(r){const a=row.querySelector('a.link');if(a)a.href=`https://drive.google.com/drive/folders/${encodeURIComponent(r.driveVariantFolderId)}`}
    });
  }
  async function patchShare(){
    const payload=await decodeShare().catch(()=>null);if(!payload?.records)return;
    const map=new Map(payload.records.filter(r=>r.driveVariantFolderId).map(r=>[recordKey(r),r.driveVariantFolderId]));
    document.querySelectorAll('.public-table tbody tr').forEach(row=>{
      const c=row.querySelectorAll('td');if(c.length<9)return;
      const product=norm(c[2]?.textContent),vol=volume(c[3]?.textContent),sz=size(c[4]?.textContent);
      const id=map.get(`${product}|${vol}|${sz}`);if(id){const a=row.querySelector('a.public-drive');if(a)a.href=`https://drive.google.com/drive/folders/${encodeURIComponent(id)}`}
    });
  }
  let n=0;const timer=setInterval(()=>{n++;patchMain();patchShare();if(n>40)clearInterval(timer)},250);
  window.addEventListener('load',()=>{patchMain();patchShare()});
})();
