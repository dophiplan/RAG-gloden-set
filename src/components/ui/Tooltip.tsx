import { ReactNode, useRef, useState } from 'react';

interface TooltipProps {
  content: string;
  children: ReactNode;
}

/**
 * Fast-appearing tooltip component
 * Shows immediately on hover with smooth animation
 * Automatically adjusts position to stay within viewport
 */
export default function Tooltip({ content, children }: TooltipProps) {
  const [position, setPosition] = useState<'left' | 'center' | 'right'>('center');
  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const handleMouseEnter = () => {
    if (triggerRef.current && tooltipRef.current) {
      const triggerRect = triggerRef.current.getBoundingClientRect();
      const windowWidth = window.innerWidth;

      // tooltip의 예상 너비 (실제로 렌더링되기 전이므로 최대값 사용)
      const tooltipMaxWidth = 320; // max-w-xs = 20rem = 320px

      // 왼쪽 정렬했을 때 오른쪽으로 나가는지 확인
      const wouldOverflowRight = triggerRect.left + tooltipMaxWidth > windowWidth - 16;
      // 중앙 정렬했을 때 양쪽으로 나가는지 확인
      const centerLeft = triggerRect.left + triggerRect.width / 2 - tooltipMaxWidth / 2;
      const centerRight = triggerRect.left + triggerRect.width / 2 + tooltipMaxWidth / 2;

      if (centerLeft < 16) {
        // 왼쪽으로 넘치면 왼쪽 정렬
        setPosition('left');
      } else if (centerRight > windowWidth - 16 || wouldOverflowRight) {
        // 오른쪽으로 넘치면 오른쪽 정렬
        setPosition('right');
      } else {
        // 여유 있으면 중앙 정렬
        setPosition('center');
      }
    }
  };

  const tooltipPositionClasses = {
    left: 'left-0',
    center: 'left-1/2 -translate-x-1/2',
    right: 'right-0'
  };

  const arrowPositionClasses = {
    left: 'left-4',
    center: 'left-1/2 -translate-x-1/2',
    right: 'right-4'
  };

  return (
    <div
      ref={triggerRef}
      className="group relative inline-block"
      onMouseEnter={handleMouseEnter}
    >
      {children}
      <div
        ref={tooltipRef}
        className={`absolute top-full mt-2 px-3 py-2 bg-slate-700 text-white text-xs rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 w-max max-w-xs pointer-events-none z-[9999] shadow-lg ${tooltipPositionClasses[position]}`}
      >
        {content}
        {/* Arrow */}
        <div className={`absolute bottom-full mb-[-4px] border-4 border-transparent border-b-slate-700 ${arrowPositionClasses[position]}`}></div>
      </div>
    </div>
  );
}
