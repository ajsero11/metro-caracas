const API = 'https://script.google.com/macros/s/AKfycbw4-7lAvwQfXgPkgT-A6JkphmRGOvtlKHSZeh5ylZvSizFUs3hD_YMzKEYZ7Sk6W6n1/exec';

let usuarioActual = null;
let todosLosLocales = [];
let localActual = null;

// ============================================================
// LOGIN
// ============================================================
function login() {
  const email = document.getElementById('login-email').value.trim().toLowerCase();
  const errEl = document.getElementById('login-error');
  errEl.textContent = '';

  if (!email || !email.includes('@')) {
    errEl.textContent = 'Ingresa un correo válido';
    return;
  }

  document.getElementById('btn-login').textContent = 'Verificando...';
  document.getElementById('btn-login').disabled = true;

  apiGet({ action: 'getUsuario', email })
    .then(res => {
      if (res.error) throw new Error(res.error);
      usuarioActual = res;
      localStorage.setItem('usuario', JSON.stringify(res));
      mostrarApp();
    })
    .catch(err => {
      errEl.textContent = 'Error al conectar. Verifica tu conexión.';
      document.getElementById('btn-login').textContent = 'Entrar';
      document.getElementById('btn-login').disabled = false;
    });
}

function cerrarSesion() {
  localStorage.removeItem('usuario');
  usuarioActual = null;
  todosLosLocales = [];
  mostrarLogin();
}

function mostrarLogin() {
  document.getElementById('login-screen').classList.add('active');
  document.getElementById('app-screen').classList.remove('active');
}

function mostrarApp() {
  document.getElementById('login-screen').classList.remove('active');
  document.getElementById('app-screen').classList.add('active');

  document.getElementById('user-nombre').textContent = usuarioActual.nombre || usuarioActual.email;
  const badge = document.getElementById('user-rol-badge');
  badge.textContent = usuarioActual.rol === 'admin' ? 'Admin' : 'Usuario';
  badge.className = 'badge ' + (usuarioActual.rol === 'admin' ? 'badge-ARRENDADO' : 'badge-DISPONIBLE');

  if (usuarioActual.rol === 'admin') {
    document.getElementById('btn-nuevo').style.display = 'inline-block';
    document.getElementById('modal-acciones-admin').style.display = 'flex';
  }

  cargarLocales();
  llenarFiltroEstaciones();
}

// ============================================================
// CARGA DE DATOS
// ============================================================
function cargarLocales() {
  mostrarLoading(true);
  apiGet({ action: 'getLocales' })
    .then(res => {
      if (res.error) throw new Error(res.error);
      todosLosLocales = res.locales || [];
      renderLista(todosLosLocales);
      mostrarLoading(false);
    })
    .catch(err => {
      mostrarLoading(false);
      document.getElementById('lista-locales').innerHTML =
        '<p style="color:red;padding:20px">Error al cargar datos: ' + err.message + '</p>';
    });
}

function llenarFiltroEstaciones() {
  apiGet({ action: 'getLocales' }).then(res => {
    if (!res.locales) return;
    const estaciones = [...new Set(res.locales.map(l => l.estacion))].sort();
    const sel = document.getElementById('filtro-estacion');
    estaciones.forEach(e => {
      const opt = document.createElement('option');
      opt.value = e;
      opt.textContent = e;
      sel.appendChild(opt);
    });
  });
}

// ============================================================
// FILTROS
// ============================================================
function filtrar() {
  const buscar   = document.getElementById('filtro-buscar').value.toUpperCase();
  const linea    = document.getElementById('filtro-linea').value;
  const estacion = document.getElementById('filtro-estacion').value.toUpperCase();
  const status   = document.getElementById('filtro-status').value.toUpperCase();

  const filtrados = todosLosLocales.filter(l => {
    if (linea    && String(l.linea) !== linea) return false;
    if (estacion && l.estacion.toUpperCase() !== estacion) return false;
    if (status   && l.status.toUpperCase() !== status) return false;
    if (buscar) {
      const texto = (l.arrendatario + ' ' + l.local + ' ' + l.estacion).toUpperCase();
      if (!texto.includes(buscar)) return false;
    }
    return true;
  });

  renderLista(filtrados);
}

// ============================================================
// RENDER
// ============================================================
function renderLista(locales) {
  const container = document.getElementById('lista-locales');
  document.getElementById('total-registros').textContent =
    locales.length + ' registros encontrados de ' + todosLosLocales.length + ' totales';

  if (locales.length === 0) {
    container.innerHTML = '<p style="color:#5f6368;padding:40px;text-align:center">No se encontraron registros</p>';
    return;
  }

  container.innerHTML = locales.map(l => cardHTML(l)).join('');
}

function cardHTML(l) {
  const statusClass = 'badge-' + l.status.replace(/\s+/g, '-').replace(/[ÉÁÍÓÚéáíóú]/g, c =>
    ({É:'E',Á:'A',Í:'I',Ó:'O',Ú:'U',é:'E',á:'A',í:'I',ó:'O',ú:'U'}[c]||c));

  const fotoHTML = l.fotos && l.fotos.length > 0
    ? `<div class="card-foto"><img src="${driveThumb(l.fotos[0])}" loading="lazy" onerror="this.parentElement.innerHTML='📷'"></div>`
    : `<div class="card-foto-placeholder">📷</div>`;

  const monto = l.monto ? '$ ' + Number(l.monto).toLocaleString('es-VE', {minimumFractionDigits:2}) : '—';

  return `
    <div class="card" onclick="abrirDetalle(${l.nro})">
      ${fotoHTML}
      <div class="card-body">
        <div class="card-top">
          <span class="card-local">${l.local || '—'}</span>
          <span class="badge ${statusClass}">${l.status}</span>
        </div>
        <div class="card-estacion">Línea ${l.linea} — ${l.estacion}</div>
        <div class="card-arrendatario">${l.arrendatario || 'Sin inquilino'}</div>
        <div class="card-footer">
          <span class="card-monto">${monto}/mes</span>
          <span style="font-size:11px;color:#5f6368">${l.area ? l.area + ' m²' : ''}</span>
        </div>
      </div>
    </div>`;
}

function driveThumb(url) {
  const match = url.match(/\/d\/([^/]+)\//);
  return match ? 'https://drive.google.com/thumbnail?id=' + match[1] + '&sz=w400' : url;
}

function badgeClass(status) {
  return 'badge badge-' + (status || '').replace(/\s+/g, '-')
    .normalize('NFD').replace(/[̀-ͯ]/g, '');
}

// ============================================================
// MODAL DETALLE
// ============================================================
function abrirDetalle(nro) {
  const l = todosLosLocales.find(x => x.nro === nro);
  if (!l) return;
  localActual = l;

  document.getElementById('det-local').textContent = l.local || '—';
  document.getElementById('det-estacion-linea').textContent = 'Línea ' + l.linea + ' — ' + l.estacion;
  document.getElementById('det-arrendatario').textContent = l.arrendatario || 'Sin inquilino';
  document.getElementById('det-contrato').textContent = l.contrato || '—';
  document.getElementById('det-inicio').textContent = formatFecha(l.inicio);
  document.getElementById('det-fin').textContent = formatFecha(l.fin);
  document.getElementById('det-area').textContent = l.area ? l.area + ' m²' : '—';
  document.getElementById('det-mts').textContent = l.mts_usd ? '$ ' + l.mts_usd : '—';
  document.getElementById('det-monto').textContent = l.monto ? '$ ' + Number(l.monto).toLocaleString('es-VE', {minimumFractionDigits:2}) : '—';
  document.getElementById('det-obs').textContent = l.observaciones || '—';

  const statusBadge = document.getElementById('det-status-badge');
  statusBadge.textContent = l.status;
  statusBadge.className = badgeClass(l.status);

  renderGaleria(l.fotos || []);
  document.getElementById('input-foto').dataset.nro = nro;

  if (usuarioActual.rol === 'admin') {
    document.getElementById('modal-acciones-admin').style.display = 'flex';
  }

  document.getElementById('modal-detalle').classList.add('active');
}

function renderGaleria(fotos) {
  const galeria = document.getElementById('galeria');
  const empty   = document.getElementById('galeria-empty');

  if (!fotos || fotos.length === 0) {
    galeria.innerHTML = '';
    empty.style.display = 'block';
    return;
  }

  empty.style.display = 'none';
  galeria.innerHTML = fotos.map(url =>
    `<img src="${driveThumb(url)}" onclick="window.open('${url}','_blank')" title="Ver foto completa">`
  ).join('');
}

function cerrarModalDetalle() {
  document.getElementById('modal-detalle').classList.remove('active');
  localActual = null;
}

function cerrarModal(e) {
  if (e.target === e.currentTarget) cerrarModalDetalle();
}

// ============================================================
// SUBIR FOTO
// ============================================================
function subirFoto() {
  const input = document.getElementById('input-foto');
  const file  = input.files[0];
  if (!file || !localActual) return;

  const progress = document.getElementById('upload-progress');
  progress.style.display = 'block';

  const reader = new FileReader();
  reader.onload = function(e) {
    const base64 = e.target.result.split(',')[1];
    apiPost({
      action: 'uploadFoto',
      nro: localActual.nro,
      base64: base64,
      fileName: file.name,
      email: usuarioActual.email
    }).then(res => {
      progress.style.display = 'none';
      input.value = '';
      if (res.error) { alert('Error: ' + res.error); return; }

      // Actualizar la galería localmente
      if (!localActual.fotos) localActual.fotos = [];
      localActual.fotos.push(res.url);
      renderGaleria(localActual.fotos);

      // Actualizar en la lista principal
      const idx = todosLosLocales.findIndex(l => l.nro === localActual.nro);
      if (idx !== -1) todosLosLocales[idx].fotos = localActual.fotos;
    }).catch(err => {
      progress.style.display = 'none';
      alert('Error al subir: ' + err.message);
    });
  };
  reader.readAsDataURL(file);
}

// ============================================================
// FORMULARIO (ADMIN)
// ============================================================
function abrirFormulario(local) {
  document.getElementById('form-titulo').textContent = local ? 'Editar Local' : 'Nuevo Local';
  document.getElementById('form-error').textContent = '';

  document.getElementById('f-linea').value        = local ? local.linea        : '1';
  document.getElementById('f-estacion').value     = local ? local.estacion     : '';
  document.getElementById('f-local').value        = local ? local.local        : '';
  document.getElementById('f-status').value       = local ? local.status       : 'DISPONIBLE';
  document.getElementById('f-arrendatario').value = local ? local.arrendatario : '';
  document.getElementById('f-contrato').value     = local ? local.contrato     : '';
  document.getElementById('f-inicio').value       = local ? fechaInput(local.inicio) : '';
  document.getElementById('f-fin').value          = local ? fechaInput(local.fin)    : '';
  document.getElementById('f-area').value         = local ? local.area         : '';
  document.getElementById('f-mts').value          = local ? local.mts_usd      : '';
  document.getElementById('f-monto').value        = local ? local.monto        : '';
  document.getElementById('f-obs').value          = local ? local.observaciones : '';

  document.getElementById('modal-form').dataset.nro = local ? local.nro : '';
  document.getElementById('modal-form').classList.add('active');
}

function editarDesdeModal() {
  if (!localActual) return;
  cerrarModalDetalle();
  abrirFormulario(localActual);
}

function cerrarModalForm(e) {
  if (!e || e.target === e.currentTarget) {
    document.getElementById('modal-form').classList.remove('active');
  }
}

function guardarFormulario() {
  const nro  = document.getElementById('modal-form').dataset.nro;
  const data = {
    linea:         document.getElementById('f-linea').value,
    estacion:      document.getElementById('f-estacion').value.trim(),
    local:         document.getElementById('f-local').value.trim(),
    status:        document.getElementById('f-status').value,
    arrendatario:  document.getElementById('f-arrendatario').value.trim(),
    contrato:      document.getElementById('f-contrato').value.trim(),
    inicio:        document.getElementById('f-inicio').value,
    fin:           document.getElementById('f-fin').value,
    area:          document.getElementById('f-area').value,
    mts_usd:       document.getElementById('f-mts').value,
    monto:         document.getElementById('f-monto').value,
    observaciones: document.getElementById('f-obs').value.trim(),
  };

  if (!data.estacion || !data.local) {
    document.getElementById('form-error').textContent = 'Estación y Local son obligatorios';
    return;
  }

  const action = nro ? 'updateLocal' : 'addLocal';
  const body   = { action, data, email: usuarioActual.email };
  if (nro) body.nro = Number(nro);

  apiPost(body).then(res => {
    if (res.error) { document.getElementById('form-error').textContent = res.error; return; }
    cerrarModalForm();
    cargarLocales();
  }).catch(err => {
    document.getElementById('form-error').textContent = err.message;
  });
}

function eliminarDesdeModal() {
  if (!localActual) return;
  if (!confirm('¿Eliminar el local ' + localActual.local + '? Esta acción no se puede deshacer.')) return;

  apiPost({ action: 'deleteLocal', nro: localActual.nro, email: usuarioActual.email })
    .then(res => {
      if (res.error) { alert('Error: ' + res.error); return; }
      cerrarModalDetalle();
      cargarLocales();
    });
}

// ============================================================
// API HELPERS
// ============================================================
function apiGet(params) {
  const qs = new URLSearchParams(params).toString();
  return fetch(API + '?' + qs).then(r => r.json());
}

function apiPost(body) {
  return fetch(API, {
    method: 'POST',
    body: JSON.stringify(body)
  }).then(r => r.json());
}

// ============================================================
// UTILIDADES
// ============================================================
function formatFecha(val) {
  if (!val) return '—';
  if (typeof val === 'number') {
    // Serial de Excel → fecha
    const d = new Date((val - 25569) * 86400 * 1000);
    return d.toLocaleDateString('es-VE');
  }
  return val;
}

function fechaInput(val) {
  if (!val) return '';
  if (typeof val === 'number') {
    const d = new Date((val - 25569) * 86400 * 1000);
    return d.toISOString().split('T')[0];
  }
  return val;
}

function mostrarLoading(activo) {
  document.getElementById('loading').classList.toggle('active', activo);
  document.getElementById('lista-locales').style.display = activo ? 'none' : 'grid';
}

// ============================================================
// INICIO
// ============================================================
window.addEventListener('DOMContentLoaded', () => {
  const guardado = localStorage.getItem('usuario');
  if (guardado) {
    try {
      usuarioActual = JSON.parse(guardado);
      mostrarApp();
    } catch { mostrarLogin(); }
  } else {
    mostrarLogin();
  }

  // Enter en login
  document.getElementById('login-email').addEventListener('keydown', e => {
    if (e.key === 'Enter') login();
  });
});
