"use client";

import dynamic from "next/dynamic";
import { startTransition, useEffect, useState } from "react";
import { Bot } from "lucide-react";
import type { StoreAssistantPanelProps } from "@/components/catalog/store-assistant";
import {
  STORE_ASSISTANT_OPEN_EVENT,
  type StoreAssistantOpenDetail,
} from "@/components/catalog/assistant-events";

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
  const [pendingRequest, setPendingRequest] = useState<StoreAssistantOpenDetail | null>(null);

  const preloadPanel = () => {
    setShouldLoadPanel(true);
  };

  const openAssistant = () => {
    preloadPanel();
    startTransition(() => setOpen(true));
  };

  useEffect(() => {
    const handleOpen = (event: Event) => {
      const detail = (event as CustomEvent<StoreAssistantOpenDetail>).detail;
      if (!detail?.prompt) {
        return;
      }

      preloadPanel();
      setPendingRequest(detail);
      startTransition(() => setOpen(true));
    };

    window.addEventListener(STORE_ASSISTANT_OPEN_EVENT, handleOpen);
    return () => window.removeEventListener(STORE_ASSISTANT_OPEN_EVENT, handleOpen);
  }, []);

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
          initialCategorySlug={pendingRequest?.contextCategorySlug ?? null}
          initialPrompt={pendingRequest?.prompt ?? null}
          initialProductCode={pendingRequest?.productContextCode ?? null}
          onInitialPromptHandled={() => setPendingRequest(null)}
          onClose={() => setOpen(false)}
          open={open}
        />
      ) : null}
    </>
  );
}
