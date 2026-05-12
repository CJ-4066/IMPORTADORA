"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { getSafeMediaUrl } from "@/lib/media-url";
import type { CatalogProduct } from "@/lib/store";

type HeroProductCarouselProps = {
  products: CatalogProduct[];
  intervalSeconds: number;
};

function chunkProducts(products: CatalogProduct[], size: number) {
  const chunks: CatalogProduct[][] = [];

  for (let index = 0; index < products.length; index += size) {
    chunks.push(products.slice(index, index + size));
  }

  return chunks;
}

export function HeroProductCarousel({ products, intervalSeconds }: HeroProductCarouselProps) {
  const slides = useMemo(() => chunkProducts(products, 2).filter((group) => group.length), [products]);
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

  if (!slides.length) {
    return null;
  }

  return (
    <div className="hero-product-carousel">
      {slides.map((slide, index) => (
        <article
          className={`hero-product-carousel-slide ${index === safeIndex ? "is-active" : ""}`}
          key={`hero-product-slide-${index}`}
        >
          {slide.map((product) => {
            const mediaUrl = getSafeMediaUrl(product.primaryMedia?.url ?? product.imageUrl);

            if (!mediaUrl) {
              return null;
            }

            return (
              <Link
                aria-label={product.name}
                className="hero-product-carousel-item"
                href={`/producto/${product.slug}`}
                key={product.id}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  alt={product.name}
                  decoding="async"
                  loading={index === 0 ? "eager" : "lazy"}
                  referrerPolicy="no-referrer"
                  src={mediaUrl}
                />
              </Link>
            );
          })}
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
            {slides.map((_, index) => (
              <button
                aria-label={`Ir al slide ${index + 1}`}
                className={index === safeIndex ? "is-active" : ""}
                key={`hero-product-dot-${index}`}
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
