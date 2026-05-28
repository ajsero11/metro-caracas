const API = 'https://script.google.com/macros/s/AKfycbw4-7lAvwQfXgPkgT-A6JkphmRGOvtlKHSZeh5ylZvSizFUs3hD_YMzKEYZ7Sk6W6n1/exec';

let usuarioActual   = null;
let todosLosLocales = [];
let localActual     = null;
let usuarioEditando = null;
let tabActual       = 'resumen';
let chartsInstancias = {};
let chartModalInst  = null;
let filtroContratosActual = 'todos';

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
  document.getElementById('login-email').value    = '';
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

  const nombre = usuarioActual.nombre || usuarioActual.email;
  document.getElementById('user-nombre').textContent  = nombre;
  document.getElementById('sidebar-nombre').textContent = nombre;
  document.getElementById('sidebar-email').textContent  = usuarioActual.email;

  const badge = document.getElementById('user-rol-badge');
  const esAdmin = usuarioActual.rol === 'admin';
  badge.textContent = esAdmin ? 'Admin' : 'Usuario';
  badge.className   = 'badge ' + (esAdmin ? 'badge-admin' : 'badge-usuario');

  // Controles admin
  document.getElementById('btn-nuevo').style.display    = esAdmin ? 'inline-block' : 'none';
  document.getElementById('btn-usuarios').style.display = esAdmin ? 'inline-block' : 'none';

  // Menú de admin (sidebar + bottom nav)
  document.querySelectorAll('.admin-only').forEach(el => {
    el.style.display = esAdmin ? (el.tagName === 'DIV' ? 'flex' : 'inline-block') : 'none';
  });
  // nav-items son divs flex
  ['nav-directorio','nav-contratos','nav-pagos','bnav-directorio','bnav-contratos','bnav-pagos'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = esAdmin ? 'flex' : 'none';
  });

  cargarLocales();
  llenarFiltroEstaciones();

  if (esAdmin) {
    cambiarTab('resumen');
  } else {
    cambiarTab('catalogo');
  }
}

// ============================================================
// NAVEGACIÓN POR PESTAÑAS
// ============================================================
const TABS = ['resumen','catalogo','directorio','contratos','pagos'];

function cambiarTab(tab) {
  tabActual = tab;
  TABS.forEach(t => {
    const panel  = document.getElementById('tab-' + t);
    const navSide = document.getElementById('nav-' + t);
    const navBot  = document.getElementById('bnav-' + t);
    if (panel)   panel.classList.toggle('active', t === tab);
    if (navSide) navSide.classList.toggle('active', t === tab);
    if (navBot)  navBot.classList.toggle('active', t === tab);
  });

  if (tab === 'resumen'    && todosLosLocales.length) renderResumen();
  if (tab === 'directorio') cargarDirectorio();
  if (tab === 'contratos')  renderContratos('todos');
  if (tab === 'pagos')      cargarPagos();
}

// ============================================================
// CARGA DE LOCALES
// ============================================================
function cargarLocales() {
  mostrarLoading(true);
  apiGet({ action: 'getLocales' })
    .then(res => {
      if (res.error) throw new Error(res.error);
      todosLosLocales = res.locales || [];
      renderLista(todosLosLocales);
      actualizarStatsCatalogo();
      mostrarLoading(false);
      if (tabActual === 'resumen') renderResumen();
      if (tabActual === 'contratos') renderContratos(filtroContratosActual);
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
    while (sel.options.length > 1) sel.remove(1);
    estaciones.forEach(e => {
      const opt = document.createElement('option');
      opt.value = e; opt.textContent = e;
      sel.appendChild(opt);
    });
  });
}

// ============================================================
// STATS CATÁLOGO
// ============================================================
function actualizarStatsCatalogo() {
  const total  = todosLosLocales.length;
  const arr    = todosLosLocales.filter(l => l.status === 'ARRENDADO').length;
  const disp   = todosLosLocales.filter(l => l.status === 'DISPONIBLE').length;
  const rec    = todosLosLocales.filter(l => l.status === 'EN RECUPERACIÓN').length;
  document.getElementById('cs-total').textContent      = total;
  document.getElementById('cs-arrendados').textContent = arr;
  document.getElementById('cs-disponibles').textContent = disp;
  document.getElementById('cs-recuperacion').textContent = rec;
}

// ============================================================
// RESUMEN INMOBILIARIO
// ============================================================
function renderResumen() {
  const locales = todosLosLocales;
  const total   = locales.length;
  const arr     = locales.filter(l => l.status === 'ARRENDADO').length;
  const disp    = locales.filter(l => l.status === 'DISPONIBLE').length;
  const rec     = locales.filter(l => l.status === 'EN RECUPERACIÓN').length;

  const ingresos = locales.reduce((sum, l) => {
    const monto = Number(l.precio_final) || Number(l.monto) || 0;
    return sum + monto;
  }, 0);

  document.getElementById('kpi-total').textContent         = total;
  document.getElementById('kpi-arrendados').textContent    = arr;
  document.getElementById('kpi-arrendados-pct').textContent = total ? Math.round(arr/total*100) + '% ocupación' : '';
  document.getElementById('kpi-disponibles').textContent   = disp;
  document.getElementById('kpi-disponibles-pct').textContent = total ? Math.round(disp/total*100) + '% libre' : '';
  document.getElementById('kpi-recuperacion').textContent  = rec;
  document.getElementById('kpi-ingresos').textContent      = '$ ' + ingresos.toLocaleString('es-VE', {minimumFractionDigits:2});
  document.getElementById('resumen-fecha').textContent     = 'Actualizado: ' + new Date().toLocaleDateString('es-VE', {weekday:'long',year:'numeric',month:'long',day:'numeric'});

  renderAlertas(locales);
  renderCharts(locales);
}

let _todasExpandidas = false;

function renderAlertas(locales) {
  const hoy = new Date(); hoy.setHours(0,0,0,0);
  const alertas = [];

  locales.forEach(l => {
    if (!l.fin || l.status !== 'ARRENDADO') return;
    const fin = fechaObj(l.fin); if (!fin) return;
    const dias = Math.round((fin - hoy) / 86400000);
    if (dias <= 30) alertas.push({ l, dias });
  });

  alertas.sort((a,b) => a.dias - b.dias);

  const countEl = document.getElementById('alertas-count');
  if (countEl) countEl.textContent = alertas.length;

  const el = document.getElementById('alertas-lista');
  if (alertas.length === 0) {
    el.innerHTML = '<div style="color:var(--text-muted);font-size:13px;padding:12px;">Sin alertas pendientes ✅</div>';
    return;
  }

  el.innerHTML = alertas.map(({l, dias}, idx) => {
    const clase     = dias < 0 ? 'alerta-roja' : dias <= 5 ? 'alerta-roja' : 'alerta-amarilla';
    const claseDias = dias <= 5 ? 'd-rojo' : 'd-amarillo';
    const texto     = dias < 0  ? 'Vencido hace ' + Math.abs(dias) + 'd'
                    : dias === 0 ? 'Vence HOY'
                    : 'Vence en ' + dias + 'd';
    return `
      <div class="alerta-item ${clase}" id="alerta-item-${idx}">
        <div class="alerta-header" onclick="toggleAlerta(${idx})">
          <span class="alerta-local">${l.local}</span>
          <span class="alerta-dias ${claseDias}">${texto}</span>
          <span class="alerta-chevron">▾</span>
        </div>
        <div class="alerta-detalle">
          <div><strong>Estación:</strong> ${l.estacion} — Línea ${l.linea}</div>
          <div><strong>Inquilino:</strong> ${l.arrendatario || 'Sin inquilino'}</div>
          <div><strong>Vencimiento:</strong> ${formatFecha(l.fin)}</div>
          ${l.contrato ? '<div><strong>Contrato:</strong> '+l.contrato+'</div>' : ''}
        </div>
      </div>`;
  }).join('');
}

function toggleAlerta(idx) {
  const item = document.getElementById('alerta-item-' + idx);
  if (item) item.classList.toggle('open');
}

function toggleTodasAlertas() {
  _todasExpandidas = !_todasExpandidas;
  document.querySelectorAll('.alerta-item').forEach(el => {
    el.classList.toggle('open', _todasExpandidas);
  });
  const btn = document.getElementById('btn-expandir-todo');
  if (btn) btn.textContent = _todasExpandidas ? 'Colapsar todo ▴' : 'Expandir todo ▾';
}

// ============================================================
// CHARTS
// ============================================================
const CHART_COLORS = ['#e31b23','#9ca3a8','#1f2124','#fbbf24','#34d399','#60a5fa','#a78bfa'];

function renderCharts(locales) {
  renderChartStatus(locales);
  renderChartVencimiento(locales);
  renderChartIngresos(locales);
  renderChartOcupacion(locales);
}

function crearOActualizarChart(id, config) {
  if (chartsInstancias[id]) {
    chartsInstancias[id].destroy();
    delete chartsInstancias[id];
  }
  const ctx = document.getElementById(id);
  if (!ctx) return null;
  chartsInstancias[id] = new Chart(ctx, config);
  return chartsInstancias[id];
}

function renderChartStatus(locales) {
  const grupos = {};
  locales.forEach(l => { grupos[l.status] = (grupos[l.status]||0) + 1; });
  const labels = Object.keys(grupos);
  const data   = Object.values(grupos);

  crearOActualizarChart('chart-status', {
    type: 'doughnut',
    data: { labels, datasets: [{ data, backgroundColor: CHART_COLORS, borderWidth: 2, borderColor: '#fff' }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom', labels: { font: { size: 11 }, padding: 8 } } }
    }
  });
}

function renderChartVencimiento(locales) {
  const hoy   = new Date(); hoy.setHours(0,0,0,0);
  const meses = {};
  for (let i = 0; i < 6; i++) {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() + i, 1);
    const key = d.toLocaleDateString('es-VE', {month:'short', year:'2-digit'});
    meses[key] = 0;
  }

  locales.forEach(l => {
    if (!l.fin || l.status !== 'ARRENDADO') return;
    const fin = fechaObj(l.fin);
    if (!fin) return;
    const dias = Math.round((fin - hoy)/86400000);
    if (dias < 0 || dias > 180) return;
    const key = fin.toLocaleDateString('es-VE', {month:'short', year:'2-digit'});
    if (key in meses) meses[key]++;
  });

  crearOActualizarChart('chart-vencimiento', {
    type: 'bar',
    data: {
      labels: Object.keys(meses),
      datasets: [{ label: 'Contratos', data: Object.values(meses), backgroundColor: '#e31b23', borderRadius: 6 }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
    }
  });
}

function renderChartIngresos(locales) {
  const ingresosPorLinea = {1:0, 2:0, 3:0, 4:0};
  locales.forEach(l => {
    const monto = Number(l.precio_final) || Number(l.monto) || 0;
    if (l.linea && ingresosPorLinea[l.linea] !== undefined) ingresosPorLinea[l.linea] += monto;
  });

  crearOActualizarChart('chart-ingresos', {
    type: 'bar',
    data: {
      labels: ['Línea 1','Línea 2','Línea 3','Línea 4'],
      datasets: [{ label: '$ Ingresos', data: Object.values(ingresosPorLinea), backgroundColor: CHART_COLORS.slice(0,4), borderRadius: 6 }]
    },
    options: {
      indexAxis: 'y', responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { x: { beginAtZero: true } }
    }
  });
}

function renderChartOcupacion(locales) {
  const m2Arr  = locales.filter(l => l.status==='ARRENDADO').reduce((s,l) => s + (Number(l.area)||0), 0);
  const m2Disp = locales.filter(l => l.status!=='ARRENDADO').reduce((s,l) => s + (Number(l.area)||0), 0);

  crearOActualizarChart('chart-ocupacion', {
    type: 'doughnut',
    data: {
      labels: ['Arrendados','Disponibles/Otros'],
      datasets: [{ data:[m2Arr, m2Disp], backgroundColor:['#16a34a','#e5e7eb'], borderWidth:2, borderColor:'#fff' }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position:'bottom', labels:{ font:{size:11}, padding:8 } } }
    }
  });
}

// ============================================================
// MODAL CHART AMPLIADO
// ============================================================
function abrirChartModal(tipo) {
  const modal = document.getElementById('modal-chart');
  modal.classList.add('active');

  if (chartModalInst) { chartModalInst.destroy(); chartModalInst = null; }

  const locales = todosLosLocales;
  const canvas  = document.getElementById('chart-modal-canvas');
  const title   = document.getElementById('chart-modal-title');
  const desc    = document.getElementById('chart-modal-desc');
  const tabla   = document.getElementById('chart-modal-tabla');
  tabla.innerHTML = '';

  if (tipo === 'status') {
    title.textContent = 'Distribución por Status';
    desc.textContent  = 'Total de locales agrupados por estado actual de ocupación.';
    const grupos = {};
    locales.forEach(l => { grupos[l.status] = (grupos[l.status]||0)+1; });
    chartModalInst = new Chart(canvas, {
      type:'doughnut',
      data:{ labels:Object.keys(grupos), datasets:[{ data:Object.values(grupos), backgroundColor:CHART_COLORS, borderWidth:2, borderColor:'#fff' }] },
      options:{ responsive:true, maintainAspectRatio:false, plugins:{ legend:{ position:'right' } } }
    });
    tabla.innerHTML = tablaHTML(['Status','Cantidad','%'], Object.entries(grupos).map(([k,v]) => [k, v, Math.round(v/locales.length*100)+'%']));
  }

  if (tipo === 'vencimiento') {
    title.textContent = 'Contratos por Vencer';
    desc.textContent  = 'Contratos activos que vencen en los próximos 6 meses.';
    const hoy=new Date(); hoy.setHours(0,0,0,0);
    const meses={};
    for(let i=0;i<6;i++){const d=new Date(hoy.getFullYear(),hoy.getMonth()+i,1); meses[d.toLocaleDateString('es-VE',{month:'short',year:'2-digit'})]=[];}
    locales.forEach(l=>{
      if(!l.fin||l.status!=='ARRENDADO') return;
      const fin=fechaObj(l.fin); if(!fin) return;
      const dias=Math.round((fin-hoy)/86400000);
      if(dias<0||dias>180) return;
      const key=fin.toLocaleDateString('es-VE',{month:'short',year:'2-digit'});
      if(key in meses) meses[key].push(l);
    });
    chartModalInst = new Chart(canvas, {
      type:'bar',
      data:{ labels:Object.keys(meses), datasets:[{ label:'Contratos', data:Object.values(meses).map(a=>a.length), backgroundColor:'#e31b23', borderRadius:6 }] },
      options:{ responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}}, scales:{y:{beginAtZero:true,ticks:{stepSize:1}}} }
    });
    const filas = Object.entries(meses).flatMap(([mes,arr]) => arr.map(l=>[l.local, l.estacion, l.arrendatario||'—', mes]));
    tabla.innerHTML = tablaHTML(['Local','Estación','Inquilino','Mes'], filas);
  }

  if (tipo === 'ingresos') {
    title.textContent = 'Ingresos por Línea';
    desc.textContent  = 'Suma de precios finales por línea de Metro.';
    const ing={1:0,2:0,3:0,4:0};
    locales.forEach(l=>{const m=Number(l.precio_final)||Number(l.monto)||0; if(ing[l.linea]!==undefined) ing[l.linea]+=m;});
    chartModalInst = new Chart(canvas, {
      type:'bar',
      data:{ labels:['Línea 1','Línea 2','Línea 3','Línea 4'], datasets:[{ data:Object.values(ing), backgroundColor:CHART_COLORS.slice(0,4), borderRadius:6 }] },
      options:{ indexAxis:'y', responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}}, scales:{x:{beginAtZero:true}} }
    });
    tabla.innerHTML = tablaHTML(['Línea','Ingresos $'], Object.entries(ing).map(([k,v])=>['Línea '+k,'$ '+v.toLocaleString('es-VE',{minimumFractionDigits:2})]));
  }

  if (tipo === 'ocupacion') {
    title.textContent = 'Metros Cuadrados';
    desc.textContent  = 'Distribución de m² entre locales arrendados y el resto.';
    const m2Arr  = locales.filter(l=>l.status==='ARRENDADO').reduce((s,l)=>s+(Number(l.area)||0),0);
    const m2Disp = locales.filter(l=>l.status!=='ARRENDADO').reduce((s,l)=>s+(Number(l.area)||0),0);
    chartModalInst = new Chart(canvas, {
      type:'doughnut',
      data:{ labels:['Arrendados','Otros'], datasets:[{ data:[m2Arr,m2Disp], backgroundColor:['#16a34a','#e5e7eb'], borderWidth:2, borderColor:'#fff' }] },
      options:{ responsive:true, maintainAspectRatio:false, plugins:{legend:{position:'right'}} }
    });
    tabla.innerHTML = tablaHTML(['Categoría','m²','%'], [
      ['Arrendados', m2Arr.toFixed(1), m2Arr+m2Disp?Math.round(m2Arr/(m2Arr+m2Disp)*100)+'%':'0%'],
      ['Otros',      m2Disp.toFixed(1), m2Arr+m2Disp?Math.round(m2Disp/(m2Arr+m2Disp)*100)+'%':'0%']
    ]);
  }
}

function cerrarModalChart(e) {
  if (!e || e.target === e.currentTarget) {
    document.getElementById('modal-chart').classList.remove('active');
    if (chartModalInst) { chartModalInst.destroy(); chartModalInst = null; }
  }
}

function tablaHTML(headers, filas) {
  return `<table class="chart-modal-table">
    <thead><tr>${headers.map(h=>`<th>${h}</th>`).join('')}</tr></thead>
    <tbody>${filas.map(f=>`<tr>${f.map(c=>`<td>${c}</td>`).join('')}</tr>`).join('')}</tbody>
  </table>`;
}

// ============================================================
// FILTROS CATÁLOGO
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
// RENDER LISTA LOCALES
// ============================================================
function renderLista(locales) {
  const container = document.getElementById('lista-locales');
  document.getElementById('total-registros').textContent =
    locales.length + ' registros encontrados de ' + todosLosLocales.length + ' totales';

  if (locales.length === 0) {
    container.innerHTML = '<p style="color:var(--text-muted);padding:40px;text-align:center">No se encontraron registros</p>';
    return;
  }
  container.innerHTML = locales.map(l => cardHTML(l)).join('');
}

function cardHTML(l) {
  const statusClass = 'badge-' + (l.status||'').replace(/\s+/g,'-')
    .normalize('NFD').replace(/[̀-ͯ]/g,'');

  const fotoHTML = l.fotos && l.fotos.length > 0
    ? `<div class="card-foto"><img src="${driveThumb(l.fotos[0])}" loading="lazy" onerror="this.parentElement.innerHTML='<div style=\\'display:flex;align-items:center;justify-content:center;height:140px;background:#e8eaed;font-size:36px;color:#bdc1c6\\'>📷</div>'"></div>`
    : `<div class="card-foto-placeholder">📷</div>`;

  const monto = l.monto ? '$ ' + Number(l.monto).toLocaleString('es-VE',{minimumFractionDigits:2}) : '—';

  return `
    <div class="card" onclick="abrirDetalle(${l.nro})">
      ${fotoHTML}
      <div class="card-body">
        <div class="card-top">
          <span class="card-local">${l.local||'—'}</span>
          <span class="badge ${statusClass}">${l.status}</span>
        </div>
        <div class="card-estacion">Línea ${l.linea} — ${l.estacion}</div>
        <div class="card-arrendatario">${l.arrendatario||'Sin inquilino'}</div>
        <div class="card-footer">
          <span class="card-monto">${monto}/mes</span>
          <span style="font-size:11px;color:var(--text-muted)">${l.area?l.area+' m²':''}</span>
        </div>
      </div>
    </div>`;
}

function driveThumb(url) {
  const match = url.match(/\/d\/([^/]+)\//);
  return match ? 'https://drive.google.com/thumbnail?id='+match[1]+'&sz=w400' : url;
}

function badgeClass(status) {
  return 'badge badge-'+(status||'').replace(/\s+/g,'-').normalize('NFD').replace(/[̀-ͯ]/g,'');
}

// ============================================================
// MODAL DETALLE
// ============================================================
function abrirDetalle(nro) {
  const l = todosLosLocales.find(x => x.nro === nro);
  if (!l) return;
  localActual = l;

  document.getElementById('det-local').textContent         = l.local||'—';
  document.getElementById('det-estacion-linea').textContent = 'Línea '+l.linea+' — '+l.estacion;
  document.getElementById('det-arrendatario').textContent  = l.arrendatario||'Sin inquilino';
  document.getElementById('det-contrato').textContent      = l.contrato||'—';
  document.getElementById('det-inicio').textContent        = formatFecha(l.inicio);
  document.getElementById('det-fin').textContent           = formatFecha(l.fin);
  document.getElementById('det-area').textContent          = l.area?l.area+' m²':'—';
  document.getElementById('det-mts').textContent           = l.mts_usd?'$ '+l.mts_usd:'—';

  const monto        = Number(l.monto)||0;
  const contingencia = Number(l.contingencia)||0;
  const precioFinal  = contingencia>0 ? monto-(monto*contingencia/100) : monto;
  document.getElementById('det-monto').textContent       = monto?'$ '+monto.toLocaleString('es-VE',{minimumFractionDigits:2}):'—';
  document.getElementById('det-contingencia').textContent = contingencia?contingencia+'%':'—';
  document.getElementById('det-precio-final').textContent = monto?'$ '+precioFinal.toLocaleString('es-VE',{minimumFractionDigits:2}):'—';

  const panelPrecios = document.getElementById('panel-precios');
  const esAdmin = usuarioActual && usuarioActual.rol==='admin';
  if (esAdmin) {
    panelPrecios.style.display = 'block';
    document.getElementById('edit-monto').value        = monto||'';
    document.getElementById('edit-contingencia').value = contingencia||'';
    calcularPrecioFinal();
  } else {
    panelPrecios.style.display = 'none';
  }

  document.getElementById('det-obs').value       = l.observaciones||'';
  document.getElementById('obs-msg').textContent = '';
  document.getElementById('obs-msg').style.color = '';

  const sb = document.getElementById('det-status-badge');
  sb.textContent = l.status;
  sb.className   = badgeClass(l.status);

  renderGaleria(l.fotos||[]);
  document.getElementById('input-foto').dataset.nro  = nro;
  document.getElementById('input-foto-nombre').value = '';
  document.getElementById('modal-acciones-admin').style.display = esAdmin?'flex':'none';
  document.getElementById('modal-detalle').classList.add('active');
}

function renderGaleria(fotos) {
  const galeria = document.getElementById('galeria');
  const empty   = document.getElementById('galeria-empty');
  if (!fotos||fotos.length===0) { galeria.innerHTML=''; empty.style.display='block'; return; }
  empty.style.display='none';
  const esAdmin = usuarioActual&&usuarioActual.rol==='admin';
  galeria.innerHTML = fotos.map((url,idx)=>`
    <div class="foto-item">
      <img src="${driveThumb(url)}" onclick="window.open('${url}','_blank')" title="Ver foto completa">
      ${esAdmin?`<button class="btn-eliminar-foto" onclick="eliminarFoto(${idx})" title="Eliminar foto">🗑️</button>`:''}
    </div>`).join('');
}

function eliminarFoto(idx) {
  if (!localActual) return;
  if (!confirm('¿Eliminar esta foto? No se puede deshacer.')) return;
  const url = localActual.fotos[idx];
  apiPost({ action:'deleteFoto', nro:localActual.nro, url, email:usuarioActual.email })
    .then(res => {
      if (res.error) { alert('Error: '+res.error); return; }
      localActual.fotos = res.fotos;
      renderGaleria(localActual.fotos);
      const i = todosLosLocales.findIndex(l=>l.nro===localActual.nro);
      if (i!==-1) todosLosLocales[i].fotos = localActual.fotos;
    }).catch(err=>alert('Error: '+err.message));
}

function cerrarModalDetalle() { document.getElementById('modal-detalle').classList.remove('active'); localActual=null; }
function cerrarModal(e) { if (e.target===e.currentTarget) cerrarModalDetalle(); }

// ============================================================
// SUBIR FOTO
// ============================================================
function subirFoto() {
  const input    = document.getElementById('input-foto');
  const file     = input.files[0];
  const nombreEl = document.getElementById('input-foto-nombre');
  if (!file||!localActual) return;

  const estacion   = (localActual.estacion||'LOCAL').toUpperCase().replace(/\s+/g,'_');
  const nombreDesc = (nombreEl.value.trim()||'foto').replace(/\s+/g,'_').replace(/[^a-zA-Z0-9_\-áéíóúÁÉÍÓÚñÑ]/g,'');
  const ext        = file.name.split('.').pop().toLowerCase();
  const fileName   = estacion+'_'+nombreDesc+'.'+ext;

  const progress = document.getElementById('upload-progress');
  progress.style.display = 'block';

  const reader = new FileReader();
  reader.onload = function(e) {
    const base64 = e.target.result.split(',')[1];
    apiPost({ action:'uploadFoto', nro:localActual.nro, base64, fileName, email:usuarioActual.email })
      .then(res => {
        progress.style.display='none';
        input.value=''; nombreEl.value='';
        if (res.error) { alert('Error: '+res.error); return; }
        if (!localActual.fotos) localActual.fotos=[];
        localActual.fotos.push(res.url);
        renderGaleria(localActual.fotos);
        const idx = todosLosLocales.findIndex(l=>l.nro===localActual.nro);
        if (idx!==-1) todosLosLocales[idx].fotos = localActual.fotos;
      }).catch(err=>{ progress.style.display='none'; alert('Error al subir: '+err.message); });
  };
  reader.readAsDataURL(file);
}

// ============================================================
// OBSERVACIONES
// ============================================================
function guardarObservaciones() {
  if (!localActual) return;
  const obs = document.getElementById('det-obs').value.trim();
  const msg = document.getElementById('obs-msg');
  const btn = document.getElementById('btn-guardar-obs');
  btn.disabled=true; btn.textContent='Guardando...'; msg.textContent='';

  apiPost({ action:'updateLocal', nro:localActual.nro, data:{observaciones:obs}, email:usuarioActual.email })
    .then(res => {
      btn.disabled=false; btn.textContent='💾 Guardar observaciones';
      if (res.error) { msg.style.color='var(--danger)'; msg.textContent=res.error; return; }
      localActual.observaciones=obs;
      const idx=todosLosLocales.findIndex(l=>l.nro===localActual.nro);
      if(idx!==-1) todosLosLocales[idx].observaciones=obs;
      msg.style.color='var(--success)'; msg.textContent='✓ Guardado';
      setTimeout(()=>{ msg.textContent=''; },2000);
    }).catch(err=>{ btn.disabled=false; btn.textContent='💾 Guardar observaciones'; msg.style.color='var(--danger)'; msg.textContent=err.message; });
}

// ============================================================
// PRECIOS (solo admin)
// ============================================================
function calcularPrecioFinal() {
  const monto        = parseFloat(document.getElementById('edit-monto').value)||0;
  const contingencia = parseFloat(document.getElementById('edit-contingencia').value)||0;
  const final        = monto-(monto*contingencia/100);
  document.getElementById('edit-precio-final-calc').textContent = monto?'$ '+final.toLocaleString('es-VE',{minimumFractionDigits:2}):'—';
}

function guardarPrecios() {
  if (!localActual) return;
  const monto        = parseFloat(document.getElementById('edit-monto').value)||0;
  const contingencia = parseFloat(document.getElementById('edit-contingencia').value)||0;
  const precioFinal  = monto-(monto*contingencia/100);
  const msg = document.getElementById('precios-msg');
  const btn = document.getElementById('btn-guardar-precios');
  btn.disabled=true; btn.textContent='Guardando...'; msg.textContent='';

  apiPost({ action:'updateLocal', nro:localActual.nro, data:{monto,contingencia,precio_final:precioFinal}, email:usuarioActual.email })
    .then(res => {
      btn.disabled=false; btn.textContent='💾 Guardar precios';
      if (res.error) { msg.style.color='var(--danger)'; msg.textContent=res.error; return; }
      localActual.monto=monto; localActual.contingencia=contingencia; localActual.precio_final=precioFinal;
      const idx=todosLosLocales.findIndex(l=>l.nro===localActual.nro);
      if(idx!==-1){ todosLosLocales[idx].monto=monto; todosLosLocales[idx].contingencia=contingencia; todosLosLocales[idx].precio_final=precioFinal; }
      document.getElementById('det-monto').textContent        = '$ '+monto.toLocaleString('es-VE',{minimumFractionDigits:2});
      document.getElementById('det-contingencia').textContent = contingencia?contingencia+'%':'—';
      document.getElementById('det-precio-final').textContent = '$ '+precioFinal.toLocaleString('es-VE',{minimumFractionDigits:2});
      msg.style.color='var(--success)'; msg.textContent='✓ Guardado';
      setTimeout(()=>{ msg.textContent=''; },2000);
    }).catch(err=>{ btn.disabled=false; btn.textContent='💾 Guardar precios'; msg.style.color='var(--danger)'; msg.textContent=err.message; });
}

// ============================================================
// FORMULARIO LOCAL (ADMIN)
// ============================================================
function abrirFormulario(local) {
  document.getElementById('form-titulo').textContent = local?'Editar Local':'Nuevo Local';
  document.getElementById('form-error').textContent  = '';
  document.getElementById('f-linea').value        = local?local.linea:'1';
  document.getElementById('f-estacion').value     = local?local.estacion:'';
  document.getElementById('f-local').value        = local?local.local:'';
  document.getElementById('f-status').value       = local?local.status:'DISPONIBLE';
  document.getElementById('f-arrendatario').value = local?local.arrendatario:'';
  document.getElementById('f-contrato').value     = local?local.contrato:'';
  document.getElementById('f-inicio').value       = local?fechaInput(local.inicio):'';
  document.getElementById('f-fin').value          = local?fechaInput(local.fin):'';
  document.getElementById('f-area').value         = local?local.area:'';
  document.getElementById('f-mts').value          = local?local.mts_usd:'';
  document.getElementById('f-monto').value        = local?local.monto:'';
  document.getElementById('f-obs').value          = local?local.observaciones:'';
  document.getElementById('modal-form').dataset.nro = local?local.nro:'';
  document.getElementById('modal-form').classList.add('active');
}

function editarDesdeModal() { if(!localActual) return; cerrarModalDetalle(); abrirFormulario(localActual); }

function cerrarModalForm(e) { if(!e||e.target===e.currentTarget) document.getElementById('modal-form').classList.remove('active'); }

function guardarFormulario() {
  const nro  = document.getElementById('modal-form').dataset.nro;
  const data = {
    linea:document.getElementById('f-linea').value,
    estacion:document.getElementById('f-estacion').value.trim(),
    local:document.getElementById('f-local').value.trim(),
    status:document.getElementById('f-status').value,
    arrendatario:document.getElementById('f-arrendatario').value.trim(),
    contrato:document.getElementById('f-contrato').value.trim(),
    inicio:document.getElementById('f-inicio').value,
    fin:document.getElementById('f-fin').value,
    area:document.getElementById('f-area').value,
    mts_usd:document.getElementById('f-mts').value,
    monto:document.getElementById('f-monto').value,
    observaciones:document.getElementById('f-obs').value.trim()
  };
  if(!data.estacion||!data.local){ document.getElementById('form-error').textContent='Estación y Local son obligatorios'; return; }
  const action = nro?'updateLocal':'addLocal';
  const body   = {action,data,email:usuarioActual.email};
  if(nro) body.nro=Number(nro);
  apiPost(body).then(res=>{ if(res.error){document.getElementById('form-error').textContent=res.error;return;} cerrarModalForm(); cargarLocales(); })
    .catch(err=>{ document.getElementById('form-error').textContent=err.message; });
}

function eliminarDesdeModal() {
  if(!localActual) return;
  if(!confirm('¿Eliminar el local '+localActual.local+'? Esta acción no se puede deshacer.')) return;
  apiPost({action:'deleteLocal',nro:localActual.nro,email:usuarioActual.email})
    .then(res=>{ if(res.error){alert('Error: '+res.error);return;} cerrarModalDetalle(); cargarLocales(); });
}

// ============================================================
// DIRECTORIO DE INQUILINOS
// ============================================================
let directorioData = [];

function cargarDirectorio() {
  const el = document.getElementById('directorio-lista');
  el.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted);">Cargando directorio...</div>';

  apiGet({ action:'getDirectorio', email:usuarioActual.email })
    .then(res => {
      if (res.error) throw new Error(res.error);
      directorioData = res.directorio || [];
      renderDirectorio(directorioData);
    })
    .catch(err => {
      el.innerHTML = '<p style="color:red;padding:20px">Error: '+err.message+'</p>';
    });
}

function renderDirectorio(items) {
  const el = document.getElementById('directorio-lista');
  if (!items.length) { el.innerHTML='<p style="color:var(--text-muted);padding:20px">No hay inquilinos registrados.</p>'; return; }

  el.innerHTML = items.map((inq, idx) => `
    <div class="inquilino-card">
      <div class="inquilino-top">
        <span class="inquilino-nombre">${inq.arrendatario}</span>
        <span class="badge badge-ARRENDADO">${inq.locales.length} local${inq.locales.length!==1?'es':''}</span>
      </div>
      <div class="inquilino-locales">
        ${inq.locales.map(loc=>`<span class="local-tag">${loc.local} — ${loc.estacion}</span>`).join('')}
      </div>
      <div class="inquilino-contacto">
        <div class="contacto-row">
          <span class="contacto-label">📞 Tel</span>
          <input class="contacto-input" id="tel-${idx}" type="tel" value="${inq.telefono||''}" placeholder="Sin teléfono">
        </div>
        <div class="contacto-row">
          <span class="contacto-label">✉️ Email</span>
          <input class="contacto-input" id="cor-${idx}" type="email" value="${inq.correo||''}" placeholder="Sin correo">
          <button class="btn-guardar-contacto" onclick="guardarContacto('${esc(inq.arrendatario)}',${idx})">Guardar</button>
        </div>
      </div>
      <div id="contacto-msg-${idx}" style="font-size:12px;min-height:16px;margin-top:4px;"></div>
    </div>`).join('');
}

function filtrarDirectorio() {
  const q = document.getElementById('filtro-directorio').value.toLowerCase();
  const filtrados = directorioData.filter(i => i.arrendatario.toLowerCase().includes(q));
  renderDirectorio(filtrados);
}

function guardarContacto(arrendatario, idx) {
  const telefono = document.getElementById('tel-'+idx).value.trim();
  const correo   = document.getElementById('cor-'+idx).value.trim();
  const msg      = document.getElementById('contacto-msg-'+idx);
  msg.style.color='var(--text-muted)'; msg.textContent='Guardando...';

  apiPost({ action:'updateContacto', arrendatario, data:{telefono,correo}, email:usuarioActual.email })
    .then(res => {
      if(res.error){ msg.style.color='var(--danger)'; msg.textContent=res.error; return; }
      msg.style.color='var(--success)'; msg.textContent='✓ Guardado';
      setTimeout(()=>{ msg.textContent=''; },2000);
    }).catch(err=>{ msg.style.color='var(--danger)'; msg.textContent=err.message; });
}

function esc(s) { return (s||'').replace(/'/g,"\\'"); }

// ============================================================
// CONTRATOS DE RENTA
// ============================================================
function renderContratos(filtro) {
  filtroContratosActual = filtro;
  ['todos','vencidos','proximos','vigentes'].forEach(f => {
    document.getElementById('cf-'+f).classList.toggle('active', f===filtro);
  });

  const hoy = new Date(); hoy.setHours(0,0,0,0);
  const locales = todosLosLocales.filter(l => l.fin && l.status==='ARRENDADO');

  const items = locales.map(l => {
    const fin  = fechaObj(l.fin);
    const dias = fin ? Math.round((fin-hoy)/86400000) : null;
    return {l, fin, dias};
  });

  const filtrados = items.filter(({dias}) => {
    if (filtro==='todos') return true;
    if (dias===null) return false;
    if (filtro==='vencidos') return dias<0;
    if (filtro==='proximos') return dias>=0&&dias<=30;
    if (filtro==='vigentes') return dias>30;
    return true;
  }).sort((a,b) => (a.dias??9999)-(b.dias??9999));

  const el = document.getElementById('contratos-lista');
  if (!filtrados.length) { el.innerHTML='<p style="color:var(--text-muted);padding:20px">No hay contratos para este filtro.</p>'; return; }

  el.innerHTML = filtrados.map(({l,fin,dias}) => {
    const claseRow  = dias===null?'c-verde' : dias<0?'c-rojo' : dias<=30?'c-amarillo' : 'c-verde';
    const claseDias = dias===null?'d-verde' : dias<0?'d-rojo' : dias<=30?'d-amarillo' : 'd-verde';
    const textoDias = dias===null?'Sin fecha' : dias<0?'Vencido hace '+Math.abs(dias)+'d' : dias===0?'Vence HOY' : dias<=30?'Vence en '+dias+'d' : fin.toLocaleDateString('es-VE');

    return `
      <div class="contrato-row ${claseRow}">
        <div class="contrato-info">
          <div class="contrato-local">${l.local} — ${l.estacion}</div>
          <div class="contrato-arrendatario">${l.arrendatario||'Sin inquilino'}</div>
          <div class="contrato-fechas">${formatFecha(l.inicio)} → ${formatFecha(l.fin)}</div>
        </div>
        <div class="contrato-dias ${claseDias}">${textoDias}</div>
      </div>`;
  }).join('');
}

function filtrarContratos(filtro) { renderContratos(filtro); }

// ============================================================
// HISTORIAL DE PAGOS
// ============================================================
function cargarPagos() {
  const el = document.getElementById('pagos-lista');
  el.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted);">Cargando pagos...</div>';

  apiGet({ action:'getPagos', email:usuarioActual.email })
    .then(res => {
      if(res.error) throw new Error(res.error);
      renderPagos(res.pagos||[]);
    })
    .catch(err=>{ el.innerHTML='<p style="color:red;padding:20px">Error: '+err.message+'</p>'; });
}

function renderPagos(pagos) {
  const el = document.getElementById('pagos-lista');
  if(!pagos.length){ el.innerHTML='<p style="color:var(--text-muted);padding:20px">No hay pagos registrados aún.</p>'; return; }

  el.innerHTML = pagos.map(p=>`
    <div class="pago-card">
      ${p.foto_url?`<img class="pago-thumb" src="${driveThumb(p.foto_url)}" onclick="window.open('${p.foto_url}','_blank')" title="Ver comprobante">`:`<div class="pago-thumb" style="display:flex;align-items:center;justify-content:center;font-size:28px;">📄</div>`}
      <div class="pago-info">
        <div class="pago-local">${p.local} — ${p.estacion}</div>
        <div class="pago-fechas">📅 ${p.fecha_desde} → ${p.fecha_hasta}</div>
        <div class="pago-registro">Registrado: ${p.fecha_registro}</div>
      </div>
    </div>`).join('');
}

function abrirModalPago() {
  // Llenar select de locales
  const sel = document.getElementById('pago-local-select');
  sel.innerHTML = todosLosLocales.filter(l=>l.status==='ARRENDADO').map(l=>
    `<option value="${l.nro}">${l.local} — ${l.estacion} (${l.arrendatario||'Sin inquilino'})</option>`
  ).join('');
  document.getElementById('pago-desde').value = '';
  document.getElementById('pago-hasta').value = '';
  document.getElementById('input-foto-pago').value = '';
  document.getElementById('pago-msg').textContent = '';
  document.getElementById('modal-pago').classList.add('active');
}

function cerrarModalPago(e) { if(!e||e.target===e.currentTarget) document.getElementById('modal-pago').classList.remove('active'); }

function guardarPago() {
  const nro    = document.getElementById('pago-local-select').value;
  const desde  = document.getElementById('pago-desde').value;
  const hasta  = document.getElementById('pago-hasta').value;
  const file   = document.getElementById('input-foto-pago').files[0];
  const msg    = document.getElementById('pago-msg');

  if(!nro||!desde||!hasta){ msg.style.color='var(--danger)'; msg.textContent='Completa todos los campos'; return; }

  const local = todosLosLocales.find(l=>l.nro==nro);
  msg.style.color='var(--text-muted)'; msg.textContent='Guardando...';

  const enviar = (fotoUrl) => {
    apiPost({
      action:'addPago',
      data:{ nro_local:nro, estacion:local?local.estacion:'', local:local?local.local:'', foto_url:fotoUrl||'', fecha_desde:desde, fecha_hasta:hasta },
      email:usuarioActual.email
    }).then(res=>{
      if(res.error){ msg.style.color='var(--danger)'; msg.textContent=res.error; return; }
      msg.style.color='var(--success)'; msg.textContent='✓ Pago registrado';
      setTimeout(()=>{ cerrarModalPago(); cargarPagos(); },1200);
    }).catch(err=>{ msg.style.color='var(--danger)'; msg.textContent=err.message; });
  };

  if(file) {
    const reader = new FileReader();
    reader.onload = function(e2) {
      const base64  = e2.target.result.split(',')[1];
      const estacion = (local?local.estacion:'PAGO').toUpperCase().replace(/\s+/g,'_');
      const fileName = estacion+'_pago_'+desde+'.'+file.name.split('.').pop().toLowerCase();
      apiPost({ action:'uploadFoto', nro, base64, fileName, email:usuarioActual.email })
        .then(res=>{ enviar(res.url||''); })
        .catch(()=>enviar(''));
    };
    reader.readAsDataURL(file);
  } else {
    enviar('');
  }
}

// ============================================================
// GESTIÓN DE USUARIOS (solo admin)
// ============================================================
function abrirGestionUsuarios() {
  document.getElementById('form-usuario').style.display='none';
  document.getElementById('usuario-error').textContent='';
  document.getElementById('usuarios-lista').innerHTML='';
  document.getElementById('modal-usuarios').classList.add('active');
}

function cerrarModalUsuarios(e) { if(!e||e.target===e.currentTarget) document.getElementById('modal-usuarios').classList.remove('active'); }

function cargarListaUsuarios() {
  const lista=document.getElementById('usuarios-lista');
  const btn=document.getElementById('btn-ver-usuarios');
  lista.innerHTML='<p style="color:var(--text-muted);font-size:13px">⏳ Cargando usuarios...</p>';
  if(btn){btn.disabled=true;btn.textContent='Cargando...';}

  apiGet({action:'getUsuarios',email:usuarioActual.email})
    .then(res=>{
      if(res.error){lista.innerHTML='<p style="color:red">'+res.error+'</p>';return;}
      if(!res.usuarios||!res.usuarios.length){lista.innerHTML='<p style="color:var(--text-muted);font-size:13px">No hay usuarios</p>';return;}
      window._usuariosList=res.usuarios;
      lista.innerHTML=res.usuarios.map((u,idx)=>`
        <div class="usuario-row">
          <div class="usuario-info">
            <span class="usuario-nombre">${u.nombre||'—'}</span>
            <span class="usuario-email">${u.email}</span>
            <span class="usuario-pass">🔑 ${u.password}</span>
          </div>
          <div class="usuario-badges"><span class="badge ${u.rol==='admin'?'badge-admin':'badge-usuario'}">${u.rol}</span></div>
          <div class="usuario-acciones">
            <button class="btn-icon" onclick="mostrarFormUsuarioIdx(${idx})">✏️</button>
            <button class="btn-icon btn-icon-danger" onclick="eliminarUsuario('${u.email}')">🗑️</button>
          </div>
        </div>`).join('');
    })
    .catch(err=>{lista.innerHTML='<p style="color:red">⚠️ Error: '+err.message+'</p>';})
    .finally(()=>{if(btn){btn.disabled=false;btn.textContent='👁 Ver / Editar Usuarios';}});
}

function mostrarFormUsuario(emailEditar,nombre,rol,password) {
  usuarioEditando=emailEditar||null;
  document.getElementById('form-usuario-titulo').textContent=emailEditar?'Editar Usuario':'Nuevo Usuario';
  document.getElementById('u-email').value=emailEditar||'';
  document.getElementById('u-email').disabled=!!emailEditar;
  document.getElementById('u-nombre').value=nombre||'';
  document.getElementById('u-rol').value=rol||'usuario';
  document.getElementById('u-password').value=password||'';
  document.getElementById('usuario-error').textContent='';
  document.getElementById('form-usuario').style.display='block';
  document.getElementById('form-usuario').scrollIntoView({behavior:'smooth'});
}

function mostrarFormUsuarioIdx(idx) { const u=(window._usuariosList||[])[idx]; if(!u) return; mostrarFormUsuario(u.email,u.nombre,u.rol,u.password); }
function cancelarFormUsuario() { document.getElementById('form-usuario').style.display='none'; usuarioEditando=null; }

function guardarUsuario() {
  const email=document.getElementById('u-email').value.trim().toLowerCase();
  const nombre=document.getElementById('u-nombre').value.trim();
  const rol=document.getElementById('u-rol').value;
  const password=document.getElementById('u-password').value.trim();
  const errEl=document.getElementById('usuario-error');
  if(!email||!email.includes('@')){errEl.textContent='Email inválido';return;}
  if(!password){errEl.textContent='La contraseña es obligatoria';return;}
  const btn=document.getElementById('btn-guardar-usuario');
  errEl.textContent=''; btn.textContent='Guardando...'; btn.disabled=true;
  const terminar=(err)=>{ btn.textContent='Guardar'; btn.disabled=false; if(err){errEl.textContent=err;return;} cancelarFormUsuario(); if(document.getElementById('usuarios-lista').innerHTML!=='') cargarListaUsuarios(); };
  if(usuarioEditando){
    apiPost({action:'updateUsuario',targetEmail:usuarioEditando,data:{nombre,rol,password},email:usuarioActual.email}).then(res=>terminar(res.error||null)).catch(err=>terminar(err.message));
  } else {
    apiPost({action:'addUsuario',data:{email,nombre,rol,password},email:usuarioActual.email}).then(res=>terminar(res.error||null)).catch(err=>terminar(err.message));
  }
}

function eliminarUsuario(emailTarget) {
  if(emailTarget===usuarioActual.email){alert('No puedes eliminar tu propio usuario');return;}
  if(!confirm('¿Eliminar al usuario '+emailTarget+'?')) return;
  apiPost({action:'deleteUsuario',targetEmail:emailTarget,email:usuarioActual.email})
    .then(res=>{if(res.error){alert('Error: '+res.error);return;} cargarListaUsuarios();});
}

// ============================================================
// API HELPERS
// ============================================================
function fetchConTimeout(promesa, ms) {
  return Promise.race([
    promesa,
    new Promise((_,reject)=>setTimeout(()=>reject(new Error('Tiempo de espera agotado (timeout)')),ms))
  ]);
}
function apiGet(params) {
  const qs = new URLSearchParams(params).toString();
  return fetchConTimeout(fetch(API+'?'+qs).then(r=>r.json()),15000);
}
function apiPost(body) {
  return fetchConTimeout(fetch(API,{method:'POST',body:JSON.stringify(body)}).then(r=>r.json()),15000);
}

// ============================================================
// UTILIDADES
// ============================================================
function formatFecha(val) {
  if(!val) return '—';
  if(typeof val==='number') return new Date((val-25569)*86400*1000).toLocaleDateString('es-VE');
  if(typeof val==='string'&&val.includes('T')) return new Date(val).toLocaleDateString('es-VE');
  return val;
}
function fechaInput(val) {
  if(!val) return '';
  if(typeof val==='number') return new Date((val-25569)*86400*1000).toISOString().split('T')[0];
  if(typeof val==='string'&&val.includes('T')) return val.split('T')[0];
  return val;
}
function fechaObj(val) {
  if(!val) return null;
  if(typeof val==='number') return new Date((val-25569)*86400*1000);
  if(typeof val==='string'&&val.includes('T')) return new Date(val);
  if(typeof val==='string'&&val.includes('-')) { const [y,m,d]=val.split('-'); return new Date(y,m-1,d); }
  return null;
}
function mostrarLoading(activo) {
  document.getElementById('loading').classList.toggle('active',activo);
  document.getElementById('lista-locales').style.display=activo?'none':'grid';
}

// ============================================================
// INICIO
// ============================================================
window.addEventListener('DOMContentLoaded', () => {
  const guardado = localStorage.getItem('usuario');
  if(guardado) {
    try { usuarioActual=JSON.parse(guardado); mostrarApp(); }
    catch { mostrarLogin(); }
  } else { mostrarLogin(); }

  document.getElementById('login-email').addEventListener('keydown', e=>{ if(e.key==='Enter') document.getElementById('login-password').focus(); });
  document.getElementById('login-password').addEventListener('keydown', e=>{ if(e.key==='Enter') login(); });
});
