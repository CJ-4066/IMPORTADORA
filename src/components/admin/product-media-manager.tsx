"use client";

import { useState } from "react";
import { ImagePlus, Plus, Trash2, Video } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ProductMediaFormValue } from "@/components/admin/product-form-state";

type ProductMediaManagerProps = {
  initialItems: ProductMediaFormValue[];
  error?: string;
};

function createEmptyMedia(type: "IMAGE" | "VIDEO" = "IMAGE"): ProductMediaFormValue {
  return {
    type,
    url: "",
    altText: "",
  };
}

export function ProductMediaManager({
  initialItems,
  error,
}: ProductMediaManagerProps) {
  const [items, setItems] = useState<ProductMediaFormValue[]>(
    initialItems.length ? initialItems : [createEmptyMedia()],
  );

  function updateItem(index: number, key: keyof ProductMediaFormValue, value: string) {
    setItems((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [key]: value } : item,
      ),
    );
  }

  function addItem() {
    setItems((current) => [...current, createEmptyMedia()]);
  }

  function removeItem(index: number) {
    setItems((current) => {
      const nextItems = current.filter((_, itemIndex) => itemIndex !== index);
      return nextItems.length ? nextItems : [createEmptyMedia()];
    });
  }

  return (
    <section className={cn("media-builder", error && "field-has-error")} id="media">
      <div className="panel-header media-builder-header">
        <div>
          <p className="eyebrow">Fotos y videos</p>
          <h2>Galería del producto</h2>
        </div>
        <button className="button button-secondary" onClick={addItem} type="button">
          <Plus size={16} />
          Agregar medio
        </button>
      </div>

      <p className="panel-copy">
        Agrega fotos o videos por URL. El primer medio será la portada del producto.
      </p>

      {error ? <p className="field-error">{error}</p> : null}

      <div className="media-builder-grid">
        <div className="media-fields-list">
          {items.map((item, index) => (
            <article className="media-entry-card" key={`${index}-${item.type}`}>
              <div className="media-entry-head">
                <strong>Medio {index + 1}</strong>
                <button className="icon-button danger" onClick={() => removeItem(index)} type="button">
                  <Trash2 size={16} />
                </button>
              </div>

              <div className="media-entry-grid">
                <label className="field">
                  <span>Tipo</span>
                  <select
                    name="mediaType"
                    onChange={(event) => updateItem(index, "type", event.target.value)}
                    value={item.type}
                  >
                    <option value="IMAGE">Foto</option>
                    <option value="VIDEO">Video</option>
                  </select>
                </label>

                <label className="field field-wide">
                  <span>URL del medio</span>
                  <input
                    name="mediaUrl"
                    onChange={(event) => updateItem(index, "url", event.target.value)}
                    placeholder={
                      item.type === "IMAGE"
                        ? "https://dominio.com/foto.jpg"
                        : "https://dominio.com/video.mp4"
                    }
                    type="url"
                    value={item.url}
                  />
                </label>

                <label className="field field-wide">
                  <span>Texto descriptivo</span>
                  <input
                    name="mediaAltText"
                    onChange={(event) => updateItem(index, "altText", event.target.value)}
                    placeholder="Descripción corta del medio"
                    value={item.altText}
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
              <div>
                <h3>Vista previa</h3>
                <p className="muted">Así se verá la galería principal del producto.</p>
              </div>
            </div>

            <div className="media-preview-stack">
              {items.some((item) => item.url.trim()) ? (
                items
                  .filter((item) => item.url.trim())
                  .map((item, index) => (
                    <article className="media-preview-card" key={`${item.url}-${index}`}>
                      <div className="media-preview-frame">
                        {item.type === "IMAGE" ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img alt={item.altText || `Vista previa ${index + 1}`} src={item.url} />
                        ) : (
                          <video controls muted playsInline src={item.url} />
                        )}
                      </div>
                      <div className="media-preview-meta">
                        <span className="pill">
                          {item.type === "IMAGE" ? <ImagePlus size={14} /> : <Video size={14} />}
                          {item.type === "IMAGE" ? "Foto" : "Video"}
                        </span>
                        <p>{item.altText || "Sin texto descriptivo"}</p>
                      </div>
                    </article>
                  ))
              ) : (
                <div className="media-preview-empty">
                  <ImagePlus size={20} />
                  <p>Agrega fotos o videos para ver la vista previa aquí.</p>
                </div>
              )}
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}
