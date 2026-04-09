import React, { useRef, useEffect, useState, useCallback } from 'react';

interface InfiniteSliderProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  label: string;
  unit?: string;
  width?: string;
  isRotation?: boolean;
  sensitivity?: number;
}

export const InfiniteSlider: React.FC<InfiniteSliderProps> = ({
  value,
  onChange,
  min = -Infinity,
  max = Infinity,
  step = 1,
  label,
  unit = '',
  width = 'w-32',
  isRotation = false,
  sensitivity = 0.15,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const startXRef = useRef(0);
  const startValueRef = useRef(0);

  const handleStart = (clientX: number) => {
    setIsDragging(true);
    startXRef.current = clientX;
    startValueRef.current = value;
  };

  const handleMove = useCallback((clientX: number) => {
    if (!isDragging) return;

    const dx = clientX - startXRef.current;
    let newValue = startValueRef.current + dx * sensitivity * step;

    if (isRotation) {
      newValue = ((newValue % 360) + 360) % 360;
      if (newValue > 180) newValue -= 360;
    } else {
      newValue = Math.max(min, Math.min(max, newValue));
    }

    newValue = Math.round(newValue / step) * step;
    onChange(newValue);
  }, [isDragging, sensitivity, step, min, max, isRotation, onChange]);

  const handleEnd = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => handleMove(e.clientX);
    const onTouchMove = (e: TouchEvent) => handleMove(e.touches[0].clientX);
    const onMouseUp = () => handleEnd();
    const onTouchEnd = () => handleEnd();

    if (isDragging) {
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
      window.addEventListener('touchmove', onTouchMove, { passive: false });
      window.addEventListener('touchend', onTouchEnd);
    }

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
    };
  }, [isDragging, handleMove]);

  // For the visual "infinite" effect
  const markerStep = isRotation ? 10 : 5;
  const offset = (value % (markerStep * 10)) / (markerStep * 10);

  return (
    <div className={`flex flex-col gap-1 ${width} shrink-0 group`}>
      <div className="flex justify-between items-end px-0.5">
        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tight leading-none group-hover:text-indigo-400 transition-colors">
          {label}
        </span>
        <span className="text-[10px] font-mono font-bold text-indigo-600 leading-none">
          {value.toFixed(step < 1 ? 1 : 0)}{unit}
        </span>
      </div>
      
      <div 
        onMouseDown={(e) => handleStart(e.clientX)}
        onTouchStart={(e) => handleStart(e.touches[0].clientX)}
        className={`relative h-6 bg-slate-900 rounded-lg border border-slate-800 cursor-ew-resize select-none overflow-hidden transition-all ${isDragging ? 'border-indigo-500 ring-1 ring-indigo-500/20 shadow-inner' : 'hover:border-slate-700'}`}
      >
        {/* Subtle Gradient Overlays */}
        <div className="absolute inset-y-0 left-0 w-4 bg-gradient-to-r from-slate-900 to-transparent z-10 pointer-events-none" />
        <div className="absolute inset-y-0 right-0 w-4 bg-gradient-to-l from-slate-900 to-transparent z-10 pointer-events-none" />
        
        {/* Center Indicator */}
        <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.5)] z-20" />
        
        {/* Sliding Content */}
        <div 
          className="absolute inset-0 flex items-center"
          style={{ 
            transform: `translateX(${-offset * 40}px)`,
            width: '300%' 
          }}
        >
          {Array.from({ length: 40 }).map((_, i) => {
            const isMain = i % 5 === 0;
            return (
              <div 
                key={i}
                className="flex flex-col items-center shrink-0"
                style={{ width: '8px' }}
              >
                <div className={`w-px transition-all ${isMain ? 'h-3 bg-slate-500' : 'h-1.5 bg-slate-700'}`} />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
