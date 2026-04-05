import React from 'react';
import { X, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';

interface V2TestResultsProps {
  testResults: { name: string; status: 'PASS' | 'FAIL' | 'PENDING'; message: string }[];
  onClose: () => void;
}

export const V2TestResults: React.FC<V2TestResultsProps> = ({ testResults, onClose }) => {
  if (testResults.length === 0) return null;

  return (
    <div className="absolute top-20 left-4 z-50 w-64 bg-white/90 backdrop-blur-md border border-slate-200 rounded-2xl shadow-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Test Results</span>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
          <X className="w-4 h-4" />
        </button>
      </div>
      {testResults.map((res, i) => (
        <div key={i} className="space-y-1">
          <div className="flex items-center gap-2">
            {res.status === 'PASS' ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : 
             res.status === 'FAIL' ? <AlertCircle className="w-4 h-4 text-red-500" /> :
             <RefreshCw className="w-4 h-4 text-indigo-500 animate-spin" />}
            <span className="text-xs font-bold text-slate-700">{res.name}</span>
          </div>
          <p className="text-[10px] text-slate-500 pl-6 leading-relaxed">{res.message}</p>
        </div>
      ))}
    </div>
  );
};
