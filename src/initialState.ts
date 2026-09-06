/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AppState } from './types';

export const getInitialState = (): AppState => {
  return {
    config: {
      startDate: '2026-09-01',
      endDate: '2027-06-30',
      holidays: [
        { date: '2026-10-12', label: 'Festa de la Hispanitat' },
        { date: '2026-11-01', label: 'Tots Sants' },
        { date: '2026-12-06', label: 'Dia de la Constitució' },
        { date: '2026-12-08', label: 'La Immaculada' },
        { date: '2026-12-25', label: 'Nadal' },
        { date: '2026-12-26', label: 'Sant Esteve' },
        { date: '2027-01-01', label: 'Cap d\'Any' },
        { date: '2027-01-06', label: 'Reis Mags' },
        { date: '2027-05-01', label: 'Festa del Treball' },
        { date: '2027-06-24', label: 'Sant Joan' }
      ],
      terms: [
        { id: 't1', name: '1r Trimestre', startDate: '2026-09-01', endDate: '2026-12-22' },
        { id: 't2', name: '2n Trimestre', startDate: '2027-01-08', endDate: '2027-04-02' },
        { id: 't3', name: '3r Trimestre', startDate: '2027-04-06', endDate: '2027-06-30' }
      ],
      timeSlots: [
        { id: 'slot-1', name: '1a Hora', startTime: '08:00', endTime: '09:00' },
        { id: 'slot-2', name: '2a Hora', startTime: '09:00', endTime: '10:00' },
        { id: 'slot-3', name: '3a Hora', startTime: '10:00', endTime: '11:00' },
        { id: 'slot-recreo', name: 'Esbarjo / Pati', startTime: '11:00', endTime: '11:30' },
        { id: 'slot-4', name: '4a Hora', startTime: '11:30', endTime: '12:30' },
        { id: 'slot-5', name: '5a Hora', startTime: '12:30', endTime: '13:30' },
        { id: 'slot-6', name: '6a Hora', startTime: '13:30', endTime: '14:30' }
      ],
      substitutions: []
    },
    subjects: [
      {
        id: 'sub-comp-mare',
        name: 'Informàtica DAW (Grup Mare)',
        color: '#4f46e5', // indigo-600
        isGeneral: false,
        isParent: true,
        parentId: null,
        evaluationType: 'competencial',
        compSettings: {
          values: { AE: 4.0, AN: 3.0, AS: 2.0, NA: 1.0 },
          thresholds: { AE: 3.75, AN: 2.75, AS: 2.00 },
          maxFailedCompetencies: 2
        },
        students: []
      },
      {
        id: 'sub-comp-fill',
        name: 'Programació DAW2 (Fills DAW Mare)',
        color: '#06b6d4', // cyan-500
        isGeneral: false,
        parentId: 'sub-comp-mare',
        evaluationType: 'competencial',
        compSettings: {
          values: { AE: 4.0, AN: 3.0, AS: 2.0, NA: 1.0 },
          thresholds: { AE: 3.75, AN: 2.75, AS: 2.00 },
          maxFailedCompetencies: 2
        },
        students: [
          { id: 'st1', name: 'Mas, Anna' },
          { id: 'st2', name: 'Gómez, Joan' },
          { id: 'st3', name: 'Pérez, Maria' },
          { id: 'st4', name: 'Vila, David' },
          { id: 'st5', name: 'Sánchez, Laura' },
          { id: 'st6', name: 'Costa, Jordi' },
          { id: 'st7', name: 'López, Clàudia' },
          { id: 'st8', name: 'Martí, Robert' }
        ]
      },
      {
        id: 'sub-bd',
        name: 'Sistemes de Bases de Dades',
        color: '#9333ea', // purple-600
        isGeneral: false,
        parentId: null,
        evaluationType: 'numeric',
        numericItems: [
          { id: 'it-exam', name: 'Exàmens i Proves Escrites', code: 'EXAM', weight: 50 },
          { id: 'it-prac', name: 'Pràctiques de Laboratori', code: 'PRAC', weight: 30 },
          { id: 'it-proj', name: 'Projecte i Treball Diari', code: 'PROJ', weight: 20 }
        ],
        students: [
          { id: 'st1', name: 'Mas, Anna' },
          { id: 'st2', name: 'Gómez, Joan' },
          { id: 'st4', name: 'Vila, David' },
          { id: 'st9', name: 'Romero, Neus' }
        ]
      },
      {
        id: 'sub-tutoria',
        name: 'Acció Tutorial General',
        color: '#059669', // emerald-600
        isGeneral: true, // No students
        parentId: null,
        students: []
      }
    ],
    schedule: [
      { id: 'sk1', dayOfWeek: 1, timeSlotId: 'slot-1', subjectId: 'sub-comp-fill' },
      { id: 'sk2', dayOfWeek: 1, timeSlotId: 'slot-2', subjectId: 'sub-comp-fill' },
      { id: 'sk3', dayOfWeek: 2, timeSlotId: 'slot-1', subjectId: 'sub-bd' },
      { id: 'sk4', dayOfWeek: 2, timeSlotId: 'slot-3', subjectId: 'sub-tutoria' },
      { id: 'sk5', dayOfWeek: 3, timeSlotId: 'slot-4', subjectId: 'sub-comp-fill' },
      { id: 'sk6', dayOfWeek: 3, timeSlotId: 'slot-5', subjectId: 'sub-bd' },
      { id: 'sk7', dayOfWeek: 4, timeSlotId: 'slot-2', subjectId: 'sub-comp-fill' },
      { id: 'sk8', dayOfWeek: 5, timeSlotId: 'slot-1', subjectId: 'sub-bd' },
      { id: 'sk9', dayOfWeek: 5, timeSlotId: 'slot-recreo', subjectId: 'sub-tutoria' }
    ],
    competencies: [
      { id: 'c1', subjectId: 'sub-comp-mare', key: 'CEProg1', description: 'Desenvolupar codi web seguint directrius d\'usabilitat' },
      { id: 'c2', subjectId: 'sub-comp-mare', key: 'CEProg2', description: 'Gestionar bases de dades amb consultes eficients' },
      { id: 'c3', subjectId: 'sub-bd', key: 'CEDB1', description: 'Dissenyar esquemes relacionals òptims' }
    ],
    criteria: [
      { id: 'cr1', competencyId: 'c1', key: 'CEProg1.1', shortLabel: 'CA1', order: 1, description: 'Escriu HTML i CSS semàntic i estructurat' },
      { id: 'cr2', competencyId: 'c1', key: 'CEProg1.2', shortLabel: 'CA2', order: 2, description: 'Valida les entrades d\'usuari en client' },
      { id: 'cr3', competencyId: 'c2', key: 'CEProg2.1', shortLabel: 'CA3', order: 1, description: 'Optimitza indexacions lògiques' }
    ],
    sessionLogs: [],
    plans: [
      {
        id: 'p1',
        subjectId: 'sub-comp-fill',
        name: 'Distribució Estàndard Lab A',
        rows: 4,
        cols: 4,
        teacherDesk: { x: 0, y: 0 },
        seats: {
          '1,1': 'st1',
          '1,2': 'st2',
          '1,3': 'st3',
          '2,1': 'st4',
          '2,2': 'st5',
          '2,3': 'st6',
          '3,1': 'st7',
          '3,2': 'st8'
        }
      }
    ],
    activities: []
  };
};
