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
  endCal: string
): { date: string; timeSlotId: string; scheduleItemId: string }[] {
  const sessions: { date: string; timeSlotId: string; scheduleItemId: string }[] = [];
  
  const start = fromIsoDate(startCal);
  const end = fromIsoDate(endCal);
  
  const current = new Date(start);
  while (current <= end) {
    const dIso = toIsoDate(current);
    
    // Check if it's holiday
    const isHoliday = state.config.holidays.some(h => {
      const hStart = h.date;
      const hEnd = h.endDate || h.date;
      return dIso >= hStart && dIso <= hEnd;
    });
    
    if (!isHoliday) {
      const dayOfWeek = current.getDay(); // 1=Mon, ..., 5=Fri
      if (dayOfWeek >= 1 && dayOfWeek <= 5) {
        // Evaluate all possible slots
        state.config.timeSlots.forEach(slot => {
          const sub = state.config.substitutions?.find(
            s => s.date === dIso && s.timeSlotId === slot.id
          );
          
          if (sub) {
            // Substitution overrides normal schedule
            if (sub.type === 'subject' && sub.subjectId === subjectId) {
              sessions.push({
                date: dIso,
                timeSlotId: slot.id,
                scheduleItemId: sub.id, // we can use substitution ID as scheduleItemId!
              });
            }
          } else {
            // No substitution, check regular schedule
            const originalItems = state.schedule.filter(
              item => item.dayOfWeek === dayOfWeek && item.timeSlotId === slot.id
            );
            originalItems.forEach(originalItem => {
              if (originalItem.subjectId === subjectId) {
                sessions.push({
                   date: dIso,
                   timeSlotId: slot.id,
                   scheduleItemId: originalItem.id,
                });
              }
            });
          }
        });
      }
    }
    current.setDate(current.getDate() + 1);
  }
  
  // Sort chronologically, then by slot list order
  return sessions.sort((a, b) => {
    if (a.date !== b.date) {
      return a.date.localeCompare(b.date);
    }
    const idxA = state.config.timeSlots.findIndex(ts => ts.id === a.timeSlotId);
    const idxB = state.config.timeSlots.findIndex(ts => ts.id === b.timeSlotId);
    return idxA - idxB;
  });
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

