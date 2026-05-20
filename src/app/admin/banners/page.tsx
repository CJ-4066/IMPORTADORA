import { HeroBannerCmsManager } from "@/components/admin/hero-banner-cms-manager";
import { getHeroBannersForAdmin, getHeroBannerEditorState } from "@/app/admin/banners/actions";

type HeroBannersPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export const dynamic = "force-dynamic";

export default async function HeroBannersPage({ searchParams }: HeroBannersPageProps) {
  const params = searchParams ? await searchParams : undefined;
  const selectedBannerId = typeof params?.banner === "string" ? params.banner : "";
  const status = typeof params?.status === "string" ? params.status : "";
  const error = typeof params?.error === "string" ? params.error : "";
  const [banners, initialState] = await Promise.all([
    getHeroBannersForAdmin(),
    getHeroBannerEditorState(selectedBannerId || undefined),
  ]);
  const editorSignature = [
    selectedBannerId || "new",
    banners.map((item) => `${item.id}:${item.sortOrder}:${item.updatedAt}`).join("|"),
    initialState.values.bannerId,
    initialState.values.title,
    initialState.values.sortOrder,
    initialState.values.isActive ? "1" : "0",
  ].join("::");

  return (
    <section className="stack-lg">
      {status ? <p className="success-text">Banner actualizado correctamente.</p> : null}
      {error ? <p className="error-text auth-error">{error}</p> : null}

      <HeroBannerCmsManager
        key={editorSignature}
        banners={banners}
        initialState={initialState}
        selectedBannerId={selectedBannerId}
      />
    </section>
  );
}
