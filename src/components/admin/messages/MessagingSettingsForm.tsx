"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle, CheckCircle2, Loader2, Save, Webhook } from "lucide-react";
import {
  saveSettingsAction,
  type MessagingSettingsActionState,
} from "@/app/admin/mensajes/configuracion/actions";

const initialState: MessagingSettingsActionState = { status: "idle", message: "" };

function SaveButton() {
  const { pending } = useFormStatus();

  return (
    <button className="btn btn-primary messaging-settings-save" type="submit" disabled={pending}>
      {pending ? <Loader2 className="spin" size={16} /> : <Save size={16} />}
      {pending ? "Guardando…" : "Guardar webhook"}
    </button>
  );
}

export function MessagingSettingsForm({ webhookUrl }: { webhookUrl: string }) {
  const [state, formAction] = useActionState(saveSettingsAction, initialState);

  return (
    <form action={formAction} className="messaging-settings-card">
      <div className="messaging-settings-card-heading">
        <span className="messaging-settings-card-icon" aria-hidden="true"><Webhook size={19} /></span>
        <div>
          <h2>Entrega a n8n</h2>
          <p>Envía cada mensaje entrante a tu flujo de automatización.</p>
        </div>
      </div>

      <div className="messaging-settings-field">
        <label htmlFor="n8nWebhookUrl">URL del webhook</label>
        <input
          id="n8nWebhookUrl"
          name="n8nWebhookUrl"
          type="url"
          inputMode="url"
          defaultValue={webhookUrl}
          placeholder="https://n8n.tudominio.com/webhook/mensajes"
          aria-describedby="n8n-webhook-help n8n-webhook-result"
        />
        <p id="n8n-webhook-help">Déjalo vacío si deseas desconectar n8n. Por seguridad, solo se aceptan direcciones HTTPS.</p>
      </div>

      <div className="messaging-settings-card-footer">
        <div id="n8n-webhook-result" className={`messaging-settings-result is-${state.status}`} role="status">
          {state.message ? <>{state.status === "error" ? <AlertCircle size={15} /> : <CheckCircle2 size={15} />} {state.message}</> : "Los cambios se aplican a los próximos mensajes."}
        </div>
        <SaveButton />
      </div>
    </form>
  );
}
