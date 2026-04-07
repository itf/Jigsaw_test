import React, { useRef, useEffect, useState } from 'react';

interface WheelSliderProps {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  label: string;
  unit?: string;
  width?: string;
  isRotation?: boolean;
}

export const WheelSlider: React.FC<WheelSliderProps> = ({
  value,
  onChange,
  min,
  max,
  step = 1,
  label,
  unit = '',
  width = 'w-32',
  isRotation = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [startValue, setStartValue] = useState(0);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setStartX(e.clientX);
    setStartValue(value);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;

      const dx = e.clientX - startX;
      const sensitivity = 0.15; // Further reduced sensitivity
      let newValue = startValue + dx * sensitivity * step; 

      if (isRotation) {
        newValue = ((newValue % 360) + 360) % 360;
        if (newValue > 180) newValue -= 360;
      } else {
        newValue = Math.max(min, Math.min(max, newValue));
      }

      newValue = Math.round(newValue / step) * step;
      onChange(newValue);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, startX, startValue, onChange, min, max, step, isRotation]);

  const markerStep = isRotation ? 10 : ((max - min) / 20 || 1);
  
  return (
    <div className={`flex items-center gap-2 ${width} shrink-0`}>
      <div className="flex flex-col min-w-[40px]">
        <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter leading-none">{label}</span>
        <span className="text-[9px] font-mono font-bold text-indigo-600 truncate">
          {value.toFixed(step < 1 ? 2 : 0)}{unit}
        </span>
      </div>
      
      <div 
        ref={containerRef}
        onMouseDown={handleMouseDown}
        className="relative flex-1 h-5 bg-slate-900 rounded border border-slate-800 cursor-ew-resize select-none overflow-hidden"
      >
        {/* Center Indicator */}
        <div className="absolute left-1/2 top-0 bottom-0 w-px bg-indigo-500/50 z-10" />
        
        {/* Sliding Content */}
        <div 
          className="absolute inset-0 flex items-center"
          style={{ 
            transform: `translateX(${-((value % (markerStep * 5)) / (markerStep * 5)) * 25}px)`,
            width: '200%' 
          }}
        >
          {Array.from({ length: 20 }).map((_, i) => {
            const isMain = i % 5 === 0;
            return (
              <div 
                key={i}
                className="flex flex-col items-center shrink-0"
                style={{ width: '5px' }}
              >
                <div className={`w-px ${isMain ? 'h-2.5 bg-slate-600' : 'h-1 bg-slate-800'}`} />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
