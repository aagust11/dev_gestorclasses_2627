/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  CalendarRange, 
  Info, 
  GraduationCap, 
  Settings2,
  CalendarCheck,
  RefreshCw,
  Plus,
  Trash2,
  X,
  Edit2,
  AlertCircle,
  ClipboardList
} from 'lucide-react';
import { AppState, ScheduleItem, Subject, TimeSlot, ScheduleSubstitution } from '../types';
import { 
  getMonday, 
  getWeekDays, 
  toIsoDate, 
  formatCatalanDate, 
  getHolidayForDate, 
  getTermForDate,
  formatCatalanShortDate,
  getOngoingActivitiesForSession,
  getLastDayBeforeDeliveryActivities
} from '../utils/dateHelpers';

interface HorariViewProps {
  state: AppState;
  onSelectSession: (scheduleItemId: string, date: string) => void;
  onNavigateToConfig: () => void;
  onChangeState: (nextState: AppState) => void;
}

export default function HorariView({
  state,
  onSelectSession,
  onNavigateToConfig,
  onChangeState
}: HorariViewProps) {
  // Navigation base date
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  
  // Calculate Monday of current week
  const mondayOfSelectedWeek = getMonday(new Date(currentDate));
  const weekDays = getWeekDays(mondayOfSelectedWeek);
  
  // Formatted date range helper
  const firstDayStr = formatCatalanShortDate(toIsoDate(weekDays[0]));
  const lastDayStr = formatCatalanShortDate(toIsoDate(weekDays[4]));

  const handlePrevWeek = () => {
    const prev = new Date(currentDate);
    prev.setDate(currentDate.getDate() - 7);
    setCurrentDate(prev);
  };

  const handleNextWeek = () => {
    const next = new Date(currentDate);
    next.setDate(currentDate.getDate() + 7);
    setCurrentDate(next);
  };

  const handleGoToToday = () => {
    setCurrentDate(new Date());
  };

  // Find subject details
  const getSubject = (subId: string): Subject | null => {
    return state.subjects.find(s => s.id === subId) || null;
  };

  // Find parent subject
  const getParentSubject = (sub: Subject): Subject | null => {
    if (!sub.parentId) return null;
    return state.subjects.find(s => s.id === sub.parentId) || null;
  };

  // Render the timetable grid
  return (
    <div id="horari-view-root" className="space-y-6">
      {/* Top Header Controls */}
      <div id="horari-nav-header" className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
        <div className="flex items-center space-x-4">
          <div className="bg-sky-50 text-sky-600 p-3 rounded-xl">
            <CalendarRange className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">Horari de Classes</h2>
            <p className="text-sm font-medium text-slate-500">
              Setmana del <span className="text-slate-800 font-semibold">{firstDayStr}</span> al <span className="text-slate-800 font-semibold">{lastDayStr}</span>
            </p>
          </div>
        </div>

        {/* Date Navigation Buttons */}
        <div className="flex items-center gap-2">
          <button
            id="btn-prev-week"
            onClick={handlePrevWeek}
            className="flex items-center justify-center p-2 rounded-xl text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors"
            title="Setmana anterior"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          
          <button
            id="btn-goto-today"
            onClick={handleGoToToday}
            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors"
          >
            Avui
          </button>

          <button
            id="btn-next-week"
            onClick={handleNextWeek}
            className="flex items-center justify-center p-2 rounded-xl text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors"
            title="Setmana següent"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Course limits check */}
      {(() => {
        const monIso = toIsoDate(weekDays[0]);
        const friIso = toIsoDate(weekDays[4]);
        const start = state.config.startDate;
        const end = state.config.endDate;
        if (friIso < start || monIso > end) {
          return (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start space-x-3 text-amber-800">
              <Info className="w-5 h-5 flex-shrink-0 mt-0.5 text-amber-600" />
              <div>
                <h3 className="font-bold text-sm">Fora del calendari lectiu</h3>
                <p className="text-xs text-amber-700/90 mt-0.5">
                  Aquesta setmana es troba fora de les dates configurades del curs escolar ({formatCatalanShortDate(start)} - {formatCatalanShortDate(end)}). Podeu reconfigurar-ho als paràmetres.
                </p>
              </div>
            </div>
          );
        }
        return null;
      })()}

      {/* Main Timetable Matrix */}
      <div id="timetable-scroller" className="overflow-x-auto bg-white border border-slate-200/80 rounded-2xl shadow-sm">
        <table className="w-full border-collapse min-w-[800px]">
          {/* Header Row: Weekdays + exact dates */}
          <thead>
            <tr className="border-b border-slate-150 bg-slate-50/50">
              <th className="p-4 text-xs font-bold uppercase tracking-wider text-slate-400 text-left w-32 border-r border-slate-150">
                Hora / Franja
              </th>
              {weekDays.map((day, idx) => {
                const iso = toIsoDate(day);
                const holiday = getHolidayForDate(iso, state.config.holidays);
                const term = getTermForDate(iso, state.config.terms);
                const isToday = toIsoDate(new Date()) === iso;
                
                return (
                  <th 
                    key={idx} 
                    className={`p-4 text-left border-r border-slate-150 last:border-r-0 relative ${
                      isToday ? 'bg-sky-500/5' : ''
                    }`}
                  >
                    <div className="flex items-baseline justify-between">
                      <span className={`text-sm font-bold ${isToday ? 'text-sky-600' : 'text-slate-800'}`}>
                        {['Dilluns', 'Dimarts', 'Dimecres', 'Dijous', 'Divendres'][idx]}
                      </span>
                      {term && (
                        <span className="text-[10px] tracking-tight bg-slate-100 text-slate-500 font-semibold px-2 py-0.5 rounded-full">
                          {term.name}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <span className={`text-xs ${isToday ? 'text-sky-500 font-semibold bg-sky-100 px-2 py-0.5 rounded-md' : 'text-slate-400'}`}>
                        {formatCatalanShortDate(iso)}
                      </span>
                      {holiday && (
                        <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded border border-amber-200 animate-pulse">
                          Festiu
                        </span>
                      )}
                    </div>
                    {isToday && (
                      <div className="absolute top-0 left-0 right-0 h-1 bg-sky-500 rounded-t-lg"></div>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          
          {/* Table Body: Slots and Assignments */}
          <tbody>
            {state.config.timeSlots.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-8 text-center">
                  <div className="max-w-md mx-auto py-6 flex flex-col items-center">
                    <Settings2 className="w-8 h-8 text-slate-300 mb-2" />
                    <p className="text-sm font-bold text-slate-700">No hi ha hores configurades</p>
                    <p className="text-xs text-slate-500 mt-1 mb-4 leading-relaxed">
                      Encara no heu creat cap franja horària. Aneu a la configuració del curs per configurar les hores.
                    </p>
                    <button
                      onClick={onNavigateToConfig}
                      className="px-4 py-2 bg-sky-500 hover:bg-sky-600 font-semibold text-xs text-white rounded-xl shadow-md transition-all shadow-sky-500/10"
                    >
                      Configurar Franges
                    </button>
                  </div>
                </td>
              </tr>
            ) : (
              state.config.timeSlots.map((slot) => (
                <tr key={slot.id} className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50/20 transition-colors">
                  {/* Time label column */}
                  <td className="p-4 border-r border-slate-150 align-top">
                    <p className="text-xs font-bold text-slate-700">{slot.name}</p>
                    {slot.startTime && slot.endTime && (
                      <p className="text-[10px] font-mono font-medium text-slate-400 mt-1">
                        {slot.startTime} - {slot.endTime}
                      </p>
                    )}
                  </td>

                  {/* 5 weekday columns */}
                  {weekDays.map((day, dayIdx) => {
                    const dayNum = dayIdx + 1; // 1 = Monday ... 5 = Friday
                    const dIso = toIsoDate(day);
                    const holiday = getHolidayForDate(dIso, state.config.holidays);
                    
                    // Retrieve relative schedule item
                    const sItem = state.schedule.find(
                      item => item.dayOfWeek === dayNum && item.timeSlotId === slot.id
                    );
                    const subject = sItem ? getSubject(sItem.subjectId) : null;
                    const parentSubject = subject ? getParentSubject(subject) : null;
                    const isToday = toIsoDate(new Date()) === dIso;

                    // If holiday, shade the entire cell beautifully
                    if (holiday) {
                      return (
                        <td 
                          key={dayIdx} 
                          className={`p-3 border-r border-slate-150 last:border-r-0 align-middle bg-amber-500/[0.02] ${
                            isToday ? 'bg-sky-500/5' : ''
                          }`}
                        >
                          <div className="flex flex-col items-center justify-center py-4 bg-amber-50/50 border border-amber-200/50 border-dashed rounded-xl p-2.5">
                            <span className="text-[10px] uppercase tracking-wider font-extrabold text-amber-600 block">Festiu Escolar</span>
                            <span className="text-xs font-medium text-amber-800 mt-1 text-center truncate max-w-[130px]">{holiday.label}</span>
                          </div>
                        </td>
                      );
                    }

                    const isWithinCourse = dIso >= state.config.startDate && dIso <= state.config.endDate;
                    const substitution = state.config.substitutions?.find(
                      sub => sub.date === dIso && sub.timeSlotId === slot.id
                    );

                    return (
                      <td 
                        key={dayIdx} 
                        className={`p-3 border-r border-slate-150 last:border-r-0 align-top min-h-[96px] ${
                          isToday ? 'bg-sky-500/5' : ''
                        }`}
                      >
                        {substitution ? (
                          substitution.type === 'subject' ? (
                            (() => {
                              const subSubject = state.subjects.find(s => s.id === substitution.subjectId);
                              if (!subSubject) return null;
                              return (
                                <div 
                                  onClick={() => onSelectSession(substitution.id, dIso)}
                                  className="w-full text-left p-3 rounded-xl border border-slate-705 bg-slate-800 text-slate-100 shadow-sm relative overflow-hidden group block min-h-[70px] flex flex-col justify-between cursor-pointer hover:bg-slate-750 transition-all duration-150"
                                  style={{ 
                                    borderLeftWidth: '5px', 
                                    borderLeftColor: subSubject.color || '#64748b' 
                                  }}
                                >
                                  <div>
                                    <span className="text-[9px] uppercase tracking-wider font-extrabold text-slate-400 block mb-0.5">SUBSTITUÏT CLASSE</span>
                                    <h4 className="text-xs sm:text-sm font-bold text-white tracking-tight leading-snug group-hover:text-amber-200">
                                      {subSubject.name}
                                    </h4>
                                  </div>
                                  
                                  <div className="flex items-center justify-between mt-2 opacity-55">
                                    <span className="text-[8.5px] font-semibold text-slate-400">Fes clic per registrar</span>
                                  </div>
                                </div>
                              );
                            })()
                          ) : (
                            <div 
                              className="w-full text-left p-3 rounded-xl border border-slate-705 bg-slate-800 text-slate-100 shadow-sm relative overflow-hidden group block min-h-[70px] flex flex-col justify-between"
                              style={{ 
                                borderLeftWidth: '5px', 
                                borderLeftColor: '#64748b' 
                              }}
                            >
                              <div>
                                <span className="text-[9px] uppercase tracking-wider font-extrabold text-slate-400 block mb-0.5">SUBSTITUCIÓ IP</span>
                                <h4 className="text-xs sm:text-sm font-bold text-slate-200 tracking-tight leading-snug">
                                  {substitution.customReason}
                                </h4>
                              </div>
                            </div>
                          )
                        ) : isWithinCourse && subject && sItem ? (
                          (() => {
                            const ongoingActs = getOngoingActivitiesForSession(state, subject.id, dIso);
                            const lastDayActs = getLastDayBeforeDeliveryActivities(state, subject.id, dIso);

                            return (
                              <div className="relative group block">
                                <button
                                  id={`schedule-cell-${sItem.id}-${dIso}`}
                                  onClick={() => onSelectSession(sItem.id, dIso)}
                                  className="w-full text-left p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition-all duration-150 hover:shadow-sm cursor-pointer hover:-translate-y-0.5 relative overflow-hidden block min-h-[72px] pr-2 flex flex-col justify-between"
                                  style={{ 
                                    borderLeftWidth: '5px', 
                                    borderLeftColor: subject.color || '#cbd5e1'
                                  }}
                                >
                                  <div>
                                    <h4 className="text-xs sm:text-sm font-bold text-slate-800 tracking-tight leading-snug group-hover:text-slate-950">
                                      {subject.name}
                                    </h4>
                                    {parentSubject && (
                                      <span className="text-[9.5px] text-slate-400 block truncate">
                                        ({parentSubject.name})
                                      </span>
                                    )}
                                  </div>

                                  {/* Badges / Icons for ongoing tasks and last day before delivery */}
                                  {(ongoingActs.length > 0 || lastDayActs.length > 0) && (
                                    <div className="flex flex-wrap items-center gap-1 mt-1.5 pt-1 border-t border-slate-100">
                                      {lastDayActs.length > 0 && (
                                        <span 
                                          title={`⚠️ Últim dia de classe abans del lliurament:\n${lastDayActs.map(a => `• ${a.title} (Límit: ${a.endDate})`).join('\n')}`}
                                          className="inline-flex items-center gap-1 text-[9px] font-bold text-amber-800 bg-amber-100 border border-amber-300 px-1.5 py-0.5 rounded shadow-xs"
                                        >
                                          <AlertCircle className="w-2.5 h-2.5 text-amber-600 shrink-0" />
                                          <span className="truncate max-w-[80px]">Últim dia</span>
                                        </span>
                                      )}

                                      {ongoingActs.length > 0 && (
                                        <span 
                                          title={`Tasques en curs (${ongoingActs.length}):\n${ongoingActs.map(a => `• ${a.title} (Lliurament: ${a.endDate})`).join('\n')}`}
                                          className="inline-flex items-center gap-1 text-[9px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded"
                                        >
                                          <ClipboardList className="w-2.5 h-2.5 text-indigo-600 shrink-0" />
                                          <span>{ongoingActs.length} {ongoingActs.length === 1 ? 'tasca' : 'tasques'}</span>
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </button>
                              </div>
                            );
                          })()
                        ) : (
                          <div className="w-full h-full min-h-[70px] flex items-center justify-center rounded-xl border border-dashed border-slate-100 bg-slate-50/10 p-2 text-slate-300">
                            {/* Empty non-interactive slot */}
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      
    </div>
  );
}
