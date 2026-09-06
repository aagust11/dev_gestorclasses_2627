/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { 
  TrendingUp, 
  Users, 
  Calendar, 
  Award, 
  Search, 
  AlertTriangle, 
  CheckCircle2, 
  FileText, 
  Download,
  Filter,
  BarChart3,
  ThumbsUp,
  FlameKindling
} from 'lucide-react';
import { AppState, Subject, Student, SessionLog } from '../types';
import { getProgrammedSessionsForSubject } from '../utils/dateHelpers';

interface RendimentViewProps {
  state: AppState;
}

export default function RendimentView({ state }: RendimentViewProps) {
  // Select active subject for reporting
  const validSubjects = useMemo(() => {
    return state.subjects.filter(s => !s.isGeneral && !s.isParent);
  }, [state.subjects]);

  const [selectedSubId, setSelectedSubId] = useState<string>(() => {
    return validSubjects[0]?.id || '';
  });

  const activeSubject = useMemo(() => {
    return state.subjects.find(s => s.id === selectedSubId);
  }, [selectedSubId, state.subjects]);

  // Get active students for the selected subject
  const activeStudents = useMemo(() => {
    if (!activeSubject) return [];
    return activeSubject.students;
  }, [activeSubject]);

  // State to filter calculations by course or specific trimester
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>('curs');

  const todayStr = useMemo(() => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }, []);

  const calculationPeriod = useMemo(() => {
    if (selectedPeriodId === 'curs') {
      return {
        startDate: state.config.startDate,
        endDate: state.config.endDate,
        name: 'Curs Complet'
      };
    }
    const term = state.config.terms.find(t => t.id === selectedPeriodId);
    if (term) {
      return {
        startDate: term.startDate,
        endDate: term.endDate,
        name: term.name
      };
    }
    return {
      startDate: state.config.startDate,
      endDate: state.config.endDate,
      name: 'Curs Complet'
    };
  }, [selectedPeriodId, state.config]);

  const isPosterior = useMemo(() => {
    return calculationPeriod.startDate > todayStr;
  }, [calculationPeriod, todayStr]);

  const calcEndDate = useMemo(() => {
    if (isPosterior) return calculationPeriod.endDate;
    return calculationPeriod.endDate < todayStr ? calculationPeriod.endDate : todayStr;
  }, [calculationPeriod, todayStr, isPosterior]);

  // Active programmed sessions for this subject within the active calculation period (up to calcEndDate)
  const programmedSessions = useMemo(() => {
    if (!selectedSubId || isPosterior) return [];
    return getProgrammedSessionsForSubject(
      state,
      selectedSubId,
      calculationPeriod.startDate,
      calcEndDate
    );
  }, [state, selectedSubId, calculationPeriod, calcEndDate, isPosterior]);

  // Filter out any logged sessions relevant to this subject in the calculation period (up to calcEndDate)
  const activeSubjectSessions = useMemo(() => {
    if (!selectedSubId || isPosterior) return [];
    return state.sessionLogs.filter(log => 
      log.subjectId === selectedSubId &&
      log.date >= calculationPeriod.startDate &&
      log.date <= calcEndDate
    );
  }, [selectedSubId, state.sessionLogs, calculationPeriod, calcEndDate, isPosterior]);

  // Support search & filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRiskGrade, setFilterRiskGrade] = useState(false);
  const [filterRiskAttendance, setFilterRiskAttendance] = useState(false);
  const [sortBy, setSortBy] = useState<'name' | 'grade' | 'attendance'>('name');

  // Compute student level statistics
  const studentStats = useMemo(() => {
    if (!activeSubject || activeStudents.length === 0) return [];

    const totalSessions = programmedSessions.length;

    return activeStudents.map(student => {
      let presentCount = 0;
      let lateCount = 0;
      let absentCount = 0;
      
      let scoreSum = 0;
      let scoresCount = 0;

      let positiveCommentsCount = 0;
      let incidentCommentsCount = 0;

      activeSubjectSessions.forEach(session => {
        const log = session.attendance?.[student.id];
        if (log) {
          if (log.status === 'present') {
            presentCount++;
          } else if (log.status === 'late10' || log.status === 'lateMore10') {
            lateCount++;
            presentCount++; 
          } else if (log.status === 'absent') {
            absentCount++;
          }

          // Compute grades
          if (typeof log.score === 'number') {
            scoreSum += log.score;
            scoresCount++;
          }

          // Comments metrics
          const posList = log.posComments || (log.posComment ? [log.posComment] : []);
          positiveCommentsCount += posList.length;

          const incList = log.incidentComments || (log.incidentComment ? [log.incidentComment] : []);
          incidentCommentsCount += incList.length;
        }
      });

      // Default attendance calculations counts as present everything unless marked as absent:
      // Formula: 1 - (faltes / total classes)
      const attendanceRate = isPosterior 
        ? null 
        : (totalSessions > 0 
            ? Math.max(0, Math.round((1 - (absentCount / totalSessions)) * 100)) 
            : 100);

      const averageGrade = scoresCount > 0 ? parseFloat((scoreSum / scoresCount).toFixed(2)) : null;

      return {
        student,
        attendanceRate,
        presentCount: isPosterior ? 0 : (totalSessions - absentCount),
        lateCount,
        absentCount,
        totalSessions,
        averageGrade,
        positiveCommentsCount,
        incidentCommentsCount
      };
    });
  }, [activeSubject, activeStudents, activeSubjectSessions, programmedSessions, isPosterior]);

  // Calculate high level metrics
  const groupMetrics = useMemo(() => {
    if (studentStats.length === 0) {
      return { avgGrade: '-', avgAttendance: '-', countLowAttendance: 0, countLowGrade: 0 };
    }

    let gradeSum = 0;
    let gradeCount = 0;
    let attendSum = 0;
    let attendCount = 0;
    let countLowAttendance = 0;
    let countLowGrade = 0;

    studentStats.forEach(st => {
      if (st.averageGrade !== null) {
        gradeSum += st.averageGrade;
        gradeCount++;
        if (st.averageGrade < 5) countLowGrade++;
      }
      if (st.attendanceRate !== null) {
        attendSum += st.attendanceRate;
        attendCount++;
        if (st.attendanceRate < 80) countLowAttendance++;
      }
    });

    const avgGrade = gradeCount > 0 ? (gradeSum / gradeCount).toFixed(1) : 'S/N';
    const avgAttendance = attendCount > 0 ? Math.round(attendSum / attendCount) + '%' : '-';

    return {
      avgGrade,
      avgAttendance,
      countLowAttendance,
      countLowGrade
    };
  }, [studentStats]);

  // Apply visual progress filter matching user options
  const filteredStats = useMemo(() => {
    let result = [...studentStats];

    // Search query
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      result = result.filter(st => st.student.name.toLowerCase().includes(q));
    }

    // Risk Grade (< 5)
    if (filterRiskGrade) {
      result = result.filter(st => st.averageGrade !== null && st.averageGrade < 5);
    }

    // Risk Attendance (< 80%)
    if (filterRiskAttendance) {
      result = result.filter(st => st.attendanceRate !== null && st.attendanceRate < 80);
    }

    // Sorting options
    result.sort((a, b) => {
      if (sortBy === 'grade') {
        const gradeA = a.averageGrade !== null ? a.averageGrade : -1;
        const gradeB = b.averageGrade !== null ? b.averageGrade : -1;
        return gradeB - gradeA; // Highest to lowest grade
      }
      if (sortBy === 'attendance') {
        const attA = a.attendanceRate !== null ? a.attendanceRate : -1;
        const attB = b.attendanceRate !== null ? b.attendanceRate : -1;
        return attB - attA; // Highest to lowest attendance
      }
      return a.student.name.localeCompare(b.student.name); // Alphabetical
    });

    return result;
  }, [studentStats, searchTerm, filterRiskGrade, filterRiskAttendance, sortBy]);

  // Quick export reports to localized CSV
  const handleExportCSVReport = () => {
    if (!activeSubject) return;
    
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Alumne;Assistencia %;Presencies;Retards;Absencies;Sessions Registrades;Nota Mitjana;Mesures Positives;Incidencies\n";
    
    studentStats.forEach(st => {
      const gradeText = st.averageGrade !== null ? st.averageGrade.toString() : "N/A";
      const row = `${st.student.name};${st.attendanceRate}%;${st.presentCount};${st.lateCount};${st.absentCount};${st.totalSessions};${gradeText};${st.positiveCommentsCount};${st.incidentCommentsCount}`;
      csvContent += row + "\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `informe_rendiment_${activeSubject.name.replace(/\s+/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div id="section-rendiment" className="space-y-6">
      
      {/* Title block */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 shadow-sm border border-indigo-100">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 tracking-tight">Rendiment, Qualificacions i Assistència</h2>
            <p className="text-xs text-slate-400">Genereu i consulteu els progressos acadèmics dels grups assignats.</p>
          </div>
        </div>

        {/* Dropdown Selector */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">grup:</label>
            {validSubjects.length === 0 ? (
              <span className="text-xs text-amber-600 font-semibold bg-amber-50 px-3 py-1.5 border border-amber-100 rounded-xl">Creeu primer un grup lectiu</span>
            ) : (
              <select
                id="select-subject-report"
                value={selectedSubId}
                onChange={(e) => setSelectedSubId(e.target.value)}
                className="text-xs font-bold text-slate-700 p-2.5 border border-slate-250 bg-white rounded-xl shadow-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none cursor-pointer max-w-xs"
              >
                {validSubjects.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            )}
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">període:</label>
            <select
              id="select-period-report"
              value={selectedPeriodId}
              onChange={(e) => setSelectedPeriodId(e.target.value)}
              className="text-xs font-bold text-indigo-700 p-2.5 border border-indigo-200 bg-indigo-50 rounded-xl shadow-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none cursor-pointer"
            >
              <option value="curs">Curs Complet (tot el curs)</option>
              {state.config.terms.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          {activeSubject && studentStats.length > 0 && (
            <button
              id="btn-export-reports-csv"
              onClick={handleExportCSVReport}
              className="flex items-center space-x-1.5 px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-650 rounded-xl text-xs font-bold border border-indigo-150 transition-colors"
              title="Baixar com a fitxer de full de càlcul Excel/CSV"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Descarregar Excel (CSV)</span>
            </button>
          )}
        </div>
      </div>

      {activeSubject ? (
        <>
          {/* Dashboard Summary Widgets (Bento style) */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            
            {/* Widget 1: Count of Pupils */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4.5 shadow-sm flex items-center justify-between">
              <div>
                <span className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider">Alumnes del grup</span>
                <span className="text-2xl font-black text-slate-800 tracking-tight block mt-0.5">{activeStudents.length}</span>
                <span className="text-[10px] text-slate-400 font-medium block mt-1">
                  {activeSubject.parentId ? 'Heretats del Grup Mare' : 'Alumnes propis'}
                </span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-500">
                <Users className="w-5 h-5" />
              </div>
            </div>

            {/* Widget 2: Count of Sessions Logged */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4.5 shadow-sm flex items-center justify-between">
              <div>
                <span className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider">Sessions Registrades</span>
                <span className="text-2xl font-black text-slate-800 tracking-tight block mt-0.5">{activeSubjectSessions.length}</span>
                <span className="text-[10px] text-slate-400 font-medium block mt-1">De {programmedSessions.length} programades</span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-500">
                <Calendar className="w-5 h-5" />
              </div>
            </div>

            {/* Widget 3: Group Average Score */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4.5 shadow-sm flex items-center justify-between" style={{ borderLeft: `4px solid ${activeSubject.color}` }}>
              <div>
                <span className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider">Nota Mitjana del Grup</span>
                <span className="text-2xl font-black text-slate-800 tracking-tight block mt-0.5">{groupMetrics.avgGrade}</span>
                <span className="text-[10px] text-slate-400 font-medium block mt-1">Sobre base de 10 punts</span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                <Award className="w-5 h-5" />
              </div>
            </div>

            {/* Widget 4: Overall Attendance Rate */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4.5 shadow-sm flex items-center justify-between">
              <div>
                <span className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider">Percentatge d'Assistència</span>
                <span className="text-2xl font-black text-slate-800 tracking-tight block mt-0.5">{groupMetrics.avgAttendance}</span>
                <span className="text-[10px] text-slate-400 font-medium block mt-1">Presència mitjana global</span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* Alert Cards for Pupils at Risk */}
          {(groupMetrics.countLowGrade > 0 || groupMetrics.countLowAttendance > 0) && (
            <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex items-start gap-3 text-rose-800 animate-fadeIn">
              <AlertTriangle className="w-5 h-5 text-rose-650 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h4 className="text-xs font-bold uppercase tracking-wider text-rose-900">Spotlight: Alumnes que requereixen atenció:</h4>
                <p className="text-xs opacity-90 leading-tight">
                  S'han detectat <strong className="font-extrabold">{groupMetrics.countLowGrade} alumnes</strong> amb mitjana de notes suspeses i <strong className="font-extrabold">{groupMetrics.countLowAttendance} alumnes</strong> per sota de la recomanació del 80% d'assistència en aquest trimestre/curs.
                </p>
              </div>
            </div>
          )}

          {/* Visual SVG Timeline Average Class Progression Chart */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <h3 className="font-bold text-slate-900 text-sm mb-4 inline-flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-slate-400" />
              Progés Mitjà del Grup per Sessions de Classe
            </h3>

            {activeSubjectSessions.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-12 italic border border-dashed rounded-xl">Sense prou dades per pintar la línia temporal de progrés.</p>
            ) : (
              <div className="space-y-4">
                <div className="h-44 w-full flex items-end justify-between gap-1 border-b border-l border-slate-100 pb-2 pl-2">
                  {/* Generate simple, beautiful responsive bar graph representing the score per session date */}
                  {(() => {
                    // Group sessions by date to avoid duplicate date columns and ensure unique keys
                    const sessionsMap: Record<string, { dateStr: string; sum: number; count: number; sessionCount: number }> = {};
                    
                    activeSubjectSessions.forEach((session) => {
                      if (!sessionsMap[session.date]) {
                        sessionsMap[session.date] = { dateStr: session.date, sum: 0, count: 0, sessionCount: 0 };
                      }
                      sessionsMap[session.date].sessionCount++;
                      Object.values(session.attendance || {}).forEach((log: any) => {
                        if (log && typeof log.score === 'number') {
                          sessionsMap[session.date].sum += log.score;
                          sessionsMap[session.date].count++;
                        }
                      });
                    });

                    const sessionGrades = Object.values(sessionsMap)
                      .map(item => ({
                        dateStr: item.dateStr,
                        sessionCount: item.sessionCount,
                        avg: item.count > 0 ? (item.sum / item.count) : null
                      }))
                      .sort((a, b) => a.dateStr.localeCompare(b.dateStr));

                    return sessionGrades.map((sg, i) => {
                      const percentage = sg.avg !== null ? (sg.avg / 10) * 100 : 0;
                      const hasGrading = sg.avg !== null;

                      return (
                        <div key={`${sg.dateStr}_${i}`} className="flex-1 flex flex-col items-center group relative h-full justify-end cursor-pointer">
                          {/* Tooltip on hover */}
                          <div className="absolute bottom-full mb-1 bg-slate-900 text-white text-[9px] px-2 py-1 rounded shadow-lg pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-30">
                            {sg.sessionCount > 1 ? `${sg.sessionCount} sessions (${sg.dateStr})` : `Sessió ${sg.dateStr}`} <br/>
                            {hasGrading ? `Mitjana: ${sg.avg?.toFixed(1)} / 10` : 'S/A (Sense qualificar)'}
                          </div>
                          
                          {/* Chart Bar */}
                          <div 
                            className="w-full rounded-t transition-all duration-300"
                            style={{ 
                              height: `${percentage || 8}%`, 
                              backgroundColor: percentage >= 65 ? '#10b981' : percentage >= 49 ? '#f59e0b' : hasGrading ? '#f43f5e' : '#e2e8f0'
                            }}
                          />
                          <span className="text-[8px] text-slate-400 mt-1.5 font-mono truncate max-w-full tracking-tighter">
                            {sg.dateStr.slice(5)}
                          </span>
                        </div>
                      );
                    });
                  })()}
                </div>
                <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold px-1 uppercase tracking-wider">
                  <span>Sessions de classe anteriors</span>
                  <span>Sessions més recents</span>
                </div>
              </div>
            )}
          </div>

          {/* Student Detailed Performance Listing Table */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Resum Individual de l'Alumnat</h3>
                <p className="text-xs text-slate-400 mt-0.5">Llista detallada del progrés, comportaments i assistència.</p>
              </div>

              {/* Filters search row */}
              <div className="flex flex-wrap items-center gap-3">
                {/* Search query input */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-450 absolute left-3 top-3" />
                  <input
                    type="text"
                    placeholder="Cerca alumne..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8.5 pr-3 py-1.5 border border-slate-250 rounded-xl text-xs bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 w-44"
                  />
                </div>

                {/* Filters toggle */}
                <button
                  onClick={() => setFilterRiskGrade(!filterRiskGrade)}
                  className={`px-3 py-1.5 border rounded-xl text-xs font-bold transition-all flex items-center space-x-1 ${
                    filterRiskGrade 
                      ? 'bg-rose-50 border-rose-300 text-rose-700 font-extrabold shadow-sm' 
                      : 'bg-white border-slate-200 text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <Filter className="w-3 h-3" />
                  <span>Suspesos (&lt;5)</span>
                </button>

                <button
                  onClick={() => setFilterRiskAttendance(!filterRiskAttendance)}
                  className={`px-3 py-1.5 border rounded-xl text-xs font-bold transition-all flex items-center space-x-1 ${
                    filterRiskAttendance 
                      ? 'bg-amber-50 border-amber-300 text-amber-700 font-extrabold shadow-sm' 
                      : 'bg-white border-slate-200 text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <AlertTriangle className="w-3 h-3" />
                  <span>Risc Assistència (&lt;80%)</span>
                </button>

                {/* Sort Option */}
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="text-xs border text-slate-650 font-bold border-slate-200 bg-white rounded-xl p-1.5 focus:outline-none"
                >
                  <option value="name">Ordenar: Nom</option>
                  <option value="grade">Ordenar: Nota Mitjana</option>
                  <option value="attendance">Ordenar: Assistència</option>
                </select>
              </div>
            </div>

            {/* Students Table */}
            {filteredStats.length === 0 ? (
              <div className="p-12 text-center text-slate-400 italic">
                No s'ha trobat cap alumne que compleixi els filtres triats o no hi han alumnes en aquesta matèria.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-400 text-[10px] font-bold uppercase tracking-wider border-b border-slate-100">
                      <th className="py-3 px-6">Alumne</th>
                      <th className="py-3 px-6 text-center">Sessions Loguejades</th>
                      <th className="py-3 px-6 text-center">Assistència %</th>
                      <th className="py-3 px-6 text-center">Presencial / Retards / Absències</th>
                      <th className="py-3 px-6 text-center">Mesures O.D. / Incidències</th>
                      <th className="py-3 px-6 text-center">Nota Mitjana (0-10)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {filteredStats.map(({ 
                      student, 
                      attendanceRate, 
                      presentCount, 
                      lateCount, 
                      absentCount, 
                      totalSessions, 
                      averageGrade,
                      positiveCommentsCount,
                      incidentCommentsCount
                    }) => {
                      const isLowAttendance = attendanceRate !== null && attendanceRate < 80;
                      const isLowGrade = averageGrade !== null && averageGrade < 5;

                      return (
                        <tr key={student.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="py-3 px-6 font-bold text-slate-800">
                            {student.name}
                          </td>
                          <td className="py-3 px-6 text-center text-slate-500">
                            {attendanceRate !== null ? totalSessions : ''}
                          </td>
                          <td className="py-3 px-6">
                            <div className="flex items-center justify-center space-x-2">
                              <span className={`font-black ${isLowAttendance ? 'text-rose-600 font-extrabold' : 'text-slate-700'}`}>
                                {attendanceRate !== null ? `${attendanceRate}%` : ''}
                              </span>
                              
                              {/* Small simple progress visual bar */}
                              {attendanceRate !== null && (
                                <div className="w-12 h-1.5 bg-slate-100 rounded-full overflow-hidden shrink-0 hidden sm:block">
                                  <div 
                                    className={`h-full ${isLowAttendance ? 'bg-rose-500' : 'bg-emerald-500'}`}
                                    style={{ width: `${attendanceRate}%` }}
                                  />
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-6 text-center">
                            {attendanceRate !== null ? (
                              <div className="inline-flex space-x-2 text-[11px] font-mono">
                                <span className="text-emerald-600 font-bold" title="Prèsències">{presentCount}p</span>
                                <span className="text-slate-400" title="Retards">{lateCount}r</span>
                                <span className="text-rose-500 font-bold" title="Absències">{absentCount}a</span>
                              </div>
                            ) : ''}
                          </td>
                          <td className="py-3 px-6 text-center">
                            {attendanceRate !== null ? (
                              <div className="inline-flex space-x-2.5 text-[11px]">
                                {positiveCommentsCount > 0 && (
                                  <span className="text-indigo-650 bg-indigo-50 font-bold px-1.5 py-0.5 rounded inline-flex items-center gap-0.5" title="Accions docents positives">
                                    <ThumbsUp className="w-2.5 h-2.5 text-indigo-500" />
                                    <span>{positiveCommentsCount}</span>
                                  </span>
                                )}
                                {incidentCommentsCount > 0 && (
                                  <span className="text-rose-700 bg-rose-50 font-bold px-1.5 py-0.5 rounded inline-flex items-center gap-0.5" title="Incidències comportament / tasques">
                                    <FlameKindling className="w-2.5 h-2.5 text-rose-500 animate-pulse" />
                                    <span>{incidentCommentsCount}</span>
                                  </span>
                                )}
                                {positiveCommentsCount === 0 && incidentCommentsCount === 0 && (
                                  <span className="text-slate-350 italic">-</span>
                                )}
                              </div>
                            ) : ''}
                          </td>
                          <td className="py-3 px-6 text-center">
                            {averageGrade !== null ? (
                              <div className="inline-flex items-center space-x-2">
                                <span className={`text-base font-black px-2 py-0.5 rounded-lg font-mono ${
                                  averageGrade >= 6.5 
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' 
                                    : averageGrade >= 5 
                                      ? 'bg-amber-50 text-amber-700 border border-amber-100' 
                                      : 'bg-rose-50 text-rose-700 border border-rose-100'
                                }`}>
                                  {averageGrade.toFixed(2)}
                                </span>
                              </div>
                            ) : (
                              <span className="text-slate-450 italic text-[11px]">Sense notes</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center shadow-sm">
          <p className="text-slate-400 italic">No s'ha pogut carregar cap grup d'alumnes vàlid per fer l'informe.</p>
        </div>
      )}
    </div>
  );
}
