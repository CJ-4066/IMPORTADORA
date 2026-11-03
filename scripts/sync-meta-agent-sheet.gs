/** Sincroniza la hoja ya vinculada a Meta; ejecutar instalarSincronizacion una vez. */
const CATALOGO = {
  spreadsheetId: '1jbks2EsRl8bRgDbAlbXayv-QGIe7ZPXgEObgvcpdDxE',
  sheetName: 'Catálogo',
  feedUrl: 'https://tiendavirtualsuper.com/meta/catalog.xml',
};

function instalarSincronizacion() {
  actualizarCatalogo();
  const existente = ScriptApp.getProjectTriggers().some(function(t) {
    return t.getHandlerFunction() === 'actualizarCatalogo';
  });
  if (!existente) ScriptApp.newTrigger('actualizarCatalogo').timeBased().everyHours(1).create();
  console.log('Actualización horaria instalada.');
}

function actualizarCatalogo() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) return;
  try {
    const response = UrlFetchApp.fetch(CATALOGO.feedUrl, {muteHttpExceptions: true});
    if (response.getResponseCode() !== 200) throw new Error('Feed HTTP ' + response.getResponseCode());
    const root = XmlService.parse(response.getContentText()).getRootElement();
    const channel = root.getChild('channel');
    if (!channel) throw new Error('Feed sin canal RSS; se conserva la última versión.');
    const ns = XmlService.getNamespace('http://base.google.com/ns/1.0');
    const vistos = {};
    const rows = channel.getChildren('item').filter(function(item) {
      return item.getChildText('availability', ns) === 'in stock';
    }).map(function(item) {
      const values = ['id','title','price','description','availability','product_type','link','image_link'].map(function(k) {
        return (item.getChildText(k, ns) || '').trim();
      });
      if (!values[0] || !values[1] || !values[2] || !values[3] || !values[6] || !values[7]) {
        throw new Error('Producto incompleto: ' + values[0] + '; se conserva la última versión.');
      }
      if (vistos[values[0]]) throw new Error('SKU duplicado en feed: ' + values[0]);
      vistos[values[0]] = true;
      // Impide interpretar texto externo como una fórmula de Sheets.
      return values.map(function(v) { return /^[=+@]/.test(v) ? "'" + v : v; });
    });
    if (!rows.length) throw new Error('Feed vacío; se conserva la última versión.');
    const ss = SpreadsheetApp.openById(CATALOGO.spreadsheetId);
    const sheet = ss.getSheetByName(CATALOGO.sheetName);
    if (!sheet) throw new Error('No se encontró la pestaña Catálogo.');
    const data = [['SKU','Producto','Precio','Descripción','Disponibilidad','Categoría','Enlace','Imagen']].concat(rows);
    const lastRow = sheet.getLastRow();
    if (sheet.getMaxRows() < data.length) sheet.insertRowsAfter(sheet.getMaxRows(), data.length - sheet.getMaxRows());
    sheet.getRange(1,1,data.length,8).setValues(data);
    if (lastRow > data.length) sheet.getRange(data.length + 1,1,lastRow - data.length,8).clearContent();
    SpreadsheetApp.flush();
    const props = PropertiesService.getScriptProperties();
    props.setProperties({ultimaActualizacion: new Date().toISOString(), productos: String(rows.length)});
    console.log('Sincronización correcta: ' + rows.length + ' productos vigentes.');
  } finally {
    lock.releaseLock();
  }
}
