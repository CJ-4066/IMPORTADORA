import type { Metadata } from "next";
import { headers } from "next/headers";
import { ServiceFeedbackQr } from "@/components/service-feedback-qr";

export const metadata: Metadata = {
  title: "QR de atención | Importaciones Super",
  robots: {
    index: false,
    follow: false,
  },
};

function usesLocalHttp(host: string) {
  const hostname = host.replace(/^\[|\](:\d+)?$/g, "").split(":")[0] ?? host;
  const parts = hostname.split(".").map(Number);

  if (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "0.0.0.0" ||
    hostname.endsWith(".local")
  ) {
    return true;
  }

  if (parts.length !== 4 || parts.some(Number.isNaN)) {
    return false;
  }

  return (
    parts[0] === 10 ||
    (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
    (parts[0] === 192 && parts[1] === 168)
  );
}

export default async function ServiceFeedbackQrPage() {
  const requestHeaders = await headers();
  const host =
    requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol =
    requestHeaders.get("x-forwarded-proto") ??
    (usesLocalHttp(host) ? "http" : "https");
  const initialUrl = `${protocol}://${host}/califica-atencion`;

  return <ServiceFeedbackQr initialUrl={initialUrl} />;
}
