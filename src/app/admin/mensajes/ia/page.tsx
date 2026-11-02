import { requireAdmin } from "@/lib/auth";
import { RockyAiSettings } from "@/components/admin/messages/RockyAiSettings";
export const dynamic = "force-dynamic";
export default async function RockyAiPage() {
  await requireAdmin();
  return <RockyAiSettings />;
}
