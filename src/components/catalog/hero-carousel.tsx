"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { HeroSlideView } from "@/lib/store";

type HeroCarouselProps = {
  slides: HeroSlideView[];
  intervalSeconds: number;
};

export function HeroCarousel({ slides, intervalSeconds }: HeroCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const safeIndex = slides.length ? activeIndex % slides.length : 0;

  useEffect(() => {
    if (slides.length <= 1) {
      return;
    }

    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % slides.length);
    }, intervalSeconds * 1000);

    return () => window.clearInterval(timer);
  }, [intervalSeconds, slides.length]);

  const goToPrevious = () => {
    setActiveIndex((current) => (current - 1 + slides.length) % slides.length);
  };

  const goToNext = () => {
    setActiveIndex((current) => (current + 1) % slides.length);
  };

  return (
    <div className="hero-carousel">
      {slides.map((slide, index) => (
        <article
          className={`hero-carousel-slide ${index === safeIndex ? "is-active" : ""}`}
          key={`${slide.imageUrl}-${index}`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img alt={slide.title ?? `Slide ${index + 1}`} src={slide.imageUrl} />
        </article>
      ))}

      {slides.length > 1 ? (
        <>
          <button
            aria-label="Slide anterior"
            className="hero-carousel-nav hero-carousel-nav-prev"
            onClick={goToPrevious}
            type="button"
          >
            <ChevronLeft size={20} />
          </button>

          <button
            aria-label="Siguiente slide"
            className="hero-carousel-nav hero-carousel-nav-next"
            onClick={goToNext}
            type="button"
          >
            <ChevronRight size={20} />
          </button>

          <div className="hero-carousel-dots">
            {slides.map((slide, index) => (
              <button
                aria-label={`Ir al slide ${index + 1}`}
                className={index === safeIndex ? "is-active" : ""}
                key={`${slide.imageUrl}-dot-${index}`}
                onClick={() => setActiveIndex(index)}
                type="button"
              />
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
