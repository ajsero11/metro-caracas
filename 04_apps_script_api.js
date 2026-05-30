// ============================================================
// API COMPLETA v4 - Metro Caracas Locales
// INSTRUCCIONES:
// 1. En Apps Script, ve a Código.gs
// 2. Reemplaza TODO el contenido con este código
// 3. Guarda (Ctrl+S)
// 4. Ejecutar configurarNuevasColumnas() UNA sola vez (agrega cols 19-21)
// 5. Ejecutar cargarPrecios2026() UNA sola vez (llena precios nuevos)
// 6. Implementar → Administrar implementaciones → Nueva versión → Implementar
// ============================================================

var SHEET_NAME_LOCALES  = 'Locales';
var SHEET_NAME_USUARIOS = 'Usuarios';
var SHEET_NAME_PAGOS    = 'Pagos';
var DRIVE_FOLDER_ID     = '1exfPULplLmLfERPLKCSoUC0C_WmQg7Qi';

var COLS = {
  NRO: 1, LINEA: 2, ESTACION: 3, LOCAL: 4, ARRENDATARIO: 5,
  STATUS: 6, CONTRATO: 7, INICIO: 8, FIN: 9,
  AREA: 10, MTS_USD: 11, MONTO: 12, OBSERVACIONES: 13, FOTOS: 14,
  CONTINGENCIA: 15, PRECIO_FINAL: 16, TELEFONO: 17, CORREO: 18,
  CANON_2026: 19, TOTAL_2026: 20, PCT_INCREMENTO: 21
};

var UCOLS = { EMAIL: 1, NOMBRE: 2, ROL: 3, PASSWORD: 4 };

var PCOLS = { NRO_LOCAL: 1, ESTACION: 2, LOCAL: 3, FOTO_URL: 4, FECHA_DESDE: 5, FECHA_HASTA: 6, FECHA_REGISTRO: 7 };

// ============================================================
// PUNTO DE ENTRADA HTTP
// ============================================================
function doGet(e) {
  var params = e.parameter || {};
  var action = params.action || '';
  var result;
  try {
    if      (action === 'getLocales')    result = getLocales(params);
    else if (action === 'getLocal')      result = getLocal(params.nro);
    else if (action === 'login')         result = login(params.email, params.password);
    else if (action === 'getUsuarios')   result = getUsuarios(params.email);
    else if (action === 'getDirectorio') result = getDirectorio(params.email);
    else if (action === 'getPagos')      result = getPagos(params.nro, params.email);
    else result = { error: 'Acción no reconocida: ' + action };
  } catch(err) { result = { error: err.message }; }
  return output(result);
}

function doPost(e) {
  var body, action, result;
  try {
    body   = JSON.parse(e.postData.contents);
    action = body.action || '';
    if      (action === 'addLocal')        result = addLocal(body.data, body.email);
    else if (action === 'updateLocal')     result = updateLocal(body.nro, body.data, body.email);
    else if (action === 'deleteLocal')     result = deleteLocal(body.nro, body.email);
    else if (action === 'uploadFoto')      result = uploadFoto(body.nro, body.base64, body.fileName, body.email);
    else if (action === 'deleteFoto')      result = deleteFoto(body.nro, body.url, body.email);
    else if (action === 'addUsuario')      result = addUsuario(body.data, body.email);
    else if (action === 'updateUsuario')   result = updateUsuario(body.targetEmail, body.data, body.email);
    else if (action === 'deleteUsuario')   result = deleteUsuario(body.targetEmail, body.email);
    else if (action === 'updateContacto')  result = updateContacto(body.arrendatario, body.data, body.email);
    else if (action === 'addPago')         result = addPago(body.data, body.email);
    else result = { error: 'Acción no reconocida: ' + action };
  } catch(err) { result = { error: err.message }; }
  return output(result);
}

function output(result) {
  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

// ============================================================
// LOGIN CON CONTRASEÑA
// ============================================================
function login(email, password) {
  if (!email || !password) return { error: 'Email y contraseña requeridos' };
  var sheet = getSheet(SHEET_NAME_USUARIOS);
  var data  = sheet.getDataRange().getValues();
  var emailNorm = email.toLowerCase().trim();

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][UCOLS.EMAIL - 1]).toLowerCase().trim() === emailNorm) {
      var passGuardado = String(data[i][UCOLS.PASSWORD - 1]).trim();
      if (passGuardado !== password.trim()) return { error: 'Contraseña incorrecta' };
      return {
        ok: true,
        email:  data[i][UCOLS.EMAIL - 1],
        nombre: data[i][UCOLS.NOMBRE - 1],
        rol:    data[i][UCOLS.ROL - 1]
      };
    }
  }
  return { error: 'Usuario no encontrado' };
}

// ============================================================
// GESTIÓN DE USUARIOS (solo admin)
// ============================================================
function getUsuarios(email) {
  verificarAdmin(email);
  var sheet = getSheet(SHEET_NAME_USUARIOS);
  var data  = sheet.getDataRange().getValues();
  var usuarios = [];
  for (var i = 1; i < data.length; i++) {
    if (!data[i][0]) continue;
    usuarios.push({
      email:    data[i][UCOLS.EMAIL - 1],
      nombre:   data[i][UCOLS.NOMBRE - 1],
      rol:      data[i][UCOLS.ROL - 1],
      password: data[i][UCOLS.PASSWORD - 1]
    });
  }
  return { ok: true, usuarios: usuarios };
}

function addUsuario(data, email) {
  verificarAdmin(email);
  if (!data.email || !data.password) return { error: 'Email y contraseña son obligatorios' };
  var sheet    = getSheet(SHEET_NAME_USUARIOS);
  var existing = sheet.getDataRange().getValues();
  for (var i = 1; i < existing.length; i++) {
    if (String(existing[i][0]).toLowerCase() === data.email.toLowerCase()) {
      return { error: 'Ya existe un usuario con ese email' };
    }
  }
  sheet.appendRow([data.email, data.nombre || '', data.rol || 'usuario', data.password]);
  return { ok: true };
}

function updateUsuario(targetEmail, data, email) {
  verificarAdmin(email);
  var sheet  = getSheet(SHEET_NAME_USUARIOS);
  var rowNum = buscarFilaUsuario(sheet, targetEmail);
  if (!rowNum) return { error: 'Usuario no encontrado' };
  if (data.nombre   !== undefined) sheet.getRange(rowNum, UCOLS.NOMBRE).setValue(data.nombre);
  if (data.rol      !== undefined) sheet.getRange(rowNum, UCOLS.ROL).setValue(data.rol);
  if (data.password !== undefined) sheet.getRange(rowNum, UCOLS.PASSWORD).setValue(data.password);
  return { ok: true };
}

function deleteUsuario(targetEmail, email) {
  verificarAdmin(email);
  var sheet  = getSheet(SHEET_NAME_USUARIOS);
  var rowNum = buscarFilaUsuario(sheet, targetEmail);
  if (!rowNum) return { error: 'Usuario no encontrado' };
  sheet.deleteRow(rowNum);
  return { ok: true };
}

// ============================================================
// DIRECTORIO DE INQUILINOS
// ============================================================
function getDirectorio(email) {
  verificarAdmin(email);
  var sheet = getSheet(SHEET_NAME_LOCALES);
  var data  = sheet.getDataRange().getValues();
  var mapa  = {};

  for (var i = 1; i < data.length; i++) {
    var row         = data[i];
    var arrendatario = String(row[COLS.ARRENDATARIO - 1]).trim();
    if (!arrendatario || arrendatario === 'Sin inquilino' || arrendatario === '') continue;
    if (row[COLS.STATUS - 1] !== 'ARRENDADO' && row[COLS.STATUS - 1] !== 'COMODATO' && row[COLS.STATUS - 1] !== 'ASIGNADO') continue;

    if (!mapa[arrendatario]) {
      mapa[arrendatario] = {
        nombre:   arrendatario,
        locales:  [],
        telefono: String(row[COLS.TELEFONO - 1] || '').trim(),
        correo:   String(row[COLS.CORREO - 1]   || '').trim()
      };
    }
    mapa[arrendatario].locales.push({
      nro:      row[COLS.NRO - 1],
      local:    row[COLS.LOCAL - 1],
      estacion: row[COLS.ESTACION - 1],
      linea:    row[COLS.LINEA - 1],
      status:   row[COLS.STATUS - 1]
    });
  }

  var directorio = Object.keys(mapa).map(function(k) { return mapa[k]; });
  directorio.sort(function(a, b) { return a.nombre.localeCompare(b.nombre); });
  return { ok: true, directorio: directorio };
}

function updateContacto(arrendatario, data, email) {
  verificarAdmin(email);
  var sheet   = getSheet(SHEET_NAME_LOCALES);
  var rows    = sheet.getDataRange().getValues();
  var updated = 0;

  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][COLS.ARRENDATARIO - 1]).trim() === arrendatario) {
      if (data.telefono !== undefined) sheet.getRange(i + 1, COLS.TELEFONO).setValue(data.telefono);
      if (data.correo   !== undefined) sheet.getRange(i + 1, COLS.CORREO).setValue(data.correo);
      updated++;
    }
  }
  return { ok: true, updated: updated };
}

// ============================================================
// HISTORIAL DE PAGOS
// ============================================================
function getPagos(nro, email) {
  verificarAdmin(email);
  var sheet = getSheet(SHEET_NAME_PAGOS);
  var data  = sheet.getDataRange().getValues();
  var pagos = [];

  for (var i = 1; i < data.length; i++) {
    if (!data[i][0]) continue;
    if (nro && String(data[i][PCOLS.NRO_LOCAL - 1]) !== String(nro)) continue;
    pagos.push({
      nro_local:       data[i][PCOLS.NRO_LOCAL - 1],
      estacion:        data[i][PCOLS.ESTACION - 1],
      local:           data[i][PCOLS.LOCAL - 1],
      foto_url:        data[i][PCOLS.FOTO_URL - 1],
      fecha_desde:     data[i][PCOLS.FECHA_DESDE - 1],
      fecha_hasta:     data[i][PCOLS.FECHA_HASTA - 1],
      fecha_registro:  data[i][PCOLS.FECHA_REGISTRO - 1]
    });
  }
  pagos.reverse();
  return { ok: true, pagos: pagos };
}

function addPago(data, email) {
  verificarAdmin(email);
  if (!data.nro_local) return { error: 'nro_local es obligatorio' };

  var folder   = DriveApp.getFolderById(DRIVE_FOLDER_ID);
  var mimeType = 'image/jpeg';
  if (data.fileName && data.fileName.toLowerCase().endsWith('.png')) mimeType = 'image/png';
  var decoded  = Utilities.newBlob(Utilities.base64Decode(data.base64), mimeType, data.fileName || 'pago.jpg');
  var file     = folder.createFile(decoded);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  var url = 'https://drive.google.com/file/d/' + file.getId() + '/view';

  var sheet = getSheet(SHEET_NAME_PAGOS);
  sheet.appendRow([
    data.nro_local,
    data.estacion   || '',
    data.local      || '',
    url,
    data.fecha_desde  || '',
    data.fecha_hasta  || '',
    new Date().toISOString()
  ]);
  return { ok: true, url: url };
}

// ============================================================
// LOCALES
// ============================================================
function getLocales(params) {
  var sheet = getSheet(SHEET_NAME_LOCALES);
  var data  = sheet.getDataRange().getValues();
  var locales = [];
  var filtroLinea    = params.linea    ? String(params.linea).toUpperCase()    : '';
  var filtroEstacion = params.estacion ? params.estacion.toUpperCase()         : '';
  var filtroStatus   = params.status   ? params.status.toUpperCase()           : '';
  var filtroBuscar   = params.buscar   ? params.buscar.toUpperCase()           : '';

  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    if (!row[COLS.NRO - 1]) continue;
    var local = rowToObject(row);
    if (filtroLinea    && String(local.linea).toUpperCase() !== filtroLinea) continue;
    if (filtroEstacion && local.estacion.toUpperCase().indexOf(filtroEstacion) === -1) continue;
    if (filtroStatus   && local.status.toUpperCase() !== filtroStatus) continue;
    if (filtroBuscar) {
      var texto = (local.arrendatario + ' ' + local.local + ' ' + local.estacion).toUpperCase();
      if (texto.indexOf(filtroBuscar) === -1) continue;
    }
    locales.push(local);
  }
  return { ok: true, total: locales.length, locales: locales };
}

function getLocal(nro) {
  var sheet = getSheet(SHEET_NAME_LOCALES);
  var fila  = buscarFila(sheet, Number(nro));
  if (!fila) return { error: 'Registro no encontrado: ' + nro };
  return { ok: true, local: rowToObject(fila) };
}

function addLocal(data, email) {
  verificarAdmin(email);
  var sheet    = getSheet(SHEET_NAME_LOCALES);
  var nroNuevo = ultimoNro(sheet) + 1;
  sheet.appendRow([nroNuevo, data.linea||'', data.estacion||'', data.local||'',
    data.arrendatario||'', data.status||'DISPONIBLE', data.contrato||'',
    data.inicio||'', data.fin||'', data.area||'', data.mts_usd||'',
    data.monto||'', data.observaciones||'', '', 0, 0, '', '']);
  return { ok: true, nro: nroNuevo };
}

function updateLocal(nro, data, email) {
  verificarAdmin(email);
  var sheet  = getSheet(SHEET_NAME_LOCALES);
  var rowNum = buscarNumFila(sheet, Number(nro));
  if (!rowNum) return { error: 'Registro no encontrado' };
  var campos = {
    linea: COLS.LINEA, estacion: COLS.ESTACION, local: COLS.LOCAL,
    arrendatario: COLS.ARRENDATARIO, status: COLS.STATUS, contrato: COLS.CONTRATO,
    inicio: COLS.INICIO, fin: COLS.FIN, area: COLS.AREA,
    mts_usd: COLS.MTS_USD, monto: COLS.MONTO, observaciones: COLS.OBSERVACIONES,
    contingencia: COLS.CONTINGENCIA, precio_final: COLS.PRECIO_FINAL,
    telefono: COLS.TELEFONO, correo: COLS.CORREO
  };
  for (var campo in campos) {
    if (data.hasOwnProperty(campo)) sheet.getRange(rowNum, campos[campo]).setValue(data[campo]);
  }
  return { ok: true, nro: nro };
}

function deleteLocal(nro, email) {
  verificarAdmin(email);
  var sheet  = getSheet(SHEET_NAME_LOCALES);
  var rowNum = buscarNumFila(sheet, Number(nro));
  if (!rowNum) return { error: 'Registro no encontrado' };
  sheet.deleteRow(rowNum);
  return { ok: true };
}

function uploadFoto(nro, base64, fileName, email) {
  var folder   = DriveApp.getFolderById(DRIVE_FOLDER_ID);
  var mimeType = 'image/jpeg';
  if (fileName && fileName.toLowerCase().endsWith('.png')) mimeType = 'image/png';
  var decoded  = Utilities.newBlob(Utilities.base64Decode(base64), mimeType, fileName);
  var file     = folder.createFile(decoded);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  var url    = 'https://drive.google.com/file/d/' + file.getId() + '/view';
  var sheet  = getSheet(SHEET_NAME_LOCALES);
  var rowNum = buscarNumFila(sheet, Number(nro));
  if (!rowNum) return { error: 'Registro no encontrado' };
  var celda  = sheet.getRange(rowNum, COLS.FOTOS);
  var actual = String(celda.getValue()).trim();
  celda.setValue(actual ? actual + ',' + url : url);
  return { ok: true, url: url };
}

function deleteFoto(nro, url, email) {
  verificarAdmin(email);
  var sheet   = getSheet(SHEET_NAME_LOCALES);
  var rowNum  = buscarNumFila(sheet, Number(nro));
  if (!rowNum) return { error: 'Registro no encontrado' };
  var celda   = sheet.getRange(rowNum, COLS.FOTOS);
  var urlTrim = String(url).trim();
  var fotos   = String(celda.getValue()).split(',')
    .map(function(u) { return u.trim(); })
    .filter(function(u) { return u && u !== urlTrim; });
  celda.setValue(fotos.join(','));
  return { ok: true, fotos: fotos };
}

// ============================================================
// HELPERS
// ============================================================
function getSheet(nombre) {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(nombre);
  if (!sheet) {
    sheet = ss.insertSheet(nombre);
    if (nombre === SHEET_NAME_USUARIOS) {
      sheet.appendRow(['EMAIL', 'NOMBRE', 'ROL', 'PASSWORD']);
    }
    if (nombre === SHEET_NAME_PAGOS) {
      sheet.appendRow(['NRO_LOCAL', 'ESTACION', 'LOCAL', 'FOTO_URL', 'FECHA_DESDE', 'FECHA_HASTA', 'FECHA_REGISTRO']);
    }
  }
  return sheet;
}

function rowToObject(row) {
  var fotos = row[COLS.FOTOS - 1] ? String(row[COLS.FOTOS - 1]).split(',') : [];
  return {
    nro:          row[0],  linea:        row[1],  estacion:     row[2],  local:    row[3],
    arrendatario: row[4],  status:       row[5],  contrato:     row[6],
    inicio:       row[7],  fin:          row[8],  area:         row[9],  mts_usd:  row[10],
    monto:        row[11], observaciones:row[12], fotos:        fotos,
    contingencia: row[14] || 0, precio_final: row[15] || '',
    telefono:     row[16] || '', correo:       row[17] || '',
    canon_2026:   row[18] || 0, total_2026:   row[19] || 0,
    pct_incremento: row[20] || 0
  };
}

function buscarFila(sheet, nro) {
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (Number(data[i][0]) === nro) return data[i];
  }
  return null;
}

function buscarNumFila(sheet, nro) {
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (Number(data[i][0]) === nro) return i + 1;
  }
  return null;
}

function buscarFilaUsuario(sheet, email) {
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]).toLowerCase() === email.toLowerCase()) return i + 1;
  }
  return null;
}

function ultimoNro(sheet) {
  var data = sheet.getDataRange().getValues();
  var max  = 0;
  for (var i = 1; i < data.length; i++) {
    var n = Number(data[i][0]);
    if (n > max) max = n;
  }
  return max;
}

function verificarAdmin(email) {
  if (!email) throw new Error('Email requerido');
  var sheet = getSheet(SHEET_NAME_USUARIOS);
  var data  = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]).toLowerCase() === email.toLowerCase()) {
      if (data[i][UCOLS.ROL - 1] !== 'admin') throw new Error('Acceso denegado: se requiere rol admin');
      return true;
    }
  }
  throw new Error('Usuario no encontrado');
}

// ============================================================
// CONFIGURACIÓN INICIAL
// ============================================================
function configurarNuevasColumnas() {
  var sheet = getSheet(SHEET_NAME_LOCALES);
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

  if (headers.length < 17 || headers[16] !== 'TELEFONO') {
    sheet.getRange(1, 17).setValue('TELEFONO');
    sheet.setColumnWidth(17, 140);
  }
  if (headers.length < 18 || headers[17] !== 'CORREO') {
    sheet.getRange(1, 18).setValue('CORREO');
    sheet.setColumnWidth(18, 200);
  }
  if (headers.length < 19 || headers[18] !== 'CANON_2026') {
    sheet.getRange(1, 19).setValue('CANON_2026');
    sheet.setColumnWidth(19, 120);
  }
  if (headers.length < 20 || headers[19] !== 'TOTAL_2026') {
    sheet.getRange(1, 20).setValue('TOTAL_2026');
    sheet.setColumnWidth(20, 120);
  }
  if (headers.length < 21 || headers[20] !== 'PCT_INCREMENTO') {
    sheet.getRange(1, 21).setValue('PCT_INCREMENTO');
    sheet.setColumnWidth(21, 130);
  }

  getSheet(SHEET_NAME_PAGOS);
  Logger.log('✅ Columnas configuradas correctamente (cols 17-21 + hoja Pagos)');
}

function cargarPrecios2026() {
  var datos = [
    [1,10,1765.9,13,2295.67,529.77],
    [2,8,304,13,494,190],
    [3,8.11,323.1,13,517.92,194.82],
    [4,11.45,99.96,15.5,135.32,35.36],
    [5,7.06,2047.4,15.5,4495,2447.6],
    [6,10.98,71.37,15.5,100.75,29.38],
    [7,14.49,99.98,15.5,106.95,6.97],
    [8,10.34,71.35,15.5,106.95,35.6],
    [9,10.34,71.35,15.5,106.95,35.6],
    [10,10.34,71.35,15.5,106.95,35.6],
    [11,15.5,113.92,15.5,113.92,0],
    [12,10.34,402.23,13,505.7,103.47],
    [13,8,311.2,13,505.7,194.5],
    [14,8,311.2,13,505.7,194.5],
    [15,10.34,402.23,13,505.7,103.47],
    [16,10.34,402.23,13,505.7,103.47],
    [17,10.34,256.43,13,322.4,65.97],
    [18,10.34,256.43,13,322.4,65.97],
    [19,12.1,300.08,13,322.4,22.32],
    [20,10.34,256.43,13,322.4,65.97],
    [21,4.83,350.22,13,942.63,592.41],
    [22,10.34,301.1,13,378.56,77.46],
    [23,12.1,922.75,13,991.38,68.63],
    [24,10,786,13,1021.8,235.8],
    [25,10.34,784.19,13,985.92,201.73],
    [26,12.1,899.39,13,966.29,66.9],
    [27,10.34,748.1,13,940.55,192.45],
    [28,5.93,449.73,13,985.92,536.19],
    [29,10.34,982.4,13,1235.13,252.73],
    [30,10.34,565.6,13,711.1,145.5],
    [31,7.59,1394.36,8,1469.68,75.32],
    [32,10.3,339.9,15,495,155.1],
    [33,5.48,180.02,15,492.75,312.73],
    [34,10.07,366.85,15,546.45,179.6],
    [35,10.34,383.72,15,556.65,172.93],
    [36,10.34,450.2,15,653.1,202.9],
    [37,10.34,669.41,15,971.1,301.69],
    [38,7.59,249.94,15,493.95,244.01],
    [39,5.5,200.09,15,545.7,345.61],
    [40,4.43,200.01,15,677.25,477.24],
    [41,10.34,259.74,15,376.8,117.06],
    [42,15.21,380.1,15,374.85,-5.25],
    [43,15.21,379.49,15,374.25,-5.24],
    [44,10.34,86.96,15,126.15,39.19],
    [45,10.34,83.65,15,121.35,37.7],
    [46,10.34,82.31,15,119.4,37.09],
    [47,10.35,71.31,15,103.35,32.04],
    [48,10.34,71.45,15,103.65,32.2],
    [49,10.34,71.35,15,103.5,32.15],
    [50,10.35,71,15,102.9,31.9],
    [51,10.34,71.45,15,103.65,32.2],
    [52,10.35,71.31,15,103.35,32.04],
    [53,10.34,71.24,15,103.35,32.11],
    [54,10.35,71.62,15,103.8,32.18],
    [55,17,219.13,17,219.13,0],
    [56,17,216.41,17,216.41,0],
    [57,10.34,130.9,17,215.22,84.32],
    [58,17,216.41,17,216.41,0],
    [59,10.34,130.9,17,215.22,84.32],
    [60,10.34,131.11,17,215.56,84.45],
    [61,10.34,147.14,17,241.91,94.77],
    [62,10.34,135.35,17,222.53,87.18],
    [63,10.34,117.36,17,192.95,75.59],
    [64,10.34,168.85,12,195.96,27.11],
    [65,10.31,322.19,12,375,52.81],
    [66,10,98.1,9,88.29,-9.81],
    [67,10,115.6,9,104.04,-11.56],
    [68,10,116.1,9,104.49,-11.61],
    [69,10,115.6,9,104.04,-11.56],
    [70,10.04,116.56,9,104.49,-12.07],
    [71,10,116.8,9,105.12,-11.68],
    [72,10,120.2,9,108.18,-12.02],
    [73,10,278.4,9,250.56,-27.84],
    [74,5.43,445.48,9,738.36,292.88],
    [75,5.17,928.12,6,1077.12,149],
    [76,5.17,928.12,6,1077.12,149],
    [77,6.02,136.47,11,249.37,112.9],
    [78,5.68,199.88,11,387.09,187.21],
    [79,2.59,55.84,11,237.16,181.32],
    [80,2.59,55.84,11,237.16,181.32],
    [81,2.59,87.75,11,372.68,284.93],
    [82,5,183.95,11,404.69,220.74],
    [83,6.02,124.31,11,227.15,102.84],
    [84,6.02,143.22,11,261.69,118.47],
    [85,6.02,109.38,8,145.36,35.98],
    [86,5,101.25,8,162,60.75],
    [87,5,98.2,8,157.12,58.92],
    [88,5,98.2,8,157.12,58.92],
    [89,3.5,68.74,8,157.12,88.38],
    [90,3.02,59.31,8,157.12,97.81],
    [91,5,98.2,8,157.12,58.92],
    [92,5,98.2,8,157.12,58.92],
    [93,5.09,99.97,8,157.12,57.15],
    [94,6.02,118.23,8,157.12,38.89],
    [95,6.02,118.23,8,157.12,38.89],
    [96,6.02,118.23,8,157.12,38.89],
    [97,5.09,99.97,8,157.12,57.15],
    [98,6.02,118.23,8,157.12,38.89],
    [99,5.09,99.97,8,157.12,57.15],
    [100,5,98.2,8,157.12,58.92],
    [101,6.02,118.23,8,157.12,38.89],
    [102,6.02,118.23,8,157.12,38.89],
    [103,5,98.2,8,157.12,58.92],
    [104,6.02,1300.32,8,1728,427.68],
    [105,2,432,8,1728,1296],
    [106,3.37,116.26,7,241.5,125.24],
    [107,6.02,136.47,7,158.69,22.22],
    [108,10.34,145.07,9,126.27,-18.8],
    [109,10.34,118.7,9,103.32,-15.38],
    [110,10.34,124.08,9,108,-16.08],
    [111,10.34,116.74,9,101.61,-15.13],
    [112,10.34,117.46,9,102.24,-15.22],
    [113,10.34,125.73,9,109.44,-16.29],
    [114,2.15,688,6,1920,1232],
    [115,8,178.08,6,133.56,-44.52],
    [116,8,176,6,132,-44],
    [117,8,158.16,6,118.62,-39.54],
    [118,8,179.36,6,134.52,-44.84],
    [119,5,220,6,264,44],
    [120,5,265,6,318,53],
    [121,5,300,6,360,60],
    [122,5,585,6,702,117],
    [123,5,165,6,198,33],
    [124,5,185,6,222,37],
    [125,5,235,6,282,47],
    [126,10.34,392.92,6,228,-164.92],
    [127,10.34,444.62,6,258,-186.62],
    [128,5,225,6,270,45],
    [129,5,610,6,732,122],
    [130,10.34,641.08,6,372,-269.08],
    [131,2.11,200.45,6,570,369.55],
    [132,8,344,12,516,172],
    [133,6,246,12,492,246],
    [134,7,343.42,12,588.72,245.3],
    [135,8,424,12,636,212],
    [136,14.29,100.03,14.5,101.5,1.47],
    [137,4.31,64.65,12,180,115.35],
    [138,7,105,12,180,75],
    [139,4.31,301.7,12,840,538.3],
    [140,4.31,172.4,12,480,307.6],
    [141,4.31,163.78,12,456,292.22],
    [142,4.31,232.74,12,648,415.26],
    [143,4.31,140.85,10,326.8,185.95],
    [144,8,101.52,12,152.28,50.76],
    [145,10.34,119.01,12,138.12,19.11],
    [146,4.31,70.04,8,130,59.96],
    [147,10.34,140.42,8,108.64,-31.78],
    [148,6.3,89.9,8,114.16,24.26],
    [149,4.31,53.31,8,98.96,45.65],
    [150,4.31,46.72,8,86.72,40],
    [151,4.31,38.36,8,71.2,32.84],
    [152,5.17,45.19,8,69.92,24.73],
    [153,11.24,100.04,8,71.2,-28.84],
    [154,3.45,30.53,8,70.8,40.27],
    [155,4.31,47.67,8,88.48,40.81],
    [156,5.17,2232.35,8,3454.32,1221.97],
    [157,6.62,473.86,8,572.64,98.78],
    [158,6.62,389.65,8,470.88,81.23],
    [159,6.62,370.72,8,448,77.28],
    [160,6.62,211.84,8,256,44.16],
    [161,5.17,56.09,8,86.8,30.71],
    [162,9.22,101.42,9.5,104.5,3.08],
    [163,5.17,55.94,9.5,102.79,46.85],
    [164,5.17,73.26,9.5,134.62,61.36],
    [165,5.17,122.32,8,189.28,66.96],
    [166,8,140.88,8,140.88,0],
    [167,5.17,91.04,8,140.88,49.84],
    [168,5.17,91.56,8,141.68,50.12],
    [169,5.17,94.09,8,145.6,51.51],
    [170,5.17,91.3,8,141.28,49.98],
    [171,5.17,92.34,8,142.88,50.54],
    [172,14,100.52,14,100.52,0],
    [173,14,103.6,14,103.6,0],
    [174,14,109.9,14,109.9,0],
    [175,14,218.96,13,203.32,-15.64],
    [176,14,218.96,13,203.32,-15.64],
    [177,14,217.56,13,202.02,-15.54],
    [178,5.17,446.79,7,604.94,158.15],
    [179,5.17,213.83,7,289.52,75.69],
    [180,5.17,932.25,7,1262.24,329.99]
  ];

  var sheet  = getSheet(SHEET_NAME_LOCALES);
  var rows   = sheet.getDataRange().getValues();
  var mapa   = {};
  for (var i = 1; i < rows.length; i++) {
    var nro = Number(rows[i][0]);
    if (nro) mapa[nro] = i + 1;
  }

  var updated = 0;
  for (var d = 0; d < datos.length; d++) {
    var nro2 = datos[d][0];
    // datos[d] = [nro, canon_actual, total_actual, canon_2026, total_2026, pct]
    var rowNum = mapa[nro2];
    if (!rowNum) continue;
    sheet.getRange(rowNum, COLS.CANON_2026).setValue(datos[d][3]);
    sheet.getRange(rowNum, COLS.TOTAL_2026).setValue(datos[d][4]);
    sheet.getRange(rowNum, COLS.PCT_INCREMENTO).setValue(datos[d][5]);
    updated++;
  }
  Logger.log('✅ Precios 2026 cargados: ' + updated + ' filas actualizadas');
}

function configurarPrimerAdmin() {
  var sheet = getSheet(SHEET_NAME_USUARIOS);
  var data  = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === 'ajsero1122@gmail.com') {
      Logger.log('Admin ya existe');
      return;
    }
  }
  sheet.appendRow(['ajsero1122@gmail.com', 'Administrador', 'admin', 'admin123']);
  Logger.log('✅ Admin creado con contraseña: admin123');
}

function agregarColumnaPassword() {
  var sheet = getSheet(SHEET_NAME_USUARIOS);
  sheet.getRange('D1').setValue('PASSWORD');
  sheet.setColumnWidth(4, 150);
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (!data[i][3]) sheet.getRange(i + 1, 4).setValue('cambiar123');
  }
  Logger.log('✅ Columna PASSWORD agregada');
}
