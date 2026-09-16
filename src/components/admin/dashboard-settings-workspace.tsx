"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowLeft, ArrowUp, Check, Eye, EyeOff, LayoutGrid, RotateCcw, Save, Search, Settings2 } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  DASHBOARD_PREFERENCES_KEY,
  DASHBOARD_WIDGET_META,
  DEFAULT_DASHBOARD_PREFERENCES,
  LEGACY_DASHBOARD_PREFERENCES_KEY,
  parseDashboardPreferences,
  type DashboardPreferences,
  type DashboardWidgetId,
} from "@/lib/dashboard-preferences";

export function DashboardSettingsWorkspace() {
  const router = useRouter();
  const [preferences, setPreferences] = useState<DashboardPreferences>(DEFAULT_DASHBOARD_PREFERENCES);
  const [initial, setInitial] = useState("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Todos");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const loaded = parseDashboardPreferences(
      localStorage.getItem(DASHBOARD_PREFERENCES_KEY),
      localStorage.getItem(LEGACY_DASHBOARD_PREFERENCES_KEY),
    );
    queueMicrotask(() => {
      setPreferences(loaded);
      setInitial(JSON.stringify(loaded));
    });
  }, []);

  const dirty = initial !== "" && JSON.stringify(preferences) !== initial;
  const visibleCount = preferences.widgets.filter((widget) => widget.enabled).length;
  const filteredWidgets = useMemo(() => preferences.widgets.filter((widget) => {
    const meta = DASHBOARD_WIDGET_META[widget.id];
    return (category === "Todos" || meta.category === category)
      && `${meta.title} ${meta.subtitle}`.toLowerCase().includes(query.toLowerCase());
  }), [preferences.widgets, category, query]);

  const updateWidget = (id: DashboardWidgetId, enabled: boolean) => {
    setSaved(false);
    setPreferences((current) => ({
      ...current,
      widgets: current.widgets.map((widget) => widget.id === id ? { ...widget, enabled } : widget),
    }));
  };

  const moveWidget = (id: DashboardWidgetId, direction: -1 | 1) => {
    setSaved(false);
    setPreferences((current) => {
      const widgets = [...current.widgets];
      const index = widgets.findIndex((widget) => widget.id === id);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= widgets.length) return current;
      [widgets[index], widgets[target]] = [widgets[target], widgets[index]];
      return { ...current, widgets: widgets.map((widget, order) => ({ ...widget, order })) };
    });
  };

  const save = () => {
    const normalized = { ...preferences, widgets: preferences.widgets.map((widget, order) => ({ ...widget, order })) };
    localStorage.setItem(DASHBOARD_PREFERENCES_KEY, JSON.stringify(normalized));
    localStorage.removeItem(LEGACY_DASHBOARD_PREFERENCES_KEY);
    setPreferences(normalized);
    setInitial(JSON.stringify(normalized));
    setSaved(true);
  };

  const restore = () => {
    const defaults = { ...DEFAULT_DASHBOARD_PREFERENCES, widgets: DEFAULT_DASHBOARD_PREFERENCES.widgets.map((widget) => ({ ...widget })) };
    setPreferences(defaults);
    setSaved(false);
  };

  return (
    <div className="dashboard-settings-workspace">
      <header className="dashboard-settings-header">
        <button className="dashboard-back-link" onClick={() => router.push("/admin")} type="button"><ArrowLeft size={17} /> Dashboard</button>
        <div className="dashboard-settings-title">
          <span className="dashboard-settings-mark"><Settings2 size={22} /></span>
          <div><p className="eyebrow">Espacio de trabajo</p><h1>Configura tu dashboard</h1><p>Decide qué información ves, en qué orden y con qué densidad.</p></div>
        </div>
        <div className="dashboard-settings-actions">
          <button className="button button-ghost" onClick={restore} type="button"><RotateCcw size={16} /> Restaurar</button>
          <button className="button button-primary" disabled={!dirty} onClick={save} type="button"><Save size={16} /> Guardar cambios</button>
        </div>
      </header>

      {saved ? <div className="dashboard-save-banner" role="status"><Check size={17} /> Configuración guardada. <button onClick={() => router.push("/admin")} type="button">Ver dashboard</button></div> : null}

      <div className="dashboard-settings-layout">
        <aside className="dashboard-settings-sidebar">
          <div className="dashboard-settings-summary"><strong>{visibleCount}</strong><span>de {preferences.widgets.length} módulos visibles</span><div><i style={{ width: `${(visibleCount / preferences.widgets.length) * 100}%` }} /></div></div>
          <section>
            <p className="dashboard-settings-label">Distribución</p>
            <div className="dashboard-choice-grid">
              {(["auto", "two", "three"] as const).map((columns) => <button className={preferences.columns === columns ? "is-active" : ""} key={columns} onClick={() => setPreferences((current) => ({ ...current, columns }))} type="button"><LayoutGrid size={17} /><span>{columns === "auto" ? "Automática" : columns === "two" ? "2 columnas" : "3 columnas"}</span></button>)}
            </div>
          </section>
          <section>
            <p className="dashboard-settings-label">Densidad</p>
            <div className="dashboard-segmented">
              {(["comfortable", "compact"] as const).map((density) => <button className={preferences.density === density ? "is-active" : ""} key={density} onClick={() => setPreferences((current) => ({ ...current, density }))} type="button">{density === "comfortable" ? "Cómoda" : "Compacta"}</button>)}
            </div>
          </section>
          <div className="dashboard-settings-note"><Eye size={18} /><p><strong>Vista personal</strong><br />La configuración se guarda en este navegador y no altera la información del negocio.</p></div>
        </aside>

        <main className="dashboard-widget-editor">
          <div className="dashboard-widget-toolbar">
            <div><p className="eyebrow">Módulos</p><h2>Contenido y orden</h2></div>
            <label className="dashboard-widget-search"><Search size={16} /><input aria-label="Buscar módulo" onChange={(event) => setQuery(event.target.value)} placeholder="Buscar módulo…" value={query} /></label>
          </div>
          <div className="dashboard-category-tabs" role="tablist">
            {["Todos", "Tienda", "Promotores", "E-Commerce"].map((item) => <button aria-selected={category === item} className={category === item ? "is-active" : ""} key={item} onClick={() => setCategory(item)} role="tab" type="button">{item}</button>)}
          </div>
          <div className="dashboard-widget-list">
            {filteredWidgets.map((widget) => {
              const meta = DASHBOARD_WIDGET_META[widget.id];
              const actualIndex = preferences.widgets.findIndex((item) => item.id === widget.id);
              return <article className={widget.enabled ? "dashboard-widget-row" : "dashboard-widget-row is-disabled"} key={widget.id}>
                <span className="dashboard-widget-position">{String(actualIndex + 1).padStart(2, "0")}</span>
                <span className="dashboard-widget-icon">{meta.icon}</span>
                <div className="dashboard-widget-copy"><strong>{meta.title}</strong><span>{meta.subtitle}</span><small>{meta.category}{meta.fullWidth ? " · ancho completo" : ""}</small></div>
                <div className="dashboard-widget-order">
                  <button aria-label={`Subir ${meta.title}`} disabled={actualIndex === 0} onClick={() => moveWidget(widget.id, -1)} type="button"><ArrowUp size={16} /></button>
                  <button aria-label={`Bajar ${meta.title}`} disabled={actualIndex === preferences.widgets.length - 1} onClick={() => moveWidget(widget.id, 1)} type="button"><ArrowDown size={16} /></button>
                </div>
                <button aria-label={`${widget.enabled ? "Ocultar" : "Mostrar"} ${meta.title}`} aria-pressed={widget.enabled} className="dashboard-visibility-toggle" onClick={() => updateWidget(widget.id, !widget.enabled)} type="button">{widget.enabled ? <Eye size={17} /> : <EyeOff size={17} />}<span>{widget.enabled ? "Visible" : "Oculto"}</span></button>
              </article>;
            })}
            {filteredWidgets.length === 0 ? <div className="dashboard-widget-empty">No encontramos módulos con ese criterio.</div> : null}
          </div>
        </main>
      </div>

      <footer className="dashboard-settings-mobile-actions"><button className="button button-primary" disabled={!dirty} onClick={save} type="button"><Save size={16} /> Guardar cambios</button></footer>
    </div>
  );
}
