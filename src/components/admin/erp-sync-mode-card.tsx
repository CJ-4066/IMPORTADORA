import { cn } from "@/lib/utils";

type ErpSyncModeCardProps = {
  title: string;
  description: string;
  label: string;
  active?: boolean;
  tone?: "neutral" | "positive" | "warning" | "negative";
};

export function ErpSyncModeCard({
  title,
  description,
  label,
  active = false,
  tone = "neutral",
}: ErpSyncModeCardProps) {
  return (
    <article className={cn("erp-mode-card", active && "is-active", `tone-${tone}`)}>
      <div className="erp-mode-card-head">
        <span className="erp-mode-card-label">{label}</span>
        {active ? <span className="erp-mode-card-dot" aria-hidden="true" /> : null}
      </div>
      <strong>{title}</strong>
      <p>{description}</p>
    </article>
  );
}
