/* GP Statistical — runtime UX/session layer. */
(function(){
  const TOKEN_KEY='gp-statistical-session-token';
  const SESSION_KEY='gp-statistical-session-active';
  const STYLE_ID='gp-runtime-fix-style';
  const read=(k,d)=>{try{return JSON.parse(localStorage.getItem(k)||JSON.stringify(d))}catch{return d}};
  const write=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch{}};
  const clearSession=()=>{
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(SESSION_KEY);
    window.__gpDriveToken='';
    window.__gpDriveAuthenticatedAt=0;
    window.dispatchEvent(new Event('gp-drive-logout'));
  };
  const saveToken=t=>{
    if(!t)return;
    write(TOKEN_KEY,{token:t,savedAt:Date.now()});
    localStorage.setItem(SESSION_KEY,'1');
  };

  function restore(){
    const saved=read(TOKEN_KEY,null);
    if(saved?.token && localStorage.getItem(SESSION_KEY)==='1'){
      window.__gpDriveToken=saved.token;
      window.__gpDriveAuthenticatedAt=saved.savedAt||Date.now();
      window.dispatchEvent(new Event('gp-drive-connected'));
    }
  }

  function injectStyle(){
    if(document.getElementById(STYLE_ID))return;
    const s=document.createElement('style');s.id=STYLE_ID;s.textContent=`
      /* Brand: one compact logo line, never GP / STATISTICAL stacked. */
      .sidebar .brand{font-size:0!important;letter-spacing:0!important;padding-bottom:32px!important}
      .sidebar .brand::before{content:'GP STATISTICAL'!important;display:block!important;margin:0 0 8px!important;font-size:22px!important;line-height:1!important;letter-spacing:-.045em!important;font-weight:900!important;color:#fff!important;text-transform:none!important}
      .sidebar .brand span{display:none!important}
      .sidebar .brand small{font-size:9px!important;letter-spacing:.04em!important}

      /* Lock screen: title, button and note are independent blocks. */
      .gate .brand-mark{display:none!important}
      .gate-card{width:min(860px,100%)!important}
      .gate-card h1{margin-bottom:18px!important}
      .gate-card .btn,.gate-card button{display:flex!important;width:max-content!important;max-width:100%!important;margin:0!important}
      .gate-card small{display:block!important;max-width:720px!important;margin:16px 0 0!important;line-height:1.65!important;white-space:normal!important;overflow-wrap:break-word!important;color:#7d8490!important}

      /* Shared page: same visual system as the private app, not the old purple UI. */
      .public-view{min-height:100vh!important;background:#f4f1ea!important;color:#142033!important;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif!important}
      .public-shell{max-width:1800px!important;margin:0 auto!important;padding:42px 46px 70px!important}
      .public-top{padding:0 0 24px!important;margin-bottom:20px!important;border-bottom:1px solid #ddd8cd!important;align-items:flex-end!important}
      .public-brand{font-size:11px!important;letter-spacing:.18em!important;color:#ef6b3b!important;font-weight:900!important}
      .public-title{font-size:clamp(32px,4vw,48px)!important;letter-spacing:-.055em!important;color:#142033!important;margin:7px 0!important}
      .public-sub{font-size:12px!important;color:#6f7784!important}
      .public-actions{gap:8px!important}.public-btn{border:1px solid #ddd8cd!important;border-radius:12px!important;background:#fffdf8!important;color:#142033!important;padding:10px 14px!important;font-size:12px!important;box-shadow:0 3px 12px rgba(20,32,51,.04)!important}
      .public-grid{grid-template-columns:1.35fr 1fr 1fr 1fr!important;gap:13px!important;margin-bottom:17px!important}
      .public-card{background:#fffdf8!important;border:1px solid #ddd8cd!important;border-radius:22px!important;padding:21px!important;box-shadow:0 8px 30px rgba(20,32,51,.045)!important}
      .public-stat span{color:#6f7784!important;font-size:10px!important;font-weight:800!important;letter-spacing:.08em!important;text-transform:uppercase!important}
      .public-stat b{font-size:42px!important;line-height:1!important;letter-spacing:-.07em!important;color:#142033!important}
      .public-grid .public-card:first-child{background:#142033!important;border-color:#142033!important}.public-grid .public-card:first-child span,.public-grid .public-card:first-child b{color:#fff!important}
      .public-filters{gap:8px!important;margin:17px 0!important}.public-input{height:42px!important;border:1px solid #ddd8cd!important;border-radius:12px!important;background:#fffdf8!important;color:#142033!important;font-size:12px!important}.public-input:focus{outline:none;border-color:#ef6b3b!important;box-shadow:0 0 0 4px rgba(239,107,59,.1)!important}
      .public-table-wrap{border:1px solid #ddd8cd!important;border-radius:18px!important;background:#fffdf8!important;box-shadow:0 8px 30px rgba(20,32,51,.045)!important}
      .public-table{min-width:1100px!important}.public-table th{background:#f4f0e8!important;color:#727b88!important;font-size:9px!important;font-weight:900!important;letter-spacing:.08em!important}.public-table td{border-bottom:1px solid #ebe7de!important;font-size:11px!important}.public-table tr:hover td{background:#fffcf6!important}.public-product{font-size:12px!important}.public-drive{color:#c5522d!important;font-size:11px!important}
      .public-badge{padding:4px 8px!important;background:#f7e4da!important;color:#a94325!important;font-size:9px!important}
      .public-thumb{width:52px!important;height:52px!important;border-radius:11px!important;border:1px solid #ddd8cd!important;background:#f2eee6!important}.public-note{color:#6f7784!important;font-size:10px!important}
      @media(max-width:900px){.public-shell{padding:24px 20px 50px!important}.public-grid{grid-template-columns:1fr 1fr!important}.public-top{flex-direction:column!important;align-items:flex-start!important}}
      @media(max-width:520px){.public-shell{padding:18px 14px 40px!important}.public-grid{grid-template-columns:1fr!important}.public-title{font-size:34px!important}}

      /* Explicit logout control. */
      .gp-logout{width:100%;margin-top:8px;padding:9px 11px;border:1px solid rgba(255,255,255,.12);border-radius:10px;background:rgba(255,255,255,.05);color:#fff;font:700 10px Inter,sans-serif;cursor:pointer}
      .gp-logout:hover{background:rgba(239,107,59,.16);border-color:rgba(239,107,59,.3)}
    `;document.head.appendChild(s);
  }

  function ensureLogout(){
    const box=document.querySelector('.side-bottom .connection');
    if(!box || document.querySelector('.gp-logout'))return;
    if(localStorage.getItem(SESSION_KEY)!=='1')return;
    const b=document.createElement('button');b.className='gp-logout';b.textContent='Đăng xuất Google Drive';
    b.onclick=()=>{clearSession();location.reload()};box.appendChild(b);
  }

  function patchLinks(){
    document.querySelectorAll('.table a.link,.public-table a.public-drive').forEach(a=>{
      const row=a.closest('tr');if(!row)return;
      /* Runtime repair only changes links when the record already carries a variant id in the share snapshot. */
      const id=a.dataset.variantId||a.getAttribute('data-variant-id');
      if(id)a.href=`https://drive.google.com/drive/folders/${encodeURIComponent(id)}`;
    });
  }

  function patchGIS(){
    const oauth=window.google?.accounts?.oauth2;
    if(!oauth?.initTokenClient || oauth.__gpWrapped)return false;
    const original=oauth.initTokenClient;
    oauth.initTokenClient=function(options){
      const originalCb=options?.callback;
      const next={...options,callback:response=>{
        if(response?.access_token)saveToken(response.access_token);
        if(originalCb)originalCb(response);
      }};
      return original.call(this,next);
    };
    oauth.__gpWrapped=true;
    return true;
  }

  window.addEventListener('gp-drive-connected',()=>{
    if(window.__gpDriveToken)saveToken(window.__gpDriveToken);
    setTimeout(ensureLogout,30);
  });
  window.addEventListener('gp-drive-logout',()=>{localStorage.removeItem(TOKEN_KEY);localStorage.removeItem(SESSION_KEY)});
  document.addEventListener('click',e=>{if(e.target?.id==='disconnect')clearSession()},{capture:true});

  injectStyle();
  restore();
  patchGIS();
  let n=0;const timer=setInterval(()=>{n++;patchGIS();if(window.__gpDriveToken)saveToken(window.__gpDriveToken);ensureLogout();patchLinks();if(n>60)clearInterval(timer)},250);
  window.addEventListener('load',()=>{injectStyle();restore();ensureLogout();patchLinks()});
})();
