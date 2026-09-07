import StudentName from './StudentName';
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  Plus, 
  Trash2, 
  Grid, 
  Map, 
  ArrowRightLeft, 
  Award, 
  UserPlus, 
  Save, 
  Layers, 
  LogOut,
  Sliders,
  AlertCircle,
  Lock,
  Unlock,
  Shuffle
} from 'lucide-react';
import { AppState, ClassroomPlanVersion, Subject, Student } from '../types';

interface PlansViewProps {
  state: AppState;
  onChangeState: (nextState: AppState) => void;
}

export default function PlansView({ state, onChangeState }: PlansViewProps) {
  const [activeSubjectId, setActiveSubjectId] = useState<string>('');
  const [activePlanId, setActivePlanId] = useState<string>('');
  const [showCreateForm, setShowCreateForm] = useState<boolean>(false);

  const [editGridRows, setEditGridRows] = useState<number>(5);
  const [editGridCols, setEditGridCols] = useState<number>(5);
  const [newPlanName, setNewPlanName] = useState<string>('');

  // Selected state helper values
  const subjectsWithStudents = state.subjects.filter(s => !s.isGeneral && !s.isParent);
  const selectedSubject = state.subjects.find(s => s.id === activeSubjectId) || null;

  // Resolve students
  const getSubjectStudents = (sub: Subject | null): Student[] => {
    if (!sub) return [];
    return sub.students;
  };

  // Extract the first name's initial letter (which sits after the comma)
  const getFirstNameInitial = (fullName: string): string => {
    if (!fullName) return '';
    const parts = fullName.split(',');
    if (parts.length > 1) {
      const firstName = parts[1].trim();
      return firstName ? firstName.charAt(0).toUpperCase() : '';
    }
    const trimmed = fullName.trim();
    return trimmed ? trimmed.charAt(0).toUpperCase() : '';
  };
  
  const students = getSubjectStudents(selectedSubject);

  // Filter plans corresponding to active subject
  const subjectPlans = state.plans.filter(p => p.subjectId === activeSubjectId);
  const activePlan = state.plans.find(p => p.id === activePlanId) || null;

  // Layout edit toggle state
  const [isEditMode, setIsEditMode] = useState<boolean>(false);
  // Empty cell clicked student search selector
  const [activeSearchCell, setActiveSearchCell] = useState<{ r: number; c: number } | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Selection target for seating
  // Track which student from unseated index is highlighted to seat next!
  const [selectedStudentToPlaceId, setSelectedStudentToPlaceId] = useState<string | null>(null);
  
  // Designate editor mode: 'seat' (for seating pupils) or 'desk' (to position the teacher's desk)
  const [editorPlacementMode, setEditorPlacementMode] = useState<'seat' | 'desk'>('seat');

  // Trigger creating a brand new seating layout plan version
  const handleCreatePlan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSubjectId || !newPlanName) return;

    const newVersion: ClassroomPlanVersion = {
      id: `plan_${Date.now()}`,
      subjectId: activeSubjectId,
      name: newPlanName,
      rows: editGridRows,
      cols: editGridCols,
      teacherDesk: { x: 0, y: Math.floor(editGridCols / 2) }, // center top standard
      seats: {}
    };

    const nextPlans = [...state.plans, newVersion];
    onChangeState({
      ...state,
      plans: nextPlans
    });

    setActivePlanId(newVersion.id);
    setNewPlanName('');
    setShowCreateForm(false);
  };

  const handleUpdatePlanDimensions = (rows: number, cols: number) => {
    if (!activePlan) return;
    
    // Purge any seats outside the next bounds
    const nextSeats = { ...activePlan.seats };
    Object.keys(nextSeats).forEach(key => {
      const [r, c] = key.split(',').map(Number);
      if (r >= rows || c >= cols) {
        delete nextSeats[key];
      }
    });

    // Check teacher desk
    let nextTeacherDesk = activePlan.teacherDesk;
    if (nextTeacherDesk && (nextTeacherDesk.x >= rows || nextTeacherDesk.y >= cols)) {
      nextTeacherDesk = { x: 0, y: Math.floor(cols / 2) };
    }

    const nextPlans = state.plans.map(p => 
      p.id === activePlan.id 
        ? { ...p, rows, cols, seats: nextSeats, teacherDesk: nextTeacherDesk } 
        : p
    );

    onChangeState({
      ...state,
      plans: nextPlans
    });
  };

  const handleRemovePlan = (planId: string) => {
    const nextPlans = state.plans.filter(p => p.id !== planId);
    onChangeState({
      ...state,
      plans: nextPlans
    });
    // Reset selection
    if (activePlanId === planId) {
      setActivePlanId(nextPlans.length > 0 ? nextPlans[0].id : '');
    }
  };

  // Toggling corridor rows/cols
  const handleToggleRowCorridor = (rIdx: number) => {
    if (!activePlan) return;
    const currentRows = activePlan.corridorRows || [];
    const nextRows = currentRows.includes(rIdx)
      ? currentRows.filter(r => r !== rIdx)
      : [...currentRows, rIdx];

    // Evacuate any seated students on this corridor row
    const nextSeats = { ...activePlan.seats };
    Object.keys(nextSeats).forEach(key => {
      const parts = key.split(',');
      if (parts.length === 2) {
        const r = parseInt(parts[0]);
        if (r === rIdx) {
          delete nextSeats[key];
        }
      }
    });

    const nextPlans = state.plans.map(p =>
      p.id === activePlan.id ? { ...p, corridorRows: nextRows, seats: nextSeats } : p
    );
    onChangeState({ ...state, plans: nextPlans });
  };

  const handleToggleColCorridor = (cIdx: number) => {
    if (!activePlan) return;
    const currentCols = activePlan.corridorCols || [];
    const nextCols = currentCols.includes(cIdx)
      ? currentCols.filter(c => c !== cIdx)
      : [...currentCols, cIdx];

    // Evacuate any seated students on this corridor column
    const nextSeats = { ...activePlan.seats };
    Object.keys(nextSeats).forEach(key => {
      const parts = key.split(',');
      if (parts.length === 2) {
        const c = parseInt(parts[1]);
        if (c === cIdx) {
          delete nextSeats[key];
        }
      }
    });

    const nextPlans = state.plans.map(p =>
      p.id === activePlan.id ? { ...p, corridorCols: nextCols, seats: nextSeats } : p
    );
    onChangeState({ ...state, plans: nextPlans });
  };

  // Seat unseated students randomly
  const handleSeatRandomly = () => {
    if (!activePlan) return;

    const activeSubStudents = state.subjects.find(s => s.id === activePlan.subjectId)?.students || [];
    if (activeSubStudents.length === 0) {
      alert("No hi ha alumnat assignat a aquesta matèria per seure.");
      return;
    }

    const confirmRand = window.confirm("Això reorganitzarà aleatòriament l'alumnat actualment assegut i no assegut d'aquest grup. Voleu continuar?");
    if (!confirmRand) return;

    // Shuffle a copy of students
    const shuffled = [...activeSubStudents].sort(() => Math.random() - 0.5);

    // Collect all cells that are NOT corridors and NOT teacher desk
    const validCells: { r: number; c: number }[] = [];
    for (let r = 0; r < activePlan.rows; r++) {
      if (activePlan.corridorRows?.includes(r)) continue;
      for (let c = 0; c < activePlan.cols; c++) {
        if (activePlan.corridorCols?.includes(c)) continue;
        if (activePlan.teacherDesk?.x === r && activePlan.teacherDesk?.y === c) continue;
        validCells.push({ r, c });
      }
    }

    const nextSeats: Record<string, string> = {};
    shuffled.forEach((student, idx) => {
      if (idx < validCells.length) {
        const cell = validCells[idx];
        nextSeats[`${cell.r},${cell.c}`] = student.id;
      }
    });

    const nextPlans = state.plans.map(p =>
      p.id === activePlan.id ? { ...p, seats: nextSeats } : p
    );
    onChangeState({ ...state, plans: nextPlans });
  };

  // Click handler to modify cell triggers
  const handleCellClick = (r: number, c: number) => {
    if (!activePlan) return;
    if (!isEditMode) return; // Prevent and protect against edits when view-only!

    const isCorridor = (activePlan.corridorRows?.includes(r)) || (activePlan.corridorCols?.includes(c));
    if (isCorridor) return; // Corridors cannot hold desks or chairs

    if (editorPlacementMode === 'desk') {
      // Toggle teacher desk to clicked coordinates
      const isCurrentlyDesk = activePlan.teacherDesk?.x === r && activePlan.teacherDesk?.y === c;
      const nextTeacherDesk = isCurrentlyDesk ? null : { x: r, y: c };
      
      const nextSeats = { ...activePlan.seats };
      delete nextSeats[`${r},${c}`];

      const nextPlans = state.plans.map(p => 
        p.id === activePlan.id 
          ? { ...p, teacherDesk: nextTeacherDesk, seats: nextSeats } 
          : p
      );
      onChangeState({ ...state, plans: nextPlans });
    } else {
      // Seating Mode!
      const cellKey = `${r},${c}`;

      // If cell matches coordinates of teacher desk, do not seat anyone
      if (activePlan.teacherDesk?.x === r && activePlan.teacherDesk?.y === c) {
        return; 
      }

      const nextSeats = { ...activePlan.seats };

      if (selectedStudentToPlaceId) {
        // Seat highlighted student
        Object.keys(nextSeats).forEach(key => {
          if (nextSeats[key] === selectedStudentToPlaceId) {
            delete nextSeats[key];
          }
        });

        nextSeats[cellKey] = selectedStudentToPlaceId;
        setSelectedStudentToPlaceId(null); // clear placement highlight
      } else {
        // No student chosen, open direct search selection inside the cell!
        setActiveSearchCell({ r, c });
        setSearchTerm('');
      }
    }
  };

  const handleRotate90 = () => {
    if (!activePlan) return;
    
    const R = activePlan.rows;
    const C = activePlan.cols;
    const oldSeats = activePlan.seats;
    const newSeats: Record<string, string> = {};

    Object.entries(oldSeats).forEach(([key, studentId]) => {
      const parts = key.split(',');
      if (parts.length !== 2) return;
      const r = parseInt(parts[0]);
      const c = parseInt(parts[1]);
      
      const newR = c;
      const newC = R - 1 - r;
      newSeats[`${newR},${newC}`] = studentId;
    });

    let nextTeacherDesk = null;
    if (activePlan.teacherDesk) {
      nextTeacherDesk = {
        x: activePlan.teacherDesk.y,
        y: R - 1 - activePlan.teacherDesk.x
      };
    }

    // Geometrical rotation of the corridors as well!
    const oldCorrRows = activePlan.corridorRows || [];
    const oldCorrCols = activePlan.corridorCols || [];

    // Col index 'c' becomes Row index 'newR = c'
    const nextCorrRows = oldCorrCols.map(c => c);
    // Row index 'r' becomes Col index 'newC = R - 1 - r'
    const nextCorrCols = oldCorrRows.map(r => R - 1 - r);

    const updatedPlan: ClassroomPlanVersion = {
      ...activePlan,
      rows: C,
      cols: R,
      teacherDesk: nextTeacherDesk,
      seats: newSeats,
      corridorRows: nextCorrRows,
      corridorCols: nextCorrCols
    };

    const nextPlans = state.plans.map(p => 
      p.id === activePlan.id ? updatedPlan : p
    );

    onChangeState({
      ...state,
      plans: nextPlans
    });
  };

  // Find students seated across the entire active layout
  const getSeatedIds = (plan: ClassroomPlanVersion | null): string[] => {
    if (!plan) return [];
    return Object.values(plan.seats);
  };

  const seatedStudentIds = getSeatedIds(activePlan);
  const unseatedStudents = students.filter(s => !seatedStudentIds.includes(s.id));

  return (
    <div id="plans-view-root" className="space-y-6">
      <div id="plans-selector-bar" className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Selector Header */}
        <div className="flex items-center space-x-4">
          <div className="bg-blue-50 text-blue-600 p-3 rounded-xl">
            <Map className="w-6 h-6" />
          </div>
          <div className="w-full md:w-64">
            <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1.5 tracking-wider">Assignatura / Curs</label>
            <select
              id="select-plan-subject"
              value={activeSubjectId}
              onChange={(e) => {
                setActiveSubjectId(e.target.value);
                const related = state.plans.filter(p => p.subjectId === e.target.value);
                setActivePlanId(related.length > 0 ? related[0].id : '');
                setSelectedStudentToPlaceId(null);
              }}
              className="w-full text-slate-800 text-sm p-2.5 border border-slate-200 rounded-xl bg-slate-50 font-bold focus:outline-none focus:bg-white"
            >
              <option value="">Selecciona grup...</option>
              {subjectsWithStudents.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Saved Layout versions select list */}
        {selectedSubject && (
          <div className="flex items-center gap-3">
            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1.5 tracking-wider">Versió de Plànol</label>
              <div className="flex items-center gap-2">
                <select
                  id="select-plan-version"
                  value={activePlanId}
                  onChange={(e) => {
                    setActivePlanId(e.target.value);
                    setSelectedStudentToPlaceId(null);
                  }}
                  className="text-slate-800 text-sm p-2.5 border border-slate-200 rounded-xl bg-slate-50 font-semibold md:w-56"
                >
                  <option value="" disabled>Triar versió...</option>
                  {subjectPlans.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                {activePlan && (
                  <button
                    id="btn-delete-plan"
                    onClick={() => handleRemovePlan(activePlan.id)}
                    className="p-2.5 bg-rose-50 text-rose-500 hover:bg-rose-100 rounded-xl hover:text-rose-600 border border-rose-200/50"
                    title="Eliminar aquesta versió"
                  >
                    <Trash2 className="w-4.5 h-4.5" />
                  </button>
                )}

                <button
                  id="btn-toggle-create-plan"
                  type="button"
                  onClick={() => setShowCreateForm(prev => !prev)}
                  className={`px-3.5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition-all cursor-pointer ${
                    showCreateForm
                      ? 'bg-rose-50 text-rose-600 border-rose-200 hover:bg-rose-100'
                      : 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700 shadow-md shadow-blue-600/10'
                  }`}
                  title="Afegir una nova versió de plànol de l'aula"
                >
                  <Plus className="w-4 h-4" />
                  <span>{showCreateForm ? 'Tancar Creador' : 'Afegir versió'}</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {selectedSubject && (
        <div className="space-y-6">
          
          {/* 1. Version Creator horizontal form if toggled */}
          {showCreateForm && (
            <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm space-y-4 animate-fadeIn">
              <div className="flex items-center justify-between border-b pb-3">
                <h3 className="font-extrabold text-slate-900 text-xs uppercase tracking-wider flex items-center gap-1.5 animate-pulse">
                  <Layers className="w-4 h-4 text-blue-500" />
                  <span>Crear Nova Versió</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="text-xs text-slate-450 hover:text-slate-700 font-bold"
                >
                  Tancar
                </button>
              </div>
              
              <form onSubmit={handleCreatePlan} className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
                <div>
                  <label className="block text-[10px] text-slate-500 font-bold mb-1.5">Nom del plànol</label>
                  <input
                    id="input-new-plan-name"
                    required
                    placeholder="ex. Disposició d'Exàmens, Grups de 4"
                    value={newPlanName}
                    onChange={(e) => setNewPlanName(e.target.value)}
                    className="w-full text-xs p-3 border border-slate-200 bg-slate-50 hover:bg-slate-100 rounded-xl focus:outline-none focus:bg-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] text-slate-500 font-bold mb-1.5">Files ({editGridRows})</label>
                    <input
                      type="range"
                      min={3}
                      max={10}
                      value={editGridRows}
                      onChange={(e) => setEditGridRows(parseInt(e.target.value))}
                      className="w-full h-1.5 accent-blue-600 cursor-pointer bg-slate-100 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-500 font-bold mb-1.5">Columnes ({editGridCols})</label>
                    <input
                      type="range"
                      min={3}
                      max={10}
                      value={editGridCols}
                      onChange={(e) => setEditGridCols(parseInt(e.target.value))}
                      className="w-full h-1.5 accent-blue-600 cursor-pointer bg-slate-100 rounded-lg"
                    />
                  </div>
                </div>

                <button
                  id="btn-add-plan-version"
                  type="submit"
                  className="w-full flex items-center justify-center space-x-1 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl transition-all cursor-pointer shadow-md shadow-blue-600/10"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Crear Plànol</span>
                </button>
              </form>
            </div>
          )}

          {/* 2. Horizontal placement dock of Unseated Pupils */}
          {activePlan && unseatedStudents.length > 0 && (
            <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm space-y-3.5">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                <div className="flex items-center space-x-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
                  <h3 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider">
                    Alumnat sense lloc ({unseatedStudents.length})
                  </h3>
                </div>
                <p className="text-[10.5px] text-slate-450">
                  Cliqueu sobre un alumne i deprés sobre qualsevol seient verd a la graella.
                </p>
              </div>

              <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto pr-1">
                {unseatedStudents.map(student => {
                  const isSelected = selectedStudentToPlaceId === student.id;
                  return (
                    <button
                      key={student.id}
                      id={`unseated-student-${student.id}`}
                      onClick={() => {
                        setEditorPlacementMode('seat');
                        setSelectedStudentToPlaceId(isSelected ? null : student.id);
                      }}
                      className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-semibold select-none border cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-amber-100 border-amber-300 text-amber-950 shadow-md shadow-amber-100/30'
                          : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <span className="truncate max-w-[120px]"><StudentName state={state} student={student}/></span>
                      <span className="text-[9px] font-extrabold text-slate-400 uppercase">Seure</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Interactive Classroom Grid layout: Now occupies 100% full width */}
          <div className="w-full">
            {activePlan ? (
              <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm space-y-6">
                
                {/* Mode Selectors */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-slate-100 gap-4">
                  <div className="space-y-0.5">
                    <h2 className="font-bold text-slate-900 text-base">{activePlan.name}</h2>
                    <p className="text-xs text-slate-500">
                      Disposició de graella de {activePlan.rows} × {activePlan.cols} cel·les
                    </p>
                  </div>

                  <div className="flex items-center flex-wrap gap-2 z-10">
                    <button
                      id="btn-toggle-edit-mode"
                      type="button"
                      onClick={() => {
                        setIsEditMode(prev => !prev);
                        setActiveSearchCell(null);
                        setSelectedStudentToPlaceId(null);
                      }}
                      className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                        isEditMode
                          ? 'bg-amber-100 border-amber-300 text-amber-800'
                          : 'bg-slate-100 border-slate-200 text-slate-705 hover:bg-slate-200'
                      }`}
                      title={isEditMode ? "Desactivar edició per evitar canvis accidentals" : "Activar edició del plànol de l'aula"}
                    >
                      {isEditMode ? <Unlock className="w-3.5 h-3.5 text-amber-600" /> : <Lock className="w-3.5 h-3.5 text-slate-500" />}
                      <span>{isEditMode ? 'Edició Activa (Desdesa)' : 'Activar Edició'}</span>
                    </button>

                    {isEditMode && (
                      <button
                        id="btn-seat-randomly"
                        type="button"
                        onClick={handleSeatRandomly}
                        className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-indigo-50 text-indigo-700 hover:bg-slate-100 border border-indigo-200 transition-all cursor-pointer"
                        title="Seure aleatòriament a tot l'alumnat disponible"
                      >
                        <Shuffle className="w-3.5 h-3.5 text-indigo-500" />
                        <span>Seure Aleatori</span>
                      </button>
                    )}

                    <button
                      id="btn-rotate-95"
                      type="button"
                      onClick={handleRotate90}
                      className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-150 transition-colors cursor-pointer"
                      title="Rotar plànol de l'aula 90 graus"
                    >
                      <ArrowRightLeft className="w-3.5 h-3.5" />
                      <span>Rotar 90º</span>
                    </button>

                    {isEditMode && (
                      <div className="flex items-center space-x-2 bg-slate-100 p-1 rounded-xl">
                        <button
                          id="btn-mode-placement"
                          type="button"
                          onClick={() => {
                            setEditorPlacementMode('seat');
                            setSelectedStudentToPlaceId(null);
                          }}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            editorPlacementMode === 'seat'
                              ? 'bg-white text-slate-900 shadow-sm'
                              : 'text-slate-500 hover:text-slate-800'
                          }`}
                        >
                          Seure Alumnes
                        </button>
                        
                        <button
                          id="btn-mode-desk"
                          type="button"
                          onClick={() => {
                            setEditorPlacementMode('desk');
                            setSelectedStudentToPlaceId(null);
                          }}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            editorPlacementMode === 'desk'
                              ? 'bg-white text-blue-700 shadow-sm font-semibold'
                              : 'text-slate-500 hover:text-blue-600'
                          }`}
                        >
                          Moure Taula Profe
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Live Seating Table Grid visualization */}
                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-150 flex flex-row items-start justify-center overflow-auto">
                  
                  {/* Left row corridors toggles (only when isEditMode is active) */}
                  {isEditMode && (
                    <div 
                      className="grid gap-3.5 mr-3.5 pr-3.5 border-r border-slate-200"
                      style={{
                        gridTemplateRows: Array.from({ length: activePlan.rows })
                          .map((_, r) => activePlan.corridorRows?.includes(r) ? '24px' : 'minmax(84px, 1fr)')
                          .join(' '),
                        gridTemplateColumns: 'minmax(0, 1fr)'
                      }}
                    >
                      {Array.from({ length: activePlan.rows }).map((_, rIdx) => {
                        const isCor = activePlan.corridorRows?.includes(rIdx);
                        return (
                          <button
                            key={rIdx}
                            type="button"
                            onClick={() => handleToggleRowCorridor(rIdx)}
                            className={`px-1.5 py-1.5 rounded-lg text-[9px] font-extrabold flex flex-col items-center justify-center transition-all cursor-pointer border ${
                              isCor
                                ? 'bg-amber-100 text-amber-700 border-amber-300 shadow-sm'
                                : 'bg-slate-200 text-slate-500 hover:bg-slate-300 border-slate-200'
                            }`}
                            title={isCor ? "Tornar a posar cadires a la fila" : "Marcar Fila com a Passadís"}
                          >
                            FILA
                            <span className="text-[8px] font-bold block mt-0.5">{isCor ? 'PASS' : 'TAULA'}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  <div className="flex-1 flex flex-col w-full">
                    {/* Top Column corridors toggles (only when isEditMode is active) */}
                    {isEditMode && (
                      <div 
                        className="grid gap-3.5 mb-3.5 pb-3.5 border-b border-slate-200"
                        style={{
                          gridTemplateColumns: Array.from({ length: activePlan.cols })
                            .map((_, c) => activePlan.corridorCols?.includes(c) ? '24px' : 'minmax(120px, 1fr)')
                            .join(' ')
                        }}
                      >
                        {Array.from({ length: activePlan.cols }).map((_, cIdx) => {
                          const isCor = activePlan.corridorCols?.includes(cIdx);
                          return (
                            <button
                              key={cIdx}
                              type="button"
                              onClick={() => handleToggleColCorridor(cIdx)}
                              className={`py-1 rounded-lg text-[9px] font-extrabold transition-all text-center leading-tight cursor-pointer border ${
                                isCor
                                  ? 'bg-amber-100 text-amber-700 border-amber-300 shadow-sm'
                                  : 'bg-slate-200 text-slate-500 hover:bg-slate-300 border-slate-200'
                              }`}
                              title={isCor ? "Tornar a posar cadires a la columna" : "Marcar Columna com a Passadís"}
                            >
                              COL
                              <span className="text-[8px] font-bold block mt-0.5">{isCor ? 'PASS' : 'TAULA'}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* CSS Grid of the classroom space */}
                    <div 
                      className="grid gap-3.5 w-full"
                      style={{ 
                        gridTemplateRows: Array.from({ length: activePlan.rows })
                          .map((_, r) => activePlan.corridorRows?.includes(r) ? '24px' : 'minmax(84px, 1fr)')
                          .join(' '),
                        gridTemplateColumns: Array.from({ length: activePlan.cols })
                          .map((_, c) => activePlan.corridorCols?.includes(c) ? '24px' : 'minmax(120px, 1fr)')
                          .join(' ')
                      }}
                    >
                      {Array.from({ length: activePlan.rows }).map((_, rIdx) => (
                        Array.from({ length: activePlan.cols }).map((_, cIdx) => {
                          const cellKey = `${rIdx},${cIdx}`;
                          const isTeacherDesk = activePlan.teacherDesk?.x === rIdx && activePlan.teacherDesk?.y === cIdx;
                          const studentId = activePlan.seats[cellKey];
                          const seatedStudent = students.find(s => s.id === studentId);
                          
                          const isRowCor = activePlan.corridorRows?.includes(rIdx);
                          const isColCor = activePlan.corridorCols?.includes(cIdx);
                          const isCorr = isRowCor || isColCor;

                          // Corridor visualization
                          if (isCorr) {
                            return (
                              <div
                                key={cellKey}
                                className="h-full min-h-[24px] w-full rounded-lg bg-orange-50/50 border border-amber-200/40 border-dashed flex items-center justify-center text-[8px] font-bold text-amber-600/70 select-none relative"
                                title="Fila o columna reservada com a passadís lliure de seients"
                              >
                                <span className="rotate-90 sm:rotate-0 tracking-widest text-[7px] uppercase opacity-75">Passadís</span>
                              </div>
                            );
                          }

                          const isSearchingThisCell = activeSearchCell?.r === rIdx && activeSearchCell?.c === cIdx;

                          if (isSearchingThisCell) {
                            return (
                              <div 
                                key={cellKey}
                                className="min-h-[140px] w-full bg-slate-50 border-2 border-indigo-500 rounded-xl p-2 text-center relative z-30 shadow-xl flex flex-col gap-1.5"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <div className="flex items-center justify-between gap-1">
                                  <span className="text-[8px] font-bold text-slate-400">Plaça {rIdx+1}-{cIdx+1}</span>
                                  <button
                                    onClick={() => {
                                      setActiveSearchCell(null);
                                      setSearchTerm('');
                                    }}
                                    className="text-[10px] text-slate-450 hover:text-rose-600 font-extrabold cursor-pointer"
                                  >
                                    ×
                                  </button>
                                </div>
                                <input
                                  type="text"
                                  autoFocus
                                  required
                                  value={searchTerm}
                                  placeholder="Escriu per cercar..."
                                  onChange={(e) => setSearchTerm(e.target.value)}
                                  className="w-full text-xs p-1.5 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:bg-white focus:ring-1 focus:ring-indigo-400 font-bold"
                                />
                                <div className="flex-1 overflow-y-auto max-h-[85px] divide-y divide-slate-150 border rounded-lg bg-white">
                                  {studentId && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const nextSeats = { ...activePlan.seats };
                                        delete nextSeats[cellKey];
                                        const nextPlans = state.plans.map(p =>
                                          p.id === activePlan.id ? { ...p, seats: nextSeats } : p
                                        );
                                        onChangeState({ ...state, plans: nextPlans });
                                        setActiveSearchCell(null);
                                      }}
                                      className="w-full text-left text-rose-600 hover:bg-rose-55 text-[10px] p-1.5 font-extrabold rounded select-none cursor-pointer"
                                    >
                                      Alliberar seient ❌
                                    </button>
                                  )}
                                  {students
                                    .filter(st => st.name.toLowerCase().includes(searchTerm.toLowerCase()))
                                    .map(st => {
                                      const isAlreadySeated = seatedStudentIds.includes(st.id);
                                      return (
                                        <button
                                          key={st.id}
                                          type="button"
                                          onClick={() => {
                                            const nextSeats = { ...activePlan.seats };
                                            Object.keys(nextSeats).forEach(key => {
                                              if (nextSeats[key] === st.id) {
                                                delete nextSeats[key];
                                              }
                                            });
                                            nextSeats[cellKey] = st.id;
                                            const nextPlans = state.plans.map(p =>
                                              p.id === activePlan.id ? { ...p, seats: nextSeats } : p
                                            );
                                            onChangeState({ ...state, plans: nextPlans });
                                            setActiveSearchCell(null);
                                            setSearchTerm('');
                                          }}
                                          className="w-full text-left font-bold text-slate-700 hover:bg-slate-55 text-[10px] p-1.5 block truncate cursor-pointer"
                                        >
                                          <StudentName state={state} student={st}/> {isAlreadySeated ? '🔄 (Moure)' : ''}
                                        </button>
                                      );
                                    })}
                                  {students.filter(st => st.name.toLowerCase().includes(searchTerm.toLowerCase())).length === 0 && (
                                    <span className="text-[9px] text-slate-400 p-1.5 block">Arxiu buit</span>
                                  )}
                                </div>
                              </div>
                            );
                          }

                          return (
                            <div 
                              key={cellKey}
                              id={`grid-cell-${cellKey}`}
                              onClick={() => handleCellClick(rIdx, cIdx)}
                              className={`min-h-[84px] w-full rounded-xl border flex flex-col items-center justify-between p-2 text-center transition-all duration-150 relative group cursor-pointer ${
                                isTeacherDesk
                                  ? 'bg-blue-600 border-blue-750 text-white shadow-md font-bold'
                                  : seatedStudent
                                    ? 'bg-white border-slate-200 text-slate-800 shadow-sm hover:border-slate-350'
                                    : 'bg-emerald-500/5 border-dashed border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10'
                              }`}
                            >
                              {isTeacherDesk ? (
                                <div className="space-y-0.5 my-auto">
                                  <span className="text-[8px] tracking-widest font-extrabold uppercase bg-white/10 px-1 py-0.5 rounded">Tutor</span>
                                  <p className="text-[11px] sm:text-xs font-extrabold font-sans">Taula Docent</p>
                                </div>
                              ) : seatedStudent ? (
                                <div className="w-full flex flex-col justify-between h-full relative">
                                  <div className="flex items-center justify-between w-full">
                                    <span className="text-[8px] font-bold text-slate-400 font-mono text-left block">
                                      {rIdx + 1}-{cIdx + 1}
                                    </span>
                                    {getFirstNameInitial(seatedStudent.name) && (
                                      <span className="flex items-center justify-center w-5 h-5 rounded-full bg-slate-100 border border-slate-250 text-[10px] font-extrabold text-slate-700 shrink-0 select-none font-sans" title={seatedStudent.name}>
                                        {getFirstNameInitial(seatedStudent.name)}
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-[10.5px] font-bold text-slate-800 tracking-tight leading-tight break-all sm:break-normal line-clamp-2 px-0.5 my-auto font-sans">
                                    <StudentName state={state} student={seatedStudent}/>
                                  </p>
                                  {isEditMode ? (
                                    <button 
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        const nextSeats = { ...activePlan.seats };
                                        delete nextSeats[cellKey];
                                        const nextPlans = state.plans.map(p =>
                                          p.id === activePlan.id ? { ...p, seats: nextSeats } : p
                                        );
                                        onChangeState({ ...state, plans: nextPlans });
                                      }}
                                      className="text-[8px] font-black text-rose-500 opacity-60 group-hover:opacity-100 hover:text-rose-700 block transition-opacity text-right font-sans uppercase shrink-0"
                                    >
                                      Alliberar ×
                                    </button>
                                  ) : (
                                    <span className="text-[8px] font-bold text-slate-400 block font-mono text-right">
                                      {rIdx + 1}-{cIdx + 1}
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <div className="space-y-0.5 my-auto">
                                  <span className="text-[8px] font-bold opacity-40 font-mono block">
                                    {rIdx + 1}-{cIdx + 1}
                                  </span>
                                  {isEditMode && (
                                    <span className="text-[9px] tracking-tight font-extrabold text-emerald-600 block bg-emerald-50 px-1 py-0.5 rounded leading-tight">Assignar</span>
                                  )}
                                </div>
                              )}

                              {/* Direct Indicator of selected highlight placement */}
                              {selectedStudentToPlaceId && !isTeacherDesk && !studentId && (
                                <div className="absolute inset-0 bg-amber-500/10 border-2 border-amber-400 border-dashed rounded-xl animate-pulse flex items-center justify-center">
                                  <span className="text-[10px] font-extrabold text-amber-700 uppercase">Seure</span>
                                </div>
                              )}
                            </div>
                          );
                        })
                      ))}
                    </div>
                  </div>
                </div>

                {/* Bottom sliders for resizing grid of active version (only in edit mode) */}
                {isEditMode && (
                  <div className="bg-slate-50 p-4 border border-slate-150 rounded-xl flex flex-wrap gap-6 items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="flex items-center space-x-2">
                        <Sliders className="w-4.5 h-4.5 text-slate-400" />
                        <span className="text-xs font-bold text-slate-700">Mida de la Graella de l'Aula:</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <label className="text-[11px] text-slate-500 font-medium whitespace-nowrap">
                          Files:
                          <select
                            value={activePlan.rows}
                            onChange={(e) => handleUpdatePlanDimensions(parseInt(e.target.value), activePlan.cols)}
                            className="ml-1 text-xs border bg-white p-1 rounded font-bold"
                          >
                            {[3,4,5,6,7,8,9,10,11,12].map(n => <option key={n} value={n}>{n}</option>)}
                          </select>
                        </label>
                        <label className="text-[11px] text-slate-500 font-medium whitespace-nowrap">
                          Columnes:
                          <select
                            value={activePlan.cols}
                            onChange={(e) => handleUpdatePlanDimensions(activePlan.rows, parseInt(e.target.value))}
                            className="ml-1 text-xs border bg-white p-1 rounded font-bold"
                          >
                            {[3,4,5,6,7,8,9,10,11,12].map(n => <option key={n} value={n}>{n}</option>)}
                          </select>
                        </label>
                      </div>
                    </div>
                    <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Desat automàtic actiu</span>
                  </div>
                )}

              </div>
            ) : (
              <div className="bg-white border border-slate-200 p-12 text-center rounded-2xl shadow-sm text-slate-400">
                <Grid className="w-12 h-12 mx-auto text-slate-250 mb-3" />
                <p className="text-sm font-bold text-slate-705">Aquest grup encara no té cap plànol definit</p>
                <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
                  Cliqueu el botó "Afegir versió" a dalt per crear un esquema de taules i cadires.
                </p>
              </div>
            )}
          </div>
          
        </div>
      )}

      {/* Default placeholder if no subject selected */}
      {!activeSubjectId && (
        <div className="bg-white border border-slate-200 p-12 text-center rounded-2xl shadow-sm text-slate-400">
          <Map className="w-12 h-12 mx-auto text-slate-250 mb-3" />
          <h3 className="text-sm font-bold text-slate-700">Seleccioneu una assignatura per començar</h3>
          <p className="text-xs text-slate-450 mt-1 max-w-sm mx-auto leading-relaxed">
            Dissenyeu mapes de distribució dels alumnes a l'aula (Laboratory, Exàmens, Grups). Seleccioneu un curs de la llista per començar.
          </p>
        </div>
      )}
    </div>
  );
}
