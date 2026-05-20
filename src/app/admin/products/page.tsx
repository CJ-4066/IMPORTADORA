import { AdminProductsWorkspace } from "@/components/admin/admin-products-workspace";
import { getAdminProducts } from "@/lib/store";

type AdminProductsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export const dynamic = "force-dynamic";

export default async function AdminProductsPage({ searchParams }: AdminProductsPageProps) {
  const params = searchParams ? await searchParams : undefined;
  const q = typeof params?.q === "string" ? params.q : "";
  const category = typeof params?.category === "string" ? params.category : "all";
  const brand = typeof params?.brand === "string" ? params.brand : "all";
  const visibility =
    typeof params?.visibility === "string" &&
    ["all", "visible", "hidden"].includes(params.visibility)
      ? (params.visibility as "all" | "visible" | "hidden")
      : "all";
  const photo =
    typeof params?.photo === "string" &&
    ["all", "missing", "with-photo"].includes(params.photo)
      ? (params.photo as "all" | "missing" | "with-photo")
      : "all";
  const stock =
    typeof params?.stock === "string" && ["all", "low", "out"].includes(params.stock)
      ? (params.stock as "all" | "low" | "out")
      : "all";
  const featured =
    typeof params?.featured === "string" && ["all", "only"].includes(params.featured)
      ? (params.featured as "all" | "only")
      : "all";
  const sync =
    typeof params?.sync === "string" &&
    ["all", "synced", "unsynced", "stale"].includes(params.sync)
      ? (params.sync as "all" | "synced" | "unsynced" | "stale")
      : "all";
  const issue =
    typeof params?.issue === "string" && ["all", "review"].includes(params.issue)
      ? (params.issue as "all" | "review")
      : "all";
  const page = Number(typeof params?.page === "string" ? params.page : "1");
  const data = await getAdminProducts({
    query: q,
    category,
    brand,
    visibility,
    photo,
    stock,
    featured,
    sync,
    issue,
    page: Number.isNaN(page) ? 1 : page,
  });
  const status = typeof params?.status === "string" ? params.status : "";

  return (
    <AdminProductsWorkspace
      brands={data.brands}
      categories={data.categories}
      filters={{ q, category, brand, visibility, photo, stock, featured, sync, issue }}
      page={data.page}
      pageSize={data.pageSize}
      products={data.products}
      status={status}
      stats={data.stats}
      totalPages={data.totalPages}
      totalResults={data.totalResults}
    />
  );
}
