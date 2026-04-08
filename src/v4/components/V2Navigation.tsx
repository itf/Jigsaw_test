import React from 'react';
import { Tab } from '../constants';

interface V2NavigationProps {
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
}

export const V2Navigation: React.FC<V2NavigationProps> = ({ activeTab, setActiveTab }) => {
  const tabs: Tab[] = ['TOPOLOGY'];

  return (
    <nav className="shrink-0 px-4 py-2 bg-white border-b border-slate-200 flex gap-2">
      {tabs.map((tab) => (
        <button
          key={tab}
          type="button"
          onClick={() => setActiveTab(tab)}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            activeTab === tab
              ? 'bg-indigo-100 text-indigo-900'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          {tab}
        </button>
      ))}
    </nav>
  );
};
