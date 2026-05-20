"use client";

import { useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useHorizontalCarousel } from "@/components/catalog/use-horizontal-carousel";
import { HeroBannerVisual, type HeroBannerVisualData } from "@/components/catalog/hero-banner-visual";

type HeroBannerCarouselProps = {
  banners: HeroBannerVisualData[];
  intervalSeconds: number;
};

export function HeroBannerCarousel({ banners, intervalSeconds }: HeroBannerCarouselProps) {
  const slides = useMemo(() => banners.filter(Boolean), [banners]);
  const { activeIndex, goToNext, goToPrevious, handleScroll, scrollToIndex, viewportRef } =
    useHorizontalCarousel({ itemCount: slides.length, intervalSeconds });

  if (!slides.length) {
    return null;
  }

  return (
    <div className="hero-banner-carousel" onScroll={handleScroll} ref={viewportRef}>
      {slides.map((slide, index) => (
        <article
          className={`hero-banner-carousel-slide ${index === activeIndex ? "is-active" : ""}`}
          key={`${slide.desktopImageUrl}-${slide.title ?? index}`}
        >
          <HeroBannerVisual banner={slide} eager={index === 0} mode="auto" />
        </article>
      ))}

      {slides.length > 1 ? (
        <>
          <button
            aria-label="Banner anterior"
            className="hero-carousel-nav hero-carousel-nav-prev"
            onClick={goToPrevious}
            type="button"
          >
            <ChevronLeft size={20} />
          </button>

          <button
            aria-label="Siguiente banner"
            className="hero-carousel-nav hero-carousel-nav-next"
            onClick={goToNext}
            type="button"
          >
            <ChevronRight size={20} />
          </button>

          <div className="hero-carousel-dots">
            {slides.map((slide, index) => (
              <button
                aria-label={`Ir al banner ${index + 1}`}
                className={index === activeIndex ? "is-active" : ""}
                key={`${slide.desktopImageUrl}-dot-${index}`}
                onClick={() => scrollToIndex(index)}
                type="button"
              />
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
