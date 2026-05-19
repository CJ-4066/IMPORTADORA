"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, BookOpenText, CheckCircle2, ShieldAlert, Stamp } from "lucide-react";
import { BrandLogo } from "@/components/brand/brand-logo";

const SUBJECT_OPTIONS = ["Producto", "Entrega", "Atención", "Pago", "Otro"] as const;

export default function ComplaintsPage() {
  const [submittedClaimCode, setSubmittedClaimCode] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [subject, setSubject] = useState<(typeof SUBJECT_OPTIONS)[number]>("Producto");

  return (
    <main className="complaints-shell">
      <header className="complaints-topbar">
        <BrandLogo href="/" size="sm" />
        <Link className="button button-secondary" href="/">
          <ArrowLeft size={16} />
          Volver a la tienda
        </Link>
      </header>

      <section className="complaints-hero">
        <div className="complaints-hero-copy">
          <h1>Libro de reclamaciones</h1>
        </div>
      </section>

      <section className="complaints-layout complaints-layout-single">
        <form
          className="complaints-form-card"
          onSubmit={async (event) => {
            event.preventDefault();
            const form = event.currentTarget;
            const formData = new FormData(form);
            setIsSubmitting(true);
            setSubmitError(null);

            const response = await fetch("/api/complaints", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                kind: String(formData.get("kind") ?? "RECLAMO"),
                subject: String(formData.get("subject") ?? "Producto"),
                customerName: String(formData.get("customerName") ?? ""),
                customerPhone: String(formData.get("customerPhone") ?? ""),
                customerEmail: String(formData.get("customerEmail") ?? ""),
                documentNumber: String(formData.get("documentNumber") ?? ""),
                orderNumber: String(formData.get("orderNumber") ?? ""),
                productReference: String(formData.get("productReference") ?? ""),
                detail: String(formData.get("detail") ?? ""),
              }),
            });

            const payload = (await response.json()) as
              | { ok: true; claimCode: string }
              | { ok: false; message?: string };

            if (!response.ok || !payload.ok) {
              setSubmitError(!payload.ok ? payload.message ?? "No se pudo registrar el reclamo." : "No se pudo registrar el reclamo.");
              setSubmittedClaimCode(null);
              setIsSubmitting(false);
              return;
            }

            setSubmittedClaimCode(payload.claimCode);
            setIsSubmitting(false);
            form.reset();
            setSubject("Producto");
          }}
        >
          <div className="complaints-paper-head">
            <div>
              <p className="complaints-side-eyebrow">Libro virtual</p>
              <h2>Registro de reclamo o queja</h2>
            </div>
            {submittedClaimCode ? (
              <div className="complaints-paper-code">
                <Stamp size={16} />
                <span>{submittedClaimCode}</span>
              </div>
            ) : null}
          </div>

          <section className="complaints-section-block">
            <div className="complaints-section-title">
              <BookOpenText size={16} />
              <h3>Datos del consumidor</h3>
            </div>
            <div className="complaints-grid">
              <label className="field">
                <span>Tipo</span>
                <select defaultValue="RECLAMO" name="kind">
                  <option value="RECLAMO">Reclamo</option>
                  <option value="QUEJA">Queja</option>
                </select>
              </label>

              <label className="field">
                <span>Asunto</span>
                <select
                  name="subject"
                  value={subject}
                  onChange={(event) => setSubject(event.target.value as typeof subject)}
                >
                  {SUBJECT_OPTIONS.map((option) => (
                    <option key={option}>{option}</option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span>Nombres y apellidos</span>
                <input name="customerName" placeholder="Ingresa tu nombre completo" required />
              </label>

              <label className="field">
                <span>Documento</span>
                <input name="documentNumber" placeholder="DNI / CE / Pasaporte" required />
              </label>

              <label className="field">
                <span>Teléfono</span>
                <input name="customerPhone" placeholder="999 999 999" type="tel" />
              </label>

              <label className="field">
                <span>Correo</span>
                <input name="customerEmail" placeholder="correo@ejemplo.com" type="email" />
              </label>

              <label className="field">
                <span>Número de pedido o comprobante</span>
                <input name="orderNumber" placeholder="Opcional" />
              </label>

              <label className="field">
                <span>Referencia del producto</span>
                <input name="productReference" placeholder="Código o nombre del producto" />
              </label>
            </div>

            <label className="field field-wide">
              <span>Detalle del caso</span>
              <textarea
                name="detail"
                placeholder={`Describe brevemente el ${subject.toLowerCase()} que deseas registrar`}
                rows={6}
                required
              />
            </label>
          </section>

          <div className="complaints-form-actions">
            <button className="button button-primary" disabled={isSubmitting} type="submit">
              <CheckCircle2 size={16} />
              {isSubmitting ? "Registrando..." : "Generar constancia"}
            </button>
          </div>

          {submitError ? (
            <div className="complaints-confirmation is-error">
              <ShieldAlert size={18} />
              <div>
                <strong>No se pudo registrar</strong>
                <p>{submitError}</p>
              </div>
            </div>
          ) : null}

          {submittedClaimCode ? (
            <div className="complaints-confirmation">
              <ShieldAlert size={18} />
              <div>
                <strong>Solicitud registrada</strong>
                <p>
                  Tu constancia temporal es <span>{submittedClaimCode}</span>.
                </p>
              </div>
            </div>
          ) : null}
        </form>
      </section>
    </main>
  );
}
