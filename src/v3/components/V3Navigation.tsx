import React from 'react';
import { Move, Layers, Link as LinkIcon, Zap, Type, Download, Network } from 'lucide-react';
import { Tab } from '../../v2/constants';

interface V3NavigationProps {
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
}

export const V3Navigation: React.FC<V3NavigationProps> = ({ activeTab, setActiveTab }) => {
  const tabs = [
    { id: 'TOPOLOGY', icon: Move, label: 'Topology' },
    { id: 'MODIFICATION', icon: Layers, label: 'Modification' },
    { id: 'CONNECTION', icon: LinkIcon, label: 'Connection' },
    { id: 'MASS_CONNECTION', icon: Network, label: 'Mass' },
    { id: 'RESOLUTION', icon: Zap, label: 'Resolution' },
    { id: 'TRANSFORMATION', icon: Type, label: 'Transformation' },
    { id: 'PRODUCTION', icon: Download, label: 'Production' },
  ];

  return (
    <nav className="bg-white border-b border-slate-200 px-2 sm:px-4 py-1 flex items-center gap-1 overflow-x-auto no-scrollbar shrink-0 z-20">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as Tab)}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl transition-all whitespace-nowrap ${
              isActive 
                ? 'bg-indigo-50 text-indigo-600 font-bold' 
                : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
            }`}
          >
            <tab.icon className={`w-3.5 h-3.5 ${isActive ? 'text-indigo-600' : 'text-slate-400'}`} />
            <span className="text-xs">{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
};
