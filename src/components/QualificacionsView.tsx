/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import { 
  Award, 
  Calculator, 
  RefreshCw, 
  Trash2, 
  Download, 
  Filter, 
  AlertTriangle, 
  CheckCircle2, 
  Edit3, 
  BarChart3, 
  HelpCircle,
  TrendingUp,
  Layers,
  Sparkles,
  Info
} from 'lucide-react';
import { 
  AppState, 
  Subject, 
  Competency, 
  EvalCriterion, 
  Term, 
  TermGradesRecord,
  TermStudentGrades
} from '../types';
import { 
  QUAL_COLORS,
  DEFAULT_COMP_SETTINGS,
  calculateCompetencialTermGrades,
  calculateNumericTermGrades,
  filterActivitiesForPeriod,
  exportTermGradesToExcel,
  calculateMean,
  calculateMedian,
  calculateMode,
  scoreToCompetencial
} from '../utils/gradeCalculations';

interface QualificacionsViewProps {
  state: AppState;
  onChangeState: (nextState: AppState) => void;
}

export default function QualificacionsView({ state, onChangeState }: QualificacionsViewProps) {
  // Selectable subjects (excluding pure general actions and mother groups with no students)
  const validSubjects = useMemo(() => {
    return state.subjects.filter(s => !s.isGeneral);
  }, [state.subjects]);

  const [selectedSubId, setSelectedSubId] = useState<string>(() => {
    return validSubjects.find(s => !s.isParent)?.id || validSubjects[0]?.id || '';
  });

  const activeSubject = useMemo(() => {
    return state.subjects.find(s => s.id === selectedSubId);
  }, [selectedSubId, state.subjects]);

  // Selected period: termId ('t1', 't2', 't3') or 'annual'
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>('t1');

  // Selected calculation display metric: 'mean' | 'median' | 'mode'
  const [viewMetric, setViewMetric] = useState<'mean' | 'median' | 'mode'>('mean');

  // Cell editing modal / inline state
  const [editingCell, setEditingCell] = useState<{
    studentId: string;
    studentName: string;
    type: 'criterion' | 'competency' | 'item' | 'final';
    targetId: string; // criterionId, compId, itemId
    targetLabel: string;
    currentScore: number;
    currentQual?: string;
  } | null>(null);

  const [editInputScore, setEditInputScore] = useState<string>('');
  const [editInputQual, setEditInputQual] = useState<string>('AS');

  // Record ID for current subject and period
  const recordId = `${selectedSubId}_${selectedPeriodId}`;

  // Find saved record in state
  const currentRecord = useMemo(() => {
    return (state.termGradesRecords || []).find(r => r.id === recordId);
  }, [state.termGradesRecords, recordId]);

  // Relevant subject competencies and criteria (including mother group inheritance if applicable)
  const effectiveSubIdForComp = activeSubject?.parentId || activeSubject?.id || '';
  
  const relevantCompetencies = useMemo(() => {
    return state.competencies.filter(c => c.subjectId === effectiveSubIdForComp);
  }, [state.competencies, effectiveSubIdForComp]);

  const relevantCriteria = useMemo(() => {
    const compIds = relevantCompetencies.map(c => c.id);
    return state.criteria
      .filter(cr => compIds.includes(cr.competencyId))
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }, [state.criteria, relevantCompetencies]);

  const isCompetencial = activeSubject?.evaluationType !== 'numeric';
  const compSettings = activeSubject?.compSettings || DEFAULT_COMP_SETTINGS;

  // Active students for this subject
  const students = useMemo(() => {
    if (!activeSubject) return [];
    if (activeSubject.students && activeSubject.students.length > 0) {
      return activeSubject.students;
    }
    // If mother group, aggregate child students
    if (activeSubject.isParent) {
      const children = state.subjects.filter(s => s.parentId === activeSubject.id);
      const all: any[] = [];
      children.forEach(c => all.push(...c.students));
      return all;
    }
    return [];
  }, [activeSubject, state.subjects]);

  // Relevant activities for this period
  const relevantActivities = useMemo(() => {
    if (!activeSubject) return [];
    return filterActivitiesForPeriod(
      state.activities || [],
      activeSubject.id,
      selectedPeriodId,
      state.config.terms
    );
  }, [state.activities, activeSubject, selectedPeriodId, state.config.terms]);

  // Compute or read student grades
  const studentGradesData: Record<string, TermStudentGrades> = useMemo(() => {
    if (currentRecord?.students && Object.keys(currentRecord.students).length > 0) {
      return currentRecord.students;
    }
    // Fallback compute in real-time
    if (!activeSubject) return {};
    if (isCompetencial) {
      return calculateCompetencialTermGrades(
        activeSubject,
        relevantActivities,
        relevantCompetencies,
        relevantCriteria,
        currentRecord?.students
      );
    } else {
      return calculateNumericTermGrades(
        activeSubject,
        relevantActivities,
        currentRecord?.students
      );
    }
  }, [currentRecord, activeSubject, isCompetencial, relevantActivities, relevantCompetencies, relevantCriteria]);

  // Action: Save or update record
  const saveGradesRecord = (newStudentsData: Record<string, TermStudentGrades>) => {
    const records = state.termGradesRecords || [];
    const filtered = records.filter(r => r.id !== recordId);
    const newRecord: TermGradesRecord = {
      id: recordId,
      subjectId: selectedSubId,
      periodId: selectedPeriodId,
      calculationMode: viewMetric,
      students: newStudentsData
    };

    onChangeState({
      ...state,
      termGradesRecords: [...filtered, newRecord]
    });
  };

  // Action: Calcular automàticament
  const handleAutoCalculate = () => {
    if (!activeSubject) return;

    let computed: Record<string, TermStudentGrades>;
    if (isCompetencial) {
      computed = calculateCompetencialTermGrades(
        activeSubject,
        relevantActivities,
        relevantCompetencies,
        relevantCriteria,
        undefined // Fresh recalculation
      );
    } else {
      computed = calculateNumericTermGrades(
        activeSubject,
        relevantActivities,
        undefined
      );
    }

    saveGradesRecord(computed);
    alert(`S'han calculat automàticament les notes de ${students.length} alumnes a partir de les ${relevantActivities.length} activitats d'aquest període.`);
  };

  // Action: Recalcular a partir dels canvis manuals
  const handleRecalculateDependent = () => {
    if (!activeSubject) return;

    let computed: Record<string, TermStudentGrades>;
    if (isCompetencial) {
      computed = calculateCompetencialTermGrades(
        activeSubject,
        relevantActivities,
        relevantCompetencies,
        relevantCriteria,
        studentGradesData // Keep manual overrides!
      );
    } else {
      computed = calculateNumericTermGrades(
        activeSubject,
        relevantActivities,
        studentGradesData
      );
    }

    saveGradesRecord(computed);
    alert('S\'han recalculat totes les competències, llindars i notes finals tenint en compte les modificacions manuals.');
  };

  // Action: Esborrar totes les notes
  const handleClearAllGrades = () => {
    const confirmClear = window.confirm(
      '⚠️ Esteu segurs que voleu esborrar totes les notes calculades i modificacions d\'aquest període? Podreu tornar a calcular-les quan vulgueu.'
    );
    if (!confirmClear) return;

    const records = (state.termGradesRecords || []).filter(r => r.id !== recordId);
    onChangeState({
      ...state,
      termGradesRecords: records
    });
    alert('S\'han esborrat totes les notes del període.');
  };

  // Action: Open cell editor
  const handleOpenCellEditor = (
    studentId: string,
    studentName: string,
    type: 'criterion' | 'competency' | 'item' | 'final',
    targetId: string,
    targetLabel: string,
    currentScore: number,
    currentQual?: string
  ) => {
    setEditingCell({
      studentId,
      studentName,
      type,
      targetId,
      targetLabel,
      currentScore,
      currentQual
    });
    setEditInputScore(String(currentScore));
    setEditInputQual(currentQual || scoreToCompetencial(currentScore, compSettings.thresholds));
  };

  // Action: Save cell edit
  const handleSaveCellEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCell) return;

    const numScore = parseFloat(editInputScore);
    if (isNaN(numScore)) {
      alert('Introduïu una puntuació numèrica vàlida.');
      return;
    }

    const nextGrades = { ...studentGradesData };
    const stData = nextGrades[editingCell.studentId] || {
      criteria: {},
      competencies: {},
      items: {},
      finalGrade: { score: 0, qual: 'NA' }
    };

    if (editingCell.type === 'criterion') {
      stData.criteria = {
        ...stData.criteria,
        [editingCell.targetId]: {
          score: numScore,
          qual: editInputQual,
          isManual: true
        }
      };
    } else if (editingCell.type === 'competency') {
      stData.competencies = {
        ...stData.competencies,
        [editingCell.targetId]: {
          score: numScore,
          qual: editInputQual,
          isManual: true
        }
      };
    } else if (editingCell.type === 'item') {
      stData.items = {
        ...stData.items,
        [editingCell.targetId]: {
          score: numScore,
          isManual: true
        }
      };
    } else if (editingCell.type === 'final') {
      stData.finalGrade = {
        ...stData.finalGrade,
        score: numScore,
        qual: editInputQual,
        isManual: true
      };
    }

    nextGrades[editingCell.studentId] = stData;
    saveGradesRecord(nextGrades);
    setEditingCell(null);
  };

  // Action: Export to Excel
  const handleExportExcel = () => {
    if (!activeSubject) return;
    const periodName = selectedPeriodId === 'annual' 
      ? 'Curs Complet' 
      : state.config.terms.find(t => t.id === selectedPeriodId)?.name || selectedPeriodId;

    exportTermGradesToExcel(
      activeSubject,
      periodName,
      relevantCriteria,
      relevantCompetencies,
      studentGradesData
    );
  };

  // Group summary statistics calculation (Mitjana, Mediana, Moda del grup)
  const groupStats = useMemo(() => {
    const finalScores: number[] = [];
    const finalQuals: string[] = [];
    const critScores: Record<string, number[]> = {};
    const compScores: Record<string, number[]> = {};
    const itemScores: Record<string, number[]> = {};

    relevantCriteria.forEach(cr => { critScores[cr.id] = []; });
    relevantCompetencies.forEach(cp => { compScores[cp.id] = []; });
    (activeSubject?.numericItems || []).forEach(it => { itemScores[it.id] = []; });

    students.forEach(st => {
      const data = studentGradesData[st.id];
      if (!data) return;

      if (typeof data.finalGrade?.score === 'number') {
        finalScores.push(data.finalGrade.score);
      }
      if (data.finalGrade?.qual) {
        finalQuals.push(data.finalGrade.qual);
      }

      relevantCriteria.forEach(cr => {
        const cVal = data.criteria?.[cr.id]?.score;
        if (typeof cVal === 'number') critScores[cr.id].push(cVal);
      });

      relevantCompetencies.forEach(cp => {
        const cpVal = data.competencies?.[cp.id]?.score;
        if (typeof cpVal === 'number') compScores[cp.id].push(cpVal);
      });

      (activeSubject?.numericItems || []).forEach(it => {
        const itVal = data.items?.[it.id]?.score;
        if (typeof itVal === 'number') itemScores[it.id].push(itVal);
      });
    });

    return {
      meanFinal: calculateMean(finalScores),
      medianFinal: calculateMedian(finalScores),
      modeFinal: calculateMode(finalQuals),
      critStats: Object.fromEntries(
        Object.entries(critScores).map(([id, scores]) => [
          id,
          {
            mean: calculateMean(scores),
            median: calculateMedian(scores),
            mode: calculateMode(scores)
          }
        ])
      ),
      compStats: Object.fromEntries(
        Object.entries(compScores).map(([id, scores]) => [
          id,
          {
            mean: calculateMean(scores),
            median: calculateMedian(scores),
            mode: calculateMode(scores)
          }
        ])
      ),
      itemStats: Object.fromEntries(
        Object.entries(itemScores).map(([id, scores]) => [
          id,
          {
            mean: calculateMean(scores),
            median: calculateMedian(scores),
            mode: calculateMode(scores)
          }
        ])
      )
    };
  }, [students, studentGradesData, relevantCriteria, relevantCompetencies, activeSubject]);

  return (
    <div id="qualificacions-view-root" className="space-y-6">
      {/* Top Header & Context Selectors */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          {/* Subject & Period pickers */}
          <div className="flex flex-wrap items-center gap-3">
            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Assignatura</label>
              <select
                id="select-subject-qual"
                value={selectedSubId}
                onChange={(e) => setSelectedSubId(e.target.value)}
                className="text-xs font-bold p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer min-w-[220px]"
              >
                {validSubjects.map(sub => (
                  <option key={sub.id} value={sub.id}>
                    {sub.name} {sub.isParent ? '(Grup Mare)' : ''} ({sub.evaluationType === 'numeric' ? 'Numèrica' : 'Competencial'})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Període d'Avaluació</label>
              <select
                id="select-period-qual"
                value={selectedPeriodId}
                onChange={(e) => setSelectedPeriodId(e.target.value)}
                className="text-xs font-bold p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
              >
                {state.config.terms.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
                <option value="annual">Curs Anual (Global)</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Visualització Estadística</label>
              <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
                <button
                  onClick={() => setViewMetric('mean')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                    viewMetric === 'mean' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Mitjana
                </button>
                <button
                  onClick={() => setViewMetric('median')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                    viewMetric === 'median' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Mediana
                </button>
                <button
                  onClick={() => setViewMetric('mode')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                    viewMetric === 'mode' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Moda
                </button>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              id="btn-auto-calculate"
              onClick={handleAutoCalculate}
              className="flex items-center gap-1.5 px-3.5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all cursor-pointer"
              title="Calcula les qualificacions a partir de les activitats del període"
            >
              <Calculator className="w-4 h-4" />
              <span>Calcular Automàticament</span>
            </button>

            <button
              id="btn-recalculate"
              onClick={handleRecalculateDependent}
              className="flex items-center gap-1.5 px-3.5 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-bold rounded-xl transition-all cursor-pointer"
              title="Recalcula les columnes dependents conservant els canvis manuals"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Recalcular</span>
            </button>

            <button
              id="btn-clear-grades"
              onClick={handleClearAllGrades}
              className="flex items-center gap-1.5 px-3 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 text-xs font-bold rounded-xl transition-all cursor-pointer"
              title="Esborra totes les notes calculades"
            >
              <Trash2 className="w-4 h-4" />
              <span>Esborrar Notes</span>
            </button>

            <button
              id="btn-export-excel"
              onClick={handleExportExcel}
              className="flex items-center gap-1.5 px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all cursor-pointer"
              title="Descarrega la graella en format Excel (.xlsx)"
            >
              <Download className="w-4 h-4" />
              <span>Exportar Excel</span>
            </button>
          </div>
        </div>

        {/* Informative banner on calculation logic */}
        <div className="flex flex-wrap items-center justify-between bg-slate-50 border border-slate-200 rounded-xl p-3 text-[11px] text-slate-600 gap-2">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-blue-500 shrink-0" />
            <span>
              {isCompetencial ? (
                <>
                  Modalitat <strong>Competencial</strong>: Els criteris (escala 0-4) es ponderen segons el pes de l'activitat i del criteri. 
                  S'aplica el llindar de màx. <strong>{compSettings.maxFailedCompetencies ?? 'sense límit'} CE suspeses</strong> (si s'assoleix, la nota és <strong>NA</strong>).
                </>
              ) : (
                <>
                  Modalitat <strong>Numèrica</strong>: Les activitats es ponderen per cadascun dels items de l'assignatura. 
                  S'apliquen els percentatges dels items per a la nota final sobre 10.
                </>
              )}
            </span>
          </div>

          <div className="flex items-center gap-3 text-slate-500 font-medium">
            <span>Activitats del període: <b>{relevantActivities.length}</b></span>
            <span>Alumnes: <b>{students.length}</b></span>
          </div>
        </div>
      </div>

      {/* Main Interactive Evaluation Matrix Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto max-h-[650px] relative">
          <table className="w-full text-left border-collapse text-xs">
            {/* Header */}
            <thead className="bg-slate-50 text-slate-700 sticky top-0 z-10 border-b border-slate-200 shadow-sm">
              <tr>
                <th className="p-3 font-bold border-r border-slate-200 sticky left-0 bg-slate-50 z-20 min-w-[180px]">
                  Alumne ({students.length})
                </th>

                {/* Criteria Columns (if Competencial) */}
                {isCompetencial && relevantCriteria.map(cr => (
                  <th key={cr.id} className="p-2.5 font-bold border-r border-slate-200 min-w-[90px] text-center" title={`${cr.key}: ${cr.description}`}>
                    <div className="text-[11px] font-black text-indigo-700 font-mono">
                      {cr.shortLabel || cr.key}
                    </div>
                    <div className="text-[9px] text-slate-400 font-normal truncate max-w-[85px]">
                      {cr.key}
                    </div>
                  </th>
                ))}

                {/* Competency Columns (if Competencial) */}
                {isCompetencial && relevantCompetencies.map(cp => (
                  <th key={cp.id} className="p-2.5 font-bold border-r border-slate-200 min-w-[100px] text-center bg-indigo-50/40" title={`${cp.key}: ${cp.description}`}>
                    <div className="text-[11px] font-black text-indigo-900 font-mono">
                      {cp.key}
                    </div>
                    <div className="text-[9px] text-indigo-500 font-bold uppercase tracking-wider">
                      Comp. (0-4)
                    </div>
                  </th>
                ))}

                {/* Numeric items Columns (if Numeric) */}
                {!isCompetencial && (activeSubject?.numericItems || []).map(it => (
                  <th key={it.id} className="p-2.5 font-bold border-r border-slate-200 min-w-[110px] text-center bg-blue-50/40">
                    <div className="text-xs font-black text-blue-900">
                      {it.name}
                    </div>
                    <div className="text-[9px] text-blue-600 font-bold">
                      {it.weight}% nota
                    </div>
                  </th>
                ))}

                {/* Failed CE column if competencial */}
                {isCompetencial && (
                  <th className="p-2.5 font-bold border-r border-slate-200 min-w-[80px] text-center bg-rose-50/30">
                    <div className="text-[10px] font-black text-rose-700">CE Suspeses</div>
                    <div className="text-[8px] text-rose-500 font-semibold">(NA)</div>
                  </th>
                )}

                {/* Final Overall Grade */}
                <th className="p-3 font-bold text-center min-w-[130px] bg-slate-100">
                  <div className="text-xs font-black text-slate-900">Nota Final</div>
                  <div className="text-[9px] text-slate-500 font-semibold">
                    {viewMetric === 'mean' ? 'Mitjana' : viewMetric === 'median' ? 'Mediana' : 'Moda'}
                  </div>
                </th>
              </tr>
            </thead>

            {/* Body: Students Rows */}
            <tbody className="divide-y divide-slate-100 font-medium">
              {students.length === 0 ? (
                <tr>
                  <td colSpan={20} className="p-8 text-center text-slate-400 italic">
                    No hi ha cap alumne matriculat en aquest grup.
                  </td>
                </tr>
              ) : (
                students.map((st, sIdx) => {
                  const data = studentGradesData[st.id];
                  const finalScore = data?.finalGrade?.score;
                  const finalQual = data?.finalGrade?.qual || 'NA';
                  const isAutoFailed = data?.finalGrade?.autoFailed;
                  const failedCount = data?.finalGrade?.failedCECount ?? 0;

                  return (
                    <tr key={st.id} className="hover:bg-blue-50/30 transition-colors">
                      {/* Student info sticky cell */}
                      <td className="p-3 border-r border-slate-200 sticky left-0 bg-white z-10">
                        <div className="font-bold text-slate-800 text-xs truncate max-w-[170px]" title={st.name}>
                          {sIdx + 1}. {st.name}
                        </div>
                        <div className="text-[9px] font-mono text-slate-400">ID: {st.id}</div>
                      </td>

                      {/* Criteria scores */}
                      {isCompetencial && relevantCriteria.map(cr => {
                        const crData = data?.criteria?.[cr.id];
                        const score = crData?.score ?? 0;
                        const qual = crData?.qual || 'NA';
                        const isManual = crData?.isManual;

                        return (
                          <td 
                            key={cr.id} 
                            onClick={() => handleOpenCellEditor(st.id, st.name, 'criterion', cr.id, cr.shortLabel || cr.key, score, qual)}
                            className="p-2 border-r border-slate-150 text-center cursor-pointer hover:bg-indigo-50/60 transition-colors group relative"
                            title="Feu clic per modificar manualment"
                          >
                            <div className="flex flex-col items-center justify-center">
                              <span className="font-mono text-xs font-bold text-slate-700">
                                {score.toFixed(1)}
                              </span>
                              <span className={`text-[9px] font-extrabold px-1.5 py-0.2 rounded mt-0.5 ${QUAL_COLORS[qual as keyof typeof QUAL_COLORS]?.badge || 'bg-slate-100 text-slate-600'}`}>
                                {qual}
                              </span>
                            </div>
                            {isManual && (
                              <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-amber-500 rounded-full" title="Modificat manualment" />
                            )}
                          </td>
                        );
                      })}

                      {/* Competencies scores */}
                      {isCompetencial && relevantCompetencies.map(cp => {
                        const cpData = data?.competencies?.[cp.id];
                        const score = cpData?.score ?? 0;
                        const qual = cpData?.qual || 'NA';
                        const isManual = cpData?.isManual;

                        return (
                          <td 
                            key={cp.id}
                            onClick={() => handleOpenCellEditor(st.id, st.name, 'competency', cp.id, cp.key, score, qual)}
                            className="p-2 border-r border-slate-150 text-center cursor-pointer hover:bg-indigo-100/60 transition-colors bg-slate-50/30 group relative"
                            title="Feu clic per modificar manualment aquesta competència"
                          >
                            <div className="flex flex-col items-center justify-center">
                              <span className="font-mono text-xs font-black text-indigo-900">
                                {score.toFixed(2)}
                              </span>
                              <span className={`text-[9px] font-black px-2 py-0.5 rounded mt-0.5 ${QUAL_COLORS[qual as keyof typeof QUAL_COLORS]?.badge || 'bg-slate-100 text-slate-600'}`}>
                                {qual}
                              </span>
                            </div>
                            {isManual && (
                              <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-amber-500 rounded-full" title="Modificat manualment" />
                            )}
                          </td>
                        );
                      })}

                      {/* Numeric items */}
                      {!isCompetencial && (activeSubject?.numericItems || []).map(it => {
                        const itData = data?.items?.[it.id];
                        const score = itData?.score ?? 0;
                        const isManual = itData?.isManual;

                        return (
                          <td 
                            key={it.id}
                            onClick={() => handleOpenCellEditor(st.id, st.name, 'item', it.id, it.name, score)}
                            className="p-2 border-r border-slate-150 text-center cursor-pointer hover:bg-blue-100/60 transition-colors relative"
                            title="Feu clic per modificar manualment"
                          >
                            <span className="font-mono text-xs font-bold text-slate-800">
                              {score.toFixed(2)}
                            </span>
                            {isManual && (
                              <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-amber-500 rounded-full" title="Modificat manualment" />
                            )}
                          </td>
                        );
                      })}

                      {/* Failed CE count (if competencial) */}
                      {isCompetencial && (
                        <td className="p-2 border-r border-slate-150 text-center">
                          <span className={`inline-block font-mono font-black text-xs px-2 py-0.5 rounded ${
                            failedCount > 0 
                              ? isAutoFailed ? 'bg-rose-600 text-white animate-pulse' : 'bg-rose-100 text-rose-800'
                              : 'text-slate-400'
                          }`}>
                            {failedCount}
                          </span>
                        </td>
                      )}

                      {/* Final Overall Grade */}
                      <td 
                        onClick={() => handleOpenCellEditor(st.id, st.name, 'final', 'final', 'Nota Final', finalScore || 0, finalQual)}
                        className={`p-3 text-center cursor-pointer transition-all ${
                          isAutoFailed 
                            ? 'bg-rose-50 hover:bg-rose-100 border-l-2 border-rose-500' 
                            : 'bg-slate-50 hover:bg-slate-100'
                        }`}
                        title="Feu clic per forçar o editar la qualificació final"
                      >
                        <div className="flex flex-col items-center justify-center gap-1">
                          <div className="flex items-center gap-1">
                            <span className="font-mono font-black text-sm text-slate-900">
                              {typeof finalScore === 'number' ? finalScore.toFixed(2) : '-'}
                            </span>
                            {isAutoFailed && (
                              <span title="Límit de CE suspeses assolit: Qualificació NA directa"><AlertTriangle className="w-3.5 h-3.5 text-rose-600" aria-label="Límit de CE suspeses assolit: Qualificació NA directa" /></span>
                            )}
                          </div>

                          {isCompetencial ? (
                            <span className={`text-[10px] font-black px-2.5 py-0.5 rounded shadow-xs ${
                              QUAL_COLORS[finalQual as keyof typeof QUAL_COLORS]?.bg || 'bg-slate-400'
                            } text-white`}>
                              {finalQual}
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold text-slate-600 bg-white border border-slate-200 px-2 py-0.5 rounded">
                              {finalQual}
                            </span>
                          )}

                          {/* Extra statistics tooltip / helper */}
                          {data?.metrics && (
                            <span className="text-[8.5px] text-slate-400 font-mono">
                              Med: {data.metrics.median.toFixed(1)} | Mod: {data.metrics.mode}
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>

            {/* Bottom Summary Footer: Mitjana, Mediana i Moda totals */}
            <tfoot className="bg-slate-100 border-t-2 border-slate-300 font-bold text-slate-800 sticky bottom-0 z-10 shadow-md">
              {/* Row 1: MITJANA DEL GRUP */}
              <tr>
                <td className="p-2.5 border-r border-slate-300 sticky left-0 bg-slate-100 text-xs font-black">
                  Mitjana del grup
                </td>

                {isCompetencial && relevantCriteria.map(cr => (
                  <td key={cr.id} className="p-2 border-r border-slate-300 text-center font-mono text-xs">
                    {groupStats.critStats[cr.id]?.mean?.toFixed(2) ?? '-'}
                  </td>
                ))}

                {isCompetencial && relevantCompetencies.map(cp => (
                  <td key={cp.id} className="p-2 border-r border-slate-300 text-center font-mono text-xs text-indigo-900">
                    {groupStats.compStats[cp.id]?.mean?.toFixed(2) ?? '-'}
                  </td>
                ))}

                {!isCompetencial && (activeSubject?.numericItems || []).map(it => (
                  <td key={it.id} className="p-2 border-r border-slate-300 text-center font-mono text-xs text-blue-900">
                    {groupStats.itemStats[it.id]?.mean?.toFixed(2) ?? '-'}
                  </td>
                ))}

                {isCompetencial && <td className="p-2 border-r border-slate-300 text-center text-slate-400">-</td>}

                <td className="p-2.5 text-center font-mono text-sm font-black text-blue-700 bg-slate-200/80">
                  {groupStats.meanFinal?.toFixed(2) ?? '-'}
                </td>
              </tr>

              {/* Row 2: MEDIANA DEL GRUP */}
              <tr className="bg-slate-50">
                <td className="p-2 border-r border-slate-300 sticky left-0 bg-slate-50 text-[11px] font-bold text-slate-600">
                  Mediana del grup
                </td>

                {isCompetencial && relevantCriteria.map(cr => (
                  <td key={cr.id} className="p-1.5 border-r border-slate-300 text-center font-mono text-[11px] text-slate-600">
                    {groupStats.critStats[cr.id]?.median?.toFixed(2) ?? '-'}
                  </td>
                ))}

                {isCompetencial && relevantCompetencies.map(cp => (
                  <td key={cp.id} className="p-1.5 border-r border-slate-300 text-center font-mono text-[11px] text-indigo-700">
                    {groupStats.compStats[cp.id]?.median?.toFixed(2) ?? '-'}
                  </td>
                ))}

                {!isCompetencial && (activeSubject?.numericItems || []).map(it => (
                  <td key={it.id} className="p-1.5 border-r border-slate-300 text-center font-mono text-[11px] text-blue-700">
                    {groupStats.itemStats[it.id]?.median?.toFixed(2) ?? '-'}
                  </td>
                ))}

                {isCompetencial && <td className="p-1.5 border-r border-slate-300 text-center text-slate-400">-</td>}

                <td className="p-2 text-center font-mono text-xs font-bold text-indigo-700">
                  {groupStats.medianFinal?.toFixed(2) ?? '-'}
                </td>
              </tr>

              {/* Row 3: MODA DEL GRUP */}
              <tr className="bg-slate-50">
                <td className="p-2 border-r border-slate-300 sticky left-0 bg-slate-50 text-[11px] font-bold text-slate-600">
                  Moda del grup
                </td>

                {isCompetencial && relevantCriteria.map(cr => (
                  <td key={cr.id} className="p-1.5 border-r border-slate-300 text-center font-mono text-[11px] text-slate-600">
                    {groupStats.critStats[cr.id]?.mode ?? '-'}
                  </td>
                ))}

                {isCompetencial && relevantCompetencies.map(cp => (
                  <td key={cp.id} className="p-1.5 border-r border-slate-300 text-center font-mono text-[11px] text-indigo-700">
                    {groupStats.compStats[cp.id]?.mode ?? '-'}
                  </td>
                ))}

                {!isCompetencial && (activeSubject?.numericItems || []).map(it => (
                  <td key={it.id} className="p-1.5 border-r border-slate-300 text-center font-mono text-[11px] text-blue-700">
                    {groupStats.itemStats[it.id]?.mode ?? '-'}
                  </td>
                ))}

                {isCompetencial && <td className="p-1.5 border-r border-slate-300 text-center text-slate-400">-</td>}

                <td className="p-2 text-center font-mono text-xs font-bold text-emerald-700">
                  {groupStats.modeFinal ?? '-'}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Manual Cell Edit Modal */}
      {editingCell && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h4 className="font-extrabold text-sm text-slate-900">
                  Modificar Qualificació Manualment
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Alumne: <b>{editingCell.studentName}</b>
                </p>
              </div>
              <button
                onClick={() => setEditingCell(null)}
                className="text-xs text-slate-400 hover:text-slate-700 font-bold"
              >
                Tancar
              </button>
            </div>

            <form onSubmit={handleSaveCellEdit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">
                  Element: {editingCell.targetLabel} ({editingCell.type})
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max={isCompetencial ? "4" : "10"}
                    required
                    value={editInputScore}
                    onChange={(e) => {
                      const val = e.target.value;
                      setEditInputScore(val);
                      if (isCompetencial) {
                        setEditInputQual(scoreToCompetencial(parseFloat(val), compSettings.thresholds));
                      }
                    }}
                    className="w-full text-sm font-mono font-bold p-2.5 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-xs text-slate-400 font-bold font-mono">
                    /{isCompetencial ? '4.0' : '10.0'}
                  </span>
                </div>
              </div>

              {isCompetencial && (
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-2">
                    Qualificació Competencial (Assignació directa)
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {(['NA', 'AS', 'AN', 'AE'] as const).map(qual => (
                      <button
                        key={qual}
                        type="button"
                        onClick={() => {
                          setEditInputQual(qual);
                          setEditInputScore(String(compSettings.values[qual]));
                        }}
                        className={`py-2 text-xs font-black rounded-xl border transition-all ${
                          editInputQual === qual
                            ? `${QUAL_COLORS[qual].bg} text-white shadow-sm ring-2 ring-blue-400`
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        {qual}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingCell(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancel·lar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-sm cursor-pointer"
                >
                  Desar Canvi Manual
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
