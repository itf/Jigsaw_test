import React, { useState } from 'react';
import V1App from './v1/App.tsx';
import V2App from './v2/App.tsx';
import V3App from './v3/App.tsx';
import { motion, AnimatePresence } from 'motion/react';
import { Scissors, Layers, Zap, ChevronRight, Info, Sparkles } from 'lucide-react';

export default function App() {
  const [version, setVersion] = useState<'HOME' | 'V1' | 'V2' | 'V3'>('HOME');

  if (version === 'V1') {
    return (
      <div className="relative w-full h-screen">
        <button 
          onClick={() => setVersion('HOME')}
          className="absolute top-4 left-4 z-[100] bg-white/80 backdrop-blur-sm p-2 rounded-full shadow-lg hover:bg-white transition-colors"
          title="Back to Home"
        >
          <ChevronRight className="w-5 h-5 rotate-180" />
        </button>
        <V1App />
      </div>
    );
  }

  if (version === 'V2') {
    return (
      <div className="relative w-full h-screen">
        <button 
          onClick={() => setVersion('HOME')}
          className="absolute top-4 left-4 z-[100] bg-white/80 backdrop-blur-sm p-2 rounded-full shadow-lg hover:bg-white transition-colors"
          title="Back to Home"
        >
          <ChevronRight className="w-5 h-5 rotate-180" />
        </button>
        <V2App />
      </div>
    );
  }

  if (version === 'V3') {
    return (
      <div className="relative w-full h-screen">
        <button 
          onClick={() => setVersion('HOME')}
          className="absolute top-4 left-4 z-[100] bg-white/80 backdrop-blur-sm p-2 rounded-full shadow-lg hover:bg-white transition-colors"
          title="Back to Home"
        >
          <ChevronRight className="w-5 h-5 rotate-180" />
        </button>
        <V3App />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 font-sans">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-4xl w-full space-y-12"
      >
        <header className="text-center space-y-4">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-600 rounded-2xl shadow-xl shadow-indigo-200 mb-4">
            <Scissors className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-5xl font-extrabold text-slate-900 tracking-tight">Jigsaw Studio</h1>
          <p className="text-xl text-slate-600 max-w-2xl mx-auto">
            Professional-grade puzzle design engine. Choose your architecture to begin.
          </p>
        </header>

        <div className="grid md:grid-cols-3 gap-8">
          {/* V1 Card */}
          <motion.button
            whileHover={{ scale: 1.02, y: -4 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setVersion('V1')}
            className="group relative bg-white p-8 rounded-3xl shadow-xl shadow-slate-200 border border-slate-100 text-left transition-all hover:shadow-2xl hover:shadow-indigo-100"
          >
            <div className="flex items-start justify-between mb-6">
              <div className="p-3 bg-indigo-50 rounded-xl text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                <Zap className="w-6 h-6" />
              </div>
              <span className="px-3 py-1 bg-green-100 text-green-700 text-xs font-bold rounded-full uppercase tracking-wider">Stable</span>
            </div>
            <h3 className="text-2xl font-bold text-slate-900 mb-2">Classic Voronoi</h3>
            <p className="text-slate-500 mb-6 leading-relaxed">
              The original high-performance engine. Uses Voronoi diagrams for organic, randomized piece patterns. Optimized for speed and real-time editing.
            </p>
            <div className="flex items-center text-indigo-600 font-semibold group-hover:translate-x-1 transition-transform">
              Launch V1 <ChevronRight className="w-4 h-4 ml-1" />
            </div>
          </motion.button>

          {/* V2 Card */}
          <motion.button
            whileHover={{ scale: 1.02, y: -4 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setVersion('V2')}
            className="group relative bg-slate-900 p-8 rounded-3xl shadow-xl shadow-slate-900/20 text-left transition-all hover:shadow-2xl hover:shadow-indigo-500/20"
          >
            <div className="flex items-start justify-between mb-6">
              <div className="p-3 bg-white/10 rounded-xl text-white group-hover:bg-indigo-500 transition-colors">
                <Layers className="w-6 h-6" />
              </div>
              <span className="px-3 py-1 bg-indigo-500/20 text-indigo-300 text-xs font-bold rounded-full uppercase tracking-wider">Experimental</span>
            </div>
            <h3 className="text-2xl font-bold text-white mb-2">Hierarchical Areas</h3>
            <p className="text-slate-400 mb-6 leading-relaxed">
              New architecture based on recursive subdivisions. Supports nested puzzles, whimsy-first constraints, and advanced collision resolution.
            </p>
            <div className="flex items-center text-indigo-400 font-semibold group-hover:translate-x-1 transition-transform">
              Explore V2 <ChevronRight className="w-4 h-4 ml-1" />
            </div>
          </motion.button>

          {/* V3 Card */}
          <motion.button
            whileHover={{ scale: 1.02, y: -4 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setVersion('V3')}
            className="group relative bg-indigo-600 p-8 rounded-3xl shadow-xl shadow-indigo-200 text-left transition-all hover:shadow-2xl hover:shadow-indigo-300"
          >
            <div className="flex items-start justify-between mb-6">
              <div className="p-3 bg-white/20 rounded-xl text-white group-hover:bg-white group-hover:text-indigo-600 transition-colors">
                <Sparkles className="w-6 h-6" />
              </div>
              <span className="px-3 py-1 bg-white/20 text-white text-xs font-bold rounded-full uppercase tracking-wider">New</span>
            </div>
            <h3 className="text-2xl font-bold text-white mb-2">Simplified Engine</h3>
            <p className="text-indigo-100 mb-6 leading-relaxed">
              V3 focuses on a streamlined architecture. Direct Paper.js boolean operations for merging and whimsies. Clean, robust, and easy to extend.
            </p>
            <div className="flex items-center text-white font-semibold group-hover:translate-x-1 transition-transform">
              Start V3 <ChevronRight className="w-4 h-4 ml-1" />
            </div>
          </motion.button>
        </div>

        <footer className="pt-12 border-t border-slate-200 flex flex-col md:flex-row items-center justify-between gap-4 text-slate-400 text-sm">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4" />
            <span>V2 is currently in early development.</span>
          </div>
          <p>© 2026 Jigsaw Studio. All rights reserved.</p>
        </footer>
      </motion.div>
    </div>
  );
}
