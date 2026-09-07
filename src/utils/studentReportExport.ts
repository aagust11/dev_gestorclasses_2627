import {StudentReport, reportSections} from './studentReport';
const filename=(name:string)=>`Informe_${name.replace(/[^\p{L}\p{N}_-]+/gu,'_')}`;
const summary=(r:StudentReport)=>`${r.totals.absent} faltes · ${r.totals.late} retards · ${r.totals.pos} comentaris positius · ${r.totals.incident} incidències. Comptats per sessió registrada.`;
export async function buildStudentWord(report:StudentReport) {
  const {Document,Paragraph,TextRun,Table,TableRow,TableCell,WidthType,HeadingLevel,Packer}=await import('docx');
  const paragraph=(text:string)=>new Paragraph({children:text.split('\n').flatMap((line,i)=>[new TextRun({text:line,break:i?1:0})]),spacing:{after:100}});
  const children:any[]=[new Paragraph({text:`Informe de l’alumne · ${report.name}`,heading:HeadingLevel.TITLE}),paragraph(report.subjects.join(' · ')),paragraph(`Data: ${new Date().toLocaleDateString('ca-ES')}`),paragraph(report.notes),paragraph(summary(report))];
  for(const [title,text] of [['Mesures de suport',report.supportMeasures],['Comentaris addicionals',report.additionalComments]])if(text)children.push(new Paragraph({text:title,heading:HeadingLevel.HEADING_1}),paragraph(text));
  for(const section of reportSections(report)){
    children.push(new Paragraph({text:section.title,heading:HeadingLevel.HEADING_1}));
    if(!section.rows.length){children.push(paragraph('Sense registres'));continue;}
    children.push(new Table({width:{size:100,type:WidthType.PERCENTAGE},rows:[new TableRow({tableHeader:true,children:section.headers.map(text=>new TableCell({shading:{fill:'DFEAF5'},children:[paragraph(text)]}))}),...section.rows.map(row=>new TableRow({children:row.map(text=>new TableCell({children:[paragraph(text)]}))}))]}));
  }
  return Packer.toBlob(new Document({styles:{default:{document:{run:{font:'Calibri',size:20}}}},sections:[{properties:{page:{margin:{top:900,bottom:900,left:850,right:850}}},children}]}));
}
export async function buildStudentPdf(report:StudentReport) {
  const [{jsPDF},{default:autoTable}]=await Promise.all([import('jspdf'),import('jspdf-autotable')]);
  const pdf=new jsPDF();let y=18;
  const paragraph=(text:string,size=10)=>{pdf.setFontSize(size);for(const line of pdf.splitTextToSize(text||' ',174)){if(y>277){pdf.addPage();y=18;}pdf.text(line,18,y);y+=size*.45+1;}y+=3;};
  paragraph(`Informe de l’alumne · ${report.name}`,17);paragraph(report.subjects.join(' · '));paragraph(`Data: ${new Date().toLocaleDateString('ca-ES')}`);paragraph(report.notes);paragraph(summary(report));
  for(const [title,text] of [['Mesures de suport',report.supportMeasures],['Comentaris addicionals',report.additionalComments]])if(text){paragraph(title,13);paragraph(text);}
  for(const section of reportSections(report)){
    if(y>245){pdf.addPage();y=18;}
    paragraph(section.title,12);
    autoTable(pdf,{startY:y,margin:{left:18,right:18,top:18,bottom:18},head:[section.headers],body:section.rows.length?section.rows:[section.headers.map((_,i)=>i?'':'Sense registres')],styles:{font:'helvetica',fontSize:8,cellPadding:2,overflow:'linebreak'},headStyles:{fillColor:[40,67,100]},alternateRowStyles:{fillColor:[243,246,250]},rowPageBreak:'avoid'});
    y=(pdf as any).lastAutoTable.finalY+10;
  }
  const pages=pdf.getNumberOfPages();for(let i=1;i<=pages;i++){pdf.setPage(i);pdf.setFontSize(8);pdf.text(`${i} / ${pages}`,190,290,{align:'right'});}
  return pdf.output('blob');
}
export async function downloadStudentReport(report:StudentReport,format:'word'|'pdf') {
  const blob=format==='word'?await buildStudentWord(report):await buildStudentPdf(report);
  const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`${filename(report.name)}.${format==='word'?'docx':'pdf'}`;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);
}
