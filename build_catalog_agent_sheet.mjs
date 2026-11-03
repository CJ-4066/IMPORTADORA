import fs from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const outputDir = "/tmp/importaciones-super-agent-catalog";
const feedUrl = "https://tiendavirtualsuper.com/meta/catalog.xml";
const xml = execFileSync("curl", ["-L", "--fail", "--max-time", "60", "-A", "Mozilla/5.0", feedUrl], { encoding: "utf8", maxBuffer: 10 * 1024 * 1024 });

const itemBlocks = xml.match(/<item>[\s\S]*?<\/item>/g) ?? [];
const decode = (value = "") => value
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
  .replace(/&amp;/g, "&")
  .replace(/&lt;/g, "<")
  .replace(/&gt;/g, ">")
  .replace(/&quot;/g, '"')
  .replace(/&#39;/g, "'")
  .trim();
const field = (block, name) => {
  const escaped = name.replace(":", "\\:");
  const match = block.match(new RegExp(`<${escaped}>([\\s\\S]*?)<\\/${escaped}>`));
  return decode(match?.[1] ?? "");
};
const rows = itemBlocks.map((block) => [
  field(block, "g:id"),
  field(block, "g:title"),
  field(block, "g:price"),
  field(block, "g:description"),
  field(block, "g:availability"),
  field(block, "g:product_type"),
  field(block, "g:link"),
  field(block, "g:image_link"),
]);

const workbook = Workbook.create();
const sheet = workbook.worksheets.add("Catálogo");
const headers = [["SKU", "Producto", "Precio", "Descripción", "Disponibilidad", "Categoría", "Enlace", "Imagen"]];
sheet.getRange(`A1:H${rows.length + 1}`).values = [...headers, ...rows];
sheet.getRange("A1:H1").format = {
  fill: "#0B5CAD",
  font: { name: "Arial", bold: true, color: "#FFFFFF" },
};
sheet.getRange(`A1:H${rows.length + 1}`).format.font = { name: "Arial", size: 10 };
sheet.getRange(`A1:H${rows.length + 1}`).format.wrapText = true;
sheet.getRange(`A1:H${rows.length + 1}`).format.borders = { preset: "all", style: "thin", color: "#D9E2F3" };
sheet.getRange(`C2:C${rows.length + 1}`).format.numberFormat = "@";
sheet.getRange("A:A").format.columnWidth = 16;
sheet.getRange("B:B").format.columnWidth = 38;
sheet.getRange("C:C").format.columnWidth = 19;
sheet.getRange("D:D").format.columnWidth = 70;
sheet.getRange("E:E").format.columnWidth = 16;
sheet.getRange("F:F").format.columnWidth = 28;
sheet.getRange("G:H").format.columnWidth = 45;
sheet.freezePanes.freezeRows(1);
sheet.tables.add(`A1:H${rows.length + 1}`, true, "CatalogoProductos");
workbook.recalculate();

await fs.mkdir(outputDir, { recursive: true });
const preview = await workbook.render({ sheetName: "Catálogo", range: "A1:H8", scale: 1.25, format: "png" });
await fs.writeFile(`${outputDir}/preview.png`, new Uint8Array(await preview.arrayBuffer()));
const file = await SpreadsheetFile.exportXlsx(workbook);
await file.save(`${outputDir}/catalogo_importaciones_super.xlsx`);
console.log(JSON.stringify({ products: rows.length, output: `${outputDir}/catalogo_importaciones_super.xlsx` }));
