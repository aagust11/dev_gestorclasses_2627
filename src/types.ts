/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type AttendanceType = 'present' | 'late10' | 'lateMore10' | 'absent';

export interface StudentLog {
  status: AttendanceType;
  posComment?: string;
  regularComment?: string;
  incidentComment?: string;
  posComments?: string[];
  regularComments?: string[];
  incidentComments?: string[];
  score?: number; // evaluation score between 0 and 10
}

export interface SessionLog {
  id: string; // scheduleItemId + "_" + date YYYY-MM-DD
  scheduleItemId: string;
  subjectId: string;
  date: string; // YYYY-MM-DD
  comments: string;
  nextSessionNotes?: string; // Comentaris / previsions per a la sessió següent
  attendance: Record<string, StudentLog>; // Key is studentId or studentName (depending on model)
}

export interface Holiday {
  date: string; // YYYY-MM-DD
  endDate?: string; // YYYY-MM-DD (Optional, defaults to start date)
  label: string; // Holiday name (e.g., "Nadal")
}

export interface Term {
  id: string;
  name: string; // e.g., "1r Trimestre"
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
}

export interface TimeSlot {
  id: string;
  name: string; // e.g. "1a Hora", "S扩展"
  startTime?: string; // HH:MM
  endTime?: string; // HH:MM
}

export interface ScheduleItem {
  id: string;
  dayOfWeek: number; // 1 = Monday, 2 = Tuesday, 3 = Wednesday, 4 = Thursday, 5 = Friday
  timeSlotId: string;
  subjectId: string; // Reference to subject or General action
}

export interface Student {
  id: string;
  name: string;
}

export interface SubjectNumericItem {
  id: string;
  name: string;      // e.g. "Exàmens", "Pràctiques", "Projecte", "Treball Diari"
  code: string;      // e.g. "EXAM", "PRAC", "PROJ"
  weight: number;    // % de pes en la nota (0-100)
}

export interface CompetencyEvaluationSettings {
  values: {
    AE: number; // default 4.0
    AN: number; // default 3.0
    AS: number; // default 2.0
    NA: number; // default 1.0
  };
  thresholds: {
    AE: number; // default >= 3.75 -> AE
    AN: number; // default >= 2.75 -> AN
    AS: number; // default >= 2.00 -> AS
  };
  maxFailedCompetencies?: number; // Si té >= aquest nombre de CE suspeses (< AS), nota final és NA
}

export type SubjectEvaluationType = 'competencial' | 'numeric';

export interface Subject {
  id: string;
  name: string;
  color: string; // HEX color or tailwind class name
  isGeneral: boolean; // General actions with no students
  isParent?: boolean; // GRUP MARE - Cannot have students, can act as parent of other subjects
  parentId: string | null; // Parent group for inheritance
  students: Student[]; // Independent list of students in this group (or inherited from parent if empty)
  evaluationType?: SubjectEvaluationType; // 'competencial' (default) o 'numeric'
  numericItems?: SubjectNumericItem[]; // Items de qualificació per a assignatures numèriques
  compSettings?: CompetencyEvaluationSettings; // Valors i llindars de càlcul competencial
  generalNotes?: string[]; // Persistent notes for general teaching actions
  generalLinks?: { id: string; label: string; url: string }[]; // Persistent links for general teaching actions
}

export interface Competency {
  id: string;
  subjectId: string; // Tied to a specific subject (or parent)
  key: string;       // e.g., "CEProg1"
  description: string;
}

export type RubricDescriptions = Partial<Record<'NA' | 'AS' | 'AN' | 'AE', string>>;

export interface EvalCriterion {
  rubric?: RubricDescriptions;
  id: string;
  competencyId: string;
  key: string;       // e.g., "CEProg1.1"
  shortLabel?: string; // Text breu identificatiu (per defecte igual a key, ex. "CA1" o editable a "P1-CA1")
  order?: number;      // Ordre de visualització dins de la competència
  description: string;
}

export interface TeacherDesk {
  x: number;
  y: number;
}

export interface ClassroomPlanVersion {
  id: string;
  subjectId: string;
  name: string; // Version name
  rows: number;
  cols: number;
  teacherDesk: TeacherDesk | null;
  seats: Record<string, string>; // KEY format "r,c" -> VALUE studentId
  corridorRows?: number[];
  corridorCols?: number[];
}

export interface ScheduleSubstitution {
  id: string;
  date: string; // YYYY-MM-DD
  timeSlotId: string;
  type: 'subject' | 'other';
  subjectId?: string; // Reference to subject for other classes/accions docents
  customReason?: string; // Standard reason
}

export interface ActivityResource {
  id: string;
  title: string;
  url: string;
}

export type ActivityStatus = 'auto' | 'not_open' | 'open' | 'pending_correction' | 'corrected';

export interface StudentCriterionGrade {
  criterionId?: string;
  rawScore?: number; // valor introduït si és numèric (ex: 8 sobre max 10)
  competencialScore?: 'AE' | 'AN' | 'AS' | 'NA'; // qualificació si és competencial
  normalizedScore?: number; // valor prorratejat sobre escala 0-4
  maxScore?: number;
}

export interface StudentActivityGrade {
  status?: 'not_submitted' | 'exempt'; // Overrides calculated scores without deleting entered grades
  score?: number; // nota global o numèrica de l'activitat
  competencialScore?: 'AE' | 'AN' | 'AS' | 'NA';
  comment?: string; // Únic espai de comentaris per alumne
  // Criteris d'avaluació puntuats: criterionId -> puntuació
  criteriaGrades?: Record<string, StudentCriterionGrade>;
  // Item numèric vinculat si assignatura és numèrica
  numericItemId?: string;
}

export interface CurricularActivity {
  id: string;
  code: string; // e.g. "S3A4"
  subjectId: string;
  title: string;
  description: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  status: ActivityStatus;
  termId: string; // References Term
  weight: number; // Pes global de l'activitat (e.g. 10%)
  resources: ActivityResource[];
  criteriaIds: string[]; // Ordered occurrence IDs; legacy entries are EvalCriterion IDs.
  criteriaReferences?: Record<string, string>; // occurrence ID -> EvalCriterion ID
  criteriaRubrics?: Record<string, RubricDescriptions>; // occurrence ID -> level descriptions
  // Configuració per criteri a l'activitat (pesos i tipus de puntuació):
  criteriaWeights?: Record<string, number>; // criterionId -> pes relatiu dins l'activitat (ex: 1, 2...)
  criteriaGradingType?: Record<string, 'competencial' | 'numeric'>; // criterionId -> competencial o numèric
  criteriaMaxScores?: Record<string, number>; // criterionId -> puntuació màxima si és numèric (ex: 10)
  criteriaCustomLabels?: Record<string, string>; // criterionId -> text breu identificatiu d'avaluació (ex: "Expressió oral", "Ortografia")
  // Per a assignatures numèriques:
  numericItemId?: string; // Id de l'Item de l'assignatura al qual computa
  numericGradingType?: 'numeric' | 'competencial'; // Com es puntua aquesta activitat
  // Notes dels alumnes
  grades?: Record<string, StudentActivityGrade>; // studentId -> grade
}

export interface TermStudentGrades {
  criteria: Record<string, { score: number; qual: string; isManual?: boolean }>;
  competencies: Record<string, { score: number; qual: string; isManual?: boolean }>;
  items?: Record<string, { score: number; isManual?: boolean }>;
  finalGrade: {
    score: number;
    qual: string; // 'AE' | 'AN' | 'AS' | 'NA' o nota sobre 10
    isManual?: boolean;
    failedCECount?: number;
    autoFailed?: boolean;
  };
  metrics?: {
    mean: number;
    median: number;
    mode: string | number;
  };
}

export type CalculationMode = 'mean' | 'median' | 'mode';

export interface TermGradesRecord {
  cleared?: boolean;
  id: string; // `${subjectId}_${periodId}`
  subjectId: string;
  periodId: string; // termId ('t1', 't2', 't3') o 'annual'
  calculationMode?: 'mean' | 'median' | 'mode';
  students: Record<string, TermStudentGrades>;
}

export interface AppState {
  periodComments?: Record<string, Record<string, Record<string, string>>>; // subject → period → student; shared by all methods
  config: {
    startDate: string; // YYYY-MM-DD
    endDate: string;   // YYYY-MM-DD
    holidays: Holiday[];
    terms: Term[];
    timeSlots: TimeSlot[];
    substitutions?: ScheduleSubstitution[];
    autoClassNotifications?: boolean;
    autoClassNotificationMinutes?: number;
    reminders?: {
      id: string;
      title: string;
      date: string; // YYYY-MM-DD
      time?: string; // HH:MM (Optional time)
      type: 'class' | 'calendar' | 'todo';
      advanceMinutes: number; // e.g., 15, 30, 60
      active: boolean;
    }[];
  };
  subjects: Subject[];
  schedule: ScheduleItem[];
  competencies: Competency[];
  criteria: EvalCriterion[];
  sessionLogs: SessionLog[];
  plans: ClassroomPlanVersion[];
  activities?: CurricularActivity[];
  termGradesRecords?: TermGradesRecord[];
}
