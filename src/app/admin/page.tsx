import Link from "next/link";
import {
  ArrowDownRight,
  ArrowUpRight,
  Boxes,
  CalendarClock,
  DatabaseZap,
  EyeOff,
  ImageOff,
  FolderTree,
  Layers3,
  PackageSearch,
  TriangleAlert,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { hideProductsWithoutPhotoAction, syncProductsFromErpAction } from "@/app/admin/actions";
import { SubmitButton } from "@/components/ui/submit-button";
import type { DashboardComparisonMetric, DashboardPeriod, DashboardTrendProduct } from "@/lib/store";
import { getAdminDashboardData } from "@/lib/store";
import { cn, formatCompactNumber, formatCurrency } from "@/lib/utils";

export const dynamic = "force-dynamic";

type AdminHomePageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const periodOptions: Array<{
  label: string;
  shortLabel: string;
  value: DashboardPeriod;
  queryValue: string;
}> = [
  { label: "Semanal", shortLabel: "Semana", value: "WEEK", queryValue: "week" },
  { label: "Mensual", shortLabel: "Mes", value: "MONTH", queryValue: "month" },
  { label: "Anual", shortLabel: "Año", value: "YEAR", queryValue: "year" },
];

function parsePeriod(value: string | string[] | undefined): DashboardPeriod {
  const normalized = typeof value === "string" ? value.toUpperCase() : "MONTH";

  if (normalized === "WEEK" || normalized === "MONTH" || normalized === "YEAR") {
    return normalized;
  }

  return "MONTH";
}

function formatMetricValue(metric: DashboardComparisonMetric, currencySymbol: string) {
  if (metric.label === "Ventas") {
    return formatCurrency(metric.currentValue, currencySymbol);
  }

  return formatCompactNumber(metric.currentValue);
}

function formatPreviousValue(metric: DashboardComparisonMetric, currencySymbol: string) {
  if (metric.previousValue === null) {
    return "Sin histórico";
  }

  if (metric.label === "Ventas") {
    return formatCurrency(metric.previousValue, currencySymbol);
  }

  return formatCompactNumber(metric.previousValue);
}

function formatDelta(deltaPercent: number | null) {
  if (deltaPercent === null) {
    return "Sin base";
  }

  return `${deltaPercent > 0 ? "+" : ""}${deltaPercent.toFixed(1)}%`;
}

function getDeltaTone(deltaPercent: number | null) {
  if (deltaPercent === null) {
    return "is-neutral";
  }

  return deltaPercent >= 0 ? "is-positive" : "is-negative";
}

function ProductTrendList({
  emptyCopy,
  maxUnitsSold,
  products,
  title,
  tone,
}: {
  emptyCopy: string;
  maxUnitsSold: number;
  products: DashboardTrendProduct[];
  title: string;
  tone: "positive" | "negative";
}) {
  const Icon = tone === "positive" ? TrendingUp : TrendingDown;

  return (
    <article className="trend-list-card">
      <div className="trend-list-head">
        <div>
          <p className="eyebrow">{tone === "positive" ? "Tendencia positiva" : "Tendencia en caída"}</p>
          <h3>{title}</h3>
        </div>
        <span className={cn("trend-icon-chip", tone === "positive" ? "is-positive" : "is-negative")}>
          <Icon size={18} />
        </span>
      </div>

      {products.length ? (
        <div className="trend-product-list">
          {products.map((product) => (
            <div className="trend-product-item" key={`${product.code}-${product.direction}`}>
              <div className="trend-product-main">
                <div>
                  <strong>{product.name}</strong>
                  <span>
                    {product.code} · stock {product.unitsSold}
                  </span>
                </div>
                <span className={cn("trend-delta-chip", tone === "positive" ? "is-positive" : "is-negative")}>
                  {formatDelta(product.deltaPercent)}
                </span>
              </div>
              <div className="trend-bar-track">
                <span
                  className={cn("trend-bar-fill", tone === "positive" ? "is-positive" : "is-negative")}
                  style={{ width: `${Math.max(12, (product.unitsSold / maxUnitsSold) * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="muted">{emptyCopy}</p>
      )}
    </article>
  );
}

export default async function AdminHomePage({ searchParams }: AdminHomePageProps) {
  const params = searchParams ? await searchParams : undefined;
  const selectedPeriod = parsePeriod(params?.period);
  const data = await getAdminDashboardData(selectedPeriod);
  const completionRate = data.trendAnalysis.forecast.completionRate ?? 0;
  const activePeriod = periodOptions.find((item) => item.value === data.selectedPeriod) ?? periodOptions[1];
  const lastSyncDate = data.dataFreshness.lastSyncAt
    ? new Intl.DateTimeFormat("es-PE", {
        timeZone: "America/Lima",
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(data.dataFreshness.lastSyncAt))
    : "Sin sincronizaciones registradas";

  return (
    <div className="stack-lg">
      <section className="panel admin-sync-banner">
        <div className="admin-sync-banner-copy">
          <div>
            <p className="eyebrow">ERP</p>
            <h2>Sincronización rápida</h2>
          </div>
            <p className="panel-copy">
            Trae productos, precios, categorías y stock desde el ERP. El dashboard solo usa datos
            de catálogo sincronizado y bitácora real.
          </p>
        </div>

        <div className="admin-sync-banner-actions">
          <form action={syncProductsFromErpAction}>
            <SubmitButton pendingLabel="Sincronizando...">Sincronizar desde ERP</SubmitButton>
          </form>
          <form action={hideProductsWithoutPhotoAction}>
            <SubmitButton pendingLabel="Ocultando...">Ocultar productos sin foto</SubmitButton>
          </form>
          <Link className="button button-ghost" href="/admin/settings#erp-sync">
            Ver bitácora
          </Link>
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Dashboard operativo</p>
            <h1>Dashboard del catálogo</h1>
          </div>
          <p className="panel-copy">
            Controla visibilidad, stock y estructura del catálogo desde un solo panel, sin ruido
            comercial ni métricas demo.
          </p>
        </div>

        <div className="admin-metrics">
          <Link className="metric-panel metric-panel-link" href="/admin/products">
            <Boxes size={22} />
            <strong>{data.totalProducts}</strong>
            <span>Total de productos</span>
          </Link>
          <Link className="metric-panel metric-panel-link" href="/admin/products?visibility=visible">
            <Layers3 size={22} />
            <strong>{data.visibleProducts}</strong>
            <span>Visibles en catálogo</span>
          </Link>
          <Link className="metric-panel metric-panel-link" href="/admin/products?visibility=hidden">
            <EyeOff size={22} />
            <strong>{data.hiddenProducts}</strong>
            <span>Ocultos</span>
          </Link>
          <Link className="metric-panel metric-panel-link" href="/admin/products?visibility=hidden&stock=low">
            <EyeOff size={22} />
            <strong>{data.dataFreshness.hiddenOutOfStockProducts}</strong>
            <span>Ocultos sin stock ERP</span>
          </Link>
          <Link className="metric-panel metric-panel-link" href="/admin/products?visibility=hidden&photo=missing">
            <ImageOff size={22} />
            <strong>{data.dataFreshness.hiddenWithoutPhotoProducts}</strong>
            <span>Ocultos por no tener foto</span>
          </Link>
          <Link className="metric-panel metric-panel-link" href="/admin/products?stock=low">
            <TriangleAlert size={22} />
            <strong>{data.lowStockProducts}</strong>
            <span>Con stock bajo</span>
          </Link>
          <Link className="metric-panel metric-panel-link" href="/admin/products?stock=low">
            <TriangleAlert size={22} />
            <strong>{data.dataFreshness.visibleOutOfStockProducts}</strong>
            <span>Alerta: visibles sin stock</span>
          </Link>
          <Link className="metric-panel metric-panel-link" href="/admin/categories">
            <FolderTree size={22} />
            <strong>{data.totalCategories}</strong>
            <span>Categorías activas</span>
          </Link>
          <Link className="metric-panel metric-panel-link" href="/admin/settings#erp-sync">
            <DatabaseZap size={22} />
            <strong>{data.dataFreshness.syncedProducts}</strong>
            <span>Sincronizados ERP</span>
          </Link>
        </div>
      </section>

      <section className="panel trend-dashboard-panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">10. Análisis de tendencias</p>
            <h2>Sincronización ERP y movimiento del catálogo</h2>
          </div>
          <p className="panel-copy">
            Compara ejecuciones reales del ERP por semana, mes o año. Si todavía no hay ventas
            sincronizadas, no mostramos montos ni órdenes inventadas.
          </p>
        </div>

        <div className="trend-periods">
          {periodOptions.map((option) => (
            <Link
              className={cn("trend-period-chip", data.selectedPeriod === option.value && "is-active")}
              href={`/admin?period=${option.queryValue}`}
              key={option.value}
            >
              {option.shortLabel}
            </Link>
          ))}
        </div>

        <div className="trend-overview-grid">
          <article className="trend-hero-card">
            <div className="trend-card-head">
              <div>
                <p className="eyebrow">{data.trendAnalysis.title}</p>
                <h3>Productos traídos desde ERP</h3>
              </div>
              <span className="trend-icon-chip">
                <DatabaseZap size={18} />
              </span>
            </div>

            <div className="trend-hero-value">
              <strong>{formatCompactNumber(data.trendAnalysis.comparisonMetrics[0].currentValue)}</strong>
              <span
                className={cn(
                  "trend-delta-chip",
                  getDeltaTone(data.trendAnalysis.comparisonMetrics[0].deltaPercent),
                )}
              >
                {formatDelta(data.trendAnalysis.comparisonMetrics[0].deltaPercent)}
              </span>
            </div>

            <p className="muted">
              {data.trendAnalysis.previousTitle
                ? `Base de comparación: ${data.trendAnalysis.previousTitle}`
                : "Aún no hay sincronizaciones exitosas en el período anterior."}
            </p>

            <div className="trend-progress-card">
              <div className="trend-progress-copy">
                <span>Cobertura ERP del catálogo</span>
                <strong>{completionRate.toFixed(1)}%</strong>
              </div>
              <div className="trend-progress-track">
                <span className="trend-progress-fill" style={{ width: `${Math.min(100, completionRate)}%` }} />
              </div>
            </div>
          </article>

          <article className="trend-forecast-card">
            <div className="trend-card-head">
              <div>
                <p className="eyebrow">ERP</p>
                <h3>Fuente y frescura</h3>
              </div>
              <span className="trend-icon-chip">
                <CalendarClock size={18} />
              </span>
            </div>

            <strong>{data.dataFreshness.sourceLabel}</strong>
            <p className="muted">
              Última sincronización: {lastSyncDate}. Estado:{" "}
              {data.dataFreshness.lastSyncStatus ?? "sin bitácora"}.
            </p>
            <span
              className={cn(
                "trend-delta-chip",
                data.dataFreshness.staleSyncedProducts > 0 ||
                  data.dataFreshness.visibleOutOfStockProducts > 0
                  ? "is-negative"
                  : "is-positive",
              )}
            >
              {data.dataFreshness.staleSyncedProducts} sin refrescar ·{" "}
              {data.dataFreshness.visibleOutOfStockProducts} visibles sin stock
            </span>
          </article>
        </div>

        <div className="trend-comparison-grid">
          {data.trendAnalysis.comparisonMetrics.map((metric) => (
            <article className="trend-compare-card" key={metric.label}>
              <div className="trend-card-head">
                <div>
                  <p className="eyebrow">Comparativa</p>
                  <h3>{metric.label}</h3>
                </div>
                <span
                  className={cn(
                    "trend-icon-chip",
                    getDeltaTone(metric.deltaPercent),
                  )}
                >
                  {(metric.deltaPercent ?? 0) >= 0 ? <ArrowUpRight size={18} /> : <ArrowDownRight size={18} />}
                </span>
              </div>

              <strong>{formatMetricValue(metric, data.currencySymbol)}</strong>
              <div className="trend-compare-meta">
                <span>Previo: {formatPreviousValue(metric, data.currencySymbol)}</span>
                <span
                  className={cn(
                    "trend-delta-chip",
                    getDeltaTone(metric.deltaPercent),
                  )}
                >
                  {formatDelta(metric.deltaPercent)}
                </span>
              </div>
            </article>
          ))}
        </div>

        <div className="trend-lists-grid">
          <ProductTrendList
            emptyCopy="Todavía no hay productos en alza para este período."
            maxUnitsSold={data.trendAnalysis.maxUnitsSold}
            products={data.trendAnalysis.topRisingProducts}
            title="Productos recién actualizados por ERP"
            tone="positive"
          />
          <ProductTrendList
            emptyCopy="Todavía no hay productos en caída para este período."
            maxUnitsSold={data.trendAnalysis.maxUnitsSold}
            products={data.trendAnalysis.topFallingProducts}
            title="Productos con stock crítico"
            tone="negative"
          />
        </div>

        <div className="trend-notes-grid">
          <article className="trend-note-card">
            <span className="trend-icon-chip">
              <PackageSearch size={18} />
            </span>
            <div>
              <strong>Movimiento por {activePeriod.shortLabel.toLowerCase()}</strong>
              <p className="muted">
                Esta vista resume ejecuciones exitosas del ERP y productos tocados en el período.
                No depende de datos sembrados.
              </p>
            </div>
          </article>
          <article className="trend-note-card">
            <span className="trend-icon-chip">
              <Boxes size={18} />
            </span>
            <div>
              <strong>Decisión operativa</strong>
              <p className="muted">
                Revisa productos sin stock o con sincronización atrasada antes de abrir campañas
                o enviar cotizaciones grandes.
              </p>
            </div>
          </article>
        </div>
      </section>
    </div>
  );
}
