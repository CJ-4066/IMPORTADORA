"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

type ScrollingShortcutsMarqueeProps = {
  children: ReactNode;
  speed?: number;
};

function wrapOffset(value: number, cycleWidth: number) {
  if (cycleWidth <= 0) {
    return 0;
  }

  const wrapped = value % cycleWidth;

  return wrapped < 0 ? wrapped + cycleWidth : wrapped;
}

export function ScrollingShortcutsMarquee({ children, speed = 0.35 }: ScrollingShortcutsMarqueeProps) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const firstGroupRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef({
    active: false,
    pointerId: -1,
    startX: 0,
    startOffset: 0,
  });
  const frameRef = useRef<number | null>(null);
  const [cycleWidth, setCycleWidth] = useState(0);
  const [offset, setOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    const updateCycleWidth = () => {
      const group = firstGroupRef.current;

      if (!group) {
        return;
      }

      const track = group.parentElement;
      const styles = track ? window.getComputedStyle(track) : null;
      const gap = styles ? Number.parseFloat(styles.columnGap || styles.gap || "0") || 0 : 0;

      setCycleWidth(group.getBoundingClientRect().width + gap);
    };

    updateCycleWidth();

    const group = firstGroupRef.current;

    if (!group) {
      return;
    }

    const resizeObserver = new ResizeObserver(updateCycleWidth);
    resizeObserver.observe(group);

    window.addEventListener("resize", updateCycleWidth);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateCycleWidth);
    };
  }, []);

  useEffect(() => {
    if (cycleWidth <= 0) {
      return;
    }

    const step = () => {
      if (!dragStateRef.current.active) {
        setOffset((current) => wrapOffset(current + speed, cycleWidth));
      }

      frameRef.current = window.requestAnimationFrame(step);
    };

    frameRef.current = window.requestAnimationFrame(step);

    return () => {
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
      }
    };
  }, [cycleWidth, speed]);

  const trackStyle = useMemo(
    () => ({
      transform: `translate3d(${-offset}px, 0, 0)`,
    }),
    [offset],
  );

  return (
    <div
      className={`public-store-shortcuts-marquee${isDragging ? " is-dragging" : ""}`}
      onPointerDown={(event) => {
        const viewport = viewportRef.current ?? event.currentTarget;

        if (event.pointerType !== "mouse" && event.pointerType !== "pen" && event.pointerType !== "touch") {
          return;
        }

        dragStateRef.current.active = true;
        dragStateRef.current.pointerId = event.pointerId;
        dragStateRef.current.startX = event.clientX;
        dragStateRef.current.startOffset = offset;
        setIsDragging(true);
        viewport.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        if (!dragStateRef.current.active || dragStateRef.current.pointerId !== event.pointerId || cycleWidth <= 0) {
          return;
        }

        const deltaX = event.clientX - dragStateRef.current.startX;
        setOffset(wrapOffset(dragStateRef.current.startOffset - deltaX, cycleWidth));
      }}
      onPointerUp={(event) => {
        const viewport = event.currentTarget;

        if (dragStateRef.current.pointerId === event.pointerId && viewport.hasPointerCapture(event.pointerId)) {
          viewport.releasePointerCapture(event.pointerId);
        }

        dragStateRef.current.active = false;
        dragStateRef.current.pointerId = -1;
        setIsDragging(false);
      }}
      onPointerLeave={() => {
        dragStateRef.current.active = false;
        dragStateRef.current.pointerId = -1;
        setIsDragging(false);
      }}
      onPointerCancel={() => {
        dragStateRef.current.active = false;
        dragStateRef.current.pointerId = -1;
        setIsDragging(false);
      }}
      ref={viewportRef}
    >
      <div className="public-store-shortcuts-marquee-track" ref={trackRef} style={trackStyle}>
        <div className="public-store-shortcuts-marquee-copy" ref={firstGroupRef}>
          {children}
        </div>
        <div className="public-store-shortcuts-marquee-copy" aria-hidden="true" inert>
          {children}
        </div>
      </div>
    </div>
  );
}
