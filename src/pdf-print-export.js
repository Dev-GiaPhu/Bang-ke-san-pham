(function(){
  if(window.__GP_PDF_PRINT_EXPORT_V2__) return;
  window.__GP_PDF_PRINT_EXPORT_V2__=true;

  function esc(v){
    return String(v??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#039;'}[c]));
  }

  function driveImage(id){
    return id?`https://drive.google.com/thumbnail?id=${encodeURIComponent(id)}&sz=w500`:'';
  }

  function getRows(){
    const table=[...document.querySelectorAll('.table-card .table')].find(t=>t.querySelector('tbody tr:not(:has(.empty))')) || document.querySelector('.table-card .table');
    if(!table) return [];
    return [...table.querySelectorAll('tbody tr')].filter(r=>!r.querySelector('.empty')).map(tr=>{
      const cells=[...tr.children];
      const text=i=>cells[i]?.innerText?.replace(/\s+/g,' ').trim()||'';
      const jobs=[...cells[7]?.querySelectorAll('.pill')||[]].map(x=>x.innerText.trim()).filter(Boolean);
      const other=cells[7]?.querySelector('small')?.innerText?.trim()||'';
      const driveAnchor=cells[9]?.querySelector('a');
      const images=[...cells[0]?.querySelectorAll('[data-image-id]')||[]].map(x=>({
        id:x.dataset.imageId||'',
        name:x.dataset.imageName||''
      })).filter(x=>x.id);
      return {
        images,
        customer:text(1),
        product:text(2),
        size:text(3),
        volume:text(4),
        qty:text(5),
        designer:text(6),
        jobs,
        other,
        date:text(8),
        drive:driveAnchor?.href||''
      };
    });
  }

  function buildWork(r){
    const tags=r.jobs.map(x=>`<span class="job-tag">${esc(x)}</span>`).join('<span class="job-separator">, </span>');
    const other=r.other?`<span class="job-other">${esc(r.other)}</span>`:'';
    if(tags&&other) return `${tags}<span class="job-separator">, </span>${other}`;
    return tags||other||'—';
  }

  function buildImages(r){
    if(!r.images.length) return '<span class="no-image">—</span>';
    return `<div class="print-images">${r.images.slice(0,2).map(im=>`<img src="${esc(driveImage(im.id))}" alt="${esc(im.name)}" loading="eager">`).join('')}</div>`;
  }

  function printPdf(){
    const rows=getRows();
    if(!rows.length){
      window.alert('Không có dữ liệu để in A4.');
      return;
    }

    const title='GP Statistical — Bảng kê sản phẩm';
    const issued=new Date().toLocaleDateString('vi-VN');
    const body=rows.map((r,i)=>`<tr>
      <td class="stt">${i+1}</td>
      <td>${buildImages(r)}</td>
      <td>${esc(r.customer)}</td>
      <td><strong>${esc(r.product)}</strong></td>
      <td>${esc(r.size||'—')}</td>
      <td>${esc(r.volume||'—')}</td>
      <td class="qty">${esc(r.qty||'0')}</td>
      <td>${esc(r.designer||'—')}</td>
      <td class="work">${buildWork(r)}</td>
      <td>${esc(r.date||'—')}</td>
      <td class="drive"><a href="${esc(r.drive)}">${esc(r.drive||'—')}</a></td>
    </tr>`).join('');

    const w=window.open('', '_blank', 'noopener,noreferrer,width=1400,height=900');
    if(!w){
      window.alert('Trình duyệt đang chặn cửa sổ in. Hãy cho phép cửa sổ bật lên cho GP Statistical rồi thử lại.');
      return;
    }

    const html=`<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>${esc(title)}</title><style>
      @page{size:A4 landscape;margin:10mm 9mm 12mm}
      *{box-sizing:border-box}
      html,body{margin:0;padding:0;background:#fff;color:#111;font-family:Arial,Helvetica,sans-serif;font-size:8.5pt;line-height:1.35}
      body{padding-bottom:4mm}
      .head{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:2px solid #111;padding-bottom:7px;margin-bottom:9px}
      .brand{font-size:11pt;font-weight:700;letter-spacing:2px}
      .title{font-size:17pt;font-weight:700;margin-top:2px}
      .meta{font-size:8pt;text-align:right;line-height:1.45}
      table{width:100%;border-collapse:collapse;table-layout:fixed}
      thead{display:table-header-group}
      tr{page-break-inside:avoid;break-inside:avoid}
      th,td{border:1px solid #777;padding:4px 5px;vertical-align:top;word-break:break-word}
      th{background:#f0f0f0;text-align:center;font-weight:700}
      .stt{width:4%;text-align:center}.image-col{width:11%}.qty{width:5%;text-align:center}.drive{width:22%;font-size:7.3pt;overflow-wrap:anywhere}.work{width:14%}
      th:nth-child(3){width:10%} th:nth-child(4){width:17%} th:nth-child(5){width:8%} th:nth-child(6){width:8%} th:nth-child(8){width:10%} th:nth-child(10){width:8%}
      .print-images{display:flex;gap:4px;align-items:flex-start;justify-content:center;min-height:24mm}
      .print-images img{width:27mm;height:27mm;object-fit:contain;border:0;display:block}
      .no-image{display:block;text-align:center;color:#777;padding-top:8mm}
      .job-tag{display:inline}.job-separator{color:#444}.job-other{display:inline}
      a{color:#111;text-decoration:none;word-break:break-all}
      .signature-block{margin-top:16px;margin-left:auto;width:260px;text-align:center;break-inside:avoid;page-break-inside:avoid}
      .signature-date{margin-bottom:38px}
      .signature-line{border-top:1px solid #111;padding-top:5px;font-weight:700}
      .signature-note{font-size:7.5pt;margin-top:2px;color:#555}
      .foot{margin-top:8px;display:flex;justify-content:space-between;font-size:7.5pt;color:#555}
      @media print{.no-print{display:none!important}}
    </style></head><body>
      <div class="head"><div><div class="brand">GP STATISTICAL</div><div class="title">Bảng kê sản phẩm</div></div><div class="meta">Ngày xuất: ${esc(issued)}<br>Tổng sản phẩm: ${rows.length}</div></div>
      <table><thead><tr><th>STT</th><th>Hình ảnh</th><th>Khách hàng</th><th>Sản phẩm</th><th>Kích thước</th><th>Thể tích</th><th>SL</th><th>Người thực hiện</th><th>Công việc</th><th>Ngày</th><th>Liên kết Drive</th></tr></thead><tbody>${body}</tbody></table>
      <section class="signature-block"><div class="signature-date">Ngày ${String(new Date().getDate()).padStart(2,'0')} tháng ${String(new Date().getMonth()+1).padStart(2,'0')} năm ${new Date().getFullYear()}</div><div class="signature-line">Người lập bảng</div><div class="signature-note">Ký và ghi rõ họ tên</div></section>
      <div class="foot"><span>GP Statistical — Design & Product Tracker</span><span>Tài liệu in A4</span></div>
      <script>window.addEventListener('load',async()=>{try{await document.fonts?.ready;}catch(e){}const imgs=[...document.images];await Promise.race([Promise.all(imgs.map(img=>img.complete?Promise.resolve():new Promise(r=>{img.addEventListener('load',r,{once:true});img.addEventListener('error',r,{once:true})}))),new Promise(r=>setTimeout(r,3000))]);window.focus();window.print();});<\\/script>
    </body></html>`;

    w.document.open();
    w.document.write(html);
    w.document.close();
  }

  document.addEventListener('click',function(e){
    const b=e.target.closest('[data-export="pdf"],[data-public-export="pdf"]');
    if(!b) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    printPdf();
  },true);
})();
