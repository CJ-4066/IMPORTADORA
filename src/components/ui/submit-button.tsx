"use client";

import { useFormStatus } from "react-dom";
import { cn } from "@/lib/utils";

type SubmitButtonProps = {
  children: React.ReactNode;
  className?: string;
  pendingLabel?: string;
};

export function SubmitButton({
  children,
  className,
  pendingLabel = "Guardando...",
}: SubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button className={cn("button button-primary", className)} type="submit" disabled={pending}>
      {pending ? pendingLabel : children}
    </button>
  );
}
