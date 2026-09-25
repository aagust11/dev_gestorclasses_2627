import {getDayBlocks,blockLogs,diaryBlock} from './sessionBlocks';
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Holiday, Term, AppState, CurricularActivity } from '../types';

// ISO Date String: YYYY-MM-DD
export function getIsoDateString(date: Date): string {
  return toIsoDate(date);
}

// Clean formatting helper
export function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Parse ISO date back to Date object
export function fromIsoDate(str: string): Date {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

// Get Monday of the week for a given date
export function getMonday(d: Date): Date {
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
  const mon = new Date(d.setDate(diff));
  mon.setHours(0, 0, 0, 0);
  return mon;
}

// Get the 5 weekdays starting from a Monday Date
export function getWeekDays(monday: Date): Date[] {
  const days: Date[] = [];
  for (let i = 0; i < 5; i++) {
    const nextDay = new Date(monday);
    nextDay.setDate(monday.getDate() + i);
    days.push(nextDay);
  }
  return days;
}

// Format date in Catalan style
export function formatCatalanDate(date: Date): string {
  const days = ['Diumenge', 'Dilluns', 'Dimarts', 'Dimecres', 'Dijous', 'Divendres', 'Dissabte'];
  const months = [
    'gener', 'febrer', 'març', 'abril', 'maig', 'juny',
    'juliol', 'agost', 'setembre', 'octubre', 'novembre', 'desembre'
  ];
  const dayName = days[date.getDay()];
  const dayNum = date.getDate();
  const monthName = months[date.getMonth()];
  const year = date.getFullYear();
  return `${dayName}, ${dayNum} de ${monthName}`;
}

export function formatCatalanShortDate(dateStr: string): string {
  try {
    const d = fromIsoDate(dateStr);
    const months = [
      'gen.', 'feb.', 'març', 'abr.', 'maig', 'juny',
      'jul.', 'ag.', 'set.', 'oct.', 'nov.', 'des.'
    ];
    return `${d.getDate()} ${months[d.getMonth()]}`;
  } catch {
    return dateStr;
  }
}

// Check if a date is a holiday
export function getHolidayForDate(dateStr: string, holidays: Holiday[]): Holiday | null {
  const found = holidays.find(h => {
    const start = h.date;
    const end = h.endDate || h.date;
    return dateStr >= start && dateStr <= end;
  });
  return found || null;
}

// Get current term for a given date
export function getTermForDate(dateStr: string, terms: Term[]): Term | null {
  const active=terms.filter(t=>dateStr>=t.startDate&&dateStr<=t.endDate);
  const main=active.find(t=>!t.isPreassessment),pre=active.find(t=>t.isPreassessment);
  if(main&&pre)return {...main,name:`${pre.name} · ${main.name}`};
  for (const t of terms) {
    if (dateStr >= t.startDate && dateStr <= t.endDate) {
      return t;
    }
  }
  return null;
}

// Custom sequence generator: get all scheduled dates for a subject in calendar boundaries
export function getScheduledDatesForSubject(
  subjectId: string,
  dayOfWeek: number, // 1=Mon, 5=Fri
  startCal: string,
  endCal: string,
  holidays: Holiday[]
): string[] {
  const dates: string[] = [];
  const start = fromIsoDate(startCal);
  const end = fromIsoDate(endCal);
  
  // Slide from start to end day by day
  const current = new Date(start);
  while (current <= end) {
    if (current.getDay() === dayOfWeek) {
      const iso = toIsoDate(current);
      // Check if it's holiday
      const isHoliday = holidays.some(h => {
        const hStart = h.date;
        const hEnd = h.endDate || h.date;
        return iso >= hStart && iso <= hEnd;
      });
      if (!isHoliday) {
        dates.push(iso);
      }
    }
    current.setDate(current.getDate() + 1);
  }
  
  return dates.sort();
}

// Get all programmed/scheduled sessions for a subject taking into account substitutions
export function getProgrammedSessionsForSubject(
  state: AppState,
  subjectId: string,
  startCal: string,
  endCal: string,
  includeNotHeld = false
): { date: string; timeSlotId: string; scheduleItemId: string; notHeld?: boolean }[] {
  const sessions:{date:string;timeSlotId:string;scheduleItemId:string;notHeld?:boolean}[]=[];
  const current=fromIsoDate(startCal),end=fromIsoDate(endCal);
  while(current<=end){
    const date=toIsoDate(current);
    if(current.getDay()>=1&&current.getDay()<=5&&!getHolidayForDate(date,state.config.holidays)){
      for(const block of getDayBlocks(state,date))if(block.subjectId===subjectId){
        const notHeld=blockLogs(state,diaryBlock(state,block,date),date).some(log=>log.notHeld);
        if(!notHeld||includeNotHeld)sessions.push({date,timeSlotId:block.timeSlotId,scheduleItemId:block.id,...(notHeld?{notHeld:true}:{})});
      }
    }
    current.setDate(current.getDate()+1);
  }
  return sessions;
}

// Retorna les activitats d'una matèria que estan en curs durant la data d'una sessió
export function getOngoingActivitiesForSession(
  state: AppState,
  subjectId: string,
  dateStr: string
): CurricularActivity[] {
  if (!state.activities) return [];
  return state.activities.filter(act => {
    if (act.subjectId !== subjectId) return false;
    const start = act.startDate || dateStr;
    const end = act.endDate || dateStr;
    return dateStr >= start && dateStr <= end;
  });
}

// Determina si una sessió és l'últim dia de classe d'una matèria abans del lliurament d'alguna tasca
export function getLastDayBeforeDeliveryActivities(
  state: AppState,
  subjectId: string,
  dateStr: string
): CurricularActivity[] {
  if (!state.activities) return [];
  const subjectActivities = state.activities.filter(a => a.subjectId === subjectId && a.endDate);
  if (subjectActivities.length === 0) return [];

  const sessions = getProgrammedSessionsForSubject(
    state,
    subjectId,
    state.config.startDate,
    state.config.endDate
  );
  if (sessions.length === 0) return [];

  const result: CurricularActivity[] = [];
  for (const act of subjectActivities) {
    if (act.endDate < dateStr) continue;
    
    // Sessions programades fins a la data de lliurament (inclusiu)
    const eligibleSessions = sessions.filter(s => s.date <= act.endDate && (!act.startDate || s.date >= act.startDate));
    if (eligibleSessions.length === 0) continue;
    
    const lastSession = eligibleSessions[eligibleSessions.length - 1];
    if (lastSession.date === dateStr) {
      result.push(act);
    }
  }
  return result;
}

