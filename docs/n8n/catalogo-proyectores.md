# Catálogo automático de proyectores

El flujo `Catálogo automático de proyectores` recibe el mensaje ya persistido por
los workflows de entrada de WhatsApp y ManyChat. Cuando el texto contiene las
palabras `catálogo` y `proyector`:

1. Solicita a la aplicación el PDF mediante
   `POST /api/internal/catalogs/projectors`.
2. La aplicación verifica que la conversación continúe en modo automático, que
   no esté asignada a un agente y que el contacto sea real.
3. La aplicación genera o reutiliza un PDF inmutable con una imagen grande por
   página, el nombre y el código de cada proyector visible. Recorta márgenes
   blancos o transparentes y conserva las proporciones sin añadir cuadrados.
4. n8n entrega al contacto un documento PDF nativo de WhatsApp mediante la
   credencial existente de Cloud API y el mismo número de WhatsApp de la tienda.
5. Solo después de una respuesta exitosa del workflow outbound, n8n registra el
   mensaje como enviado en el Centro de Mensajes.

La URL pública se utiliza solo como origen del archivo para Meta. El cliente
recibe una tarjeta de documento descargable llamada `Catalogo-de-proyectores.pdf`,
no un enlace de texto. ManyChat continúa gestionando las entradas y los mensajes
de texto; `sendContent` no permite documentos de WhatsApp.

Se conserva el control de idempotencia del outbound y solo se registra `sent`
si Meta devuelve un identificador `wamid.*`. Un error o respuesta sin ID sigue
la salida de fallo; nunca se sustituye el documento por un enlace silenciosamente.
El proveedor del registro es `meta-cloud` y el tipo es `DOCUMENT`.

Si el proveedor rechaza el archivo, se registra `failed` con una razón segura y
el mismo `requestId`, visible en el Centro de Mensajes. La prueba del 16/09/2026
detectó el error Meta `#200`: la credencial existente puede consultar el emisor,
pero no tiene permiso de envío sobre la cuenta WhatsApp Business. La entrega
nativa requiere corregir esa autorización o configurar un flujo de documento
en ManyChat; no está verificada como operativa mientras persista ese rechazo.

`scripts/n8n/enable-catalog-documents.mjs` prepara este ajuste sobre exportaciones
respaldadas de los dos workflows; reutiliza el emisor y las referencias a las
credenciales existentes y no contiene secretos. No ejecutarlo sobre workflows
que ya tengan la rama de documentos.

Los contactos del simulador se omiten de la entrega real y nunca se utilizan
para probar envíos a ManyChat.
