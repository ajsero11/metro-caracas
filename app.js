const API = 'https://script.google.com/macros/s/AKfycbw4-7lAvwQfXgPkgT-A6JkphmRGOvtlKHSZeh5ylZvSizFUs3hD_YMzKEYZ7Sk6W6n1/exec';

let usuarioActual = null;
let todosLosLocales = [];
let localActual = null;
let usuarioEditando = null; // email del usuario que se está editando

// ============================================================
// LOGIN
// ============================================================
function login() {
  const email    = document.getElementById('login-email').value.trim().toLowerCase();
  const password = document.getElementById('login-password').value.trim();
  const errEl    = document.getElementById('login-error');
  errEl.textContent = '';

  if (!email || !email.includes('@')) { errEl.textContent = 'Ingresa un correo válido'; return; }
  if (!password) { errEl.textContent = 'Ingresa tu contraseña'; return; }

  const btn = document.getElementById('btn-login');
  btn.textContent = 'Verificando...';
  btn.disabled = true;

  apiGet({ action: 'login', email, password })
    .then(res => {
      if (res.error) throw new Error(res.error);
      usuarioActual = res;
      localStorage.setItem('usuario', JSON.stringify(res));
      mostrarApp();
    })
    .catch(err => {
      errEl.textContent = err.message || 'Error al conectar';
      btn.textContent = 'Entrar';
      btn.disabled = false;
    });
}

function cerrarSesion() {
  localStorage.removeItem('usuario');
  usuarioActual = null;
  todosLosLocales = [];
  document.getElementById('login-email').value = '';
  document.getElementById('login-password').value = '';
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
  const esAdmin = usuarioActual.rol === 'admin';
  badge.textContent = esAdmin ? 'Admin' : 'Usuario';
  badge.className = 'badge ' + (esAdmin ? 'badge-ARRENDADO' : 'badge-DISPONIBLE');

  // Mostrar u ocultar elementos exclusivos de admin
  document.getElementById('btn-nuevo').style.display    = esAdmin ? 'inline-block' : 'none';
  document.getElementById('btn-usuarios').style.display = esAdmin ? 'inline-block' : 'none';

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
    // Limpiar opciones anteriores (menos la primera)
    while (sel.options.length > 1) sel.remove(1);
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
  document.getElementById('det-obs').value = l.observaciones || '';
  document.getElementById('obs-msg').textContent = '';
  document.getElementById('obs-msg').style.color = '';

  const statusBadge = document.getElementById('det-status-badge');
  statusBadge.textContent = l.status;
  statusBadge.className = badgeClass(l.status);

  renderGaleria(l.fotos || []);
  document.getElementById('input-foto').dataset.nro = nro;
  document.getElementById('input-foto-nombre').value = '';

  const accionesAdmin = document.getElementById('modal-acciones-admin');
  accionesAdmin.style.display = usuarioActual.rol === 'admin' ? 'flex' : 'none';

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
  const esAdmin = usuarioActual && usuarioActual.rol === 'admin';

  galeria.innerHTML = fotos.map((url, idx) => `
    <div class="foto-item">
      <img src="${driveThumb(url)}" onclick="window.open('${url}','_blank')" title="Ver foto completa">
      ${esAdmin ? `<button class="btn-eliminar-foto" onclick="eliminarFoto(${idx})" title="Eliminar foto">🗑️</button>` : ''}
    </div>
  `).join('');
}

function eliminarFoto(idx) {
  if (!localActual) return;
  if (!confirm('¿Eliminar esta foto? No se puede deshacer.')) return;

  const url = localActual.fotos[idx];

  apiPost({
    action: 'deleteFoto',
    nro: localActual.nro,
    url: url,
    email: usuarioActual.email
  }).then(res => {
    if (res.error) { alert('Error: ' + res.error); return; }
    localActual.fotos = res.fotos;
    renderGaleria(localActual.fotos);
    // Actualizar lista principal
    const i = todosLosLocales.findIndex(l => l.nro === localActual.nro);
    if (i !== -1) todosLosLocales[i].fotos = localActual.fotos;
  }).catch(err => alert('Error: ' + err.message));
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
  const input    = document.getElementById('input-foto');
  const file     = input.files[0];
  const nombreEl = document.getElementById('input-foto-nombre');
  if (!file || !localActual) return;

  // Construir nombre: ESTACION_nombreDescriptivo.ext
  const estacion   = (localActual.estacion || 'LOCAL').toUpperCase().replace(/\s+/g, '_');
  const nombreDesc = (nombreEl.value.trim() || 'foto').replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_\-áéíóúÁÉÍÓÚñÑ]/g, '');
  const ext        = file.name.split('.').pop().toLowerCase();
  const fileName   = estacion + '_' + nombreDesc + '.' + ext;

  const progress = document.getElementById('upload-progress');
  progress.style.display = 'block';

  const reader = new FileReader();
  reader.onload = function(e) {
    const base64 = e.target.result.split(',')[1];
    apiPost({
      action: 'uploadFoto',
      nro: localActual.nro,
      base64: base64,
      fileName: fileName,
      email: usuarioActual.email
    }).then(res => {
      progress.style.display = 'none';
      input.value = '';
      nombreEl.value = '';
      if (res.error) { alert('Error: ' + res.error); return; }

      if (!localActual.fotos) localActual.fotos = [];
      localActual.fotos.push(res.url);
      renderGaleria(localActual.fotos);

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
// GUARDAR OBSERVACIONES DESDE MODAL DETALLE
// ============================================================
function guardarObservaciones() {
  if (!localActual) return;
  const obs   = document.getElementById('det-obs').value.trim();
  const msg   = document.getElementById('obs-msg');
  const btn   = document.getElementById('btn-guardar-obs');

  btn.disabled = true;
  btn.textContent = 'Guardando...';
  msg.textContent = '';

  apiPost({
    action: 'updateLocal',
    nro: localActual.nro,
    data: { observaciones: obs },
    email: usuarioActual.email
  }).then(res => {
    btn.disabled = false;
    btn.textContent = '💾 Guardar observaciones';
    if (res.error) {
      msg.style.color = 'var(--danger)';
      msg.textContent = res.error;
      return;
    }
    localActual.observaciones = obs;
    const idx = todosLosLocales.findIndex(l => l.nro === localActual.nro);
    if (idx !== -1) todosLosLocales[idx].observaciones = obs;
    msg.style.color = 'var(--success)';
    msg.textContent = '✓ Guardado';
    setTimeout(() => { msg.textContent = ''; }, 2000);
  }).catch(err => {
    btn.disabled = false;
    btn.textContent = '💾 Guardar observaciones';
    msg.style.color = 'var(--danger)';
    msg.textContent = err.message;
  });
}

// ============================================================
// FORMULARIO LOCAL (ADMIN)
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
// GESTIÓN DE USUARIOS (solo admin)
// ============================================================
function abrirGestionUsuarios() {
  document.getElementById('form-usuario').style.display = 'none';
  document.getElementById('usuario-error').textContent = '';
  document.getElementById('usuarios-lista').innerHTML = '';
  document.getElementById('modal-usuarios').classList.add('active');
}

function cerrarModalUsuarios(e) {
  if (!e || e.target === e.currentTarget) {
    document.getElementById('modal-usuarios').classList.remove('active');
  }
}

function cargarListaUsuarios() {
  const lista = document.getElementById('usuarios-lista');
  const btn   = document.getElementById('btn-ver-usuarios');
  lista.innerHTML = '<p style="color:var(--text-muted);font-size:13px">⏳ Cargando usuarios...</p>';
  if (btn) { btn.disabled = true; btn.textContent = 'Cargando...'; }

  apiGet({ action: 'getUsuarios', email: usuarioActual.email })
    .then(res => {
      if (res.error) { lista.innerHTML = '<p style="color:red">' + res.error + '</p>'; return; }
      if (!res.usuarios || res.usuarios.length === 0) {
        lista.innerHTML = '<p style="color:var(--text-muted);font-size:13px">No hay usuarios</p>';
        return;
      }

      // Guardar lista en memoria para editar sin pasar datos por onclick
      window._usuariosList = res.usuarios;
      lista.innerHTML = res.usuarios.map((u, idx) => `
        <div class="usuario-row">
          <div class="usuario-info">
            <span class="usuario-nombre">${u.nombre || '—'}</span>
            <span class="usuario-email">${u.email}</span>
            <span class="usuario-pass">🔑 ${u.password}</span>
          </div>
          <div class="usuario-badges">
            <span class="badge ${u.rol === 'admin' ? 'badge-ARRENDADO' : 'badge-DISPONIBLE'}">${u.rol}</span>
          </div>
          <div class="usuario-acciones">
            <button class="btn-icon" onclick="mostrarFormUsuarioIdx(${idx})">✏️</button>
            <button class="btn-icon btn-icon-danger" onclick="eliminarUsuario('${u.email}')">🗑️</button>
          </div>
        </div>
      `).join('');
    })
    .catch(err => {
      lista.innerHTML = '<p style="color:red">⚠️ Error: ' + err.message + '</p>';
    })
    .finally(() => {
      if (btn) { btn.disabled = false; btn.textContent = '👁 Ver / Editar Usuarios'; }
    });
}

function mostrarFormUsuario(emailEditar, nombre, rol, password) {
  usuarioEditando = emailEditar || null;

  document.getElementById('form-usuario-titulo').textContent = emailEditar ? 'Editar Usuario' : 'Nuevo Usuario';
  document.getElementById('u-email').value    = emailEditar || '';
  document.getElementById('u-email').disabled = !!emailEditar; // no se puede cambiar el email
  document.getElementById('u-nombre').value   = nombre   || '';
  document.getElementById('u-rol').value      = rol      || 'usuario';
  document.getElementById('u-password').value = password || '';
  document.getElementById('usuario-error').textContent = '';
  document.getElementById('form-usuario').style.display = 'block';
  document.getElementById('form-usuario').scrollIntoView({ behavior: 'smooth' });
}

function mostrarFormUsuarioIdx(idx) {
  const u = (window._usuariosList || [])[idx];
  if (!u) return;
  mostrarFormUsuario(u.email, u.nombre, u.rol, u.password);
}

function cancelarFormUsuario() {
  document.getElementById('form-usuario').style.display = 'none';
  usuarioEditando = null;
}

function guardarUsuario() {
  const email    = document.getElementById('u-email').value.trim().toLowerCase();
  const nombre   = document.getElementById('u-nombre').value.trim();
  const rol      = document.getElementById('u-rol').value;
  const password = document.getElementById('u-password').value.trim();
  const errEl    = document.getElementById('usuario-error');

  if (!email || !email.includes('@')) { errEl.textContent = 'Email inválido'; return; }
  if (!password) { errEl.textContent = 'La contraseña es obligatoria'; return; }

  const btnGuardar = document.getElementById('btn-guardar-usuario');
  errEl.textContent = '';
  btnGuardar.textContent = 'Guardando...';
  btnGuardar.disabled = true;

  const terminar = (err) => {
    btnGuardar.textContent = 'Guardar';
    btnGuardar.disabled = false;
    if (err) { errEl.textContent = err; return; }
    cancelarFormUsuario();
    // Recargar lista solo si ya estaba visible
    if (document.getElementById('usuarios-lista').innerHTML !== '') {
      cargarListaUsuarios();
    }
  };

  if (usuarioEditando) {
    apiPost({
      action: 'updateUsuario',
      targetEmail: usuarioEditando,
      data: { nombre, rol, password },
      email: usuarioActual.email
    }).then(res => terminar(res.error || null))
      .catch(err => terminar(err.message));
  } else {
    apiPost({
      action: 'addUsuario',
      data: { email, nombre, rol, password },
      email: usuarioActual.email
    }).then(res => terminar(res.error || null))
      .catch(err => terminar(err.message));
  }
}

function eliminarUsuario(emailTarget) {
  if (emailTarget === usuarioActual.email) {
    alert('No puedes eliminar tu propio usuario');
    return;
  }
  if (!confirm('¿Eliminar al usuario ' + emailTarget + '?')) return;

  apiPost({ action: 'deleteUsuario', targetEmail: emailTarget, email: usuarioActual.email })
    .then(res => {
      if (res.error) { alert('Error: ' + res.error); return; }
      cargarListaUsuarios();
    });
}

// ============================================================
// API HELPERS
// ============================================================
function fetchConTimeout(promesa, ms) {
  return Promise.race([
    promesa,
    new Promise((_, reject) => setTimeout(() => reject(new Error('Tiempo de espera agotado (timeout)')), ms))
  ]);
}

function apiGet(params) {
  const qs = new URLSearchParams(params).toString();
  return fetchConTimeout(fetch(API + '?' + qs).then(r => r.json()), 15000);
}

function apiPost(body) {
  return fetchConTimeout(fetch(API, {
    method: 'POST',
    body: JSON.stringify(body)
  }).then(r => r.json()), 15000);
}

// ============================================================
// UTILIDADES
// ============================================================
function formatFecha(val) {
  if (!val) return '—';
  if (typeof val === 'number') {
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

  document.getElementById('login-email').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('login-password').focus();
  });
  document.getElementById('login-password').addEventListener('keydown', e => {
    if (e.key === 'Enter') login();
  });
});
