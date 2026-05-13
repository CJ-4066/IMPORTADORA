"use client";

import { useEffect, useRef } from "react";
import type { ReactNode } from "react";

type ScrollingShortcutsMarqueeProps = {
  children: ReactNode;
  speed?: number;
};

export function ScrollingShortcutsMarquee({ children, speed = 0.35 }: ScrollingShortcutsMarqueeProps) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef({
    active: false,
    pointerId: -1,
    startX: 0,
    startScrollLeft: 0,
  });
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    const viewport = viewportRef.current;

    if (!viewport) {
      return;
    }

    const step = () => {
      const currentViewport = viewportRef.current;

      if (currentViewport && !dragStateRef.current.active) {
        const maxScrollLeft = currentViewport.scrollWidth - currentViewport.clientWidth;

        if (maxScrollLeft > 0) {
          currentViewport.scrollLeft += speed;

          if (currentViewport.scrollLeft >= maxScrollLeft) {
            currentViewport.scrollLeft = 0;
          } else if (currentViewport.scrollLeft < 0) {
            currentViewport.scrollLeft = maxScrollLeft;
          }
        }
      }

      frameRef.current = window.requestAnimationFrame(step);
    };

    frameRef.current = window.requestAnimationFrame(step);

    return () => {
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
      }
    };
  }, [speed]);

  return (
    <div
      className="public-store-shortcuts-marquee"
      onPointerDown={(event) => {
        if (event.pointerType === "mouse" || event.pointerType === "pen" || event.pointerType === "touch") {
          const viewport = viewportRef.current;

          if (!viewport) {
            return;
          }

          dragStateRef.current.active = true;
          dragStateRef.current.pointerId = event.pointerId;
          dragStateRef.current.startX = event.clientX;
          dragStateRef.current.startScrollLeft = viewport.scrollLeft;
          viewport.setPointerCapture(event.pointerId);
        }
      }}
      onPointerMove={(event) => {
        const viewport = viewportRef.current;

        if (!viewport || !dragStateRef.current.active || dragStateRef.current.pointerId !== event.pointerId) {
          return;
        }

        const deltaX = event.clientX - dragStateRef.current.startX;
        const maxScrollLeft = viewport.scrollWidth - viewport.clientWidth;

        viewport.scrollLeft = dragStateRef.current.startScrollLeft - deltaX;

        if (maxScrollLeft > 0) {
          if (viewport.scrollLeft >= maxScrollLeft) {
            viewport.scrollLeft = 0;
          } else if (viewport.scrollLeft < 0) {
            viewport.scrollLeft = maxScrollLeft;
          }
        }
      }}
      onPointerUp={(event) => {
        const viewport = viewportRef.current;

        if (viewport && dragStateRef.current.pointerId === event.pointerId && viewport.hasPointerCapture(event.pointerId)) {
          viewport.releasePointerCapture(event.pointerId);
        }

        dragStateRef.current.active = false;
        dragStateRef.current.pointerId = -1;
      }}
      onPointerLeave={() => {
        dragStateRef.current.active = false;
        dragStateRef.current.pointerId = -1;
      }}
      onPointerCancel={() => {
        dragStateRef.current.active = false;
        dragStateRef.current.pointerId = -1;
      }}
      onScroll={() => {
        const viewport = viewportRef.current;

        if (!viewport || dragStateRef.current.active) {
          return;
        }

        const maxScrollLeft = viewport.scrollWidth - viewport.clientWidth;

        if (maxScrollLeft > 0 && viewport.scrollLeft >= maxScrollLeft) {
          viewport.scrollLeft = 0;
        }
      }}
      ref={viewportRef}
    >
      <div className="public-store-shortcuts-marquee-track">{children}</div>
    </div>
  );
}
