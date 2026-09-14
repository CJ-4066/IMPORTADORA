import { prisma } from "@/lib/prisma";
import { Save, Webhook, Bot } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ConfiguracionPage() {
  const settings = await prisma.storeSettings.findFirst() || {
    botMasterSwitch: true,
    n8nWebhookUrl: "",
  };

  return (
    <div className="p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Configuración de Mensajería</h1>
        <p className="text-gray-500">Ajustes globales para el centro de soporte y automatizaciones.</p>
      </div>

      <div className="space-y-6">
        <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
          <div className="p-4 border-b bg-gray-50 flex items-center gap-2">
            <Bot className="text-gray-500" size={20} />
            <h2 className="font-semibold text-gray-800">Control Principal de Bots</h2>
          </div>
          <div className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium text-gray-900">Activar automatizaciones (Master Switch)</h3>
                <p className="text-sm text-gray-500 mt-1">
                  Si apagas este interruptor, ningún flujo de n8n se ejecutará. Útil para modo "Manual Total" o durante emergencias.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" defaultChecked={settings.botMasterSwitch} />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
          <div className="p-4 border-b bg-gray-50 flex items-center gap-2">
            <Webhook className="text-gray-500" size={20} />
            <h2 className="font-semibold text-gray-800">Integración con n8n</h2>
          </div>
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                URL del Webhook de n8n (Production)
              </label>
              <input 
                type="text" 
                className="w-full px-3 py-2 border rounded-md text-sm font-mono bg-gray-50"
                defaultValue={settings.n8nWebhookUrl || ""}
                placeholder="https://n8n.tudominio.com/webhook/..."
              />
              <p className="text-xs text-gray-500 mt-2">
                Esta es la URL base a la que el sistema enviará los payloads entrantes de WhatsApp.
              </p>
            </div>
          </div>
          <div className="px-6 py-4 bg-gray-50 border-t flex justify-end">
            <button className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 flex items-center gap-2 text-sm font-medium">
              <Save size={16} /> Guardar Cambios
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
