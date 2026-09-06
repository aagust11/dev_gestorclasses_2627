/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  BookOpen, 
  Users, 
  Map, 
  Award, 
  ChevronRight, 
  Activity, 
  Settings2,
  ListCollapse,
  FolderTree,
  UserCheck
} from 'lucide-react';
import { AppState, Subject } from '../types';

interface ClassesViewProps {
  state: AppState;
  onNavigateToConfig: () => void;
  onNavigateToPlans: () => void;
}

export default function ClassesView({
  state,
  onNavigateToConfig,
  onNavigateToPlans
}: ClassesViewProps) {
  const [selectedSubIdForDrawer, setSelectedSubIdForDrawer] = useState<string | null>(null);

  // Helper to count students for a given subject
  const getStudentCount = (sub: Subject): number => {
    if (sub.isGeneral || sub.isParent) return 0;
    return sub.students.length;
  };

  // Helper to resolve direct students for drawer
  const getResolvedStudents = (sub: Subject): any[] => {
    if (sub.isGeneral || sub.isParent) return [];
    return sub.students;
  };

  // Total metrics
  const totalSubjects = state.subjects.length;
  const totalGeneralActions = state.subjects.filter(s => s.isGeneral).length;
  const totalActiveSubjects = totalSubjects - totalGeneralActions;
  
  // Unique students count
  const allPupilsSet = new Set<string>();
  state.subjects.forEach(s => {
    s.students.forEach(stud => allPupilsSet.add(stud.name));
  });
  const totalUniqueStudents = allPupilsSet.size;

  const totalSessionsLogged = state.sessionLogs.length;
  const totalSavedPlans = state.plans.length;

  const drawerSubject = state.subjects.find(s => s.id === selectedSubIdForDrawer) || null;

  return (
    <div id="classes-view-root" className="space-y-6">
      
      {/* Top statistics banners */}
      <div id="classes-kpi-grid" className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1 */}
        <div className="bg-white border border-slate-200 p-4.5 rounded-2xl shadow-sm flex items-center space-x-3.5">
          <div className="p-3 rounded-xl bg-blue-50 text-blue-650 flex-shrink-0">
            <BookOpen className="w-5.5 h-5.5" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Assignatures</span>
            <p className="text-xl font-black text-slate-800 tracking-tight leading-tight">{totalActiveSubjects}</p>
          </div>
        </div>

        {/* KPI 2 */}
        <div className="bg-white border border-slate-200 p-4.5 rounded-2xl shadow-sm flex items-center space-x-3.5">
          <div className="p-3 rounded-xl bg-sky-50 text-sky-655 flex-shrink-0">
            <Users className="w-5.5 h-5.5" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Alumnes Únics</span>
            <p className="text-xl font-black text-slate-800 tracking-tight leading-tight">{totalUniqueStudents}</p>
          </div>
        </div>

        {/* KPI 3 */}
        <div className="bg-white border border-slate-200 p-4.5 rounded-2xl shadow-sm flex items-center space-x-3.5">
          <div className="p-3 rounded-xl bg-emerald-50 text-emerald-650 flex-shrink-0">
            <UserCheck className="w-5.5 h-5.5" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Sessions Registrades</span>
            <p className="text-xl font-black text-slate-800 tracking-tight leading-tight">{totalSessionsLogged}</p>
          </div>
        </div>

        {/* KPI 4 */}
        <div className="bg-white border border-slate-200 p-4.5 rounded-2xl shadow-sm flex items-center space-x-3.5">
          <div className="p-3 rounded-xl bg-purple-50 text-purple-650 flex-shrink-0">
            <Map className="w-5.5 h-5.5" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider font-medium">Plànols Versions</span>
            <p className="text-xl font-black text-slate-800 tracking-tight leading-tight">{totalSavedPlans}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main List Column (2 spans) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between pb-4 mb-4 border-b">
              <h3 className="font-bold text-slate-900 text-sm">Directori d'Assignatures i Classes</h3>
              <button
                onClick={onNavigateToConfig}
                className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1"
              >
                <Settings2 className="w-3.5 h-3.5" />
                <span>Afegir nova</span>
              </button>
            </div>

            <div className="space-y-3">
              {state.subjects.length === 0 ? (
                <div className="py-12 text-center text-slate-400">
                  <p className="text-sm">Encara no teniu cap assignatura creada.</p>
                  <button onClick={onNavigateToConfig} className="mt-3 px-4 py-2 bg-blue-600 hover:bg-blue-750 text-white text-xs font-bold rounded-xl shadow-md cursor-pointer">
                    Començar curs
                  </button>
                </div>
              ) : (
                state.subjects.map(sub => {
                  const ownerId = sub.parentId || sub.id;
                  const studentCount = getStudentCount(sub);
                  const competenciesCount = state.competencies.filter(c => c.subjectId === ownerId).length;
                  const plansCount = state.plans.filter(p => p.subjectId === sub.id).length;
                  const parentSubject = sub.parentId ? state.subjects.find(parent => parent.id === sub.parentId) : null;

                  return (
                    <div
                      key={sub.id}
                      className="flex items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-xl hover:shadow-md transition-all duration-150"
                      style={{ borderLeft: `5px solid ${sub.color || '#cbd5e1'}` }}
                    >
                      <div className="space-y-1">
                        <div className="flex items-baseline space-x-1.5 flex-wrap gap-1">
                          <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded" style={{ color: sub.color, backgroundColor: `${sub.color}15` }}>
                            {sub.isGeneral ? 'General' : 'Grup'}
                          </span>
                          {parentSubject && (
                            <span className="text-[9px] font-bold text-blue-600 bg-blue-50 border border-blue-150 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                              <FolderTree className="w-2.5 h-2.5" />
                              <span>Heretat</span>
                            </span>
                          )}
                        </div>
                        <h4 className="text-sm font-bold text-slate-800 leading-tight pr-4">{sub.name}</h4>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10.5px] text-slate-450 font-medium">
                          <span>{sub.isGeneral ? 'Docent' : `${studentCount} Alumnes`}</span>
                          {competenciesCount > 0 && <span>• {competenciesCount} Competències</span>}
                          {plansCount > 0 && <span>• {plansCount} Plànols</span>}
                        </div>
                      </div>

                      <button
                        id={`btn-view-drawer-${sub.id}`}
                        onClick={() => setSelectedSubIdForDrawer(sub.id)}
                        className="p-2 hover:bg-slate-200 text-slate-500 hover:text-slate-800 rounded-xl transition-colors cursor-pointer"
                        title="Veure ràtio i competències específiques"
                      >
                        <ChevronRight className="w-5 h-5" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Dynamic Detail Panel Sidebar context (1 span) */}
        <div id="classes-details-sidebar" className="space-y-6">
          {drawerSubject ? (
            <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm space-y-6 animate-fadeIn">
              <div className="border-b pb-4">
                <div className="flex items-center space-x-1.5">
                  <span className="w-3.5 h-3.5 rounded-full inline-block" style={{ backgroundColor: drawerSubject.color }}></span>
                  <h3 className="font-bold text-slate-900 text-sm leading-tight pr-2">{drawerSubject.name}</h3>
                </div>
                {drawerSubject.isGeneral ? (
                  <p className="text-xs text-slate-500 mt-1">Acció docent general (sense grup d'alumnes)</p>
                ) : (
                  <p className="text-xs text-slate-500 mt-1">
                    Grup {drawerSubject.parentId ? 'Subgrup heretat' : 'Mòdul autònom'}
                  </p>
                )}
              </div>

              {/* Competencies summary */}
              {(() => {
                const ownerId = drawerSubject.parentId || drawerSubject.id;
                
                // Collect direct competencies
                const directComp = state.competencies.filter(c => c.subjectId === ownerId);
                // Collect inherited competencies if subgroup
                const inheritedComp: typeof state.competencies = [];

                return (
                  <div className="space-y-3">
                    <h4 className="text-[10px] uppercase font-extrabold tracking-wider text-slate-400 flex items-center gap-1">
                      <Award className="w-3.5 h-3.5 text-blue-500" />
                      <span>Competències de la matèria ({directComp.length + inheritedComp.length})</span>
                    </h4>
                    
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                      {directComp.map(c => (
                        <div key={c.id} className="text-xs p-2.5 bg-slate-50 border rounded-lg">
                          <span className="font-mono font-bold text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded mr-1">
                            {c.key}
                          </span>
                          <span className="text-slate-750 font-medium leading-relaxed">{c.description}</span>
                        </div>
                      ))}

                      {inheritedComp.map(c => (
                        <div key={c.id} className="text-xs p-2.5 bg-blue-500/[0.03] border border-blue-100 rounded-lg">
                          <span className="font-mono font-bold text-[10px] bg-slate-100 text-slate-500 border px-1.5 py-0.5 rounded mr-1" title="Competència heretada">
                            {c.key}
                          </span>
                          <span className="text-slate-600 italic leading-relaxed">{c.description}</span>
                        </div>
                      ))}

                      {directComp.length === 0 && inheritedComp.length === 0 && (
                        <p className="text-xs text-slate-400 italic text-center py-4">No s'han assignat competències.</p>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* Pupils List */}
              {!drawerSubject.isGeneral && (
                <div className="space-y-3 pt-4 border-t">
                  <h4 className="text-[10px] uppercase font-extrabold tracking-wider text-slate-400 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Roster d'Alumnat ({getResolvedStudents(drawerSubject).length})</span>
                  </h4>

                  <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1">
                    {getResolvedStudents(drawerSubject).map((stud) => (
                      <div key={stud.id} className="flex items-center space-x-2.5 p-2 bg-slate-50 rounded-lg text-xs text-slate-700">
                        <span className="w-5 h-5 bg-slate-200 rounded-full flex items-center justify-center text-[9px] font-bold text-slate-650">
                          {stud.name.substring(0, 1).toUpperCase()}
                        </span>
                        <span className="font-medium">{stud.name}</span>
                      </div>
                    ))}
                    {getResolvedStudents(drawerSubject).length === 0 && (
                      <p className="text-xs text-slate-450 text-center py-6 border-dashed border rounded-xl">Sense alumnes assignats.</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white border border-slate-200 p-8 text-center rounded-2xl shadow-sm text-slate-400">
              <Activity className="w-10 h-10 mx-auto text-slate-250 mb-2" />
              <p className="text-xs font-bold text-slate-700">Dades de Grup</p>
              <p className="text-[11px] text-slate-450 mt-1 max-w-[200px] mx-auto">
                Cliqueu sobre la fletxa d'un grup per revelar els seus alumnes, competències heretades, ràtio, i dades d'avaluació detallades d'aula.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
