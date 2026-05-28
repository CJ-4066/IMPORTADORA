"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type UseHorizontalCarouselOptions = {
  itemCount: number;
  intervalSeconds?: number;
};

export function useHorizontalCarousel({ itemCount, intervalSeconds = 0 }: UseHorizontalCarouselOptions) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<number | null>(null);
  const activeIndexRef = useRef(0);
  const programmaticScrollRef = useRef(false);
  const releaseProgrammaticScrollRef = useRef<number | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const safeCount = Math.max(0, itemCount);

  const scrollToIndex = useCallback((index: number, behavior: ScrollBehavior = "smooth") => {
    const viewport = viewportRef.current;

    if (!viewport || safeCount <= 0) {
      return;
    }

    const nextIndex = ((index % safeCount) + safeCount) % safeCount;
    const slide = viewport.children.item(nextIndex) as HTMLElement | null;

    if (!slide) {
      return;
    }

    programmaticScrollRef.current = true;

    if (releaseProgrammaticScrollRef.current !== null) {
      window.clearTimeout(releaseProgrammaticScrollRef.current);
    }

    releaseProgrammaticScrollRef.current = window.setTimeout(() => {
      programmaticScrollRef.current = false;
    }, behavior === "smooth" ? 450 : 0);

    slide.scrollIntoView({
      behavior,
      block: "nearest",
      inline: "start",
    });

    activeIndexRef.current = nextIndex;
    setActiveIndex(nextIndex);
  }, [safeCount]);

  const goToPrevious = useCallback(() => {
    if (safeCount <= 0) {
      return;
    }

    scrollToIndex(activeIndexRef.current - 1);
  }, [safeCount, scrollToIndex]);

  const goToNext = useCallback(() => {
    if (safeCount <= 0) {
      return;
    }

    scrollToIndex(activeIndexRef.current + 1);
  }, [safeCount, scrollToIndex]);

  const handleScroll = useCallback(() => {
    if (programmaticScrollRef.current) {
      return;
    }

    if (frameRef.current !== null) {
      window.cancelAnimationFrame(frameRef.current);
    }

    frameRef.current = window.requestAnimationFrame(() => {
      const viewport = viewportRef.current;

      if (!viewport || viewport.clientWidth <= 0 || safeCount <= 0) {
        return;
      }

      const nextIndex = Math.round(viewport.scrollLeft / viewport.clientWidth);
      const clampedIndex = Math.max(0, Math.min(safeCount - 1, nextIndex));

      if (activeIndexRef.current !== clampedIndex) {
        activeIndexRef.current = clampedIndex;
        setActiveIndex(clampedIndex);
      }
    });
  }, [safeCount]);

  useEffect(() => {
    if (safeCount <= 1 || intervalSeconds <= 0) {
      return;
    }

    const timer = window.setInterval(() => {
      scrollToIndex((activeIndexRef.current + 1) % safeCount);
    }, intervalSeconds * 1000);

    return () => window.clearInterval(timer);
  }, [intervalSeconds, safeCount, scrollToIndex]);

  useEffect(
    () => () => {
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
      }

      if (releaseProgrammaticScrollRef.current !== null) {
        window.clearTimeout(releaseProgrammaticScrollRef.current);
      }
    },
    [],
  );

  return {
    activeIndex,
    goToNext,
    goToPrevious,
    handleScroll,
    scrollToIndex,
    viewportRef,
  };
}
