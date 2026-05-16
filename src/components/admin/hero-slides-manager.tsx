"use client";

import { useState } from "react";
import { ImagePlus, Plus, Trash2 } from "lucide-react";
import type { HeroSlideView } from "@/lib/store";

type HeroSlidesManagerProps = {
  initialItems: HeroSlideView[];
};

function createEmptySlide(): HeroSlideView {
  return {
    imageUrl: "",
    title: null,
    text: null,
  };
}

export function HeroSlidesManager({ initialItems }: HeroSlidesManagerProps) {
  const [items, setItems] = useState<HeroSlideView[]>(
    initialItems.length ? initialItems : [createEmptySlide()],
  );

  function updateItem(index: number, key: keyof HeroSlideView, value: string) {
    setItems((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index
          ? {
              ...item,
              [key]: value.trim() ? value : null,
            }
          : item,
      ),
    );
  }

  function addItem() {
    setItems((current) => [...current, createEmptySlide()]);
  }

  function removeItem(index: number) {
    setItems((current) => {
      const nextItems = current.filter((_, itemIndex) => itemIndex !== index);
      return nextItems.length ? nextItems : [createEmptySlide()];
    });
  }

  return (
    <section className="media-builder">
      <div className="panel-header media-builder-header">
        <div>
          <p className="eyebrow">Personalizar hero</p>
          <h2>Slides principales</h2>
        </div>
        <button className="button button-secondary" onClick={addItem} type="button">
          <Plus size={16} />
          Agregar imagen
        </button>
      </div>

      <div className="media-builder-grid">
        <div className="media-fields-list">
          {items.map((item, index) => (
            <article className="media-entry-card" key={`${index}-${item.imageUrl ?? "slide"}`}>
              <div className="media-entry-head">
                <strong>Slide {index + 1}</strong>
                <button className="icon-button danger" onClick={() => removeItem(index)} type="button">
                  <Trash2 size={16} />
                </button>
              </div>

              <div className="media-entry-grid hero-slide-entry-grid">
                <label className="field field-wide">
                  <span>Imagen</span>
                  <input
                    name="heroSlideImageUrl"
                    onChange={(event) => updateItem(index, "imageUrl", event.target.value)}
                    placeholder="https://dominio.com/hero.jpg"
                    type="url"
                    value={item.imageUrl}
                  />
                </label>

                <label className="field field-wide">
                  <span>Título opcional</span>
                  <input
                    name="heroSlideTitle"
                    onChange={(event) => updateItem(index, "title", event.target.value)}
                    placeholder="Campaña principal"
                    value={item.title ?? ""}
                  />
                </label>

                <label className="field field-wide">
                  <span>Texto opcional</span>
                  <textarea
                    name="heroSlideText"
                    onChange={(event) => updateItem(index, "text", event.target.value)}
                    placeholder="Texto corto para reforzar la campaña o mensaje visual."
                    rows={3}
                    value={item.text ?? ""}
                  />
                </label>
              </div>
            </article>
          ))}
        </div>

        <aside className="media-preview-panel">
          <div className="stack-sm">
            <div className="media-preview-head">
              <div className="category-icon">
                <ImagePlus size={18} />
              </div>
              <h3>Vista previa</h3>
            </div>

            <div className="media-preview-stack">
              {items.some((item) => item.imageUrl.trim()) ? (
                items
                  .filter((item) => item.imageUrl.trim())
                  .map((item, index) => (
                    <article className="media-preview-card hero-slide-preview-card" key={`${item.imageUrl}-${index}`}>
                      <div className="media-preview-frame hero-slide-preview-frame">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img alt={item.title ?? `Slide ${index + 1}`} src={item.imageUrl} />
                        <div className="hero-slide-preview-overlay">
                          {item.title ? <strong>{item.title}</strong> : null}
                          {item.text ? <p>{item.text}</p> : null}
                        </div>
                      </div>
                    </article>
                  ))
              ) : (
                <div className="media-preview-empty">
                  <ImagePlus size={20} />
                </div>
              )}
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}
