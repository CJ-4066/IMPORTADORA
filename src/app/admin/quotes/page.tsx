import Link from "next/link";
import type { QuoteStatus } from "@prisma/client";
import { AlertCircle, CheckCircle2, Clock3, Eye, FileText, SearchCode } from "lucide-react";
import { getAdminQuotes } from "@/lib/store";
import { cn, formatCurrency } from "@/lib/utils";

export const dynamic = "force-dynamic";

type AdminQuotesPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const statusOptions: Array<{
  label: string;
  value: QuoteStatus | "all";
}> = [
  { label: "Todas", value: "all" },
  { label: "Registradas", value: "ERP_REGISTERED" },
  { label: "Procesando", value: "PENDING" },
  { label: "Con error", value: "ERROR" },
];

function parseStatus(value: string | string[] | undefined): QuoteStatus | "all" {
  if (value === "ERP_REGISTERED" || value === "PENDING" || value === "ERROR") {
    return value;
  }

  return "all";
}

function getStatusLabel(status: QuoteStatus) {
  if (status === "ERP_REGISTERED") return "Registrada ERP";
  if (status === "ERROR") return "Con error";
  return "Procesando";
}

function getCustomerModeLabel(value: string | null) {
  if (value === "created") return "Cliente creado ERP";
  if (value === "existing") return "Cliente existente ERP";
  if (value === "default") return "Cliente genérico ERP";
  return "Sin estado ERP";
}

function buildQuotesHref(input: { page: number; status: QuoteStatus | "all" }) {
  return `/admin/quotes?status=${encodeURIComponent(input.status)}&page=${input.page}`;
}

export default async function AdminQuotesPage({ searchParams }: AdminQuotesPageProps) {
  const params = searchParams ? await searchParams : undefined;
  const status = parseStatus(params?.status);
  const page = Number(typeof params?.page === "string" ? params.page : "1");
  const data = await getAdminQuotes({
    page: Number.isNaN(page) ? 1 : page,
    status,
  });

  return (
    <section className="panel admin-quotes-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Cotizaciones</p>
          <h1>Seguimiento comercial</h1>
        </div>
        <p className="panel-copy">
          Revisa las cotizaciones generadas desde la tienda, su vínculo con ERP y el cliente que
          inició la solicitud.
        </p>
      </div>

      <div className="admin-quote-stats">
        <article>
          <FileText size={18} />
          <strong>{data.stats.all}</strong>
          <span>Total</span>
        </article>
        <article>
          <CheckCircle2 size={18} />
          <strong>{data.stats.registered}</strong>
          <span>Registradas ERP</span>
        </article>
        <article>
          <Clock3 size={18} />
          <strong>{data.stats.pending}</strong>
          <span>Procesando</span>
        </article>
        <article>
          <AlertCircle size={18} />
          <strong>{data.stats.error}</strong>
          <span>Con error</span>
        </article>
      </div>

      <div className="trend-periods admin-quote-filters">
        {statusOptions.map((option) => (
          <Link
            className={cn("trend-period-chip", status === option.value && "is-active")}
            href={buildQuotesHref({ page: 1, status: option.value })}
            key={option.value}
          >
            {option.label}
          </Link>
        ))}
      </div>

      {data.quotes.length ? (
        <div className="table-wrap">
          <table className="data-table admin-quotes-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Cliente</th>
                <th>Cotización</th>
                <th>Productos</th>
                <th>Total</th>
                <th>Estado</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.quotes.map((quote) => (
                <tr key={quote.id}>
                  <td data-label="Fecha">
                    {new Intl.DateTimeFormat("es-PE", {
                      timeZone: "America/Lima",
                      dateStyle: "medium",
                      timeStyle: "short",
                    }).format(new Date(quote.createdAt))}
                  </td>
                  <td data-label="Cliente">
                    <strong>{quote.customerName}</strong>
                    <p className="muted">
                      {quote.customerPhone}
                      {quote.customerEmail ? ` · ${quote.customerEmail}` : ""}
                    </p>
                    {quote.user ? <p className="muted">Cuenta: {quote.user.email}</p> : null}
                  </td>
                  <td data-label="Cotización">
                    <strong>{quote.quoteNumber ?? "Sin número ERP"}</strong>
                    <p className="muted">{getCustomerModeLabel(quote.erpCustomerMode)}</p>
                  </td>
                  <td data-label="Productos">
                    <div className="admin-quote-items">
                      {quote.items.map((item) => (
                        <span key={`${quote.id}-${item.code}`}>
                          {item.quantity} x {item.name}
                        </span>
                      ))}
                    </div>
                    <p className="muted">{quote.itemCount} unidades en total</p>
                  </td>
                  <td data-label="Total">
                    <strong>{formatCurrency(quote.total, quote.currencySymbol)}</strong>
                  </td>
                  <td data-label="Estado">
                    <span className={`admin-quote-status is-${quote.status.toLowerCase()}`}>
                      {getStatusLabel(quote.status)}
                    </span>
                  </td>
                  <td data-label="Acciones">
                    <div className="table-actions">
                      <Link className="icon-button" href={`/admin/quotes/${quote.id}`}>
                        <Eye size={16} />
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
          <p className="eyebrow">Sin cotizaciones</p>
          <h2>No hay registros con este filtro</h2>
          <p className="muted">Cuando un cliente complete una cotización, aparecerá en esta vista.</p>
        </article>
      )}

      <div className="pagination-row">
        {data.page > 1 ? (
          <Link
            className="button button-secondary"
            href={buildQuotesHref({ page: data.page - 1, status })}
          >
            Página anterior
          </Link>
        ) : (
          <span />
        )}

        {data.page < data.totalPages ? (
          <Link
            className="button button-secondary"
            href={buildQuotesHref({ page: data.page + 1, status })}
          >
            Siguiente página
          </Link>
        ) : null}
      </div>
    </section>
  );
}
