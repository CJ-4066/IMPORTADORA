"use client";

import { useState } from "react";
import { ImagePlus, Plus, Trash2, Upload, Video } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ProductMediaFormValue } from "@/components/admin/product-form-state";

type ProductMediaManagerProps = {
  initialItems: ProductMediaFormValue[];
  error?: string;
};

type MediaEntryState = ProductMediaFormValue & {
  fileName?: string;
  uploading?: boolean;
  uploadError?: string;
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
  const [items, setItems] = useState<MediaEntryState[]>(
    initialItems.length ? initialItems.map((item) => ({ ...item })) : [createEmptyMedia()],
  );

  function updateItem(index: number, key: keyof ProductMediaFormValue, value: string) {
    setItems((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [key]: value } : item,
      ),
    );
  }

  async function uploadItemFile(index: number, file: File) {
    setItems((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index
          ? { ...item, uploading: true, uploadError: "", fileName: file.name }
          : item,
      ),
    );

    try {
      const formData = new FormData();
      formData.set("file", file);
      formData.set("folder", "products");

      const response = await fetch("/api/admin/uploads", {
        method: "POST",
        body: formData,
      });

      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        url?: string;
      };

      if (!response.ok || !payload.url) {
        throw new Error(payload.error ?? "No se pudo subir el archivo.");
      }

      const nextType = file.type.startsWith("video/") ? "VIDEO" : "IMAGE";

      setItems((current) =>
        current.map((item, itemIndex) =>
          itemIndex === index
            ? {
                ...item,
                fileName: file.name,
                type: nextType,
                url: payload.url ?? "",
                uploading: false,
                uploadError: "",
              }
            : item,
        ),
      );
    } catch (uploadError) {
      setItems((current) =>
        current.map((item, itemIndex) =>
          itemIndex === index
            ? {
                ...item,
                uploading: false,
                uploadError: uploadError instanceof Error ? uploadError.message : "No se pudo subir.",
              }
            : item,
        ),
      );
    }
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
    <section className={cn("media-builder", error && "field-has-error")}>
      <div className="panel-header media-builder-header">
        <div>
          <p className="eyebrow">Fotos y videos</p>
          <h2>Galería del producto</h2>
          <p className="field-caption">
            Sube cada archivo desde tu PC o pega una URL pública. El producto puede tener varios medios.
          </p>
        </div>
        <button className="button button-secondary" onClick={addItem} type="button">
          <Plus size={16} />
          Agregar medio
        </button>
      </div>

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
                <div className="field field-wide">
                  <span>Subir desde tu PC</span>
                  <label className="upload-button media-upload-button">
                    <input
                      accept="image/*,video/*"
                      onChange={(event) => {
                        const file = event.currentTarget.files?.[0];

                        if (file) {
                          void uploadItemFile(index, file);
                        }

                        event.currentTarget.value = "";
                      }}
                      type="file"
                    />
                    <Upload size={16} />
                    <span>{item.uploading ? "Subiendo..." : "Elegir archivo"}</span>
                  </label>
                  <small className="field-caption">El archivo se guarda y luego se usa como URL pública.</small>
                  {item.fileName ? <small className="field-caption">{item.fileName}</small> : null}
                  {item.uploadError ? <small className="field-error">{item.uploadError}</small> : null}
                </div>

                <details className="product-advanced-options media-advanced-options">
                  <summary>Opciones avanzadas</summary>
                  <div className="product-advanced-options-body">
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
                      <span>URL pública del medio</span>
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
                      <small className="field-caption">
                        Solo si el archivo ya está hospedado en una URL.
                      </small>
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
                </details>
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
                        {item.altText ? <p>{item.altText}</p> : null}
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
