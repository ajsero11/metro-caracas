// ============================================================
// API COMPLETA v2 - Metro Caracas Locales
// INSTRUCCIONES:
// 1. En Apps Script, ve a Código.gs
// 2. Reemplaza TODO el contenido con este código
// 3. Guarda (Ctrl+S)
// 4. Implementar → Administrar implementaciones → editar (lápiz) → Nueva versión → Implementar
// ============================================================

var SHEET_NAME_LOCALES  = 'Locales';
var SHEET_NAME_USUARIOS = 'Usuarios';
var DRIVE_FOLDER_ID     = '1exfPULplLmLfERPLKCSoUC0C_WmQg7Qi';

var COLS = {
  NRO: 1, LINEA: 2, ESTACION: 3, LOCAL: 4, ARRENDATARIO: 5,
  STATUS: 6, CONTRATO: 7, INICIO: 8, FIN: 9,
  AREA: 10, MTS_USD: 11, MONTO: 12, OBSERVACIONES: 13, FOTOS: 14,
  CONTINGENCIA: 15, PRECIO_FINAL: 16
};

var UCOLS = { EMAIL: 1, NOMBRE: 2, ROL: 3, PASSWORD: 4 };

// ============================================================
// PUNTO DE ENTRADA HTTP
// ============================================================
function doGet(e) {
  var params = e.parameter || {};
  var action = params.action || '';
  var result;
  try {
    if      (action === 'getLocales')      result = getLocales(params);
    else if (action === 'getLocal')        result = getLocal(params.nro);
    else if (action === 'login')           result = login(params.email, params.password);
    else if (action === 'getUsuarios')     result = getUsuarios(params.email);
    else result = { error: 'Acción no reconocida: ' + action };
  } catch(err) { result = { error: err.message }; }
  return output(result);
}

function doPost(e) {
  var body, action, result;
  try {
    body   = JSON.parse(e.postData.contents);
    action = body.action || '';
    if      (action === 'addLocal')      result = addLocal(body.data, body.email);
    else if (action === 'updateLocal')   result = updateLocal(body.nro, body.data, body.email);
    else if (action === 'deleteLocal')   result = deleteLocal(body.nro, body.email);
    else if (action === 'uploadFoto')    result = uploadFoto(body.nro, body.base64, body.fileName, body.email);
    else if (action === 'deleteFoto')    result = deleteFoto(body.nro, body.url, body.email);
    else if (action === 'addUsuario')    result = addUsuario(body.data, body.email);
    else if (action === 'updateUsuario') result = updateUsuario(body.targetEmail, body.data, body.email);
    else if (action === 'deleteUsuario') result = deleteUsuario(body.targetEmail, body.email);
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
    data.monto||'', data.observaciones||'', '']);
  return { ok: true, nro: nroNuevo };
}

function updateLocal(nro, data, email) {
  verificarAdmin(email);
  var sheet  = getSheet(SHEET_NAME_LOCALES);
  var rowNum = buscarNumFila(sheet, Number(nro));
  if (!rowNum) return { error: 'Registro no encontrado' };
  var campos = { linea: COLS.LINEA, estacion: COLS.ESTACION, local: COLS.LOCAL,
    arrendatario: COLS.ARRENDATARIO, status: COLS.STATUS, contrato: COLS.CONTRATO,
    inicio: COLS.INICIO, fin: COLS.FIN, area: COLS.AREA,
    mts_usd: COLS.MTS_USD, monto: COLS.MONTO, observaciones: COLS.OBSERVACIONES,
    contingencia: COLS.CONTINGENCIA, precio_final: COLS.PRECIO_FINAL };
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
  }
  return sheet;
}

function rowToObject(row) {
  var fotos = row[COLS.FOTOS - 1] ? String(row[COLS.FOTOS - 1]).split(',') : [];
  return {
    nro: row[0], linea: row[1], estacion: row[2], local: row[3],
    arrendatario: row[4], status: row[5], contrato: row[6],
    inicio: row[7], fin: row[8], area: row[9], mts_usd: row[10],
    monto: row[11], observaciones: row[12], fotos: fotos,
    contingencia: row[14] || 0, precio_final: row[15] || ''
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
  // Agregar contraseña al admin existente si no tiene
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (!data[i][3]) sheet.getRange(i + 1, 4).setValue('cambiar123');
  }
  Logger.log('✅ Columna PASSWORD agregada');
}
