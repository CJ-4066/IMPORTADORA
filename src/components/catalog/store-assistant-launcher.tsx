"use client";

import dynamic from "next/dynamic";
import { startTransition, useState } from "react";
import { Bot } from "lucide-react";
import type { StoreAssistantPanelProps } from "@/components/catalog/store-assistant";

const StoreAssistantPanel = dynamic<StoreAssistantPanelProps>(
  () =>
    import("@/components/catalog/store-assistant").then(
      (module) => module.StoreAssistantPanel,
    ),
  {
    ssr: false,
  },
);

type StoreAssistantLauncherProps = {
  businessName: string;
};

export function StoreAssistantLauncher({ businessName }: StoreAssistantLauncherProps) {
  const [open, setOpen] = useState(false);
  const [shouldLoadPanel, setShouldLoadPanel] = useState(false);

  const preloadPanel = () => {
    setShouldLoadPanel(true);
  };

  const openAssistant = () => {
    preloadPanel();
    startTransition(() => setOpen(true));
  };

  return (
    <>
      <button
        aria-label="Abrir asistente virtual"
        className="store-side-action store-side-action-assistant"
        onClick={openAssistant}
        onFocus={preloadPanel}
        onMouseEnter={preloadPanel}
        onTouchStart={preloadPanel}
        type="button"
      >
        <Bot size={20} />
        <span>Asistente</span>
      </button>

      {shouldLoadPanel ? (
        <StoreAssistantPanel
          businessName={businessName}
          onClose={() => setOpen(false)}
          open={open}
        />
      ) : null}
    </>
  );
}
