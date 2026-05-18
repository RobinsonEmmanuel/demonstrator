'use client';

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import type { FactVerificationResult } from '@/types/fact-check';
import { FieldValidationBlock } from '@/components/fact-check/FieldValidationBlock';
import { highlightClass } from '@/components/fact-check/FactHoverCard';

const GAP = 8;
const PAD = 12;
const MAX_TOOLTIP_W = 520;

function computeTooltipLayout(rect: DOMRect): {
  placement: 'below' | 'above';
  left: number;
  width: number;
  top: number;
  maxHeight: number;
} {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const width = Math.min(MAX_TOOLTIP_W, vw - 2 * PAD);
  let left = rect.left;
  if (left + width > vw - PAD) left = vw - width - PAD;
  if (left < PAD) left = PAD;

  const topBelow = rect.bottom + GAP;
  const spaceBelow = vh - topBelow - PAD;
  const spaceAbove = rect.top - PAD - GAP;

  const preferBelow = spaceBelow >= 140 || spaceBelow >= spaceAbove;

  if (preferBelow) {
    const maxHeight = Math.max(120, Math.min(vh * 0.75, spaceBelow));
    return {
      placement: 'below',
      left,
      width,
      top: topBelow,
      maxHeight,
    };
  }

  const topAnchor = rect.top - GAP;
  const maxHeight = Math.max(120, Math.min(vh * 0.75, spaceAbove));
  return {
    placement: 'above',
    left,
    width,
    top: topAnchor,
    maxHeight,
  };
}

export function FactSpanWithTooltip({
  children,
  verification,
}: {
  children: React.ReactNode;
  verification?: FactVerificationResult;
}) {
  const [open, setOpen] = useState(false);
  const [layout, setLayout] = useState<ReturnType<typeof computeTooltipLayout> | null>(null);
  const triggerRef = useRef<HTMLSpanElement>(null);
  const leaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearLeaveTimer = useCallback(() => {
    if (leaveTimerRef.current) {
      clearTimeout(leaveTimerRef.current);
      leaveTimerRef.current = null;
    }
  }, []);

  const syncLayout = useCallback(() => {
    const el = triggerRef.current;
    if (!el || typeof window === 'undefined') return;
    setLayout(computeTooltipLayout(el.getBoundingClientRect()));
  }, []);

  const openTooltip = useCallback(() => {
    clearLeaveTimer();
    syncLayout();
    setOpen(true);
  }, [clearLeaveTimer, syncLayout]);

  const scheduleClose = useCallback(() => {
    clearLeaveTimer();
    leaveTimerRef.current = setTimeout(() => {
      setOpen(false);
      setLayout(null);
    }, 180);
  }, [clearLeaveTimer]);

  useLayoutEffect(() => {
    if (!open) return;
    syncLayout();
  }, [open, syncLayout]);

  useEffect(() => {
    if (!open) return;
    const onScrollResize = () => syncLayout();
    window.addEventListener('scroll', onScrollResize, true);
    window.addEventListener('resize', onScrollResize);
    return () => {
      window.removeEventListener('scroll', onScrollResize, true);
      window.removeEventListener('resize', onScrollResize);
    };
  }, [open, syncLayout]);

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <>
      <span
        ref={triggerRef}
        className="inline"
        onMouseEnter={openTooltip}
        onMouseLeave={scheduleClose}
      >
        <span
          className={`cursor-help rounded-sm px-0.5 transition-colors ${highlightClass(verification)}`}
        >
          {children}
        </span>
      </span>
      {mounted &&
        open &&
        layout &&
        createPortal(
          <div
            className="pointer-events-auto fixed z-[10000] overflow-y-auto overflow-x-hidden rounded-lg border border-gray-200 bg-white p-2 shadow-xl ring-1 ring-black/10"
            style={{
              left: layout.left,
              width: layout.width,
              maxHeight: layout.maxHeight,
              top: layout.top,
              transform:
                layout.placement === 'above' ? 'translateY(-100%)' : undefined,
            }}
            onMouseEnter={clearLeaveTimer}
            onMouseLeave={scheduleClose}
          >
            <FieldValidationBlock verification={verification} />
          </div>,
          document.body
        )}
    </>
  );
}
