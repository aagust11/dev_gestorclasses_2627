import {StudentReport,reportSections} from './studentReport';
import {ReportDocument,buildReportWord,buildReportPdf,downloadReport} from './reportDocument';
function document(report:StudentReport):ReportDocument{
  return {title:`Informe de l’alumne · ${report.name}`,filename:`Informe_${report.name}`,teacher:report.teacher,intro:[report.subjects.join(' · '),report.notes,`${report.totals.absent} faltes · ${report.totals.late} retards · ${report.totals.pos} comentaris positius · ${report.totals.incident} incidències. Assistència: ${report.attendance.rate===null?'pendent':report.attendance.rate+'%'}.`,report.supportMeasures?`Mesures de suport: ${report.supportMeasures}`:'',report.additionalComments?`Comentaris addicionals: ${report.additionalComments}`:''],sections:reportSections(report)};
}
export const buildStudentWord=(report:StudentReport)=>buildReportWord(document(report));
export const buildStudentPdf=(report:StudentReport)=>buildReportPdf(document(report));
export const downloadStudentReport=(report:StudentReport,format:'word'|'pdf')=>downloadReport(document(report),format);
