import StudentName from './StudentName';
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Search,
  ArrowLeft, 
  ChevronLeft, 
  ChevronRight, 
  MessageSquare, 
  Check, 
  Clock, 
  UserX, 
  Smile, 
  AlertTriangle, 
  FileText,
  UserCheck,
  BookOpen,
  ClipboardList,
  CheckCheck,
  History,
  Send,
  Bookmark,
  Calendar
} from 'lucide-react';
import { AppState, SessionLog, Subject, Student, StudentLog, AttendanceType } from '../types';
import { 
  formatCatalanDate, 
  fromIsoDate, 
  formatCatalanShortDate,
  getProgrammedSessionsForSubject,
  getOngoingActivitiesForSession,
  getLastDayBeforeDeliveryActivities
} from '../utils/dateHelpers';

interface SessionViewProps {
  state: AppState;
  scheduleItemId: string;
  dateStr: string;
  onBackToTimeline: () => void;
  onNavigateToSession: (scheduleItemId: string, date: string) => void;
  onChangeState?: (next: AppState) => void;
  onSaveSessionLog: (log: SessionLog) => void;
}

export default function SessionView({
  state,
  scheduleItemId,
  dateStr,
  onBackToTimeline,
  onNavigateToSession,
  onChangeState,
  onSaveSessionLog
}: SessionViewProps) {
  // General notes & links states for general teacher tasks
  const [newNote, setNewNote] = useState('');
  const [studentSearch, setStudentSearch] = useState('');
  const [newLinkLabel, setNewLinkLabel] = useState('');
  const [newLinkUrl, setNewLinkUrl] = useState('');

  // 1. Locate current schedule layout slot or substitution
  const isSubstitution = scheduleItemId.startsWith('sub_');
  const substitution = isSubstitution
    ? state.config.substitutions?.find(s => s.id === scheduleItemId)
    : undefined;

  const sItem = !isSubstitution ? state.schedule.find(s => s.id === scheduleItemId) : null;
  const subject = substitution
    ? (substitution.type === 'subject' ? state.subjects.find(s => s.id === substitution.subjectId) || null : null)
    : (sItem ? state.subjects.find(s => s.id === sItem.subjectId) || null : null);
  const slot = substitution
    ? state.config.timeSlots.find(ts => ts.id === substitution.timeSlotId) || null
    : (sItem ? state.config.timeSlots.find(ts => ts.id === sItem.timeSlotId) || null : null);

  // 2. Resolve students
  const getSubjectStudents = (sub: Subject | null): Student[] => {
    if (!sub) return [];
    if (sub.isGeneral) return [];
    return sub.students || [];
  };

  const students = getSubjectStudents(subject);
  const normalizeSearch = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase().trim();
  const searchWords = normalizeSearch(studentSearch).split(/\s+/).filter(Boolean);
  const visibleStudents = students.map((student, idx) => ({student, idx})).filter(({student}) => searchWords.every(word => normalizeSearch(student.name).includes(word)));

  // 3. Initialize or locate the existing session log
  const logKey = `${scheduleItemId}_${dateStr}`;
  const existingLog = state.sessionLogs.find(l => l.id === logKey);

  const [comments, setComments] = useState<string>('');
  const [nextSessionNotes, setNextSessionNotes] = useState<string>('');
  const [attendance, setAttendance] = useState<Record<string, StudentLog>>({});
  
  // Track which comment input boxes are toggled open for each student
  const [openInputs, setOpenInputs] = useState<Record<string, { pos?: boolean; regular?: boolean; incident?: boolean }>>({});
  
  // Track unsaved commentary drafts typed into inputs
  const [draftComments, setDraftComments] = useState<Record<string, { pos?: string; regular?: string; incident?: string }>>({});

  // Sync state whenever the selected session parameters change
  useEffect(() => {
    if (existingLog) {
      setComments(existingLog.comments || '');
      setNextSessionNotes(existingLog.nextSessionNotes || '');
      setAttendance(existingLog.attendance || {});
    } else {
      setComments('');
      setNextSessionNotes('');
      setAttendance({});
    }
    setStudentSearch('');
    setOpenInputs({});
    setDraftComments({});
  }, [scheduleItemId, dateStr]);

  // Handle immediate auto-save triggers whenever inputs change
  const triggerSaveUpdate = (
    nextComments: string, 
    nextAttendance: Record<string, StudentLog>,
    nextPlanning?: string
  ) => {
    if (!subject) return;
    const updatedLog: SessionLog = {
      id: logKey,
      scheduleItemId,
      subjectId: subject.id,
      date: dateStr,
      comments: nextComments,
      nextSessionNotes: nextPlanning !== undefined ? nextPlanning : nextSessionNotes,
      attendance: nextAttendance
    };
    onSaveSessionLog(updatedLog);
  };

  const handleCommentsChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setComments(val);
    triggerSaveUpdate(val, attendance, nextSessionNotes);
  };

  const handleNextSessionNotesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setNextSessionNotes(val);
    triggerSaveUpdate(comments, attendance, val);
  };

  // Student list logger helper
  const updateStudentLog = (studentId: string, mutator: (prev: StudentLog) => StudentLog) => {
    const defaultLog: StudentLog = { status: 'present' };
    const current = attendance[studentId] || defaultLog;
    const nextLog = mutator(current);
    
    const nextAttendance = {
      ...attendance,
      [studentId]: nextLog
    };
    setAttendance(nextAttendance);
    triggerSaveUpdate(comments, nextAttendance, nextSessionNotes);
  };

  const handleStatusChange = (studentId: string, status: AttendanceType) => {
    updateStudentLog(studentId, (prev) => ({
      ...prev,
      status
    }));
  };

  const handleMarkAllPresent = () => {
    const nextAttendance = { ...attendance };
    students.forEach(st => {
      nextAttendance[st.id] = {
        ...(nextAttendance[st.id] || {}),
        status: 'present'
      };
    });
    setAttendance(nextAttendance);
    triggerSaveUpdate(comments, nextAttendance, nextSessionNotes);
  };

  const handleDraftChange = (studentId: string, key: 'pos' | 'regular' | 'incident', value: string) => {
    setDraftComments(prev => ({
      ...prev,
      [studentId]: {
        ...(prev[studentId] || {}),
        [key]: value
      }
    }));
  };

  const handleAddComment = (studentId: string, key: 'pos' | 'regular' | 'incident') => {
    const draftText = draftComments[studentId]?.[key]?.trim();
    if (!draftText) return;

    updateStudentLog(studentId, (prev) => {
      const fieldList = key === 'pos' 
        ? 'posComments' 
        : key === 'regular' 
          ? 'regularComments' 
          : 'incidentComments';
      const legacyField = key === 'pos'
        ? 'posComment'
        : key === 'regular'
          ? 'regularComment'
          : 'incidentComment';

      const existingLegacy = prev[legacyField];
      const existingArray = prev[fieldList] || (existingLegacy ? [existingLegacy] : []);
      const updatedArray = [...existingArray, draftText];

      return {
        ...prev,
        [fieldList]: updatedArray,
        [legacyField]: undefined
      };
    });

    // Reset this draft input field
    setDraftComments(prev => ({
      ...prev,
      [studentId]: {
        ...(prev[studentId] || {}),
        [key]: ''
      }
    }));
  };

  const handleDeleteComment = (studentId: string, key: 'pos' | 'regular' | 'incident', indexToDelete: number) => {
    updateStudentLog(studentId, (prev) => {
      const fieldList = key === 'pos' 
        ? 'posComments' 
        : key === 'regular' 
          ? 'regularComments' 
          : 'incidentComments';
      const legacyField = key === 'pos'
        ? 'posComment'
        : key === 'regular'
          ? 'regularComment'
          : 'incidentComment';

      const existingLegacy = prev[legacyField];
      const existingArray = prev[fieldList] || (existingLegacy ? [existingLegacy] : []);
      const updatedArray = existingArray.filter((_, idx) => idx !== indexToDelete);

      return {
        ...prev,
        [fieldList]: updatedArray,
        [legacyField]: undefined
      };
    });
  };

  const toggleInputReveal = (studentId: string, key: 'pos' | 'regular' | 'incident') => {
    setOpenInputs(prev => {
      const current = prev[studentId] || {};
      const nextValue = !current[key];
      return {
        ...prev,
        [studentId]: {
          ...current,
          [key]: nextValue
        }
      };
    });
  };

  // Sequential session navigator
  const getSiblingsDates = (): { 
    prevItem: { id: string; date: string } | null; 
    nextItem: { id: string; date: string } | null;
    sessionNumber: number | null;
    totalSessions: number;
  } => {
    if (!subject) return { prevItem: null, nextItem: null, sessionNumber: null, totalSessions: 0 };

    const programmed = getProgrammedSessionsForSubject(
      state,
      subject.id,
      state.config.startDate,
      state.config.endDate
    );

    const occurrences = programmed.map(p => ({
      id: p.scheduleItemId,
      date: p.date,
    }));

    const activeIdx = occurrences.findIndex(item => item.id === scheduleItemId && item.date === dateStr);
    
    return {
      prevItem: activeIdx > 0 ? occurrences[activeIdx - 1] : null,
      nextItem: activeIdx !== -1 && activeIdx < occurrences.length - 1 ? occurrences[activeIdx + 1] : null,
      sessionNumber: activeIdx !== -1 ? activeIdx + 1 : null,
      totalSessions: occurrences.length
    };
  };

  const { prevItem, nextItem, sessionNumber, totalSessions } = getSiblingsDates();

  const handleGoToPrevSession = () => {
    if (prevItem) {
      onNavigateToSession(prevItem.id, prevItem.date);
    }
  };

  const handleGoToNextSession = () => {
    if (nextItem) {
      onNavigateToSession(nextItem.id, nextItem.date);
    }
  };

  // Activities linked to this session
  const ongoingActivities = subject ? getOngoingActivitiesForSession(state, subject.id, dateStr) : [];
  const lastDayActivities = subject ? getLastDayBeforeDeliveryActivities(state, subject.id, dateStr) : [];

  // Previous session log lookup
  const prevLog = (prevItem && subject) ? (state.sessionLogs.find(l => l.id === `${prevItem.id}_${prevItem.date}`) || state.sessionLogs.find(l => l.subjectId === subject.id && l.date === prevItem.date)) : null;

  // General notes & links handlers for non-curricular subjects
  const handleAddGeneralNote = () => {
    if (!newNote.trim() || !onChangeState || !subject) return;
    const currentNotes = subject.generalNotes || [];
    const updatedNotes = [...currentNotes, newNote.trim()];
    const updatedSubject = { ...subject, generalNotes: updatedNotes };
    const nextSubjects = state.subjects.map(s => s.id === subject.id ? updatedSubject : s);
    onChangeState({ ...state, subjects: nextSubjects });
    setNewNote('');
  };

  const handleRemoveGeneralNote = (index: number) => {
    if (!onChangeState || !subject) return;
    const currentNotes = subject.generalNotes || [];
    const updatedNotes = currentNotes.filter((_, idx) => idx !== index);
    const updatedSubject = { ...subject, generalNotes: updatedNotes };
    const nextSubjects = state.subjects.map(s => s.id === subject.id ? updatedSubject : s);
    onChangeState({ ...state, subjects: nextSubjects });
  };

  const handleAddGeneralLink = () => {
    if (!newLinkLabel.trim() || !newLinkUrl.trim() || !onChangeState || !subject) return;
    let url = newLinkUrl.trim();
    if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
    const currentLinks = subject.generalLinks || [];
    const updatedLinks = [...currentLinks, { id: `link_${Date.now()}`, label: newLinkLabel.trim(), url }];
    const updatedSubject = { ...subject, generalLinks: updatedLinks };
    const nextSubjects = state.subjects.map(s => s.id === subject.id ? updatedSubject : s);
    onChangeState({ ...state, subjects: nextSubjects });
    setNewLinkLabel('');
    setNewLinkUrl('');
  };

  const handleRemoveGeneralLink = (linkId: string) => {
    if (!onChangeState || !subject) return;
    const currentLinks = subject.generalLinks || [];
    const updatedLinks = currentLinks.filter(l => l.id !== linkId);
    const updatedSubject = { ...subject, generalLinks: updatedLinks };
    const nextSubjects = state.subjects.map(s => s.id === subject.id ? updatedSubject : s);
    onChangeState({ ...state, subjects: nextSubjects });
  };

  if (!subject) {
    return (
      <div className="bg-white p-8 rounded-2xl text-center border border-slate-200">
        <AlertTriangle className="w-12 h-12 text-rose-500 mx-auto" />
        <h3 className="text-lg font-bold text-slate-900 mt-4">Sessió no trobada</h3>
        <p className="text-sm text-slate-500 mt-2">No s'ha pogut localitzar els paràmetres de la classe.</p>
        <button onClick={onBackToTimeline} className="mt-4 px-4 py-2 bg-slate-100 text-slate-700 font-bold rounded-xl text-xs hover:bg-slate-200 cursor-pointer">
          Tornar a l'Horari
        </button>
      </div>
    );
  }

  // Attendance statistics
  const presentsCount = students.filter(s => (attendance[s.id]?.status || 'present') === 'present').length;
  const lateCount = students.filter(s => ['late10', 'lateMore10'].includes(attendance[s.id]?.status)).length;
  const absentCount = students.filter(s => attendance[s.id]?.status === 'absent').length;

  return (
    <div id="session-view-root" className="space-y-5">
      
      {/* 1. Header with navigation, indicators for tasks & deadlines */}
      <div id="session-header-nav" className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        
        {/* Left: back button, subject title, session number & franja */}
        <div className="flex items-center space-x-3.5">
          <button
            id="btn-back-to-horari"
            onClick={onBackToTimeline}
            className="p-2 bg-slate-100/70 hover:bg-slate-200/70 rounded-xl text-slate-700 transition-colors border border-slate-200/60 cursor-pointer shrink-0"
            title="Tornar a l'horari general"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          
          <div>
            <div className="flex items-center space-x-2 flex-wrap gap-y-1">
              <span 
                className="w-3.5 h-3.5 rounded-full inline-block shrink-0 shadow-xs"
                style={{ backgroundColor: subject.color }}
              ></span>
              <h1 className="text-base sm:text-lg font-extrabold text-slate-900 leading-tight">
                {subject.name}
              </h1>
              {subject.isGeneral && (
                <span className="text-[10px] bg-slate-100 text-slate-600 font-bold px-2 py-0.5 rounded-md border border-slate-200">
                  Acció General
                </span>
              )}
            </div>
            
            <p className="text-xs text-slate-500 font-medium mt-1 flex flex-wrap items-center gap-1.5">
              <span className="text-sky-700 font-bold bg-sky-50 border border-sky-200/70 px-2 py-0.5 rounded-md text-[10px]">
                Sessió {sessionNumber || 1} de {totalSessions || 1}
              </span>
              <span>•</span>
              <span className="font-semibold text-slate-700">{formatCatalanDate(fromIsoDate(dateStr))}</span>
              {slot && (
                <>
                  <span>•</span>
                  <span>Franja: <strong className="text-slate-700 font-semibold">{slot.name} ({slot.startTime}-{slot.endTime})</strong></span>
                </>
              )}
            </p>
          </div>
        </div>

        {/* Center/Right: Task indicators & Session navigation */}
        <div className="flex items-center flex-wrap gap-2.5">
          
          {/* Ongoing Tasks Indicator (Hover to view) */}
          {ongoingActivities.length > 0 && (
            <div className="relative group">
              <button
                type="button"
                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-800 rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer"
                title="Passa el cursor per veure les tasques en curs"
              >
                <ClipboardList className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                <span>{ongoingActivities.length} {ongoingActivities.length === 1 ? 'tasca en curs' : 'tasques en curs'}</span>
              </button>
              
              {/* Floating dropdown on hover */}
              <div className="absolute right-0 top-full mt-1 w-80 bg-white rounded-xl shadow-xl border border-indigo-200 p-3 z-30 hidden group-hover:block animate-fadeIn">
                <p className="text-[10.5px] font-extrabold uppercase text-indigo-800 tracking-wider mb-2 flex items-center gap-1.5">
                  <ClipboardList className="w-3.5 h-3.5 text-indigo-600" />
                  Tasques en curs durant aquesta sessió:
                </p>
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {ongoingActivities.map(act => (
                    <div key={act.id} className="p-2.5 bg-slate-50 border border-slate-150 rounded-lg text-xs">
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-bold text-slate-800 truncate">{act.title}</span>
                        <span className="text-[9.5px] font-mono font-bold bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded shrink-0">
                          {act.code}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-slate-500 mt-1.5 pt-1 border-t border-slate-200/50">
                        <span>Pes: <strong>{act.weight}%</strong></span>
                        <span className="text-indigo-700 font-semibold">Lliurament: {act.endDate}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Last Day Before Delivery Alert (Icon & Warning) */}
          {lastDayActivities.length > 0 && (
            <div className="relative group">
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-300 text-amber-900 rounded-xl text-xs font-bold shadow-2xs animate-pulse cursor-pointer">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span>Últim dia abans de lliurament ({lastDayActivities.length})</span>
              </div>

              {/* Floating alert dropdown on hover */}
              <div className="absolute right-0 top-full mt-1 w-84 bg-white rounded-xl shadow-xl border border-amber-300 p-3 z-30 hidden group-hover:block animate-fadeIn">
                <p className="text-[10.5px] font-extrabold uppercase text-amber-900 tracking-wider mb-2 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                  Última sessió abans del lliurament de tasca!
                </p>
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {lastDayActivities.map(act => (
                    <div key={act.id} className="p-2.5 bg-amber-50/70 border border-amber-200 rounded-lg text-xs">
                      <div className="flex items-center justify-between gap-1 font-bold text-amber-950">
                        <span className="truncate">{act.title}</span>
                        <span className="text-[9.5px] font-mono bg-amber-200 text-amber-900 px-1.5 py-0.5 rounded shrink-0">
                          {act.code}
                        </span>
                      </div>
                      <p className="text-[10.5px] text-amber-800 mt-1">
                        Aquesta és l'última classe programada abans de la data límit: <strong>{act.endDate}</strong>.
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Prev / Next Session Buttons */}
          <div className="flex items-center gap-1.5 border-l border-slate-200 pl-2.5">
            <button
              id="btn-prev-session"
              type="button"
              disabled={!prevItem}
              onClick={handleGoToPrevSession}
              className={`flex items-center space-x-1 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                prevItem 
                  ? 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200/80 cursor-pointer' 
                  : 'bg-slate-50 text-slate-350 cursor-not-allowed border border-slate-100'
              }`}
              title={prevItem ? `Anar al ${prevItem.date}` : 'No hi ha sessions anteriors'}
            >
              <ChevronLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Anterior</span>
            </button>

            <button
              id="btn-next-session"
              type="button"
              disabled={!nextItem}
              onClick={handleGoToNextSession}
              className={`flex items-center space-x-1 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                nextItem 
                  ? 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200/80 cursor-pointer' 
                  : 'bg-slate-50 text-slate-350 cursor-not-allowed border border-slate-100'
              }`}
              title={nextItem ? `Anar al ${nextItem.date}` : 'No hi ha sessions posteriors'}
            >
              <span className="hidden sm:inline">Següent</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* 2. Main Work Area: Compact Attendance Table (Left) + 3 Session Commentary Spaces (Right) */}
      <div className="session-workspace">
        
        {/* LEFT COLUMN: Compact Attendance & Conduct Table (7 cols) */}
        <div className="session-attendance">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
            
            {/* Table Header Bar */}
            <div className="p-3.5 sm:p-4 bg-slate-50/70 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
              <div className="flex items-center gap-2">
                <UserCheck className="w-4.5 h-4.5 text-sky-600 shrink-0" />
                <div>
                  <div className="flex flex-wrap items-center gap-3"><h3 className="text-xs sm:text-sm font-extrabold text-slate-800">
                    Control d'Assistència i Conducta
                  </h3>
                  {!subject.isGeneral && <label className="flex items-center gap-2"><Search size={16} className="text-slate-400" aria-hidden="true"/><input type="search" aria-label="Cercar alumne a la sessió" placeholder="Cercar alumne…" className="w-48 max-w-full text-sm" value={studentSearch} onChange={e=>setStudentSearch(e.target.value)}/></label>}
                  </div>
                  <div className="flex items-center gap-1.5 text-[10.5px] text-slate-500 font-medium mt-0.5">
                    <span>{students.length} alumnes</span>
                    <span>•</span>
                    <span className="text-emerald-700 font-bold">{presentsCount} Pres.</span>
                    <span>•</span>
                    <span className="text-amber-700 font-bold">{lateCount} Retards</span>
                    <span>•</span>
                    <span className="text-rose-700 font-bold">{absentCount} Faltes</span>
                  </div>
                </div>
              </div>

              {!subject.isGeneral && students.length > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAllPresent}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xl text-xs font-bold transition-colors cursor-pointer self-start sm:self-auto shadow-2xs"
                  title="Marcar tots els alumnes com a presents ràpidament"
                >
                  <CheckCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Marcar tots presents</span>
                </button>
              )}
            </div>

            {/* Content: General Subject Notice, Empty Students, or Compact Table */}
            {subject.isGeneral ? (
              <div className="p-8 text-center text-slate-500">
                <BookOpen className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                <p className="text-sm font-bold text-slate-700">Aquesta és una Acció Docent General.</p>
                <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                  Les accions docents generals (guàrdies, patis, coordinacions) no pertanyen a un grup-classe ni tenen llistat d'alumnes. Utilitzeu els espais de comentaris de la dreta.
                </p>
              </div>
            ) : students.length === 0 ? (
              <div className="p-8 text-center text-slate-500">
                <UserX className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                <p className="text-sm font-bold text-slate-700">No hi ha alumnes matriculats</p>
                <p className="text-xs text-slate-400 mt-1">
                  Afegiu alumnes o associeu el grup mitjançant la configuració del curs.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-100/80 text-slate-600 font-bold border-b border-slate-200 text-[10px] uppercase tracking-wider">
                    <tr>
                      <th className="py-2.5 px-3 w-8 text-center font-mono text-slate-400">#</th>
                      <th className="py-2.5 px-3 min-w-[140px]">Alumne/a</th>
                      <th className="py-2.5 px-3 min-w-[190px]">Assistència</th>
                      <th className="py-2.5 px-3 min-w-[200px]">Conducta i Comentaris</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {visibleStudents.map(({student, idx}) => {
                      const sLog = attendance[student.id] || { status: 'present' };
                      const inputState = openInputs[student.id] || {};
                      
                      const posList = sLog.posComments || (sLog.posComment ? [sLog.posComment] : []);
                      const regularList = sLog.regularComments || (sLog.regularComment ? [sLog.regularComment] : []);
                      const incidentList = sLog.incidentComments || (sLog.incidentComment ? [sLog.incidentComment] : []);

                      return (
                        <tr 
                          key={student.id} 
                          className="even:bg-slate-50/60 odd:bg-white hover:bg-sky-50/30 transition-colors"
                        >
                          {/* Col 1: Index */}
                          <td className="py-2 px-3 text-center font-mono text-[10.5px] text-slate-400">
                            {idx + 1}
                          </td>

                          {/* Col 2: Student Name */}
                          <td className="py-2 px-3">
                            <div className="flex items-center space-x-2">
                              <span className="w-6 h-6 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-[10px] font-bold font-mono shrink-0">
                                {student.name.substring(0, 2).toUpperCase()}
                              </span>
                              <span className="font-bold text-slate-800 truncate max-w-[150px] sm:max-w-[200px]" title={student.name}>
                                <StudentName state={state} student={student}/>
                              </span>
                            </div>
                          </td>

                          {/* Col 3: Attendance buttons (Pres, <10m, >=10m, Falta) */}
                          <td className="py-2 px-3">
                            <div className="inline-flex rounded-lg border border-slate-200/80 p-0.5 bg-white shadow-2xs">
                              <button
                                type="button"
                                id={`attendance-present-${student.id}`}
                                onClick={() => handleStatusChange(student.id, 'present')}
                                className={`px-2 py-1 rounded text-[10.5px] font-bold transition-all cursor-pointer ${
                                  sLog.status === 'present'
                                    ? 'bg-emerald-600 text-white shadow-xs'
                                    : 'text-slate-500 hover:text-slate-800'
                                }`}
                                title="Present"
                              >
                                Pres.
                              </button>

                              <button
                                type="button"
                                id={`attendance-late10-${student.id}`}
                                onClick={() => handleStatusChange(student.id, 'late10')}
                                className={`px-2 py-1 rounded text-[10.5px] font-bold transition-all cursor-pointer ${
                                  sLog.status === 'late10'
                                    ? 'bg-amber-500 text-white shadow-xs'
                                    : 'text-slate-500 hover:text-slate-800'
                                }`}
                                title="Retard &lt;10 minuts"
                              >
                                &lt;10m
                              </button>

                              <button
                                type="button"
                                id={`attendance-latemore10-${student.id}`}
                                onClick={() => handleStatusChange(student.id, 'lateMore10')}
                                className={`px-2 py-1 rounded text-[10.5px] font-bold transition-all cursor-pointer ${
                                  sLog.status === 'lateMore10'
                                    ? 'bg-orange-500 text-white shadow-xs'
                                    : 'text-slate-500 hover:text-slate-800'
                                }`}
                                title="Retard &ge;10 minuts"
                              >
                                &ge;10m
                              </button>

                              <button
                                type="button"
                                id={`attendance-absent-${student.id}`}
                                onClick={() => handleStatusChange(student.id, 'absent')}
                                className={`px-2 py-1 rounded text-[10.5px] font-bold transition-all cursor-pointer ${
                                  sLog.status === 'absent'
                                    ? 'bg-rose-600 text-white shadow-xs'
                                    : 'text-slate-500 hover:text-slate-800'
                                }`}
                                title="Falta d'assistència"
                              >
                                Falta
                              </button>
                            </div>
                          </td>

                          {/* Col 4: Conduct comments, positive badges, incidents */}
                          <td className="py-2 px-3">
                            <div className="space-y-1.5">
                              
                              {/* Action buttons to open input */}
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <button
                                  type="button"
                                  onClick={() => toggleInputReveal(student.id, 'pos')}
                                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold border transition-colors inline-flex items-center gap-1 cursor-pointer ${
                                    inputState.pos 
                                      ? 'bg-emerald-100 text-emerald-800 border-emerald-300' 
                                      : 'bg-white text-slate-500 hover:text-emerald-700 border-slate-200'
                                  }`}
                                  title="Afegir comentari positiu"
                                >
                                  <Smile className="w-3 h-3 text-emerald-600" />
                                  <span>+ Pos</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => toggleInputReveal(student.id, 'regular')}
                                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold border transition-colors inline-flex items-center gap-1 cursor-pointer ${
                                    inputState.regular 
                                      ? 'bg-sky-100 text-sky-800 border-sky-300' 
                                      : 'bg-white text-slate-500 hover:text-sky-700 border-slate-200'
                                  }`}
                                  title="Afegir observació d'aula"
                                >
                                  <MessageSquare className="w-3 h-3 text-sky-600" />
                                  <span>+ Obs</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => toggleInputReveal(student.id, 'incident')}
                                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold border transition-colors inline-flex items-center gap-1 cursor-pointer ${
                                    inputState.incident 
                                      ? 'bg-rose-100 text-rose-800 border-rose-300' 
                                      : 'bg-white text-slate-500 hover:text-rose-700 border-slate-200'
                                  }`}
                                  title="Afegir incidència disciplinària"
                                >
                                  <AlertTriangle className="w-3 h-3 text-rose-600" />
                                  <span>+ Inc</span>
                                </button>
                              </div>

                              {/* Comment Pills Display */}
                              {(posList.length > 0 || regularList.length > 0 || incidentList.length > 0) && (
                                <div className="flex flex-wrap gap-1 pt-0.5">
                                  {posList.map((item, pIdx) => (
                                    <span 
                                      key={`pos_${pIdx}`} 
                                      className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded"
                                    >
                                      <span className="truncate max-w-[140px]">{item}</span>
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteComment(student.id, 'pos', pIdx)}
                                        className="text-emerald-500 hover:text-rose-600 font-bold ml-0.5 cursor-pointer"
                                      >
                                        ×
                                      </button>
                                    </span>
                                  ))}

                                  {regularList.map((item, rIdx) => (
                                    <span 
                                      key={`reg_${rIdx}`} 
                                      className="inline-flex items-center gap-1 text-[10px] font-semibold text-sky-800 bg-sky-50 border border-sky-200 px-1.5 py-0.5 rounded"
                                    >
                                      <span className="truncate max-w-[140px]">{item}</span>
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteComment(student.id, 'regular', rIdx)}
                                        className="text-sky-500 hover:text-rose-600 font-bold ml-0.5 cursor-pointer"
                                      >
                                        ×
                                      </button>
                                    </span>
                                  ))}

                                  {incidentList.map((item, iIdx) => (
                                    <span 
                                      key={`inc_${iIdx}`} 
                                      className="inline-flex items-center gap-1 text-[10px] font-semibold text-rose-800 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded"
                                    >
                                      <span className="truncate max-w-[140px]">{item}</span>
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteComment(student.id, 'incident', iIdx)}
                                        className="text-rose-500 hover:text-rose-900 font-bold ml-0.5 cursor-pointer"
                                      >
                                        ×
                                      </button>
                                    </span>
                                  ))}
                                </div>
                              )}

                              {/* Inline Input Box if open */}
                              {inputState.pos && (
                                <div className="flex items-center gap-1 pt-1">
                                  <input
                                    type="text"
                                    placeholder="Comentari positiu..."
                                    value={draftComments[student.id]?.pos || ''}
                                    onChange={(e) => handleDraftChange(student.id, 'pos', e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        e.preventDefault();
                                        handleAddComment(student.id, 'pos');
                                      }
                                    }}
                                    className="w-full text-[11px] p-1.5 bg-emerald-50/50 border border-emerald-200 rounded-lg focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                    autoFocus
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleAddComment(student.id, 'pos')}
                                    className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs cursor-pointer shrink-0"
                                  >
                                    +
                                  </button>
                                </div>
                              )}

                              {inputState.regular && (
                                <div className="flex items-center gap-1 pt-1">
                                  <input
                                    type="text"
                                    placeholder="Observació d'aula..."
                                    value={draftComments[student.id]?.regular || ''}
                                    onChange={(e) => handleDraftChange(student.id, 'regular', e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        e.preventDefault();
                                        handleAddComment(student.id, 'regular');
                                      }
                                    }}
                                    className="w-full text-[11px] p-1.5 bg-sky-50/50 border border-sky-200 rounded-lg focus:bg-white focus:outline-none focus:ring-1 focus:ring-sky-500"
                                    autoFocus
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleAddComment(student.id, 'regular')}
                                    className="px-2 py-1 bg-sky-600 hover:bg-sky-700 text-white font-bold rounded-lg text-xs cursor-pointer shrink-0"
                                  >
                                    +
                                  </button>
                                </div>
                              )}

                              {inputState.incident && (
                                <div className="flex items-center gap-1 pt-1">
                                  <input
                                    type="text"
                                    placeholder="Incidència de disciplina..."
                                    value={draftComments[student.id]?.incident || ''}
                                    onChange={(e) => handleDraftChange(student.id, 'incident', e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        e.preventDefault();
                                        handleAddComment(student.id, 'incident');
                                      }
                                    }}
                                    className="w-full text-[11px] p-1.5 bg-rose-50/50 border border-rose-200 rounded-lg focus:bg-white focus:outline-none focus:ring-1 focus:ring-rose-500"
                                    autoFocus
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleAddComment(student.id, 'incident')}
                                    className="px-2 py-1 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg text-xs cursor-pointer shrink-0"
                                  >
                                    +
                                  </button>
                                </div>
                              )}

                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  {!visibleStudents.length && <tr><td colSpan={4} className="p-4 text-center text-slate-500" role="status">No hi ha alumnes que coincideixin amb la cerca.</td></tr>}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: 3 Spaces for Session Continuity (5 cols) */}
        <div className="session-continuity">
          
          {/* ESPAI 1: Comentaris de la sessió anterior */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <History className="w-4.5 h-4.5 text-slate-500" />
                <h3 className="font-extrabold text-xs sm:text-sm text-slate-900">
                  Comentaris de la Sessió Anterior
                </h3>
              </div>
              {prevItem && (
                <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                  {formatCatalanShortDate(prevItem.date)}
                </span>
              )}
            </div>

            {prevLog ? (
              <div className="space-y-2.5">
                {/* Previous session diary */}
                {prevLog.comments ? (
                  <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl text-xs text-slate-700 leading-relaxed max-h-36 overflow-y-auto whitespace-pre-wrap">
                    {prevLog.comments}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">Sense diari registrat a la sessió anterior.</p>
                )}

                {/* Previsió que es va deixar a la sessió anterior per a avui */}
                {prevLog.nextSessionNotes && (
                  <div className="p-2.5 bg-sky-50 border border-sky-200 rounded-xl text-xs text-sky-900">
                    <span className="text-[10px] font-extrabold uppercase tracking-wide text-sky-700 flex items-center gap-1 mb-1">
                      <Bookmark className="w-3 h-3 text-sky-600" /> Previsió deixada a la sessió anterior per a avui:
                    </span>
                    <p className="leading-relaxed whitespace-pre-wrap font-medium">{prevLog.nextSessionNotes}</p>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic py-2">
                {!prevItem ? "Aquesta és la primera sessió del curs d'aquesta matèria." : "Sense comentaris registrats a la sessió anterior."}
              </p>
            )}
          </div>

          {/* ESPAI 2: Diari d'aquesta sessió */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <FileText className="w-4.5 h-4.5 text-blue-600" />
                <h3 className="font-extrabold text-xs sm:text-sm text-slate-900">
                  Diari d'Aquesta Sessió
                </h3>
              </div>
              <span className="text-[10.5px] font-semibold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
                Desat
              </span>
            </div>

            <textarea
              id="session-comments-area"
              rows={4}
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white text-slate-700 leading-relaxed placeholder:text-slate-400 resize-y"
              placeholder="Explicació de continguts, activitat d'aula realitzada, exercicis resolts..."
              value={comments}
              onChange={handleCommentsChange}
            />
          </div>

          {/* ESPAI 3: Comentaris per a la sessió següent */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <Send className="w-4 h-4 text-indigo-600" />
                <h3 className="font-extrabold text-xs sm:text-sm text-slate-900">
                  Comentaris per a la Sessió Següent
                </h3>
              </div>
              {nextItem && (
                <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
                  Proper: {formatCatalanShortDate(nextItem.date)}
                </span>
              )}
            </div>

            <textarea
              id="session-next-comments-area"
              rows={3}
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white text-slate-700 leading-relaxed placeholder:text-slate-400 resize-y"
              placeholder="Recordatoris per a la propera classe: deures per revisar, dur material de laboratori, continuar a la pàgina 45..."
              value={nextSessionNotes}
              onChange={handleNextSessionNotesChange}
            />
            <p className="text-[10px] text-slate-400 mt-1.5 leading-snug">
              💡 Aquest text es mostrarà automàticament a l'espai de <strong>Sessió Anterior</strong> quan obriu la propera sessió d'aquesta matèria.
            </p>
          </div>

          {/* Notes permanents / enllaços si és acció docent general */}
          {subject.isGeneral && (
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-3">
              <h4 className="text-xs font-bold text-slate-800">Bloc Permanent d'Anotacions</h4>
              <div className="space-y-1 max-h-36 overflow-y-auto">
                {(subject.generalNotes || []).map((note, nIdx) => (
                  <div key={nIdx} className="flex items-center justify-between p-2 bg-slate-50 border border-slate-150 rounded-lg text-xs">
                    <span className="truncate mr-2">{note}</span>
                    <button onClick={() => handleRemoveGeneralNote(nIdx)} className="text-slate-400 hover:text-rose-600 font-bold">×</button>
                  </div>
                ))}
              </div>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  placeholder="Nova nota permanent..."
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  className="flex-1 text-xs border border-slate-200 p-1.5 rounded-lg"
                />
                <button onClick={handleAddGeneralNote} className="px-2.5 py-1 bg-slate-800 text-white text-xs font-bold rounded-lg">
                  Afegir
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
