import React, { useState, useRef, useEffect, useCallback } from 'react';

interface RangeSliderProps {
  label?: string;
  min: number;
  max: number;
  step?: number;
  value: [number, number];
  onChange: (value: [number, number]) => void;
  unit?: string;
}

export const RangeSlider: React.FC<RangeSliderProps> = ({
  label,
  min,
  max,
  step = 1,
  value,
  onChange,
  unit = '',
}) => {
  const [low, high] = value;
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<'low' | 'high' | null>(null);

  const formatValue = (val: number) => {
    if (step < 0.1) return val.toFixed(3);
    if (step < 1) return val.toFixed(2);
    return val.toString();
  };

  const getValueFromPos = useCallback((clientX: number) => {
    if (!trackRef.current) return min;
    const rect = trackRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    const percent = x / rect.width;
    const rawVal = min + percent * (max - min);
    return Math.round(rawVal / step) * step;
  }, [min, max, step]);

  const handleMouseDown = (e: React.MouseEvent | React.TouchEvent, type: 'low' | 'high') => {
    e.preventDefault();
    setDragging(type);
  };

  useEffect(() => {
    if (!dragging) return;

    const handleMove = (e: MouseEvent | TouchEvent) => {
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const newVal = getValueFromPos(clientX);
      
      if (dragging === 'low') {
        onChange([Math.min(newVal, high), high]);
      } else {
        onChange([low, Math.max(newVal, low)]);
      }
    };

    const handleUp = () => {
      setDragging(null);
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    window.addEventListener('touchmove', handleMove);
    window.addEventListener('touchend', handleUp);

    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleUp);
    };
  }, [dragging, low, high, getValueFromPos, onChange]);

  const getPercent = (val: number) => ((val - min) / (max - min)) * 100;

  return (
    <div className="flex flex-col gap-1.5 min-w-[140px] select-none">
      <div className="flex justify-between items-end px-0.5">
        {label && (
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tight leading-none">
            {label}
          </span>
        )}
        <span className="text-[10px] font-mono font-bold text-indigo-600 leading-none ml-auto">
          {formatValue(low)}{unit} - {formatValue(high)}{unit}
        </span>
      </div>
      
      <div className="relative h-5 flex items-center" ref={trackRef}>
        {/* Track */}
        <div className="absolute w-full h-1.5 bg-slate-200 rounded-full" />
        
        {/* Active Range */}
        <div 
          className="absolute h-1.5 bg-indigo-500 rounded-full"
          style={{
            left: `${getPercent(low)}%`,
            right: `${100 - getPercent(high)}%`
          }}
        />
        
        {/* Handles */}
        <div
          onMouseDown={(e) => handleMouseDown(e, 'low')}
          onTouchStart={(e) => handleMouseDown(e, 'low')}
          className="absolute w-4 h-4 bg-white border-2 border-indigo-500 rounded-full shadow-sm cursor-grab active:cursor-grabbing z-10 -ml-2"
          style={{ left: `${getPercent(low)}%` }}
        />
        <div
          onMouseDown={(e) => handleMouseDown(e, 'high')}
          onTouchStart={(e) => handleMouseDown(e, 'high')}
          className="absolute w-4 h-4 bg-white border-2 border-indigo-500 rounded-full shadow-sm cursor-grab active:cursor-grabbing z-10 -ml-2"
          style={{ left: `${getPercent(high)}%` }}
        />
      </div>
    </div>
  );
};
