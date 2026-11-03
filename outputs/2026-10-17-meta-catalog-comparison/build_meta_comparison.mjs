import fs from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { SpreadsheetFile, Workbook } from '/Users/mark/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@oai/artifact-tool/dist/artifact_tool.mjs';

const zipPath = '/Users/mark/Downloads/productos-publicados-2026-10-16-jpg.zip';
const outputDir = '/Users/mark/Desktop/IMPORTADORA/outputs/2026-10-17-meta-catalog-comparison';
const outputPath = `${outputDir}/comparacion_catalogo_meta_tienda.xlsx`;
const pythonPath = '/Users/mark/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3';

const codeText = `N1573|CR36|CR32|CR310|CR308|CR304|CR210|CR19|CR301|CR29|CR298|CR24|CR22|CR21|CR217|CR204|CR295|CR289|CR244|CR227|CR226|CR224|CR220|CR219|CR214|CR212|CR192|CR194|CR168|CR166|CR164|CR160|CR157|O410|AU30|N1401|CR150|CR14|CR181|CR146|CP550|CR03|CP590|CA616|CA611|CA268|CC157|CC155|CC153|CC151|CC14|CC13|CC10|CC03|CB31|CB28|CB189|T07|T02|T01|SDK8|SDK64|SDK512|SDK4|SDK32|SDK16|PH-16|PC97|PC89|PC78|PC63-NEGRO|PC594|PC54|PC53|PC425|PC424|PC423|PC422|PC421|PC420|PC419|PC418|PC417|PC416|PC415|PC413|PC412|PC410|PC409-WHITE|PC409-BLACK|PC408|PC407|PC405|PC404|PC402|PC390|PC388|PC388-SQ|PC387|PC386|PC384|PC383|PC380|PC378|PC375|PC372|PC367|PC360|PC357|PC351|PC347|PC33|PC333|PC332|PC31|PC315|PC292-PINK|PC292-BLACK|PC290|PC277|PC276|PC237|PC233|PC208|PC206|PC19|PC189|PC18|PC16|PC152|PC14|PC11|PC116-ROSADO|PC110|PC10|PC105|PC04|PC03|PC025|PC024|P170|P1081|P1075|P1041|P1029|P1026-NEGRO|P1026-GRIS|P1010|P999|P998|P997|P992|P990|P986|P985|P984|P983|P982|P981|P980|P979|P978|P976|P974|P973|P971|P960 / P960-SQ|P957|P956|P950|P949|P948|P946|P944|P943|P930|P928|P922|P920|P918|P916|P915|P909|P895|P891|P889|P887|P882|P873|P870|P846|P841|P837|P836|P810|P809|P808|P802|P788|P787-NEGRO|P786|P785-NEGRO|P783|P782-NEGRO|P778|P777|P775|P772|P766|P759|P753|P751|P737|P731|P730|P729|P728|P724|P717|P715|P714|P713|P701|P698|P696|P695|P692|P652|P645|P606|P591|P590|P558|P54|P548|P539|P50|P499|P497|P491|P465|P461|P448|P442|P439|P438|P437|P430|P428|P420|P41|P414|P403|P394|P393|P38|P383|P373|P320|P29|P293|P28|P281|P27|P273|P26|P268|P25|P255|P245|P242|P240|P239|P220|P213|P19|P199|P189|P15|P156|P151|P14|P125|P1102|P10|P1084|P1083|P1082`;

function parseCsv(text) {
  const rows = [];
  let row = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n') { row.push(field.replace(/\r$/, '')); rows.push(row); row = []; field = ''; }
    else field += ch;
  }
  if (field.length || row.length) { row.push(field.replace(/\r$/, '')); rows.push(row); }
  const headers = (rows.shift() || []).map(h => h.replace(/^\uFEFF/, '').trim());
  return rows.filter(r => r.some(v => v.trim())).map(r => Object.fromEntries(headers.map((h, i) => [h, r[i] ?? ''])));
}

function norm(value) { return String(value ?? '').trim().toUpperCase().replace(/\s+/g, ''); }
function numeric(value) {
  const n = Number(String(value ?? '').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

const csv = execFileSync('unzip', ['-p', zipPath, 'productos.csv'], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
const sourceAll = parseCsv(csv);
const source = sourceAll.filter(p => numeric(p.stock) > 0);
const sourceByCode = new Map(source.map(p => [norm(p.codigo), p]));
const metaBase = codeText.split('|').map(x => x.trim()).filter(Boolean);
const metaRecords = metaBase.map(code => {
  const aliases = code.split('/').map(x => x.trim());
  const matches = aliases.map(a => sourceByCode.get(norm(a))).filter(Boolean);
  const title = matches[0]?.nombre || '';
  return { code, aliases, title, sourceMatch: matches.length > 0 };
});
const metaTitleOverrides = {
  N1573: 'ADAPTADOR USB WIFI LK-600M',
  CB189: 'CABLE M. SUPER 1 METRO TIPO V8 6A (CB-S1V) S-01 COD. CB189',
  T01: 'TRANSFORMERS AUDIFONO BLUETOOTH (TF-T01-YELLOW)',
  PC387: 'SQ SET 2 EN 1 DE TECLADO Y MOUSE DISEÑO PINK',
  PC33: 'SQ COOLER PARA LAPTOP M. SUPER COOL',
  PC31: 'SQ M. SUPER COOLER PARA LAPTOP GLACIER 6EN1 COD. PC31',
  P808: 'PARLANTE CON MICROFONO HOXEN L-61001A',
  P497: 'KAPERH PARLANTE BOOMZA 3',
  P220: 'MINI PARLANTE BLUETOOTH KAPERH X-BASS 3D 5',
};
for (const m of metaRecords) if (metaTitleOverrides[m.code]) m.title = metaTitleOverrides[m.code];
const t07 = metaRecords.find(x => x.code === 'T07');
if (t07) metaRecords.splice(metaRecords.indexOf(t07) + 1, 0, { ...t07, title: `${t07.title || 'TRANSFORMERS AUDIFONO BLUETOOTH'} (variante TF-T07-GREY)`, note: 'Variante visible en Meta; comparte el código T07 con la variante amarilla.' });
if (t07) { t07.title = `${t07.title || 'TRANSFORMERS AUDIFONO BLUETOOTH'} (variante TF-T07-YELLOW)`; t07.note = 'Variante visible en Meta; comparte el código T07 con la variante gris.'; }

const metaCodes = new Set(metaRecords.flatMap(m => m.aliases.map(norm)));
const matched = source.filter(p => metaCodes.has(norm(p.codigo)));
const unmatched = source.filter(p => !metaCodes.has(norm(p.codigo)));
const metaCodeCounts = new Map();
for (const m of metaRecords) for (const a of m.aliases) metaCodeCounts.set(norm(a), (metaCodeCounts.get(norm(a)) || 0) + 1);

await fs.mkdir(outputDir, { recursive: true });
const workbook = Workbook.create();
const summary = workbook.worksheets.add('Resumen');
const metaSheet = workbook.worksheets.add('Registros Meta visibles');
const compare = workbook.worksheets.add('Comparación tienda');

summary.getRange('A1:B1').merge();
summary.getRange('A1').values = [['Comparación del catálogo de Importaciones Super']];
summary.getRange('A1:B1').format = { fill: '#164E63', font: { bold: true, color: '#FFFFFF', size: 16 } };
summary.getRange('A3:B12').values = [
  ['Indicador', 'Resultado'],
  ['Productos publicados con stock en ZIP (16 oct 2026)', source.length],
  ['Códigos únicos publicados con stock', new Set(source.map(p => norm(p.codigo))).size],
  ['Filas de productos observadas en la lista de Meta Business Agent', metaRecords.length],
  ['Códigos únicos de Meta observados (antes de separar alias)', new Set(metaBase.map(norm)).size],
  ['Productos de tienda con coincidencia exacta por código', matched.length],
  ['Productos de tienda sin coincidencia en esta extracción de Meta', unmatched.length],
  ['Productos Meta sin coincidencia directa en la tienda', metaRecords.filter(m => !m.sourceMatch).length],
  ['Duplicidad/variante observada en Meta', 'T07 aparece dos veces como variantes TF-T07-YELLOW y TF-T07-GREY'],
  ['Estado de cobertura', 'PARCIAL: Meta muestra “1634 elementos” en la ficha del catálogo, pero la lista de productos leída en esta sesión expuso 289 filas (288 claves primarias). No interpretar los no encontrados como faltantes definitivos hasta obtener una exportación completa de Commerce Manager.'],
];
summary.getRange('A3:B3').format = { fill: '#0E7490', font: { bold: true, color: '#FFFFFF' } };
summary.getRange('A4:A12').format.font = { bold: true, color: '#164E63' };
summary.getRange('B12').format.wrapText = true;
summary.getRange('A3:A17').format.columnWidth = 58;
summary.getRange('B3:B17').format.columnWidth = 110;
summary.getRange('A3:A17').format.wrapText = true;
summary.getRange('A4:B10').format.rowHeight = 40;
summary.getRange('A11:B12').format.rowHeight = 52;
summary.getRange('A14:B17').values = [
  ['Criterio de cotejo', 'Coincidencia por código normalizado (sin distinguir mayúsculas/espacios); la clave primaria compuesta P960 / P960-SQ se coteja contra ambos alias.'],
  ['Fuente tienda', 'productos-publicados-2026-10-16-jpg.zip, productos.csv; 1,955 filas, todas con stock positivo según el CSV.'],
  ['Fuente Meta', 'Meta Business Agent > Tu información > Productos, Chrome perfil luis; leído el 17 oct 2026. Ficha vinculada: “Products for Importaciones super”, 1,634 elementos.'],
  ['Limitación', 'La lista accesible en pantalla no expuso el inventario completo anunciado por la ficha. Esta comparación sirve para detectar coincidencias y candidatos, no certifica el total real de Commerce Manager.'],
];
summary.getRange('A14:A17').format.font = { bold: true, color: '#164E63' };
summary.getRange('A14:A17').format.columnWidth = 22;
summary.getRange('B14:B17').format.columnWidth = 110;
summary.getRange('B14:B17').format.wrapText = true;
summary.getRange('A14:B17').format.rowHeight = 46;
summary.getRange('A1:B17').format.font = { name: 'Arial', size: 10 };
summary.getRange('A1:B1').format = { fill: '#164E63', font: { name: 'Arial', bold: true, color: '#FFFFFF', size: 16 } };
summary.getRange('A3:B3').format = { fill: '#0E7490', font: { name: 'Arial', bold: true, color: '#FFFFFF' } };
summary.getRange('B12').format = { fill: '#FEF3C7', font: { name: 'Arial', color: '#78350F', size: 10 }, wrapText: true };

const metaValues = [['Código que muestra Meta', 'Nombre (tomado de tienda si coincide)', 'Coincidencia en tienda', 'Observación']];
for (const m of metaRecords) {
  const match = m.aliases.map(a => sourceByCode.get(norm(a))).find(Boolean);
  metaValues.push([m.code, m.title || match?.nombre || '', match ? 'Sí, por código' : 'No encontrado en ZIP', m.note || (m.code.includes('/') ? 'Meta muestra dos alias en una fila' : '')]);
}
metaSheet.getRange(`A1:D${metaValues.length}`).values = metaValues;
metaSheet.getRange('A1:D1').format = { fill: '#164E63', font: { bold: true, color: '#FFFFFF' } };
metaSheet.getRange(`A1:D${metaValues.length}`).format.font = { name: 'Arial', size: 10 };
metaSheet.getRange('A1:D1').format = { fill: '#164E63', font: { name: 'Arial', bold: true, color: '#FFFFFF' } };
metaSheet.getRange(`A2:D${metaValues.length}`).format.wrapText = true;
metaSheet.getRange(`A1:A${metaValues.length}`).format.columnWidth = 26;
metaSheet.getRange(`B1:B${metaValues.length}`).format.columnWidth = 58;
metaSheet.getRange(`C1:C${metaValues.length}`).format.columnWidth = 25;
metaSheet.getRange(`D1:D${metaValues.length}`).format.columnWidth = 62;
metaSheet.freezePanes.freezeRows(1);

const headers = ['Código tienda', 'Nombre tienda', 'Categoría', 'Marca', 'Stock', 'Precio unitario S/', 'Precio mayorista S/', 'Mínimo mayorista', 'Descripción', 'Ficha técnica', 'Imagen (ruta/URL)', 'Estado cotejo Meta'];
const compareRows = [headers, ...source.map(p => [
  p.codigo, p.nombre, p.categoria, p.marca, numeric(p.stock), numeric(p.precio_publico), numeric(p.precio_mayorista), numeric(p.cantidad_minima_mayorista), p.descripcion, p.ficha_tecnica, p.imagen,
  metaCodes.has(norm(p.codigo)) ? 'Encontrado por código en extracción Meta' : 'No aparece en extracción Meta; validar en Commerce Manager',
])];
compare.getRange(`A1:L${compareRows.length}`).values = compareRows;
compare.getRange('A1:L1').format = { fill: '#164E63', font: { name: 'Arial', bold: true, color: '#FFFFFF', size: 10 }, wrapText: true };
compare.getRange(`A2:L${compareRows.length}`).format.font = { name: 'Arial', size: 9 };
compare.getRange(`I2:L${compareRows.length}`).format.wrapText = true;
compare.getRange(`F2:G${compareRows.length}`).format.numberFormat = '"S/ "#,##0.00';
compare.getRange('A:A').format.columnWidth = 18;
compare.getRange('B:B').format.columnWidth = 58;
compare.getRange('C:D').format.columnWidth = 26;
compare.getRange('E:H').format.columnWidth = 16;
compare.getRange('I:J').format.columnWidth = 55;
compare.getRange('K:K').format.columnWidth = 42;
compare.getRange('L:L').format.columnWidth = 52;
compare.freezePanes.freezeRows(1);

const preview = await workbook.render({ sheetName: 'Resumen', autoCrop: 'all', scale: 1, format: 'png' });
await fs.writeFile(`${outputDir}/resumen_preview.png`, new Uint8Array(await preview.arrayBuffer()));
const file = await SpreadsheetFile.exportXlsx(workbook);
await file.save(outputPath);
const check = await workbook.inspect({ kind: 'workbook,sheet', include: 'id,name', maxChars: 3000 });
console.log(JSON.stringify({ outputPath, publishedRows: source.length, metaRows: metaRecords.length, metaUniqueCodes: new Set(metaBase.map(norm)).size, matched: matched.length, unmatched: unmatched.length, metaCodesNotFoundInShop: metaRecords.filter(m => !m.sourceMatch).map(m => m.code), preview: `${outputDir}/resumen_preview.png`, inspect: check.ndjson.slice(0, 2000) }));
