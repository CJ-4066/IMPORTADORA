import assert from "node:assert/strict";
import test from "node:test";
import { buildPublicUrl, getPublicSiteUrl } from "@/lib/site-url";

const ORIGINAL_ENV = {
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  VERCEL_PROJECT_PRODUCTION_URL: process.env.VERCEL_PROJECT_PRODUCTION_URL,
};

function resetSiteUrlEnv() {
  process.env.NEXT_PUBLIC_SITE_URL = ORIGINAL_ENV.NEXT_PUBLIC_SITE_URL;
  process.env.NEXT_PUBLIC_APP_URL = ORIGINAL_ENV.NEXT_PUBLIC_APP_URL;
  process.env.VERCEL_PROJECT_PRODUCTION_URL = ORIGINAL_ENV.VERCEL_PROJECT_PRODUCTION_URL;
}

function clearSiteUrlEnv() {
  delete process.env.NEXT_PUBLIC_SITE_URL;
  delete process.env.NEXT_PUBLIC_APP_URL;
  delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
}

test.after(resetSiteUrlEnv);

test("usa el dominio público real por defecto", () => {
  clearSiteUrlEnv();

  assert.equal(getPublicSiteUrl(), "https://tiendavirtualsuper.com");
});

test("normaliza NEXT_PUBLIC_SITE_URL y lo prioriza", () => {
  clearSiteUrlEnv();
  process.env.NEXT_PUBLIC_SITE_URL = "https://tiendavirtualsuper.com/catalogo?x=1";
  process.env.NEXT_PUBLIC_APP_URL = "https://legacy.example.com";

  assert.equal(getPublicSiteUrl(), "https://tiendavirtualsuper.com");
});

test("acepta VERCEL_PROJECT_PRODUCTION_URL sin protocolo", () => {
  clearSiteUrlEnv();
  process.env.VERCEL_PROJECT_PRODUCTION_URL = "tiendavirtualsuper.com";

  assert.equal(buildPublicUrl("/producto/demo"), "https://tiendavirtualsuper.com/producto/demo");
});
