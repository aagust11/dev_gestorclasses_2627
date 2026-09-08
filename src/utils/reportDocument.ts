export const REPORT_NOTICE='Document informatiu de seguiment docent. No constitueix un butlletí oficial de qualificacions ni una certificació del centre.';
export type ReportSection={title:string;headers:string[];rows:string[][]};
export type ReportDocument={title:string;filename:string;teacher?:{fullName:string;email:string};intro:string[];sections:ReportSection[]};
export async function buildReportWord(report:ReportDocument){
  const {Document,Paragraph,TextRun,Table,TableRow,TableCell,WidthType,HeadingLevel,Packer,Footer}=await import('docx');
  const paragraph=(text:string)=>new Paragraph({children:text.split('\n').map((line,i)=>new TextRun({text:line,break:i?1:0})),spacing:{after:100}});
  const children:any[]=[new Paragraph({text:report.title,heading:HeadingLevel.TITLE}),paragraph(`Data: ${new Date().toLocaleDateString('ca-ES')}`)];
  if(report.teacher)children.push(paragraph(`Docent: ${report.teacher.fullName} · ${report.teacher.email}`));
  children.push(...report.intro.filter(Boolean).map(paragraph));
  for(const section of report.sections){
    children.push(new Paragraph({text:section.title,heading:HeadingLevel.HEADING_1}));
    const widths=section.headers.map((_,i)=>Math.floor(9360/section.headers.length)+(i===0?9360%section.headers.length:0));
    children.push(new Table({width:{size:9360,type:WidthType.DXA},columnWidths:widths,rows:[new TableRow({tableHeader:true,children:section.headers.map((text,i)=>new TableCell({width:{size:widths[i],type:WidthType.DXA},shading:{fill:'DFEAF5'},children:[paragraph(text)]}))}),...(section.rows.length?section.rows:[section.headers.map((_,i)=>i?'':'Sense registres')]).map(row=>new TableRow({cantSplit:true,children:row.map((text,i)=>new TableCell({width:{size:widths[i],type:WidthType.DXA},children:[paragraph(text)]}))}))]}));
  }
  return Packer.toBlob(new Document({styles:{default:{document:{run:{font:'Calibri',size:20}}}},sections:[{properties:{page:{size:{width:12240,height:15840},margin:{top:1440,bottom:1440,left:1440,right:1440,footer:650}}},footers:{default:new Footer({children:[new Paragraph({children:[new TextRun({text:REPORT_NOTICE,color:'777777',size:15})]})]})},children}]}));
}
export async function buildReportPdf(report:ReportDocument){
  const [{jsPDF},{default:autoTable}]=await Promise.all([import('jspdf'),import('jspdf-autotable')]);
  const {default:font}=await import('./reportFont');
  const pdf=new jsPDF();pdf.addFileToVFS('AulaReport.ttf',font);pdf.addFont('AulaReport.ttf','AulaReport','normal');pdf.addFont('AulaReport.ttf','AulaReport','bold');pdf.setFont('AulaReport');let y=18;
  const paragraph=(text:string,size=10)=>{pdf.setFontSize(size);for(const line of pdf.splitTextToSize(text||' ',174)){if(y>269){pdf.addPage();y=18;}pdf.text(line,18,y);y+=size*.45+1;}y+=3;};
  paragraph(report.title,17);paragraph(`Data: ${new Date().toLocaleDateString('ca-ES')}`);
  if(report.teacher)paragraph(`Docent: ${report.teacher.fullName} · ${report.teacher.email}`);
  report.intro.filter(Boolean).forEach(t=>paragraph(t));
  for(const section of report.sections){if(y>240){pdf.addPage();y=18;}paragraph(section.title,12);autoTable(pdf,{startY:y,margin:{left:18,right:18,top:18,bottom:26},head:[section.headers],body:section.rows.length?section.rows:[section.headers.map((_,i)=>i?'':'Sense registres')],styles:{font:'AulaReport',fontSize:8,cellPadding:2,overflow:'linebreak'},headStyles:{fillColor:[40,67,100]},alternateRowStyles:{fillColor:[243,246,250]},rowPageBreak:'avoid'});y=(pdf as any).lastAutoTable.finalY+10;}
  const pages=pdf.getNumberOfPages();for(let i=1;i<=pages;i++){pdf.setPage(i);pdf.setFontSize(7);pdf.setTextColor(115,115,115);pdf.text(pdf.splitTextToSize(REPORT_NOTICE,160),18,283);pdf.text(`${i} / ${pages}`,192,291,{align:'right'});}
  return pdf.output('blob');
}
export async function downloadReport(report:ReportDocument,format:'word'|'pdf'){
  const blob=format==='word'?await buildReportWord(report):await buildReportPdf(report);
  const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`${report.filename.replace(/[^\p{L}\p{N}_-]+/gu,'_')}.${format==='word'?'docx':'pdf'}`;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);
}
