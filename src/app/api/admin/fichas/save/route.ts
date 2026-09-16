import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { revalidatePath } from "next/cache";

type SpecificationInput = { name: string; value: string; sortOrder?: number };
type VariantInput = {
  name: string;
  hexColor?: string | null;
  imageUrl?: string | null;
  sku?: string | null;
  isAvailable?: boolean;
  sortOrder?: number;
};
type VideoInput = {
  title: string;
  url: string;
  provider: string;
  videoId: string;
  thumbnailUrl?: string | null;
  sortOrder?: number;
};
type DocumentInput = { title: string; url: string; type: string; sortOrder?: number };

export async function POST(request: Request) {
  try {
    await requireAdmin();
    const formData = await request.formData();
    const productId = String(formData.get("productId") ?? "");

    if (!productId) {
      return NextResponse.json({ error: "No se especificó el producto" }, { status: 400 });
    }

    const descriptionShort = String(formData.get("descriptionShort") ?? "").trim();
    const descriptionFull = String(formData.get("descriptionFull") ?? "").trim();
    const status = String(formData.get("status") ?? "BORRADOR").trim();

    const specsStr = String(formData.get("specifications") ?? "[]");
    const variantsStr = String(formData.get("variants") ?? "[]");
    const videosStr = String(formData.get("videos") ?? "[]");
    const docsStr = String(formData.get("documents") ?? "[]");

    const specs = JSON.parse(specsStr) as SpecificationInput[];
    const variants = JSON.parse(variantsStr) as VariantInput[];
    const videos = JSON.parse(videosStr) as VideoInput[];
    const docs = JSON.parse(docsStr) as DocumentInput[];

    const result = await prisma.$transaction(async (tx) => {
      // 1. DigitalProductProfile
      const profile = await tx.digitalProductProfile.upsert({
        where: { productId },
        create: {
          productId,
          descriptionShort,
          descriptionFull,
          status,
        },
        update: {
          descriptionShort,
          descriptionFull,
          status,
        },
      });

      // 2. Specifications
      await tx.productSpecification.deleteMany({ where: { productId } });
      if (specs.length > 0) {
        await tx.productSpecification.createMany({
          data: specs.map((s, idx) => ({
            productId,
            name: s.name,
            value: s.value,
            sortOrder: s.sortOrder ?? idx,
          })),
        });
      }

      // ProductSpecification is the canonical technical source. Keep the
      // legacy catalog fields synchronized until every consumer reads the
      // structured rows directly.
      const technicalSpecs = specs
        .filter((spec) => spec.name.trim() && spec.value.trim())
        .map((spec) => `- **${spec.name.trim()}:** ${spec.value.trim()}`)
        .join("\n");
      await tx.product.update({
        where: { id: productId },
        data: {
          description: descriptionFull || descriptionShort || null,
          technicalSpecs: technicalSpecs || null,
        },
      });

      // 3. Variants
      await tx.productVariant.deleteMany({ where: { productId } });
      if (variants.length > 0) {
        await tx.productVariant.createMany({
          data: variants.map((v, idx) => ({
            productId,
            name: v.name,
            hexColor: v.hexColor || null,
            imageUrl: v.imageUrl || null,
            sku: v.sku || null,
            isAvailable: v.isAvailable !== false,
            sortOrder: v.sortOrder ?? idx,
          })),
        });
      }

      // 4. Videos
      await tx.productVideo.deleteMany({ where: { productId } });
      if (videos.length > 0) {
        await tx.productVideo.createMany({
          data: videos.map((v, idx) => ({
            productId,
            title: v.title,
            url: v.url,
            provider: v.provider,
            videoId: v.videoId,
            thumbnailUrl: v.thumbnailUrl || null,
            sortOrder: v.sortOrder ?? idx,
          })),
        });
      }

      // 5. Documents
      await tx.productDocument.deleteMany({ where: { productId } });
      if (docs.length > 0) {
        await tx.productDocument.createMany({
          data: docs.map((d, idx) => ({
            productId,
            title: d.title,
            url: d.url,
            type: d.type,
            sortOrder: d.sortOrder ?? idx,
          })),
        });
      }

      return profile;
    });

    // Revalidate paths
    revalidatePath("/admin/fichas");
    revalidatePath(`/admin/fichas/${productId}`);
    
    // Get product slug to revalidate public sheet page
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { slug: true }
    });
    if (product?.slug) {
      revalidatePath(`/p/${product.slug}`);
    }

    return NextResponse.json({ ok: true, profile: result });
  } catch (error: unknown) {
    console.error("Error saving digital profile:", error);
    return NextResponse.json({ error: "No se pudo guardar la ficha digital." }, { status: 500 });
  }
}
