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
  ['nav-directorio','nav-contratos','nav-pagos','nav-comparativa','nav-finanzas',
   'bnav-directorio','bnav-contratos','bnav-pagos','bnav-comparativa','bnav-finanzas'].forEach(id => {
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
const TABS = ['resumen','catalogo','directorio','contratos','pagos','comparativa','finanzas'];

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

  if (tab === 'resumen'     && todosLosLocales.length) renderResumen();
  if (tab === 'directorio') cargarDirectorio();
  if (tab === 'contratos')  renderContratos('todos');
  if (tab === 'pagos')      cargarPagos();
  if (tab === 'comparativa') renderComparativa();
  if (tab === 'finanzas')   cargarFinanzas();
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
    // Llenar todos los selects de estación en todos los tabs
    const ids = ['filtro-estacion','dir-filtro-estacion','con-filtro-estacion','pag-filtro-estacion','comp-filtro-estacion'];
    ids.forEach(id => {
      const sel = document.getElementById(id);
      if (!sel) return;
      while (sel.options.length > 1) sel.remove(1);
      estaciones.forEach(e => {
        const opt = document.createElement('option');
        opt.value = e; opt.textContent = e;
        sel.appendChild(opt);
      });
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
          <span class="alerta-local">${l.estacion}</span>
          <span class="alerta-dias ${claseDias}">${texto}</span>
          <span class="alerta-chevron">▾</span>
        </div>
        <div class="alerta-detalle">
          <div><strong>Local:</strong> ${l.local}</div>
          <div><strong>Línea:</strong> ${l.linea}</div>
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

  if (['fin-ingresos-mes','fin-ingresos-linea','fin-deuda-linea','fin-deuda-estacion'].includes(tipo)) {
    _abrirChartModalFinanzas(tipo); return;
  }

  if (tipo === 'comparativa') {
    title.textContent = 'Comparativa Ingresos Actuales vs 2026';
    desc.textContent  = 'Ingresos mensuales actuales comparados con los proyectados para 2026 por línea.';
    const lineas = [1,2,3,4];
    const actuales = lineas.map(ln => locales.filter(l=>Number(l.linea)===ln).reduce((s,l)=>s+(Number(l.monto)||0),0));
    const proj2026 = lineas.map(ln => locales.filter(l=>Number(l.linea)===ln).reduce((s,l)=>s+(Number(l.total_2026)||0),0));
    chartModalInst = new Chart(canvas, {
      type:'bar',
      data:{ labels:['Línea 1','Línea 2','Línea 3','Línea 4'],
        datasets:[
          { label:'Actual', data:actuales, backgroundColor:'#9ca3a8', borderRadius:6 },
          { label:'2026',   data:proj2026, backgroundColor:'#e31b23', borderRadius:6 }
        ]
      },
      options:{ responsive:true, maintainAspectRatio:false, plugins:{legend:{position:'bottom'}}, scales:{y:{beginAtZero:true}} }
    });
    tabla.innerHTML = tablaHTML(['Línea','Actual $','2026 $','Diferencia $'],
      lineas.map((ln,i)=>['Línea '+ln,
        '$ '+actuales[i].toLocaleString('es-VE',{minimumFractionDigits:2}),
        '$ '+proj2026[i].toLocaleString('es-VE',{minimumFractionDigits:2}),
        (proj2026[i]-actuales[i]>=0?'▲ ':'▼ ')+'$ '+Math.abs(proj2026[i]-actuales[i]).toLocaleString('es-VE',{minimumFractionDigits:2})
      ]));
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

    // Mostrar opciones de monto actual vs 2026
    const total2026 = Number(l.total_2026)||0;
    const lblActual = document.getElementById('lbl-monto-actual');
    const lblNuevo  = document.getElementById('lbl-monto-2026');
    const selectorDiv = document.getElementById('monto-selector');
    if (lblActual) lblActual.textContent = monto ? '$ '+monto.toLocaleString('es-VE',{minimumFractionDigits:2}) : '—';
    if (lblNuevo)  lblNuevo.textContent  = total2026 ? '$ '+total2026.toLocaleString('es-VE',{minimumFractionDigits:2}) : 'Sin datos';
    if (selectorDiv) selectorDiv.style.display = total2026 ? 'block' : 'none';
    // Reset selección a "actual"
    seleccionarMonto('actual', false);
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
// SUBIR FOTO (con cola offline)
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
  progress.textContent   = 'Preparando foto...';

  const reader = new FileReader();
  reader.onload = function(e) {
    const base64 = e.target.result.split(',')[1];

    if (!navigator.onLine) {
      // Sin conexión: guardar en cola
      _encolarFoto({ nro:localActual.nro, estacion:localActual.estacion, local:localActual.local, base64, fileName, nombreDesc });
      progress.style.display='none';
      input.value=''; nombreEl.value='';
      mostrarToast('Sin WiFi — foto guardada. Se enviará cuando haya conexión 📶');
      return;
    }

    progress.textContent = 'Subiendo foto...';
    _enviarFotoDirecta({ nro:localActual.nro, base64, fileName }, (res, err) => {
      progress.style.display='none';
      input.value=''; nombreEl.value='';
      if (err || (res&&res.error)) {
        // Fallo con conexión: encolar para reintento
        _encolarFoto({ nro:localActual.nro, estacion:localActual.estacion, local:localActual.local, base64, fileName, nombreDesc });
        mostrarToast('Error al subir — foto en cola para reintento 🔄');
        return;
      }
      if (!localActual.fotos) localActual.fotos=[];
      localActual.fotos.push(res.url);
      renderGaleria(localActual.fotos);
      const idx = todosLosLocales.findIndex(l=>l.nro===localActual.nro);
      if (idx!==-1) todosLosLocales[idx].fotos = localActual.fotos;
    });
  };
  reader.readAsDataURL(file);
}

function _enviarFotoDirecta(item, cb) {
  apiPost({ action:'uploadFoto', nro:item.nro, base64:item.base64, fileName:item.fileName, email:usuarioActual.email })
    .then(res => cb(res, null))
    .catch(err => cb(null, err));
}

// ============================================================
// COLA DE FOTOS OFFLINE
// ============================================================
const COLA_KEY = 'fotosQueue_metro';

function _encolarFoto(datos) {
  const cola = _obtenerCola();
  const item = {
    id:          Date.now() + '_' + Math.random().toString(36).substr(2,5),
    nro:         datos.nro,
    estacion:    datos.estacion||'',
    local:       datos.local||'',
    base64:      datos.base64,
    fileName:    datos.fileName,
    nombreDesc:  datos.nombreDesc||'',
    timestamp:   new Date().toISOString(),
    status:      'pendiente',
    intentos:    0
  };
  cola.push(item);
  _guardarCola(cola);
  _actualizarIndicador();
}

function _obtenerCola() {
  try { return JSON.parse(localStorage.getItem(COLA_KEY)||'[]'); }
  catch { return []; }
}
function _guardarCola(cola) {
  localStorage.setItem(COLA_KEY, JSON.stringify(cola));
}

function _actualizarIndicador() {
  const cola  = _obtenerCola();
  const btn   = document.getElementById('btn-cola-fotos');
  const count = document.getElementById('cola-count');
  const plural = document.getElementById('cola-plural');
  if (!btn) return;
  const pendientes = cola.filter(i => i.status !== 'ok').length;
  if (pendientes === 0) { btn.style.display='none'; return; }
  btn.style.display = 'inline-block';
  count.textContent  = pendientes;
  plural.textContent = pendientes === 1 ? '' : 's';
}

function procesarColaFotos(manual=false) {
  if (!navigator.onLine && !manual) return;
  const cola = _obtenerCola();
  const pendientes = cola.filter(i => i.status === 'pendiente' || i.status === 'error');
  if (!pendientes.length) {
    if (manual) mostrarToast('No hay fotos pendientes ✅');
    return;
  }

  const estadoEl = document.getElementById('cola-estado');
  if (estadoEl) { estadoEl.textContent = `Enviando ${pendientes.length} foto(s)...`; estadoEl.style.color='var(--primary)'; }

  let enviadas = 0;
  const procesarUna = (idx) => {
    if (idx >= pendientes.length) {
      _actualizarIndicador();
      renderListaCola();
      if (estadoEl) { estadoEl.textContent = `✅ ${enviadas} foto(s) enviada(s)`; estadoEl.style.color='var(--success)'; }
      if (enviadas > 0) mostrarToast(`✅ ${enviadas} foto(s) enviada(s) correctamente`);
      return;
    }

    const item = pendientes[idx];
    // Marcar como enviando
    const cola2 = _obtenerCola();
    const iCola = cola2.findIndex(x=>x.id===item.id);
    if (iCola!==-1) { cola2[iCola].status='enviando'; _guardarCola(cola2); }
    renderListaCola();

    _enviarFotoDirecta(item, (res, err) => {
      const cola3 = _obtenerCola();
      const j = cola3.findIndex(x=>x.id===item.id);
      if (j === -1) { procesarUna(idx+1); return; }

      if (err || (res&&res.error)) {
        cola3[j].status  = 'error';
        cola3[j].intentos = (cola3[j].intentos||0)+1;
        cola3[j].errorMsg = err?err.message:(res.error||'Error desconocido');
      } else {
        cola3[j].status = 'ok';
        enviadas++;
        // Actualizar galería si el local está abierto
        const nro = item.nro;
        if (localActual && localActual.nro === nro) {
          if (!localActual.fotos) localActual.fotos=[];
          localActual.fotos.push(res.url);
          renderGaleria(localActual.fotos);
        }
        const li = todosLosLocales.findIndex(l=>l.nro===nro);
        if (li!==-1) {
          if (!todosLosLocales[li].fotos) todosLosLocales[li].fotos=[];
          todosLosLocales[li].fotos.push(res.url);
        }
      }
      _guardarCola(cola3);
      procesarUna(idx+1);
    });
  };

  procesarUna(0);
}

function abrirModalCola() {
  document.getElementById('modal-cola').classList.add('active');
  renderListaCola();
}
function cerrarModalCola(e) {
  if (!e||e.target===e.currentTarget) document.getElementById('modal-cola').classList.remove('active');
}

function renderListaCola() {
  const cola = _obtenerCola();
  const el   = document.getElementById('cola-lista');
  if (!el) return;
  const items = cola.filter(i=>i.status!=='ok');
  if (!items.length) {
    el.innerHTML='<p style="color:var(--text-muted);font-size:13px;padding:8px 0">No hay fotos pendientes ✅</p>';
    return;
  }
  el.innerHTML = items.map(i => {
    const clsSt = i.status==='enviando'?'cola-status-enviando':i.status==='error'?'cola-status-error':'cola-status-pendiente';
    const txtSt = i.status==='enviando'?'⏳ Enviando...':i.status==='error'?`❌ Error (intento ${i.intentos})`:'🕐 Pendiente';
    const fecha = new Date(i.timestamp).toLocaleString('es-VE',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});
    return `
      <div class="cola-item">
        <img class="cola-item-thumb" src="data:image/jpeg;base64,${i.base64.substring(0,100)}..." onerror="this.style.display='none'">
        <div class="cola-item-info">
          <div class="cola-item-nombre">${i.nombreDesc||i.fileName}</div>
          <div class="cola-item-sub">${i.estacion} — Local ${i.local} · ${fecha}</div>
          ${i.errorMsg?`<div style="font-size:11px;color:var(--danger)">${i.errorMsg}</div>`:''}
        </div>
        <span class="cola-item-status ${clsSt}">${txtSt}</span>
        <button onclick="eliminarDeCola('${i.id}')" style="background:none;border:none;cursor:pointer;font-size:16px;color:var(--text-muted);padding:4px;" title="Eliminar">✕</button>
      </div>`;
  }).join('');
}

function eliminarDeCola(id) {
  const cola = _obtenerCola().filter(i=>i.id!==id);
  _guardarCola(cola);
  _actualizarIndicador();
  renderListaCola();
}

function vaciarCola() {
  if (!confirm('¿Eliminar todas las fotos pendientes?')) return;
  _guardarCola([]);
  _actualizarIndicador();
  renderListaCola();
}

function mostrarToast(msg) {
  let t = document.getElementById('toast-msg');
  if (!t) {
    t = document.createElement('div');
    t.id = 'toast-msg';
    t.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:#1f2124;color:white;padding:10px 20px;border-radius:20px;font-size:13px;z-index:9999;max-width:90%;text-align:center;box-shadow:0 4px 12px rgba(0,0,0,0.3);';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.style.display='block';
  clearTimeout(t._timer);
  t._timer = setTimeout(()=>{ t.style.display='none'; }, 3500);
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
function seleccionarMonto(tipo, actualizarInput=true) {
  const btnActual = document.getElementById('btn-monto-actual');
  const btn2026   = document.getElementById('btn-monto-2026');
  if (btnActual) btnActual.classList.toggle('active', tipo==='actual');
  if (btn2026)   btn2026.classList.toggle('active', tipo==='2026');

  if (actualizarInput && localActual) {
    const valor = tipo==='2026'
      ? (Number(localActual.total_2026)||0)
      : (Number(localActual.monto)||0);
    document.getElementById('edit-monto').value = valor||'';
    calcularPrecioFinal();
  }
}

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

function getValSel(id) { const el=document.getElementById(id); return el?el.value:''; }

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
  const q       = (getValSel('filtro-directorio')||'').toLowerCase();
  const linea   = getValSel('dir-filtro-linea');
  const estacion= getValSel('dir-filtro-estacion').toUpperCase();

  const filtrados = directorioData.filter(inq => {
    if (q && !inq.arrendatario.toLowerCase().includes(q) &&
        !inq.locales.some(l => l.local.toLowerCase().includes(q))) return false;
    if (linea && !inq.locales.some(l => String(l.linea)===linea)) return false;
    if (estacion && !inq.locales.some(l => l.estacion.toUpperCase()===estacion)) return false;
    return true;
  });
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
  const buscar   = (getValSel('con-filtro-buscar')||'').toUpperCase();
  const linea    = getValSel('con-filtro-linea');
  const estacion = getValSel('con-filtro-estacion').toUpperCase();

  let locales = todosLosLocales.filter(l => l.fin && l.status==='ARRENDADO');
  if (linea)    locales = locales.filter(l => String(l.linea)===linea);
  if (estacion) locales = locales.filter(l => l.estacion.toUpperCase()===estacion);
  if (buscar)   locales = locales.filter(l => (l.arrendatario+' '+l.local+' '+l.estacion).toUpperCase().includes(buscar));

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
  const buscar   = (getValSel('pag-filtro-buscar')||'').toUpperCase();
  const linea    = getValSel('pag-filtro-linea');
  const estacion = getValSel('pag-filtro-estacion').toUpperCase();

  if (linea || estacion || buscar) {
    pagos = pagos.filter(p => {
      const loc = todosLosLocales.find(l => String(l.nro)===String(p.nro_local));
      if (linea    && (!loc || String(loc.linea)!==linea)) return false;
      if (estacion && p.estacion.toUpperCase()!==estacion) return false;
      if (buscar   && !(p.estacion+' '+p.local).toUpperCase().includes(buscar)) return false;
      return true;
    });
  }

  const el = document.getElementById('pagos-lista');
  if(!pagos.length){ el.innerHTML='<p style="color:var(--text-muted);padding:20px">No hay pagos registrados.</p>'; return; }

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
  const sel = document.getElementById('pago-local-select');
  sel.innerHTML = todosLosLocales.filter(l=>l.status==='ARRENDADO').map(l=>
    `<option value="${l.nro}">${l.local} — ${l.estacion} (${l.arrendatario||'Sin inquilino'})</option>`
  ).join('');
  document.getElementById('pago-desde').value      = '';
  document.getElementById('pago-hasta').value      = '';
  document.getElementById('input-foto-pago').value = '';
  document.getElementById('pago-msg').textContent  = '';
  // Autocompletar monto con el primer local
  _actualizarMontoPago();
  sel.onchange = _actualizarMontoPago;
  document.getElementById('modal-pago').classList.add('active');
}

function _actualizarMontoPago() {
  const nro   = document.getElementById('pago-local-select').value;
  const local = todosLosLocales.find(l => String(l.nro) === String(nro));
  const monto = local ? (Number(local.precio_final)||Number(local.monto)||0) : 0;
  document.getElementById('pago-monto').value = monto || '';
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

  const monto = parseFloat(document.getElementById('pago-monto').value)||0;

  const enviar = (fotoUrl) => {
    apiPost({
      action:'addPago',
      data:{ nro_local:nro, estacion:local?local.estacion:'', local:local?local.local:'', foto_url:fotoUrl||'', fecha_desde:desde, fecha_hasta:hasta, monto },
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
// COMPARATIVA DE PRECIOS 2026
// ============================================================
let _compLineaFiltro = 'todas';
let _compBusqueda   = '';

function renderComparativa() {
  const locales = todosLosLocales.filter(l => Number(l.total_2026) > 0 || Number(l.monto) > 0);

  // KPIs globales (todos los locales con datos)
  const totalActual = locales.reduce((s,l) => s + (Number(l.monto)||0), 0);
  const total2026   = locales.reduce((s,l) => s + (Number(l.total_2026)||0), 0);
  const diff        = total2026 - totalActual;
  const pctProm     = locales.filter(l=>Number(l.monto)>0).length
    ? locales.filter(l=>Number(l.monto)>0).reduce((s,l)=>s+(Number(l.pct_incremento)||0),0) / locales.filter(l=>Number(l.monto)>0).length
    : 0;

  document.getElementById('comp-total-actual').textContent = '$ '+totalActual.toLocaleString('es-VE',{minimumFractionDigits:2});
  document.getElementById('comp-total-2026').textContent   = '$ '+total2026.toLocaleString('es-VE',{minimumFractionDigits:2});
  document.getElementById('comp-incremento').textContent   = (diff>=0?'+ ':'- ')+'$ '+Math.abs(diff).toLocaleString('es-VE',{minimumFractionDigits:2});
  document.getElementById('comp-pct-promedio').textContent = pctProm.toFixed(1)+'%';

  renderChartComparativa(locales);
  renderTablaComparativa(locales);
}

function renderChartComparativa(locales) {
  const lineas = [1,2,3,4];
  const actuales = lineas.map(ln => locales.filter(l=>Number(l.linea)===ln).reduce((s,l)=>s+(Number(l.monto)||0),0));
  const proj2026 = lineas.map(ln => locales.filter(l=>Number(l.linea)===ln).reduce((s,l)=>s+(Number(l.total_2026)||0),0));

  crearOActualizarChart('chart-comparativa', {
    type: 'bar',
    data: {
      labels: ['Línea 1','Línea 2','Línea 3','Línea 4'],
      datasets: [
        { label:'Actual', data:actuales, backgroundColor:'#9ca3a8', borderRadius:4 },
        { label:'2026',   data:proj2026, backgroundColor:'#e31b23', borderRadius:4 }
      ]
    },
    options: {
      responsive:true, maintainAspectRatio:false,
      plugins:{ legend:{ position:'bottom' } },
      scales:{ y:{ beginAtZero:true } }
    }
  });
}

function renderTablaComparativa(localesFull) {
  let locales = localesFull.filter(l => Number(l.total_2026) > 0 || Number(l.monto) > 0);

  const buscar   = (getValSel('filtro-comparativa')||'').toUpperCase();
  const linea    = getValSel('comp-filtro-linea');
  const estacion = getValSel('comp-filtro-estacion').toUpperCase();
  const status   = getValSel('comp-filtro-status').toUpperCase();

  if (linea)    locales = locales.filter(l => String(l.linea)===linea);
  if (estacion) locales = locales.filter(l => l.estacion.toUpperCase()===estacion);
  if (status)   locales = locales.filter(l => l.status.toUpperCase()===status);
  if (buscar)   locales = locales.filter(l => (l.estacion+' '+l.local+' '+(l.arrendatario||'')).toUpperCase().includes(buscar));

  const tbody = document.getElementById('comp-tbody');
  if (!locales.length) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:30px;color:var(--text-muted);">Sin resultados</td></tr>';
    return;
  }

  tbody.innerHTML = locales.map(l => {
    const actual = Number(l.monto)||0;
    const nuevo  = Number(l.total_2026)||0;
    const diff   = nuevo - actual;
    const pct    = Number(l.pct_incremento)||0;
    const clsDiff = diff > 0 ? 'comp-val-2026' : diff < 0 ? 'comp-val-neg' : 'comp-pct-neu';
    const clsPct  = pct  > 0 ? 'comp-pct-pos'  : pct  < 0 ? 'comp-pct-neg' : 'comp-pct-neu';
    const fmtD = n => n ? '$ '+Math.abs(n).toLocaleString('es-VE',{minimumFractionDigits:2}) : '—';
    const signo = diff > 0 ? '▲ ' : diff < 0 ? '▼ ' : '';

    return `<tr onclick="abrirDetalle(${l.nro})" style="cursor:pointer;">
      <td>${l.nro}</td>
      <td>${l.estacion}</td>
      <td>${l.local}</td>
      <td style="max-width:160px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${l.arrendatario||'—'}</td>
      <td class="comp-val-actual">${fmtD(actual)}</td>
      <td class="comp-val-2026">${fmtD(nuevo)}</td>
      <td class="${clsDiff}">${signo}${fmtD(diff)}</td>
      <td class="${clsPct}">${pct!==0?(pct>0?'+':'')+pct.toFixed(1)+'%':'—'}</td>
    </tr>`;
  }).join('');
}

function filtrarComparativa() {
  const locales = todosLosLocales.filter(l => Number(l.total_2026)>0 || Number(l.monto)>0);
  renderTablaComparativa(locales);
}

// ============================================================
// FINANZAS
// ============================================================
let _finPagosData  = [];
let _finLineaFiltro   = '';
let _finEstacionFiltro = '';

function cargarFinanzas() {
  // Limpiar estado
  ['fin-total-recibido','fin-mes-recibido','fin-num-pagos','fin-promedio',
   'fin-deuda-total','fin-locales-mora','fin-dias-mora','fin-estacion-mora'].forEach(id => {
    const el = document.getElementById(id); if (el) el.textContent = '...';
  });

  apiGet({ action:'getPagos', email:usuarioActual.email })
    .then(res => {
      if (res.error) throw new Error(res.error);
      _finPagosData = res.pagos || [];
      // Llenar estaciones en filtro
      const ests = [...new Set(todosLosLocales.map(l=>l.estacion))].sort();
      const sel = document.getElementById('fin-filtro-estacion');
      if (sel) {
        while (sel.options.length > 1) sel.remove(1);
        ests.forEach(e => { const o=document.createElement('option'); o.value=e; o.textContent=e; sel.appendChild(o); });
      }
      aplicarFiltrosFinanzas();
    })
    .catch(err => {
      document.getElementById('fin-tbody-deuda').innerHTML =
        `<tr><td colspan="7" style="color:red;padding:20px">Error: ${err.message}</td></tr>`;
    });
}

function aplicarFiltrosFinanzas() {
  _finLineaFiltro    = getValSel('fin-filtro-linea');
  _finEstacionFiltro = getValSel('fin-filtro-estacion');
  renderFinanzas();
}

function renderFinanzas() {
  const hoy = new Date(); hoy.setHours(0,0,0,0);
  const mesActual = hoy.getFullYear() + '-' + String(hoy.getMonth()+1).padStart(2,'0');

  // Filtrar locales arrendados según filtros activos
  let localesArr = todosLosLocales.filter(l => l.status === 'ARRENDADO');
  if (_finLineaFiltro)    localesArr = localesArr.filter(l => String(l.linea) === _finLineaFiltro);
  if (_finEstacionFiltro) localesArr = localesArr.filter(l => l.estacion === _finEstacionFiltro);
  const nrosSet = new Set(localesArr.map(l => String(l.nro)));

  // Filtrar pagos según locales seleccionados
  const pagos = _finPagosData.filter(p => !nrosSet.size || nrosSet.has(String(p.nro_local)));

  // ── INGRESOS ──
  const totalRecibido = pagos.reduce((s,p) => s + (Number(p.monto)||0), 0);
  const pagosMes      = pagos.filter(p => {
    const reg = p.fecha_registro ? String(p.fecha_registro).substring(0,7) : '';
    return reg === mesActual;
  });
  const mesRecibido = pagosMes.reduce((s,p) => s+(Number(p.monto)||0), 0);
  const promedio    = pagos.length ? totalRecibido/pagos.length : 0;

  const fmt = n => '$ '+n.toLocaleString('es-VE',{minimumFractionDigits:2});
  document.getElementById('fin-total-recibido').textContent = fmt(totalRecibido);
  document.getElementById('fin-mes-recibido').textContent   = fmt(mesRecibido);
  document.getElementById('fin-num-pagos').textContent      = pagos.length;
  document.getElementById('fin-promedio').textContent       = fmt(promedio);
  document.getElementById('fin-mes-label').textContent      = new Date().toLocaleDateString('es-VE',{month:'long',year:'numeric'});

  renderChartIngresosMes(pagos);
  renderChartIngresosLinea(pagos, localesArr);

  // ── DEUDA ──
  // Para cada local arrendado, buscar último pago y ver si está en mora
  const lastPagoPorLocal = {};
  _finPagosData.forEach(p => {
    const k = String(p.nro_local);
    if (!lastPagoPorLocal[k] || p.fecha_hasta > lastPagoPorLocal[k].fecha_hasta) {
      lastPagoPorLocal[k] = p;
    }
  });

  const enMora = [];
  localesArr.forEach(l => {
    const monto = Number(l.precio_final)||Number(l.monto)||0;
    if (!monto) return;
    const lastPago = lastPagoPorLocal[String(l.nro)];
    let diasMora = 0;

    if (!lastPago) {
      // Sin pagos: mora desde inicio contrato
      const inicio = fechaObj(l.inicio);
      if (inicio && inicio < hoy) diasMora = Math.floor((hoy - inicio)/86400000);
      else return; // sin contrato iniciado, ignorar
    } else {
      const hasta = lastPago.fecha_hasta ? new Date(lastPago.fecha_hasta) : null;
      if (!hasta || hasta >= hoy) return; // al día
      diasMora = Math.floor((hoy - hasta)/86400000);
    }

    if (diasMora <= 0) return;
    const meses     = Math.ceil(diasMora/30);
    const deudaEst  = meses * monto;
    enMora.push({ l, diasMora, meses, deudaEst, lastPago });
  });

  enMora.sort((a,b) => b.deudaEst - a.deudaEst);

  const deudaTotal   = enMora.reduce((s,x) => s+x.deudaEst, 0);
  const diasProm     = enMora.length ? Math.round(enMora.reduce((s,x)=>s+x.diasMora,0)/enMora.length) : 0;
  const topEstacion  = enMora.length
    ? Object.entries(enMora.reduce((m,x)=>{ m[x.l.estacion]=(m[x.l.estacion]||0)+x.deudaEst; return m; },{}))
        .sort((a,b)=>b[1]-a[1])[0][0]
    : '—';

  document.getElementById('fin-deuda-total').textContent   = fmt(deudaTotal);
  document.getElementById('fin-locales-mora').textContent  = enMora.length;
  document.getElementById('fin-dias-mora').textContent     = diasProm + ' días';
  document.getElementById('fin-estacion-mora').textContent = topEstacion;

  renderChartDeudaLinea(enMora);
  renderChartDeudaEstacion(enMora);
  renderTablaDeuda(enMora);
}

// ── GRÁFICAS INGRESOS ──
function renderChartIngresosMes(pagos) {
  const meses = {};
  pagos.forEach(p => {
    if (!p.fecha_registro) return;
    const key = String(p.fecha_registro).substring(0,7);
    meses[key] = (meses[key]||0) + (Number(p.monto)||0);
  });
  const keys = Object.keys(meses).sort().slice(-12);
  crearOActualizarChart('chart-fin-ingresos-mes', {
    type:'bar',
    data:{ labels:keys, datasets:[{ label:'Ingresos $', data:keys.map(k=>meses[k]), backgroundColor:'#16a34a', borderRadius:6 }] },
    options:{ responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}}, scales:{y:{beginAtZero:true}} }
  });
}

function renderChartIngresosLinea(pagos, localesArr) {
  const mapaLocal = {};
  todosLosLocales.forEach(l => { mapaLocal[String(l.nro)] = l; });
  const porLinea = {1:0,2:0,3:0,4:0};
  pagos.forEach(p => {
    const loc = mapaLocal[String(p.nro_local)];
    if (loc && porLinea[loc.linea]!==undefined) porLinea[loc.linea] += Number(p.monto)||0;
  });
  crearOActualizarChart('chart-fin-ingresos-linea', {
    type:'bar',
    data:{ labels:['Línea 1','Línea 2','Línea 3','Línea 4'],
      datasets:[{ label:'$ Recibido', data:Object.values(porLinea), backgroundColor:CHART_COLORS.slice(0,4), borderRadius:6 }] },
    options:{ indexAxis:'y', responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}}, scales:{x:{beginAtZero:true}} }
  });
}

// ── GRÁFICAS DEUDA ──
function renderChartDeudaLinea(enMora) {
  const porLinea = {1:0,2:0,3:0,4:0};
  enMora.forEach(x => { if (porLinea[x.l.linea]!==undefined) porLinea[x.l.linea]+=x.deudaEst; });
  crearOActualizarChart('chart-fin-deuda-linea', {
    type:'bar',
    data:{ labels:['Línea 1','Línea 2','Línea 3','Línea 4'],
      datasets:[{ label:'Deuda $', data:Object.values(porLinea), backgroundColor:'#e31b23', borderRadius:6 }] },
    options:{ indexAxis:'y', responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}}, scales:{x:{beginAtZero:true}} }
  });
}

function renderChartDeudaEstacion(enMora) {
  const porEst = {};
  enMora.forEach(x => { porEst[x.l.estacion] = (porEst[x.l.estacion]||0)+x.deudaEst; });
  const top = Object.entries(porEst).sort((a,b)=>b[1]-a[1]).slice(0,8);
  crearOActualizarChart('chart-fin-deuda-estacion', {
    type:'bar',
    data:{ labels:top.map(e=>e[0]), datasets:[{ label:'Deuda $', data:top.map(e=>e[1]), backgroundColor:'#fbbf24', borderRadius:6 }] },
    options:{ indexAxis:'y', responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}}, scales:{x:{beginAtZero:true}} }
  });
}

function renderTablaDeuda(enMora) {
  const fmt = n => '$ '+n.toLocaleString('es-VE',{minimumFractionDigits:2});
  const tbody = document.getElementById('fin-tbody-deuda');
  if (!enMora.length) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:30px;color:var(--success);">✅ Sin locales en mora</td></tr>';
    return;
  }
  tbody.innerHTML = enMora.map(({l,diasMora,meses,deudaEst,lastPago}) => {
    const hasta = lastPago ? lastPago.fecha_hasta : '(sin pagos)';
    const clsDias = diasMora > 90 ? 'comp-val-neg' : diasMora > 30 ? 'comp-pct-neg' : 'comp-pct-pos';
    return `<tr onclick="abrirDetalle(${l.nro})" style="cursor:pointer;">
      <td>${l.estacion}</td>
      <td>${l.local}</td>
      <td style="max-width:150px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${l.arrendatario||'—'}</td>
      <td>${hasta}</td>
      <td class="${clsDias}">${diasMora}d</td>
      <td>${meses}</td>
      <td class="comp-val-neg">${fmt(deudaEst)}</td>
    </tr>`;
  }).join('');
}

// ── CHART MODAL para finanzas ──
function _abrirChartModalFinanzas(tipo) {
  const modal  = document.getElementById('modal-chart');
  modal.classList.add('active');
  if (chartModalInst) { chartModalInst.destroy(); chartModalInst = null; }
  const canvas = document.getElementById('chart-modal-canvas');
  const title  = document.getElementById('chart-modal-title');
  const desc   = document.getElementById('chart-modal-desc');
  const tabla  = document.getElementById('chart-modal-tabla');
  tabla.innerHTML = '';

  const fmt = n => '$ '+n.toLocaleString('es-VE',{minimumFractionDigits:2});
  const mapaLocal = {};
  todosLosLocales.forEach(l => { mapaLocal[String(l.nro)] = l; });

  // Filtrar pagos y mora según filtros activos
  const nrosSet = new Set(
    todosLosLocales.filter(l => {
      if (l.status !== 'ARRENDADO') return false;
      if (_finLineaFiltro    && String(l.linea) !== _finLineaFiltro)   return false;
      if (_finEstacionFiltro && l.estacion !== _finEstacionFiltro) return false;
      return true;
    }).map(l => String(l.nro))
  );
  const pagos = _finPagosData.filter(p => !nrosSet.size || nrosSet.has(String(p.nro_local)));

  if (tipo === 'fin-ingresos-mes') {
    title.textContent = 'Ingresos Recibidos por Mes';
    desc.textContent  = 'Suma de montos de pagos registrados agrupados por mes.';
    const meses = {};
    pagos.forEach(p => {
      if (!p.fecha_registro) return;
      const key = String(p.fecha_registro).substring(0,7);
      meses[key] = (meses[key]||0)+(Number(p.monto)||0);
    });
    const keys = Object.keys(meses).sort().slice(-12);
    chartModalInst = new Chart(canvas, {
      type:'bar', data:{ labels:keys, datasets:[{ label:'Ingresos $', data:keys.map(k=>meses[k]), backgroundColor:'#16a34a', borderRadius:6 }] },
      options:{ responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}}, scales:{y:{beginAtZero:true}} }
    });
    tabla.innerHTML = tablaHTML(['Mes','Ingreso'],keys.map(k=>[k, fmt(meses[k])]));
  }

  if (tipo === 'fin-ingresos-linea') {
    title.textContent = 'Ingresos por Línea';
    desc.textContent  = 'Total recibido agrupado por línea de Metro.';
    const porLinea = {1:0,2:0,3:0,4:0};
    pagos.forEach(p => { const loc=mapaLocal[String(p.nro_local)]; if(loc&&porLinea[loc.linea]!==undefined) porLinea[loc.linea]+=Number(p.monto)||0; });
    chartModalInst = new Chart(canvas, {
      type:'bar', data:{ labels:['Línea 1','Línea 2','Línea 3','Línea 4'], datasets:[{ data:Object.values(porLinea), backgroundColor:CHART_COLORS.slice(0,4), borderRadius:6 }] },
      options:{ indexAxis:'y', responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}}, scales:{x:{beginAtZero:true}} }
    });
    tabla.innerHTML = tablaHTML(['Línea','Recibido'], Object.entries(porLinea).map(([k,v])=>['Línea '+k, fmt(v)]));
  }

  if (tipo === 'fin-deuda-linea') {
    title.textContent = 'Deuda por Línea de Metro';
    desc.textContent  = 'Estimado de deuda acumulada por línea basado en días de mora.';
    const porLinea = {1:0,2:0,3:0,4:0};
    // Recalcular mora con filtros actuales
    const hoy = new Date(); hoy.setHours(0,0,0,0);
    const lastPP = {};
    _finPagosData.forEach(p => { const k=String(p.nro_local); if(!lastPP[k]||p.fecha_hasta>lastPP[k].fecha_hasta) lastPP[k]=p; });
    todosLosLocales.filter(l=>l.status==='ARRENDADO'&&(nrosSet.has(String(l.nro)))).forEach(l => {
      const monto=Number(l.precio_final)||Number(l.monto)||0; if(!monto) return;
      const lp=lastPP[String(l.nro)];
      let dias=0;
      if (!lp) { const ini=fechaObj(l.inicio); if(ini&&ini<hoy) dias=Math.floor((hoy-ini)/86400000); else return; }
      else { const h=new Date(lp.fecha_hasta); if(h>=hoy) return; dias=Math.floor((hoy-h)/86400000); }
      if(dias<=0) return;
      if(porLinea[l.linea]!==undefined) porLinea[l.linea]+=Math.ceil(dias/30)*monto;
    });
    chartModalInst = new Chart(canvas, {
      type:'bar', data:{ labels:['Línea 1','Línea 2','Línea 3','Línea 4'], datasets:[{ data:Object.values(porLinea), backgroundColor:'#e31b23', borderRadius:6 }] },
      options:{ indexAxis:'y', responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}}, scales:{x:{beginAtZero:true}} }
    });
    tabla.innerHTML = tablaHTML(['Línea','Deuda estimada'], Object.entries(porLinea).map(([k,v])=>['Línea '+k, fmt(v)]));
  }

  if (tipo === 'fin-deuda-estacion') {
    title.textContent = 'Deuda por Estación';
    desc.textContent  = 'Top estaciones con mayor deuda estimada.';
    const porEst = {};
    const hoy = new Date(); hoy.setHours(0,0,0,0);
    const lastPP = {};
    _finPagosData.forEach(p => { const k=String(p.nro_local); if(!lastPP[k]||p.fecha_hasta>lastPP[k].fecha_hasta) lastPP[k]=p; });
    todosLosLocales.filter(l=>l.status==='ARRENDADO'&&nrosSet.has(String(l.nro))).forEach(l => {
      const monto=Number(l.precio_final)||Number(l.monto)||0; if(!monto) return;
      const lp=lastPP[String(l.nro)];
      let dias=0;
      if(!lp){const ini=fechaObj(l.inicio);if(ini&&ini<hoy)dias=Math.floor((hoy-ini)/86400000);else return;}
      else{const h=new Date(lp.fecha_hasta);if(h>=hoy)return;dias=Math.floor((hoy-h)/86400000);}
      if(dias<=0) return;
      porEst[l.estacion]=(porEst[l.estacion]||0)+Math.ceil(dias/30)*monto;
    });
    const top=Object.entries(porEst).sort((a,b)=>b[1]-a[1]).slice(0,10);
    chartModalInst = new Chart(canvas, {
      type:'bar', data:{ labels:top.map(e=>e[0]), datasets:[{ data:top.map(e=>e[1]), backgroundColor:'#fbbf24', borderRadius:6 }] },
      options:{ indexAxis:'y', responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}}, scales:{x:{beginAtZero:true}} }
    });
    tabla.innerHTML = tablaHTML(['Estación','Deuda estimada'], top.map(([k,v])=>[k, fmt(v)]));
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

  // Cola offline: actualizar indicador al cargar y escuchar cambios de conexión
  _actualizarIndicador();
  window.addEventListener('online', () => {
    mostrarToast('📶 Conexión recuperada — enviando fotos pendientes...');
    setTimeout(() => procesarColaFotos(false), 1500);
  });
  window.addEventListener('offline', () => {
    mostrarToast('📵 Sin conexión — las fotos se guardarán para enviar después');
  });
});
