import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarClock, Mail, UserRound } from "lucide-react";
import { ComplaintResponsePanel } from "@/components/admin/complaint-response-panel";
import { getAdminComplaintById } from "@/lib/store";

export const dynamic = "force-dynamic";

type AdminComplaintDetailPageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-PE", {
    timeZone: "America/Lima",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function getStatusLabel(status: string) {
  if (status === "IN_REVIEW") return "En revisión";
  if (status === "RESPONDED") return "Respondido";
  if (status === "CLOSED") return "Cerrado";
  return "Nuevo";
}

function getEmailStatusLabel(value: string | undefined) {
  if (value === "sent") return "Correo enviado correctamente.";
  if (value === "skipped") return "La respuesta se guardó, pero no se envió correo.";
  if (value?.startsWith("error-")) return decodeURIComponent(value.slice("error-".length));
  return null;
}

export default async function AdminComplaintDetailPage({
  params,
  searchParams,
}: AdminComplaintDetailPageProps) {
  const { id } = await params;
  const query = searchParams ? await searchParams : undefined;
  const complaint = await getAdminComplaintById(id);

  if (!complaint) {
    notFound();
  }

  const updated = query?.status === "updated";
  const emailStatus = getEmailStatusLabel(typeof query?.emailStatus === "string" ? query.emailStatus : undefined);

  return (
    <section className="stack-lg">
      <div className="admin-quote-detail-top">
        <Link className="button button-secondary" href="/admin/reclamos">
          <ArrowLeft size={16} />
          Volver
        </Link>
        <span className={`admin-complaint-status is-${complaint.status.toLowerCase()}`}>
          {getStatusLabel(complaint.status)}
        </span>
      </div>

      <section className="panel admin-quote-detail-hero">
        <div>
          <p className="eyebrow">Libro de reclamaciones</p>
          <h1>{complaint.claimCode}</h1>
          <p className="muted">
            {formatDate(complaint.createdAt)} · {formatDate(complaint.updatedAt)}
          </p>
        </div>
        <div className="admin-quote-detail-total">
          <span className={`admin-complaint-status is-${complaint.status.toLowerCase()}`}>
            {getStatusLabel(complaint.status)}
          </span>
          <strong>{complaint.kind}</strong>
          <span>{complaint.subject}</span>
        </div>
      </section>

      {updated ? (
        <article className="panel panel-slim empty-state">
          <CalendarClock size={18} />
          <p className="eyebrow">Actualizado</p>
          <h2>El reclamo se guardó correctamente.</h2>
        </article>
      ) : null}

      {emailStatus ? (
        <article className="panel panel-slim empty-state">
          <Mail size={18} />
          <p className="eyebrow">Correo</p>
          <h2>{emailStatus}</h2>
        </article>
      ) : null}

      <div className="admin-quote-detail-grid">
        <section className="panel admin-quote-detail-card">
          <div className="admin-quote-card-title">
            <UserRound size={18} />
            <h2>Cliente</h2>
          </div>
          <dl className="admin-quote-meta-list">
            <div>
              <dt>Nombre</dt>
              <dd>{complaint.customerName}</dd>
            </div>
            <div>
              <dt>Correo</dt>
              <dd>{complaint.customerEmail ?? "No registrado"}</dd>
            </div>
            <div>
              <dt>WhatsApp</dt>
              <dd>{complaint.customerPhone ?? "No registrado"}</dd>
            </div>
            <div>
              <dt>Documento</dt>
              <dd>
                {complaint.documentNumber
                  ? `${complaint.documentType ?? "Doc."} ${complaint.documentNumber}`
                  : "No registrado"}
              </dd>
            </div>
            <div>
              <dt>Pedido / comprobante</dt>
              <dd>{complaint.orderNumber ?? "No registrado"}</dd>
            </div>
            <div>
              <dt>Producto</dt>
              <dd>{complaint.productReference ?? "No registrado"}</dd>
            </div>
          </dl>
        </section>

        <section className="panel admin-quote-detail-card">
          <div className="admin-quote-card-title">
            <Mail size={18} />
            <h2>Detalle del caso</h2>
          </div>
          <p className="muted admin-complaint-detail-text">{complaint.detail}</p>
        </section>
      </div>

      <ComplaintResponsePanel complaint={complaint} />
    </section>
  );
}
