import { prisma } from "@/lib/prisma";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { CheckCircle2, XCircle, Clock } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ActividadPage() {
  const logs = await prisma.automationExecution.findMany({
    orderBy: { startedAt: 'desc' },
    take: 50,
    include: {
      automation: {
        select: { name: true, triggerType: true }
      }
    }
  });

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Actividad y Logs</h1>
          <p className="text-gray-500">Historial de disparadores y automatizaciones ejecutadas (n8n).</p>
        </div>
      </div>

      <div className="bg-white rounded-lg border shadow-sm p-4">
        {logs.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            No se han registrado ejecuciones recientes.
          </div>
        ) : (
          <div className="space-y-4">
            {logs.map((log) => (
              <div key={log.id} className="flex gap-4 p-4 border rounded-lg hover:bg-gray-50">
                <div className="mt-1">
                  {log.status === "SUCCESS" && <CheckCircle2 className="text-green-500" size={20} />}
                  {log.status === "FAILED" && <XCircle className="text-red-500" size={20} />}
                  {log.status === "RUNNING" && <Clock className="text-yellow-500" size={20} />}
                </div>
                <div className="flex-1">
                  <div className="flex justify-between">
                    <h3 className="font-medium text-gray-900">{log.automation.name}</h3>
                    <span className="text-sm text-gray-500">
                      {format(log.startedAt, "dd MMM, HH:mm:ss", { locale: es })}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mb-2">Trigger: {log.automation.triggerType}</p>
                  
                  {log.error && (
                    <div className="bg-red-50 text-red-700 p-2 text-xs rounded border border-red-100 font-mono">
                      {log.error}
                    </div>
                  )}
                  
                  {log.status === "SUCCESS" && log.providerExecutionId && (
                    <div className="text-xs text-gray-400 mt-1">
                      n8n Execution ID: {log.providerExecutionId}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
