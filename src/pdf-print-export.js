(function(){
  if(window.__GP_PDF_PRINT_EXPORT_V1__) return;
  window.__GP_PDF_PRINT_EXPORT_V1__=true;

  function esc(v){
    return String(v??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#039;'}[c]));
  }

  function getRows(){
    const table=[...document.querySelectorAll('.table-card .table')].find(t=>t.querySelector('tbody tr:not(:has(.empty))')) || document.querySelector('.table-card .table');
    if(!table) return [];
    return [...table.querySelectorAll('tbody tr')].filter(r=>!r.querySelector('.empty')).map(tr=>{
      const cells=[...tr.children];
      const text=i=>cells[i]?.innerText?.replace(/\s+/g,' ').trim()||'';
      const jobs=[...cells[7]?.querySelectorAll('.pill')||[]].map(x=>x.innerText.trim()).filter(Boolean);
      const other=cells[7]?.querySelector('small')?.innerText?.trim()||'';
      const drive=cells[9]?.querySelector('a')?.href||'';
      return {
        customer:text(1),
        product:text(2),
        size:text(3),
        volume:text(4),
        qty:text(5),
        designer:text(6),
        jobs,
        other,
        date:text(8),
        drive
      };
    });
  }

  function printPdf(){
    const rows=getRows();
    if(!rows.length){
      window.alert('Không có dữ liệu để xuất PDF / A4.');
      return;
    }

    const title='GP Statistical — Bảng kê sản phẩm';
    const issued=new Date().toLocaleDateString('vi-VN');
    const body=rows.map((r,i)=>{
      const jobs=r.jobs.length?r.jobs.map(esc).join(' <span class="dot">•</span> '):'';
      const work=[jobs,r.other?esc(r.other):''].filter(Boolean).join('<br>');
      return `<tr>
        <td class="stt">${i+1}</td>
        <td>${esc(r.customer)}</td>
        <td><strong>${esc(r.product)}</strong></td>
        <td>${esc(r.size||'—')}</td>
        <td>${esc(r.volume||'—')}</td>
        <td class="qty">${esc(r.qty||'0')}</td>
        <td>${esc(r.designer||'—')}</td>
        <td>${work||'—'}</td>
        <td>${esc(r.date||'—')}</td>
        <td class="drive">${r.drive?`<a href="${esc(r.drive)}">${esc(r.drive)}</a>`:'—'}</td>
      </tr>`;
    }).join('');

    const w=window.open('', '_blank', 'noopener,noreferrer,width=1400,height=900');
    if(!w){
      window.alert('Trình duyệt đang chặn cửa sổ in. Hãy cho phép cửa sổ bật lên cho GP Statistical rồi thử lại.');
      return;
    }

    w.document.open();
    w.document.write(`<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>${esc(title)}</title><style>
      @page{size:A4 landscape;margin:12mm 10mm}
      *{box-sizing:border-box}
      body{margin:0;color:#111;font-family:Arial,Helvetica,sans-serif;font-size:9pt;line-height:1.35;background:#fff}
      .head{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:2px solid #111;padding-bottom:8px;margin-bottom:10px}
      .brand{font-size:12pt;font-weight:700;letter-spacing:2px}
      .title{font-size:18pt;font-weight:700;margin-top:3px}
      .meta{font-size:8.5pt;text-align:right}
      table{width:100%;border-collapse:collapse;table-layout:fixed}
      th,td{border:1px solid #777;padding:5px 6px;vertical-align:top;word-break:break-word}
      th{background:#f0f0f0;text-align:center;font-weight:700}
      .stt{width:4%;text-align:center}.qty{width:5%;text-align:center}.drive{width:25%;font-size:7.5pt;overflow-wrap:anywhere}.dot{padding:0 4px;color:#555}
      th:nth-child(2){width:10%} th:nth-child(3){width:18%} th:nth-child(4){width:8%} th:nth-child(5){width:8%} th:nth-child(7){width:10%} th:nth-child(8){width:15%} th:nth-child(9){width:9%}
      a{color:#111;text-decoration:none;word-break:break-all}
      .foot{margin-top:8px;display:flex;justify-content:space-between;font-size:8pt;color:#555}
    </style></head><body>
      <div class="head"><div><div class="brand">GP STATISTICAL</div><div class="title">${esc(title)}</div></div><div class="meta">Ngày xuất: ${esc(issued)}<br>Tổng sản phẩm: ${rows.length}</div></div>
      <table><thead><tr><th>STT</th><th>Khách hàng</th><th>Sản phẩm</th><th>Kích thước</th><th>Thể tích</th><th>SL</th><th>Người thực hiện</th><th>Công việc</th><th>Ngày</th><th>Liên kết Drive</th></tr></thead><tbody>${body}</tbody></table>
      <div class="foot"><span>GP Statistical — Design & Product Tracker</span><span>Trang in A4</span></div>
    </body></html>`);
    w.document.close();
    w.focus();
    setTimeout(()=>w.print(),450);
  }

  document.addEventListener('click',function(e){
    const b=e.target.closest('[data-export="pdf"],[data-public-export="pdf"]');
    if(!b) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    printPdf();
  },true);
})();
