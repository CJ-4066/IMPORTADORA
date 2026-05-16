"use client";

import { useState, type ChangeEvent } from "react";
import { ImagePlus, Upload } from "lucide-react";

type ProductCoverFieldProps = {
  value: string;
  error?: string;
};

async function uploadProductFile(file: File) {
  if (!file.type.startsWith("image/")) {
    throw new Error("La portada debe ser una imagen.");
  }

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

  return payload.url;
}

export function ProductCoverField({ value, error }: ProductCoverFieldProps) {
  const [currentValue, setCurrentValue] = useState(() => value.trim());
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string>("");

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];

    if (!file) {
      return;
    }

    setUploading(true);
    setMessage("");

    try {
      const nextUrl = await uploadProductFile(file);
      setCurrentValue(nextUrl);
      setMessage("Archivo listo para guardar.");
    } catch (uploadError) {
      setMessage(uploadError instanceof Error ? uploadError.message : "No se pudo subir.");
    } finally {
      setUploading(false);
      input.value = "";
    }
  }

  function handleUrlChange(nextValue: string) {
    setCurrentValue(nextValue);
    setMessage("");
  }

  return (
    <article className="product-cover-card">
      <div className="product-section-head">
        <div>
          <p className="eyebrow">Portada</p>
          <h2>Imagen principal</h2>
          <p className="field-caption">
            Sube un archivo o pega una URL. La imagen se guarda como enlace público al enviar.
          </p>
        </div>
        <span className={`product-cover-status${currentValue.trim() ? " is-active" : ""}`}>
          {currentValue.trim() ? "Lista" : "Pendiente"}
        </span>
      </div>

      <div className="product-cover-grid">
        <div className="product-cover-preview">
          {currentValue.trim() ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img alt="Vista previa de portada" src={currentValue} />
          ) : (
            <div className="product-cover-empty">
              <ImagePlus size={28} />
              <span>Sin portada</span>
            </div>
          )}
        </div>

        <div className="product-cover-controls">
          <div className="field">
            <span>Subir desde tu PC</span>
            <label className="upload-button">
              <input accept="image/*" onChange={handleFileChange} type="file" />
              <Upload size={16} />
              <span>{uploading ? "Subiendo..." : "Elegir archivo"}</span>
            </label>
            <small className="field-caption">Después se convierte en URL pública y se guarda.</small>
          </div>

          <details className="product-advanced-options">
            <summary>Enlace manual</summary>
            <div className="product-advanced-options-body">
              <label className="field field-wide">
                <span>URL pública</span>
                <input
                  name="imageUrl"
                  onChange={(event) => handleUrlChange(event.target.value)}
                  placeholder="https://dominio.com/portada.jpg"
                  type="url"
                  value={currentValue}
                />
                <small className="field-caption">Opcional. Solo si ya tienes un enlace listo.</small>
              </label>
            </div>
          </details>

          <div className="product-cover-foot">
            <button
              className="button button-ghost"
              onClick={() => handleUrlChange("")}
              type="button"
            >
              Limpiar
            </button>
            <span>{message || "Usa archivo o URL."}</span>
          </div>
        </div>
      </div>

      {error ? <p className="field-error">{error}</p> : null}
    </article>
  );
}
