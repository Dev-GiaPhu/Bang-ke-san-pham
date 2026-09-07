/* GP Statistical — robust Sheets/Excel + A4 PDF export. */
(function(){
  const STORE='ventek-design-tracker-v2';
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const norm=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
  const load=(k,d)=>{try{return JSON.parse(localStorage.getItem(k)||JSON.stringify(d))}catch{return d}};
  function records(){return load(STORE,[])}
  function currentMonth(){return document.querySelector('#monthFilter')?.value||''}
  function basicFiltered(){const month=currentMonth(),search=norm(document.querySelector('#searchFilter')?.value||''),customer=document.querySelector('#customerFilter')?.value||'';return records().filter(r=>{if(month&&r.month!==month)return false;if(customer&&r.customer!==customer)return false;if(search&&!norm(`${r.customer} ${r.productName} ${r.volume} ${r.size} ${r.designer} ${(r.editTypes||[]).join(' ')}`).includes(search))return false;return true})}
  function filteredRecords(){
    /* On the list page, the DOM already reflects ALL advanced filters. Use row IDs
       from that table so exports cannot silently include hidden rows. */
    const ids=[...document.querySelectorAll('.table-card .table tbody [data-edit]')].map(x=>x.dataset.edit).filter(Boolean);
    if(ids.length)return records().filter(r=>ids.includes(String(r.id)));
    return basicFiltered();
  }
  function monthLabel(m){if(!m)return'Tất cả tháng';const[y,mo]=m.split('-');return mo&&y?`Tháng ${mo}/${y}`:m}
  function summary(rs){const qty=rs.reduce((n,r)=>n+Number(r.quantity||0),0),counts=new Map();rs.forEach(r=>(r.editTypes||[]).forEach(t=>counts.set(t,(counts.get(t)||0)+1)));return{qty,counts:[...counts.entries()].filter(([,n])=>n>0)}}
  function rows(rs){return rs.map((r,i)=>[i+1,r.customer||'',r.productName||'',r.size||'',r.volume||'',Number(r.quantity||0),r.designer||'',(r.editTypes||[]).join(', '),r.date||''])}
  function styledXlsx(rs){
    if(!window.XLSX?.utils?.aoa_to_sheet)return false;
    const s=summary(rs),typeText=s.counts.map(([k,n])=>`${k}: ${n}`).join('    |    '),data=[['BẢNG KÊ SẢN PHẨM'],[monthLabel(currentMonth())],[`Tổng số sản phẩm: ${rs.length}`,'',`Tổng số lượng: ${s.qty}`],...(typeText?[[`Phân loại công việc: ${typeText}`]]:[]),[],['STT','KHÁCH HÀNG','TÊN SẢN PHẨM','KÍCH THƯỚC','THỂ TÍCH','SỐ LƯỢNG','DESIGNER','CÔNG VIỆC','NGÀY'],...rows(rs)];
    try{
      const ws=XLSX.utils.aoa_to_sheet(data),wb=XLSX.utils.book_new(),last=data.length;
      ws['!merges']=[{s:{r:0,c:0},e:{r:0,c:8}},{s:{r:1,c:0},e:{r:1,c:8}},{s:{r:3,c:0},e:{r:3,c:8}}];
      ws['!cols']=[{wch:7},{wch:18},{wch:38},{wch:17},{wch:12},{wch:11},{wch:16},{wch:25},{wch:13}];
      ws['!autofilter']={ref:`A6:I${last}`};
      const thin={style:'thin',color:{rgb:'B8B8B8'}},border={top:thin,bottom:thin,left:thin,right:thin};
      const title={font:{name:'Arial',sz:16,bold:true,color:{rgb:'FFFFFF'}},fill:{patternType:'solid',fgColor:{rgb:'142033'}},alignment:{horizontal:'center',vertical:'center'}};
      const subtitle={font:{name:'Arial',sz:10,bold:true,color:{rgb:'142033'}},alignment:{horizontal:'center',vertical:'center'}};
      const meta={font:{name:'Arial',sz:10,bold:true,color:{rgb:'142033'}},alignment:{vertical:'center'}};
      const header={font:{name:'Arial',sz:10,bold:true,color:{rgb:'FFFFFF'}},fill:{patternType:'solid',fgColor:{rgb:'2E5366'}},alignment:{horizontal:'center',vertical:'center',wrapText:true},border};
      const body={font:{name:'Arial',sz:10,color:{rgb:'111111'}},alignment:{vertical:'center',wrapText:true},border};
      for(let c=0;c<9;c++){const a=XLSX.utils.encode_cell({r:0,c}),b=XLSX.utils.encode_cell({r:1,c}),h=XLSX.utils.encode_cell({r:5,c});if(ws[a])ws[a].s=title;if(ws[b])ws[b].s=subtitle;if(ws[h])ws[h].s=header}
      ['A3','C3','A4'].forEach(a=>{if(ws[a])ws[a].s=meta});
      for(let r=6;r<last;r++)for(let c=0;c<9;c++){const cell=ws[XLSX.utils.encode_cell({r,c})];if(cell)cell.s=body}
      ws['!rows']=[{hpt:26},{hpt:20},{hpt:20},{hpt:20},{hpt:8},{hpt:28}];
      XLSX.utils.book_append_sheet(wb,ws,'Bảng kê');
      XLSX.writeFile(wb,`Bang-ke-san-pham-${currentMonth()||'all'}.xlsx`);return true;
    }catch(e){console.warn('[GP export]',e);return false}
  }
  function legacyExcel(rs){
    const s=summary(rs),data=[['BẢNG KÊ SẢN PHẨM'],[monthLabel(currentMonth())],[`Tổng số sản phẩm: ${rs.length}`,`Tổng số lượng: ${s.qty}`],[],['STT','KHÁCH HÀNG','TÊN SẢN PHẨM','KÍCH THƯỚC','THỂ TÍCH','SỐ LƯỢNG','DESIGNER','CÔNG VIỆC','NGÀY'],...rows(rs)];
    const body=data.map((row,i)=>`<tr>${row.map(v=>`<td>${esc(v)}</td>`).join('')}</tr>`).join('');
    const html=`<!doctype html><html><head><meta charset="utf-8"><style>body{font-family:Arial}table{border-collapse:collapse}td,th{border:1px solid #999;padding:7px}tr:first-child td{font-size:18px;font-weight:700;text-align:center}tr:nth-child(5){font-weight:700;background:#dfe7ea}td{vertical-align:top}</style></head><body><table>${body}</table></body></html>`;
    const blob=new Blob([html],{type:'application/vnd.ms-excel'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`Bang-ke-san-pham-${currentMonth()||'all'}.xls`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);
  }
  function exportSheets(){const rs=filteredRecords();if(!styledXlsx(rs))legacyExcel(rs)}
  function printA4(){
    const rs=filteredRecords(),s=summary(rs),m=currentMonth(),types=s.counts.map(([k,n])=>`${esc(k)}: ${n}`).join(' &nbsp; | &nbsp; '),w=window.open('','_blank','width=1200,height=900');
    if(!w){alert('Trình duyệt đang chặn cửa sổ in. Hãy cho phép popup cho trang này.');return}
    w.document.write(`<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>Bảng kê sản phẩm — ${esc(monthLabel(m))}</title><style>@page{size:A4 landscape;margin:12mm 10mm}*{box-sizing:border-box}html,body{margin:0;padding:0;background:#fff;color:#111;font-family:Arial,"Helvetica Neue",sans-serif}.head{text-align:center;margin-bottom:5mm;border-bottom:2px solid #111;padding-bottom:4mm}h1{margin:0;font-size:18pt}.sub{margin-top:2mm;font-size:10pt}.meta{display:flex;justify-content:space-between;gap:8mm;margin:0 0 3mm;font-size:9.5pt}.types{margin:0 0 4mm;font-size:9pt}table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:8.5pt}th,td{border:1px solid #222;padding:2.4mm 2mm;vertical-align:middle;word-wrap:break-word}th{font-weight:700;text-align:center;background:#eee}th:nth-child(1),td:nth-child(1){width:8mm;text-align:center}th:nth-child(5),td:nth-child(5),th:nth-child(6),td:nth-child(6){width:20mm;text-align:center}th:nth-child(8),td:nth-child(8){width:24mm}.foot{margin-top:6mm;display:flex;justify-content:space-between;font-size:8.5pt}@media print{body{print-color-adjust:exact;-webkit-print-color-adjust:exact}}</style></head><body><div class="head"><h1>BẢNG KÊ SẢN PHẨM</h1><div class="sub">${esc(monthLabel(m))}</div></div><div class="meta"><strong>Tổng số sản phẩm: ${rs.length}</strong><strong>Tổng số lượng: ${s.qty}</strong></div>${types?`<div class="types"><strong>Phân loại công việc:</strong> ${types}</div>`:''}<table><thead><tr><th>STT</th><th>Khách hàng</th><th>Tên sản phẩm</th><th>Kích thước</th><th>Thể tích</th><th>Số lượng</th><th>Designer</th><th>Công việc</th><th>Ngày</th></tr></thead><tbody>${rows(rs).map(r=>`<tr>${r.map(v=>`<td>${esc(v)}</td>`).join('')}</tr>`).join('')}</tbody></table><div class="foot"><span>Ngày xuất: ${new Date().toLocaleDateString('vi-VN')}</span><span>Trang 1</span></div></body></html><script>window.onload=()=>setTimeout(()=>window.print(),250);window.onafterprint=()=>setTimeout(()=>window.close(),250)<\/script>`);w.document.close()
  }
  function bind(){
    const csv=document.querySelector('#csvBtn');
    if(csv&&!csv.dataset.reportFix){csv.dataset.reportFix='1';csv.textContent='Xuất Excel';csv.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();try{exportSheets()}catch(err){console.error(err);alert('Không thể xuất Excel.')}} ,true)}
    const print=document.querySelector('#printBtn');
    if(print&&!print.dataset.reportFix){print.dataset.reportFix='1';print.textContent='Xuất PDF / In A4';print.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();try{printA4()}catch(err){console.error(err);alert('Không thể xuất PDF.')}},true)}
  }
  new MutationObserver(bind).observe(document.body,{childList:true,subtree:true});window.addEventListener('load',bind);setTimeout(bind,100);
})();
