import { prisma } from "@/lib/prisma";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import Link from "next/link";
import { Search, MessageCircle } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ContactosPage() {
  const contacts = await prisma.chatContact.findMany({
    orderBy: { updatedAt: 'desc' },
    take: 50,
  });

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Contactos</h1>
          <p className="text-gray-500">Listado de clientes que han interactuado por chat.</p>
        </div>
      </div>

      <div className="bg-white rounded-lg border shadow-sm">
        <div className="p-4 border-b">
          <div className="relative w-72">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
            <input 
              type="text" 
              placeholder="Buscar por nombre o número..." 
              className="w-full pl-9 py-2 border rounded-md text-sm"
            />
          </div>
        </div>
        
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-gray-700 uppercase bg-gray-50">
            <tr>
              <th className="px-6 py-3">Contacto</th>
              <th className="px-6 py-3">Canal</th>
              <th className="px-6 py-3">Última Interacción</th>
              <th className="px-6 py-3">Etiquetas</th>
              <th className="px-6 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {contacts.map(c => (
              <tr key={c.id} className="border-b hover:bg-gray-50">
                <td className="px-6 py-4 font-medium text-gray-900 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                    {c.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div>{c.name}</div>
                    <div className="text-xs text-gray-500">{c.phone || "Sin número"}</div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">
                    {c.channel || "WhatsApp"}
                  </span>
                </td>
                <td className="px-6 py-4 text-gray-500">
                  {format(c.updatedAt, "dd MMM yyyy, HH:mm", { locale: es })}
                </td>
                <td className="px-6 py-4">
                  <div className="flex gap-1 flex-wrap">
                    {c.tags.length === 0 ? <span className="text-gray-400 text-xs">Sin etiquetas</span> : 
                      c.tags.map(t => (
                        <span key={t} className="px-2 py-1 bg-gray-100 rounded text-xs">{t}</span>
                      ))
                    }
                  </div>
                </td>
                <td className="px-6 py-4 text-right">
                  <Link href={`/admin/mensajes`} className="text-blue-600 hover:underline flex justify-end items-center gap-1">
                    <MessageCircle size={16} /> Ver chat
                  </Link>
                </td>
              </tr>
            ))}
            {contacts.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                  Aún no hay contactos registrados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
