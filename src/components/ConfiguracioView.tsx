import StudentImportReview from './StudentImportReview';
import StudentName from './StudentName';
import CurriculumEditor, { CurriculumTarget } from './CurriculumEditor';
import DetailPage from './DetailPage';
import SubjectGradingSettings, { validateSubjectGrading } from './SubjectGradingSettings';
import CriteriaLabels from './CriteriaLabels';
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Calendar, 
  Clock, 
  Users, 
  Award, 
  Plus, 
  Trash2, 
  FolderPlus, 
  Languages, 
  AlertCircle,
  Hash,
  Copy,
  FolderTree,
  FileMinus,
  Edit2,
  Bell,
  RefreshCw,
  Download,
  Upload,
  Database,
  HardDrive,
  RotateCcw,
  FileJson
} from 'lucide-react';
import { AppState, Holiday, Term, TimeSlot, Subject, Student, Competency, EvalCriterion, ScheduleItem } from '../types';

interface ConfiguracioViewProps {
  initialSubjectId?: string | null;
  state: AppState;
  onChangeState: (nextState: AppState) => boolean | void;
  linkedFileName: string | null;
  onSelectFile: () => void;
  onDisconnectFile: () => void;
  onExportBackup: () => void;
  onImportBackup: () => void;
  onResetState: () => void;
}

export default function ConfiguracioView({ 
  initialSubjectId,
  state, 
  onChangeState,
  linkedFileName,
  onSelectFile,
  onDisconnectFile,
  onExportBackup,
  onImportBackup,
  onResetState
}: ConfiguracioViewProps) {
  const [activeTab, setActiveTab] = useState<'calendar' | 'subjects' | 'competencies' | 'substitutions' | 'notifications' | 'persistence'>('calendar');
  const [calendarSubTab, setCalendarSubTab] = useState<'limits' | 'hours'>('limits');

  // Trigger global state updates
  const updateConfigState = (updater: (draft: AppState['config']) => void) => {
    const nextConfig = { ...state.config };
    updater(nextConfig);
    onChangeState({
      ...state,
      config: nextConfig
    });
  };

  // ==========================================
  // CONFIGURACIÓ DE NOTIFICACIONS & RECORDATORIS CODI
  // ==========================================
  const [remTitle, setRemTitle] = useState('');
  const [remDate, setRemDate] = useState('');
  const [remTime, setRemTime] = useState('');
  const [remType, setRemType] = useState<'class' | 'calendar' | 'todo'>('todo');
  const [remAdvance, setRemAdvance] = useState<number>(15);

  const handleAddReminder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!remTitle.trim() || !remDate) {
      alert('Si us plau, introduïu un títol i una data per al recordatori.');
      return;
    }

    const currentReminders = state.config.reminders ?? [];
    const newRem = {
      id: `rem_${Date.now()}`,
      title: remTitle.trim(),
      date: remDate,
      time: remTime || undefined,
      type: remType,
      advanceMinutes: remAdvance,
      active: true
    };

    updateConfigState(draft => {
      draft.reminders = [...currentReminders, newRem];
    });

    setRemTitle('');
    setRemDate('');
    setRemTime('');
    setRemType('todo');
    setRemAdvance(15);
    alert('Recordatori afegit correctament!');
  };

  // ==========================================
  // CONFIGURACIÓ DE SUBSTITUCIONS CODI
  // ==========================================
  const [subDate, setSubDate] = useState('');
  const [subTimeSlotId, setSubTimeSlotId] = useState('');
  const [subType, setSubType] = useState<'subject' | 'other'>('subject');
  const [subSubjectId, setSubSubjectId] = useState('');
  const [subCustomReason, setSubCustomReason] = useState('');

  const handleAddSubstitution = (e: React.FormEvent) => {
    e.preventDefault();
    if (!subDate) {
      alert('Si us plau, especifiqueu una data per al reemplaçament.');
      return;
    }
    if (!subTimeSlotId) {
      alert('Si us plau, seleccioneu una franja d\'hora.');
      return;
    }
    if (subType === 'subject' && !subSubjectId) {
      alert('Si us plau, seleccioneu la matèria a impartir.');
      return;
    }
    if (subType === 'other' && !subCustomReason.trim()) {
      alert('Si us plau, descriviu el motiu del canvi.');
      return;
    }

    const nextSubstitutions = [...(state.config.substitutions || [])];
    const newSub = {
      id: `sub_${Date.now()}`,
      date: subDate,
      timeSlotId: subTimeSlotId,
      type: subType,
      subjectId: subType === 'subject' ? subSubjectId : undefined,
      customReason: subType === 'other' ? subCustomReason.trim() : undefined,
    };
    nextSubstitutions.push(newSub);

    updateConfigState(draft => {
      draft.substitutions = nextSubstitutions;
    });

    setSubDate('');
    setSubTimeSlotId('');
    setSubType('subject');
    setSubSubjectId('');
    setSubCustomReason('');
    alert('Substitució creada correctament!');
  };

  const handleRemoveSubstitution = (subId: string) => {
    const nextSubstitutions = (state.config.substitutions || []).filter(s => s.id !== subId);
    updateConfigState(draft => {
      draft.substitutions = nextSubstitutions;
    });
  };

  // ==========================================
  // TAB 1: CALENDAR & HOLIDAYS & TERMS STATE
  // ==========================================
  const [newHolidayDate, setNewHolidayDate] = useState('');
  const [newHolidayEndDate, setNewHolidayEndDate] = useState('');
  const [newHolidayLabel, setNewHolidayLabel] = useState('');

  const handleAddHoliday = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHolidayDate || !newHolidayLabel) return;
    
    // Check duplication
    if (state.config.holidays.some(h => h.date === newHolidayDate)) {
      alert('Aquesta data ja ha estat registrada com a festiu.');
      return;
    }

    const endD = newHolidayEndDate || newHolidayDate;

    const nextHolidays = [...state.config.holidays, { 
      date: newHolidayDate, 
      endDate: endD,
      label: newHolidayLabel 
    }].sort((a, b) => a.date.localeCompare(b.date));

    updateConfigState((draft) => {
      draft.holidays = nextHolidays;
    });

    setNewHolidayDate('');
    setNewHolidayEndDate('');
    setNewHolidayLabel('');
  };

  const handleRemoveHoliday = (date: string) => {
    const nextHolidays = state.config.holidays.filter(h => h.date !== date);
    updateConfigState((draft) => {
      draft.holidays = nextHolidays;
    });
  };

  const handleTermDateChange = (termId: string, field: 'startDate' | 'endDate', value: string) => {
    updateConfigState((draft) => {
      draft.terms = draft.terms.map(t => t.id === termId ? { ...t, [field]: value } : t);
    });
  };


  // ==========================================
  // TAB 2: HOURS (TIME SLOTS) & GRID LINKS
  // ==========================================
  const [newSlotName, setNewSlotName] = useState('');

  const handleAddTimeSlot = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSlotName) return;

    const newSlot: TimeSlot = {
      id: `slot_${Date.now()}`,
      name: newSlotName,
    };

    const nextTimeSlots = [...state.config.timeSlots, newSlot];

    updateConfigState((draft) => {
      draft.timeSlots = nextTimeSlots;
    });

    setNewSlotName('');
  };

  const handleRemoveTimeSlot = (slotId: string) => {
    // Delete slot
    const nextTimeSlots = state.config.timeSlots.filter(ts => ts.id !== slotId);
    // Remove all associated schedule links to prevent ghosts
    const nextSchedule = state.schedule.filter(item => item.timeSlotId !== slotId);
    
    updateConfigState((draft) => {
      draft.timeSlots = nextTimeSlots;
    });
    onChangeState({
      ...state,
      config: { ...state.config, timeSlots: nextTimeSlots },
      schedule: nextSchedule
    });
  };

  // Schedule allocation builder states
  const [allocDay, setAllocDay] = useState<number>(1); // Monday
  const [allocSlot, setAllocSlot] = useState<string>('');
  const [allocSubject, setAllocSubject] = useState<string>('');

  const handleLinkSchedule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!allocSlot || !allocSubject) return;

    // Remove any existing subject on that exact cell to avoid overlaps
    const filteredSchedule = state.schedule.filter(
      item => !(item.dayOfWeek === allocDay && item.timeSlotId === allocSlot)
    );

    const newItem: ScheduleItem = {
      id: `sch_${Date.now()}`,
      dayOfWeek: allocDay,
      timeSlotId: allocSlot,
      subjectId: allocSubject
    };

    onChangeState({
      ...state,
      schedule: [...filteredSchedule, newItem]
    });
  };

  const handleUnlinkCell = (dayOfWeek: number, timeSlotId: string) => {
    const nextSchedule = state.schedule.filter(
      item => !(item.dayOfWeek === dayOfWeek && item.timeSlotId === timeSlotId)
    );
    onChangeState({
      ...state,
      schedule: nextSchedule
    });
  };


  // ==========================================
  // TAB 3: SUBJECTS & MASS PUPILS
  // ==========================================
  const [subName, setSubName] = useState('');
  const [subColor, setSubColor] = useState('#3b82f6');
  const [subIsGeneral, setSubIsGeneral] = useState(false);
  const [subIsParent, setSubIsParent] = useState(false);
  const [subParentId, setSubParentId] = useState('');
  const [subBulkStudents, setSubBulkStudents] = useState('');

  // Editing subjects variables
  const [curriculumEdit, setCurriculumEdit] = useState<CurriculumTarget | null>(null);
  const [isCreatingSubject, setIsCreatingSubject] = useState(false);
  const [editingSubId, setEditingSubId] = useState<string | null>(null);
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('#3b82f6');
  const [editIsGeneral, setEditIsGeneral] = useState(false);
  const [editIsParent, setEditIsParent] = useState(false);
  const [editParentId, setEditParentId] = useState('');

  const [importReview,setImportReview]=useState<{names:string[];resolve:(students:Student[]|null)=>void}|null>(null);
  const chooseStudents=(names:string[])=>new Promise<Student[]|null>(resolve=>setImportReview({names,resolve}));
  const addToSubjects=(students:Student[],ids:string[])=>onChangeState({...state,subjects:state.subjects.map(s=>ids.includes(s.id)?{...s,students:[...s.students,...students.filter((st,i,a)=>!s.students.some(x=>x.id===st.id)&&a.findIndex(x=>x.id===st.id)===i)]}:s)});
  // Simultaneous multi-subject assignment state
  const [bulkAssignStudentsText, setBulkAssignStudentsText] = useState('');
  const [bulkAssignSelectedSubIds, setBulkAssignSelectedSubIds] = useState<string[]>([]);

  const handleExecuteBulkMultiAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bulkAssignStudentsText.trim() || bulkAssignSelectedSubIds.length === 0) {
      alert('Siusplau, introduïu alumnes i seleccioneu almenys una assignatura.');
      return;
    }

    const inputNames = bulkAssignStudentsText.split(/[\r\n;]+/).map(n => n.trim()).filter(Boolean);
    if (inputNames.length === 0) return;

    const students=await chooseStudents(inputNames);if(!students)return;
    addToSubjects(students,bulkAssignSelectedSubIds);

    setBulkAssignStudentsText('');
    setBulkAssignSelectedSubIds([]);
    alert(`S'han afegit els nous alumnes elegibles correctament!`);
  };

  const startEditingSubject = (sub: Subject) => {
    setEditingSubject(sub);
    setEditName(sub.name);
    setEditColor(sub.color);
    setEditIsGeneral(!!sub.isGeneral);
    setEditIsParent(!!sub.isParent);
    setEditParentId(sub.parentId || '');
  };

  const handleSaveEditedSubject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSubject || !editName) return;
    const gradingError = !editIsGeneral && validateSubjectGrading(editingSubject);
    if (gradingError) { alert(gradingError); return; }

    if(onChangeState({
      ...state,
      subjects: state.subjects.map(s => {
        if (s.id === editingSubject.id) {
          return {
            ...s,
            evaluationType: editingSubject.evaluationType || 'competencial',
            numericItems: editingSubject.numericItems,
            compSettings: editingSubject.compSettings,
            name: editName,
            color: editColor,
            isGeneral: editIsGeneral,
            isParent: editIsParent,
            parentId: editIsGeneral || editIsParent || !editParentId ? null : editParentId,
            students: (editIsGeneral || editIsParent) ? [] : s.students
          };
        }
        return s;
      })
    })===false)return;

    setEditingSubject(null);
  };

  const handleCreateSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subName) return;

    let parsedStudents:Student[]=[];
    if(!subIsGeneral&&!subIsParent&&subBulkStudents.trim()){
      const chosen=await chooseStudents(subBulkStudents.split(/[\r\n]+/).map(n=>n.trim()).filter(Boolean));
      if(!chosen)return;parsedStudents=chosen.filter((st,i,a)=>a.findIndex(x=>x.id===st.id)===i);
    }

    const newSub: Subject = {
      id: `sub_${Date.now()}`,
      name: subName,
      color: subColor,
      isGeneral: subIsGeneral,
      isParent: subIsParent,
      parentId: (subIsGeneral || subIsParent || !subParentId) ? null : subParentId,
      students: (subIsGeneral || subIsParent) ? [] : parsedStudents
    };

    onChangeState({
      ...state,
      subjects: [...state.subjects, newSub]
    });

    // Reset fields
    setSubName('');
    setSubColor('#3b82f6');
    setSubIsGeneral(false);
    setSubIsParent(false);
    setSubParentId('');
    setSubBulkStudents('');
    setIsCreatingSubject(false);
    startEditingSubject(newSub);
  };

  const handleRemoveSubject = (id: string) => {
    // Delete subject
    const nextSubjects = state.subjects.filter(s => s.id !== id);
    // Unlink calendar slots assigned to this subject
    const nextSchedule = state.schedule.filter(item => item.subjectId !== id);
    // Remove custom competencies and criteria tied
    const nextComp = state.competencies.filter(c => c.subjectId !== id);
    const deletedCompIds = state.competencies.filter(c => c.subjectId === id).map(c => c.id);
    const nextCrit = state.criteria.filter(cr => !deletedCompIds.includes(cr.competencyId));

    onChangeState({
      ...state,
      subjects: nextSubjects,
      schedule: nextSchedule,
      competencies: nextComp,
      criteria: nextCrit
    });
  };

  // Bulk edit pupils of existing subject dialog state
  const [reimportSubId, setReimportSubId] = useState<string | null>(null);
  const [reimportText, setReimportText] = useState('');

  const startReimport = (sub: Subject) => {
    setReimportSubId(sub.id);
    setReimportText('');
  };

  const handleExecuteReimport = async () => {
    if(!reimportSubId)return;
    const names=reimportText.split(/[\r\n]+/).map(n=>n.trim()).filter(Boolean);
    if(!names.length)return;
    const students=await chooseStudents(names);if(!students)return;
    addToSubjects(students,[reimportSubId]);setReimportSubId(null);setReimportText('');
  };

  const handleRemoveStudentFromSubject = (subjectId: string, studentId: string) => {
    const updatedSubjects = state.subjects.map(s => {
      if (s.id === subjectId) {
        const nextStudents = s.students.filter(stud => stud.id !== studentId);
        if (reimportSubId === subjectId) {
          setReimportText(nextStudents.map(st => st.name).join('\n'));
        }
        return {
          ...s,
          students: nextStudents
        };
      }
      return s;
    });

    onChangeState({
      ...state,
      subjects: updatedSubjects
    });
  };

  const handleAddSingleStudent = async (subjectId:string,name:string) => {
    const students=await chooseStudents([name.trim()]);if(students)addToSubjects(students,[subjectId]);
  };

  // ==========================================
  // TAB 4: COMPETENCIES & EVAL CRITERIA
  // ==========================================
  const [activeCompSubId, setActiveCompSubId] = useState<string>('');
  const [compPrefix, setCompPrefix] = useState('CE');
  const [newCompDesc, setNewCompDesc] = useState('');

  // Criteria entry states
  const [critCompId, setCritCompId] = useState('');
  const [newCritKey, setNewCritKey] = useState('');
  const [newCritDesc, setNewCritDesc] = useState('');

  const selectedSubjectForComp = state.subjects.find(s => s.id === activeCompSubId) || null;
  const parentOfSelectedSubject = selectedSubjectForComp && selectedSubjectForComp.parentId
    ? state.subjects.find(ps => ps.id === selectedSubjectForComp.parentId) || null
    : null;

  // Resolve the effective subject ID (if it has a parent, we look up the parent, so child and parent are fully linked as a single database entry)
  const effectiveCompSubId = selectedSubjectForComp
    ? (selectedSubjectForComp.parentId || selectedSubjectForComp.id)
    : '';

  // Compute list of valid competencies for active selected subject
  const directCompetencies = state.competencies.filter(c => c.subjectId === effectiveCompSubId);
  const inheritedCompetencies: Competency[] = []; // Unified under parentId, no separate inherited list needed

  // Suggesting the next sequence index algorithmically
  const suggestNextCompKey = (): string => {
    const prefix = compPrefix.trim();
    if (!prefix) return '';

    // Find all competencies in the system (or tied to this subject) matching the prefix string
    const matchRegex = new RegExp(`^${prefix}(\\d+)$`);
    
    // Scan direct plus inherited if applicable (all relevant gets directCompetencies)
    const allRelevant = directCompetencies;
    let maxNum = 0;

    allRelevant.forEach(comp => {
      const match = comp.key.match(matchRegex);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) {
          maxNum = num;
        }
      }
    });

    return `${prefix}${maxNum + 1}`;
  };

  // Competency custom input field
  const [customCompKey, setCustomCompKey] = useState('');

  // When selecting active course or updating prefix, let's prefill a custom key trigger
  const handleAutoSuggestKey = () => {
    setCustomCompKey(suggestNextCompKey());
  };

  const handleCreateCompetency = (e: React.FormEvent) => {
    e.preventDefault();
    if (!effectiveCompSubId || !newCompDesc) return;

    // Use input custom block or fallback suggested sequence
    const finalKey = customCompKey.trim() || suggestNextCompKey();

    const newComp: Competency = {
      id: `comp_${Date.now()}`,
      subjectId: effectiveCompSubId,
      key: finalKey,
      description: newCompDesc
    };

    onChangeState({
      ...state,
      competencies: [...state.competencies, newComp]
    });

    setNewCompDesc('');
    setCustomCompKey('');
  };

  const handleRemoveCompetency = (compId: string) => {
    onChangeState({
      ...state,
      competencies: state.competencies.filter(c => c.id !== compId),
      criteria: state.criteria.filter(cr => cr.competencyId !== compId)
    });
  };

  // Suggest next Evaluation Criterion Key (e.g., "CEProg1.1", "CEProg1.2")
  const suggestNextCriterionKey = (compId: string): string => {
    const comp = state.competencies.find(c => c.id === compId);
    if (!comp) return '1';
    
    const siblingCriteria = state.criteria.filter(cr => cr.competencyId === compId);
    
    // Look up parent competency code
    const parentCode = comp.key; // e.g. "CEProg1"
    const regex = new RegExp(`^${parentCode.replace('.', '\\.')}\\.(\\d+)$`);
    let maxIndex = 0;

    siblingCriteria.forEach(item => {
      const match = item.key.match(regex);
      if (match) {
        const idx = parseInt(match[1], 10);
        if (idx > maxIndex) {
          maxIndex = idx;
        }
      }
    });

    return `${parentCode}.${maxIndex + 1}`;
  };

  const handlePrepareCriterionForComp = (compId: string) => {
    setCritCompId(compId);
    setNewCritKey(suggestNextCriterionKey(compId));
    setNewCritDesc('');
  };

  const handleCreateCriterion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!critCompId || !newCritKey || !newCritDesc) return;

    const newCrit: EvalCriterion = {
      id: `crit_${Date.now()}`,
      competencyId: critCompId,
      key: newCritKey,
      shortLabel: newCritKey,
      order: state.criteria.length,
      description: newCritDesc
    };

    onChangeState({
      ...state,
      criteria: [...state.criteria, newCrit]
    });

    setCritCompId('');
    setNewCritKey('');
    setNewCritDesc('');
  };

  const handleRemoveCriterion = (critId: string) => {
    onChangeState({
      ...state,
      criteria: state.criteria.filter(cr => cr.id !== critId)
    });
  };

  useEffect(() => {
    if (!initialSubjectId) return;
    setActiveTab('subjects');
    if (initialSubjectId === 'new') setIsCreatingSubject(true);
    else { const selected = state.subjects.find(s => s.id === initialSubjectId); if (selected) startEditingSubject(selected); }
  }, [initialSubjectId]);

  if (curriculumEdit) return <CurriculumEditor key={curriculumEdit.id} state={state} target={curriculumEdit} onChange={onChangeState} onBack={()=>setCurriculumEdit(null)} />;

  if(importReview)return <StudentImportReview state={state} names={importReview.names} onApply={students=>{importReview.resolve(students);setImportReview(null);}} onCancel={()=>{importReview.resolve(null);setImportReview(null);}}/>;
  if (reimportSubId) return <DetailPage title="Gestionar alumnat" subtitle={state.subjects.find(s=>s.id===reimportSubId)?.name} onBack={()=>setReimportSubId(null)}><div className="bg-indigo-950/[0.02] border border-slate-200 rounded-2xl p-6 bg-white space-y-5">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">
                      Gestió d'Alumnat: {state.subjects.find(s => s.id === reimportSubId)?.name}
                    </h4>
                    <p className="text-[10px] text-slate-400 mt-0.5">Gestioneu individualment els alumnes d'aquest grup.</p>
                  </div>
                  <button onClick={() => setReimportSubId(null)} className="text-xs text-rose-500 font-bold hover:underline">
                    Tancar
                  </button>
                </div>

                <div className="space-y-3 max-w-xl mx-auto">
                  {/* Single student management list */}
                  <div className="space-y-3">
                    <h5 className="font-bold text-slate-800 text-xs">Llista d'Alumnes Actuals ({state.subjects.find(s => s.id === reimportSubId)?.students.length || 0}):</h5>
                    <div className="max-h-60 overflow-y-auto space-y-1 bg-slate-50 p-3 rounded-xl border border-slate-150">
                      {(() => {
                        const activeSub = state.subjects.find(s => s.id === reimportSubId);
                        if (!activeSub || activeSub.students.length === 0) {
                          return <p className="text-slate-400 italic text-[11px] text-center py-8">Sense alumnat en aquest grup.</p>;
                        }
                        return activeSub.students.map((st) => (
                          <div key={st.id} className="flex items-center justify-between text-xs bg-white p-2 rounded-lg border border-slate-100 shadow-sm hover:border-slate-250 transition-colors">
                            <span className="font-semibold text-slate-700 truncate mr-2"><StudentName state={state} student={st}/></span>
                            <button
                              type="button"
                              onClick={() => handleRemoveStudentFromSubject(reimportSubId, st.id)}
                              className="p-1 hover:bg-rose-50 text-slate-400 hover:text-rose-500 rounded transition-colors"
                              title="Eliminar alumne"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ));
                      })()}
                    </div>

                    {/* Quick single add action */}
                    <div className="space-y-1.5 pt-1">
                      <label className="block text-[10px] text-slate-500 font-bold uppercase tracking-wide">Afegir Alumne Individual</label>
                      <div className="flex gap-2">
                        <input
                          id="input-single-student-add"
                          type="text"
                          placeholder="ex. Marín, David"
                          className="flex-1 text-xs border border-slate-200 p-2.5 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              const val = e.currentTarget.value.trim();
                              if (val) {
                                handleAddSingleStudent(reimportSubId, val);
                                e.currentTarget.value = '';
                              }
                            }
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const input = document.getElementById('input-single-student-add') as HTMLInputElement;
                            if (input && input.value.trim()) {
                              handleAddSingleStudent(reimportSubId, input.value.trim());
                              input.value = '';
                            }
                          }}
                          className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg cursor-pointer"
                        >
                          Afegir
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
</DetailPage>;

  if (editingSubject) return <DetailPage title="Configurar assignatura" subtitle={editingSubject.name} onBack={() => setEditingSubject(null)}><div className="bg-amber-500/[0.02] border border-amber-200 rounded-2xl p-6 bg-white space-y-4 shadow-sm animate-fadeIn">
                <div className="flex items-center justify-between border-b border-amber-100 pb-3">
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">
                      Modificar Preferències de l'Assignatura
                    </h4>
                    <p className="text-[10px] text-slate-405 mt-0.5 font-medium">Editeu les dades de {editingSubject.name}</p>
                  </div>
                  <button onClick={() => setEditingSubject(null)} className="text-xs text-rose-500 font-bold hover:underline">
                    Cancel·lar
                  </button>
                </div>

                <form onSubmit={handleSaveEditedSubject} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1.5">Nom de l'Assignatura o Activitat</label>
                      <input
                        id="edit-sub-name"
                        required
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="w-full text-slate-800 text-sm p-3 border border-slate-200 rounded-xl"
                      />
                    </div>

                    {/* Color picking */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1.5">Color de la targeta</label>
                      <div className="flex items-center space-x-2">
                        <input
                          id="edit-sub-color"
                          type="color"
                          value={editColor}
                          onChange={(e) => setEditColor(e.target.value)}
                          className="w-10 h-10 p-1 border border-slate-200 rounded-xl bg-white cursor-pointer"
                        />
                        <span className="text-xs text-slate-500 font-mono">{editColor}</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center space-x-3 bg-slate-50 p-2.5 border rounded-xl">
                      <input
                        id="edit-sub-isgeneral"
                        type="checkbox"
                        checked={editIsGeneral}
                        onChange={(e) => {
                          setEditIsGeneral(e.target.checked);
                          if (e.target.checked) setEditIsParent(false);
                          if (e.target.checked) setEditParentId('');
                        }}
                        className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                      />
                      <div>
                        <label htmlFor="edit-sub-isgeneral" className="block text-xs font-bold text-slate-800">Acció general de centre</label>
                        <span className="block text-[10px] text-slate-400">Patis, guàrdies, coordinacions (buida alumnat)</span>
                      </div>
                    </div>

                    {!editIsGeneral && (
                      <div className="flex items-center space-x-3 bg-slate-50 p-2.5 border rounded-xl">
                        <input
                          id="edit-sub-isparent"
                          type="checkbox"
                          checked={editIsParent}
                          onChange={(e) => {
                            setEditIsParent(e.target.checked);
                            if (e.target.checked) setEditParentId('');
                          }}
                          className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                        />
                        <div>
                          <label htmlFor="edit-sub-isparent" className="block text-xs font-bold text-slate-800">Tria com a Grup Mare</label>
                          <span className="block text-[10px] text-slate-400">Els subgrups o fills heretaran les competències d'aquest grup (mai els alumnes).</span>
                        </div>
                      </div>
                    )}

                    {!editIsGeneral && !editIsParent && (
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1.5">Canviar Grup Mare (Opcional)</label>
                        <select
                          id="edit-select-sub-parent"
                          value={editParentId}
                          onChange={(e) => setEditParentId(e.target.value)}
                          className="w-full text-slate-850 text-sm p-3 border border-slate-200 rounded-xl bg-white"
                        >
                          <option value="">Cap (Grup Autònom)</option>
                          {state.subjects.filter(s => s.isParent && s.id !== editingSubject.id).map((s) => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>

                  {!editIsGeneral && <SubjectGradingSettings subject={editingSubject} onChange={setEditingSubject} />}
                  <div className="md:col-span-2 pt-2">
                    <button
                      type="submit"
                      className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs cursor-pointer shadow-md"
                    >
                      Desar Canvis de l'Assignatura
                    </button>
                  </div>
                </form>
              </div>
</DetailPage>;

  if (isCreatingSubject) return <DetailPage title="Nova assignatura" onBack={() => setIsCreatingSubject(false)}><div className="space-y-6">
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
              <h3 className="font-bold text-slate-900 border-b border-slate-100 pb-3 mb-4">Creador d'Assignatures</h3>
              <form onSubmit={handleCreateSubject} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5">Nom de l'Assignatura o Activitat</label>
                  <input
                    id="input-sub-name"
                    required
                    placeholder="ex. Programació DAW2, Guàrdia Pati"
                    value={subName}
                    onChange={(e) => setSubName(e.target.value)}
                    className="w-full text-slate-800 text-sm p-3 border border-slate-200 rounded-xl"
                  />
                </div>

                <div className="flex items-center space-x-3 bg-slate-50 p-3 border rounded-xl">
                  <input
                    id="check-sub-isgeneral"
                    type="checkbox"
                    checked={subIsGeneral}
                    onChange={(e) => {
                      setSubIsGeneral(e.target.checked);
                      if (e.target.checked) setSubIsParent(false);
                      if (e.target.checked) setSubParentId('');
                    }}
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                  />
                  <div>
                    <label htmlFor="check-sub-isgeneral" className="block text-xs font-bold text-slate-800">Acció general de centre</label>
                    <span className="block text-[10px] text-slate-400">Guàrdies, coordinacions, patis (sense llista d'alumnes)</span>
                  </div>
                </div>

                {!subIsGeneral && (
                  <div className="flex items-center space-x-3 bg-slate-50 p-3 border rounded-xl">
                    <input
                      id="check-sub-isparent"
                      type="checkbox"
                      checked={subIsParent}
                      onChange={(e) => {
                        setSubIsParent(e.target.checked);
                        if (e.target.checked) setSubParentId('');
                      }}
                      className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                    />
                    <div>
                      <label htmlFor="check-sub-isparent" className="block text-xs font-bold text-slate-800">Tria com a Grup Mare</label>
                      <span className="block text-[10px] text-slate-400">Els subgrups o fills d'aquest grup mare n'heretaran les competències definides (mai els alumnes).</span>
                    </div>
                  </div>
                )}

                {!subIsGeneral && (
                  <>
                    {/* Parent group selector */}
                    {!subIsParent && (
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1.5">Grup Mare d'Assignatura (Opcional)</label>
                        <select
                          id="select-sub-parent"
                          value={subParentId}
                          onChange={(e) => setSubParentId(e.target.value)}
                          className="w-full text-slate-855 text-sm p-3 border border-slate-200 rounded-xl bg-white"
                        >
                          <option value="">Cap (Grup Autònom)</option>
                          {state.subjects.filter(s => s.isParent && !s.isGeneral).map((s) => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                          ))}
                        </select>
                        <span className="block text-[10px] text-slate-400 mt-1">El fill heretarà automàticament les competències definides al grup mare triat.</span>
                      </div>
                    )}
                  </>
                )}

                {/* Color picking */}
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5">Color de la targeta</label>
                  <div className="flex items-center space-x-2">
                    <input
                      id="input-sub-color"
                      type="color"
                      value={subColor}
                      onChange={(e) => setSubColor(e.target.value)}
                      className="w-10 h-10 p-1 border border-slate-200 rounded-xl bg-white cursor-pointer"
                    />
                    <span className="text-xs text-slate-500 font-mono">{subColor}</span>
                  </div>
                </div>

                <button
                  id="btn-create-subject"
                  type="submit"
                  className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl"
                >
                  Crear i configurar l’assignatura
                </button>
              </form>
            </div>
          </div>
</DetailPage>;

  return (
    <div id="configuracio-view-root" className="space-y-6">
      {/* Tab Selectors */}
      <div id="config-tabs-header" className="flex overflow-x-auto bg-white border border-slate-200 rounded-2xl p-1.5 gap-1.5 shadow-sm scrollbar-none">
        <button
          id="tab-btn-calendar"
          onClick={() => setActiveTab('calendar')}
          className={`flex-shrink-0 flex items-center space-x-2 px-5 py-3 rounded-xl text-sm font-bold transition-all cursor-pointer ${
            activeTab === 'calendar'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-600/10'
              : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          <Calendar className="w-4.5 h-4.5" />
          <span>Calendari</span>
        </button>

        <button
          id="tab-btn-subjects"
          onClick={() => setActiveTab('subjects')}
          className={`flex-shrink-0 flex items-center space-x-2 px-5 py-3 rounded-xl text-sm font-bold transition-all cursor-pointer ${
            activeTab === 'subjects'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-600/10'
              : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          <Users className="w-4.5 h-4.5" />
          <span>Assignatures</span>
        </button>

        <button
          id="tab-btn-competencies"
          onClick={() => {
            setActiveTab('competencies');
            if (state.subjects.length > 0 && !activeCompSubId) {
              setActiveCompSubId(state.subjects[0].id);
            }
          }}
          className={`flex-shrink-0 flex items-center space-x-2 px-5 py-3 rounded-xl text-sm font-bold transition-all cursor-pointer ${
            activeTab === 'competencies'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-600/10'
              : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          <Award className="w-4.5 h-4.5" />
          <span>Competències</span>
        </button>

        <button
          id="tab-btn-substitutions"
          onClick={() => setActiveTab('substitutions')}
          className={`flex-shrink-0 flex items-center space-x-2 px-5 py-3 rounded-xl text-sm font-bold transition-all cursor-pointer ${
            activeTab === 'substitutions'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-600/10'
              : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          <RefreshCw className="w-4.5 h-4.5" />
          <span>Substitucions</span>
        </button>

        <button
          id="tab-btn-notifications"
          onClick={() => setActiveTab('notifications')}
          className={`flex-shrink-0 flex items-center space-x-2 px-5 py-3 rounded-xl text-sm font-bold transition-all cursor-pointer ${
            activeTab === 'notifications'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-600/10'
              : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          <Bell className="w-4.5 h-4.5" />
          <span>Notificacions</span>
        </button>

        <button
          id="tab-btn-persistence"
          onClick={() => setActiveTab('persistence')}
          className={`flex-shrink-0 flex items-center space-x-2 px-5 py-3 rounded-xl text-sm font-bold transition-all cursor-pointer ${
            activeTab === 'persistence'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-600/10'
              : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          <Database className="w-4.5 h-4.5" />
          <span>BBDD</span>
        </button>
      </div>

      {/* ==========================================
          TAB 1 PANEL: CALENDAR & HOLIDAYS & TERMS (Including Nesting of Hours)
          ========================================== */}
      {activeTab === 'calendar' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Sub Navigation Bar for Calendar Tab Section */}
          <div className="flex bg-slate-100 p-1.5 rounded-xl gap-2 w-fit border border-slate-200 shadow-sm animate-fadeIn">
            <button
              onClick={() => setCalendarSubTab('limits')}
              className={`px-4.5 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                calendarSubTab === 'limits'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/10'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
              }`}
            >
              Límits i Festius
            </button>
            <button
              onClick={() => {
                setCalendarSubTab('hours');
                // Ensure form alloc states are filled
                if (state.config.timeSlots.length > 0 && !allocSlot) {
                  setAllocSlot(state.config.timeSlots[0].id);
                }
                if (state.subjects.length > 0 && !allocSubject) {
                  setAllocSubject(state.subjects[0].id);
                }
              }}
              className={`px-4.5 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                calendarSubTab === 'hours'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/10'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
              }`}
            >
              Franges i Horari
            </button>
          </div>

          {calendarSubTab === 'limits' ? (
            <div id="panel-calendar" className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fadeIn">
          {/* General boundaries & holidays editor */}
          <div className="lg:col-span-2 space-y-6">
            {/* Boundaries Card */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
              <h3 className="font-bold text-slate-900 border-b border-slate-100 pb-3 mb-4 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-indigo-500" />
                <span>Límits del Curs Escolar</span>
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-tight mb-2">Data d'Inici</label>
                  <input
                    id="input-config-startdate"
                    type="date"
                    value={state.config.startDate}
                    onChange={(e) => updateConfigState(draft => { draft.startDate = e.target.value; })}
                    className="w-full text-slate-800 text-sm p-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-tight mb-2">Data de Fi</label>
                  <input
                    id="input-config-enddate"
                    type="date"
                    value={state.config.endDate}
                    onChange={(e) => updateConfigState(draft => { draft.endDate = e.target.value; })}
                    className="w-full text-slate-800 text-sm p-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
            </div>

            {/* Terms Boundaries */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
              <h3 className="font-bold text-slate-900 border-b border-slate-100 pb-3 mb-4 flex items-center gap-2">
                <FolderTree className="w-5 h-5 text-indigo-500" />
                <span>Gestió dels Trimestres (Avaluacions)</span>
              </h3>
              <div className="space-y-4">
                {state.config.terms.map((term) => (
                  <div key={term.id} className="grid grid-cols-2 sm:grid-cols-3 items-center gap-4 bg-slate-50 p-4 border border-slate-150 rounded-xl">
                    <span className="col-span-2 sm:col-span-1 text-sm font-bold text-slate-800 text-center sm:text-left">
                      {term.name}
                    </span>
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Inici</label>
                      <input
                        type="date"
                        value={term.startDate}
                        onChange={(e) => handleTermDateChange(term.id, 'startDate', e.target.value)}
                        className="w-full text-xs p-2.5 bg-white border border-slate-200 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Fi</label>
                      <input
                        type="date"
                        value={term.endDate}
                        onChange={(e) => handleTermDateChange(term.id, 'endDate', e.target.value)}
                        className="w-full text-xs p-2.5 bg-white border border-slate-200 rounded-lg"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Holidays Adding and List Panel */}
          <div className="space-y-6">
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
              <h3 className="font-bold text-slate-900 border-b border-slate-100 pb-3 mb-4">
                Afegir Festiu Escolar
              </h3>
              <form onSubmit={handleAddHoliday} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1.5">Data Inici</label>
                    <input
                      id="input-holiday-date"
                      type="date"
                      required
                      value={newHolidayDate}
                      onChange={(e) => setNewHolidayDate(e.target.value)}
                      className="w-full text-slate-800 text-sm p-3 border border-slate-200 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1.5">Data Fi <span className="text-[10px] text-slate-400 font-normal">(opcional)</span></label>
                    <input
                      id="input-holiday-end-date"
                      type="date"
                      value={newHolidayEndDate}
                      onChange={(e) => setNewHolidayEndDate(e.target.value)}
                      className="w-full text-slate-800 text-sm p-3 border border-slate-200 rounded-xl"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5">Etiqueta (ex. "La Mercè")</label>
                  <input
                    id="input-holiday-label"
                    type="text"
                    required
                    placeholder="Escriu el nom de la diada"
                    value={newHolidayLabel}
                    onChange={(e) => setNewHolidayLabel(e.target.value)}
                    className="w-full text-slate-800 text-sm p-3 border border-slate-200 rounded-xl"
                  />
                </div>
                <button
                  id="btn-add-holiday"
                  type="submit"
                  className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition-all shadow-md shadow-indigo-600/10"
                >
                  Afegir Festiu
                </button>
              </form>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
              <h3 className="font-bold text-slate-900 border-b border-slate-100 pb-3 mb-3 flex items-center justify-between">
                <span>Festius del Curs</span>
                <span className="text-xs bg-indigo-50 text-indigo-600 font-bold px-2 py-0.5 rounded-full">
                  {state.config.holidays.length}
                </span>
              </h3>
              <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
                {state.config.holidays.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-6">No s'han registrat dies festius.</p>
                ) : (
                  state.config.holidays.map((h, hIdx) => (
                    <div key={`${h.date}_${hIdx}`} className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-100 rounded-xl">
                      <div>
                        <p className="text-xs font-bold text-slate-800">{h.label}</p>
                        <p className="text-[10px] font-mono text-slate-400 mt-0.5">
                          {h.endDate && h.endDate !== h.date ? `${h.date} al ${h.endDate}` : h.date}
                        </p>
                      </div>
                      <button
                        id={`btn-remove-holiday-${h.date}`}
                        onClick={() => handleRemoveHoliday(h.date)}
                        className="p-1 text-slate-400 hover:text-rose-500 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
        ) : (
          <div id="panel-hours" className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fadeIn">
          {/* List of timeslots */}
          <div className="lg:col-span-2 space-y-6 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <h3 className="font-bold text-slate-900 border-b border-slate-100 pb-3 mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5 text-indigo-500" />
              <span>Franges Horàries d'un dia escolar</span>
            </h3>
            
            <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
              {state.config.timeSlots.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-12">Encara no hi ha hores escolar definides.</p>
              ) : (
                state.config.timeSlots.map((ts, i) => (
                  <div key={ts.id} className="flex items-center justify-between p-3.5 bg-indigo-500/[0.02] border border-slate-150 rounded-xl hover:border-slate-200 transition-colors">
                    <div className="flex items-center space-x-3.5">
                      <span className="w-7 h-7 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center text-xs font-bold">
                        {i + 1}
                      </span>
                      <div>
                        <p className="text-sm font-bold text-slate-800 leading-tight">{ts.name}</p>
                        {ts.startTime && ts.endTime && (
                          <p className="text-xs font-mono font-medium text-slate-500 mt-1">Hora: {ts.startTime} - {ts.endTime}</p>
                        )}
                      </div>
                    </div>
                    <button
                      id={`btn-remove-slot-${ts.id}`}
                      onClick={() => handleRemoveTimeSlot(ts.id)}
                      className="p-1.5 text-slate-450 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                      title="Eliminar aquesta franja"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Quick schedule checklist overview */}
            <div className="border-t border-slate-100 pt-6 mt-6">
              <h4 className="font-bold text-sm text-slate-800 mb-3">Grel·la de Vinculació Setmanal Activa</h4>
              <p className="text-xs text-slate-500 mb-4">
                Assigneu assignatures o accions docents a les hores setmanals del vostre calendari.
              </p>
              
              <div className="overflow-x-auto border border-slate-150 rounded-xl">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-150">
                      <th className="p-2.5 text-[10px] font-bold uppercase text-slate-400 border-r border-slate-150">Franja</th>
                      {['Dl', 'Dm', 'Dc', 'Dj', 'Dv'].map((d, i) => (
                        <th key={i} className="p-2.5 text-[10px] font-bold uppercase text-slate-400 text-center border-r border-slate-150 last:border-r-0">{d}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {state.config.timeSlots.map(slot => (
                      <tr key={slot.id} className="border-b border-slate-100 last:border-b-0">
                        <td className="p-2 border-r border-slate-150 font-medium text-xs text-slate-700 bg-slate-50/20">{slot.name}</td>
                        {[1, 2, 3, 4, 5].map(dayNum => {
                          const item = state.schedule.find(s => s.dayOfWeek === dayNum && s.timeSlotId === slot.id);
                          const subject = item ? state.subjects.find(s => s.id === item.subjectId) : null;
                          return (
                            <td key={dayNum} className="p-1.5 text-center border-r border-slate-150 last:border-r-0">
                              {subject ? (
                                <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-bold text-white shadow-sm" style={{ backgroundColor: subject.color }}>
                                  <span className="truncate max-w-[85px]">{subject.name}</span>
                                  <button
                                    onClick={() => handleUnlinkCell(dayNum, slot.id)}
                                    className="p-0.5 hover:bg-black/20 rounded cursor-pointer"
                                    title="Desvincular"
                                  >
                                    ×
                                  </button>
                                </div>
                              ) : (
                                <span className="text-[9px] text-slate-300">-</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Timeslot creator & Link builder */}
          <div className="space-y-6">
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
              <h3 className="font-bold text-slate-900 border-b border-slate-100 pb-3 mb-4">Nova Franja d'Hora</h3>
              <form onSubmit={handleAddTimeSlot} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5">Informació / Nom de la Franja</label>
                  <input
                    id="input-slot-name"
                    required
                    placeholder="ex. 1a Hora (8:00 - 9:00), Pati o Esbarjo"
                    value={newSlotName}
                    onChange={(e) => setNewSlotName(e.target.value)}
                    className="w-full text-slate-800 text-sm p-3 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <button
                  id="btn-add-timeslot"
                  type="submit"
                  className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl cursor-pointer"
                >
                  Afegir Franja
                </button>
              </form>
            </div>

            {/* Timetable builder binder */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
              <h3 className="font-bold text-slate-900 border-b border-slate-100 pb-3 mb-4">Vincular Hora d'Horari</h3>
              {state.config.timeSlots.length === 0 || state.subjects.length === 0 ? (
                <p className="text-xs text-slate-400 italic">Necessiteu tenir assignatures i franges definides per poder vincular calendaris.</p>
              ) : (
                <form onSubmit={handleLinkSchedule} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1.5">Dia de la Setmana</label>
                    <select
                      id="select-alloc-day"
                      value={allocDay}
                      onChange={(e) => setAllocDay(parseInt(e.target.value))}
                      className="w-full text-slate-800 text-sm p-3 border border-slate-200 rounded-xl bg-white"
                    >
                      <option value={1}>Dilluns</option>
                      <option value={2}>Dimarts</option>
                      <option value={3}>Dimecres</option>
                      <option value={4}>Dijous</option>
                      <option value={5}>Divendres</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1.5">Franja d'Hora</label>
                    <select
                      id="select-alloc-slot"
                      value={allocSlot}
                      onChange={(e) => setAllocSlot(e.target.value)}
                      className="w-full text-slate-800 text-sm p-3 border border-slate-200 rounded-xl bg-white"
                    >
                      <option value="" disabled>Selecciona...</option>
                      {state.config.timeSlots.map(ts => (
                        <option key={ts.id} value={ts.id}>
                          {ts.name} {ts.startTime && ts.endTime ? `(${ts.startTime}-${ts.endTime})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1.5">Assignatura o Acció</label>
                    <select
                      id="select-alloc-sub"
                      value={allocSubject}
                      onChange={(e) => setAllocSubject(e.target.value)}
                      className="w-full text-slate-800 text-sm p-3 border border-slate-200 rounded-xl bg-white"
                    >
                      <option value="" disabled>Selecciona...</option>
                      {state.subjects.map(sub => (
                        <option key={sub.id} value={sub.id}>
                          {sub.isGeneral ? 'Acció General  ' : 'Sg  '} {sub.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <button
                    id="btn-link-schedule"
                    type="submit"
                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md transition-all"
                  >
                    Vincular a l'Horari
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
          )}
        </div>
      )}

      {/* ==========================================
          TAB 3 PANEL: SUBJECTS & BULK ALUMNI
          ========================================== */}
      {activeTab === 'subjects' && (
        <div id="panel-subjects" className="space-y-4">
          {/* Subjects Directory */}
          <button className="ds-button ds-primary" onClick={() => setIsCreatingSubject(true)}>Nova assignatura</button>
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
              <h3 className="font-bold text-slate-900 border-b border-slate-100 pb-3 mb-4 flex items-center gap-2">
                <Users className="w-5 h-5 text-indigo-500" />
                <span>Docents, Assignatures i Alumnes</span>
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {state.subjects.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-12 md:col-span-2">No hi ha assignatures definides encara.</p>
                ) : (
                  state.subjects.map((sub) => {
                    const parent = sub.parentId ? state.subjects.find(s => s.id === sub.parentId) : null;
                    return (
                      <div
                        key={sub.id}
                        className="bg-slate-50 border border-slate-200 rounded-xl p-4.5 space-y-3 flex flex-col justify-between"
                        style={{ borderLeft: `5px solid ${sub.color}` }}
                      >
                        <div>
                          <div className="flex items-start justify-between">
                            <span className="text-[9px] font-extrabold uppercase px-2 py-0.5 rounded shadow-sm" style={{ color: sub.color, backgroundColor: `${sub.color}15` }}>
                              {sub.isGeneral ? 'Acció General' : sub.isParent ? 'Grup Mare' : 'Assignatura'}
                            </span>
                            <div className="flex items-center space-x-1">
                              {!sub.isGeneral && !sub.isParent && (
                                <button
                                  onClick={() => startReimport(sub)}
                                  className="p-1 hover:bg-slate-200 text-indigo-600 rounded"
                                  title="Gestionar alumnat de l'aula"
                                >
                                  <Users className="w-3.5 h-3.5" />
                                </button>
                              )}
                              <button
                                onClick={() => startEditingSubject(sub)}
                                className="ds-button text-blue-700"
                                title="Configurar assignatura, ítems i llindars de notes"
                              >
                                <Edit2 className="w-3.5 h-3.5" /> Configurar
                              </button>
                              <button
                                id={`btn-remove-sub-${sub.id}`}
                                onClick={() => handleRemoveSubject(sub.id)}
                                className="p-1 hover:bg-slate-200 text-rose-500 rounded"
                                title="Eliminar"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          <h4 className="text-sm font-bold text-slate-800 tracking-tight mt-1.5 leading-tight">{sub.name}</h4>
                          
                          {parent && (
                            <p className="text-[10px] text-indigo-600 font-medium mt-1 inline-flex items-center gap-1 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                              <FolderTree className="w-3 h-3" />
                              <span>Hereta de: {parent.name}</span>
                            </p>
                          )}
                        </div>

                        {/* Pupils list count */}
                        <div className="border-t border-slate-150 pt-2.5 flex items-center justify-between text-[11px] text-slate-500 font-medium">
                          <span>
                            {sub.isGeneral 
                              ? 'Sense alumnat (General)' 
                              : sub.isParent
                                ? 'Sense alumnat (Grup Mare)'
                                : `${sub.students.length} alumnes`}
                          </span>
                          {!sub.isGeneral && !sub.isParent && (
                            <button
                              onClick={() => startReimport(sub)}
                              className="text-[10px] font-bold text-indigo-600 hover:underline"
                            >
                              Gestionar llista
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Mass Pupil importer overlay modal helper */}
            {/* Simultaneous multi-subject assignment card */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm mt-6">
              <h3 className="font-bold text-slate-900 border-b border-slate-100 pb-3 mb-4 flex items-center gap-2">
                <Users className="w-5 h-5 text-indigo-550" />
                <span>Assignació Massiva Multi-Assignatura</span>
              </h3>
              <p className="text-[11px] text-slate-500 -mt-2.5 mb-3 leading-relaxed">
                Assigneu els mateixos alumnes a múltiples matèries i aules alhora. S'afegiran només aquells alumnes que no estiguin ja matriculats a la matèria corresponent per evitar repeticions.
              </p>

              <form onSubmit={handleExecuteBulkMultiAssign} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5 font-mono">
                    Llista d'Alumnes a Assignar (un per línia, o separats per ;)
                  </label>
                  <textarea
                    id="textarea-bulk-assign-names"
                    placeholder="García, Ana&#10;Rius, Jordi&#10;Martí, Clara"
                    value={bulkAssignStudentsText}
                    onChange={(e) => setBulkAssignStudentsText(e.target.value)}
                    className="w-full text-xs p-3 border border-slate-205 rounded-xl bg-slate-50 h-28 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-white resize-none"
                  />
                </div>

                {/* File Upload Selector */}
                <div className="bg-indigo-50/50 p-4.5 rounded-xl border border-indigo-150 space-y-2">
                  <label htmlFor="bulk-subject-csv-uploader" className="text-[10px] uppercase tracking-wider text-indigo-750 font-bold block">
                    📂 O carregar des d'un fitxer (.csv o .txt)
                  </label>
                  <input
                    id="bulk-subject-csv-uploader"
                    type="file"
                    accept=".csv,.txt"
                    className="text-xs text-slate-605 font-medium cursor-pointer block file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-indigo-600 file:text-white hover:file:bg-indigo-700 transition"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = (evt) => {
                        const text = evt.target?.result as string;
                        // Split text by newlines and semicolons, trim and filter
                        const lines = text.split(/[\r\n;]+/).map(line => line.trim()).filter(Boolean);
                        setBulkAssignStudentsText(prev => {
                          const trimComp = prev.trim();
                          return trimComp ? `${trimComp}\n${lines.join('\n')}` : lines.join('\n');
                        });
                      };
                      reader.readAsText(file);
                    }}
                  />
                  <span className="block text-[10px] text-slate-400">Podeu penjar qualsevol document on els noms estiguin separats per salt de línia o punt i coma (;).</span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-550 mb-1.5">
                    Seleccioneu Assignatures de destí
                  </label>
                  {state.subjects.filter(s => !s.isGeneral && !s.isParent).length === 0 ? (
                    <p className="text-xs text-slate-400 italic">No hi ha assignatures vàlides per rebre alumnes.</p>
                  ) : (
                    <div className="space-y-1.5 max-h-40 overflow-y-auto border border-slate-150 p-3 rounded-lg bg-slate-50/50">
                      {state.subjects.filter(s => !s.isGeneral && !s.isParent).map(sub => (
                        <label key={sub.id} className="flex items-center space-x-2 text-xs text-slate-700 cursor-pointer p-1 rounded hover:bg-slate-100 font-bold">
                          <input
                            type="checkbox"
                            checked={bulkAssignSelectedSubIds.includes(sub.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setBulkAssignSelectedSubIds(prev => [...prev, sub.id]);
                              } else {
                                setBulkAssignSelectedSubIds(prev => prev.filter(id => id !== sub.id));
                              }
                            }}
                            className="rounded border-slate-350 text-indigo-600 focus:ring-indigo-500"
                          />
                          <span className="w-2.5 h-2.5 rounded-full inline-block shrink-0" style={{ backgroundColor: sub.color }} />
                          <span className="truncate">{sub.name}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={state.subjects.filter(s => !s.isGeneral && !s.isParent).length === 0}
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer"
                >
                  Afegir Alumnat Simultàniament
                </button>
              </form>
            </div>
          </div>

        </div>
      )}

      {/* ==========================================
          TAB 4 PANEL: COMPETENCIES & EVAL CRITERIA
          ========================================== */}
      {activeTab === 'competencies' && (
        <div id="panel-competencies" className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fadeIn">
          {/* Main Area: Select Group and View its rubrics */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-tight mb-2">Seleccioneu Assignatura, Mòdul o Grup</label>
              <select
                id="select-competency-subject"
                value={activeCompSubId}
                onChange={(e) => {
                  setActiveCompSubId(e.target.value);
                  setCritCompId('');
                }}
                className="w-full text-slate-800 text-sm p-3 border border-slate-200 rounded-xl bg-white"
              >
                <option value="" disabled>Triar assignatura...</option>
                {state.subjects.filter(sub => !sub.isGeneral).map(sub => (
                  <option key={sub.id} value={sub.id}>{sub.name}</option>
                ))}
              </select>
            </div>

            {selectedSubjectForComp && <CriteriaLabels state={state} subjectId={effectiveCompSubId} onChange={onChangeState} onEdit={setCurriculumEdit} />}
            {selectedSubjectForComp && (
              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b pb-4 mb-2 gap-2">
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">Competències Específiques i Criteris</h3>
                    <p className="text-xs text-slate-500 mt-1">Rubrica de l'assignatura seleccionada</p>
                  </div>
                  {parentOfSelectedSubject && (
                    <span className="text-[10px] bg-blue-50 text-blue-600 font-extrabold px-3 py-1 rounded-full border border-blue-150">
                      Grup vinculat mare: {parentOfSelectedSubject.name}
                    </span>
                  )}
                </div>

                {/* Show Inherited / Link banner */}
                {parentOfSelectedSubject && (
                  <div className="bg-blue-50/55 border border-blue-100 p-3.5 rounded-xl text-xs text-blue-800">
                     Les competències i criteris d'aquest grup estan vinculats directament al grup mare <b>{parentOfSelectedSubject.name}</b>. Qualsevol modificació es realitzarà per a ambdós de manera única.
                  </div>
                )}

                {/* Direct Competencies List */}
                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    {parentOfSelectedSubject ? 'Competències Compartides' : 'Competències del Grup'}
                  </h4>

                  {directCompetencies.length === 0 ? (
                    <p className="text-xs text-slate-400 italic text-center py-6">No hi ha competències directes creades per a aquest grup.</p>
                  ) : (
                    directCompetencies.map(comp => {
                      const directCrit = state.criteria.filter(cr => cr.competencyId === comp.id);
                      return (
                        <div key={comp.id} className="bg-slate-50/50 p-4 border border-slate-200 rounded-xl space-y-4">
                          <div className="flex items-start justify-between">
                            <div>
                              <span className="font-mono font-bold text-xs bg-indigo-50 text-indigo-600 px-2.5 py-0.5 rounded border border-indigo-150">{comp.key}</span>
                              <p className="text-sm font-bold text-slate-800 mt-2">{comp.description}</p>
                            </div>
                            <div className="flex items-center space-x-1.5 flex-shrink-0">
                              <button
                                id={`btn-prep-crit-${comp.id}`}
                                onClick={() => handlePrepareCriterionForComp(comp.id)}
                                className="flex items-center space-x-1 px-2.5 py-1 text-[10px] font-bold text-indigo-600 bg-white hover:bg-slate-150 rounded border border-slate-200"
                              >
                                <Plus className="w-3 h-3" />
                                <span>Nou criterio</span>
                              </button>
                              <button
                                id={`btn-remove-comp-${comp.id}`}
                                onClick={() => handleRemoveCompetency(comp.id)}
                                className="p-1 text-slate-400 hover:text-rose-600 hover:bg-white rounded transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* Criterion inline form */}
                          {critCompId === comp.id && (
                            <form onSubmit={handleCreateCriterion} className="bg-white border rounded-lg p-3 space-y-3.5 animate-fadeIn">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] uppercase font-bold text-indigo-600">Crear criteri per {comp.key}</span>
                                <button type="button" onClick={() => setCritCompId('')} className="text-[9px] text-rose-500 font-extrabold hover:underline">Tancar</button>
                              </div>
                              <div className="grid grid-cols-3 gap-2">
                                <div className="col-span-1">
                                  <label className="block text-[9px] uppercase font-bold text-slate-400 mb-1">Codi (ID)</label>
                                  <input
                                    type="text"
                                    required
                                    value={newCritKey}
                                    onChange={(e) => setNewCritKey(e.target.value)}
                                    className="w-full text-slate-800 text-xs p-1.5 border rounded"
                                  />
                                </div>
                                <div className="col-span-2">
                                  <label className="block text-[9px] uppercase font-bold text-slate-400 mb-1">Descripció detallada del criteri</label>
                                  <input
                                    type="text"
                                    required
                                    placeholder="ex. Sap codificar bucles niats"
                                    value={newCritDesc}
                                    onChange={(e) => setNewCritDesc(e.target.value)}
                                    className="w-full text-slate-800 text-xs p-1.5 border rounded"
                                  />
                                </div>
                              </div>
                              <button type="submit" className="w-full py-1.5 bg-indigo-500 hover:bg-indigo-600 text-white font-bold text-xs rounded">
                                Desar criteri
                              </button>
                            </form>
                          )}

                          {/* Evaluation Criteria List */}
                          <div className="pl-4 border-l-2 border-indigo-400/30 space-y-2">
                            {directCrit.length === 0 ? (
                              <p className="text-[11px] text-slate-400 italic">No té criteris de d'avaluació enllaçats.</p>
                            ) : (
                              directCrit.map(cr => (
                                <div key={cr.id} className="flex items-center justify-between text-xs text-slate-650 bg-white p-2 border rounded border-slate-150">
                                  <span className="leading-relaxed">
                                    <b className="font-mono text-indigo-700 bg-slate-50 px-1 py-0.5 rounded mr-1 text-[10px]">{cr.key}:</b> {cr.description}
                                  </span>
                                  <button
                                    id={`btn-remove-crit-${cr.id}`}
                                    onClick={() => handleRemoveCriterion(cr.id)}
                                    className="p-0.5 text-slate-350 hover:text-rose-500 hover:bg-slate-50 rounded transition-colors"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Competency Creator Setup */}
          <div className="space-y-6">
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
              <h3 className="font-bold text-slate-900 border-b border-slate-100 pb-3 mb-4">Creador de Competències</h3>
              <form onSubmit={handleCreateCompetency} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Prefix de codi d'identificador</label>
                  <div className="flex items-center space-x-2">
                    <input
                      id="input-comp-prefix"
                      type="text"
                      placeholder="ex. CEProg, CEBBDD"
                      value={compPrefix}
                      onChange={(e) => setCompPrefix(e.target.value)}
                      className="w-full text-slate-850 text-xs p-3.5 border border-slate-200 rounded-xl"
                    />
                    <button
                      type="button"
                      onClick={handleAutoSuggestKey}
                      className="p-3 bg-indigo-50 text-indigo-650 border border-indigo-200 rounded-xl text-xs font-bold hover:bg-indigo-100"
                      title="Generar codi auto-incrementat"
                    >
                      Generar Codi
                    </button>
                  </div>
                  <span className="block text-[10px] text-slate-400 mt-1">
                    Es calcularà l'identificador numèric següent a partir del prefix (CEProg1, CEProg2).
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Identificador Final (Suggerit)</label>
                  <input
                    id="input-comp-customkey"
                    type="text"
                    placeholder={`ex. ${compPrefix}1 (deixar buit per al suggerit)`}
                    value={customCompKey}
                    onChange={(e) => setCustomCompKey(e.target.value)}
                    className="w-full text-slate-800 text-xs p-3 border border-slate-200 rounded-xl font-mono bg-slate-50"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Podeu sempre re-escriure o canviar aquest identificador manualment.</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5">Descripció detallada de la Competència</label>
                  <textarea
                    id="textarea-comp-desc"
                    required
                    placeholder="Desenvolupar aplicacions web assegurant interoperabilitat mitjançant APIs modulars..."
                    value={newCompDesc}
                    onChange={(e) => setNewCompDesc(e.target.value)}
                    className="w-full text-xs p-3 border border-slate-250 rounded-xl h-24 focus:bg-white resize-none"
                  />
                </div>

                <button
                  id="btn-add-competency"
                  type="submit"
                  className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md transition-all"
                >
                  Afegir Competència a l'Aula
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ==========================================
          TAB 5 PANEL: SUBSTITUTIONS
          ========================================== */}
      {activeTab === 'substitutions' && (
        <div id="panel-substitutions" className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fadeIn text-slate-800">
          {/* List of Substitutions */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
              <h3 className="font-bold text-slate-900 border-b border-slate-100 pb-3 mb-4 flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <RefreshCw className="w-5 h-5 text-indigo-505" />
                  <span>Substitucions i Canvis de Franja Actius</span>
                </span>
                <span className="text-xs font-semibold text-slate-400">({(state.config.substitutions || []).length} programades)</span>
              </h3>
              
              <div className="space-y-3.5 max-h-[500px] overflow-y-auto pr-1">
                {(!state.config.substitutions || state.config.substitutions.length === 0) ? (
                  <p className="text-xs text-slate-400 italic text-center py-12">No hi ha cap substitució o canvi de franja programat per a aquest curs.</p>
                ) : (
                  [...(state.config.substitutions || [])].sort((a,b) => a.date.localeCompare(b.date)).map((sub) => {
                    const slot = state.config.timeSlots.find(ts => ts.id === sub.timeSlotId);
                    const subSubject = sub.subjectId ? state.subjects.find(s => s.id === sub.subjectId) : null;
                    return (
                      <div key={sub.id} className="flex items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-xl hover:border-slate-300 transition-all gap-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-bold text-slate-900 uppercase">
                              {sub.date} • {slot ? slot.name : 'Hora Desconeguda'} {slot && slot.startTime && slot.endTime ? `(${slot.startTime}-${slot.endTime})` : ''}
                            </span>
                          </div>
                          <div className="text-xs font-medium text-slate-650">
                            {sub.type === 'subject' ? (
                              <span className="inline-flex items-center gap-1.5">
                                <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: subSubject?.color || '#cbd5e1' }} />
                                Matèria reemplaçada: <b>{subSubject ? subSubject.name : 'Desconeguda'}</b>
                              </span>
                            ) : (
                              <span>Altres reemplaçaments: <b className="text-slate-700 italic">"{sub.customReason}"</b></span>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => handleRemoveSubstitution(sub.id)}
                          className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer shrink-0"
                          title="Eliminar substitució"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* Create substitution */}
          <div className="space-y-6">
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
              <h3 className="font-bold text-slate-900 border-b border-slate-100 pb-3 mb-4">
                Programar Substitució o Canvi
              </h3>
              
              <form onSubmit={handleAddSubstitution} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5">Data del Canvi</label>
                  <input
                    type="date"
                    required
                    value={subDate}
                    onChange={(e) => setSubDate(e.target.value)}
                    className="w-full text-slate-800 text-xs p-3 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-505"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5">Selecciona Franja d'Hora</label>
                  <select
                    required
                    value={subTimeSlotId}
                    onChange={(e) => setSubTimeSlotId(e.target.value)}
                    className="w-full text-slate-800 text-xs p-3 border border-slate-200 rounded-xl bg-white font-semibold"
                  >
                    <option value="">-- Tria una franja --</option>
                    {state.config.timeSlots.map(ts => (
                      <option key={ts.id} value={ts.id}>
                        {ts.name} {ts.startTime && ts.endTime ? `(${ts.startTime} - {ts.endTime})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-505 mb-1.5">Tipus de Reemplaçament</label>
                  <div className="flex gap-4 p-2.5 bg-slate-50 border rounded-xl">
                    <label className="flex items-center space-x-2 text-xs font-bold text-slate-750 cursor-pointer">
                      <input
                        type="radio"
                        name="subtype-select"
                        checked={subType === 'subject'}
                        onChange={() => setSubType('subject')}
                        className="text-indigo-650 focus:ring-indigo-505 rounded-full"
                      />
                      <span>Nova Matèria</span>
                    </label>
                    <label className="flex items-center space-x-2 text-xs font-bold text-slate-750 cursor-pointer">
                      <input
                        type="radio"
                        name="subtype-select"
                        checked={subType === 'other'}
                        onChange={() => setSubType('other')}
                        className="text-indigo-650 focus:ring-indigo-505 rounded-full"
                      />
                      <span>Altres (motiu lliure)</span>
                    </label>
                  </div>
                </div>

                {subType === 'subject' ? (
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1.5">Matèria a impartir</label>
                    <select
                      value={subSubjectId}
                      onChange={(e) => setSubSubjectId(e.target.value)}
                      className="w-full text-slate-800 text-xs p-3 border border-slate-200 rounded-xl bg-white font-semibold"
                    >
                      <option value="">-- Tria matèria --</option>
                      {state.subjects.map(sub => (
                        <option key={sub.id} value={sub.id}>{sub.name}</option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1.5">Motiu del Canvi</label>
                    <input
                      type="text"
                      placeholder="Indiqueu el motiu lliure..."
                      value={subCustomReason}
                      onChange={(e) => setSubCustomReason(e.target.value)}
                      className="w-full text-slate-800 text-xs p-3 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-none"
                    />
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl cursor-pointer"
                >
                  Confirmar Substitució
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ==========================================
          TAB 6 PANEL: NOTIFICATIONS
          ========================================== */}
      {activeTab === 'notifications' && (
        <div id="panel-notifications" className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fadeIn text-slate-800">
          {/* Automatic Class Notifications Settings */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
              <h3 className="font-bold text-slate-900 border-b border-slate-100 pb-3 mb-4 flex items-center gap-2">
                <Bell className="w-5 h-5 text-indigo-500" />
                <span>Notificacions Automàtiques de Classes</span>
              </h3>
              <p className="text-xs text-slate-500 mb-4">
                El sistema comprova el vostre horari de classes i us notifica les properes sessions programades.
              </p>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between bg-slate-50 p-4 border rounded-xl">
                  <div>
                    <span className="block text-xs font-bold text-slate-808">Activar Avisos Automàtics</span>
                    <span className="block text-[10px] text-slate-400 mt-0.5">Avisa'm abans de començar una classe de l'horari</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={state.config.autoClassNotifications ?? true}
                    onChange={(e) => updateConfigState(draft => {
                      (draft as any).autoClassNotifications = e.target.checked;
                    })}
                    className="w-4 h-4 rounded text-indigo-650 focus:ring-indigo-505 border-slate-300 cursor-pointer"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-505 mb-1.5">Antelació per defecte (en minuts)</label>
                  <select
                    value={state.config.autoClassNotificationMinutes ?? 15}
                    onChange={(e) => updateConfigState(draft => {
                      (draft as any).autoClassNotificationMinutes = parseInt(e.target.value);
                    })}
                    className="w-full text-slate-800 text-xs p-3 border border-slate-200 rounded-xl bg-white font-semibold"
                  >
                    <option value={5}>5 minuts abans</option>
                    <option value={10}>10 minuts abans</option>
                    <option value={15}>15 minuts abans</option>
                    <option value={30}>30 minuts abans</option>
                    <option value={60}>1 hora abans</option>
                  </select>
                </div>
              </div>
            </div>

            {/* List of Custom User Configured Reminders */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
              <h3 className="font-bold text-slate-900 border-b border-slate-100 pb-3 mb-4 flex items-center justify-between">
                <span>Recordatoris i Tasques Pendents</span>
                <span className="text-xs font-semibold text-slate-400">({(state.config.reminders ?? []).length} programats)</span>
              </h3>

              <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                {(!state.config.reminders || state.config.reminders.length === 0) ? (
                  <p className="text-xs text-slate-400 italic text-center py-8">No teniu cap recordatori programat encara.</p>
                ) : (
                  [...state.config.reminders].sort((a,b) => a.date.localeCompare(b.date)).map((rem) => (
                    <div key={rem.id} className="flex items-center justify-between p-3.5 bg-slate-50 border rounded-xl hover:border-slate-300 transition gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`text-[8.5px] uppercase font-extrabold px-1.5 py-0.5 rounded ${
                            rem.type === 'class' ? 'bg-blue-100 text-blue-700' :
                            rem.type === 'calendar' ? 'bg-indigo-100 text-indigo-705' : 'bg-amber-100 text-amber-705'
                          }`}>
                            {rem.type === 'class' ? 'Classe' : rem.type === 'calendar' ? 'Calendari' : 'Tasca'}
                          </span>
                          <span className="text-xs font-bold text-slate-900 leading-tight">{rem.title}</span>
                        </div>
                        <p className="text-[10px] text-slate-400 font-medium font-mono">
                          Data: <b>{rem.date}</b> {rem.time ? `• Hora: ${rem.time}` : ''} • Antelació: <b>{rem.advanceMinutes}m</b>
                        </p>
                      </div>

                      <div className="flex items-center space-x-2 shrink-0">
                        {/* Status Toggle */}
                        <button
                          onClick={() => {
                            const nextRems = (state.config.reminders ?? []).map(r => r.id === rem.id ? { ...r, active: !r.active } : r);
                            updateConfigState(draft => { draft.reminders = nextRems; });
                          }}
                          className={`px-2.5 py-1 text-[10px] font-extrabold rounded-lg border transition cursor-pointer ${
                            rem.active 
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-250 hover:bg-emerald-100'
                              : 'bg-slate-100 text-slate-400 border-slate-200 hover:bg-slate-150'
                          }`}
                        >
                          {rem.active ? 'Actiu' : 'Desactivat'}
                        </button>
                        {/* Remove */}
                        <button
                          onClick={() => {
                            const nextRems = (state.config.reminders ?? []).filter(r => r.id !== rem.id);
                            updateConfigState(draft => { draft.reminders = nextRems; });
                          }}
                          className="p-1.5 bg-rose-50 text-rose-500 hover:bg-rose-100 rounded-lg transition cursor-pointer"
                          title="Eliminar recordatori"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* New Custom Reminder Creator Form */}
          <div className="space-y-6">
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
              <h3 className="font-bold text-slate-900 border-b border-slate-100 pb-3 mb-4">
                Afegir Nou Recordatori
              </h3>
              
              <form onSubmit={handleAddReminder} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5">Títol de la Notificació</label>
                  <input
                    type="text"
                    required
                    placeholder="ex. Marcar exàmens M6, Guàrdia d'Examen"
                    value={remTitle}
                    onChange={(e) => setRemTitle(e.target.value)}
                    className="w-full text-slate-800 text-xs p-3 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1.5">Data</label>
                    <input
                      type="date"
                      required
                      value={remDate}
                      onChange={(e) => setRemDate(e.target.value)}
                      className="w-full text-slate-800 text-xs p-3 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1.5">Hora <span className="text-[10px] text-slate-400">(opcional)</span></label>
                    <input
                      type="time"
                      value={remTime}
                      onChange={(e) => setRemTime(e.target.value)}
                      className="w-full text-slate-800 text-xs p-3 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-550 mb-1.5">Tipus</label>
                    <select
                      value={remType}
                      onChange={(e) => setRemType(e.target.value as any)}
                      className="w-full text-slate-800 text-xs p-3 border border-slate-200 rounded-xl bg-white font-semibold"
                    >
                      <option value="class">Classe</option>
                      <option value="calendar">Calendari</option>
                      <option value="todo">Tasca pendent</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-550 mb-1.5">Antelació (minuts)</label>
                    <select
                      value={remAdvance}
                      onChange={(e) => setRemAdvance(parseInt(e.target.value))}
                      className="w-full text-slate-800 text-xs p-3 border border-slate-200 rounded-xl bg-white font-semibold"
                    >
                      <option value={0}>Sense antelació</option>
                      <option value={5}>5 minuts</option>
                      <option value={10}>10 minuts</option>
                      <option value={15}>15 minuts</option>
                      <option value={30}>30 minuts</option>
                      <option value={60}>60 minuts (1H)</option>
                    </select>
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md transition font-semibold cursor-pointer"
                >
                  Confirmar Recordatori
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'persistence' && (
        <div id="panel-persistence" className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-fadeIn">
          {/* Card 1: File link / Local storage */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
            <div>
              <h3 className="font-bold text-slate-900 border-b border-slate-100 pb-3 mb-4 flex items-center gap-2">
                <HardDrive className="w-5 h-5 text-blue-500" />
                <span>Enllaç de Fitxer en Disc (Persistència Nativa)</span>
              </h3>
              
              <p className="text-xs text-slate-505 leading-relaxed mb-4">
                Pots enllaçar un fitxer JSON del teu ordinador directament amb DocentSuite. Això permet que tots els canvis es desin de forma directa i persistent a l'arxiu local del teu disc dur (auto-desat) sense passar per cap servidor.
              </p>

              {linkedFileName ? (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-3 mb-4">
                  <div className="flex items-center space-x-2 text-emerald-800">
                    <Database className="w-5 h-5 text-emerald-600 shrink-0" />
                    <div>
                      <p className="text-xs font-extrabold font-sans">FITXER ENLLAÇAT CORRECTAMENT</p>
                      <p className="text-[11px] font-bold font-mono text-emerald-700 bg-white/60 px-2 py-0.5 rounded border border-emerald-100 mt-1 block truncate">
                        {linkedFileName}
                      </p>
                    </div>
                  </div>
                  <p className="text-[10px] text-emerald-600 leading-relaxed">
                    Totes les modificacions de grups, sessions de classe, plànols o qualificacions que facis es guarden immediatament en aquest arxiu del teu ordinador.
                  </p>
                </div>
              ) : (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3 mb-4">
                  <div className="flex items-start space-x-2 text-amber-800">
                    <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-extrabold font-sans">EMMAGATZEMATGE LOCAL DEL NAVEGADOR</p>
                      <p className="text-[10.5px] text-amber-700 mt-1 leading-normal">
                        La informació s'està emmagatzemant temporalment a la memòria de seguretat local d'aquest navegador.
                      </p>
                    </div>
                  </div>
                  <p className="text-[10px] text-amber-600 leading-relaxed">
                    Es recomana vincular un arxiu del teu disc dur per garantir que no es perdin els canvis si neteges la memòria de l'historial o el navegador.
                  </p>
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-slate-100 mt-4">
              {linkedFileName ? (
                <button
                  id="btn-persistence-disconnect"
                  type="button"
                  onClick={onDisconnectFile}
                  className="w-full flex items-center justify-center space-x-1.5 px-4 py-3 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl transition-all cursor-pointer"
                >
                  <FileMinus className="w-4 h-4" />
                  <span>Desconnectar i Alliberar Fitxer</span>
                </button>
              ) : (
                <button
                  id="btn-persistence-connect"
                  type="button"
                  onClick={onSelectFile}
                  className="w-full flex items-center justify-center space-x-1.5 px-4 py-3 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md shadow-blue-600/10 transition-all cursor-pointer"
                >
                  <HardDrive className="w-4 h-4" />
                  <span>Registrar i Enllaçar Fitxer .json</span>
                </button>
              )}
            </div>
          </div>

          {/* Card 2: Backup Manual Export / Import */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
            <div>
              <h3 className="font-bold text-slate-900 border-b border-slate-100 pb-3 mb-4 flex items-center gap-2">
                <FileJson className="w-5 h-5 text-indigo-500" />
                <span>Còpies de Seguretat de l'Assignatura (Manuals)</span>
              </h3>
              
              <p className="text-xs text-slate-500 leading-relaxed mb-6">
                Descarrega o puja una còpia manual en qualsevol moment. Ideal per traslladar la teva feina d'un ordinador a un altre, fer còpies de seguretat redundants o compartir dades amb altres equips docents de l'institut.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="border border-slate-100 hover:border-slate-200 rounded-xl p-4 bg-slate-50 flex flex-col justify-between space-y-3">
                  <div>
                    <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <Download className="w-4 h-4 text-blue-500" />
                      <span>Exportar JSON</span>
                    </h4>
                    <p className="text-[10px] text-slate-400 mt-1 leading-normal">
                      Exporta totes les teves configuracions actuals del curs i registres de notes en un fitxer de còpia JSON.
                    </p>
                  </div>
                  <button
                    id="btn-persistence-export"
                    type="button"
                    onClick={onExportBackup}
                    className="w-full py-2 bg-white hover:bg-slate-100 text-slate-700 text-[11px] font-bold border border-slate-200 rounded-lg transition-colors cursor-pointer"
                  >
                    Exportar Dades
                  </button>
                </div>

                <div className="border border-slate-100 hover:border-slate-200 rounded-xl p-4 bg-slate-50 flex flex-col justify-between space-y-3">
                  <div>
                    <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <Upload className="w-4 h-4 text-indigo-500" />
                      <span>Carregar JSON</span>
                    </h4>
                    <p className="text-[10px] text-slate-400 mt-1 leading-normal">
                      Carrega un fitxer de còpia JSON prèviament guardat per restaurar la base de dades a l'estat anterior.
                    </p>
                  </div>
                  <button
                    id="btn-persistence-import"
                    type="button"
                    onClick={onImportBackup}
                    className="w-full py-2 bg-white hover:bg-slate-100 text-slate-700 text-[11px] font-bold border border-slate-200 rounded-lg transition-colors cursor-pointer"
                  >
                    Carregar dades
                  </button>
                </div>
              </div>
            </div>

            {/* Restablir Curs */}
            <div className="mt-6 pt-5 border-t border-slate-100 bg-red-500/5 -mx-6 -mb-6 p-6 rounded-b-2xl">
              <div className="flex items-start gap-3">
                <RotateCcw className="w-5 h-5 text-red-500 shrink-0 mt-0.5 animate-spin-reverse" />
                <div className="space-y-1 flex-1">
                  <h4 className="text-xs font-extrabold text-red-900 uppercase tracking-tight">Reiniciador del Sistema</h4>
                  <p className="text-[10px] text-red-750 leading-relaxed">
                    Aquesta opció esborrarà completament tots els grups, assistències, sessions realitzades, competències i qualificacions guardades de manera irreversible, i carregarà els grups ficticis de mostra per provar l'aplicació.
                  </p>
                  <button
                    id="btn-persistence-reset"
                    type="button"
                    onClick={onResetState}
                    className="mt-3 inline-flex items-center space-x-1.5 px-4 py-2 text-xs font-extrabold text-red-750 bg-white hover:bg-red-50 hover:text-red-800 border border-red-200 rounded-lg transition-all cursor-pointer"
                  >
                    <span>Reiniciar Curs de Mostra</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
