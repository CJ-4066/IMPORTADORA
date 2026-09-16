export type DashboardWidgetId =
  | "coupon_bar"
  | "payment_donut"
  | "influencer_donut"
  | "discount_donut"
  | "promo_table"
  | "qr_scans"
  | "quotes_total"
  | "top_scanned"
  | "top_quoted"
  | "advanced_funnel"
  | "advanced_category"
  | "advanced_quotes_orders"
  | "advanced_promoters"
  | "advanced_heatmap";

export type DashboardWidgetConfig = {
  id: DashboardWidgetId;
  enabled: boolean;
  order: number;
};

export type DashboardPreferences = {
  version: 2;
  widgets: DashboardWidgetConfig[];
  density: "comfortable" | "compact";
  columns: "auto" | "two" | "three";
};

export const DASHBOARD_PREFERENCES_KEY = "dashboard_preferences_v2";
export const LEGACY_DASHBOARD_PREFERENCES_KEY = "dashboard_prefs";

export const DEFAULT_DASHBOARD_WIDGETS: DashboardWidgetConfig[] = [
  { id: "qr_scans", enabled: true, order: 0 },
  { id: "quotes_total", enabled: true, order: 1 },
  { id: "top_scanned", enabled: true, order: 2 },
  { id: "top_quoted", enabled: true, order: 3 },
  { id: "coupon_bar", enabled: true, order: 4 },
  { id: "payment_donut", enabled: true, order: 5 },
  { id: "influencer_donut", enabled: true, order: 6 },
  { id: "discount_donut", enabled: true, order: 7 },
  { id: "promo_table", enabled: true, order: 8 },
  { id: "advanced_funnel", enabled: true, order: 9 },
  { id: "advanced_category", enabled: true, order: 10 },
  { id: "advanced_quotes_orders", enabled: true, order: 11 },
  { id: "advanced_promoters", enabled: true, order: 12 },
  { id: "advanced_heatmap", enabled: true, order: 13 },
];

export const DASHBOARD_WIDGET_META: Record<DashboardWidgetId, { title: string; subtitle: string; icon: string; fullWidth: boolean; category: string }> = {
  qr_scans: { title: "Escaneos QR", subtitle: "Interacciones con fichas", icon: "📱", fullWidth: false, category: "Tienda" },
  quotes_total: { title: "Total valorizado", subtitle: "Cotizaciones generadas", icon: "🛒", fullWidth: false, category: "Tienda" },
  top_scanned: { title: "Fichas más escaneadas", subtitle: "Productos con mayor interés", icon: "📑", fullWidth: false, category: "Tienda" },
  top_quoted: { title: "Productos más solicitados", subtitle: "Demanda en cotizaciones", icon: "📦", fullWidth: false, category: "Tienda" },
  coupon_bar: { title: "Usos vs. comisiones", subtitle: "Comparativa por cupón", icon: "📊", fullWidth: true, category: "Promotores" },
  payment_donut: { title: "Métodos de pago", subtitle: "Distribución de ventas", icon: "💳", fullWidth: false, category: "Promotores" },
  influencer_donut: { title: "Ventas por influencer", subtitle: "Aporte de promotores", icon: "👥", fullWidth: false, category: "Promotores" },
  discount_donut: { title: "Descuentos vs. ingreso", subtitle: "Análisis financiero", icon: "💰", fullWidth: false, category: "Promotores" },
  promo_table: { title: "Rendimiento de cupones", subtitle: "Detalle de promotores", icon: "📋", fullWidth: true, category: "Promotores" },
  advanced_funnel: { title: "Embudo de conversión", subtitle: "Tráfico y compras", icon: "🔻", fullWidth: false, category: "E-Commerce" },
  advanced_category: { title: "Ventas por categoría", subtitle: "Rentabilidad por línea", icon: "🗂️", fullWidth: false, category: "E-Commerce" },
  advanced_quotes_orders: { title: "Cotizaciones vs. órdenes", subtitle: "Evolución y cierre", icon: "📈", fullWidth: true, category: "E-Commerce" },
  advanced_promoters: { title: "Top promotores", subtitle: "Ranking de ventas", icon: "🏆", fullWidth: false, category: "Promotores" },
  advanced_heatmap: { title: "Horas pico", subtitle: "Actividad de compra", icon: "🔥", fullWidth: false, category: "E-Commerce" },
};

export const DEFAULT_DASHBOARD_PREFERENCES: DashboardPreferences = {
  version: 2,
  widgets: DEFAULT_DASHBOARD_WIDGETS,
  density: "comfortable",
  columns: "auto",
};

function normalizeWidgets(value: unknown): DashboardWidgetConfig[] {
  const saved = Array.isArray(value) ? value : [];
  return DEFAULT_DASHBOARD_WIDGETS.map((widget) => {
    const match = saved.find((candidate) => candidate && typeof candidate === "object" && "id" in candidate && candidate.id === widget.id) as Partial<DashboardWidgetConfig> | undefined;
    return { ...widget, enabled: typeof match?.enabled === "boolean" ? match.enabled : widget.enabled, order: typeof match?.order === "number" ? match.order : widget.order };
  }).sort((a, b) => a.order - b.order).map((widget, order) => ({ ...widget, order }));
}
export function parseDashboardPreferences(raw: string | null, legacyRaw?: string | null): DashboardPreferences {
  try {
    const parsed = raw ? JSON.parse(raw) : null;
    if (parsed && typeof parsed === "object") {
      return {
        version: 2,
        widgets: normalizeWidgets(parsed.widgets),
        density: parsed.density === "compact" ? "compact" : "comfortable",
        columns: parsed.columns === "two" || parsed.columns === "three" ? parsed.columns : "auto",
      };
    }
    const legacy = legacyRaw ? JSON.parse(legacyRaw) : null;
    if (Array.isArray(legacy)) return { ...DEFAULT_DASHBOARD_PREFERENCES, widgets: normalizeWidgets(legacy) };
  } catch {
    // A damaged browser preference should never prevent the dashboard from loading.
  }
  return { ...DEFAULT_DASHBOARD_PREFERENCES, widgets: DEFAULT_DASHBOARD_WIDGETS.map((widget) => ({ ...widget })) };
}
