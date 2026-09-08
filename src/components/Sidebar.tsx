/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { 
  Users,
  Calendar, 
  BookOpen, 
  CheckSquare, 
  Award,
  TrendingUp, 
  Map, 
  Settings
} from 'lucide-react';

interface SidebarProps {
  activeView: string;
  onViewChange: (view: string) => void;
  dataBadge?:string;
}

export default function Sidebar({
  activeView,
  onViewChange,
  dataBadge
}: SidebarProps) {
  const menuItems: { id: string; label: string; icon: any; disabled: boolean; badge?: string }[] = [
    { id: 'horari', label: 'Horari', icon: Calendar, disabled: false },
    { id: 'classes', label: 'Assignatures', icon: BookOpen, disabled: false },
    { id: 'alumnat', label: 'Alumnat', icon: Users, disabled: false },
    { id: 'activitats', label: 'Activitats', icon: CheckSquare, disabled: false },
    { id: 'qualificacions', label: 'Qualificacions', icon: Award, disabled: false },
    { id: 'rendiment', label: 'Rendiment i Informes', icon: TrendingUp, disabled: false },
    { id: 'planols', label: 'Plànols', icon: Map, disabled: false },
    { id: 'configuracio', label: 'Configuració', icon: Settings, disabled: false },
    { id: 'dades', label: 'Dades i desat', icon: Settings, disabled: false, badge:dataBadge },
  ];

  return (
    <aside id="sidebar-container" className="w-56 bg-slate-900 text-slate-400 flex flex-col border-r border-slate-850 h-screen fixed top-0 left-0 z-20 p-4 shrink-0 shadow-lg">
      {/* Brand Header */}
      <div id="sidebar-header" className="flex items-center gap-3 px-2 mb-8 mt-2">
        <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center text-white font-bold shadow-md shadow-blue-500/20">
          <img src={`${(import.meta as any).env?.BASE_URL||'./'}favicon.svg`} alt="" className="w-8 h-8"/>
        </div>
        <div>
          <h1 className="text-sm font-bold tracking-tight text-white leading-tight">Àula</h1>
        </div>
      </div>

      {/* Navigation Menu */}
      <nav id="sidebar-nav" className="flex-1 space-y-1 overflow-y-auto">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeView === item.id;
          
          return (
            <button
              key={item.id}
              id={`nav-item-${item.id}`}
              disabled={item.disabled}
              onClick={() => onViewChange(item.id)}
              className={`w-full sidebar-item flex items-center justify-between px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 text-left ${
                isActive
                  ? 'bg-blue-600 text-white active font-semibold shadow-sm'
                  : item.disabled
                    ? 'text-slate-600 cursor-not-allowed opacity-50'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <div className="flex items-center space-x-3">
                <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-white'}`} />
                <span>{item.label}</span>
              </div>
              {item.badge && (
                <span className={`text-[10px] tracking-wider font-bold uppercase px-1.5 py-0.5 rounded ${
                  isActive ? 'bg-blue-700 text-blue-100' : 'bg-slate-800 text-slate-500'
                }`}>
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
