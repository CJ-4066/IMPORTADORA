import { AutomationList } from "@/components/admin/messages/automations/AutomationList";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Automatizaciones | Admin",
  description: "Gestión de flujos conversacionales",
};

export default function AutomatizacionesPage() {
  return <AutomationList />;
}
