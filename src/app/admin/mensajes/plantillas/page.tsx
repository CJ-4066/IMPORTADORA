import { prisma } from "@/lib/prisma";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Plus, Edit2, Trash2 } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function PlantillasPage() {
  const templates = await prisma.messageTemplate.findMany({
    orderBy: { name: 'asc' },
  });

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Plantillas de Respuesta</h1>
          <p className="text-gray-500">Respuestas rápidas para enviar por el centro de mensajes.</p>
        </div>
        <button className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 flex items-center gap-2 text-sm font-medium">
          <Plus size={16} /> Nueva Plantilla
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {templates.map((tpl) => (
          <div key={tpl.id} className="bg-white rounded-lg border shadow-sm flex flex-col">
            <div className="p-4 border-b flex justify-between items-start">
              <div>
                <h3 className="font-semibold text-gray-900">{tpl.name}</h3>
                {tpl.category && (
                  <span className="inline-block mt-1 px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">
                    {tpl.category}
                  </span>
                )}
              </div>
              <div className="flex gap-2 text-gray-400">
                <button className="hover:text-blue-600"><Edit2 size={16} /></button>
                <button className="hover:text-red-600"><Trash2 size={16} /></button>
              </div>
            </div>
            <div className="p-4 flex-1">
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{tpl.content}</p>
            </div>
            <div className="p-4 bg-gray-50 text-xs text-gray-500 border-t rounded-b-lg flex justify-between">
              <span>{tpl.isActive ? "🟢 Activa" : "⚪ Inactiva"}</span>
              <span>Actualizada: {format(tpl.updatedAt, "dd MMM", { locale: es })}</span>
            </div>
          </div>
        ))}
        
        {templates.length === 0 && (
          <div className="col-span-full bg-white border border-dashed rounded-lg p-12 text-center text-gray-500">
            <p>No tienes plantillas creadas.</p>
            <p className="text-sm mt-1">Haz clic en "Nueva Plantilla" para comenzar.</p>
          </div>
        )}
      </div>
    </div>
  );
}
