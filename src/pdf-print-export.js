(function(){
  if(window.__GP_PDF_PRINT_EXPORT_V4__) return;
  window.__GP_PDF_PRINT_EXPORT_V4__=true;

  const esc=v=>String(v??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#039;'}[c]));

  function sourceRows(){
    const table=[...document.querySelectorAll('.table-card .table')].find(t=>t.querySelector('tbody tr:not(.empty)'))||document.querySelector('.table-card .table');
    if(!table)return[];
    return[...table.querySelectorAll('tbody tr')].filter(r=>!r.classList.contains('empty')&&!r.querySelector('.empty')).map(tr=>{
      const cells=[...tr.children];
      const text=i=>cells[i]?.innerText?.replace(/\s+/g,' ').trim()||'';
      const workCell=cells[7];
      const jobs=[...workCell?.querySelectorAll('.pill')||[]].map(x=>x.textContent.trim()).filter(Boolean);
      const other=workCell?.querySelector('small')?.textContent?.trim()||'';
      const imageNodes=[...cells[0]?.querySelectorAll('img')||[]].map(img=>({src:img.currentSrc||img.src||'',alt:img.alt||''})).filter(x=>x.src);
      const drive=cells[9]?.querySelector('a')?.href||'';
      return{images:imageNodes,customer:text(1),product:text(2),size:text(3),volume:text(4),qty:text(5),designer:text(6),jobs,other,date:text(8),drive};
    });
  }

  function workText(r){
    const parts=[...r.jobs];
    if(r.other)parts.push(`Khác: ${r.other}`);
    return parts.length?parts.join(' · '):'—';
  }

  function imageHtml(r){
    if(!r.images.length)return '<span class="muted">—</span>';
    return `<div class="images">${r.images.slice(0,2).map(im=>`<img src="${esc(im.src)}" alt="${esc(im.alt)}">`).join('')}</div>`;
  }

  function openPrint(){
    const rows=sourceRows();
    if(!rows.length){window.alert('Không có dữ liệu để in A4.');return true;}
    const now=new Date(), issued=now.toLocaleDateString('vi-VN');
    const totalQty=rows.reduce((s,r)=>s+Number(r.qty||0),0);
    const body=rows.map((r,i)=>`<tr>
      <td class="stt">${i+1}</td>
      <td class="pic">${imageHtml(r)}</td>
      <td>${esc(r.customer)}</td>
      <td><strong>${esc(r.product)}</strong></td>
      <td>${esc(r.size||'—')}</td>
      <td>${esc(r.volume||'—')}</td>
      <td class="qty">${esc(r.qty||'0')}</td>
      <td>${esc(r.designer||'—')}</td>
      <td class="work">${esc(workText(r))}</td>
      <td>${esc(r.date||'—')}</td>
      <td class="drive"><span>${esc(r.drive||'—')}</span></td>
    </tr>`).join('');

    const w=window.open('','_blank','width=1440,height=950');
    if(!w){window.alert('Trình duyệt đang chặn cửa sổ in. Hãy cho phép cửa sổ bật lên cho GP Statistical.');return true;}

    const html=`<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>GP Statistical — Bảng kê sản phẩm</title><style>
      @page{size:A4 landscape;margin:10mm 9mm 13mm}
      *{box-sizing:border-box}
      html,body{margin:0;padding:0;background:#fff;color:#111;font-family:Arial,Helvetica,sans-serif;font-size:8.2pt;line-height:1.3}
      .head{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:2px solid #111;padding-bottom:7px;margin-bottom:8px}
      .brand{font-size:11pt;font-weight:700;letter-spacing:2px}.title{font-size:16pt;font-weight:700;margin-top:2px}.meta{text-align:right;font-size:8pt;line-height:1.45}
      table{width:100%;border-collapse:collapse;table-layout:fixed}thead{display:table-header-group}tr{page-break-inside:avoid;break-inside:avoid}
      th,td{border:1px solid #666;padding:4px 5px;vertical-align:middle;word-break:break-word}th{background:#ececec;text-align:center;font-weight:700}
      .stt{width:4%;text-align:center}.pic{width:12%;text-align:center}.qty{width:5%;text-align:center}.work{width:14%}.drive{width:22%;font-size:7pt;overflow-wrap:anywhere}.drive span{word-break:break-all}
      th:nth-child(3){width:9%}th:nth-child(4){width:17%}th:nth-child(5){width:8%}th:nth-child(6){width:8%}th:nth-child(8){width:9%}th:nth-child(10){width:8%}
      .images{display:flex;gap:3px;justify-content:center;align-items:center;min-height:25mm}.images img{width:25mm;height:25mm;object-fit:contain;display:block}
      .muted{color:#777}.work{white-space:normal}.signature{margin:15px 0 0 auto;width:240px;text-align:center;page-break-inside:avoid}.signature .date{margin-bottom:34px}.signature .line{border-top:1px solid #111;padding-top:5px;font-weight:700}.signature .note{font-size:7.4pt;color:#555;margin-top:2px}
      .footer{margin-top:7px;display:flex;justify-content:space-between;font-size:7.4pt;color:#555}
      @media print{.no-print{display:none!important}}
    </style></head><body>
      <div class="head"><div><div class="brand">GP STATISTICAL</div><div class="title">Bảng kê sản phẩm</div></div><div class="meta">Ngày xuất: ${esc(issued)}<br>Tổng sản phẩm: ${rows.length}<br>Tổng số lượng: ${totalQty}</div></div>
      <table><thead><tr><th>STT</th><th>Hình ảnh</th><th>Khách hàng</th><th>Sản phẩm</th><th>Kích thước</th><th>Thể tích</th><th>SL</th><th>Người thực hiện</th><th>Công việc</th><th>Ngày</th><th>Liên kết Drive</th></tr></thead><tbody>${body}</tbody></table>
      <section class="signature"><div class="date">Ngày ${String(now.getDate()).padStart(2,'0')} tháng ${String(now.getMonth()+1).padStart(2,'0')} năm ${now.getFullYear()}</div><div class="line">Người lập bảng</div><div class="note">Ký và ghi rõ họ tên</div></section>
      <div class="footer"><span>GP Statistical — Design &amp; Product Tracker</span><span>Tài liệu A4</span></div>
      <script>window.addEventListener('load',async()=>{const imgs=[...document.images];await Promise.race([Promise.all(imgs.map(img=>img.complete?Promise.resolve():new Promise(r=>{img.addEventListener('load',r,{once:true});img.addEventListener('error',r,{once:true})}))),new Promise(r=>setTimeout(r,5000))]);window.focus();setTimeout(()=>window.print(),150)});<\/script>
    </body></html>`;
    w.document.open();w.document.write(html);w.document.close();
    return true;
  }

  function intercept(e){
    const b=e.target.closest?.('[data-export="pdf"],[data-public-export="pdf"]');
    if(!b)return;
    e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
    openPrint();
  }
  window.addEventListener('click',intercept,true);
})();
