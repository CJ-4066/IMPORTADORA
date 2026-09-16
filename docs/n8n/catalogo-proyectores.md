# Catálogo automático de proyectores

El flujo `Catálogo automático de proyectores` recibe el mensaje ya persistido por
los workflows de entrada de WhatsApp y ManyChat. Cuando el texto contiene las
palabras `catálogo` y `proyector`:

1. Solicita a la aplicación el PDF mediante
   `POST /api/internal/catalogs/projectors`.
2. La aplicación verifica que la conversación continúe en modo automático, que
   no esté asignada a un agente y que el contacto sea real.
3. La aplicación genera o reutiliza un PDF inmutable con las imágenes de todos
   los proyectores visibles.
4. n8n entrega al contacto un mensaje de WhatsApp con el enlace público al PDF.
5. Solo después de una respuesta exitosa del workflow outbound, n8n registra el
   mensaje como enviado en el Centro de Mensajes.

El enlace se envía como texto porque la operación dinámica `sendContent` de
ManyChat para WhatsApp no admite archivos. El mensaje se registra internamente
como `DOCUMENT` con su `mediaUrl`, de modo que el Centro de Mensajes conserva la
representación correcta del catálogo.

Los contactos del simulador se omiten de la entrega real y nunca se utilizan
para probar envíos a ManyChat.
