import Link from "next/link";
import type { ComplaintStatus } from "@prisma/client";
import { FileText, MessageCircle, SearchCode, ShieldAlert } from "lucide-react";
import { getAdminComplaints } from "@/lib/store";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

type AdminComplaintsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const statusOptions: Array<{
  label: string;
  value: ComplaintStatus | "all";
}> = [
  { label: "Todas", value: "all" },
  { label: "Nuevas", value: "NEW" },
  { label: "En revisión", value: "IN_REVIEW" },
  { label: "Respondidas", value: "RESPONDED" },
  { label: "Cerradas", value: "CLOSED" },
];

function parseStatus(value: string | string[] | undefined): ComplaintStatus | "all" {
  if (value === "NEW" || value === "IN_REVIEW" || value === "RESPONDED" || value === "CLOSED") {
    return value;
  }

  return "all";
}

function buildComplaintsHref(input: { page: number; status: ComplaintStatus | "all" }) {
  return `/admin/reclamos?status=${encodeURIComponent(input.status)}&page=${input.page}`;
}

function getStatusLabel(status: ComplaintStatus) {
  if (status === "IN_REVIEW") return "En revisión";
  if (status === "RESPONDED") return "Respondido";
  if (status === "CLOSED") return "Cerrado";
  return "Nuevo";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-PE", {
    timeZone: "America/Lima",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default async function AdminComplaintsPage({ searchParams }: AdminComplaintsPageProps) {
  const params = searchParams ? await searchParams : undefined;
  const status = parseStatus(params?.status);
  const page = Number(typeof params?.page === "string" ? params.page : "1");
  const data = await getAdminComplaints({
    page: Number.isNaN(page) ? 1 : page,
    status,
  });
  const pageStart = data.totalResults > 0 ? (data.page - 1) * data.pageSize + 1 : 0;
  const pageEnd = Math.min(data.page * data.pageSize, data.totalResults);

  return (
    <section className="panel admin-quotes-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Atención</p>
          <h1>Libro de reclamaciones</h1>
        </div>
      </div>

      <div className="admin-quote-stats">
        <article>
          <ShieldAlert size={18} />
          <strong>{data.stats.all}</strong>
          <span>Total</span>
        </article>
        <article>
          <FileText size={18} />
          <strong>{data.stats.new}</strong>
          <span>Nuevos</span>
        </article>
        <article>
          <SearchCode size={18} />
          <strong>{data.stats.inReview}</strong>
          <span>En revisión</span>
        </article>
        <article>
          <MessageCircle size={18} />
          <strong>{data.stats.responded}</strong>
          <span>Respondidos</span>
        </article>
      </div>

      <p className="results-copy">
        Mostrando {pageStart}–{pageEnd} de {data.totalResults} · página {data.page} de {data.totalPages}.
      </p>

      <div className="trend-periods admin-quote-filters">
        {statusOptions.map((option) => (
          <Link
            className={cn("trend-period-chip", status === option.value && "is-active")}
            href={buildComplaintsHref({ page: 1, status: option.value })}
            key={option.value}
          >
            {option.label}
          </Link>
        ))}
      </div>

      {data.complaints.length ? (
        <div className="table-wrap">
          <table className="data-table admin-quotes-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Cliente</th>
                <th>Caso</th>
                <th>Contacto</th>
                <th>Estado</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.complaints.map((complaint) => (
                <tr key={complaint.id}>
                  <td data-label="Fecha">{formatDate(complaint.createdAt)}</td>
                  <td data-label="Cliente">
                    <strong>{complaint.customerName}</strong>
                    <p className="muted">{complaint.claimCode}</p>
                  </td>
                  <td data-label="Caso">
                    <strong>{complaint.subject}</strong>
                    <p className="muted">{complaint.kind}</p>
                  </td>
                  <td data-label="Contacto">
                    <p className="muted">{complaint.customerEmail ?? "Sin correo"}</p>
                    <p className="muted">{complaint.customerPhone ?? "Sin WhatsApp"}</p>
                    {complaint.responseChannel ? (
                      <p className="muted">Respuesta: {complaint.responseChannel}</p>
                    ) : null}
                  </td>
                  <td data-label="Estado">
                    <span className={`admin-complaint-status is-${complaint.status.toLowerCase()}`}>
                      {getStatusLabel(complaint.status)}
                    </span>
                  </td>
                  <td data-label="Acciones">
                    <div className="table-actions">
                      <Link className="icon-button" href={`/admin/reclamos/${complaint.id}`}>
                        <SearchCode size={16} />
                        <span>Ver</span>
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <article className="panel panel-slim empty-state">
          <SearchCode size={18} />
          <p className="eyebrow">Sin reclamos</p>
          <h2>No hay registros con este filtro</h2>
        </article>
      )}

      <div className="pagination-row">
        {data.page > 1 ? (
          <Link
            className="button button-secondary"
            href={buildComplaintsHref({ page: data.page - 1, status })}
          >
            Página anterior
          </Link>
        ) : (
          <span />
        )}

        {data.page < data.totalPages ? (
          <Link
            className="button button-secondary"
            href={buildComplaintsHref({ page: data.page + 1, status })}
          >
            Siguiente página
          </Link>
        ) : null}
      </div>
    </section>
  );
}
