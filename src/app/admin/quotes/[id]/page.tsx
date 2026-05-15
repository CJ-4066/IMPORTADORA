import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, FileText, MessageCircle, UserRound } from "lucide-react";
import { getAdminQuoteById } from "@/lib/store";
import type { AdminQuoteDetailView, AdminQuoteStatusStepView } from "@/lib/store";
import { formatCurrency } from "@/lib/utils";

export const dynamic = "force-dynamic";

type AdminQuoteDetailPageProps = {
  params: Promise<{ id: string }>;
};

function getStatusLabel(status: AdminQuoteDetailView["status"]) {
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

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-PE", {
    timeZone: "America/Lima",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function getTimeline(quote: AdminQuoteDetailView): AdminQuoteStatusStepView[] {
  if (quote.statusSteps.length) {
    return quote.statusSteps;
  }

  if (quote.status === "ERROR") {
    return [
      {
        status: "error",
        text: quote.errorMessage ?? "La cotización no pudo registrarse en el ERP.",
      },
    ];
  }

  if (quote.status === "ERP_REGISTERED") {
    return [{ status: "success", text: "Cotización registrada correctamente en el ERP." }];
  }

  return [{ status: "warning", text: "Cotización guardada localmente y pendiente de ERP." }];
}

export default async function AdminQuoteDetailPage({ params }: AdminQuoteDetailPageProps) {
  const { id } = await params;
  const quote = await getAdminQuoteById(id);

  if (!quote) {
    notFound();
  }

  const timeline = getTimeline(quote);

  return (
    <section className="admin-quote-detail">
      <div className="admin-quote-detail-top">
        <Link className="button button-secondary" href="/admin/quotes">
          <ArrowLeft size={16} />
          Volver
        </Link>
        {quote.whatsappHref ? (
          <a
            className="button button-primary"
            href={quote.whatsappHref}
            rel="noreferrer"
            target="_blank"
          >
            <MessageCircle size={16} />
            Contactar cliente
          </a>
        ) : null}
      </div>

      <section className="panel admin-quote-detail-hero">
        <div>
          <p className="eyebrow">Cotización</p>
          <h1>{quote.quoteNumber ?? "Sin número ERP"}</h1>
          <p className="panel-copy">
            Creada el {formatDate(quote.createdAt)}. Última actualización:{" "}
            {formatDate(quote.updatedAt)}.
          </p>
        </div>
        <div className="admin-quote-detail-total">
          <span className={`admin-quote-status is-${quote.status.toLowerCase()}`}>
            {getStatusLabel(quote.status)}
          </span>
          <strong>{formatCurrency(quote.total, quote.currencySymbol)}</strong>
          <span>{quote.itemCount} unidades cotizadas</span>
        </div>
      </section>

      <div className="admin-quote-detail-grid">
        <section className="panel admin-quote-detail-card">
          <div className="admin-quote-card-title">
            <UserRound size={18} />
            <h2>Cliente</h2>
          </div>
          <dl className="admin-quote-meta-list">
            <div>
              <dt>Nombre</dt>
              <dd>{quote.customerName}</dd>
            </div>
            <div>
              <dt>Teléfono</dt>
              <dd>{quote.customerPhone}</dd>
            </div>
            <div>
              <dt>Email</dt>
              <dd>{quote.customerEmail ?? "No registrado"}</dd>
            </div>
            <div>
              <dt>Documento</dt>
              <dd>
                {quote.customerDocumentNumber
                  ? `${quote.customerDocumentType ?? "Doc."} ${quote.customerDocumentNumber}`
                  : "No registrado"}
              </dd>
            </div>
            <div>
              <dt>Dirección</dt>
              <dd>{quote.customerAddress ?? "No registrada"}</dd>
            </div>
            <div>
              <dt>Cuenta</dt>
              <dd>{quote.user ? `${quote.user.name} · ${quote.user.email}` : "Compra invitada"}</dd>
            </div>
          </dl>
        </section>

        <section className="panel admin-quote-detail-card">
          <div className="admin-quote-card-title">
            <FileText size={18} />
            <h2>ERP y seguimiento</h2>
          </div>
          <dl className="admin-quote-meta-list">
            <div>
              <dt>Cliente ERP</dt>
              <dd>{getCustomerModeLabel(quote.erpCustomerMode)}</dd>
            </div>
            <div>
              <dt>ID cliente ERP</dt>
              <dd>{quote.erpCustomerId ?? "No registrado"}</dd>
            </div>
            <div>
              <dt>ID externo</dt>
              <dd>{quote.erpExternalId ?? "No registrado"}</dd>
            </div>
            <div>
              <dt>PDF interno</dt>
              <dd>
                {quote.pdfNotification
                  ? quote.pdfNotification.message
                  : "Sin notificación registrada"}
              </dd>
            </div>
          </dl>
        </section>
      </div>

      <section className="panel admin-quote-detail-card">
        <div className="admin-quote-card-title">
          <FileText size={18} />
          <h2>Productos cotizados</h2>
        </div>
        <div className="table-wrap">
          <table className="data-table admin-quote-detail-table">
            <thead>
              <tr>
                <th>Producto</th>
                <th>Código</th>
                <th>Precio</th>
                <th>Cantidad</th>
                <th>Total</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {quote.items.map((item) => (
                <tr key={`${quote.id}-${item.code}`}>
                  <td data-label="Producto">
                    <strong>{item.name}</strong>
                    <p className="muted">{item.tierLabel}</p>
                  </td>
                  <td data-label="Código">
                    {item.code}
                    {item.externalId ? <p className="muted">ERP: {item.externalId}</p> : null}
                  </td>
                  <td data-label="Precio">{formatCurrency(item.unitPrice, quote.currencySymbol)}</td>
                  <td data-label="Cantidad">{item.quantity}</td>
                  <td data-label="Total">
                    <strong>{formatCurrency(item.total, quote.currencySymbol)}</strong>
                  </td>
                  <td data-label="Acciones">
                    {item.productId ? (
                      <Link className="icon-button" href={`/admin/products/${item.productId}`}>
                        <ExternalLink size={16} />
                        <span>Producto</span>
                      </Link>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="admin-quote-detail-grid">
        <section className="panel admin-quote-detail-card">
          <div className="admin-quote-card-title">
            <FileText size={18} />
            <h2>Notas</h2>
          </div>
          <p className="muted">{quote.note ?? "El cliente no dejó una nota adicional."}</p>
          {quote.errorMessage ? <p className="error-text">{quote.errorMessage}</p> : null}
        </section>

        <section className="panel admin-quote-detail-card">
          <div className="admin-quote-card-title">
            <FileText size={18} />
            <h2>Línea de estado</h2>
          </div>
          <ol className="admin-quote-timeline">
            {timeline.map((step, index) => (
              <li className={`is-${step.status}`} key={`${step.status}-${index}`}>
                <span />
                <p>{step.text}</p>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </section>
  );
}
