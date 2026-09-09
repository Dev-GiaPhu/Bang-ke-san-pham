(function(){
  if(window.__GP_PDF_PRINT_EXPORT_V6__) return;
  window.__GP_PDF_PRINT_EXPORT_V6__=true;

  const clean=s=>String(s??'').replace(/\s+/g,' ').trim();
  const esc=v=>String(v??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#039;'}[c]));
  const norm=v=>clean(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();

  function getTable(){
    return [...document.querySelectorAll('.table-card .table')].find(t=>!t.closest('#__gp_print_host') && t.tHead && t.tBodies[0]);
  }

  function checkedRowIds(){
    const table=getTable();
    if(!table) return [];
    return [...table.tBodies[0].rows]
      .filter(tr=>!tr.classList.contains('empty'))
      .filter(tr=>[...tr.querySelectorAll('input[type="checkbox"]')].some(c=>c.checked))
      .map(tr=>{
        const el=tr.querySelector('[data-id],[data-product-id],[data-select-id],[data-row-id]');
        return el?.dataset?.id || el?.dataset?.productId || el?.dataset?.selectId || el?.dataset?.rowId || '';
      }).filter(Boolean);
  }

  function hasSelectionCheckboxes(table){
    return !!table?.querySelector('tbody input[type="checkbox"]');
  }

  function selectedRowsOnly(rows){
    const table=getTable();
    if(!hasSelectionCheckboxes(table)) return rows;
    const trs=[...table.tBodies[0].rows].filter(tr=>!tr.classList.contains('empty'));
    const checked=trs.filter(tr=>tr.querySelector('input[type="checkbox"]:checked'));
    if(!checked.length) return [];
    const indexes=new Set(checked.map(tr=>trs.indexOf(tr)));
    return rows.filter((_,i)=>indexes.has(i));
  }

  function getRows(){
    const table=getTable();
    if(!table) return [];
    const headers=[...table.tHead.querySelectorAll('th')].map(th=>norm(th.textContent));
    const aliases={
      image:['hinh','hinh anh'],customer:['khach hang'],product:['san pham'],size:['kich thuoc'],
      volume:['the tich'],qty:['sl','so luong'],designer:['designer','nguoi thuc hien'],
      work:['cong viec','loai cong viec'],date:['ngay'],drive:['drive','lien ket drive']
    };
    const idx={};
    for(const [key,names] of Object.entries(aliases)) idx[key]=headers.findIndex(h=>names.includes(h));

    const rows=[...table.tBodies[0].rows].filter(tr=>!tr.classList.contains('empty')&&!tr.querySelector('.empty')).map(tr=>{
      const cells=[...tr.cells], cell=k=>idx[k]>=0?cells[idx[k]]:null, text=k=>clean(cell(k)?.innerText||'');
      const imageCell=cell('image');
      const images=[...imageCell?.querySelectorAll('img')||[]].map(img=>({src:img.currentSrc||img.src||'',alt:img.alt||''})).filter(x=>x.src).slice(0,2);
      const driveCell=cell('drive');
      const anchor=driveCell?.querySelector('a[href]');
      const drive=anchor?.href||clean(driveCell?.innerText||'').match(/https?:\/\/\S+/)?.[0]||'';
      const qtyRaw=text('qty');
      const qtyNumber=Number(qtyRaw.replace(/\./g,'').replace(',','.').replace(/[^0-9.-]/g,''))||0;
      const productStrong=cell('product')?.querySelector('strong');
      const product=clean(productStrong?.textContent||text('product'));
      return {images,customer:text('customer'),product,size:text('size'),volume:text('volume'),qtyRaw:qtyRaw||'0',qtyNumber,designer:text('designer'),work:text('work'),date:text('date'),drive};
    });
    return selectedRowsOnly(rows);
  }

  function workHtml(value){
    return clean(value).split(/\s*,\s*|\s*·\s*|\s*•\s*|\s+(?=(?:Design|Sửa|Update|Khác)\b)/i).map(clean).filter(Boolean).filter((v,i,a)=>a.indexOf(v)===i).map(v=>`<span class="job">${esc(v)}</span>`).join('<span class="sep"> · </span>')||'—';
  }

  function buildSheet(rows){
    const now=new Date(), issued=now.toLocaleDateString('vi-VN'), totalQty=rows.reduce((s,r)=>s+r.qtyNumber,0);
    const body=rows.map((r,i)=>`<tr>
      <td class="stt">${i+1}</td>
      <td class="pic">${r.images.length?`<div class="images">${r.images.map(im=>`<img src="${esc(im.src)}" alt="${esc(im.alt)}">`).join('')}</div>`:'—'}</td>
      <td>${esc(r.customer||'—')}</td>
      <td><strong>${esc(r.product||'—')}</strong></td>
      <td>${esc(r.size||'—')}</td>
      <td>${esc(r.volume||'—')}</td>
      <td class="qty">${esc(r.qtyRaw||'0')}</td>
      <td>${esc(r.designer||'—')}</td>
      <td class="work">${workHtml(r.work)}</td>
      <td>${esc(r.date||'—')}</td>
      <td class="drive">${r.drive?esc(r.drive):'—'}</td>
    </tr>`).join('');
    return `<div id="__gp_print_sheet">
      <header class="print-head"><div><div class="brand">GP STATISTICAL</div><div class="title">Bảng kê sản phẩm</div></div><div class="meta">Ngày xuất: ${esc(issued)}<br>Tổng sản phẩm: ${rows.length}<br>Tổng số lượng: ${totalQty}</div></header>
      <table class="print-table"><thead><tr><th>STT</th><th>Hình ảnh</th><th>Khách hàng</th><th>Sản phẩm</th><th>Kích thước</th><th>Thể tích</th><th>SL</th><th>Người thực hiện</th><th>Công việc</th><th>Ngày</th><th>Liên kết Drive</th></tr></thead><tbody>${body}</tbody></table>
      <section class="signature"><div class="signature-date">Ngày ${String(now.getDate()).padStart(2,'0')} tháng ${String(now.getMonth()+1).padStart(2,'0')} năm ${now.getFullYear()}</div><div class="signature-line">Người lập bảng</div><div class="signature-note">Ký và ghi rõ họ tên</div></section>
    </div>`;
  }

  async function waitImages(host){
    const imgs=[...host.querySelectorAll('img')];
    if(!imgs.length)return;
    await Promise.race([Promise.all(imgs.map(img=>img.complete?Promise.resolve():new Promise(resolve=>{img.addEventListener('load',resolve,{once:true});img.addEventListener('error',resolve,{once:true})}))),new Promise(resolve=>setTimeout(resolve,5000))]);
  }

  async function printA4(){
    const rows=getRows();
    if(!rows.length){window.alert(hasSelectionCheckboxes(getTable())?'Hãy chọn ít nhất một sản phẩm để xuất PDF / A4.':'Không có dữ liệu để in A4.');return;}
    document.getElementById('__gp_print_host')?.remove();
    document.getElementById('__gp_print_style')?.remove();
    const host=document.createElement('div');host.id='__gp_print_host';host.innerHTML=buildSheet(rows);document.body.appendChild(host);
    const style=document.createElement('style');style.id='__gp_print_style';style.textContent=`
      #__gp_print_host{display:none}
      @media print{
        @page{size:A4 landscape;margin:9mm}
        html,body{margin:0!important;padding:0!important;background:#fff!important}
        body>*:not(#__gp_print_host){display:none!important}
        #__gp_print_host{display:block!important;color:#111;font-family:Arial,Helvetica,sans-serif;font-size:8.5pt;line-height:1.35}
        .print-head{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:2px solid #111;padding-bottom:7px;margin-bottom:9px}
        .brand{font-size:11pt;font-weight:700;letter-spacing:2px}.title{font-size:17pt;font-weight:700;margin-top:2px}.meta{text-align:right;font-size:8pt;line-height:1.45}
        .print-table{width:100%;border-collapse:collapse;table-layout:fixed}.print-table thead{display:table-header-group}.print-table tr{page-break-inside:avoid;break-inside:avoid}
        .print-table th,.print-table td{border:1px solid #777;padding:4px 5px;vertical-align:middle;word-break:break-word}.print-table th{background:#f0f0f0;text-align:center;font-weight:700}
        .print-table th:nth-child(1),.print-table td:nth-child(1){width:4%;text-align:center}.print-table th:nth-child(2),.print-table td:nth-child(2){width:12%}.print-table th:nth-child(3),.print-table td:nth-child(3){width:10%}.print-table th:nth-child(4),.print-table td:nth-child(4){width:17%}.print-table th:nth-child(5),.print-table td:nth-child(5){width:8%}.print-table th:nth-child(6),.print-table td:nth-child(6){width:7%}.print-table th:nth-child(7),.print-table td:nth-child(7){width:5%;text-align:center}.print-table th:nth-child(8),.print-table td:nth-child(8){width:10%}.print-table th:nth-child(9),.print-table td:nth-child(9){width:14%}.print-table th:nth-child(10),.print-table td:nth-child(10){width:8%}.print-table th:nth-child(11),.print-table td:nth-child(11){width:25%;font-size:7pt}
        .images{display:flex;justify-content:center;align-items:center;gap:3px;min-height:26mm}.images img{width:26mm;height:26mm;object-fit:contain;display:block}
        .work .job{display:inline}.work .sep{white-space:pre;color:#555}.drive{overflow-wrap:anywhere;word-break:break-all}
        .signature{margin:12mm 0 0 auto;width:250px;text-align:center;break-inside:avoid;page-break-inside:avoid}.signature-date{margin-bottom:25mm}.signature-line{border-top:1px solid #111;padding-top:4px;font-weight:700}.signature-note{font-size:7.5pt;color:#555;margin-top:2px}
      }
    `;document.head.appendChild(style);
    await waitImages(host);
    const cleanup=()=>{host.remove();style.remove()};
    window.addEventListener('afterprint',cleanup,{once:true});
    window.focus();
    window.print();
  }

  function selectedDomRows(){
    const table=getTable();
    if(!table)return[];
    const rows=[...table.tBodies[0].rows].filter(tr=>!tr.classList.contains('empty')&&!tr.querySelector('.empty'));
    if(!hasSelectionCheckboxes(table))return rows;
    return rows.filter(tr=>tr.querySelector('input[type="checkbox"]:checked'));
  }

  function exportSelectedXlsx(){
    if(!window.XLSX){window.alert('Chức năng xuất Excel chưa sẵn sàng.');return;}
    const trs=selectedDomRows();
    if(!trs.length){window.alert(hasSelectionCheckboxes(getTable())?'Hãy chọn ít nhất một sản phẩm để xuất Excel.':'Không có dữ liệu để xuất Excel.');return;}
    const rows=trs.map(tr=>{
      const cells=[...tr.cells];
      const product=cells.find(c=>c.querySelector?.('strong'))?.querySelector('strong')?.textContent?.trim()||'';
      const text=i=>clean(cells[i]?.innerText||'');
      return [text(1),product,text(3),text(4),text(5),text(6),[...cells[7]?.querySelectorAll('.pill')||[]].map(x=>x.innerText.trim()).filter(Boolean).join(', '),text(8),cells[9]?.querySelector('a')?.href||''];
    });
    const ws=XLSX.utils.aoa_to_sheet([['GP Statistical — Bảng kê sản phẩm'],['Ngày xuất',new Date().toLocaleDateString('vi-VN')],[],['Khách hàng','Sản phẩm','Kích thước','Thể tích','Số lượng','Người thực hiện','Loại công việc','Ngày','Drive'],...rows]);
    ws['!cols']=[{wch:18},{wch:34},{wch:16},{wch:12},{wch:10},{wch:18},{wch:30},{wch:14},{wch:60}];
    const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,'Bảng kê');
    XLSX.writeFile(wb,`GP-Statistical-${new Date().toISOString().slice(0,10)}.xlsx`);
  }

  window.addEventListener('click',e=>{
    const b=e.target.closest?.('[data-export="pdf"],[data-public-export="pdf"]');
    if(b){e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();printA4();return;}
    const x=e.target.closest?.('[data-export="xlsx"],[data-public-export="xlsx"]');
    if(x){e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();exportSelectedXlsx();}
  },true);
})();
