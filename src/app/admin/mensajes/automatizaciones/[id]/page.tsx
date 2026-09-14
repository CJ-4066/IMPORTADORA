import { AutomationEditor } from "@/components/admin/messages/automations/AutomationEditor";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Flow Builder | Admin",
};

export default async function AutomationBuilderPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  return <AutomationEditor automationId={resolvedParams.id} />;
}
