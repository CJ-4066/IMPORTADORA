# Super Bot

Panel: `/admin/mensajes/ia`. El proveedor de OpenAI está implementado, pero la clave se configura exclusivamente en el entorno privado del servidor como `OPENAI_API_KEY`. Nunca se introduce en el navegador ni se guarda en la base de datos. Sin clave no se hacen solicitudes de inferencia.

## Operación

- **Apagado:** no genera respuestas.
- **Copiloto:** propone un borrador; un administrador puede editarlo, aprobarlo o descartarlo.
- **Híbrido:** responde automáticamente saludos, información comercial autorizada (excepto pagos/devoluciones) y cotizaciones de una unidad. Lo demás requiere revisión.
- **Automático:** también cotiza varias unidades y alternativas verificadas. Reclamos, negociación, pagos realizados, archivos y solicitudes de asesor se derivan a una persona.

El módulo se instala desactivado y los canales comienzan en Apagado. Activar y seleccionar los modos es una decisión operativa desde el panel. Las conversaciones existentes se configuran individualmente desde su bandeja; los valores predeterminados solo incorporan conversaciones creadas después de guardar la configuración.

Al aplicar un modo se pausa el bot anterior y se comprueba el control del canal. En Messenger también se requiere que el servicio de control entregue la conversación a la tienda, sin retorno automático pendiente a Meta. Los permisos y aprobaciones de WhatsApp, Telegram, Meta y TikTok siguen siendo requisitos de sus respectivas cuentas; este módulo no los concede ni confirma el estado de revisión de una aplicación.

Los adaptadores utilizan las conexiones existentes a YCloud, Telegram y ChatbotX. Instagram tiene su propia bandeja y selección de inbox. No se habilitan los antiguos workers de Super Bot.

## Respuestas y límites

OpenAI clasifica la consulta mediante Responses y una herramienta de consulta de catálogo de solo lectura. El servidor compone precios, cantidades, importes y stock; el modelo no puede escribir en inventario ni confirmar pedidos/pagos. Se reutiliza la información comercial ya aprobada en Super Bot. Las políticas vacías requieren asesor.

El contexto se limita a 12 mensajes, se ocultan correos y números largos y se usa `store:false`. El contenido sigue saliendo al proveedor cuando se conecta la clave. El panel contabiliza solicitudes y tokens; no presenta una estimación monetaria como facturación real. Las cuotas se reservan antes de cada solicitud y se calculan por día de Lima.

Cada borrador vence a los cinco minutos. Antes del envío se revisan de nuevo catálogo, conversación, control, configuración y ventana de atención. Los cambios invalidan borradores pendientes. Un envío ya iniciado puede completarse después de una parada; una entrega incierta no se reintenta automáticamente.

La cola persiste en PostgreSQL. El worker usa bloqueos para evitar envíos duplicados y recupera envíos interrumpidos como inciertos. Los disparadores de base de datos invalidan borradores ante mensajes nuevos y respetan la parada global del bot. La intervención humana pausa la automatización.

## Instalación y arranque

1. Respaldar la base de datos y la versión actual.
2. Aplicar `prisma/migrations/20261020000100_rocky_ai_modes/migration.sql` mediante `prisma migrate deploy`.
3. Generar Prisma y compilar la aplicación.
4. `npm start` inicia el sitio y `messages:ai` bajo el supervisor existente. No ejecutar otra copia sin necesidad; el bloqueo de PostgreSQL protege ejecuciones concurrentes.
5. Verificar que el panel indica conexión pendiente y que el procesador registra señal.
6. Cuando se decida conectar OpenAI, agregar `OPENAI_API_KEY` al entorno privado, reiniciar el servicio y seleccionar la activación/modos en el panel.

La migración es aditiva. Para volver al código anterior, detener el servicio, restaurar los archivos modificados, el cliente Prisma y la compilación respaldados y reiniciar. Conservar las tablas nuevas y los mensajes posteriores; no restaurar un respaldo completo de la base de datos sobre conversaciones más recientes.

## Verificación

`npm run test:rocky-ai` verifica reglas y el contrato del proveedor con transporte simulado. Las pruebas no llaman a OpenAI ni a los canales.

Las pruebas de integración en `src/lib/rocky-ai/service.integration.ts` requieren una base **desechable** llamada `rocky_ai_test` en `127.0.0.1`, con migraciones y disparadores instalados. Establecer `DATABASE_URL` y `ROCKY_AI_TEST_DATABASE_URL` al mismo valor y ejecutar:

```sh
node --import tsx --test src/lib/rocky-ai/service.integration.ts
```

Estas pruebas eliminan sus datos de prueba. Cubren aprobaciones concurrentes, mensajes nuevos durante inferencia, control humano, parada global, recuperación de procesos, cambios de precio, límites de uso y entregas inciertas. La clave real y la calidad de respuestas del modelo solo pueden verificarse después de conectar OpenAI.
