(function(){
  if(window.__GP_EXCEL_EXPORT_V2__) return;
  window.__GP_EXCEL_EXPORT_V2__=true;
  const clean=s=>String(s??'').replace(/\s+/g,' ').trim();
  const norm=v=>clean(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();

  function getTable(button){return button?.closest('.table-card')?.querySelector('table')||[...document.querySelectorAll('.table-card table')].find(t=>!t.closest('#__gp_print_host'))||null;}
  function selectedRows(table){
    if(!table)return[];
    const rows=[...table.tBodies[0]?.rows||[]].filter(tr=>!tr.classList.contains('empty')&&!tr.querySelector('.empty'));
    const checks=rows.filter(tr=>tr.querySelector('input[type="checkbox"]'));
    return checks.length?checks.filter(tr=>tr.querySelector('input[type="checkbox"]:checked')):rows;
  }
  function readRows(table,trs){
    const heads=[...table.tHead.querySelectorAll('th')].map(th=>norm(th.textContent));
    const aliases={image:['hinh','hinh anh'],customer:['khach hang'],product:['san pham'],size:['kich thuoc'],volume:['the tich'],qty:['sl','so luong'],designer:['designer','nguoi thuc hien'],work:['cong viec','loai cong viec'],date:['ngay'],drive:['drive','lien ket drive']};
    const idx={};Object.entries(aliases).forEach(([k,n])=>idx[k]=heads.findIndex(h=>n.includes(h)));
    return trs.map(tr=>{const cells=[...tr.cells],cell=k=>idx[k]>=0?cells[idx[k]]:null,text=k=>clean(cell(k)?.innerText||'');const strong=cell('product')?.querySelector('strong');const product=clean(strong?.textContent||text('product'));const images=[...cell('image')?.querySelectorAll('img')||[]].map(img=>({src:img.currentSrc||img.src||'',alt:img.alt||''})).filter(x=>x.src).slice(0,2);const drive=cell('drive')?.querySelector('a[href]')?.href||clean(cell('drive')?.innerText||'').match(/https?:\/\/\S+/)?.[0]||'';return{images,customer:text('customer'),product,size:text('size'),volume:text('volume'),qty:text('qty')||'0',designer:text('designer'),work:text('work'),date:text('date'),drive};});
  }
  function colWidth(values,min,max){const longest=Math.max(min,...values.map(v=>String(v??'').length));return Math.min(max,longest+2);}
  function driveId(url){try{return new URL(url).searchParams.get('id')||''}catch{return''}}
  async function imageData(url){
    const token=(()=>{try{return sessionStorage.getItem('gpDriveToken')||window.__GP_DRIVE_TOKEN__||''}catch{return window.__GP_DRIVE_TOKEN__||''}})();
    const urls=[];const id=driveId(url);if(id&&token)urls.push({url:`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}?alt=media`,token});urls.push({url,token:''});
    for(const u of urls){try{const res=await fetch(u.url,{mode:'cors',credentials:'omit',cache:'no-store',headers:u.token?{Authorization:`Bearer ${u.token}`}:{}});if(!res.ok)continue;const blob=await res.blob();if(!blob.type.startsWith('image/'))continue;return await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve({base64:String(r.result).split(',')[1],extension:(blob.type.split('/')[1]||'jpeg').replace('svg+xml','png')});r.onerror=reject;r.readAsDataURL(blob)});}catch{}}
    return null;
  }
  function border(cell){cell.border={top:{style:'thin',color:{argb:'FFD9D4CC'}},bottom:{style:'thin',color:{argb:'FFD9D4CC'}},left:{style:'thin',color:{argb:'FFD9D4CC'}},right:{style:'thin',color:{argb:'FFD9D4CC'}}};}

  async function exportExcel(button){
    const table=getTable(button);if(!table){alert('Không tìm thấy bảng sản phẩm.');return;}
    const trs=selectedRows(table);if(!trs.length){alert('Hãy chọn ít nhất một sản phẩm để xuất Excel.');return;}
    if(!window.ExcelJS){alert('Chưa tải được thành phần xuất Excel. Hãy tải lại trang và thử lại.');return;}
    const rows=readRows(table,trs);
    const wb=new ExcelJS.Workbook();wb.creator='GP Statistical';wb.created=new Date();wb.modified=new Date();wb.calcProperties={fullCalcOnLoad:true,forceFullCalc:true};
    const ws=wb.addWorksheet('Bảng kê sản phẩm',{views:[{showGridLines:false}]});const lastCol=11;
    ws.mergeCells(1,1,1,lastCol);ws.getCell(1,1).value='GP STATISTICAL';
    ws.mergeCells(2,1,2,lastCol);ws.getCell(2,1).value='BẢNG KÊ SẢN PHẨM';
    ws.mergeCells(3,1,3,lastCol);ws.getCell(3,1).value='Ngày xuất: '+new Date().toLocaleDateString('vi-VN');
    ws.mergeCells(4,1,4,lastCol);ws.getCell(4,1).value='TỔNG SỐ SẢN PHẨM';ws.getCell(4,2).value={formula:`COUNTA(D7:D${6+rows.length})`,result:rows.length};ws.getCell(4,3).value='TỔNG SỐ LƯỢNG';ws.getCell(4,4).value={formula:`SUM(G7:G${6+rows.length})`,result:rows.reduce((s,r)=>s+(Number(String(r.qty).replace(/[^0-9.-]/g,''))||0),0)};
    ws.addRow([]);
    const h=ws.addRow(['STT','Hình ảnh','Khách hàng','Sản phẩm','Kích thước','Thể tích','SL','Người thực hiện','Công việc','Ngày','Liên kết Drive']);h.height=28;
    h.eachCell(c=>{c.font={name:'Arial',size:11,bold:true,color:{argb:'FFFFFFFF'}};c.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF132238'}};c.alignment={horizontal:'center',vertical:'middle',wrapText:true};border(c);});
    const imageQueue=[];
    rows.forEach((r,i)=>{
      const row=ws.addRow([i+1,'',r.customer||'—',r.product||'—',r.size||'—',r.volume||'—',Number(r.qty)||0,r.designer||'—',r.work||'—',r.date||'—',r.drive||'—']);row.height=82;
      row.eachCell((c,ci)=>{c.font={name:'Arial',size:10,color:{argb:'FF132238'},bold:ci===4};c.alignment={vertical:'middle',horizontal:ci===1||ci===2||ci===7?'center':'left',wrapText:true};border(c);});
      if(i%2===0)row.eachCell(c=>c.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFF8F6F2'}});
      row.getCell(1).alignment={horizontal:'center',vertical:'middle'};row.getCell(7).alignment={horizontal:'center',vertical:'middle'};
      if(r.drive){row.getCell(11).value={text:r.drive,hyperlink:r.drive};row.getCell(11).font={name:'Arial',size:9,color:{argb:'FFD65A32'},underline:'single'};}
      r.images.forEach(im=>imageQueue.push({row:7+i,url:im.src}));
    });
    ws.getRow(1).height=24;ws.getCell(1,1).font={name:'Arial',size:12,bold:true,color:{argb:'FFF45F3A'}};ws.getCell(1,1).alignment={horizontal:'left',vertical:'middle'};
    ws.getCell(2,1).font={name:'Arial',size:20,bold:true,color:{argb:'FF132238'}};ws.getCell(2,1).alignment={horizontal:'left',vertical:'middle'};ws.getRow(2).height=34;
    ws.getCell(3,1).font={name:'Arial',size:10,color:{argb:'FF697586'}};ws.getCell(3,1).alignment={horizontal:'left',vertical:'middle'};
    ws.getCell(4,1).font={name:'Arial',size:10,bold:true,color:{argb:'FF132238'}};ws.getCell(4,1).alignment={horizontal:'left',vertical:'middle'};ws.getCell(4,2).font={name:'Arial',size:14,bold:true,color:{argb:'FF132238'}};ws.getCell(4,3).font={name:'Arial',size:10,bold:true,color:{argb:'FF132238'}};ws.getCell(4,4).font={name:'Arial',size:14,bold:true,color:{argb:'FF132238'}};
    const valuesByCol=[['STT',...rows.map((_,i)=>String(i+1))],['Hình ảnh',...rows.map(()=> '')],['Khách hàng',...rows.map(r=>r.customer)],['Sản phẩm',...rows.map(r=>r.product)],['Kích thước',...rows.map(r=>r.size)],['Thể tích',...rows.map(r=>r.volume)],['SL',...rows.map(r=>r.qty)],['Người thực hiện',...rows.map(r=>r.designer)],['Công việc',...rows.map(r=>r.work)],['Ngày',...rows.map(r=>r.date)],['Liên kết Drive',...rows.map(r=>r.drive)]];
    const mins=[7,18,16,24,16,12,8,18,24,13,42],maxs=[8,20,24,40,24,16,10,24,40,16,70];valuesByCol.forEach((v,i)=>ws.getColumn(i+1).width=colWidth(v,mins[i],maxs[i]));
    ws.pageSetup={orientation:'landscape',paperSize:9,fitToPage:true,fitToWidth:1,fitToHeight:0,margins:{left:0.25,right:0.25,top:0.5,bottom:0.5,header:0.2,footer:0.2}};ws.printOptions={horizontalCentered:false,verticalCentered:false};ws.freezePanes={ySplit:6};ws.autoFilter={from:{row:6,column:1},to:{row:6+rows.length,column:lastCol}};
    for(const q of imageQueue){const d=await imageData(q.url);if(!d)continue;try{const id=wb.addImage({base64:d.base64,extension:d.extension==='jpg'?'jpeg':d.extension});ws.addImage(id,{tl:{col:1.12,row:q.row-1+0.12},ext:{width:112,height:82},editAs:'oneCell'});}catch{}}
    const totalRow=7+rows.length+1;ws.getCell(totalRow,6).value='TỔNG';ws.getCell(totalRow,6).font={name:'Arial',size:11,bold:true};ws.getCell(totalRow,7).value={formula:`SUM(G7:G${6+rows.length})`,result:rows.reduce((s,r)=>s+(Number(r.qty)||0),0)};ws.getCell(totalRow,7).font={name:'Arial',size:11,bold:true};for(let c=6;c<=7;c++)border(ws.getCell(totalRow,c));
    const buf=await wb.xlsx.writeBuffer();const blob=new Blob([buf],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='GP-Statistical-'+new Date().toISOString().slice(0,10)+'.xlsx';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
  }
  window.addEventListener('click',e=>{const b=e.target.closest?.('[data-export="xlsx"],[data-public-export="xlsx"]');if(!b)return;e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();exportExcel(b);},true);
})();
