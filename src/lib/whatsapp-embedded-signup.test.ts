import assert from "node:assert/strict";
import { test } from "node:test";
import { readEmbeddedSignupBrowserEvent } from "./whatsapp-embedded-signup";

test("lee SessionInfo cuando Meta envía postMessage como JSON string", () => {
  const result = readEmbeddedSignupBrowserEvent({
    origin: "https://www.facebook.com",
    data: JSON.stringify({
      type: "WA_EMBEDDED_SIGNUP",
      event: "FINISH",
      data: {
        business_id: "business-1",
        waba_id: "waba-1",
        phone_number_id: "phone-1",
      },
    }),
  });

  assert.equal(result?.kind, "SESSION");
  assert.equal(result?.kind === "SESSION" ? result.sessionInfo.waba_id : null, "waba-1");
});

test("rechaza eventos enviados desde orígenes ajenos a Meta", () => {
  const result = readEmbeddedSignupBrowserEvent({
    origin: "https://example.com",
    data: {
      type: "WA_EMBEDDED_SIGNUP",
      data: { business_id: "business-1", waba_id: "waba-1" },
    },
  });

  assert.equal(result, null);
});

test("detecta cancelación de Embedded Signup", () => {
  const result = readEmbeddedSignupBrowserEvent({
    origin: "https://business.facebook.com",
    data: {
      type: "WA_EMBEDDED_SIGNUP",
      event: "CANCEL",
      data: { current_step: "PHONE_NUMBER" },
    },
  });

  assert.equal(result?.kind, "CANCELLED");
  assert.match(result?.message ?? "", /PHONE_NUMBER/);
});
