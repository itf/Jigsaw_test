import { useCallback, useRef, useState } from 'react';

export const useLongPress = (
  onLongPress: (e: any) => void,
  onClick: (e: any) => void,
  { delay = 300, shouldPreventDefault = true } = {}
) => {
  const [longPressTriggered, setLongPressTriggered] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const targetRef = useRef<any>(null);

  const start = useCallback(
    (e: any) => {
      if (shouldPreventDefault && e.target) {
        e.target.addEventListener('contextmenu', preventDefault, {
          passive: false,
        });
      }
      e.persist();
      targetRef.current = e.target;
      timerRef.current = setTimeout(() => {
        onLongPress(e);
        setLongPressTriggered(true);
      }, delay);
    },
    [onLongPress, delay, shouldPreventDefault]
  );

  const clear = useCallback(
    (e: any, shouldTriggerClick = true) => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      if (shouldTriggerClick && !longPressTriggered) {
        onClick(e);
      }
      setLongPressTriggered(false);
      if (shouldPreventDefault && targetRef.current) {
        targetRef.current.removeEventListener('contextmenu', preventDefault);
      }
    },
    [onClick, longPressTriggered, shouldPreventDefault]
  );

  return {
    onMouseDown: (e: any) => start(e),
    onMouseUp: (e: any) => clear(e),
    onMouseLeave: (e: any) => clear(e, false),
    onTouchStart: (e: any) => start(e),
    onTouchEnd: (e: any) => clear(e),
  };
};

const preventDefault = (e: any) => {
  if (!e.preventDefault) return;
  e.preventDefault();
};
