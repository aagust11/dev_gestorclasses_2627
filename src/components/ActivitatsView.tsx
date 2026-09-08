import ActivitiesOverview from './ActivitiesOverview';
import {resolveActivityStatus as resolveSharedActivityStatus} from '../utils/activityStatus';
import { sourceCriterionId, preserveLegacyCriterionGrades } from '../utils/activityCriteria';
import { RubricDescriptions } from '../types';
import { QUAL_ORDER } from '../utils/gradeCalculations';
import {getActivityScore, getCriterionScore} from '../utils/gradeCalculations';
import DetailPage from './DetailPage';
import ActivityGradePage from './ActivityGradePage';
import React, { useState, useMemo } from 'react';
import { 
  CheckSquare, 
  Plus, 
  Trash2, 
  ExternalLink, 
  Edit2, 
  Calendar, 
  Award, 
  Folder, 
  Tag, 
  FileText, 
  Check, 
  Sparkles,
  Link2,
  Trash,
  HelpCircle,
  Copy,
  Layers,
  Clock,
  ThumbsUp,
  AlertCircle,
  Download
} from 'lucide-react';
import { 
  AppState, 
  CurricularActivity, 
  Subject, 
  Student, 
  EvalCriterion, 
  ActivityStatus,
  ActivityResource, 
  Competency,
  StudentActivityGrade,
  StudentCriterionGrade 
} from '../types';
import { 
  QUAL_COLORS, 
  DEFAULT_COMP_SETTINGS, 
  scoreToCompetencial, 
  competencialToScore, 
  exportActivitiesToExcel 
} from '../utils/gradeCalculations';

interface ActivitatsViewProps {
  state: AppState;
  onChangeState: (nextState: AppState,base?:AppState) => boolean | void;
}

export default function ActivitatsView({ state, onChangeState }: ActivitatsViewProps) {
  const [showOverview,setShowOverview]=useState(true);
  // 1. Get subjects with valid students
  const validSubjects = useMemo(() => {
    return state.subjects.filter(s => !s.isGeneral);
  }, [state.subjects]);

  const [selectedSubId, setSelectedSubId] = useState<string>(() => {
    return validSubjects.find(s => !s.isParent)?.id || validSubjects[0]?.id || '';
  });

  const activeSubject = useMemo(() => {
    return state.subjects.find(s => s.id === selectedSubId);
  }, [selectedSubId, state.subjects]);

  // Handle Mother Group / Subgroup student lists
  const activeStudents = useMemo(() => {
    if (!activeSubject) return [];
    if (activeSubject.students.length > 0) return activeSubject.students;
    // If empty list and has parent, check parent's students
    if (activeSubject.parentId) {
      const parent = state.subjects.find(s => s.id === activeSubject.parentId);
      if (parent) return parent.students;
    }
    return [];
  }, [activeSubject, state.subjects]);

  // Find relevant criteria for this subject
  const relevantCriteria = useMemo(() => {
    if (!activeSubject) return [];
    // If it's a child subject, show criteria of both the child and its parent group
    const allowedSubjectIds = [activeSubject.id];
    if (activeSubject.parentId) {
      allowedSubjectIds.push(activeSubject.parentId);
    }

    const linkedComps = state.competencies.filter(c => allowedSubjectIds.includes(c.subjectId));
    const compIds = linkedComps.map(c => c.id);
    return state.criteria.filter(cr => compIds.includes(cr.competencyId));
  }, [activeSubject, state.competencies, state.criteria]);

// Helper functions for activity dates
const getTodayStr = (): string => {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
};

const addDaysToDateStr = (dateStr: string, days: number): string => {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || !m || !d) return dateStr;
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + days);
  const ny = date.getFullYear();
  const nm = String(date.getMonth() + 1).padStart(2, '0');
  const nd = String(date.getDate()).padStart(2, '0');
  return `${ny}-${nm}-${nd}`;
};

  // Form states for creating/editing activity
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftBase,setDraftBase]=useState<AppState|null>(null);

  const [activityCode, setActivityCode] = useState<string>('');
  const [activityTitle, setActivityTitle] = useState<string>('');
  const [activityDesc, setActivityDesc] = useState<string>('');
  const [activityStartDate, setActivityStartDate] = useState<string>(() => getTodayStr());
  const [activityEndDate, setActivityEndDate] = useState<string>(() => addDaysToDateStr(getTodayStr(), 6));
  const [activityStatus, setActivityStatus] = useState<ActivityStatus>('auto');
  const [activityTermId, setActivityTermId] = useState<string>('');
  const [activityWeight, setActivityWeight] = useState<number>(10);
  const [selectedCritIds, setSelectedCritIds] = useState<string[]>([]);
  const [criterionToAdd, setCriterionToAdd] = useState('');
  const [criteriaReferences, setCriteriaReferences] = useState<Record<string,string>>({});
  const [criteriaRubrics, setCriteriaRubrics] = useState<Record<string,RubricDescriptions>>({});
  const [criteriaWeights, setCriteriaWeights] = useState<Record<string, number>>({});
  const [criteriaGradingType, setCriteriaGradingType] = useState<Record<string, 'competencial' | 'numeric'>>({});
  const [criteriaCustomLabels, setCriteriaCustomLabels] = useState<Record<string,string>>({});
  const [criteriaMaxScores, setCriteriaMaxScores] = useState<Record<string, number>>({});
  const [activityNumericItemId, setActivityNumericItemId] = useState<string>('');
  const [activityNumericGradingType, setActivityNumericGradingType] = useState<'numeric' | 'competencial'>('numeric');
  
  // Resources links list
  const [resources, setResources] = useState<ActivityResource[]>([]);
  const [newResTitle, setNewResTitle] = useState<string>('');
  const [newResUrl, setNewResUrl] = useState<string>('');

  // Auto-calculated term finder
  const handleEndDateChange = (endDateVal: string) => {
    setActivityEndDate(endDateVal);
    if (endDateVal && state.config.terms.length > 0) {
      const match = state.config.terms.find(t => endDateVal >= t.startDate && endDateVal <= t.endDate);
      if (match) {
        setActivityTermId(match.id);
      }
    }
  };

  // Auto-calculated end date = start date + 6 days when setting/changing start date
  const handleStartDateChange = (startDateVal: string) => {
    setActivityStartDate(startDateVal);
    if (startDateVal) {
      const newEnd = addDaysToDateStr(startDateVal, 6);
      handleEndDateChange(newEnd);
    }
  };

  // Safe fetch of state activities
  const existingActivities = useMemo(() => {
    return state.activities || [];
  }, [state.activities]);

  // Filter activities that belong to this subject (or inherited from Parent/Grup Mare)
  const activitiesForSubject = useMemo(() => {
    if (!activeSubject) return { direct: [], inherited: [] };
    
    // We get activities directly matching this subject
    const directActs = existingActivities.filter(a => a.subjectId === activeSubject.id);
    
    // If this is a child, we can also find activities owned by the Parent (Grup Mare) that can be inherited
    let inheritedActs: CurricularActivity[] = [];
    if (activeSubject.parentId) {
      const parentActs = existingActivities.filter(a => a.subjectId === activeSubject.parentId);
      // Ensure we don't duplicate codes already copied over
      inheritedActs = parentActs.filter(pa => !directActs.some(da => da.code === pa.code));
    }
    
    return {
      direct: directActs,
      inherited: inheritedActs
    };
  }, [activeSubject, existingActivities]);

  // Add resource helper
  const handleAddResource = () => {
    if (!newResTitle.trim() || !newResUrl.trim()) return;
    setResources([...resources, { id: crypto.randomUUID(), title: newResTitle.trim(), url: newResUrl.trim() }]);
    setNewResTitle('');
    setNewResUrl('');
  };

  const handleRemoveResource = (index: number) => {
    if(!window.confirm('Treure aquest recurs de l’activitat?'))return;
    setResources(resources.filter((_, idx) => idx !== index));
  };

  // Toggle criteria selection
  const handleAddCriterion = () => {
    if (!relevantCriteria.some(c => c.id === criterionToAdd)) return;
    const id = crypto.randomUUID();
    setSelectedCritIds([...selectedCritIds, id]);
    setCriteriaReferences({...criteriaReferences, [id]:criterionToAdd});
  };

  // Reset form
  const resetForm = () => {
    setDraftBase(null);
    setIsEditing(false);
    setEditingId(null);
    setActivityCode('');
    setActivityTitle('');
    setActivityDesc('');
    const today = getTodayStr();
    const defaultEnd = addDaysToDateStr(today, 6);
    setActivityStartDate(today);
    setActivityEndDate(defaultEnd);
    setActivityStatus('auto');

    // Auto-calculate matching trimester
    const match = state.config.terms.find(t => defaultEnd >= t.startDate && defaultEnd <= t.endDate);
    setActivityTermId(match?.id || state.config.terms[0]?.id || '');

    setActivityWeight(10);
    setSelectedCritIds([]);
    setCriteriaWeights({});
    setCriteriaReferences({});
    setCriteriaRubrics({});
    setCriterionToAdd('');
    setCriteriaGradingType({});
    setCriteriaMaxScores({});
    setCriteriaCustomLabels({});
    setActivityNumericItemId('');
    setActivityNumericGradingType('numeric');
    setResources([]);
  };

  // Save activity to global list
  const handleSaveActivity = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSubId) return;
    if (activityEndDate < activityStartDate) { alert('El lliurament no pot ser anterior a l’inici.'); return; }
    if (activeSubject?.evaluationType === 'numeric' && !activityNumericItemId) { alert('Selecciona l’ítem numèric de l’activitat.'); return; }
    if (!activityCode.trim() || !activityTitle.trim()) {
      alert('Siusplau, omple com a mínim el codi i el títol de l\'activitat.');
      return;
    }

    const nextActivity: CurricularActivity = {
      id: editingId || 'act_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
      code: activityCode.toUpperCase().trim(),
      subjectId: selectedSubId,
      title: activityTitle.trim(),
      description: activityDesc.trim(),
      startDate: activityStartDate,
      endDate: activityEndDate,
      status: activityStatus,
      termId: state.config.terms.find(t => activityEndDate >= t.startDate && activityEndDate <= t.endDate)?.id || '',
      weight: Number(activityWeight) || 0,
      resources: resources,
      criteriaIds: selectedCritIds,
      criteriaReferences,
      criteriaRubrics,
      criteriaWeights: criteriaWeights,
      criteriaGradingType: criteriaGradingType,
      criteriaMaxScores: criteriaMaxScores,
      criteriaCustomLabels,
      numericItemId: activityNumericItemId || undefined,
      numericGradingType: activityNumericGradingType,
      grades: preserveLegacyCriterionGrades(existingActivities.find(a => a.id === editingId))
    };

    let updatedActs: CurricularActivity[] = [];
    if (editingId) {
      updatedActs = existingActivities.map(a => a.id === editingId ? nextActivity : a);
    } else {
      // Check for code uniqueness in this subject
      if (existingActivities.some(a => a.subjectId === selectedSubId && a.code === nextActivity.code)) {
        alert(`Ja existeix una activitat amb el codi "${nextActivity.code}" en aquesta assignatura.`);
        return;
      }
      updatedActs = [...existingActivities, nextActivity];
    }

    // Is parent subject (Grupo Madre)? Propagate to child groups
    if (activeSubject.isParent) {
      const childrenSubjects = state.subjects.filter(s => s.parentId === activeSubject.id);
      
      // Get the old code if editing
      const oldParentActivity = editingId ? existingActivities.find(a => a.id === editingId) : null;
      const oldCode = oldParentActivity ? oldParentActivity.code.toUpperCase().trim() : '';
      const newCode = nextActivity.code;

      childrenSubjects.forEach(child => {
        // Find existing child activity by old code or new code
        const childActIndex = updatedActs.findIndex(a => 
          a.subjectId === child.id && 
          (a.code === oldCode || a.code === newCode)
        );

        if (childActIndex >= 0) {
          // Update the child activity preserving its custom student grades and ID
          const existingChildAct = updatedActs[childActIndex];
          updatedActs[childActIndex] = {
            ...existingChildAct,
            code: newCode,
            title: nextActivity.title,
            description: nextActivity.description,
            startDate: nextActivity.startDate,
            endDate: nextActivity.endDate,
            status: nextActivity.status,
            termId: nextActivity.termId,
            weight: nextActivity.weight,
            criteriaCustomLabels: nextActivity.criteriaCustomLabels,
            resources: nextActivity.resources,
            criteriaIds: nextActivity.criteriaIds,
            criteriaReferences: nextActivity.criteriaReferences,
            criteriaRubrics: nextActivity.criteriaRubrics,
            criteriaWeights: nextActivity.criteriaWeights,
            criteriaGradingType: nextActivity.criteriaGradingType,
            criteriaMaxScores: nextActivity.criteriaMaxScores,
            numericItemId: nextActivity.numericItemId,
            numericGradingType: nextActivity.numericGradingType
          };
        } else {
          // Create new child activity with empty grades initially
          const newChildAct: CurricularActivity = {
            id: 'act_child_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
            code: newCode,
            subjectId: child.id,
            title: nextActivity.title,
            description: nextActivity.description,
            startDate: nextActivity.startDate,
            endDate: nextActivity.endDate,
            status: nextActivity.status,
            termId: nextActivity.termId,
            weight: nextActivity.weight,
            criteriaCustomLabels: nextActivity.criteriaCustomLabels,
            resources: nextActivity.resources,
            criteriaIds: nextActivity.criteriaIds,
            criteriaReferences: nextActivity.criteriaReferences,
            criteriaRubrics: nextActivity.criteriaRubrics,
            criteriaWeights: nextActivity.criteriaWeights,
            criteriaGradingType: nextActivity.criteriaGradingType,
            criteriaMaxScores: nextActivity.criteriaMaxScores,
            numericItemId: nextActivity.numericItemId,
            numericGradingType: nextActivity.numericGradingType,
            grades: {}
          };
          updatedActs.push(newChildAct);
        }
      });
    }

    if(onChangeState({
      ...state,
      activities: updatedActs
    },draftBase||undefined)===false)return;

    resetForm();
  };

  // Clone/Copy activity from Mother Group (Grup Mare)
  const handleImportParentActivity = (parentAct: CurricularActivity) => {
    if (!selectedSubId) return;
    
    // Check if code already duplicated
    if (existingActivities.some(a => a.subjectId === selectedSubId && a.code === parentAct.code)) {
      alert(`Ja existeix l'activitat "${parentAct.code}" desada localment en aquest grup.`);
      return;
    }

    const clonedAct: CurricularActivity = {
      ...parentAct,
      id: 'act_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
      subjectId: selectedSubId, // Adopt child group ID
      grades: {} // Starts empty for local students
    };

    onChangeState({
      ...state,
      activities: [...existingActivities, clonedAct]
    });
  };

  // Edit action
  const handleStartEdit = (act: CurricularActivity) => {
    setIsEditing(true);
    setEditingId(act.id);
    setDraftBase(state);
    setActivityCode(act.code);
    setActivityTitle(act.title);
    setActivityDesc(act.description);
    setActivityStartDate(act.startDate);
    setActivityEndDate(act.endDate);
    setActivityStatus(act.status || 'auto');
    setActivityTermId(state.config.terms.find(t => act.endDate >= t.startDate && act.endDate <= t.endDate)?.id || '');
    setActivityWeight(act.weight);
    setSelectedCritIds(act.criteriaIds || []);
    setCriteriaWeights(act.criteriaWeights || {});
    setCriteriaReferences(act.criteriaReferences || {});
    setCriteriaRubrics(act.criteriaRubrics || {});
    setCriterionToAdd('');
    setCriteriaGradingType(act.criteriaGradingType || {});
    setCriteriaMaxScores(act.criteriaMaxScores || {});
    setCriteriaCustomLabels(act.criteriaCustomLabels || {});
    setActivityNumericItemId(act.numericItemId || '');
    setActivityNumericGradingType(act.numericGradingType || 'numeric');
    setResources((act.resources || []).map(resource => ({ ...resource, id: resource.id || crypto.randomUUID() })));
  };

  // Deletion modal state
  const [actToDelete, setActToDelete] = useState<CurricularActivity | null>(null);

  // Safe deletion logic that handles regular, child, and mother group (parent) activities
  const executeDelete = (actToRemove: CurricularActivity) => {
    const currentActs = state.activities || [];
    const subjectOfAct = state.subjects.find(s => s.id === actToRemove.subjectId);
    const isParent = subjectOfAct?.isParent || (activeSubject?.isParent && actToRemove.subjectId === activeSubject.id);
    const parentId = isParent ? (subjectOfAct?.id || activeSubject?.id) : null;
    const targetCode = actToRemove.code ? actToRemove.code.trim().toUpperCase() : '';

    // Remove the target activity
    let updatedActs = currentActs.filter(a => a.id !== actToRemove.id);

    // If removing an activity from a parent group (Grup Mare),
    // also delete from all corresponding child groups that share the same code
    if (isParent && parentId) {
      const childrenSubjectIds = state.subjects.filter(s => s.parentId === parentId).map(s => s.id);
      updatedActs = updatedActs.filter(a => {
        if (childrenSubjectIds.includes(a.subjectId)) {
          if (targetCode && a.code && a.code.trim().toUpperCase() === targetCode) {
            return false;
          }
        }
        return true;
      });
    }

    // Reset grading or editing selection if related to the deleted activity
    if (selectedActIdForGrading === actToRemove.id) {
      setSelectedActIdForGrading(null);
    }
    if (editingId === actToRemove.id) {
      resetForm();
    }

    onChangeState({
      ...state,
      activities: updatedActs
    });

    setActToDelete(null);
  };

  // Grade state managers
  const [selectedActIdForGrading, setSelectedActIdForGrading] = useState<string | null>(null);
  
  const gradingActivity = useMemo(() => {
    return existingActivities.find(a => a.id === selectedActIdForGrading);
  }, [selectedActIdForGrading, existingActivities]);

  // Handle criterion-specific grade update

  // Auto-filled Competency checklist mapping for display
  // "L'assignació de competències es fa a partir dels criteris d'avaluació que s'assignin a les activitats"
  const mappedCompetencyStats = useMemo(() => {
    if (!activeSubject) return [];
    
    // Total competencies matching this scope
    const subIds = [activeSubject.id];
    if (activeSubject.parentId) subIds.push(activeSubject.parentId);
    const comps = state.competencies.filter(c => subIds.includes(c.subjectId));

    // For each competency, find covered criteria count in activities of this subject
    return comps.map(comp => {
      const compCriteria = state.criteria.filter(cr => cr.competencyId === comp.id);
      
      // Look up all active user activities
      const actsForSub = [
        ...activitiesForSubject.direct,
        ...activitiesForSubject.inherited
      ];

      // Criteria actively included in subject's activities
      const associatedCritIds = new Set<string>();
      actsForSub.forEach(a => {
        a.criteriaIds?.forEach(id => associatedCritIds.add(sourceCriterionId(a,id)));
      });

      const coveredCriteriaInActivities = compCriteria.filter(cr => associatedCritIds.has(cr.id));

      return {
        competency: comp,
        totalCriteria: compCriteria.length,
        coveredCriteriaCount: coveredCriteriaInActivities.length,
        criteriaCovered: coveredCriteriaInActivities
      };
    });
  }, [activeSubject, state.competencies, state.criteria, activitiesForSubject]);

  // Automatic activity status resolution:
  // - "oberta fins que arriba la data limit"
  // - "passada la data limit és pendent de corregir"
  // - "i una vegada tots els alumnes han estat corregits, es posaria en corregida"
  const resolveActivityStatus=(act:CurricularActivity)=>resolveSharedActivityStatus(state,act);
  if(showOverview||!activeSubject)return <ActivitiesOverview state={state} onOpen={id=>{setSelectedSubId(id);setShowOverview(false);}}/>;

  if (isEditing && activeSubject) return <DetailPage title={editingId ? 'Editar activitat' : 'Nova activitat'} subtitle={activeSubject.name} onBack={resetForm}><div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4 animate-slideDown">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h3 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                    <CheckSquare className="w-4.5 h-4.5 text-blue-500 animate-bounce" />
                    <span>{editingId ? 'Editar Activitat' : 'Crear Nova Activitat'}</span>
                  </h3>
                  <button
                    onClick={resetForm}
                    className="text-xs text-slate-400 hover:text-slate-600"
                  >
                    Cancel·lar
                  </button>
                </div>

                <form onSubmit={handleSaveActivity} className="activity-editor-grid">
                  
                  {/* Activity Code */}
                  <div className="space-y-1">
                    <label className="block text-[10px] text-slate-500 font-bold uppercase tracking-wider">Codi ID d'Activitat</label>
                    <input 
                      type="text" 
                      placeholder="Ex: S3A4" 
                      required
                      value={activityCode}
                      onChange={(e) => setActivityCode(e.target.value)}
                      className="w-full text-xs font-bold font-mono p-2.5 border border-slate-250 bg-slate-50/50 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                    <p className="text-[9px] text-slate-400">Identificador únic de l'activitat per visualitzar a les llistes i butlletins.</p>
                  </div>

                  {/* Title */}
                  <div className="space-y-1">
                    <label className="block text-[10px] text-slate-500 font-bold uppercase tracking-wider">Títol de l'Activitat</label>
                    <input 
                      type="text" 
                      placeholder="Examen de disseny relacional" 
                      required
                      value={activityTitle}
                      onChange={(e) => setActivityTitle(e.target.value)}
                      className="w-full text-xs font-bold p-2.5 border border-slate-250 bg-slate-50/50 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>

                  {/* Description */}
                  <div className="space-y-1">
                    <label className="block text-[10px] text-slate-500 font-bold uppercase tracking-wider">Descripció o Detalls</label>
                    <textarea 
                      placeholder="Redacteu aquí l'esquema de l'activitat..."
                      value={activityDesc}
                      onChange={(e) => setActivityDesc(e.target.value)}
                      rows={3}
                      className="w-full text-xs p-2.5 border border-slate-250 bg-slate-50/50 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>

                  {/* Start Date & End Date */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <label className="block text-[10px] text-slate-500 font-bold uppercase tracking-wider">Data Inici</label>
                        <span className="text-[9px] text-blue-600 font-semibold">+6 dies auto</span>
                      </div>
                      <input 
                        type="date" 
                        required
                        value={activityStartDate}
                        onChange={(e) => handleStartDateChange(e.target.value)}
                        className="w-full text-xs font-mono p-2 border border-slate-250 bg-slate-50/50 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[10px] text-slate-500 font-bold uppercase tracking-wider">Data Fi (Límit)</label>
                      <input 
                        type="date" 
                        required
                        value={activityEndDate}
                        onChange={(e) => handleEndDateChange(e.target.value)}
                        className="w-full text-xs font-mono p-2 border border-slate-250 bg-slate-50/50 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  {/* Trimester selection */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="block text-[10px] text-slate-500 font-bold uppercase tracking-wider">Trimestre segons el lliurament</label>
                      <select 
                        value={state.config.terms.find(t => activityEndDate >= t.startDate && activityEndDate <= t.endDate)?.id || ''}
                        disabled
                        className="w-full text-xs font-bold p-2 border border-slate-250 bg-slate-50/50 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                      >
                        <option value="">Fora dels trimestres</option>
                        {state.config.terms.map(t => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[10px] text-slate-500 font-bold uppercase tracking-wider">Pes relatiu de l’activitat</label>
                      <input 
                        type="number" 
                        min="0"
                        step="0.1"
                        required
                        value={activityWeight}
                        onChange={(e) => setActivityWeight(Number(e.target.value) || 0)}
                        className="w-full text-xs font-mono p-2 border border-slate-250 bg-slate-50/50 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  {/* Status */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="block text-[10px] text-slate-500 font-bold uppercase tracking-wider">Estat de l'Activitat</label>
                      {activityStatus === 'auto' && (
                        <span className="text-[9px] font-bold text-blue-600 bg-blue-50 border border-blue-100 px-1.5 py-0.5 rounded">
                          Automàtic actiu
                        </span>
                      )}
                    </div>
                    <select 
                      value={activityStatus}
                      onChange={(e) => setActivityStatus(e.target.value as ActivityStatus)}
                      className="w-full text-xs font-bold p-2.5 border border-slate-250 bg-slate-50/50 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                    >
                      <option value="auto">Automàtic (Oberta fins límit &gt; Pendent &gt; Corregida)</option>
                      <option value="open">Oberta (Manual - En curs)</option>
                      <option value="pending_correction">Pendent de corregir (Manual)</option>
                      <option value="corrected">Corregida (Manual)</option>
                      <option value="not_open">No oberta (Manual - Pendent d'obrir)</option>
                    </select>
                    <p className="text-[10px] text-slate-400 mt-0.5 leading-snug">
                      En mode <strong>Automàtic</strong>: oberta fins a la data límit, passada aquesta passa a pendent de corregir, i quan tots els alumnes estan corregits es marca com a corregida.
                    </p>
                  </div>

                  {/* Link Attachment Area */}
                  <div className="p-3 bg-slate-50 rounded-xl space-y-2 border border-slate-200">
                    <label className="block text-[10px] text-slate-500 font-bold uppercase tracking-wider flex items-center gap-1">
                      <Link2 className="w-3.5 h-3.5 text-slate-400" />
                      <span>Recursos i materials (Enllaços)</span>
                    </label>
                    
                    {/* Add inputs */}
                    <div className="space-y-2">
                      <input 
                        type="text" 
                        placeholder="Text a mostrar en l'enllaç"
                        value={newResTitle}
                        onChange={(e) => setNewResTitle(e.target.value)}
                        className="w-full p-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none"
                      />
                      <div className="flex gap-2">
                        <input 
                          type="text" 
                          placeholder="Ex: drive.google.com/..."
                          value={newResUrl}
                          onChange={(e) => setNewResUrl(e.target.value)}
                          className="flex-1 p-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={handleAddResource}
                          className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
                        >
                          Afegir
                        </button>
                      </div>
                    </div>

                    {/* Show links list */}
                    {resources.length > 0 && (
                      <div className="mt-2 space-y-1 max-h-32 overflow-y-auto pt-1 border-t border-slate-100">
                        {resources.map((res, index) => (
                          <div key={index} className="flex items-center justify-between text-[10px] bg-white px-2 py-1 rounded border border-slate-150">
                            <span className="font-bold truncate max-w-[130px]" title={res.url}>{res.title}</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveResource(index)}
                              className="text-rose-500 hover:text-rose-700 font-bold shrink-0 text-[10.5px]"
                            >
                              Eliminar
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* NUMERIC EVALUATION SUBJECT SPECIFICS: Link to Subject Item */}
                  {activeSubject?.evaluationType === 'numeric' && (
                    <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-xl space-y-2">
                      <label className="block text-[10px] text-amber-900 font-bold uppercase tracking-wider">
                        Configuració Numèrica: Ítem Avaluatiu
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[9.5px] text-slate-500 font-bold block mb-1">Assignar a Ítem:</label>
                          <select
                            value={activityNumericItemId}
                            onChange={(e) => setActivityNumericItemId(e.target.value)}
                            className="w-full text-xs font-bold p-1.5 border border-slate-250 bg-white rounded-lg focus:ring-2 focus:ring-blue-500 cursor-pointer"
                          >
                            <option value="">-- Sense ítem assignat --</option>
                            {(activeSubject.numericItems || []).map(it => (
                              <option key={it.id} value={it.id}>{it.name} ({it.weight}%)</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="text-[9.5px] text-slate-500 font-bold block mb-1">Format de Qualificació:</label>
                          <select
                            value={activityNumericGradingType}
                            onChange={(e) => setActivityNumericGradingType(e.target.value as 'numeric' | 'competencial')}
                            className="w-full text-xs font-bold p-1.5 border border-slate-250 bg-white rounded-lg focus:ring-2 focus:ring-blue-500 cursor-pointer"
                          >
                            <option value="numeric">Numèric (0 - 10)</option>
                            <option value="competencial">Competencial (NA, AS, AN, AE)</option>
                          </select>
                        </div>
                      </div>
                      <p className="text-[9px] text-amber-800">
                        La nota s'incorporarà al càlcul de la mitjana ponderada de l'ítem seleccionat.
                      </p>
                    </div>
                  )}

                  <section className="space-y-2">
                    <label className="ds-field" htmlFor="criterion-to-add">Afegir criteri d’avaluació</label>
                    <div className="flex gap-2"><select id="criterion-to-add" className="flex-1" value={criterionToAdd} onChange={e=>setCriterionToAdd(e.target.value)}><option value="">Selecciona un criteri…</option>{relevantCriteria.map(cr=><option key={cr.id} value={cr.id}>{cr.key} · {cr.description}</option>)}</select><button type="button" className="ds-button ds-primary" disabled={!criterionToAdd} onClick={handleAddCriterion}>Afegir</button></div>
                    <p className="text-sm text-slate-500">Pots afegir el mateix criteri diverses vegades per avaluar aspectes diferents. Cada entrada té la seva pròpia nota i pes.</p>
                    {!relevantCriteria.length && <p className="text-amber-700 text-sm">Crea primer els criteris a Configuració → Competències.</p>}
                  </section>

                  {/* CRITERIA WEIGHTS AND GRADING TYPE CONFIGURATION */}
                  {selectedCritIds.length > 0 && (
                    <div className="space-y-2 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                      <label className="block text-[10px] text-slate-700 font-bold uppercase tracking-wider">
                        Pesos i Format dels Criteris Vinculats ({selectedCritIds.length})
                      </label>
                      <p className="text-[9.5px] text-slate-450 leading-tight">
                        Defineix el pes de cada criteri en l'activitat i si s'avalua de forma competencial (NA-AE) o numèrica (amb màxim proratejat a 0-4).
                      </p>
                      <div className="space-y-2  pr-1 pt-1">
                        {selectedCritIds.map((cid) => {
                          const cr = state.criteria.find(c => c.id === (criteriaReferences[cid] ?? cid));
                          const weight = criteriaWeights[cid] ?? 1;
                          const gType = criteriaGradingType[cid] || 'competencial';
                          const maxSc = criteriaMaxScores[cid] ?? 10;

                          return (
                            <div key={cid} className="p-2 bg-white border border-slate-200 rounded-lg text-xs space-y-1.5">
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-black font-mono text-indigo-700 text-[10.5px]">
                                  {cr?.key || 'CA'}
                                </span>
                                <span className="text-[10px] text-slate-500 truncate flex-1 text-right" title={cr?.description}>
                                  {cr?.description}
                                </span>
                              </div>

                              <label className="ds-field">Text per identificar aquest criteri quan avalues<input value={criteriaCustomLabels[cid] ?? cr?.key ?? ''} onChange={e => setCriteriaCustomLabels({...criteriaCustomLabels, [cid]:e.target.value})} placeholder="Ex.: P1-CA1 · Expressió oral" /></label>
                              <div className="flex gap-2"><button type="button" className="ds-button text-rose-700" onClick={()=>{if(window.confirm('Treure aquest aspecte de l’activitat? Deixarà d’aparèixer a l’avaluació i al càlcul quan desis els canvis.'))setSelectedCritIds(selectedCritIds.filter(id=>id!==cid));}}>Treure de l’activitat</button><button type="button" className="ds-button" disabled={selectedCritIds.indexOf(cid)===0} onClick={()=>{const list=[...selectedCritIds],i=list.indexOf(cid);[list[i-1],list[i]]=[list[i],list[i-1]];setSelectedCritIds(list);}}>Pujar</button><button type="button" className="ds-button" disabled={selectedCritIds.indexOf(cid)===selectedCritIds.length-1} onClick={()=>{const list=[...selectedCritIds],i=list.indexOf(cid);[list[i+1],list[i]]=[list[i],list[i+1]];setSelectedCritIds(list);}}>Baixar</button></div>
                              <div className="grid grid-cols-3 gap-1.5 items-center">
                                <div>
                                  <label className="text-[8.5px] font-bold text-slate-400 block uppercase">Pes</label>
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.1"
                                    value={weight}
                                    onChange={(e) => setCriteriaWeights({
                                      ...criteriaWeights,
                                      [cid]: Number(e.target.value)
                                    })}
                                    className="w-full text-xs font-mono font-bold p-1 border border-slate-200 rounded text-center bg-slate-50/50"
                                  />
                                </div>
                                <div>
                                  <label className="text-[8.5px] font-bold text-slate-400 block uppercase">Format</label>
                                  <select
                                    value={gType}
                                    onChange={(e) => setCriteriaGradingType({
                                      ...criteriaGradingType,
                                      [cid]: e.target.value as 'competencial' | 'numeric'
                                    })}
                                    className="w-full text-[10.5px] font-bold p-1 border border-slate-200 rounded bg-slate-50/50 cursor-pointer"
                                  >
                                    <option value="competencial">NA-AE</option>
                                    <option value="numeric">Numèric</option>
                                  </select>
                                </div>
                                <div>
                                  <label className="text-[8.5px] font-bold text-slate-400 block uppercase">
                                    {gType === 'numeric' ? 'Nota Màx' : 'Escala'}
                                  </label>
                                  {gType === 'numeric' ? (
                                    <input
                                      type="number"
                                      min="1"
                                      step="1"
                                      value={maxSc}
                                      onChange={(e) => setCriteriaMaxScores({
                                        ...criteriaMaxScores,
                                        [cid]: Math.max(0.01, Number(e.target.value))
                                      })}
                                      className="w-full text-xs font-mono font-bold p-1 border border-slate-200 rounded text-center bg-slate-50/50"
                                    />
                                  ) : (
                                    <span className="text-[10px] text-slate-400 block text-center py-1">0-4 pts</span>
                                  )}
                                </div>
                              </div>
                              <fieldset className="grid grid-cols-1 md:grid-cols-2 gap-2"><legend className="font-semibold text-sm mb-2">Què significa cada nivell en aquest aspecte?</legend>{QUAL_ORDER.map(q=><label className="ds-field" key={q}><span className={`grade-badge ${QUAL_COLORS[q].badge}`}>{q}</span><textarea rows={2} value={criteriaRubrics[cid]?.[q] ?? cr?.rubric?.[q] ?? ''} placeholder={`Descripció de ${q}…`} onChange={e=>setCriteriaRubrics({...criteriaRubrics,[cid]:{...criteriaRubrics[cid],[q]:e.target.value}})}/></label>)}</fieldset>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                    <div className="flex items-center space-x-2 ml-auto">
                      <button
                        type="button"
                        onClick={resetForm}
                        className="px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                      >
                        Buidar
                      </button>
                      <button
                        type="submit"
                        className="px-4.5 py-2 text-xs font-extrabold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-lg shadow-blue-600/10 transition-all cursor-pointer"
                      >
                        Desar Activitat
                      </button>
                    </div>
                  </div>
                </form>
              </div>
</DetailPage>;
  if (gradingActivity && activeSubject) return <ActivityGradePage state={state} activity={gradingActivity} subject={{...activeSubject, students:activeStudents}} onChange={onChangeState} onBack={() => setSelectedActIdForGrading(null)} />;

  return (
    <div id="section-curricular-activities" className="space-y-6">
      <button className="ds-button" onClick={()=>setShowOverview(true)}>← Tornar al resum de classes</button>
      
      {/* 1. View Header with subject selection */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 shadow-sm border border-blue-100">
            <CheckSquare className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 tracking-tight">Activitats Curriculars i Avaluació</h2>
            <p className="text-xs text-slate-400">Planifiqueu activitats, vinculeu criteris per competències, i qualifiqueu els grups.</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Assignatura:</label>
          {validSubjects.length === 0 ? (
            <span className="text-xs text-amber-600 bg-amber-55 px-3 py-1.5 border border-amber-100 rounded-xl">Creu primer una assignatura</span>
          ) : (
            <select
              id="select-subject-activities"
              value={selectedSubId}
              onChange={(e) => {
                setSelectedSubId(e.target.value);
                setSelectedActIdForGrading(null);
                resetForm();
              }}
              className="text-xs font-bold text-slate-705 p-2.5 border border-slate-200 bg-white rounded-xl shadow-sm focus:ring-2 focus:ring-blue-500 focus:outline-none cursor-pointer"
            >
              {validSubjects.map(s => (
                <option key={s.id} value={s.id}>{s.name} {s.isParent ? '(Mare)' : ''}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {activeSubject && (
        <div className="grid grid-cols-1 gap-4">
          
          {/* LEFT/MID SECTION: List & Creation */}
          <div className="space-y-4">
            
            {/* MOTHER GROUP NOTICE */}
            {activeSubject.parentId && (
              <div className="bg-gradient-to-r from-blue-500/5 to-indigo-500/5 border border-blue-150 rounded-2xl p-4 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Layers className="w-5 h-5 text-blue-600 shrink-0" />
                  <div>
                    <h5 className="text-xs font-extrabold text-blue-900 uppercase">Aquest és un Subgrup (Fill)</h5>
                    <p className="text-[10.5px] text-blue-700 mt-0.5 leading-normal">
                      Hereta competències de: <strong className="font-semibold">{state.subjects.find(s => s.id === activeSubject.parentId)?.name}</strong>. Podeu fer servir o importar ràpidament les activitats del grup mare.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* DIRECT & INHERITED ACTIVITIES LIST */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                <h3 className="font-bold text-slate-900 flex items-center gap-2">
                  <CheckSquare className="w-5 h-5 text-blue-500 animate-spin-slow" />
                  <span>Dossier d'Activitats ({activitiesForSubject.direct.length})</span>
                </h3>
                {!isEditing && (
                  <button
                    onClick={() => {
                      setIsEditing(true);
                      setEditingId(null);
                    }}
                    className="flex items-center space-x-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px] rounded-xl transition-all shadow-sm shadow-blue-600/10 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Nova Activitat</span>
                  </button>
                )}
              </div>

              {activitiesForSubject.direct.length === 0 && activitiesForSubject.inherited.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-sm text-slate-450 italic">Sense activitats configurades per aquest grup encara.</p>
                  {!isEditing && (
                    <button
                      onClick={() => setIsEditing(true)}
                      className="mt-3 text-xs font-semibold text-blue-600 hover:underline inline-flex items-center gap-1"
                    >
                      Crear la primera activitat ara <Sparkles className="w-3 h-3 text-amber-500" />
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Direct Activities list */}
                  {activitiesForSubject.direct.map((act) => {
                    const actCriteria = state.criteria.filter(cr => act.criteriaIds?.some(id=>sourceCriterionId(act,id)===cr.id));
                    const term = state.config.terms.find(t => t.id === act.termId);
                    const isCurrentlyGrading = selectedActIdForGrading === act.id;
                    const { effectiveStatus, isAuto, totalStudents, gradedStudents } = resolveActivityStatus(act);

                    return (
                      <div 
                        key={act.id} 
                        className={`border rounded-2xl p-4.5 transition-all ${
                          isCurrentlyGrading 
                            ? 'border-blue-500 ring-2 ring-blue-50/50 bg-blue-50/[0.01]' 
                            : 'border-slate-200 hover:border-slate-300 bg-white'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-[10px] font-black font-mono bg-blue-100 text-blue-800 px-2 py-0.5 rounded uppercase">
                                {act.code}
                              </span>
                              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase inline-flex items-center gap-1 ${
                                effectiveStatus === 'not_open' ? 'bg-slate-100 text-slate-500' :
                                effectiveStatus === 'open' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                                effectiveStatus === 'pending_correction' ? 'bg-amber-50 text-amber-700 border border-amber-100' :
                                'bg-indigo-50 text-indigo-700 border border-indigo-100'
                              }`}>
                                <span>
                                  {effectiveStatus === 'not_open' ? 'Pendent d\'Obrir' :
                                   effectiveStatus === 'open' ? 'Oberta / En Curs' :
                                   effectiveStatus === 'pending_correction' ? 'Pendent Corregir' :
                                   'Corregida'}
                                </span>
                                {isAuto && (
                                  <span className="text-[7.5px] font-black tracking-wider px-1 py-0.2 bg-black/5 rounded text-slate-600">
                                    AUTO
                                  </span>
                                )}
                              </span>
                              {isAuto && totalStudents > 0 && (
                                <span className="text-[10px] font-semibold text-slate-400">
                                  ({gradedStudents}/{totalStudents} corr.)
                                </span>
                              )}
                              <span className="text-[10px] font-semibold text-slate-500 bg-slate-100/80 px-1.5 py-0.5 rounded leading-none">
                                Pes: {act.weight}
                              </span>
                              {term && (
                                <span className="text-[10px] text-slate-400 font-bold bg-slate-50 border border-slate-100 px-1.5 py-0.5 rounded">
                                  {term.name}
                                </span>
                              )}
                            </div>

                            <h4 className="font-extrabold text-sm text-slate-850 mt-2 leading-tight">
                              {act.title}
                            </h4>
                            
                            {act.description && (
                              <p className="text-[11.5px] text-slate-450 leading-relaxed mt-1">{act.description}</p>
                            )}

                            {/* Dates details */}
                            <div className="flex items-center space-x-4 text-[10px] text-slate-400 mt-2">
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                Inici: {act.startDate} | Fi: {act.endDate}
                              </span>
                            </div>

                            {/* Attached Resources */}
                            {act.resources && act.resources.length > 0 && (
                              <div className="mt-3 flex flex-wrap gap-1.5">
                                {act.resources.map((res) => (
                                  <a
                                    key={res.id}
                                    href={res.url.startsWith('http') ? res.url : `https://${res.url}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-slate-50 hover:bg-slate-100 text-[10px] text-slate-500 hover:text-slate-850 rounded border border-slate-200 transition-colors"
                                  >
                                    <Link2 className="w-3 h-3 text-slate-400" />
                                    <span>{res.title}</span>
                                    <ExternalLink className="w-2.5 h-2.5 text-slate-350" />
                                  </a>
                                ))}
                              </div>
                            )}

                            {/* Assigned Criteria display & mapped competencies */}
                            {actCriteria.length > 0 && (
                              <div className="mt-3.5 pt-3 border-t border-dashed border-slate-100 space-y-1.5">
                                <p className="text-[9.5px] font-extrabold text-slate-400 uppercase tracking-widest">Criteris d'Avaluació Vinculats ({actCriteria.length})</p>
                                <div className="flex flex-wrap gap-1">
                                  {actCriteria.map(cr => (
                                    <span 
                                      key={cr.id} 
                                      className="text-[9.5px] font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded px-2 py-1 flex items-center gap-1 shrink-0"
                                      title={cr.description}
                                    >
                                      <Award className="w-3 h-3 text-slate-400 shrink-0" />
                                      {cr.key}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>

                          <div className="flex items-center space-x-1 shrink-0">
                            {/* Qualification button */}
                            <button
                              onClick={() => {
                                if (selectedActIdForGrading === act.id) {
                                  setSelectedActIdForGrading(null);
                                } else {
                                  setSelectedActIdForGrading(act.id);
                                }
                              }}
                              className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all border ${
                                isCurrentlyGrading 
                                  ? 'bg-blue-600 text-white border-blue-600 shadow-sm shadow-blue-500/15' 
                                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                              }`}
                            >
                              Qualificar ({gradedStudents}/{activeStudents.length})
                            </button>

                            <button
                              onClick={() => handleStartEdit(act)}
                              className="p-2 text-slate-400 hover:text-blue-600 hover:bg-slate-50 rounded-xl transition-colors"
                              title="Editar activitat"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>

                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setActToDelete(act);
                              }}
                              className="p-2 text-slate-450 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                              title="Eliminar activitat"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                      </div>
                    );
                  })}

                  {/* Mother inherited list copy mechanism */}
                  {activitiesForSubject.inherited.length > 0 && (
                    <div className="mt-8 border-t border-slate-200/80 pt-6">
                      <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                        <Layers className="w-4 h-4 text-slate-400" />
                        <span>Activitats del Grup Mare heretables ({activitiesForSubject.inherited.length})</span>
                      </h4>
                      <p className="text-[11px] text-slate-400 mb-4 font-normal">
                        Aquestes són les activitats que has definit en el grup mare i es poden importar en un sol clic per poder qualificar els alumnes d'aquest subgrup en particular de manera individualitzada.
                      </p>

                      <div className="space-y-3">
                        {activitiesForSubject.inherited.map((pAct) => {
                          const pStatus = resolveActivityStatus(pAct);
                          return (
                            <div key={pAct.id} className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-3">
                              <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-[9px] font-mono font-bold bg-slate-200 text-slate-655 px-1.5 py-0.5 rounded uppercase">{pAct.code}</span>
                                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase inline-flex items-center gap-1 ${
                                    pStatus.effectiveStatus === 'open' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                                    pStatus.effectiveStatus === 'pending_correction' ? 'bg-amber-50 text-amber-700 border border-amber-100' :
                                    pStatus.effectiveStatus === 'corrected' ? 'bg-indigo-50 text-indigo-700 border border-indigo-100' :
                                    'bg-slate-100 text-slate-500'
                                  }`}>
                                    <span>
                                      {pStatus.effectiveStatus === 'open' ? 'Oberta' :
                                       pStatus.effectiveStatus === 'pending_correction' ? 'Pendent Corregir' :
                                       pStatus.effectiveStatus === 'corrected' ? 'Corregida' :
                                       'Pendent d\'Obrir'}
                                    </span>
                                    {pStatus.isAuto && <span className="text-[7px] font-black opacity-60">AUTO</span>}
                                  </span>
                                  <h5 className="font-extrabold text-xs text-slate-700">{pAct.title}</h5>
                                </div>
                                <p className="text-[10px] text-slate-450 mt-1 truncate max-w-md">{pAct.description || 'Sense descripció.'}</p>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <button
                                  onClick={() => handleImportParentActivity(pAct)}
                                  className="px-3 py-1.5 bg-white text-[11px] hover:bg-slate-100 text-blue-600 font-bold border border-slate-200 hover:border-blue-200 rounded-lg inline-flex items-center gap-1 transition-colors cursor-pointer"
                                >
                                  <Copy className="w-3.5 h-3.5" />
                                  <span>Heretar</span>
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActToDelete(pAct);
                                  }}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                  title="Eliminar activitat del grup mare"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* RIGHT SIDEBAR PANEL: Creation form or evaluation competency analysis mapping */}
          <div className="space-y-6">
            
            {/* 2. CURRICULAR COMPETENCY MAP ACCORDING TO ACTIVITIES */}
            {/* "L'assignació de competències es fa a partir dels criteris d'avaluació que s'assignin a les activitats." */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
              <h3 className="font-bold text-slate-900 text-xs flex items-center gap-1.5 uppercase tracking-wider">
                <Award className="w-4.5 h-4.5 text-indigo-500 shrink-0" />
                <span>Estat de cobertura de Competències</span>
              </h3>
              
              <p className="text-[11px] text-slate-400 leading-normal font-normal">
                Les competències i criteris es consideren "coberts" o "avaluats" de manera activa un cop els has vinculat a les activitats d'aquest trimestre/curs.
              </p>

              {mappedCompetencyStats.length === 0 ? (
                <p className="text-xs text-slate-400 italic text-center py-4 bg-slate-50 border border-slate-100 rounded-xl">No hi ha competències associades a aquesta assignatura.</p>
              ) : (
                <div className="space-y-4">
                  {mappedCompetencyStats.map(({ competency, totalCriteria, coveredCriteriaCount, criteriaCovered }) => {
                    const coveragePct = totalCriteria > 0 ? Math.round((coveredCriteriaCount / totalCriteria) * 10) * 10 : 0;
                    return (
                      <div key={competency.id} className="p-3 bg-slate-55 border border-slate-200 rounded-xl space-y-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="overflow-hidden">
                            <span className="text-[10px] font-black font-mono bg-indigo-55 text-indigo-705 px-2 py-0.5 rounded uppercase">
                              {competency.key}
                            </span>
                            <p className="text-xs font-bold text-slate-700 leading-tight mt-1.5">{competency.description}</p>
                          </div>
                          
                          <div className="shrink-0 text-right">
                            <span className="text-xs font-black text-slate-800 font-mono">
                              {coveredCriteriaCount}/{totalCriteria}
                            </span>
                            <span className="text-[10px] text-slate-400 block font-normal leading-none mt-1">criteris coberts</span>
                          </div>
                        </div>

                        {/* Visual progression custom bar */}
                        <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden shrink-0">
                          <div 
                            className={`h-full transition-all ${
                              coveragePct >= 70 ? 'bg-indigo-600' :
                              coveragePct >= 40 ? 'bg-amber-500' :
                              'bg-rose-500'
                            }`}
                            style={{ width: `${coveragePct || 5}%` }}
                          />
                        </div>

                        {/* Covered list check */}
                        {criteriaCovered.length > 0 && (
                          <div className="flex flex-wrap gap-1 pt-1">
                            {criteriaCovered.map(cr => (
                              <span 
                                key={cr.id} 
                                className="inline-flex items-center gap-0.5 text-[9px] font-bold text-indigo-700 bg-white border border-indigo-100 px-1 py-0.5 rounded"
                                title={cr.description}
                              >
                                <Check className="w-2.5 h-2.5 text-indigo-500" />
                                <span>{cr.key}</span>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            
          </div>
        </div>
      )}

      {/* MODAL CONFIRMACIÓ ELIMINACIÓ ACTIVITAT */}
      {actToDelete && (() => {
        const isParentAct = state.subjects.some(s => s.id === actToDelete.subjectId && s.isParent) || (activeSubject?.isParent && actToDelete.subjectId === activeSubject.id);
        const parentSub = isParentAct ? (state.subjects.find(s => s.id === actToDelete.subjectId) || activeSubject) : null;
        const childGroups = isParentAct && parentSub ? state.subjects.filter(s => s.parentId === parentSub.id) : [];

        return (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-[2px] z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
              <div className="flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 shrink-0">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <h3 className="font-extrabold text-base text-slate-850 leading-tight">
                    Eliminar activitat
                  </h3>
                  <div className="mt-2.5 p-3 bg-slate-50 border border-slate-150 rounded-xl">
                    <span className="text-[10px] font-black font-mono bg-blue-100 text-blue-800 px-2 py-0.5 rounded uppercase">
                      {actToDelete.code}
                    </span>
                    <p className="font-bold text-xs text-slate-800 mt-1">
                      {actToDelete.title}
                    </p>
                  </div>

                  {isParentAct && (
                    <div className="mt-3 p-3 bg-amber-500/[0.06] border border-amber-200/80 rounded-xl flex items-start gap-2 text-xs text-amber-900">
                      <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold text-[11px] text-amber-800 uppercase tracking-wide">
                          Atenció: Activitat de Grup Mare ({parentSub?.name})
                        </p>
                        <p className="text-[11px] text-slate-650 mt-0.5 leading-relaxed">
                          En eliminar aquesta activitat del grup mare, també s'eliminarà automàticament de tots els {childGroups.length} subgrups derivats ({childGroups.map(c => c.name).join(', ') || 'cap'}).
                        </p>
                      </div>
                    </div>
                  )}

                  <p className="text-xs text-slate-500 mt-3 leading-relaxed">
                    Tots els registres de notes i qualificacions dels alumnes assignats a aquesta activitat s'esborraran definitivament. Aquesta acció no es pot desfer.
                  </p>
                </div>
              </div>

              <div className="mt-6 flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setActToDelete(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel·lar
                </button>
                <button
                  type="button"
                  onClick={() => executeDelete(actToDelete)}
                  className="px-4.5 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-md shadow-rose-600/20 transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Eliminar activitat</span>
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
