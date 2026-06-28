import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Clock3, HeartHandshake, ShieldCheck } from "lucide-react";
import { BrandLogo } from "@/components/brand/brand-logo";
import { ServiceFeedbackForm } from "@/components/service-feedback-form";

export const metadata: Metadata = {
  title: "Califica tu atención | Importaciones Super",
  description: "Cuéntanos cómo fue tu experiencia en Importaciones Super.",
};

export default function ServiceFeedbackPage() {
  return (
    <main className="service-feedback-shell">
      <div className="service-feedback-orbit service-feedback-orbit-one" />
      <div className="service-feedback-orbit service-feedback-orbit-two" />

      <header className="service-feedback-topbar">
        <BrandLogo href="/" priority size="sm" />
        <Link className="service-feedback-back" href="/">
          <ArrowLeft aria-hidden="true" size={16} />
          Volver a la tienda
        </Link>
      </header>

      <div className="service-feedback-layout">
        <aside className="service-feedback-story">
          <div className="service-feedback-story-mark">
            <HeartHandshake aria-hidden="true" size={25} strokeWidth={1.8} />
          </div>
          <p className="service-feedback-eyebrow">Tu experiencia importa</p>
          <h1>Ayúdanos a mejorar tu experiencia.</h1>
          <p className="service-feedback-lead">
            En Importaciones Super queremos brindarte una mejor atención. Cuéntanos cómo fue tu
            visita a la tienda.
          </p>

          <div className="service-feedback-story-notes">
            <div>
              <Clock3 aria-hidden="true" size={18} />
              <span>
                <strong>Solo toma 1 minuto</strong>
                Seis preguntas rápidas
              </span>
            </div>
            <div>
              <ShieldCheck aria-hidden="true" size={18} />
              <span>
                <strong>Respuesta directa</strong>
                Llega a nuestro equipo de atención
              </span>
            </div>
          </div>

          <div className="service-feedback-signature">
            <span>Importaciones Super</span>
            <strong>Primeros en Tecnología</strong>
          </div>
        </aside>

        <section className="service-feedback-card">
          <ServiceFeedbackForm />
        </section>
      </div>
    </main>
  );
}
