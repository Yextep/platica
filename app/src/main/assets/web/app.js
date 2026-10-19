// Interfaz de Platica: pestañas, pantallas encima (la «pila»), formularios, aviso de versión y respaldo.
(() => {
  'use strict';
  const M = window.Motor;
  const G = window.Graficas;
  const ANDROID = window.PlaticaAndroid || null;
  const CLAVE = 'platica.datos';
  const CLAVE_POSPUESTA = 'platica.version-pospuesta';
  // La escribe scripts/publicar_version.py. Las apps instaladas la consultan siempre aquí: no cambiar esta dirección.
  const MANIFIESTO = 'https://raw.githubusercontent.com/Yextep/platica/main/version.json';
  const DESCARGAS = 'https://github.com/Yextep/platica/releases/download/';
  const UN_DIA = 864e5;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  const esc = (t) => String(t == null ? '' : t).replace(/[&<>"']/g, (c) => ESC[c]);
  const { pesos, porcentaje } = M;
  // En las cifras pequeñas, desde 10 millones se usa el formato corto para que quepan en una línea.
  const cifra = (v) => (Math.abs(v) >= 1e7 ? M.compacto(v) : pesos(v));
  // «Unos $640.000»: las cifras aproximadas se redondean al mil.
  const unos = (v) => Math.round(v / 1000) * 1000;
  const plural = (n, uno, varios) => `${n.toLocaleString('es-CO')} ${n === 1 ? uno : varios}`;

  // ---------- íconos (trazos de 24×24) ----------
  const c = (x, y, r) => `M${x - r} ${y}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`;
  const ICONOS = {
    inicio: 'M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z',
    lista: 'M9 6h12M9 12h12M9 18h12M4 6h.01M4 12h.01M4 18h.01',
    tarjeta: 'M3 6.5A1.5 1.5 0 0 1 4.5 5h15A1.5 1.5 0 0 1 21 6.5v11a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5zM3 10h18M7 15h4',
    medidor: 'M4 17a8 8 0 1 1 16 0M12 17l4-5M7.5 13.5h.01M12 9h.01',
    menu: 'M4 7h16M4 12h16M4 17h16',
    suma: 'M12 5v14M5 12h14',
    x: 'M6 6l12 12M18 6L6 18',
    atras: 'M15 18l-6-6 6-6',
    adelante: 'M9 18l6-6-6-6',
    bombillo: 'M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.8.8 1 1.6 1 2.5h6c0-.9.2-1.7 1-2.5A6 6 0 0 0 12 3z',
    alerta: 'M12 4l9 16H3zM12 10v4M12 17h.01',
    bolsa: 'M5 8h14l-1 13H6zM9 8V6a3 3 0 0 1 6 0v2',
    casa: 'M3 11l9-7 9 7M5 9.5V20h14V9.5M10 20v-5h4v5',
    salud: 'M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.3a4.3 4.3 0 0 1 7.5 2.5C19.5 15.4 12 20 12 20zM12 10v4.5M9.8 12.2h4.4',
    comida: 'M7 3v7M5 3v5a2 2 0 0 0 4 0V3M7 10v11M17 21V3c-2.2 1.2-3.5 3.6-3.5 7.5h3.5',
    bus: 'M6 4h12a1 1 0 0 1 1 1v12H5V5a1 1 0 0 1 1-1zM5 11h14M7.5 17v3M16.5 17v3M8 14h.01M16 14h.01',
    libro: 'M4 5h5a3 3 0 0 1 3 3v12a2.5 2.5 0 0 0-2.5-2.5H4zM20 5h-5a3 3 0 0 0-3 3v12a2.5 2.5 0 0 1 2.5-2.5H20z',
    herramienta: 'M14.5 6.5a4 4 0 0 0-5.2 5.2L3.5 17.5l3 3 5.8-5.8a4 4 0 0 0 5.2-5.2l-2.4 2.4-2.3-.6-.6-2.3z',
    huella: `${c(8, 8, 1.6)}${c(16, 8, 1.6)}${c(5, 12.5, 1.6)}${c(19, 12.5, 1.6)}M12 13c-2.4 0-4.5 2.7-4.5 4.7 0 1.4 1.2 2 2.3 2 .9 0 1.3-.5 2.2-.5s1.3.5 2.2.5c1.1 0 2.3-.6 2.3-2 0-2-2.1-4.7-4.5-4.7z`,
    ticket: 'M3 7h18v3a2 2 0 0 0 0 4v3H3v-3a2 2 0 0 0 0-4zM14 7v10',
    camisa: 'M8 4L3 7l2 4 3-1v10h8V10l3 1 2-4-5-3c-.6 1.4-2 2.3-4 2.3S8.6 5.4 8 4z',
    regalo: 'M4 11h16v9H4zM3 7.5h18V11H3zM12 7.5V20M12 7.5c-.8-2.6-4.6-3.6-4.6-1.3 0 1.1 1.5 1.3 4.6 1.3zM12 7.5c.8-2.6 4.6-3.6 4.6-1.3 0 1.1-1.5 1.3-4.6 1.3z',
    pantalla: 'M3 5h18v11H3zM8 20h8M12 16v4',
    etiqueta: 'M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9zM7.5 7.5h.01',
    celular: 'M7.5 2.5h9a1 1 0 0 1 1 1v17a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1v-17a1 1 0 0 1 1-1zM11 18h2',
    avion: 'M3 12.5l18-8-5.5 15-3.5-6z',
    bebe: `${c(12, 6, 3)}M6 21v-4a6 6 0 0 1 12 0v4`,
    deporte: `${c(12, 12, 9)}M3 12h18M12 3c2.5 2.4 3.8 5.4 3.8 9s-1.3 6.6-3.8 9M12 3c-2.5 2.4-3.8 5.4-3.8 9s1.3 6.6 3.8 9`,
    lapiz: 'M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4',
    basura: 'M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14',
    check: 'M5 12.5l4.5 4.5L19 7.5',
    info: `${c(12, 12, 9)}M12 11v5M12 8h.01`,
    subir: 'M3 17l6-6 4 4 8-8M15 7h6v6',
    bajar: 'M3 7l6 6 4-4 8 8M15 17h6v-6',
    campana: 'M6 9a6 6 0 0 1 12 0c0 6.5 2.5 8 2.5 8h-17S6 15.5 6 9M10 20.5a2.2 2.2 0 0 0 4 0',
    descarga: 'M12 3v12M7 10l5 5 5-5M5 21h14',
    guardar: 'M12 15V3M7 8l5-5 5 5M5 21h14',
    compartir: `${c(18, 5.5, 2.5)}${c(6, 12, 2.5)}${c(18, 18.5, 2.5)}M8.2 10.8l7.6-4.1M8.2 13.2l7.6 4.1`,
    escudo: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6zM8.5 12l2.5 2.5 4.5-5',
    calculadora: 'M6.5 2.5h11a1 1 0 0 1 1 1v17a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1v-17a1 1 0 0 1 1-1zM8.5 6h7v3.5h-7zM8.5 14h.01M12 14h.01M15.5 14h.01M8.5 18h.01M12 18h.01M15.5 18h.01',
    grafica: 'M5 20V11M10.5 20V5M16 20v-6M21.5 20h-19',
    objetivo: `${c(12, 12, 9)}${c(12, 12, 5)}M12 12h.01`,
    reloj: `${c(12, 12, 9)}M12 7v5l3 2`,
    billetera: 'M4 7.5A2.5 2.5 0 0 1 6.5 5H18v3M4 7.5V18a2 2 0 0 0 2 2h14V8.5H6.5A2.5 2.5 0 0 1 4 7.5zM16 14.2h.01',
    feliz: `${c(12, 12, 9)}M8 14s1.5 2.2 4 2.2 4-2.2 4-2.2M9 9.5h.01M15 9.5h.01`,
    neutra: `${c(12, 12, 9)}M8.5 15h7M9 9.5h.01M15 9.5h.01`,
    triste: `${c(12, 12, 9)}M8 16.5s1.5-2.2 4-2.2 4 2.2 4 2.2M9 9.5h.01M15 9.5h.01`,
    trofeo: 'M8 21h8M12 16.5V21M7 4h10v5a5 5 0 0 1-10 0zM7 6H4v1a3 3 0 0 0 3 3M17 6h3v1a3 3 0 0 1-3 3',
    buscar: `${c(11, 11, 6.5)}M16 16l4.5 4.5`,
    porcentaje: `${c(7, 7, 2.5)}${c(17, 17, 2.5)}M19 5L5 19`,
    moneda: `${c(12, 12, 9)}M12 6.5v11M14.8 9.3c0-1.2-1.2-2-2.8-2s-2.8.8-2.8 2c0 2.8 5.6 1.4 5.6 4.3 0 1.3-1.2 2.1-2.8 2.1s-2.8-.8-2.8-2.1`,
    refrescar: 'M20 11a8 8 0 1 0-2.3 5.7M20 4.5V11h-6.5',
    documento: 'M6 2.5h8.5L19 7v14.5H6zM14 2.5V7.5h5M9 13h6M9 17h6',
    candado: 'M6 11h12v10H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3',
  };
  const icono = (nombre, clase = '') => `<svg class="icono ${clase}" viewBox="0 0 24 24" aria-hidden="true"><path d="${ICONOS[nombre] || ICONOS.etiqueta}"/></svg>`;
  const iconoCat = (cat, chico = true) => `<span class="icono-cat cat-${cat.color}${chico ? ' chico' : ''}">${icono(cat.icono)}</span>`;
  const ICONO_NIVEL = { alerta: 'alerta', aviso: 'info', idea: 'bombillo', bien: 'check' };
  const NOMBRE_NIVEL = { alerta: 'Alerta', aviso: 'Atención', idea: 'Idea', bien: 'Bien' };
  const CARA = { excelente: 'feliz', bueno: 'neutra', regular: 'triste', malo: 'triste' };
  const NOMBRE_IMPACTO = { alto: 'Impacto alto', medio: 'Impacto medio', bajo: 'Impacto bajo' };
  const mayus = (t) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : '');

  // ---------- datos ----------
  let datosDanados = false;
  let soloLectura = false;
  function cargar() {
    let texto = '';
    if (ANDROID) {
      try {
        texto = ANDROID.leerDatos();
      } catch (e) {
        texto = null;
      }
      // null: el archivo existe pero no se pudo leer. No se guarda nada para no pisarlo.
      if (texto === null || texto === undefined) {
        soloLectura = true;
        return M.normalizarEstado(null);
      }
    } else {
      try { texto = localStorage.getItem(CLAVE) || ''; } catch (e) { texto = ''; }
    }
    if (!texto) return M.normalizarEstado(null);
    try {
      return M.normalizarEstado(JSON.parse(texto));
    } catch (e) {
      datosDanados = true;
      try { localStorage.setItem(`${CLAVE}.danado`, texto.slice(0, 4e6)); } catch (e2) { /* sin espacio */ }
      return M.normalizarEstado(null);
    }
  }
  let estado = cargar();
  // Se guarda enseguida (al terminar la acción en curso), para no perder nada si la app se cierra justo después.
  let pendiente = false;
  function guardar() {
    if (pendiente) return;
    pendiente = true;
    queueMicrotask(guardarYa);
  }
  function guardarYa() {
    pendiente = false;
    if (soloLectura) return;
    const json = JSON.stringify(estado);
    if (ANDROID) {
      try { ANDROID.guardarDatos(json); } catch (e) { avisar('No se pudieron guardar los cambios.'); }
    } else {
      try { localStorage.setItem(CLAVE, json); } catch (e) { avisar('No se pudieron guardar los cambios.'); }
    }
    sincronizarRecordatorios();
  }
  document.addEventListener('visibilitychange', () => { if (document.hidden && pendiente) guardarYa(); });
  window.addEventListener('pagehide', () => { if (pendiente) guardarYa(); });
  const deudaPorId = (id) => estado.deudas.find((d) => d.id === id) || null;

  // ---------- navegación ----------
  let pestana = 'inicio';
  let pila = [];
  let claves = 0;
  let renderizada = 0;
  let mesVista = M.mesActual();
  let filtro = { modo: 'gastos', categoria: '', texto: '' };
  let dialogoAbierto = null;
  const vistaActual = () => pila[pila.length - 1] || null;

  function anchoGrafica() {
    return Math.max(240, Math.min(640, document.documentElement.clientWidth) - 58);
  }

  // Campos donde se escribe. Si la pantalla se redibuja mientras uno tiene el foco, el campo se reemplaza por uno nuevo,
  // pierde el foco y Android cierra el teclado. Por eso nada se redibuja encima de un campo activo.
  const CAMPOS_TEXTO = 'input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=file]):not([type=button]):not([type=submit]), textarea, select';
  function escribiendo(contenedor) {
    const activo = document.activeElement;
    return !!activo && activo !== document.body && activo.matches(CAMPOS_TEXTO) && (!contenedor || contenedor.contains(activo));
  }

  function render(refrescar = false) {
    G.ocultarTip();
    if (nuevaVersion && nuevaVersion.obligatoria && (!vistaActual() || vistaActual().tipo !== 'version')) {
      pila = [{ tipo: 'version', clave: ++claves }];
    }
    // Las acciones del usuario quitan antes el foco del campo (ver el manejador de clics); lo que llega solo
    // (la consulta de versión, volver a la app) no reemplaza la pestaña si se está escribiendo en ella.
    if (!escribiendo($('#vista'))) renderPestana();
    renderHoja(refrescar);
    document.body.classList.toggle('con-hoja', pila.length > 0);
    document.body.classList.toggle('obligatoria', !!(nuevaVersion && nuevaVersion.obligatoria));
    G.limpiar();
  }

  const PESTANAS = [
    { id: 'inicio', nombre: 'Inicio', icono: 'inicio' },
    { id: 'movimientos', nombre: 'Movimientos', icono: 'lista' },
    { id: 'deudas', nombre: 'Deudas', icono: 'tarjeta' },
    { id: 'credito', nombre: 'Mi crédito', icono: 'medidor' },
    { id: 'mas', nombre: 'Más', icono: 'menu' },
  ];
  function renderPestana() {
    const vista = $('#vista');
    const html = { inicio: htmlInicio, movimientos: htmlMovimientos, deudas: htmlDeudas, credito: htmlCredito, mas: htmlMas }[pestana]();
    vista.innerHTML = html;
    G.activar(vista);
    if (pestana === 'movimientos') montarMovimientos(vista);
    $('#pestanas').innerHTML = PESTANAS.map((p) => `<button type="button" data-accion="pestana" data-p="${p.id}"${p.id === pestana ? ' aria-current="page"' : ''}`
      + `${p.id === 'mas' && nuevaVersion ? ' class="con-novedad" aria-label="Más. Hay una versión nueva de Platica"' : ''}>${icono(p.icono)}<span>${p.nombre}</span></button>`).join('');
    const fab = $('#agregar');
    const sinFab = pestana === 'credito' || pestana === 'mas';
    document.body.classList.toggle('sin-fab', sinFab);
    if (pestana === 'deudas') {
      fab.dataset.accion = 'nueva-deuda';
      fab.setAttribute('aria-label', 'Agregar una deuda');
    } else if (pestana === 'movimientos' && filtro.modo === 'fijos') {
      fab.dataset.accion = 'nuevo-fijo';
      fab.setAttribute('aria-label', 'Agregar un pago fijo');
    } else {
      fab.dataset.accion = 'nuevo-gasto';
      fab.setAttribute('aria-label', 'Registrar un gasto');
    }
    fab.innerHTML = icono('suma');
  }

  function renderHoja(refrescar) {
    const hoja = $('#hoja');
    const v = vistaActual();
    if (!v) {
      hoja.hidden = true;
      hoja.innerHTML = '';
      renderizada = 0;
      return;
    }
    if (!refrescar && renderizada === v.clave && hoja.innerHTML) return;
    if (renderizada === v.clave && escribiendo(hoja)) return;
    const desplazamiento = renderizada === v.clave ? hoja.scrollTop : 0;
    const datos = VISTAS[v.tipo](v);
    if (!datos) {
      // Lo que mostraba ya no existe (por ejemplo, una deuda eliminada).
      pila.pop();
      renderHoja(true);
      return;
    }
    const cerrar = datos.sinCerrar ? '' : `<button type="button" class="boton-icono" data-accion="atras" aria-label="${pila.length > 1 ? 'Volver' : 'Cerrar'}">${icono(pila.length > 1 ? 'atras' : 'x')}</button>`;
    const barra = datos.sinBarra ? '' : `<div class="barra">${cerrar}<h1>${esc(datos.titulo)}</h1>${datos.accionBarra || ''}</div>`;
    hoja.innerHTML = `<div class="hoja-interior">${barra}<div class="${datos.sinBarra ? '' : 'contenido'}">${datos.html}</div></div>`;
    hoja.hidden = false;
    renderizada = v.clave;
    if (datos.montar) datos.montar(hoja, v);
    G.activar(hoja);
    hoja.scrollTop = desplazamiento;
  }

  function capturar() {
    const v = vistaActual();
    if (v && CAPTURAR[v.tipo] && renderizada === v.clave) CAPTURAR[v.tipo](v, $('#hoja'));
  }
  function mostrar(vista) {
    capturar();
    pila.push({ ...vista, clave: ++claves });
    render();
    $('#hoja').scrollTop = 0;
  }
  function reemplazar(vista) {
    pila.pop();
    pila.push({ ...vista, clave: ++claves });
    render();
  }
  function cerrarVista() {
    pila.pop();
    render();
  }
  function irA(p) {
    pestana = p;
    pila = [];
    render();
    window.scrollTo(0, 0);
  }

  function atras() {
    // Atrás en un diálogo es «Cancelar».
    if (dialogoAbierto) {
      dialogoAbierto(null);
      return true;
    }
    // Si se estaba escribiendo, primero se guarda lo escrito y se sale del campo, para que la pantalla pueda cambiar.
    if (escribiendo()) {
      capturar();
      document.activeElement.blur();
    }
    if (pila.length) {
      // Con una actualización obligatoria, atrás deja que Android cierre la app.
      if (nuevaVersion && nuevaVersion.obligatoria && pila.length === 1) return false;
      if (vistaActual().tipo === 'bienvenida' && !estado.perfil.configurado) {
        if ((vistaActual().paso || 1) > 1) {
          vistaActual().paso -= 1;
          render(true);
          return true;
        }
        return false;
      }
      cerrarVista();
      return true;
    }
    if (pestana !== 'inicio') {
      irA('inicio');
      return true;
    }
    return false;
  }

  // ---------- avisos y diálogos ----------
  let temporizadorAviso = null;
  function avisar(texto, deshacer) {
    const caja = $('#aviso');
    const t = document.createElement('div');
    t.className = 'toast';
    const s = document.createElement('span');
    s.textContent = texto;
    t.appendChild(s);
    if (deshacer) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = 'Deshacer';
      b.addEventListener('click', () => {
        t.remove();
        deshacer();
      });
      t.appendChild(b);
    }
    caja.replaceChildren(t);
    clearTimeout(temporizadorAviso);
    temporizadorAviso = setTimeout(() => t.remove(), deshacer ? 6000 : 3500);
  }

  function abrirDialogo(html, alResolver) {
    const d = $('#dialogo');
    d.innerHTML = `<div class="caja" role="alertdialog" aria-modal="true" aria-labelledby="dlg-titulo">${html}</div>`;
    d.hidden = false;
    return new Promise((resolver) => {
      dialogoAbierto = (valor) => {
        d.hidden = true;
        d.innerHTML = '';
        d.onclick = null;
        dialogoAbierto = null;
        resolver(valor);
      };
      d.onclick = (ev) => {
        const b = ev.target.closest('[data-r]');
        if (b) dialogoAbierto(b.dataset.r === 'si' ? alResolver(d) : b.dataset.r === 'no' ? null : b.dataset.r);
        else if (ev.target === d) dialogoAbierto(null);
      };
      const foco = $('input', d) || $('[data-r=si]', d);
      if (foco) foco.focus();
      const formulario = $('form', d);
      // Enter en el campo envía el formulario.
      if (formulario) formulario.addEventListener('submit', (ev) => {
        ev.preventDefault();
        if (dialogoAbierto) dialogoAbierto(alResolver(d));
      });
    });
  }
  function confirmar({ titulo, texto, si = 'Aceptar', no = 'Cancelar', peligro = false }) {
    return abrirDialogo(`<h2 id="dlg-titulo">${esc(titulo)}</h2>${texto ? `<p>${esc(texto)}</p>` : ''}
      <div class="botones"><button type="button" class="boton" data-r="no">${esc(no)}</button>
      <button type="button" class="boton ${peligro ? 'peligro lleno' : 'primario'}" data-r="si">${esc(si)}</button></div>`, () => true)
      .then((v) => v === true);
  }
  // Un diálogo con varias opciones: devuelve el valor de la elegida, o null con «Volver».
  function elegir({ titulo, texto, opciones }) {
    return abrirDialogo(`<h2 id="dlg-titulo">${esc(titulo)}</h2>${texto ? `<p>${esc(texto)}</p>` : ''}
      <div class="opciones">${opciones.map((o) => `<button type="button" class="boton ancho ${o.clase || 'borde'}" data-r="${esc(o.valor)}">${esc(o.texto)}</button>`).join('')}
      <button type="button" class="boton ancho" data-r="no">Volver</button></div>`, () => null);
  }
  function pedirMonto({ titulo, texto, valor }) {
    return abrirDialogo(`<form><h2 id="dlg-titulo">${esc(titulo)}</h2>${texto ? `<p>${esc(texto)}</p>` : ''}
      <input class="entrada monto" inputmode="numeric" value="${valor != null ? esc(pesos(valor)) : ''}" aria-label="${esc(titulo)}" style="margin-top:10px">
      <div class="botones"><button type="button" class="boton" data-r="no">Cancelar</button>
      <button type="button" class="boton primario" data-r="si">Guardar</button></div></form>`, (d) => M.leerMonto($('input', d).value))
      .then((v) => (typeof v === 'number' ? v : null));
  }

  // Los campos de dinero muestran el valor con puntos de miles mientras se escribe.
  // El cursor queda después del mismo dígito, así se puede corregir en medio del número.
  function formatearMonto(input) {
    const antes = input.value;
    const cursor = input.selectionStart == null ? antes.length : input.selectionStart;
    const digitos = antes.slice(0, cursor).replace(/\D/g, '').length;
    const n = M.leerMonto(antes);
    const nuevo = n ? pesos(n) : '';
    if (nuevo === antes) return;
    input.value = nuevo;
    let pos = nuevo.startsWith('$') ? 1 : 0;
    for (let vistos = 0; pos < nuevo.length && vistos < digitos; pos++) if (/\d/.test(nuevo[pos])) vistos++;
    if (document.activeElement === input) {
      try { input.setSelectionRange(pos, pos); } catch (e) { /* algunos tipos de campo no tienen cursor */ }
    }
  }
  document.addEventListener('input', (ev) => {
    // Mientras el teclado está componiendo una palabra no se toca el campo; se formatea al terminar.
    if (ev.target.matches('input.monto') && !ev.isComposing) formatearMonto(ev.target);
  });
  document.addEventListener('compositionend', (ev) => {
    if (ev.target.matches('input.monto')) formatearMonto(ev.target);
  });

  // ---------- piezas comunes ----------
  function saludo() {
    const h = new Date().getHours();
    return h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches';
  }
  function primerMes() {
    let primero = estado.perfil.desde || M.mesActual();
    for (const g of estado.gastos) if (g.fecha.slice(0, 7) < primero) primero = g.fecha.slice(0, 7);
    for (const i of estado.ingresos) if (i.fecha.slice(0, 7) < primero) primero = i.fecha.slice(0, 7);
    return primero;
  }
  function selectorMes(accion = 'mes', mes = mesVista) {
    const actual = M.mesActual();
    return `<div class="selector-mes"><button type="button" data-accion="${accion}" data-d="-1" aria-label="Mes anterior"${mes <= primerMes() ? ' disabled' : ''}>${icono('atras')}</button>
      <strong>${esc(M.nombreMes(mes))}</strong>
      <button type="button" data-accion="${accion}" data-d="1" aria-label="Mes siguiente"${mes >= actual ? ' disabled' : ''}>${icono('adelante')}</button></div>`;
  }
  function recoHtml(r) {
    return `<div class="reco nivel-${r.nivel}"><span class="marca">${icono(ICONO_NIVEL[r.nivel])}</span><div>
      <span class="estado ${r.nivel}">${NOMBRE_NIVEL[r.nivel]}</span><strong>${esc(r.titulo)}</strong><p>${esc(r.texto)}</p></div></div>`;
  }
  function barrasCategorias(lista) {
    if (!lista.length) return '';
    const tope = Math.max(...lista.map((c) => Math.max(c.total, M.categoria(estado, c.id).limite || 0)));
    return `<div class="barras-cat">${lista.map((c) => {
      const cat = M.categoria(estado, c.id);
      const limite = cat.limite ? `<i style="left:${Math.min(100, cat.limite / tope * 100)}%" aria-hidden="true"></i>` : '';
      const textoLimite = cat.limite ? `<div class="limite-cat${c.total > cat.limite ? ' pasado' : ''}">Límite ${pesos(cat.limite)} · ${c.total > cat.limite ? `pasado por ${pesos(c.total - cat.limite)}` : `quedan ${pesos(cat.limite - c.total)}`}</div>` : '';
      return `<button type="button" class="barra-cat cat-${cat.color}" data-accion="filtrar-categoria" data-id="${esc(c.id)}">
        <div class="linea-cat"><i class="punto-cat"></i><span class="nombre">${esc(cat.nombre)}</span><strong>${pesos(c.total)}</strong><small>${porcentaje(c.pct)}</small></div>
        <div class="pista"><span style="width:${c.total / tope * 100}%"></span>${limite}</div>${textoLimite}</button>`;
    }).join('')}</div>`;
  }
  function htmlReparto(rep) {
    const partes = [
      { nombre: 'Necesidades', valor: rep.necesidades, pct: rep.pNecesidades, meta: 0.5, color: 'var(--c1)', mayor: true },
      { nombre: 'Gustos', valor: rep.deseos, pct: rep.pDeseos, meta: 0.3, color: 'var(--c2)', mayor: true },
      { nombre: 'Ahorro o abono a deudas', valor: Math.max(0, rep.ahorro), pct: Math.max(0, rep.pAhorro || 0), meta: 0.2, color: 'var(--c3)', mayor: false },
    ];
    const barra = partes.filter((p) => p.pct > 0).map((p) => `<span style="width:${Math.min(100, p.pct * 100)}%;background:${p.color}" title="${esc(p.nombre)}"></span>`).join('');
    return `<div class="apilada" role="img" aria-label="Necesidades ${porcentaje(rep.pNecesidades)}, gustos ${porcentaje(rep.pDeseos)}, ahorro ${porcentaje(rep.pAhorro || 0)}">${barra}</div>
      <div class="leyenda-filas">${partes.map((p) => {
        const fuera = p.mayor ? p.pct > p.meta + 0.005 : p.pct < p.meta - 0.005;
        return `<div><i class="muestra" style="background:${p.color}"></i><span class="nombre">${p.nombre} <span class="meta-chip">· meta ${p.mayor ? 'hasta' : 'al menos'} ${porcentaje(p.meta)}</span></span>
          <strong class="${fuera ? 'texto-aviso' : 'texto-bien'}">${porcentaje(p.pct)}</strong><small>${M.compacto(p.valor)}</small></div>`;
      }).join('')}</div>`;
  }
  function escalaPuntaje(valor, rango) {
    const pos = (v) => {
      const i = M.bandaPuntaje(v);
      const b = M.BANDAS[i];
      return (i + (Math.min(v, b.max) - b.min) / (b.max - b.min + 1)) / M.BANDAS.length * 100;
    };
    const marca = rango
      ? `<span class="rango" style="left:${pos(rango.min)}%;width:${Math.max(0, pos(rango.max) - pos(rango.min))}%"></span>`
      : `<span class="marcador" style="left:${pos(valor)}%"></span>`;
    return `<div class="escala" role="img" aria-label="${rango ? `Entre ${rango.min} y ${rango.max}` : `Puntaje ${valor}`} en una escala de 0 a 1.000">
      <div class="segmentos">${M.BANDAS.map((b, i) => `<span class="b${i + 1}"></span>`).join('')}</div>${marca}
      <div class="etiquetas">${M.BANDAS.map((b) => `<span>${b.min}–${b.max}<br>${b.nombre}</span>`).join('')}</div></div>`;
  }
  function etiquetaNivel(nivel) {
    return nivel ? `<span class="etiqueta-nivel ${nivel}">${mayus(nivel)}</span>` : '<span class="sub">Sin dato</span>';
  }
  const ingresoMes = (mes) => M.ingresoDelMes(estado, mes);

  // ---------- pestaña Inicio ----------
  function htmlInicio() {
    const r = M.resumenMes(estado, mesVista);
    const actual = M.mesActual();
    let html = `<header class="encabezado"><div><span class="saludo">${saludo()}${estado.perfil.nombre ? `, ${esc(estado.perfil.nombre)}` : ''}</span><h1>Tu plata</h1></div></header>`;
    if (soloLectura) {
      html += `<div class="banner critico">${icono('alerta')}<div><strong>No se pudieron leer tus datos</strong><p>Cierra Platica por completo y vuelve a abrirla. Mientras tanto no se guardará nada, para no perder lo que tenías.</p></div></div>`;
    } else if (datosDanados) {
      html += `<div class="banner critico">${icono('alerta')}<div><strong>Tus datos guardados estaban dañados</strong><p>Si tienes un respaldo, restáuralo desde Más → Respaldo.</p></div></div>`;
    }
    html += selectorMes();
    if (r.ingresoPendiente && (r.esActual || r.cantidad)) {
      html += `<div class="banner">${icono('billetera')}<div><strong>${r.esActual ? `¿Cuánto has recibido en ${esc(M.mesSolo(mesVista))}?` : `No registraste ingresos en ${esc(M.mesSolo(mesVista))}`}</strong>
        <p>Tus ingresos son variables: anota lo que te entra cada mes. Si te pagan por partes (quincenas, ventas, honorarios), agrega cada pago.</p>
        <div class="botones"><button type="button" class="boton primario pequeno" data-accion="nuevo-ingreso" data-mes="${mesVista}">${icono('suma')}Agregar ingreso</button></div></div></div>`;
    }
    const pct = r.pctGastado;
    const clase = pct == null ? '' : pct >= 1 ? 'critico' : pct >= 0.85 ? 'aviso' : '';
    const hayIngreso = r.ingresos > 0;
    const etiqueta = !hayIngreso ? (r.esActual ? 'Llevas gastado este mes' : 'Gastaste')
      : r.disponible >= 0 ? (r.esActual ? 'Te queda este mes' : 'Te quedó') : (r.esActual ? 'Te pasaste por' : 'Te faltaron');
    html += `<section class="tarjeta heroe"><span class="etiqueta">${etiqueta}</span>
      <strong class="cifra-heroe${hayIngreso && r.disponible < 0 ? ' negativa' : ''}">${pesos(hayIngreso ? Math.abs(r.disponible) : r.total)}</strong>`;
    if (hayIngreso) {
      html += `<div class="medidor ${clase}" role="meter" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(pct * 100)}" aria-label="Parte de tus ingresos que ya gastaste">
        <span style="width:${Math.min(100, pct * 100)}%"></span></div>
        <div class="medidor-texto"><span>Gastaste el ${porcentaje(pct)} de tus ingresos</span>${r.esActual ? `<span>Día ${r.dia} de ${r.dias}</span>` : ''}</div>`;
      if (r.esActual && r.pendientes > 0) {
        html += `<p class="nota" id="por-pagar">Faltan ${pesos(r.pendientes)} en cuotas y pagos fijos de este mes. Después de pagarlos te ${r.disponible - r.pendientes >= 0 ? `quedarían ${pesos(r.disponible - r.pendientes)}` : `faltarían ${pesos(r.pendientes - r.disponible)}`}.</p>`;
      }
    }
    html += `<div class="cifras">
        <button type="button" class="cifra editable" data-accion="ver-ingresos"><span>Ingresos${icono('lapiz', 'mini')}</span><strong>${cifra(r.ingresos)}</strong><small>${detalleIngresos(r)}</small></button>
        <button type="button" class="cifra" data-accion="pestana" data-p="movimientos"><span>Gastos</span><strong>${cifra(r.total)}</strong><small>${plural(r.cantidad, 'pago', 'pagos')}</small></button>
        <div class="cifra"><span>${r.esActual ? 'Proyección' : 'Por día'}</span><strong>${r.esActual ? (r.dia >= 7 && r.cantidad ? cifra(r.proyeccion) : '—') : cifra(r.total / r.dias)}</strong><small>${r.esActual ? (r.dia >= 7 ? 'al cierre del mes' : 'desde el día 7') : 'en promedio'}</small></div>
      </div></section>`;

    if (!r.cantidad) {
      html += `<section class="tarjeta"><div class="vacio">${icono('moneda')}<p>${r.esActual ? 'Aún no registras gastos este mes. Cada vez que pagues algo, toca + y elige la categoría: toma segundos.' : 'No registraste gastos en este mes.'}</p>
        ${r.esActual ? '<button type="button" class="boton primario" data-accion="nuevo-gasto">Registrar un gasto</button>' : ''}</div></section>`;
    } else {
      html += `<section class="tarjeta"><div class="cabecera-tarjeta"><h2>Cómo va el mes</h2><span class="sub">gasto acumulado</span></div>
        ${G.lineaMes({
          ancho: anchoGrafica(), acumulado: r.acumulado, dia: r.dia, ingresos: r.ingresos, proyeccion: r.esActual ? r.proyeccion : 0,
          color: 'var(--acento)', formatoEje: M.compacto, formatoValor: pesos,
          etiquetaDia: (d, conMes) => (conMes ? `${d} ${M.mesCorto(mesVista)}` : String(d)),
          descripcion: `Gasto acumulado de ${M.nombreMes(mesVista)}: ${pesos(r.total)} de ${pesos(r.ingresos)} de ingresos`,
        })}
        ${r.esActual && r.dia >= 7 && r.dia < r.dias ? `<p class="nota">La línea punteada es la proyección si sigues gastando al mismo ritmo.</p>` : ''}</section>`;
      html += `<section class="tarjeta"><div class="cabecera-tarjeta"><h2>En qué se fue la plata</h2><span class="sub">${plural(r.porCategoria.length, 'categoría', 'categorías')}</span></div>${barrasCategorias(r.porCategoria)}</section>`;
      if (hayIngreso) {
        html += `<section class="tarjeta"><div class="cabecera-tarjeta"><h2>Regla 50/30/20</h2><button type="button" class="enlace" data-accion="articulo" data-id="presupuesto">¿Qué es?</button></div>${htmlReparto(M.reparto(estado, r))}</section>`;
      }
    }
    const recos = M.recomendacionesMes(estado, mesVista);
    if (recos.length) {
      html += `<section class="tarjeta"><div class="cabecera-tarjeta"><h2>Recomendaciones</h2>${recos.length > 3 ? `<button type="button" class="enlace" data-accion="ver-recomendaciones">Ver ${recos.length}</button>` : ''}</div>
        ${recos.slice(0, 3).map(recoHtml).join('')}</section>`;
    }
    // Las cuotas de las deudas y los pagos fijos del mes, juntos y con su estado.
    const pagosMes = M.pagosDelMes(estado, mesVista);
    if (pagosMes.length) {
      const pagado = M.suma(pagosMes.filter((x) => x.estado === 'pagado'), 'monto');
      html += `<section class="tarjeta" id="pagos-mes"><div class="cabecera-tarjeta"><h2>Pagos de ${esc(M.mesSolo(mesVista))}</h2><span class="sub">${pesos(pagado)} de ${pesos(M.suma(pagosMes, 'monto'))}</span></div>
        <div class="lista">${pagosMes.map((x) => filaPagoMes(x, r.esActual)).join('')}</div>
        <div class="botones"><button type="button" class="boton pequeno borde" data-accion="ver-fijos">Pagos fijos</button><button type="button" class="boton pequeno borde" data-accion="pestana" data-p="deudas">Deudas</button></div></section>`;
    }
    const historial = M.historialMeses(estado, mesVista, 6);
    if (historial.filter((h) => h.gastos > 0 || h.ingresos > 0).length >= 2) {
      html += `<section class="tarjeta"><div class="cabecera-tarjeta"><h2>Últimos 6 meses</h2></div>
        ${G.columnas({
          ancho: anchoGrafica(), formatoEje: M.compacto, formatoValor: pesos,
          series: [{ nombre: 'Ingresos', color: 'var(--c1)' }, { nombre: 'Gastos', color: 'var(--c2)' }],
          grupos: historial.map((h) => ({ etiqueta: M.mesCorto(h.mes), titulo: M.nombreMes(h.mes), valores: [h.ingresos, h.gastos], actual: h.mes === mesVista })),
          descripcion: 'Ingresos y gastos de los últimos seis meses',
        })}</section>`;
    }
    if (r.cantidad) {
      html += `<button type="button" class="boton borde ancho" data-accion="ver-resumen">${icono('grafica')}Resumen completo de ${esc(M.mesSolo(mesVista))}</button>`;
    }
    return html;
  }

  const ESTADO_PAGO = { pagado: ['bien', 'Pagado'], hoy: ['aviso', 'Hoy'], pendiente: ['neutro', 'Pendiente'], vencido: ['alerta', 'Vencido'] };
  function chipEstado(x, pasado) {
    const [clase, nombre] = ESTADO_PAGO[x.estado];
    return `<span class="estado ${clase}">${x.estado === 'vencido' && pasado ? 'Sin registrar' : nombre}</span>`;
  }
  // Una cuota o un pago fijo del mes: tocarlo registra el pago (o abre el que ya se registró).
  function filaPagoMes(x, actual) {
    const hoy = M.hoy();
    const icon = x.clase === 'cuota' ? iconoCat({ color: 4, icono: 'tarjeta' }) : iconoCat(M.categoria(estado, x.categoria));
    const cuando = x.estado === 'pagado' ? `pagado el ${M.fechaCorta(x.pago.fecha)}`
      : x.estado === 'vencido' ? (actual ? `venció ${M.fechaRelativa(x.fecha, hoy)}` : `era el ${M.fechaCorta(x.fecha)}`)
        : `${x.automatico ? 'se cobra' : 'vence'} ${M.fechaRelativa(x.fecha, hoy)}`;
    const tipo = x.clase === 'cuota' ? 'Cuota' : x.automatico ? 'Se cobra solo' : 'Pago fijo';
    const accion = x.estado === 'pagado' ? `data-accion="editar-gasto" data-id="${esc(x.pago.id)}"`
      : x.clase === 'cuota' ? `data-accion="pagar-deuda" data-id="${esc(x.id)}"${actual ? '' : ` data-fecha="${x.fecha}"`}`
        : `data-accion="pagar-fijo" data-id="${esc(x.id)}" data-mes="${x.fecha.slice(0, 7)}"`;
    return `<button type="button" class="fila" ${accion}>${icon}<span class="centro"><strong>${esc(x.nombre)}</strong><small>${esc(`${tipo} · ${cuando}`)}</small></span>
      <span class="valor">${pesos(x.monto)}<small>${chipEstado(x, !actual)}</small></span></button>`;
  }

  // ---------- pestaña Movimientos ----------
  function listaMovimientos() {
    const texto = filtro.texto.trim().toLowerCase();
    // Un valor se busca con el mismo formato con que se muestra: «12.000» o «12000» encuentran $12.000, no $120.000.
    const numero = /^[$\s\d.,]+$/.test(texto) && /\d/.test(texto) ? pesos(M.leerMonto(texto)).slice(1) : '';
    const gastos = estado.gastos.filter((g) => g.fecha.startsWith(mesVista)
      && (!filtro.categoria || g.categoria === filtro.categoria)
      && (!texto || `${g.nota} ${M.categoria(estado, g.categoria).nombre}`.toLowerCase().includes(texto) || (numero && pesos(g.monto).includes(numero))))
      .sort((a, b) => b.fecha.localeCompare(a.fecha) || b.id.localeCompare(a.id));
    if (!gastos.length) {
      return `<div class="vacio">${icono('lista')}<p>${filtro.categoria || texto ? 'Nada coincide con el filtro.' : 'No hay gastos registrados en este mes.'}</p></div>`;
    }
    let html = '';
    let dia = '';
    const totalDia = (f) => M.suma(gastos.filter((g) => g.fecha === f && !(g.deuda && g.deuda.sinGasto)), 'monto');
    for (const g of gastos) {
      if (g.fecha !== dia) {
        if (dia) html += '</div>';
        dia = g.fecha;
        html += `<div class="dia-grupo"><span>${esc(M.diaSemana(dia))} ${esc(M.fechaCorta(dia))}</span><span>${pesos(totalDia(dia))}</span></div><div class="lista tarjeta plana">`;
      }
      const cat = M.categoria(estado, g.categoria);
      const deuda = g.deuda ? deudaPorId(g.deuda.id) : null;
      const sinGasto = !!(g.deuda && g.deuda.sinGasto);
      const detalle = [cat.nombre, M.MEDIOS[g.medio], deuda ? `abono a ${deuda.nombre}` : '', g.fijo ? 'pago fijo' : '', sinGasto ? 'no suma a tus gastos' : ''].filter(Boolean).join(' · ');
      html += `<button type="button" class="fila" data-accion="editar-gasto" data-id="${esc(g.id)}">${iconoCat(cat)}
        <span class="centro"><strong>${esc(g.nota || cat.nombre)}</strong><small>${esc(detalle)}</small></span><span class="valor${sinGasto ? ' tenue' : ''}">${pesos(g.monto)}</span></button>`;
    }
    return html + '</div>';
  }
  function htmlMovimientos() {
    const r = M.resumenMes(estado, mesVista);
    let html = `<header class="encabezado"><h1>Movimientos</h1></header>${selectorMes()}
      <div class="segmentado" role="group" aria-label="Tipo de movimiento">
        <button type="button" data-accion="modo-mov" data-m="gastos" aria-pressed="${filtro.modo === 'gastos'}">Gastos</button>
        <button type="button" data-accion="modo-mov" data-m="fijos" aria-pressed="${filtro.modo === 'fijos'}">Fijos</button>
        <button type="button" data-accion="modo-mov" data-m="ingresos" aria-pressed="${filtro.modo === 'ingresos'}">Ingresos</button></div>`;
    if (filtro.modo === 'ingresos') return html + htmlListaIngresos(mesVista);
    if (filtro.modo === 'fijos') return html + htmlListaFijos(mesVista);
    html += `<p class="sub" style="margin:-6px 0 12px">${pesos(r.total)} en ${plural(r.cantidad, 'gasto', 'gastos')} · ingresos ${pesos(r.ingresos)}</p>`;
    const usadas = new Set(r.gastos.map((g) => g.categoria));
    if (filtro.categoria) usadas.add(filtro.categoria);
    html += `<label class="campo"><span class="oculto-visual">Buscar</span><input id="buscar" type="search" class="entrada" placeholder="Buscar por nota, categoría o valor" value="${esc(filtro.texto)}"></label>
      <div class="chips desliza" role="group" aria-label="Filtrar por categoría">
        <button type="button" class="chip" data-accion="filtro-cat" data-id="" aria-pressed="${!filtro.categoria}">Todas</button>
        ${estado.categorias.filter((cat) => usadas.has(cat.id)).map((cat) => `<button type="button" class="chip" data-accion="filtro-cat" data-id="${esc(cat.id)}" aria-pressed="${filtro.categoria === cat.id}"><i class="punto-cat cat-${cat.color}"></i>${esc(cat.nombre)}</button>`).join('')}
      </div><div id="lista-mov" class="mt">${listaMovimientos()}</div>`;
    return html;
  }
  function montarMovimientos(raiz) {
    const buscar = $('#buscar', raiz);
    if (!buscar) return;
    buscar.addEventListener('input', () => {
      filtro.texto = buscar.value;
      $('#lista-mov', raiz).innerHTML = listaMovimientos();
    });
  }
  function detalleIngresos(r) {
    if (r.ingresoFijo) return r.ingresoAjustado ? 'salario ajustado' : r.extras.length ? `salario + ${plural(r.extras.length, 'extra', 'extras')}` : 'salario fijo';
    if (r.ingresoPendiente) return 'sin registrar';
    return plural(r.listaIngresos.length, 'registro', 'registros');
  }
  const filaIngreso = (i, etiqueta) => `<button type="button" class="fila" data-accion="editar-ingreso" data-id="${esc(i.id)}">
    <span class="icono-cat chico cat-6">${icono('billetera')}</span><span class="centro"><strong>${esc(i.concepto)}</strong><small>${etiqueta ? `${etiqueta} · ` : ''}${esc(M.fechaLarga(i.fecha))}</small></span>
    <span class="valor ingreso">+${pesos(i.monto)}</span></button>`;
  function htmlListaIngresos(mes) {
    const ing = ingresoMes(mes);
    let html = '';
    if (ing.fijo) {
      // El salario fijo no se registra: se cuenta solo. Un mes puntual se puede ajustar y los extras se suman.
      html += `<section class="tarjeta"><div class="cabecera-tarjeta"><h2>Salario</h2><span class="sub">${pesos(ing.total)} en total</span></div><div class="lista">`;
      html += ing.ajuste ? filaIngreso(ing.ajuste, 'Salario de este mes')
        : `<div class="fila"><span class="icono-cat chico cat-6">${icono('check')}</span><span class="centro"><strong>Salario fijo</strong><small>Se cuenta solo cada mes</small></span><span class="valor ingreso">+${pesos(ing.salario)}</span></div>`;
      html += `</div>${ing.ajuste ? '<p class="nota">Este mes recibiste otro valor. Si lo eliminas, vuelve a contar tu salario fijo.</p>'
        : `<button type="button" class="boton borde ancho mt" data-accion="ajustar-salario" data-mes="${mes}">Este mes recibí otro valor</button>`}</section>
        <section class="tarjeta"><div class="cabecera-tarjeta"><h2>Ingresos extra</h2><span class="sub">primas, bonos, horas extra…</span></div>
        ${ing.extras.length ? `<div class="lista">${ing.extras.map((i) => filaIngreso(i)).join('')}</div>` : '<p class="texto">No hay ingresos extra en este mes.</p>'}
        <button type="button" class="boton primario ancho mt" data-accion="nuevo-ingreso" data-mes="${mes}">${icono('suma')}Agregar ingreso extra</button></section>
        <p class="nota">Tu salario fijo es de ${pesos(ing.salarioFijo)} al mes. Si cambia, actualízalo en Más → Tu perfil: los meses anteriores conservan el valor de entonces.</p>`;
      return html;
    }
    if (ing.lista.length) {
      html += `<div class="lista tarjeta plana">${ing.lista.map((i) => filaIngreso(i)).join('')}</div>`;
    } else {
      html += `<div class="vacio">${icono('billetera')}<p>${ing.pendiente ? 'Todavía no registras lo que recibiste este mes.' : 'No registraste ingresos en este mes.'}</p></div>`;
    }
    html += `<button type="button" class="boton primario ancho mt" data-accion="nuevo-ingreso" data-mes="${mes}">${icono('suma')}Agregar ingreso</button>
      <p class="nota">Tus ingresos están como variables: cada mes anotas lo que recibes. Si ganas un salario fijo, márcalo en Más → Tu perfil y se contará solo.</p>`;
    return html;
  }

  // ---------- pagos fijos ----------
  function htmlListaFijos(mes) {
    const actual = M.mesActual();
    const activos = estado.fijos.filter((f) => M.fijoActivoEn(f, mes));
    const cancelados = estado.fijos.filter((f) => f.fin && f.fin < mes);
    const items = M.pagosDelMes(estado, mes).filter((x) => x.clase === 'fijo');
    const porId = new Map(items.map((x) => [x.id, x]));
    let html = `<p class="texto">Suscripciones, plan del celular, internet, gimnasio, seguros, arriendo… Se repiten cada mes y no son deudas: no tienen intereses ni cuotas. Platica los registra (o te recuerda pagarlos) y los suma a tu resumen.</p>`;
    if (activos.length) {
      const pagado = M.suma(items.filter((x) => x.estado === 'pagado'), 'monto');
      html += `<section class="tarjeta heroe"><span class="etiqueta">Pagos fijos al mes</span><strong class="cifra-heroe">${pesos(M.suma(activos, 'monto'))}</strong>
        <div class="cifras dos"><div class="cifra"><span>Pagado en ${esc(M.mesSolo(mes))}</span><strong>${cifra(pagado)}</strong></div>
        <div class="cifra"><span>${mes < actual ? 'Sin registrar' : 'Falta'}</span><strong>${cifra(Math.max(0, M.suma(items, 'monto') - pagado))}</strong></div></div></section>
        <div class="lista tarjeta plana">${activos.map((f) => filaFijo(f, porId.get(f.id), mes < actual)).join('')}</div>`;
    } else {
      html += `<div class="vacio">${icono('refrescar')}<p>${mes < actual ? 'No había pagos fijos en este mes.' : 'Aún no tienes pagos fijos.'}</p></div>`;
    }
    html += `<button type="button" class="boton primario ancho mt" data-accion="nuevo-fijo">${icono('suma')}Agregar pago fijo</button>`;
    if (cancelados.length) html += `<h3>Cancelados</h3><div class="lista tarjeta plana">${cancelados.map((f) => filaFijo(f, null, false)).join('')}</div>`;
    return html;
  }
  function filaFijo(f, item, pasado) {
    const cat = M.categoria(estado, f.categoria);
    const estadoTxt = item ? chipEstado(item, pasado) : f.fin ? '<span class="estado neutro">Cancelado</span>' : '';
    return `<button type="button" class="fila" data-accion="ver-fijo" data-id="${esc(f.id)}">${iconoCat(cat)}
      <span class="centro"><strong>${esc(f.nombre)}</strong><small>${esc(`El ${f.dia} de cada mes · ${f.automatico ? 'se cobra solo' : 'lo pagas tú'}`)}</small></span>
      <span class="valor">${pesos(f.monto)}<small>${estadoTxt}</small></span></button>`;
  }
  // Un cobro automático que ya pasó su fecha se registra solo al abrir la app.
  function aplicarCobrosAutomaticos() {
    if (soloLectura || !estado.perfil.configurado) return false;
    const nuevos = M.cobrosAutomaticos(estado);
    if (!nuevos.length) return false;
    estado.gastos.push(...nuevos);
    guardar();
    avisar(nuevos.length === 1 ? `Se registró ${nuevos[0].nota} (${pesos(nuevos[0].monto)}), que se cobra solo.` : `Se registraron ${nuevos.length} pagos fijos que se cobran solos.`);
    return true;
  }

  // ---------- pestaña Deudas ----------
  function htmlDeuda(d) {
    const pagado = M.pctPagado(d);
    const rot = M.esRotativa(d);
    const uso = rot && d.inicial > 0 ? d.saldo / d.inicial : null;
    const fecha = M.proximoPago(d, M.hoy());
    const medidor = uso != null
      ? `<div class="medidor ${uso > 0.87 ? 'critico' : uso > 0.3 ? 'aviso' : ''}"><span style="width:${Math.min(100, uso * 100)}%"></span></div><div class="pie"><span>Usas el ${porcentaje(uso)} del cupo de ${pesos(d.inicial)}</span></div>`
      : pagado != null ? `<div class="medidor"><span style="width:${pagado * 100}%"></span></div><div class="pie"><span>Pagado el ${porcentaje(pagado)} de ${pesos(d.inicial)}</span></div>` : '';
    const estadoTxt = d.cerrada ? '<span class="estado bien">Pagada</span>' : d.estado === 'mora' ? `<span class="estado alerta">En mora${d.diasMora ? ` · ${d.diasMora} días` : ''}</span>` : '';
    return `<button type="button" class="deuda" data-accion="ver-deuda" data-id="${esc(d.id)}">
      <div class="arriba"><strong>${esc(d.nombre)}</strong><span class="valor">${pesos(d.saldo)}</span></div>
      <small>${esc([M.TIPOS_DEUDA[d.tipo].nombre, d.entidad, d.codeudor ? 'como codeudor' : ''].filter(Boolean).join(' · '))}</small> ${estadoTxt}
      ${medidor}${!d.cerrada && fecha ? `<div class="pie"><span>Próxima cuota: ${esc(M.fechaRelativa(fecha, M.hoy()))}</span><span>${M.cuotaUsada(d).cuota ? pesos(M.cuotaUsada(d).cuota) : ''}</span></div>` : ''}</button>`;
  }
  function htmlDeudas() {
    const an = M.analisisCredito(estado);
    const abiertas = estado.deudas.filter((d) => !d.cerrada);
    const cerradas = estado.deudas.filter((d) => d.cerrada);
    let html = `<header class="encabezado"><div><span class="saludo">Tus créditos y obligaciones</span><h1>Deudas</h1></div></header>`;
    if (!estado.deudas.length) {
      return html + `<section class="tarjeta"><div class="vacio">${icono('tarjeta')}<p>Agrega tus tarjetas, créditos y préstamos. Platica calcula cuánto debes en total, cuándo terminas de pagar, cuánto pagas en intereses y cómo afecta tu puntaje.</p>
        <button type="button" class="boton primario" data-accion="nueva-deuda">Agregar mi primera deuda</button></div></section>${bannerFijos()}
        <div class="banner">${icono('info')}<div><strong>¿Tienes tu reporte de Midatacrédito?</strong><p>En «Mi crédito» puedes cargar tu puntaje y tu diagnóstico, y en «Mis deudas y pagos» del reporte están los saldos de cada producto.</p></div></div>`;
    }
    const grupos = Object.entries(an.porGrupo).filter(([, g]) => g.saldo > 0);
    const colores = { plazo_fijo: 'var(--c1)', hipotecario: 'var(--c3)', rotativo: 'var(--c2)', otros: 'var(--c7)' };
    html += `<section class="tarjeta heroe"><span class="etiqueta">Deuda total</span><strong class="cifra-heroe">${pesos(an.total)}</strong>
      ${grupos.length ? `<div class="apilada" role="img" aria-label="Deuda por tipo">${grupos.map(([id, g]) => `<span style="width:${g.saldo / an.total * 100}%;background:${colores[id]}"></span>`).join('')}</div>
      <div class="leyenda-filas">${grupos.map(([id, g]) => `<div><i class="muestra" style="background:${colores[id]}"></i><span class="nombre">${M.GRUPOS_DEUDA[id]}</span><strong>${pesos(g.saldo)}</strong><small>${porcentaje(g.saldo / an.total)}</small></div>`).join('')}</div>` : ''}
      <div class="cifras">
        <div class="cifra"><span>Cuotas al mes</span><strong>${cifra(an.cuotas)}</strong></div>
        <div class="cifra"><span>De tus ingresos</span><strong class="${an.carga > 0.4 ? 'texto-critico' : an.carga > 0.3 ? 'texto-aviso' : ''}">${an.carga != null ? porcentaje(an.carga) : '—'}</strong></div>
        <div class="cifra"><span>Uso de tarjetas</span><strong class="${an.rotUtil > 0.87 ? 'texto-critico' : an.rotUtil > 0.3 ? 'texto-aviso' : ''}">${an.rotUtil != null ? porcentaje(an.rotUtil) : '—'}</strong></div>
      </div></section>`;
    if (an.enMora.length) {
      html += `<div class="banner critico">${icono('alerta')}<div><strong>Tienes ${plural(an.enMora.length, 'deuda', 'deudas')} en mora</strong><p>Ponerte al día es lo primero: cada día de mora alarga el tiempo que dura el reporte negativo.</p></div></div>`;
    }
    html += `<section class="tarjeta"><div class="cabecera-tarjeta"><h2>Activas</h2><span class="sub">${plural(abiertas.length, 'deuda', 'deudas')}</span></div>
      ${abiertas.length ? abiertas.sort((a, b) => b.saldo - a.saldo).map(htmlDeuda).join('') : '<p class="texto">No tienes deudas activas. ¡Muy bien!</p>'}</section>`;
    html += `<div class="herramientas">
      <button type="button" class="herramienta" data-accion="nuevo-pago">${icono('check')}<strong>Registrar un pago</strong><small>Baja el saldo y queda en tus gastos</small></button>
      <button type="button" class="herramienta" data-accion="ver-plan">${icono('objetivo')}<strong>Plan para salir de deudas</strong><small>Por cuál empezar y cuándo terminas</small></button>
      <button type="button" class="herramienta" data-accion="ver-cuota">${icono('calculadora')}<strong>Calculadora de cuotas</strong><small>Cuota, intereses y tabla de pagos</small></button>
      <button type="button" class="herramienta" data-accion="pestana" data-p="credito">${icono('medidor')}<strong>Efecto en tu puntaje</strong><small>Diagnóstico y plan para subirlo</small></button></div>`;
    if (cerradas.length) {
      html += `<section class="tarjeta mt"><div class="cabecera-tarjeta"><h2>Pagadas</h2><span class="sub">${plural(cerradas.length, 'deuda', 'deudas')}</span></div>${cerradas.map(htmlDeuda).join('')}</section>`;
    }
    return html + bannerFijos();
  }
  function bannerFijos() {
    return `<div class="banner mt">${icono('refrescar')}<div><strong>¿Suscripciones, plan del celular o gimnasio?</strong><p>No son deudas: no tienen intereses ni cuotas. Agrégalos como pagos fijos y Platica los tendrá en cuenta cada mes.</p>
      <div class="botones"><button type="button" class="boton primario pequeno" data-accion="ver-fijos">Ver pagos fijos</button></div></div></div>`;
  }

  // ---------- pestaña Mi crédito ----------
  function htmlCredito() {
    const an = M.analisisCredito(estado);
    const p = M.ultimoPuntaje(estado);
    const diag = estado.diagnostico;
    const est = M.factoresEstimados(an);
    let html = `<header class="encabezado"><div><span class="saludo">Puntaje, diagnóstico y simuladores</span><h1>Mi vida crediticia</h1></div></header>`;
    if (p) {
      const b = M.BANDAS[M.bandaPuntaje(p.valor)];
      const anterior = estado.puntajes.length > 1 ? estado.puntajes[estado.puntajes.length - 2] : null;
      const cambio = anterior ? p.valor - anterior.valor : 0;
      html += `<section class="tarjeta"><div class="cabecera-tarjeta"><h2>Tu puntaje</h2><button type="button" class="enlace" data-accion="ver-puntajes">Historial</button></div>
        <div class="puntaje-grande"><strong>${p.valor}</strong><span>${esc(b.nombre)}${anterior ? ` · <span class="${cambio >= 0 ? 'texto-bien' : 'texto-critico'}">${cambio >= 0 ? '+' : ''}${cambio}</span>` : ''}</span></div>
        <span class="sub">${esc(p.fuente)} · ${esc(M.fechaLarga(p.fecha))}</span>${escalaPuntaje(p.valor)}`;
      if (estado.puntajes.length >= 2) html += graficaPuntajes();
      html += `<button type="button" class="boton borde ancho mt" data-accion="nuevo-puntaje">${icono('refrescar')}Actualizar mi puntaje</button></section>`;
    } else {
      html += `<section class="tarjeta"><h2>Tu puntaje</h2><p class="texto">Consúltalo gratis en la app o la página de Midatacrédito (Datacrédito Experian) o en TransUnion, y regístralo aquí cada mes para ver cómo evoluciona. Consultarlo tú mismo no lo baja.</p>
        <button type="button" class="boton primario ancho" data-accion="nuevo-puntaje">Registrar mi puntaje</button></section>`;
    }
    html += `<section class="tarjeta"><div class="cabecera-tarjeta"><h2>Tu diagnóstico</h2><button type="button" class="enlace" data-accion="ver-diagnostico">Ver detalle</button></div>`;
    if (!diag && !an.reportadas) {
      html += `<p class="texto">Carga los resultados de tu diagnóstico de Midatacrédito o agrega tus deudas para que Platica analice los cuatro factores de tu puntaje.</p>`;
    }
    html += Object.entries(M.FACTORES).map(([id, f]) => {
      const rep = diag ? diag.factores[id] : '';
      const hoy = est[id];
      const principal = rep || hoy;
      return `<button type="button" class="factor nivel-${principal || 'nada'}" data-accion="ver-diagnostico" data-f="${id}"><span class="marca">${icono(principal ? CARA[principal] : 'info')}</span>
        <span class="centro"><strong>${f.nombre}</strong><small>${f.descripcion}</small></span>
        <span class="lado">${etiquetaNivel(principal)}${rep && hoy && hoy !== rep ? `<small>Hoy: ${mayus(hoy)}</small>` : rep ? '<small>según tu reporte</small>' : hoy ? '<small>según tus deudas</small>' : ''}</span></button>`;
    }).join('');
    html += `<button type="button" class="boton borde ancho mt" data-accion="editar-reporte">${icono('documento')}${diag ? 'Actualizar mi reporte' : 'Cargar mi reporte de Midatacrédito'}</button></section>`;
    const plan = M.planPuntaje(estado, an);
    if (an.reportadas || diag) {
      html += `<section class="tarjeta"><div class="cabecera-tarjeta"><h2>Plan para subir tu puntaje</h2>${plan.length > 3 ? `<button type="button" class="enlace" data-accion="ver-plan-puntaje">Ver ${plan.length}</button>` : ''}</div>
        ${plan.slice(0, 3).map(accionHtml).join('')}</section>`;
    }
    html += `<h2 class="mt">Herramientas</h2><div class="herramientas">
      <button type="button" class="herramienta" data-accion="ver-simulador-puntaje">${icono('subir')}<strong>Simulador de puntaje</strong><small>Qué pasa si pagas, abres o te atrasas</small></button>
      <button type="button" class="herramienta" data-accion="ver-capacidad">${icono('billetera')}<strong>¿Cuánto me prestarían?</strong><small>Tu capacidad de endeudamiento</small></button>
      <button type="button" class="herramienta" data-accion="ver-cuota">${icono('calculadora')}<strong>Calculadora de cuotas</strong><small>Con E.A. o M.V. y tabla de pagos</small></button>
      <button type="button" class="herramienta" data-accion="ver-plan">${icono('objetivo')}<strong>Plan para salir de deudas</strong><small>Avalancha o bola de nieve</small></button>
      <button type="button" class="herramienta" data-accion="ver-aprende">${icono('libro')}<strong>Aprende</strong><small>Reportes, tasas, tarjetas y tus derechos</small></button>
      <button type="button" class="herramienta" data-accion="ver-usura">${icono('porcentaje')}<strong>Tasa de usura</strong><small>${M.decimal(estado.ajustes.usura.ea, 2)}% E.A. en ${esc(M.mesSolo(estado.ajustes.usura.vigencia))}</small></button></div>`;
    return html;
  }
  function accionHtml(a) {
    return `<div class="reco nivel-${a.impacto === 'alto' ? 'alerta' : a.impacto === 'medio' ? 'aviso' : 'idea'}"><span class="marca">${icono(a.impacto === 'alto' ? 'subir' : a.impacto === 'medio' ? 'objetivo' : 'bombillo')}</span>
      <div><span class="estado ${a.impacto}">${NOMBRE_IMPACTO[a.impacto]}</span><strong>${esc(a.titulo)}</strong><p>${esc(a.texto)}</p></div></div>`;
  }
  function graficaPuntajes() {
    const lista = estado.puntajes.slice(-12);
    const valores = lista.map((p) => p.valor);
    const min = Math.max(0, Math.floor((Math.min(...valores) - 60) / 50) * 50);
    const max = Math.min(1000, Math.ceil((Math.max(...valores) + 60) / 50) * 50);
    return `<div class="mt">${G.lineas({
      ancho: anchoGrafica(), alto: 170, dominio: [min, max], marcadores: true,
      series: [{ nombre: 'Puntaje', color: 'var(--texto)', valores }],
      bandas: M.BANDAS.map((b, i) => ({ min: b.min, max: b.max + 1, color: `var(--banda-${i + 1})` })),
      etiquetaX: (i) => M.fechaCorta(lista[i].fecha), formatoEje: (v) => String(v), formatoValor: (v) => String(v),
      descripcion: `Historial del puntaje: de ${valores[0]} a ${valores[valores.length - 1]}`,
    })}</div>`;
  }

  // ---------- pestaña Más ----------
  function htmlMas() {
    let html = `<header class="encabezado"><h1>Más</h1></header>`;
    if (nuevaVersion) {
      html += `<div class="banner bien">${icono('descarga')}<div><strong>Platica ${esc(nuevaVersion.version)} está disponible</strong><p>Tienes la versión ${esc(app.nombre)}.</p>
        <div class="botones"><button type="button" class="boton primario pequeno" data-accion="ver-version">Actualizar</button></div></div></div>`;
    }
    const fila = (accion, ic, titulo, sub, extra = '') => `<button type="button" class="ajuste" data-accion="${accion}"${extra}>${icono(ic)}<span>${titulo}${sub ? `<small>${sub}</small>` : ''}</span>${icono('adelante', 'chevron')}</button>`;
    html += `<section class="tarjeta">
      ${fila('ver-perfil', 'billetera', 'Tu perfil e ingresos', esc(`${estado.perfil.nombre ? estado.perfil.nombre + ' · ' : ''}${M.periodoDe(estado.perfil, M.mesActual()) ? textoPeriodo(M.periodoDe(estado.perfil, M.mesActual())) : 'Ingresos variables'}`))}
      ${fila('ver-categorias', 'etiqueta', 'Categorías y límites', `${estado.categorias.length} categorías`)}
      ${fila('ver-recordatorios', 'campana', 'Recordatorios', recordatoriosResumen())}
      ${fila('ver-usura', 'porcentaje', 'Tasa de usura', `${M.decimal(estado.ajustes.usura.ea, 2)}% E.A.`)}
      ${fila('ver-respaldo', 'guardar', 'Respaldo y exportar', 'Guarda una copia o pásala a Excel')}
    </section><section class="tarjeta">
      ${fila('ver-aprende', 'libro', 'Aprende sobre finanzas y crédito', '')}
      ${fila('buscar-version', 'refrescar', 'Buscar actualizaciones', app.codigo ? `Tienes la versión ${esc(app.nombre)}` : 'Disponible en la app de Android')}
      ${fila('ver-acerca', 'info', 'Acerca de Platica', '')}
    </section>
    <p class="nota centrado">${icono('candado')}<br>Tus datos se guardan solo en este teléfono. Platica no tiene cuentas ni servidores.</p>`;
    return html;
  }
  function recordatoriosResumen() {
    const a = estado.ajustes;
    const ingresos = a.recordatorioIngresos && !M.esFijo(estado.perfil, M.mesActual());
    const activos = [a.recordatorioCuotas && 'cuotas', a.recordatorioFijos && estado.fijos.length && 'pagos fijos', a.recordatorioDiario && `diario ${a.horaDiario}`,
      a.resumenMensual && 'resumen', ingresos && 'ingresos'].filter(Boolean);
    return activos.length ? mayus(activos.join(', ')) : 'Apagados';
  }

  // ---------- pantallas encima ----------
  const VISTAS = {};
  const CAPTURAR = {};

  VISTAS.bienvenida = (v) => {
    const paso = v.paso || 1;
    const pasos = `<div class="pasos"><span class="hecho"></span><span class="${paso >= 2 ? 'hecho' : ''}"></span></div>`;
    if (paso === 1) {
      return { sinBarra: true, html: `<div class="bienvenida">${pasos}<div class="logo">${icono('moneda')}</div>
        <h1>Bienvenido a Platica</h1><p class="texto">Tu control de gastos, ingresos, deudas y vida crediticia, pensado para Colombia.</p>
        <ul class="ventajas">
          <li>${icono('lista')}<span><strong>Registra tus gastos en segundos</strong>Eliges la categoría y listo: servicios, comida, arriendo, deudas…</span></li>
          <li>${icono('grafica')}<span><strong>Un resumen cada mes</strong>Cuánto gastaste, en qué y qué puedes mejorar.</span></li>
          <li>${icono('medidor')}<span><strong>Mejora tu puntaje de crédito</strong>Tus deudas, tu diagnóstico de Midatacrédito, simuladores y un plan.</span></li>
          <li>${icono('candado')}<span><strong>Privado</strong>Todo se queda en tu teléfono.</span></li>
        </ul>
        <button type="button" class="boton primario ancho" data-accion="bienvenida-siguiente">Empezar</button>
        <label class="boton ancho mt">${icono('guardar')}Tengo un respaldo<input type="file" accept="application/json,.json" class="oculto-visual" data-respaldo></label></div>` };
    }
    const b = v.borrador || (v.borrador = { nombre: estado.perfil.nombre, ...ingresosActuales() });
    return { sinBarra: true, html: `<form class="bienvenida" id="form-bienvenida" autocomplete="off">${pasos}
      <h1>Cuéntame de ti</h1><p class="texto">Con tus ingresos Platica calcula cuánto te queda cada mes y te da recomendaciones.</p>
      <label class="campo"><span>¿Cómo te llamas? (opcional)</span><input id="b-nombre" class="entrada" maxlength="40" value="${esc(b.nombre)}" autocomplete="given-name"></label>
      ${camposIngreso('b', b)}
      <div id="b-error" class="error-texto" hidden></div>
      <button type="submit" class="boton primario ancho">Listo</button>
      <button type="button" class="boton ancho mt" data-accion="atras">Volver</button></form>`,
    montar: (raiz) => {
      montarCamposIngreso(raiz, 'b');
      $('#form-bienvenida', raiz).addEventListener('submit', (ev) => {
        ev.preventDefault();
        const datos = leerCamposIngreso(raiz, 'b');
        if (datos.fijo && !datos.salario) return mostrarError($('#b-error', raiz), 'Escribe cuánto ganas al mes.');
        estado.perfil.nombre = $('#b-nombre', raiz).value.trim().slice(0, 40);
        estado.perfil.desde = estado.perfil.desde || M.mesActual();
        aplicarIngresos(datos);
        estado.perfil.configurado = true;
        estado.vistos.resumen = M.sumarMeses(M.mesActual(), -1);
        guardarYa();
        pila = [];
        render();
        avisar(datos.fijo ? `Listo. Tu salario de ${pesos(datos.salario)} se contará cada mes. Toca + cada vez que pagues algo.`
          : 'Listo. Anota lo que recibas este mes y toca + cada vez que pagues algo.');
      });
    } };
  };
  CAPTURAR.bienvenida = (v, raiz) => {
    if (!$('#b-nombre', raiz)) return;
    v.borrador = { nombre: $('#b-nombre', raiz).value, ...leerCamposIngreso(raiz, 'b') };
  };

  // Campos de ingresos de la bienvenida y del perfil: salario fijo (se cuenta solo) o ingresos variables (se anotan cada mes).
  function ingresosActuales() {
    const vigente = M.periodoDe(estado.perfil, M.mesActual());
    const fijo = !!vigente && vigente.tipo === 'fijo';
    return { fijo, salario: fijo ? vigente.monto : 0, promedio: estado.perfil.ingresoAproximado };
  }
  function camposIngreso(prefijo, b) {
    return `<div class="tarjeta plana" style="padding:4px 14px;margin-bottom:14px">
        <label class="interruptor"><span>Tengo un salario fijo<small>Gano lo mismo todos los meses</small></span><input type="checkbox" id="${prefijo}-fijo"${b.fijo ? ' checked' : ''}></label></div>
      <label class="campo" id="${prefijo}-campo-salario"${b.fijo ? '' : ' hidden'}><span>¿Cuánto ganas al mes?</span>
        <input id="${prefijo}-salario" class="entrada monto" inputmode="numeric" placeholder="$0" value="${b.salario ? esc(pesos(b.salario)) : ''}">
        <small>Se cuenta solo cada mes, sin que tengas que anotarlo. Las primas o los extras los agregas aparte cuando lleguen.</small></label>
      <div id="${prefijo}-campo-variable"${b.fijo ? ' hidden' : ''}>
        <p class="texto">Sin salario fijo, cada mes anotas lo que de verdad recibiste (puedes agregar varios pagos) y Platica te lo recuerda.</p>
        <label class="campo"><span>¿Cuánto recibes en un mes normal? (opcional)</span>
          <input id="${prefijo}-promedio" class="entrada monto" inputmode="numeric" placeholder="$0" value="${b.promedio ? esc(pesos(b.promedio)) : ''}">
          <small>Solo se usa en los simuladores de crédito mientras registras tus primeros meses.</small></label></div>`;
  }
  function montarCamposIngreso(raiz, prefijo) {
    const caja = $(`#${prefijo}-fijo`, raiz);
    caja.addEventListener('change', () => {
      $(`#${prefijo}-campo-salario`, raiz).hidden = !caja.checked;
      $(`#${prefijo}-campo-variable`, raiz).hidden = caja.checked;
    });
  }
  function leerCamposIngreso(raiz, prefijo) {
    return {
      fijo: $(`#${prefijo}-fijo`, raiz).checked,
      salario: M.leerMonto($(`#${prefijo}-salario`, raiz).value),
      promedio: M.leerMonto($(`#${prefijo}-promedio`, raiz).value),
    };
  }
  // La modalidad de ingresos cuenta desde este mes: los meses anteriores conservan la que tenían.
  function aplicarIngresos(datos) {
    const mes = M.mesActual();
    const nuevo = datos.fijo ? { desde: mes, tipo: 'fijo', monto: datos.salario } : { desde: mes, tipo: 'variable', monto: 0 };
    const vigente = M.periodoDe(estado.perfil, mes);
    if (!vigente || vigente.tipo !== nuevo.tipo || vigente.monto !== nuevo.monto) {
      estado.perfil.periodos = M.normalizarPeriodos([...estado.perfil.periodos.filter((x) => x.desde !== mes), nuevo]);
    }
    if (!datos.fijo) estado.perfil.ingresoAproximado = datos.promedio;
  }
  function textoPeriodo(x) {
    return x.tipo === 'fijo' ? `Salario fijo de ${pesos(x.monto)}` : 'Ingresos variables';
  }

  function mostrarError(caja, texto) {
    caja.textContent = texto;
    caja.hidden = false;
    caja.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  // ----- gasto -----
  function borradorGasto(v) {
    if (v.borrador) return v.borrador;
    const g = v.id ? estado.gastos.find((x) => x.id === v.id) : null;
    // fijo: el pago fijo al que corresponde (al pagarlo desde Inicio o desde el pago fijo). repetir: crear un pago fijo con este gasto.
    v.borrador = g
      ? { monto: g.monto, categoria: g.categoria, fecha: g.fecha, medio: g.medio, nota: g.nota, deuda: g.deuda ? g.deuda.id : '', saldoNuevo: null,
        sinGasto: !!(g.deuda && g.deuda.sinGasto), fijo: g.fijo || '', repetir: false, automatico: false }
      : { monto: v.monto || 0, categoria: v.categoria || '', fecha: v.fecha || M.hoy(), medio: v.medio || '', nota: v.nota || '', deuda: v.deuda || '',
        saldoNuevo: null, sinGasto: false, fijo: v.fijo || '', repetir: false, automatico: false };
    return v.borrador;
  }
  // Saldo de la deuda antes de este pago: si se edita un pago, se le devuelve lo que ese pago había abonado.
  function saldoAntesDe(v, idDeuda) {
    const d = deudaPorId(idDeuda);
    if (!d) return 0;
    const previo = v.id ? estado.gastos.find((x) => x.id === v.id) : null;
    return d.saldo + (previo && previo.deuda && previo.deuda.id === idDeuda ? previo.deuda.capital : 0);
  }
  VISTAS.gasto = (v) => {
    const g = v.id ? estado.gastos.find((x) => x.id === v.id) : null;
    if (v.id && !g) return null;
    const b = borradorGasto(v);
    const deudas = estado.deudas.filter((d) => (!d.cerrada && !d.codeudor) || d.id === b.deuda);
    const hoy = M.hoy();
    const html = `<form id="form-gasto" autocomplete="off">
      <div class="monto-grande"><label class="oculto-visual" for="g-monto">Valor</label>
        <input id="g-monto" class="monto" inputmode="numeric" placeholder="$0" value="${b.monto ? esc(pesos(b.monto)) : ''}"><small>¿Cuánto pagaste?</small></div>
      <span class="etiqueta-campo">Categoría</span>
      <div class="rejilla-cat" role="group" aria-label="Categoría">
        ${estado.categorias.map((cat) => `<button type="button" class="cat-boton" data-cat="${esc(cat.id)}" aria-pressed="${b.categoria === cat.id}">${iconoCat(cat, false)}${esc(cat.nombre)}</button>`).join('')}
        <button type="button" class="cat-boton cat-nueva" data-accion="nueva-categoria"><span class="icono-cat">${icono('suma')}</span>Otra</button>
      </div>
      <div id="g-deuda"${b.categoria === 'deudas' ? '' : ' hidden'}>
        ${deudas.length ? `<label class="campo"><span>¿A qué deuda abonaste?</span><select id="g-deuda-id" class="entrada">
          <option value="">Ninguna en particular</option>
          ${deudas.map((d) => `<option value="${esc(d.id)}"${b.deuda === d.id ? ' selected' : ''}>${esc(d.nombre)} · saldo ${esc(pesos(d.saldo))}</option>`).join('')}</select></label>
          <div id="g-reparto"></div><div id="g-tarjeta"></div>`
        : '<p class="nota" style="margin:-6px 0 14px">Agrega tus deudas en la pestaña Deudas para que cada pago baje su saldo automáticamente.</p>'}
      </div>
      <div class="campo"><span class="etiqueta-campo">Fecha</span>
        <div class="chips" style="margin-bottom:8px"><button type="button" class="chip" data-fecha="${hoy}" aria-pressed="${b.fecha === hoy}">Hoy</button>
        <button type="button" class="chip" data-fecha="${M.sumarDias(hoy, -1)}" aria-pressed="${b.fecha === M.sumarDias(hoy, -1)}">Ayer</button></div>
        <input type="date" id="g-fecha" class="entrada" value="${esc(b.fecha)}" max="${hoy}" aria-label="Fecha del gasto"></div>
      <span class="etiqueta-campo">Medio de pago (opcional)</span>
      <div class="chips" id="g-medios">${Object.entries(M.MEDIOS).map(([id, nombre]) => `<button type="button" class="chip" data-medio="${id}" aria-pressed="${b.medio === id}">${nombre}</button>`).join('')}</div>
      <label class="campo mt"><span>Nota (opcional)</span><input id="g-nota" class="entrada" maxlength="120" placeholder="Ej.: mercado de la semana" value="${esc(b.nota)}"></label>
      <div id="g-fijo"${b.categoria === 'deudas' ? ' hidden' : ''}>${htmlFijoDelGasto(b)}</div>
      <div id="g-error" class="error-texto" hidden></div>
      <button type="submit" class="boton primario ancho">${icono('check')}Guardar gasto</button>
      ${g ? `<button type="button" class="boton peligro ancho mt" data-accion="eliminar-gasto" data-id="${esc(g.id)}">${icono('basura')}Eliminar</button>` : ''}
      </form>`;
    return { titulo: g ? 'Editar gasto' : 'Nuevo gasto', html, montar: montarGasto };
  };
  CAPTURAR.gasto = (v, raiz) => {
    const b = borradorGasto(v);
    const monto = $('#g-monto', raiz);
    if (!monto) return;
    b.monto = M.leerMonto(monto.value);
    b.fecha = $('#g-fecha', raiz).value;
    b.nota = $('#g-nota', raiz).value;
    const sel = $('#g-deuda-id', raiz);
    b.deuda = b.categoria === 'deudas' && sel ? sel.value : '';
    const saldo = $('#g-saldo', raiz);
    b.saldoNuevo = saldo && saldo.dataset.manual ? M.leerMonto(saldo.value) : null;
    const sinGasto = $('#g-sin-gasto', raiz);
    b.sinGasto = !!(sinGasto && sinGasto.checked);
    const repetir = $('#g-repetir', raiz);
    b.repetir = !!(repetir && repetir.checked);
    const automatico = $('#g-automatico', raiz);
    b.automatico = !!(automatico && automatico.checked);
  };
  // Un gasto que se repite cada mes (suscripción, plan del celular) puede quedar como pago fijo desde aquí.
  function htmlFijoDelGasto(b) {
    const f = b.fijo ? estado.fijos.find((x) => x.id === b.fijo) : null;
    if (f) {
      return `<div class="banner bien">${icono('refrescar')}<div><p>Pago fijo: <strong style="display:inline">${esc(f.nombre)}</strong>. Este gasto es el pago de ${esc(M.mesSolo(b.fecha.slice(0, 7)))}.</p></div></div>`;
    }
    return `<div class="tarjeta plana" style="padding:4px 14px;margin-bottom:14px">
      <label class="interruptor"><span>Es un pago fijo cada mes<small>Suscripciones, plan del celular, gimnasio, seguros… No son deudas: Platica los tiene en cuenta cada mes.</small></span><input type="checkbox" id="g-repetir"${b.repetir ? ' checked' : ''}></label>
      <label class="interruptor" id="g-auto-campo"${b.repetir ? '' : ' hidden'}><span>Se cobra solo<small>Débito automático: Platica lo registra el mismo día cada mes. Si lo pagas tú, te recuerda pagarlo.</small></span><input type="checkbox" id="g-automatico"${b.automatico ? ' checked' : ''}></label></div>`;
  }
  function montarGasto(raiz, v) {
    const b = borradorGasto(v);
    const monto = $('#g-monto', raiz);
    const actualizarReparto = () => {
      const caja = $('#g-reparto', raiz);
      const sel = $('#g-deuda-id', raiz);
      if (!caja || !sel) return;
      const d = deudaPorId(sel.value);
      if (!d) {
        caja.innerHTML = '';
        const tarjeta = $('#g-tarjeta', raiz);
        if (tarjeta) tarjeta.innerHTML = '';
        return;
      }
      const antes = saldoAntesDe(v, d.id);
      const pago = M.leerMonto(monto.value);
      const rp = M.repartoPago(antes, d.tasa, pago);
      const campo = $('#g-saldo', raiz);
      const manual = campo && campo.dataset.manual ? campo.value : null;
      // Pago de una tarjeta: si las compras ya se registraron como gastos, el pago no se cuenta otra vez.
      const tarjeta = $('#g-tarjeta', raiz);
      if (tarjeta) {
        const compras = M.suma(estado.gastos.filter((g) => g.medio === 'credito' && g.fecha.startsWith(M.mesActual())), 'monto');
        tarjeta.innerHTML = M.esRotativa(d) ? `<div class="tarjeta plana" style="padding:4px 14px;margin:-4px 0 14px">
          <label class="interruptor"><span>Las compras ya están en mis gastos<small>Actívalo si registraste cada compra con «Tarjeta de crédito»: el pago baja la deuda pero no se cuenta otra vez como gasto.${compras ? ` Este mes registraste ${esc(pesos(compras))} en compras con tarjeta.` : ''}</small></span>
          <input type="checkbox" id="g-sin-gasto"${b.sinGasto ? ' checked' : ''}></label></div>` : '';
      }
      caja.innerHTML = `<div class="resultado" style="margin:-4px 0 14px"><p class="sub" style="margin:0 0 10px">${d.tasa.valor > 0
        ? `De este pago, unos ${pesos(rp.interes)} serían intereses del mes y ${pesos(rp.capital)} abono a capital.`
        : 'Sin tasa registrada, todo el pago se toma como abono a capital.'}</p>
        <label class="campo" style="margin:0"><span>Saldo después del pago</span><input id="g-saldo" class="entrada monto" inputmode="numeric" value="${esc(manual != null ? manual : pesos(b.saldoNuevo != null ? b.saldoNuevo : rp.saldo))}"${manual != null || b.saldoNuevo != null ? ' data-manual="1"' : ''}>
        <small>Corrígelo si tu banco muestra otro saldo.</small></label></div>`;
      $('#g-saldo', raiz).addEventListener('input', (ev) => { ev.target.dataset.manual = '1'; });
    };
    monto.addEventListener('input', () => {
      const campo = $('#g-saldo', raiz);
      if (campo && !campo.dataset.manual) actualizarReparto();
    });
    for (const boton of $$('[data-cat]', raiz)) {
      boton.addEventListener('click', () => {
        b.categoria = boton.dataset.cat;
        $$('[data-cat]', raiz).forEach((x) => x.setAttribute('aria-pressed', String(x === boton)));
        $('#g-deuda', raiz).hidden = b.categoria !== 'deudas';
        $('#g-fijo', raiz).hidden = b.categoria === 'deudas';
        actualizarReparto();
      });
    }
    const repetir = $('#g-repetir', raiz);
    if (repetir) repetir.addEventListener('change', () => { $('#g-auto-campo', raiz).hidden = !repetir.checked; });
    $('#g-tarjeta', raiz)?.addEventListener('change', (ev) => { if (ev.target.id === 'g-sin-gasto') b.sinGasto = ev.target.checked; });
    const sel = $('#g-deuda-id', raiz);
    if (sel) {
      sel.addEventListener('change', () => {
        const d = deudaPorId(sel.value);
        b.saldoNuevo = null;
        if (d && !M.leerMonto(monto.value)) {
          const cuota = M.cuotaUsada(d).cuota;
          if (cuota) monto.value = pesos(cuota);
        }
        const campo = $('#g-saldo', raiz);
        if (campo) delete campo.dataset.manual;
        actualizarReparto();
      });
    }
    for (const chip of $$('[data-fecha]', raiz)) {
      chip.addEventListener('click', () => {
        $('#g-fecha', raiz).value = chip.dataset.fecha;
        $$('[data-fecha]', raiz).forEach((x) => x.setAttribute('aria-pressed', String(x === chip)));
      });
    }
    $('#g-fecha', raiz).addEventListener('change', (ev) => {
      $$('[data-fecha]', raiz).forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.fecha === ev.target.value)));
    });
    for (const chip of $$('[data-medio]', raiz)) {
      chip.addEventListener('click', () => {
        b.medio = b.medio === chip.dataset.medio ? '' : chip.dataset.medio;
        $$('[data-medio]', raiz).forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.medio === b.medio)));
      });
    }
    actualizarReparto();
    $('#form-gasto', raiz).addEventListener('submit', (ev) => {
      ev.preventDefault();
      guardarGasto(v, raiz);
    });
    if (!v.id && !b.monto) setTimeout(() => monto.focus(), 60);
  }

  function quitarEfectoDeuda(gasto) {
    if (!gasto || !gasto.deuda) return;
    const d = deudaPorId(gasto.deuda.id);
    if (!d) return;
    d.saldo = Math.max(0, d.saldo + gasto.deuda.capital);
    if (d.cerrada && d.saldo > 0 && d.cerradaFecha === gasto.fecha) {
      d.cerrada = false;
      d.cerradaFecha = '';
    }
    d.historial.push({ fecha: M.hoy(), saldo: d.saldo });
    d.historial = d.historial.slice(-240);
  }
  function guardarGasto(v, raiz) {
    CAPTURAR.gasto(v, raiz);
    const b = borradorGasto(v);
    const error = $('#g-error', raiz);
    if (!(b.monto > 0)) return mostrarError(error, 'Escribe cuánto pagaste.');
    if (!b.categoria) return mostrarError(error, 'Elige una categoría.');
    if (!M.esFecha(b.fecha)) return mostrarError(error, 'Elige una fecha válida.');
    if (b.fecha > M.hoy()) return mostrarError(error, 'La fecha no puede ser futura.');
    const previo = v.id ? estado.gastos.find((x) => x.id === v.id) : null;
    let pagoDeuda = null;
    let terminada = null;
    const d = b.categoria === 'deudas' && b.deuda ? deudaPorId(b.deuda) : null;
    const antes = d ? saldoAntesDe(v, d.id) : 0;
    quitarEfectoDeuda(previo);
    if (d) {
      const nuevo = b.saldoNuevo != null ? b.saldoNuevo : M.repartoPago(antes, d.tasa, b.monto).saldo;
      const capital = d.saldo - nuevo;
      pagoDeuda = { id: d.id, capital, interes: Math.max(0, b.monto - Math.max(0, capital)), sinGasto: !!(b.sinGasto && M.esRotativa(d)) };
      d.saldo = nuevo;
      d.historial.push({ fecha: b.fecha, saldo: nuevo });
      d.historial = d.historial.slice(-240);
      if (nuevo === 0 && !d.cerrada) {
        d.cerrada = true;
        d.cerradaFecha = b.fecha;
        terminada = d;
      }
    }
    // Pago fijo: el que ya tenía, o uno nuevo si se marcó «Es un pago fijo cada mes».
    let fijoId = !pagoDeuda && b.fijo && estado.fijos.some((f) => f.id === b.fijo) ? b.fijo : null;
    let fijoNuevo = null;
    if (!fijoId && !pagoDeuda && b.repetir) {
      fijoNuevo = { id: M.idNuevo(), nombre: (b.nota.trim() || M.categoria(estado, b.categoria).nombre).slice(0, 60), monto: b.monto, categoria: b.categoria,
        dia: M.partes(b.fecha).d, medio: b.medio, automatico: b.automatico, desde: b.fecha.slice(0, 7), fin: '', omitidos: [], notas: '', creado: M.hoy() };
      estado.fijos.push(fijoNuevo);
      fijoId = fijoNuevo.id;
    }
    if (fijoId) {
      const f = estado.fijos.find((x) => x.id === fijoId);
      f.omitidos = f.omitidos.filter((m) => m !== b.fecha.slice(0, 7));
    }
    const gasto = { id: previo ? previo.id : M.idNuevo(), fecha: b.fecha, monto: b.monto, categoria: b.categoria, nota: b.nota.trim().slice(0, 120), medio: b.medio,
      deuda: pagoDeuda, fijo: fijoId };
    if (previo) estado.gastos[estado.gastos.indexOf(previo)] = gasto;
    else estado.gastos.push(gasto);
    guardar();
    pila.pop();
    if (gasto.fecha.slice(0, 7) !== mesVista && !previo) mesVista = gasto.fecha.slice(0, 7);
    render();
    if (terminada) avisar(`¡Terminaste de pagar ${terminada.nombre}! Pide el paz y salvo.`);
    else if (previo) avisar('Gasto actualizado');
    else {
      const texto = fijoNuevo ? `Guardado. ${fijoNuevo.nombre} quedó como pago fijo el ${fijoNuevo.dia} de cada mes.` : `Guardado: ${pesos(gasto.monto)} en ${M.categoria(estado, gasto.categoria).nombre}`;
      avisar(texto, () => {
        eliminarGasto(gasto.id, false);
        if (fijoNuevo) {
          estado.fijos = estado.fijos.filter((f) => f !== fijoNuevo);
          guardar();
          render(true);
        }
      });
    }
  }
  function eliminarGasto(id, conDeshacer = true) {
    const g = estado.gastos.find((x) => x.id === id);
    if (!g) return;
    const copiaDeuda = g.deuda ? JSON.parse(JSON.stringify(deudaPorId(g.deuda.id))) : null;
    quitarEfectoDeuda(g);
    // Si era un cobro automático, ese mes queda omitido para que Platica no lo vuelva a registrar.
    const fijo = g.fijo ? estado.fijos.find((f) => f.id === g.fijo) : null;
    const mes = g.fecha.slice(0, 7);
    const omitir = !!(fijo && fijo.automatico && !fijo.omitidos.includes(mes));
    if (omitir) fijo.omitidos.push(mes);
    estado.gastos = estado.gastos.filter((x) => x.id !== id);
    guardar();
    render(true);
    if (conDeshacer) {
      avisar('Gasto eliminado', () => {
        if (omitir) fijo.omitidos = fijo.omitidos.filter((m) => m !== mes);
        estado.gastos.push(g);
        if (copiaDeuda) {
          const i = estado.deudas.findIndex((d) => d.id === copiaDeuda.id);
          if (i >= 0) estado.deudas[i] = copiaDeuda;
        }
        guardar();
        render(true);
      });
    }
  }

  // ----- ingresos -----
  VISTAS.ingresos = (v) => ({ titulo: `Ingresos de ${M.mesSolo(v.mes)}`, html: `${selectorMes('mes-ingresos', v.mes)}${htmlListaIngresos(v.mes)}` });
  const CONCEPTOS = ['Salario', 'Quincena', 'Prima', 'Bonificación', 'Horas extra', 'Honorarios', 'Ventas', 'Otro'];
  // v.clase === 'salario': con salario fijo, el valor que de verdad se recibió ese mes (reemplaza el salario fijo solo en ese mes).
  VISTAS.ingreso = (v) => {
    const i = v.id ? estado.ingresos.find((x) => x.id === v.id) : null;
    if (v.id && !i) return null;
    const mes = i ? i.fecha.slice(0, 7) : (v.mes || M.mesActual());
    const fijo = M.esFijo(estado.perfil, mes);
    const b = v.borrador || (v.borrador = i ? { ...i } : {
      monto: v.monto || 0, tipo: v.clase === 'salario' ? 'salario' : 'ingreso',
      concepto: v.clase === 'salario' ? `Salario de ${M.mesSolo(mes)}` : fijo ? 'Prima' : 'Salario',
      fecha: mes !== M.mesActual() ? `${mes}-01` : M.hoy(),
    });
    const titulo = i ? 'Editar ingreso' : b.tipo === 'salario' ? `Salario de ${M.mesSolo(mes)}` : fijo ? 'Ingreso extra' : 'Nuevo ingreso';
    return { titulo, html: `<form id="form-ingreso" autocomplete="off">
      <div class="monto-grande"><label class="oculto-visual" for="i-monto">Valor</label><input id="i-monto" class="monto" inputmode="numeric" placeholder="$0" value="${b.monto ? esc(pesos(b.monto)) : ''}"><small>¿Cuánto recibiste?</small></div>
      ${fijo ? `<span class="etiqueta-campo">¿Qué es este ingreso?</span>
        <div class="segmentado" role="group"><button type="button" data-clase="ingreso" aria-pressed="${b.tipo !== 'salario'}">Un ingreso extra</button><button type="button" data-clase="salario" aria-pressed="${b.tipo === 'salario'}">Mi salario de este mes</button></div>
        <p class="nota" id="i-nota-salario" style="margin:-6px 0 14px"${b.tipo === 'salario' ? '' : ' hidden'}>Reemplaza tu salario fijo solo en este mes; por ejemplo, si por una incapacidad te pagaron menos.</p>` : ''}
      <div id="i-conceptos"${b.tipo === 'salario' ? ' hidden' : ''}><span class="etiqueta-campo">Concepto</span>
      <div class="chips" style="margin-bottom:10px">${CONCEPTOS.map((t) => `<button type="button" class="chip" data-concepto="${esc(t)}" aria-pressed="${b.concepto === t}">${esc(t)}</button>`).join('')}</div></div>
      <label class="campo"><span class="oculto-visual">Concepto</span><input id="i-concepto" class="entrada" maxlength="60" value="${esc(b.concepto)}"></label>
      <label class="campo"><span>Fecha</span><input type="date" id="i-fecha" class="entrada" value="${esc(b.fecha)}" max="${M.hoy()}"></label>
      <div id="i-error" class="error-texto" hidden></div>
      <button type="submit" class="boton primario ancho">${icono('check')}Guardar ingreso</button>
      ${i ? `<button type="button" class="boton peligro ancho mt" data-accion="eliminar-ingreso" data-id="${esc(i.id)}">${icono('basura')}Eliminar</button>` : ''}</form>`,
    montar: (raiz) => {
      for (const chip of $$('[data-concepto]', raiz)) {
        chip.addEventListener('click', () => {
          $('#i-concepto', raiz).value = chip.dataset.concepto;
          $$('[data-concepto]', raiz).forEach((x) => x.setAttribute('aria-pressed', String(x === chip)));
        });
      }
      for (const boton of $$('[data-clase]', raiz)) {
        boton.addEventListener('click', () => {
          b.tipo = boton.dataset.clase;
          $$('[data-clase]', raiz).forEach((x) => x.setAttribute('aria-pressed', String(x === boton)));
          $('#i-nota-salario', raiz).hidden = b.tipo !== 'salario';
          $('#i-conceptos', raiz).hidden = b.tipo === 'salario';
          const concepto = $('#i-concepto', raiz);
          if (b.tipo === 'salario') concepto.value = `Salario de ${M.mesSolo(mes)}`;
          else if (/^Salario de /.test(concepto.value)) concepto.value = 'Prima';
        });
      }
      $('#form-ingreso', raiz).addEventListener('submit', (ev) => {
        ev.preventDefault();
        const monto = M.leerMonto($('#i-monto', raiz).value);
        const fecha = $('#i-fecha', raiz).value;
        const concepto = $('#i-concepto', raiz).value.trim().slice(0, 60) || 'Ingreso';
        if (!monto) return mostrarError($('#i-error', raiz), 'Escribe cuánto recibiste.');
        if (!M.esFecha(fecha) || fecha > M.hoy()) return mostrarError($('#i-error', raiz), 'Elige una fecha válida.');
        const tipo = b.tipo === 'salario' && M.esFijo(estado.perfil, fecha.slice(0, 7)) ? 'salario' : 'ingreso';
        const registro = { id: i ? i.id : M.idNuevo(), fecha, concepto, monto, tipo };
        // Un mes tiene un solo valor de salario.
        if (tipo === 'salario') estado.ingresos = estado.ingresos.filter((x) => x === i || x.tipo !== 'salario' || x.fecha.slice(0, 7) !== fecha.slice(0, 7));
        if (i) estado.ingresos[estado.ingresos.indexOf(i)] = registro;
        else estado.ingresos.push(registro);
        guardar();
        cerrarVista();
        avisar(i ? 'Ingreso actualizado' : tipo === 'salario' ? `Salario de ${M.mesSolo(fecha.slice(0, 7))}: ${pesos(monto)}` : `Ingreso de ${pesos(monto)} guardado`);
      });
      if (!i && !b.monto) setTimeout(() => $('#i-monto', raiz).focus(), 60);
    } };
  };

  // ----- categorías -----
  VISTAS.categorias = () => ({ titulo: 'Categorías y límites', html: `<p class="texto">Ponle un límite mensual a cualquier categoría y Platica te avisa cuando te acerques. Marca si es una necesidad o un gusto para la regla 50/30/20.</p>
    <div class="lista tarjeta plana">${estado.categorias.map((cat) => `<button type="button" class="fila" data-accion="editar-categoria" data-id="${esc(cat.id)}">${iconoCat(cat)}
      <span class="centro"><strong>${esc(cat.nombre)}</strong><small>${cat.tipo === 'necesidad' ? 'Necesidad' : 'Gusto'}${cat.limite ? ` · límite ${esc(pesos(cat.limite))}` : ''}${cat.base ? '' : ' · propia'}</small></span>${icono('adelante', 'chevron')}</button>`).join('')}</div>
    <button type="button" class="boton primario ancho mt" data-accion="nueva-categoria">${icono('suma')}Nueva categoría</button>` });
  VISTAS.categoria = (v) => {
    const cat = v.id ? estado.categorias.find((x) => x.id === v.id) : null;
    if (v.id && !cat) return null;
    const b = v.borrador || (v.borrador = cat ? { nombre: cat.nombre, icono: cat.icono, tipo: cat.tipo, limite: cat.limite } : { nombre: '', icono: 'etiqueta', tipo: 'deseo', limite: 0 });
    const usados = new Set(estado.categorias.map((x) => x.nombre.toLowerCase()));
    const sugerencias = M.SUGERENCIAS.filter((s) => !usados.has(s.nombre.toLowerCase()));
    const propia = !cat || !cat.base;
    return { titulo: cat ? cat.nombre : 'Nueva categoría', html: `<form id="form-cat" autocomplete="off">
      ${!cat && sugerencias.length ? `<span class="etiqueta-campo">Sugerencias</span><div class="chips" style="margin-bottom:16px">${sugerencias.map((s) => `<button type="button" class="chip" data-sugerencia="${esc(s.nombre)}">${icono(s.icono)}${esc(s.nombre)}</button>`).join('')}</div>` : ''}
      ${propia ? `<label class="campo"><span>Nombre</span><input id="c-nombre" class="entrada" maxlength="30" value="${esc(b.nombre)}" placeholder="Ej.: Transporte"></label>
      <span class="etiqueta-campo">Ícono</span><div class="chips" id="c-iconos" style="margin-bottom:16px">${M.ICONOS_CATEGORIA.map((n) => `<button type="button" class="chip" data-icono="${n}" aria-pressed="${b.icono === n}" aria-label="${n}">${icono(n)}</button>`).join('')}</div>` : ''}
      <span class="etiqueta-campo">¿Qué tipo de gasto es?</span>
      <div class="segmentado" role="group"><button type="button" data-tipo="necesidad" aria-pressed="${b.tipo === 'necesidad'}">Necesidad</button><button type="button" data-tipo="deseo" aria-pressed="${b.tipo === 'deseo'}">Gusto</button></div>
      <label class="campo"><span>Límite mensual (opcional)</span><input id="c-limite" class="entrada monto" inputmode="numeric" placeholder="Sin límite" value="${b.limite ? esc(pesos(b.limite)) : ''}">
        <small>Te avisa al llegar al 80% y si lo pasas.</small></label>
      <div id="c-error" class="error-texto" hidden></div>
      <button type="submit" class="boton primario ancho">${icono('check')}Guardar</button>
      ${cat && !cat.base ? `<button type="button" class="boton peligro ancho mt" data-accion="eliminar-categoria" data-id="${esc(cat.id)}">${icono('basura')}Eliminar categoría</button>` : ''}</form>`,
    montar: (raiz) => {
      for (const chip of $$('[data-sugerencia]', raiz)) {
        chip.addEventListener('click', () => {
          const s = M.SUGERENCIAS.find((x) => x.nombre === chip.dataset.sugerencia);
          $('#c-nombre', raiz).value = s.nombre;
          b.icono = s.icono;
          b.tipo = s.tipo;
          $$('[data-icono]', raiz).forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.icono === b.icono)));
          $$('[data-tipo]', raiz).forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.tipo === b.tipo)));
        });
      }
      for (const chip of $$('[data-icono]', raiz)) {
        chip.addEventListener('click', () => {
          b.icono = chip.dataset.icono;
          $$('[data-icono]', raiz).forEach((x) => x.setAttribute('aria-pressed', String(x === chip)));
        });
      }
      for (const boton of $$('[data-tipo]', raiz)) {
        boton.addEventListener('click', () => {
          b.tipo = boton.dataset.tipo;
          $$('[data-tipo]', raiz).forEach((x) => x.setAttribute('aria-pressed', String(x === boton)));
        });
      }
      $('#form-cat', raiz).addEventListener('submit', (ev) => {
        ev.preventDefault();
        const limite = M.leerMonto($('#c-limite', raiz).value);
        if (propia) {
          const nombre = $('#c-nombre', raiz).value.trim().replace(/\s+/g, ' ').slice(0, 30);
          if (!nombre) return mostrarError($('#c-error', raiz), 'Escribe un nombre.');
          if (estado.categorias.some((x) => x !== cat && x.nombre.toLowerCase() === nombre.toLowerCase())) {
            return mostrarError($('#c-error', raiz), 'Ya tienes una categoría con ese nombre.');
          }
          if (cat) Object.assign(cat, { nombre, icono: b.icono, tipo: b.tipo, limite });
          else {
            const nueva = { id: `c${M.idNuevo()}`.slice(0, 40), nombre, icono: b.icono, tipo: b.tipo, limite, base: false,
              color: estado.categorias.some((x) => !x.base && x.color === 8) ? 0 : 8 };
            estado.categorias.push(nueva);
            // Si se creó desde el formulario de gasto, queda elegida allí.
            const anterior = pila[pila.length - 2];
            if (anterior && anterior.tipo === 'gasto') borradorGasto(anterior).categoria = nueva.id;
          }
        } else {
          Object.assign(cat, { tipo: b.tipo, limite });
        }
        guardar();
        cerrarVista();
        avisar('Categoría guardada');
      });
    } };
  };

  // ----- pagos fijos -----
  const SUGERENCIAS_FIJO = [
    { nombre: 'Plan del celular', categoria: 'servicios' }, { nombre: 'Internet y TV', categoria: 'servicios' },
    { nombre: 'Streaming', categoria: 'personales' }, { nombre: 'Gimnasio', categoria: 'personales' },
    { nombre: 'Seguro', categoria: 'salud' }, { nombre: 'Arriendo', categoria: 'arriendo' }, { nombre: 'Administración', categoria: 'arriendo' },
  ];
  VISTAS.fijo = (v) => {
    const f = estado.fijos.find((x) => x.id === v.id);
    if (!f) return null;
    const mes = M.mesActual();
    const cat = M.categoria(estado, f.categoria);
    const activo = M.fijoActivoEn(f, mes);
    const item = activo ? M.pagosDelMes(estado, mes).find((x) => x.clase === 'fijo' && x.id === f.id) : null;
    const pagos = estado.gastos.filter((g) => g.fijo === f.id).sort((a, b) => b.fecha.localeCompare(a.fecha));
    const anio = mes.slice(0, 4);
    const cancelado = f.fin && f.fin < mes;
    let html = `<section class="tarjeta heroe"><span class="etiqueta">${esc(cat.nombre)}</span><strong class="cifra-heroe">${pesos(f.monto)}</strong>
      <span class="sub">Al mes · el ${f.dia} de cada mes · ${f.automatico ? 'se cobra solo: Platica lo registra ese día' : 'lo pagas tú: Platica te lo recuerda'}${f.medio ? ` · ${esc(M.MEDIOS[f.medio])}` : ''}</span>
      ${item ? `<p style="margin:10px 0 0">${chipEstado(item, false)} ${esc(M.mesSolo(mes))}</p>` : ''}
      ${cancelado ? `<div class="banner mt">${icono('info')}<div><p>Cancelado. ${f.fin >= f.desde ? `El último pago fue en ${esc(M.mesSolo(f.fin))} de ${f.fin.slice(0, 4)}.` : 'Se canceló antes del primer pago.'} Los pagos que registraste siguen en tu historial.</p></div></div>` : ''}
      ${f.fin === mes ? `<p class="nota">Cancelado desde ${esc(M.mesSolo(M.sumarMeses(mes, 1)))}: este es el último mes.</p>` : ''}
      <div class="botones">${item && item.estado !== 'pagado' ? `<button type="button" class="boton primario" data-accion="pagar-fijo" data-id="${esc(f.id)}" data-mes="${mes}">${icono('check')}Pagar ${esc(M.mesSolo(mes))}</button>` : ''}
        <button type="button" class="boton" data-accion="editar-fijo" data-id="${esc(f.id)}">${icono('lapiz')}Editar</button></div></section>
      <section class="tarjeta"><div class="cabecera-tarjeta"><h2>Pagos registrados</h2><span class="sub">${pesos(M.suma(pagos.filter((g) => g.fecha.startsWith(anio)), 'monto'))} en ${anio}</span></div>
      ${pagos.length ? `<div class="lista">${pagos.slice(0, 24).map((g) => `<button type="button" class="fila" data-accion="editar-gasto" data-id="${esc(g.id)}">${iconoCat(M.categoria(estado, g.categoria))}
        <span class="centro"><strong>${esc(mayus(M.mesSolo(g.fecha.slice(0, 7))))} de ${g.fecha.slice(0, 4)}</strong><small>${esc(M.fechaLarga(g.fecha))}</small></span><span class="valor">${pesos(g.monto)}</span></button>`).join('')}</div>`
        : '<p class="texto">Aún no hay pagos registrados.</p>'}
      ${f.omitidos.length ? `<p class="nota">Sin cobro: ${esc(f.omitidos.slice(-6).map((m) => `${M.mesSolo(m)} ${m.slice(0, 4)}`).join(', '))}.</p>` : ''}</section>
      ${f.fin ? `<button type="button" class="boton ancho" data-accion="reactivar-fijo" data-id="${esc(f.id)}">${icono('refrescar')}${cancelado ? 'Volver a pagarlo' : 'No cancelarlo'}</button>`
        : `<button type="button" class="boton ancho" data-accion="cancelar-fijo" data-id="${esc(f.id)}">${icono('x')}Cancelar este pago</button>`}
      <button type="button" class="boton peligro ancho mt" data-accion="eliminar-fijo" data-id="${esc(f.id)}">${icono('basura')}Eliminar</button>`;
    return { titulo: f.nombre, html };
  };
  VISTAS.fijoForm = (v) => {
    const f = v.id ? estado.fijos.find((x) => x.id === v.id) : null;
    if (v.id && !f) return null;
    const hoy = M.hoy();
    const mes = M.mesActual();
    const b = v.borrador || (v.borrador = f ? { ...f, ya: false }
      : { nombre: '', monto: 0, categoria: 'servicios', dia: M.partes(hoy).d, medio: '', automatico: false, notas: '', ya: true });
    const yaVisible = !f && b.dia && `${mes}-${String(Math.min(b.dia, M.diasDelMes(mes))).padStart(2, '0')}` <= hoy;
    return { titulo: f ? 'Editar pago fijo' : 'Nuevo pago fijo', html: `<form id="form-fijo" autocomplete="off">
      <div class="monto-grande"><label class="oculto-visual" for="f-monto">Valor</label><input id="f-monto" class="monto" inputmode="numeric" placeholder="$0" value="${b.monto ? esc(pesos(b.monto)) : ''}"><small>¿Cuánto pagas cada mes?</small></div>
      <label class="campo"><span>Nombre</span><input id="f-nombre" class="entrada" maxlength="60" value="${esc(b.nombre)}" placeholder="Ej.: plan del celular, Netflix, gimnasio"></label>
      ${f ? '' : `<div class="chips" style="margin:-4px 0 16px">${SUGERENCIAS_FIJO.map((x) => `<button type="button" class="chip" data-sug="${esc(x.nombre)}">${esc(x.nombre)}</button>`).join('')}</div>`}
      <span class="etiqueta-campo">Categoría</span>
      <div class="rejilla-cat" role="group" aria-label="Categoría">${estado.categorias.filter((c) => c.id !== 'deudas').map((cat) => `<button type="button" class="cat-boton" data-cat="${esc(cat.id)}" aria-pressed="${b.categoria === cat.id}">${iconoCat(cat, false)}${esc(cat.nombre)}</button>`).join('')}</div>
      <label class="campo"><span>Día del mes en que se paga</span><input id="f-dia" class="entrada" inputmode="numeric" maxlength="2" placeholder="1 a 31" value="${b.dia || ''}"><small>Si el mes es más corto, cuenta el último día.</small></label>
      <span class="etiqueta-campo">¿Cómo se paga?</span>
      <div class="segmentado" role="group"><button type="button" data-auto="1" aria-pressed="${b.automatico}">Se cobra solo</button><button type="button" data-auto="0" aria-pressed="${!b.automatico}">Lo pago yo</button></div>
      <p class="nota" id="f-auto-nota" style="margin:-6px 0 14px">${b.automatico ? 'Débito automático o cargo a la tarjeta: Platica lo registra como gasto el día del cobro y te avisa la víspera.' : 'Platica te recuerda el día del pago; cuando lo pagues, lo marcas con un toque.'}</p>
      <span class="etiqueta-campo">Medio de pago (opcional)</span>
      <div class="chips" style="margin-bottom:14px">${Object.entries(M.MEDIOS).map(([id, nombre]) => `<button type="button" class="chip" data-medio="${id}" aria-pressed="${b.medio === id}">${nombre}</button>`).join('')}</div>
      ${f ? '' : `<div class="tarjeta plana" id="f-ya-campo" style="padding:4px 14px;margin-bottom:14px"${yaVisible ? '' : ' hidden'}>
        <label class="interruptor"><span>Ya pagué el de ${esc(M.mesSolo(mes))}<small>Lo registro como gasto de este mes.</small></span><input type="checkbox" id="f-ya"${b.ya ? ' checked' : ''}></label></div>`}
      <label class="campo"><span>Notas (opcional)</span><input id="f-notas" class="entrada" maxlength="200" value="${esc(b.notas)}"></label>
      <div id="f-error" class="error-texto" hidden></div>
      <button type="submit" class="boton primario ancho">${icono('check')}Guardar pago fijo</button></form>`,
    montar: (raiz) => {
      const elegirEn = (selector, valor) => $$(selector, raiz).forEach((x) => x.setAttribute('aria-pressed', String(x === valor)));
      for (const chip of $$('[data-sug]', raiz)) {
        chip.addEventListener('click', () => {
          const sug = SUGERENCIAS_FIJO.find((x) => x.nombre === chip.dataset.sug);
          $('#f-nombre', raiz).value = sug.nombre;
          b.categoria = sug.categoria;
          $$('[data-cat]', raiz).forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.cat === b.categoria)));
        });
      }
      for (const boton of $$('[data-cat]', raiz)) {
        boton.addEventListener('click', () => {
          b.categoria = boton.dataset.cat;
          elegirEn('[data-cat]', boton);
        });
      }
      for (const boton of $$('[data-auto]', raiz)) {
        boton.addEventListener('click', () => {
          b.automatico = boton.dataset.auto === '1';
          elegirEn('[data-auto]', boton);
          $('#f-auto-nota', raiz).textContent = b.automatico ? 'Débito automático o cargo a la tarjeta: Platica lo registra como gasto el día del cobro y te avisa la víspera.'
            : 'Platica te recuerda el día del pago; cuando lo pagues, lo marcas con un toque.';
        });
      }
      for (const chip of $$('[data-medio]', raiz)) {
        chip.addEventListener('click', () => {
          b.medio = b.medio === chip.dataset.medio ? '' : chip.dataset.medio;
          $$('[data-medio]', raiz).forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.medio === b.medio)));
        });
      }
      const campoYa = $('#f-ya-campo', raiz);
      $('#f-dia', raiz).addEventListener('input', (ev) => {
        const dia = Math.min(31, M.leerMonto(ev.target.value));
        if (campoYa) campoYa.hidden = !(dia && `${mes}-${String(Math.min(dia, M.diasDelMes(mes))).padStart(2, '0')}` <= hoy);
      });
      $('#form-fijo', raiz).addEventListener('submit', (ev) => {
        ev.preventDefault();
        const error = $('#f-error', raiz);
        const monto = M.leerMonto($('#f-monto', raiz).value);
        const nombre = $('#f-nombre', raiz).value.trim().slice(0, 60);
        const dia = Math.min(31, M.leerMonto($('#f-dia', raiz).value));
        if (!monto) return mostrarError(error, 'Escribe cuánto pagas cada mes.');
        if (!nombre) return mostrarError(error, 'Ponle un nombre (por ejemplo, «Plan del celular»).');
        if (!dia) return mostrarError(error, 'Escribe el día del mes en que se paga (1 a 31).');
        const datos = { nombre, monto, categoria: b.categoria, dia, medio: b.medio, automatico: b.automatico, notas: $('#f-notas', raiz).value.trim().slice(0, 200) };
        if (f) {
          Object.assign(f, datos);
          guardar();
          cerrarVista();
          avisar('Pago fijo actualizado. Los pagos anteriores no cambian.');
          return;
        }
        const nuevo = { id: M.idNuevo(), ...datos, desde: mes, fin: '', omitidos: [], creado: hoy };
        const fecha = M.fechaFijo(nuevo, mes);
        if (fecha <= hoy) {
          const ya = $('#f-ya', raiz);
          if (ya && ya.checked) estado.gastos.push({ id: M.idNuevo(), fecha, monto, categoria: nuevo.categoria, nota: nombre, medio: nuevo.medio, deuda: null, fijo: nuevo.id });
          else if (nuevo.automatico) nuevo.omitidos.push(mes);
        }
        estado.fijos.push(nuevo);
        guardar();
        reemplazar({ tipo: 'fijo', id: nuevo.id });
        avisar(`${nombre} quedó como pago fijo el ${dia} de cada mes.`);
        if (estado.ajustes.recordatorioFijos) ofrecerNotificaciones();
      });
    } };
  };

  // ----- deudas -----
  const DEUDA_VACIA = { nombre: '', entidad: '', tipo: 'libre_inversion', inicial: 0, saldo: 0, cuota: 0, tasa: { valor: 0, tipo: 'EA' }, diaPago: 0, apertura: '',
    plazo: 0, estado: 'al_dia', diasMora: 0, reportada: true, codeudor: false, notas: '', inicio: '', primera: '', pagadas: null, saldoConocido: false, estimados: [] };
  const esRotativo = (tipo) => M.TIPOS_DEUDA[tipo].grupo === 'rotativo';
  function borradorDeuda(v) {
    if (v.borrador) return v.borrador;
    const d = v.id ? deudaPorId(v.id) : null;
    if (!d) return (v.borrador = JSON.parse(JSON.stringify(DEUDA_VACIA)));
    const b = JSON.parse(JSON.stringify(d));
    // Lo que calculó Platica se vuelve a calcular al editar; lo que escribió la persona se conserva.
    if (b.estimados.includes('tasa')) b.tasa = { valor: 0, tipo: 'EA' };
    b.pagadas = null;
    b.saldoConocido = true;
    return (v.borrador = b);
  }
  VISTAS.deudaForm = (v) => {
    const d = v.id ? deudaPorId(v.id) : null;
    if (v.id && !d) return null;
    const b = borradorDeuda(v);
    const rot = esRotativo(b.tipo);
    const monto = (id, valor, placeholder = '$0') => `<input id="${id}" class="entrada monto" inputmode="numeric" placeholder="${placeholder}" value="${valor ? esc(pesos(valor)) : ''}">`;
    return { titulo: d ? 'Editar deuda' : 'Nueva deuda', html: `<form id="form-deuda" autocomplete="off">
      <label class="campo"><span>Tipo</span><select id="d-tipo" class="entrada">${Object.entries(M.TIPOS_DEUDA).map(([id, t]) => `<option value="${id}"${b.tipo === id ? ' selected' : ''}>${esc(t.nombre)}</option>`).join('')}</select></label>
      <div class="banner" id="d-nota-telecom"${b.tipo === 'telecom' ? '' : ' hidden'}>${icono('info')}<div><p>Aquí van los equipos que compraste a cuotas. Si es tu plan pospago del celular o del internet, no es una deuda: agrégalo como <strong style="display:inline">pago fijo</strong> en Movimientos → Fijos.</p></div></div>
      <label class="campo"><span>Nombre</span><input id="d-nombre" class="entrada" maxlength="60" value="${esc(b.nombre)}" placeholder="Ej.: Crédito del celular"></label>
      <label class="campo"><span>Entidad (opcional)</span><input id="d-entidad" class="entrada" maxlength="60" value="${esc(b.entidad)}" placeholder="Banco, almacén, cooperativa, app…"></label>
      <div id="d-sec-fijo-a"${rot ? ' hidden' : ''}>
        <h3>Lo que sabes del crédito</h3><p class="nota" style="margin:-4px 0 12px">Escribe lo que sepas. Con tres de estos datos (lo que te prestaron, la cuota, el número de cuotas o la tasa) Platica calcula el resto.</p>
        <div class="fila-campos">
          <label class="campo"><span>¿Cuánto te prestaron?</span>${monto('d-monto', b.inicial)}</label>
          <label class="campo"><span>Cuota mensual</span>${monto('d-cuota', b.cuota)}</label>
        </div>
        <div class="fila-campos">
          <label class="campo"><span>Número de cuotas</span><input id="d-plazo" class="entrada" inputmode="numeric" maxlength="3" placeholder="Ej.: 12" value="${b.plazo || ''}"></label>
          <label class="campo"><span>Cuotas ya pagadas</span><input id="d-pagadas" class="entrada" inputmode="numeric" maxlength="3" value="${b.pagadas != null ? b.pagadas : ''}"></label>
        </div>
      </div>
      <div id="d-sec-rot-a"${rot ? '' : ' hidden'}>
        <div class="fila-campos">
          <label class="campo"><span>Cupo aprobado</span>${monto('d-cupo', b.inicial)}</label>
          <label class="campo"><span>Saldo actual</span>${monto('d-saldo-rot', b.saldo)}</label>
        </div>
        <div class="fila-campos">
          <label class="campo"><span>Pago mínimo (opcional)</span>${monto('d-minimo', b.cuota)}</label>
          <label class="campo"><span>Día de pago</span><input id="d-dia" class="entrada" inputmode="numeric" maxlength="2" placeholder="1 a 31" value="${b.diaPago || ''}"></label>
        </div>
      </div>
      <div class="campo"><span class="etiqueta-campo" id="d-tasa-txt">${rot ? 'Tasa de interés' : 'Tasa de interés (si la sabes)'}</span><div class="con-sufijo">
        <input id="d-tasa" class="entrada" inputmode="decimal" placeholder="${rot ? 'Ej.: 26,5' : 'Si no la sabes, se calcula'}" value="${b.tasa.valor ? esc(M.decimal(b.tasa.valor, 2)) : ''}" aria-label="Tasa de interés en porcentaje">
        <div class="segmentado" role="group" style="margin:0;flex:none"><button type="button" data-tasa="EA" aria-pressed="${b.tasa.tipo === 'EA'}">% E.A.</button><button type="button" data-tasa="MV" aria-pressed="${b.tasa.tipo === 'MV'}">% M.V.</button></div></div>
        <small id="d-tasa-info"></small></div>
      <div id="d-sec-fijo-b"${rot ? ' hidden' : ''}>
        <div class="fila-campos">
          <label class="campo"><span>¿Cuándo te lo dieron?</span><input id="d-inicio" type="date" class="entrada" value="${esc(b.inicio)}" max="${M.hoy()}"></label>
          <label class="campo"><span>Primera cuota</span><input id="d-primera" type="date" class="entrada" value="${esc(b.primera)}"></label>
        </div>
        <label class="campo"><span>Saldo actual (si lo sabes)</span>${monto('d-saldo', b.saldoConocido ? b.saldo : 0, 'Se calcula')}<small>Lo que te falta pagar de capital, como sale en la app o el extracto de la entidad.</small></label>
        <div id="d-calculo"></div>
      </div>
      <label class="campo" id="d-apertura-campo"${rot ? '' : ' hidden'}><span>Fecha de apertura</span><input id="d-apertura" type="month" class="entrada" value="${esc(b.apertura)}" max="${M.mesActual()}"></label>
      <span class="etiqueta-campo">Estado</span>
      <div class="segmentado" role="group"><button type="button" data-estado="al_dia" aria-pressed="${b.estado === 'al_dia'}">Al día</button><button type="button" data-estado="mora" aria-pressed="${b.estado === 'mora'}">En mora</button></div>
      <label class="campo" id="d-mora-campo"${b.estado === 'mora' ? '' : ' hidden'}><span>Días de mora</span><input id="d-mora" class="entrada" inputmode="numeric" maxlength="4" value="${b.diasMora || ''}"></label>
      <div class="tarjeta plana" style="padding:4px 14px">
        <label class="interruptor"><span>Aparece en centrales de riesgo<small>Bancos, almacenes, cooperativas y muchas apps reportan a Datacrédito y TransUnion</small></span><input type="checkbox" id="d-reportada"${b.reportada ? ' checked' : ''}></label>
        <label class="interruptor"><span>Soy codeudor<small>La deuda es de otra persona y tú la respaldas</small></span><input type="checkbox" id="d-codeudor"${b.codeudor ? ' checked' : ''}></label>
      </div>
      <label class="campo mt"><span>Notas (opcional)</span><textarea id="d-notas" class="entrada" maxlength="200">${esc(b.notas)}</textarea></label>
      <div id="d-error" class="error-texto" hidden></div>
      <button type="submit" class="boton primario ancho">${icono('check')}Guardar deuda</button></form>`,
    montar: montarDeuda };
  };
  // Lee el formulario en el borrador. En un crédito de cuota fija, lo vacío queda en 0 o null: es lo que Platica calcula.
  CAPTURAR.deudaForm = (v, raiz) => {
    const b = v.borrador;
    if (!b || !$('#d-nombre', raiz)) return;
    const tipo = $('#d-tipo', raiz).value;
    const rot = esRotativo(tipo);
    const texto = (id) => $(id, raiz).value.trim();
    Object.assign(b, {
      tipo,
      nombre: $('#d-nombre', raiz).value,
      entidad: $('#d-entidad', raiz).value,
      diasMora: Math.min(3650, M.leerMonto($('#d-mora', raiz).value)),
      reportada: $('#d-reportada', raiz).checked,
      codeudor: $('#d-codeudor', raiz).checked,
      notas: $('#d-notas', raiz).value,
    });
    b.tasa.valor = Math.min(1000, M.leerDecimal($('#d-tasa', raiz).value));
    if (rot) {
      Object.assign(b, {
        inicial: M.leerMonto($('#d-cupo', raiz).value),
        saldo: M.leerMonto($('#d-saldo-rot', raiz).value),
        cuota: M.leerMonto($('#d-minimo', raiz).value),
        diaPago: Math.min(31, M.leerMonto($('#d-dia', raiz).value)),
        apertura: $('#d-apertura', raiz).value,
      });
    } else {
      Object.assign(b, {
        inicial: M.leerMonto($('#d-monto', raiz).value),
        cuota: M.leerMonto($('#d-cuota', raiz).value),
        plazo: Math.min(600, M.leerMonto($('#d-plazo', raiz).value)),
        pagadas: texto('#d-pagadas') ? Math.min(600, M.leerMonto(texto('#d-pagadas'))) : null,
        inicio: $('#d-inicio', raiz).value,
        primera: $('#d-primera', raiz).value,
        saldoConocido: !!texto('#d-saldo'),
        saldo: M.leerMonto($('#d-saldo', raiz).value),
      });
    }
  };
  function calcularCredito(b) {
    return M.completarCredito({ monto: b.inicial, cuota: b.cuota, plazo: b.plazo, tasa: b.tasa, primera: b.primera,
      pagadas: b.pagadas, saldo: b.saldoConocido ? b.saldo : null }, M.hoy());
  }
  function htmlCalculoCredito(r) {
    if (!r.completo) {
      return r.avisos.length ? r.avisos.map((a) => `<div class="banner critico">${icono('alerta')}<div><p>${esc(a.texto)}</p></div></div>`).join('')
        : '<p class="nota">Escribe al menos tres de estos datos: cuánto te prestaron, la cuota, el número de cuotas o la tasa.</p>';
    }
    const calculado = (campo) => (r.calculados.includes(campo) ? ' <small class="calculado">calculado</small>' : '');
    const ea = M.tasaEA({ valor: r.i * 100, tipo: 'MV' });
    const eaCosto = M.tasaEA({ valor: r.iCosto * 100, tipo: 'MV' });
    const filas = [
      ['Tasa', r.i > 0 ? `${M.decimal(r.i * 100, 2)}% M.V. · ${M.decimal(ea * 100, 1)}% E.A.` : 'Sin intereses', 'tasa'],
      ['Cuota mensual', pesos(r.cuota), 'cuota'],
      ['Número de cuotas', String(r.plazo), 'plazo'],
      ['Te prestaron', pesos(r.monto), 'inicial'],
      ['Total a pagar', pesos(r.total), ''],
      ['Intereses y cargos', pesos(r.intereses), ''],
      ['Cuotas pagadas', `${r.pagadas} de ${r.plazo}`, 'pagadas'],
      ['Saldo de capital hoy', pesos(r.saldo), 'saldo'],
    ];
    if (r.proxima) filas.push(['Próxima cuota', M.fechaLarga(r.proxima), '']);
    if (r.fin) filas.push(['Última cuota', M.fechaLarga(r.fin), '']);
    let html = `<div class="resultado calculo"><strong>Platica calculó</strong><ul class="calculos">${filas.map(([k, val, campo]) => `<li><span>${k}</span><strong>${esc(val)}${campo ? calculado(campo) : ''}</strong></li>`).join('')}</ul></div>`;
    if (r.cargos) {
      html += `<div class="banner aviso">${icono('info')}<div><strong>La cuota trae unos ${pesos(r.cargos)} de más cada mes</strong><p>Con la tasa que escribiste la cuota sería menor. La diferencia suele ser seguro de vida, fianza o comisiones. Con todo incluido, el crédito cuesta ${M.decimal(eaCosto * 100, 1)}% E.A.</p></div></div>`;
    }
    if (eaCosto * 100 > estado.ajustes.usura.ea + 0.005) {
      html += `<div class="banner critico">${icono('alerta')}<div><strong>Este crédito cuesta ${M.decimal(eaCosto * 100, 1)}% E.A.</strong><p>Es más que la tasa de usura de consumo (${M.decimal(estado.ajustes.usura.ea, 2)}% E.A. en ${esc(M.mesSolo(estado.ajustes.usura.vigencia))}). Puede incluir seguros, fianzas o comisiones además del interés: pide a la entidad el detalle de la tasa y de cada cargo. Si la tasa de interés sola supera la usura, puedes quejarte ante la Superintendencia Financiera.</p></div></div>`;
    }
    for (const a of r.avisos) html += `<div class="banner ${a.nivel === 'critico' ? 'critico' : 'aviso'}">${icono('alerta')}<div><p>${esc(a.texto)}</p></div></div>`;
    return html;
  }
  function montarDeuda(raiz, v) {
    const b = v.borrador;
    const actualizar = () => {
      CAPTURAR.deudaForm(v, raiz);
      // La tasa: equivalencia y aviso de usura.
      const caja = $('#d-tasa-info', raiz);
      if (!b.tasa.valor) {
        caja.textContent = esRotativo(b.tipo) ? 'La encuentras en el extracto. E.A. es efectiva anual; M.V., mes vencido.' : 'Si no la sabes, déjala vacía: se calcula con la cuota.';
        caja.className = '';
      } else {
        const ea = M.tasaEA(b.tasa);
        const otra = b.tasa.tipo === 'EA' ? `Equivale a ${M.decimal(M.tasaMensual(b.tasa) * 100, 2)}% M.V.` : `Equivale a ${M.decimal(ea * 100, 2)}% E.A.`;
        const usura = ea * 100 > estado.ajustes.usura.ea + 0.005;
        caja.textContent = usura ? `${otra} Supera la tasa de usura (${M.decimal(estado.ajustes.usura.ea, 2)}% E.A.): revísala en tu extracto.` : otra;
        caja.className = usura ? 'texto-critico' : '';
      }
      if (esRotativo(b.tipo)) return;
      const r = calcularCredito(b);
      $('#d-calculo', raiz).innerHTML = htmlCalculoCredito(r);
      // Los campos vacíos muestran lo que se calculó.
      $('#d-pagadas', raiz).placeholder = r.completo ? `${r.pagadas} (calculado)` : 'Se calcula';
      $('#d-saldo', raiz).placeholder = r.completo ? `${pesos(r.saldo)} (calculado)` : 'Se calcula';
    };
    // Los eventos se escuchan en el formulario: #hoja se reutiliza entre pantallas y acumularía escuchas viejas.
    const formulario = $('#form-deuda', raiz);
    formulario.addEventListener('input', actualizar);
    formulario.addEventListener('change', actualizar);
    // La primera cuota se propone un mes después de recibir el crédito, mientras la persona no la cambie.
    const primera = $('#d-primera', raiz);
    if (!primera.value) primera.dataset.auto = '1';
    primera.addEventListener('input', () => { delete primera.dataset.auto; });
    $('#d-inicio', raiz).addEventListener('change', (ev) => {
      if (primera.dataset.auto && ev.target.value) {
        primera.value = M.primeraCuotaDe(ev.target.value);
        actualizar();
      }
    });
    for (const boton of $$('[data-tasa]', raiz)) {
      boton.addEventListener('click', () => {
        b.tasa.tipo = boton.dataset.tasa;
        $$('[data-tasa]', raiz).forEach((x) => x.setAttribute('aria-pressed', String(x === boton)));
        actualizar();
      });
    }
    $('#d-tipo', raiz).addEventListener('change', (ev) => {
      const rot = esRotativo(ev.target.value);
      for (const id of ['#d-sec-fijo-a', '#d-sec-fijo-b']) $(id, raiz).hidden = rot;
      for (const id of ['#d-sec-rot-a', '#d-apertura-campo']) $(id, raiz).hidden = !rot;
      $('#d-tasa-txt', raiz).textContent = rot ? 'Tasa de interés' : 'Tasa de interés (si la sabes)';
      $('#d-tasa', raiz).placeholder = rot ? 'Ej.: 26,5' : 'Si no la sabes, se calcula';
      $('#d-nota-telecom', raiz).hidden = ev.target.value !== 'telecom';
      if (ev.target.value === 'personal') $('#d-reportada', raiz).checked = false;
      actualizar();
    });
    for (const boton of $$('[data-estado]', raiz)) {
      boton.addEventListener('click', () => {
        b.estado = boton.dataset.estado;
        $$('[data-estado]', raiz).forEach((x) => x.setAttribute('aria-pressed', String(x === boton)));
        $('#d-mora-campo', raiz).hidden = b.estado !== 'mora';
      });
    }
    actualizar();
    $('#form-deuda', raiz).addEventListener('submit', (ev) => {
      ev.preventDefault();
      CAPTURAR.deudaForm(v, raiz);
      const error = $('#d-error', raiz);
      const nombre = b.nombre.trim() || M.TIPOS_DEUDA[b.tipo].nombre;
      const datos = { ...b, nombre, estimados: [] };
      if (esRotativo(b.tipo)) {
        if (!b.saldo && !b.inicial) return mostrarError(error, 'Escribe al menos el saldo actual.');
        Object.assign(datos, { plazo: 0, inicio: '', primera: '' });
      } else {
        const r = calcularCredito(b);
        if (r.completo) {
          // Se guarda lo que escribió la persona y, donde no sabía, lo que calculó Platica.
          Object.assign(datos, { inicial: r.monto, cuota: r.cuota, plazo: r.plazo, saldo: r.saldo,
            estimados: r.calculados.filter((x) => ['tasa', 'saldo', 'cuota', 'plazo', 'inicial'].includes(x)) });
          if (r.calculados.includes('tasa')) datos.tasa = { valor: Math.round(r.i * 1e6) / 1e4, tipo: 'MV' };
        } else if (r.avisos.length) {
          return mostrarError(error, r.avisos[0].texto);
        } else {
          if (!b.inicial && !b.saldoConocido) return mostrarError(error, 'Escribe al menos cuánto te prestaron o cuánto debes.');
          if (!b.saldoConocido) {
            datos.saldo = b.inicial;
            datos.estimados = ['saldo'];
          }
        }
        datos.diaPago = b.primera ? M.partes(b.primera).d : 0;
        datos.apertura = b.inicio ? b.inicio.slice(0, 7) : b.apertura;
      }
      const previa = v.id ? deudaPorId(v.id) : null;
      const deuda = M.normalizarEstado({ deudas: [{ ...datos, id: previa ? previa.id : M.idNuevo(), creada: previa ? previa.creada : M.hoy(),
        historial: previa ? previa.historial : [], cerrada: previa ? previa.cerrada : false, cerradaFecha: previa ? previa.cerradaFecha : '' }] }).deudas[0];
      if (!previa || previa.saldo !== deuda.saldo) deuda.historial = [...deuda.historial, { fecha: M.hoy(), saldo: deuda.saldo }].slice(-240);
      if (previa) {
        if (deuda.cerrada && deuda.saldo > 0) {
          deuda.cerrada = false;
          deuda.cerradaFecha = '';
        }
        estado.deudas[estado.deudas.indexOf(previa)] = deuda;
      } else estado.deudas.push(deuda);
      guardar();
      if (previa) cerrarVista();
      else reemplazar({ tipo: 'deuda', id: deuda.id });
      avisar(previa ? 'Deuda actualizada' : 'Deuda agregada');
      if (deuda.diaPago && estado.ajustes.recordatorioCuotas) ofrecerNotificaciones();
    });
  }

  VISTAS.deuda = (v) => {
    const d = deudaPorId(v.id);
    if (!d) return null;
    const p = M.proyeccionDeuda(d);
    const rot = M.esRotativa(d);
    const pagos = M.pagosDe(estado, d.id);
    const fecha = M.proximoPago(d, M.hoy());
    const pagado = M.pctPagado(d);
    const uso = rot && d.inicial > 0 ? d.saldo / d.inicial : null;
    const ea = M.tasaEA(d.tasa);
    let html = `<section class="tarjeta heroe"><span class="etiqueta">${esc([M.TIPOS_DEUDA[d.tipo].nombre, d.entidad].filter(Boolean).join(' · '))}</span>
      <strong class="cifra-heroe">${pesos(d.saldo)}</strong>
      ${d.estimados.includes('saldo') && !pagos.length ? '<p class="sub" style="margin:-6px 0 8px">Saldo de capital calculado por Platica con tus cuotas y fechas</p>' : ''}
      ${d.cerrada ? '<span class="estado bien">Pagada</span>' : d.estado === 'mora' ? `<span class="estado alerta">En mora${d.diasMora ? ` · ${d.diasMora} días` : ''}</span>` : '<span class="estado bien">Al día</span>'}
      ${d.codeudor ? '<span class="estado neutro">Como codeudor</span>' : ''}${!d.reportada ? '<span class="estado neutro">No reportada</span>' : ''}
      ${uso != null ? `<div class="medidor mt ${uso > 0.87 ? 'critico' : uso > 0.3 ? 'aviso' : ''}"><span style="width:${Math.min(100, uso * 100)}%"></span></div><div class="medidor-texto"><span>Usas el ${porcentaje(uso)} de tu cupo de ${pesos(d.inicial)}</span></div>` : ''}
      ${pagado != null ? `<div class="medidor mt"><span style="width:${pagado * 100}%"></span></div><div class="medidor-texto"><span>Has pagado el ${porcentaje(pagado)} de ${pesos(d.inicial)}</span></div>` : ''}
      <div class="cifras">
        <div class="cifra"><span>Cuota</span><strong>${p.cuota ? cifra(p.cuota) : '—'}</strong><small>${p.estimada ? 'estimada' : 'mensual'}</small></div>
        <div class="cifra"><span>Tasa</span><strong>${d.tasa.valor ? `${M.decimal(ea * 100, 1)}%` : '—'}</strong><small>${d.tasa.valor ? `E.A.${d.estimados.includes('tasa') ? ' · calculada' : ` · ${M.decimal(M.tasaMensual(d.tasa) * 100, 2)}% M.V.`}` : 'sin registrar'}</small></div>
        <div class="cifra"><span>Próx. pago</span><strong>${fecha ? esc(M.fechaCorta(fecha)) : '—'}</strong><small>${fecha ? esc(M.fechaRelativa(fecha, M.hoy())) : 'sin día de pago'}</small></div>
      </div>
      ${d.cerrada ? '' : `<div class="botones"><button type="button" class="boton primario" data-accion="pagar-deuda" data-id="${esc(d.id)}">${icono('check')}Registrar pago</button>
        <button type="button" class="boton" data-accion="actualizar-saldo" data-id="${esc(d.id)}">Actualizar saldo</button></div>`}</section>`;
    // Crédito de cuota fija con fechas: en qué cuota va, cuánto cuesta en total y si el costo pasa la usura.
    if (!rot && d.plazo && d.cuota && d.inicial) {
      const numero = d.primera ? Math.min(d.plazo, M.cuotasVencidas(d.primera, d.plazo, M.sumarDias(M.hoy(), -1)) + 1) : 0;
      const costo = M.tasaImplicita(d.inicial, d.cuota, d.plazo);
      const eaCosto = costo != null ? M.tasaEA({ valor: costo * 100, tipo: 'MV' }) : ea;
      html += `<section class="tarjeta"><h2>Tu crédito</h2><table class="tabla-indicadores"><tbody>
        ${numero && !d.cerrada ? `<tr><td>Cuota que sigue</td><td>${numero} de ${d.plazo}</td></tr>` : ''}
        <tr><td>Te prestaron</td><td>${pesos(d.inicial)}</td></tr>
        <tr><td>Total a pagar</td><td>${pesos(d.cuota * d.plazo)}</td></tr>
        <tr><td>Intereses y cargos</td><td>${pesos(d.cuota * d.plazo - d.inicial)}</td></tr>
        ${d.primera ? `<tr><td>Última cuota</td><td>${esc(M.fechaLarga(M.fechaCuota(d.primera, d.plazo)))}</td></tr>` : ''}
        ${costo != null ? `<tr><td>Costo total</td><td>${M.decimal(eaCosto * 100, 1)}% E.A.</td></tr>` : ''}</tbody></table>
        ${d.estimados.length ? `<p class="nota">Calculado por Platica con lo que sabías: ${esc(d.estimados.map((x) => ({ tasa: 'la tasa', saldo: 'el saldo', cuota: 'la cuota', plazo: 'el número de cuotas', inicial: 'lo que te prestaron' }[x])).join(', '))}.</p>` : ''}
        ${eaCosto * 100 > estado.ajustes.usura.ea + 0.005 ? `<div class="banner critico mt">${icono('alerta')}<div><strong>Cuesta más que la tasa de usura</strong><p>El costo total equivale a ${M.decimal(eaCosto * 100, 1)}% E.A. y la usura de consumo es ${M.decimal(estado.ajustes.usura.ea, 2)}% E.A. Puede incluir seguros, fianzas o comisiones además del interés: pide a la entidad el detalle. Si la tasa de interés sola supera la usura, puedes quejarte ante la Superintendencia Financiera.</p></div></div>` : ''}</section>`;
    }
    if (!d.cerrada && d.saldo > 0) {
      html += `<section class="tarjeta"><h2>Cuándo terminas de pagar</h2>`;
      if (!isFinite(p.meses)) {
        html += `<div class="banner critico">${icono('alerta')}<div><strong>Con ${p.cuota ? `una cuota de ${pesos(p.cuota)}` : 'esta cuota'} la deuda no baja</strong><p>Los intereses del mes (${pesos(d.saldo * p.i)}) se comen todo el pago. Necesitas abonar más para empezar a bajar el saldo.</p></div></div>`;
      } else {
        html += `<p class="texto">Con ${p.estimada ? 'una cuota estimada de' : 'la cuota de'} ${pesos(p.cuota)} terminas en <strong>${plural(p.meses, 'mes', 'meses')}</strong> (${esc(M.mesSolo(p.fin))} de ${p.fin.slice(0, 4)}) y pagas unos <strong>${pesos(unos(p.intereses))}</strong> en intereses.</p>`;
      }
      if (!d.tasa.valor && d.tipo !== 'personal') html += '<p class="nota">Agrega la tasa de interés para que el cálculo de intereses sea real.</p>';
      html += `<label class="campo mt"><span>¿Y si abonas algo extra cada mes?</span><input id="dd-extra" class="entrada monto" inputmode="numeric" placeholder="$0" value="${v.extra ? esc(pesos(v.extra)) : ''}"></label>
        <div id="dd-extra-res"></div><p class="nota">Al abonar a capital, pide que te reduzcan el plazo y no la cuota: así ahorras más intereses.</p></section>`;
    }
    if (d.historial.length >= 2) {
      const h = d.historial.slice(-24);
      html += `<section class="tarjeta"><h2>Cómo ha bajado el saldo</h2>${G.lineas({
        ancho: anchoGrafica(), alto: 160, marcadores: h.length <= 12,
        series: [{ nombre: 'Saldo', color: 'var(--c4)', valores: h.map((x) => x.saldo) }],
        etiquetaX: (i) => M.fechaCorta(h[i].fecha), formatoEje: M.compacto, formatoValor: pesos,
        descripcion: `Saldo de ${d.nombre}: de ${pesos(h[0].saldo)} a ${pesos(h[h.length - 1].saldo)}`,
      })}</section>`;
    }
    html += `<section class="tarjeta"><div class="cabecera-tarjeta"><h2>Pagos registrados</h2><span class="sub">${pesos(M.suma(pagos, 'monto'))}</span></div>
      ${pagos.length ? `<div class="lista">${pagos.map((g) => `<button type="button" class="fila" data-accion="editar-gasto" data-id="${esc(g.id)}">
        <span class="icono-cat chico cat-4">${icono('check')}</span><span class="centro"><strong>${esc(M.fechaLarga(g.fecha))}</strong>
        <small>${g.deuda.capital >= 0 ? `${esc(pesos(g.deuda.capital))} a capital · ${esc(pesos(g.deuda.interes))} intereses` : 'El saldo subió'}</small></span><span class="valor">${pesos(g.monto)}</span></button>`).join('')}</div>`
        : '<p class="texto">Cuando registres un pago, aparece aquí y en tus gastos del mes (categoría Deudas).</p>'}</section>`;
    const detalles = [
      [rot ? 'Cupo aprobado' : 'Valor del crédito', d.inicial ? pesos(d.inicial) : '—'],
      ['Fecha de apertura', d.apertura ? `${M.mesSolo(d.apertura)} de ${d.apertura.slice(0, 4)}` : '—'],
      ...(rot ? [] : [['Plazo', d.plazo ? `${d.plazo} meses` : '—']]),
      ['Día de pago', d.diaPago ? `Los ${d.diaPago} de cada mes` : '—'],
    ];
    html += `<section class="tarjeta"><h2>Detalles</h2><table class="tabla-indicadores"><tbody>${detalles.map(([k, val]) => `<tr><td>${k}</td><td>${esc(val)}</td></tr>`).join('')}</tbody></table>
      ${d.notas ? `<p class="texto mt">${esc(d.notas)}</p>` : ''}</section>
      <div class="botones"><button type="button" class="boton" data-accion="editar-deuda" data-id="${esc(d.id)}">${icono('lapiz')}Editar</button>
      <button type="button" class="boton" data-accion="cerrar-deuda" data-id="${esc(d.id)}">${d.cerrada ? 'Reabrir' : 'Marcar pagada'}</button></div>
      <button type="button" class="boton peligro ancho mt" data-accion="eliminar-deuda" data-id="${esc(d.id)}">${icono('basura')}Eliminar deuda</button>`;
    return { titulo: d.nombre, html, montar: (raiz) => {
      const extra = $('#dd-extra', raiz);
      if (!extra) return;
      const calcular = () => {
        v.extra = M.leerMonto(extra.value);
        const caja = $('#dd-extra-res', raiz);
        if (!v.extra) {
          caja.innerHTML = '';
          return;
        }
        const q = M.proyeccionDeuda(d, v.extra);
        caja.innerHTML = !isFinite(q.meses) ? '<p class="texto texto-critico">Aun así la deuda no baja: los intereses son mayores que el pago.</p>'
          : `<div class="resultado"><span class="grande">${plural(q.meses, 'mes', 'meses')}</span><span class="sub">Terminas en ${esc(M.mesSolo(q.fin))} de ${q.fin.slice(0, 4)}${isFinite(p.meses) ? `, ${plural(p.meses - q.meses, 'mes', 'meses')} antes, y te ahorras unos ${pesos(unos(p.intereses - q.intereses))} en intereses` : ''}.</span></div>`;
      };
      extra.addEventListener('input', calcular);
      calcular();
    } };
  };

  // ----- plan de pagos -----
  VISTAS.plan = (v) => {
    const deudas = M.activas(estado).filter((d) => d.saldo > 0);
    if (!deudas.length) {
      return { titulo: 'Plan para salir de deudas', html: `<div class="vacio">${icono('trofeo')}<p>No tienes deudas activas con saldo. Si tienes alguna, agrégala en la pestaña Deudas.</p>
        <button type="button" class="boton primario" data-accion="nueva-deuda">Agregar una deuda</button></div>` };
    }
    if (v.extra == null) {
      const r = M.resumenMes(estado, M.sumarMeses(M.mesActual(), -1));
      v.extra = r.disponible > 0 ? Math.round(r.disponible * 0.5 / 10000) * 10000 : 0;
    }
    v.estrategia = v.estrategia || 'avalancha';
    return { titulo: 'Plan para salir de deudas', html: `<p class="texto">Cada mes pagas la cuota de todas tus deudas y lo que puedas abonar de más va a una sola. Cuando terminas una, su cuota se suma al abono de la siguiente.</p>
      <label class="campo"><span>¿Cuánto extra puedes abonar al mes?</span><input id="p-extra" class="entrada monto" inputmode="numeric" placeholder="$0" value="${v.extra ? esc(pesos(v.extra)) : ''}">
        <small>Una parte de lo que te sobra cada mes. Aunque sea poco, acorta mucho el plazo.</small></label>
      <div class="segmentado" role="group" aria-label="Estrategia">
        <button type="button" data-estrategia="avalancha" aria-pressed="${v.estrategia === 'avalancha'}">Avalancha</button>
        <button type="button" data-estrategia="bola" aria-pressed="${v.estrategia === 'bola'}">Bola de nieve</button></div>
      <div id="p-resultado"></div>`,
    montar: (raiz) => {
      const pintar = () => {
        $('#p-resultado', raiz).innerHTML = htmlPlan(deudas, v);
        G.activar(raiz);
      };
      $('#p-extra', raiz).addEventListener('input', (ev) => {
        v.extra = M.leerMonto(ev.target.value);
        pintar();
      });
      for (const boton of $$('[data-estrategia]', raiz)) {
        boton.addEventListener('click', () => {
          v.estrategia = boton.dataset.estrategia;
          $$('[data-estrategia]', raiz).forEach((x) => x.setAttribute('aria-pressed', String(x === boton)));
          pintar();
        });
      }
      pintar();
    } };
  };
  function htmlPlan(deudas, v) {
    const plan = M.planPagos(deudas, v.extra, v.estrategia);
    const base = M.planPagos(deudas, 0, v.estrategia);
    const explicacion = v.estrategia === 'avalancha'
      ? 'Avalancha: el extra va primero a la deuda con la tasa más alta. Es la que menos intereses paga.'
      : 'Bola de nieve: el extra va primero a la deuda más pequeña. Ver deudas cerradas pronto motiva a seguir.';
    let html = `<p class="nota" style="margin:0 0 12px">${explicacion}</p>`;
    if (!plan.posible) {
      return html + `<div class="banner critico">${icono('alerta')}<div><strong>Así no terminas de pagar</strong><p>Con estas cuotas, ${esc(plan.sinTerminar.join(', '))} no ${plan.sinTerminar.length === 1 ? 'baja' : 'bajan'}: los intereses son mayores que el pago. Sube el abono extra o revisa las cuotas.</p></div></div>`;
    }
    const fin = M.sumarMeses(M.mesActual(), plan.meses);
    const ahorro = isFinite(base.intereses) ? base.intereses - plan.intereses : null;
    html += `<section class="tarjeta heroe"><span class="etiqueta">Quedas libre de deudas en</span><strong class="cifra-heroe">${plural(plan.meses, 'mes', 'meses')}</strong>
      <span class="sub">${esc(mayus(M.mesSolo(fin)))} de ${fin.slice(0, 4)}</span>
      <div class="cifras dos"><div class="cifra"><span>Intereses en total</span><strong>${cifra(plan.intereses)}</strong></div>
      <div class="cifra"><span>Frente a solo cuotas</span><strong>${v.extra && ahorro != null ? `−${cifra(ahorro)}` : '—'}</strong><small>${v.extra && isFinite(base.meses) ? `${plural(base.meses - plan.meses, 'mes', 'meses')} antes` : v.extra ? 'sin extra no terminarías' : 'agrega un extra'}</small></div></div></section>
      <section class="tarjeta"><h2>Orden de pago</h2><p class="sub" style="margin:-6px 0 6px">El abono extra va a la primera; cuando termines, a la siguiente.</p>
        <div class="lista">${plan.orden.map((o, i) => `<div class="fila"><span class="icono-cat chico cat-${i < 7 ? i + 1 : 0}" style="color:var(--texto);font-weight:700">${i + 1}</span>
        <span class="centro"><strong>${esc(o.nombre)}</strong><small>${o.estimada ? 'Cuota estimada · ' : ''}Terminas en ${esc(M.mesSolo(o.fecha))} de ${o.fecha.slice(0, 4)}</small></span><span class="valor">${plural(o.mes, 'mes', 'meses')}</span></div>`).join('')}</div></section>`;
    const series = [{ nombre: v.estrategia === 'avalancha' ? 'Avalancha con extra' : 'Bola de nieve con extra', color: 'var(--acento)', valores: plan.serie }];
    if (v.extra && isFinite(base.meses)) series.push({ nombre: 'Solo cuotas', color: 'var(--c0)', valores: base.serie });
    const largo = Math.max(...series.map((s) => s.valores.length));
    html += `<section class="tarjeta"><h2>Cómo baja tu deuda total</h2>${G.lineas({
      ancho: anchoGrafica(), series, formatoEje: M.compacto, formatoValor: pesos,
      etiquetaX: (i, largoTexto) => (i === 0 ? 'Hoy' : largoTexto ? `${M.mesSolo(M.sumarMeses(M.mesActual(), i))} ${M.sumarMeses(M.mesActual(), i).slice(0, 4)}` : `${M.mesCorto(M.sumarMeses(M.mesActual(), i))} ${M.sumarMeses(M.mesActual(), i).slice(2, 4)}`),
      marcasX: [0, Math.round((largo - 1) / 2), largo - 1],
      descripcion: `Deuda total mes a mes: de ${pesos(plan.total)} a cero en ${plan.meses} meses`,
    })}</section>`;
    if (plan.orden.some((o) => o.estimada)) html += '<p class="nota">Algunas cuotas son estimadas porque no las registraste. Agrégalas en cada deuda para un plan exacto.</p>';
    return html;
  }

  // ----- calculadora de cuotas -----
  VISTAS.cuota = (v) => {
    const b = v.borrador || (v.borrador = { monto: 5000000, tasa: 1.9, tipo: 'MV', plazo: 36, seguro: 0, todo: false });
    return { titulo: 'Calculadora de cuotas', html: `<p class="texto">Calcula la cuota fija mensual de un crédito (sistema francés, el que usan casi todos los bancos en Colombia).</p>
      <label class="campo"><span>Monto del crédito</span><input id="q-monto" class="entrada monto" inputmode="numeric" value="${esc(pesos(b.monto))}"></label>
      <div class="campo"><span class="etiqueta-campo">Tasa de interés</span><div class="con-sufijo"><input id="q-tasa" class="entrada" inputmode="decimal" value="${esc(M.decimal(b.tasa, 2))}" aria-label="Tasa">
        <div class="segmentado" role="group" style="margin:0;flex:none"><button type="button" data-tasa="EA" aria-pressed="${b.tipo === 'EA'}">% E.A.</button><button type="button" data-tasa="MV" aria-pressed="${b.tipo === 'MV'}">% M.V.</button></div></div></div>
      <div class="fila-campos"><label class="campo"><span>Plazo (meses)</span><input id="q-plazo" class="entrada" inputmode="numeric" maxlength="3" value="${b.plazo}"></label>
      <label class="campo"><span>Seguros al mes</span><input id="q-seguro" class="entrada monto" inputmode="numeric" placeholder="$0" value="${b.seguro ? esc(pesos(b.seguro)) : ''}"></label></div>
      <div id="q-resultado"></div>`,
    montar: (raiz) => {
      const pintar = () => {
        b.monto = M.leerMonto($('#q-monto', raiz).value);
        b.tasa = M.leerDecimal($('#q-tasa', raiz).value);
        b.plazo = Math.min(600, M.leerMonto($('#q-plazo', raiz).value));
        b.seguro = M.leerMonto($('#q-seguro', raiz).value);
        $('#q-resultado', raiz).innerHTML = htmlCuota(b);
      };
      $$('input', raiz).forEach((i) => i.addEventListener('input', pintar));
      for (const boton of $$('[data-tasa]', raiz)) {
        boton.addEventListener('click', () => {
          b.tipo = boton.dataset.tasa;
          $$('[data-tasa]', raiz).forEach((x) => x.setAttribute('aria-pressed', String(x === boton)));
          pintar();
        });
      }
      $('#q-resultado', raiz).addEventListener('click', (ev) => {
        if (ev.target.closest('[data-ver-tabla]')) {
          b.todo = !b.todo;
          pintar();
        }
      });
      pintar();
    } };
  };
  function htmlCuota(b) {
    if (!(b.monto > 0) || !(b.plazo > 0)) return '<p class="nota">Escribe el monto y el plazo.</p>';
    const tasa = { valor: b.tasa, tipo: b.tipo };
    const i = M.tasaMensual(tasa);
    const ea = M.tasaEA(tasa);
    const t = M.tablaAmortizacion(b.monto, i, b.plazo, b.seguro);
    const usura = ea * 100 > estado.ajustes.usura.ea + 0.005;
    const filas = b.todo ? t.filas : t.filas.slice(0, 12);
    return `<div class="resultado"><span class="sub">Cuota mensual</span><span class="grande">${pesos(t.cuota)}</span>
      <span class="sub">Tasa: ${M.decimal(ea * 100, 2)}% E.A. = ${M.decimal(i * 100, 2)}% M.V.</span></div>
      ${usura ? `<div class="banner critico mt">${icono('alerta')}<div><strong>Esa tasa supera la usura</strong><p>El máximo legal en ${esc(M.mesSolo(estado.ajustes.usura.vigencia))} es ${M.decimal(estado.ajustes.usura.ea, 2)}% E.A. Ninguna entidad puede cobrarte más.</p></div></div>` : ''}
      <div class="cifras"><div class="cifra"><span>Pagas en total</span><strong>${M.compacto(t.total)}</strong></div>
      <div class="cifra"><span>Intereses</span><strong>${M.compacto(t.intereses)}</strong></div>
      <div class="cifra"><span>Intereses sobre el monto</span><strong>${porcentaje(t.intereses / b.monto)}</strong></div></div>
      <h3>Tabla de pagos</h3><div class="tabla-scroll"><table class="tabla"><thead><tr><th>Mes</th><th>Cuota</th><th>Interés</th><th>Capital</th><th>Saldo</th></tr></thead>
      <tbody>${filas.map((f) => `<tr><td>${f.n}</td><td>${M.compacto(f.cuota)}</td><td>${M.compacto(f.interes)}</td><td>${M.compacto(f.capital)}</td><td>${M.compacto(f.saldo)}</td></tr>`).join('')}</tbody></table></div>
      ${t.filas.length > 12 ? `<button type="button" class="enlace" data-ver-tabla>${b.todo ? 'Ver menos' : `Ver los ${t.filas.length} meses`}</button>` : ''}
      <p class="nota">Al principio casi toda la cuota se va en intereses; por eso abonar a capital en los primeros meses ahorra tanto.</p>`;
  }

  // ----- capacidad de endeudamiento -----
  VISTAS.capacidad = (v) => {
    if (!v.borrador) {
      const mes = M.mesActual();
      // Gastos sin las cuotas de deudas (esas van aparte): promedio de los meses anteriores o, si aún no hay, la proyección de este mes.
      const previos = [1, 2, 3].map((n) => M.resumenMes(estado, M.sumarMeses(mes, -n))).filter((r) => r.cantidad);
      const actual = M.resumenMes(estado, mes);
      const gastos = previos.length ? Math.round(M.suma(previos.map((r) => r.total - r.abonosDeuda)) / previos.length)
        : Math.max(0, Math.round((actual.proyeccion - actual.abonosDeuda) / 1000) * 1000);
      v.borrador = { ingresos: M.ingresoReferencia(estado), financieros: M.cuotasMensuales(estado), gastos, tasa: 1.5, plazo: 60 };
    }
    const b = v.borrador;
    return { titulo: '¿Cuánto me prestarían?', html: `<p class="texto">Calcula cuánto podrías pedir prestado sin apretar tu bolsillo, con base en tus ingresos y gastos. Los datos vienen de lo que registraste; puedes cambiarlos.</p>
      <label class="campo"><span>Ingresos mensuales</span><input id="k-ingresos" class="entrada monto" inputmode="numeric" value="${b.ingresos ? esc(pesos(b.ingresos)) : ''}"></label>
      <label class="campo"><span>Cuotas de deudas que ya pagas</span><input id="k-financieros" class="entrada monto" inputmode="numeric" value="${b.financieros ? esc(pesos(b.financieros)) : ''}" placeholder="$0"></label>
      <label class="campo"><span>Tus otros gastos del mes</span><input id="k-gastos" class="entrada monto" inputmode="numeric" value="${b.gastos ? esc(pesos(b.gastos)) : ''}" placeholder="$0"><small>Arriendo, comida, servicios, transporte…</small></label>
      <div class="fila-campos"><label class="campo"><span>Tasa (% M.V.)</span><input id="k-tasa" class="entrada" inputmode="decimal" value="${esc(M.decimal(b.tasa, 2))}"></label>
      <label class="campo"><span>Plazo (meses)</span><input id="k-plazo" class="entrada" inputmode="numeric" maxlength="3" value="${b.plazo}"></label></div>
      <div id="k-resultado"></div>`,
    montar: (raiz) => {
      const pintar = () => {
        b.ingresos = M.leerMonto($('#k-ingresos', raiz).value);
        b.financieros = M.leerMonto($('#k-financieros', raiz).value);
        b.gastos = M.leerMonto($('#k-gastos', raiz).value);
        b.tasa = M.leerDecimal($('#k-tasa', raiz).value);
        b.plazo = Math.min(600, M.leerMonto($('#k-plazo', raiz).value));
        $('#k-resultado', raiz).innerHTML = htmlCapacidad(b);
      };
      $$('input', raiz).forEach((i) => i.addEventListener('input', pintar));
      pintar();
    } };
  };
  function htmlCapacidad(b) {
    if (!(b.ingresos > 0) || !(b.plazo > 0)) return '<p class="nota">Escribe tus ingresos y el plazo.</p>';
    const cap = M.capacidadEndeudamiento({ ingresos: b.ingresos, gastosFinancieros: b.financieros, gastos: b.gastos, tasaMV: b.tasa, plazo: b.plazo });
    const an = M.analisisCredito(estado);
    const via = M.viabilidadCreditos(estado, an, cap);
    const usura = cap.ea * 100 > estado.ajustes.usura.ea + 0.005;
    let html = `<section class="tarjeta heroe mt"><span class="etiqueta">Monto recomendado a ${b.plazo} meses</span><strong class="cifra-heroe">${pesos(cap.montoRecomendado)}</strong>
      <span class="sub">Con una cuota de hasta ${pesos(cap.cuotaRecomendada)} al mes. Máximo, sin apretarte demasiado: ${pesos(cap.montoMaximo)} (cuota de ${pesos(cap.cuotaMaxima)}).</span>
      <div class="cifras"><div class="cifra"><span>Te sobra al mes</span><strong class="${cap.libre < 0 ? 'texto-critico' : ''}">${cifra(cap.libre)}</strong></div>
      <div class="cifra"><span>Cuotas hoy</span><strong>${cap.cargaActual != null ? porcentaje(cap.cargaActual) : '—'}</strong><small>de tus ingresos</small></div>
      <div class="cifra"><span>Tasa</span><strong>${M.decimal(cap.ea * 100, 1)}%</strong><small>E.A.</small></div></div></section>`;
    if (usura) html += `<div class="banner critico">${icono('alerta')}<div><strong>Esa tasa supera la usura</strong><p>El máximo legal es ${M.decimal(estado.ajustes.usura.ea, 2)}% E.A. (${M.decimal(M.eaAMensual(estado.ajustes.usura.ea / 100) * 100, 2)}% M.V.).</p></div></div>`;
    for (const t of via.comunes) html += `<div class="banner aviso">${icono('info')}<div><p>${esc(t)}</p></div></div>`;
    html += `<section class="tarjeta"><h2>Qué tan viable es cada crédito</h2>${via.productos.map((p) => `<div class="producto"><div class="arriba"><strong>${esc(p.nombre)}</strong>
      <span class="estado ${p.nivel === 'alta' ? 'bien' : p.nivel === 'media' ? 'aviso' : 'alerta'}">Viabilidad ${p.nivel}</span></div>${p.razones.map((r) => `<p>${esc(r)}</p>`).join('')}</div>`).join('')}
      <p class="nota">Es una orientación con tus datos, no una aprobación: cada entidad tiene sus propias políticas.</p></section>
      <section class="tarjeta"><h2>Ten en cuenta</h2><div class="parrafos">
      <p>1. El monto recomendado supone que abres un solo crédito a la vez.</p>
      <p>2. Si acabas de adquirir una deuda, espera unos tres meses antes de pedir otra, para que tu flujo de caja se acomode.</p>
      <p>3. Si tus ingresos o gastos varían, sé conservador: usa el ingreso más bajo y el gasto más alto de los últimos meses.</p></div></section>`;
    return html;
  }

  // ----- simulador de puntaje -----
  VISTAS.simuladorPuntaje = (v) => {
    const p = M.ultimoPuntaje(estado);
    const an = M.analisisCredito(estado);
    const ind = M.indicadores(estado, an);
    v.esc = v.esc || { usoObjetivo: ind.rotUtil != null ? Math.min(30, Math.round(ind.rotUtil * 100)) : null, cerrarDeuda: false, alDia: true, nuevoCredito: false, mora: 0 };
    v.base = v.base || (p ? p.valor : 600);
    const actualUso = ind.rotUtil != null ? Math.min(150, Math.round(ind.rotUtil * 100)) : null;
    return { titulo: 'Simulador de puntaje', html: `<p class="texto">Mira cómo podría moverse tu puntaje según lo que hagas en los próximos meses.</p>
      ${p ? '' : `<label class="campo"><span>Tu puntaje actual</span><input id="s-base" class="entrada" inputmode="numeric" maxlength="4" value="${v.base}"><small>Registra tu puntaje real en «Mi crédito» para no escribirlo cada vez.</small></label>`}
      ${actualUso != null ? `<div class="campo"><span class="etiqueta-campo">Uso del cupo de tus tarjetas: <strong id="s-uso-txt">${v.esc.usoObjetivo}%</strong> (hoy ${actualUso}%)</span>
        <input id="s-uso" type="range" min="0" max="${actualUso}" step="1" value="${v.esc.usoObjetivo}" style="width:100%" aria-label="Uso objetivo de tus tarjetas"></div>` : ''}
      <div class="tarjeta plana" style="padding:4px 14px">
        <label class="interruptor"><span>Pagar todas las cuotas a tiempo<small>${ind.mora ? 'Incluye ponerte al día con lo que está en mora' : 'Sin atrasos en los próximos meses'}</small></span><input type="checkbox" data-esc="alDia"${v.esc.alDia ? ' checked' : ''}></label>
        <label class="interruptor"><span>Pagar por completo una deuda<small>Cierre de obligación</small></span><input type="checkbox" data-esc="cerrarDeuda"${v.esc.cerrarDeuda ? ' checked' : ''}></label>
        <label class="interruptor"><span>Abrir un crédito nuevo<small>Tarjeta, libre inversión, celular a plazos…</small></span><input type="checkbox" data-esc="nuevoCredito"${v.esc.nuevoCredito ? ' checked' : ''}></label>
      </div>
      <span class="etiqueta-campo mt">¿Y si te atrasas en un pago?</span>
      <div class="segmentado" role="group"><button type="button" data-mora="0" aria-pressed="${v.esc.mora === 0}">No</button><button type="button" data-mora="30" aria-pressed="${v.esc.mora === 30}">30 días</button><button type="button" data-mora="60" aria-pressed="${v.esc.mora === 60}">60 días o más</button></div>
      <div id="s-resultado"></div>`,
    montar: (raiz) => {
      const pintar = () => {
        const base = $('#s-base', raiz);
        if (base) v.base = Math.min(1000, M.leerMonto(base.value));
        const s = M.simularPuntaje(v.base, v.esc, ind);
        $('#s-resultado', raiz).innerHTML = `<section class="tarjeta mt"><h2>Puntaje estimado</h2>
          <p class="sub" style="margin:0">Hoy: ${v.base}</p>
          <h3>En 1 mes: entre ${s.mes1.min} y ${s.mes1.max}</h3>${escalaPuntaje(v.base, s.mes1)}
          <h3>En 3 meses: entre ${s.mes3.min} y ${s.mes3.max}</h3>${escalaPuntaje(v.base, s.mes3)}
          ${s.efectos.length ? `<div class="separador"></div>${s.efectos.map((e) => `<div class="leyenda-filas" style="margin-top:6px"><div><span class="nombre">${esc(e.texto)}</span>
            <strong class="${e.m3[1] >= 0 ? 'texto-bien' : 'texto-critico'}">${e.m3[0] >= 0 ? '+' : ''}${Math.round(e.m3[0])} a ${e.m3[1] >= 0 ? '+' : ''}${Math.round(e.m3[1])}</strong></div></div>`).join('')}` : ''}
          <p class="nota">Estimación orientativa de Platica a 3 meses: Datacrédito no publica su fórmula. Úsala para comparar escenarios, no como una promesa. Los reportes de las entidades se actualizan una vez al mes.</p></section>`;
      };
      const uso = $('#s-uso', raiz);
      if (uso) uso.addEventListener('input', () => {
        v.esc.usoObjetivo = Number(uso.value);
        $('#s-uso-txt', raiz).textContent = `${uso.value}%`;
        pintar();
      });
      const base = $('#s-base', raiz);
      if (base) base.addEventListener('input', pintar);
      for (const caja of $$('[data-esc]', raiz)) {
        caja.addEventListener('change', () => {
          v.esc[caja.dataset.esc] = caja.checked;
          pintar();
        });
      }
      for (const boton of $$('[data-mora]', raiz)) {
        boton.addEventListener('click', () => {
          v.esc.mora = Number(boton.dataset.mora);
          $$('[data-mora]', raiz).forEach((x) => x.setAttribute('aria-pressed', String(x === boton)));
          pintar();
        });
      }
      pintar();
    } };
  };

  // ----- diagnóstico -----
  VISTAS.diagnostico = (v) => {
    const an = M.analisisCredito(estado);
    const diag = estado.diagnostico;
    const est = M.factoresEstimados(an);
    const textos = M.textosDiagnostico(estado, an);
    const ind = M.indicadores(estado, an);
    const rep = diag ? diag.datos : {};
    const fila = (nombre, reporte, hoy) => `<tr><td>${nombre}</td><td>${reporte}</td><td>${hoy}</td></tr>`;
    const pct = (x) => (x != null ? porcentaje(x, 1) : '—');
    let html = diag ? `<p class="texto">Según tu reporte de ${esc(diag.fuente)} del ${esc(M.fechaLarga(diag.fecha || M.hoy()))}${an.reportadas ? ', comparado con las deudas que tienes registradas hoy' : ''}.</p>`
      : `<div class="banner">${icono('info')}<div><strong>Sin reporte cargado</strong><p>El análisis usa solo tus deudas registradas. Carga tu diagnóstico de Midatacrédito para compararlo.</p>
        <div class="botones"><button type="button" class="boton primario pequeno" data-accion="editar-reporte">Cargar reporte</button></div></div></div>`;
    if (diag || an.reportadas) {
      html += `<section class="tarjeta"><h2>Indicadores</h2><table class="tabla-indicadores"><thead><tr><th></th><th>Reporte</th><th>Hoy en Platica</th></tr></thead><tbody>
        ${fila('Antigüedad promedio', rep.antiguedadPromedio != null ? `${rep.antiguedadPromedio} meses` : '—', an.antiguedad != null ? `${an.antiguedad} meses` : '—')}
        ${fila('Aperturas en 6 meses', rep.aperturas6m != null ? `${rep.aperturas6m}${rep.aperturas6m >= 3 ? ' o más' : ''}` : '—', an.ultimaApertura ? String(an.aperturas6m) : '—')}
        ${fila('Uso de tarjetas y rotativos', rep.utilizacionRotativos != null ? pct(rep.utilizacionRotativos / 100) : '—', pct(an.rotUtil))}
        ${fila('Saldo de créditos a plazo', rep.saldoPlazoFijo != null ? pct(rep.saldoPlazoFijo / 100) : '—', pct(an.saldoFijas))}
        ${fila('Endeudamiento general', rep.utilizacionGeneral != null ? pct(rep.utilizacionGeneral / 100) : '—', pct(an.utilGeneral))}
        ${fila('Saldos en mora', rep.moraActual == null ? '—' : rep.moraActual ? 'Sí' : 'No', an.reportadas ? (an.enMora.length ? 'Sí' : 'No') : '—')}
        </tbody></table><p class="nota">Recomendado: uso de tarjetas por debajo del 30% y endeudamiento general por debajo del 55%.${ind.fuenteApp ? '' : ' Los datos del reporte avanzan con el tiempo: cada mes la antigüedad sube uno.'}</p></section>`;
    }
    for (const [id, f] of Object.entries(M.FACTORES)) {
      const nivelRep = diag ? diag.factores[id] : '';
      const principal = nivelRep || est[id];
      html += `<section class="tarjeta" id="factor-${id}"><div class="factor nivel-${principal || 'nada'}" style="padding-top:0"><span class="marca">${icono(principal ? CARA[principal] : 'info')}</span>
        <span class="centro"><strong>${f.nombre}</strong><small>${f.descripcion}</small></span><span class="lado">${etiquetaNivel(principal)}${nivelRep && est[id] ? `<small>Hoy: ${mayus(est[id])}</small>` : ''}</span></div>
        <div class="separador"></div><div class="parrafos">${textos[id].length ? textos[id].map((t) => `<p>${esc(t)}</p>`).join('') : '<p>Agrega tus deudas o tu reporte para analizar este factor.</p>'}</div></section>`;
    }
    html += `<button type="button" class="boton primario ancho" data-accion="ver-plan-puntaje">${icono('subir')}Ver mi plan para subir el puntaje</button>
      <button type="button" class="boton borde ancho mt" data-accion="editar-reporte">${icono('documento')}${diag ? 'Actualizar' : 'Cargar'} mi reporte</button>`;
    return { titulo: 'Tu diagnóstico', html, montar: (raiz) => {
      if (v.f) {
        const destino = $(`#factor-${v.f}`, raiz);
        if (destino) setTimeout(() => destino.scrollIntoView({ block: 'start' }), 30);
      }
    } };
  };
  VISTAS.planPuntaje = () => {
    const an = M.analisisCredito(estado);
    const plan = M.planPuntaje(estado, an);
    return { titulo: 'Plan para subir tu puntaje', html: `<p class="texto">Ordenado por el impacto que suele tener en el puntaje. Empieza por arriba.</p>
      <section class="tarjeta">${plan.map(accionHtml).join('')}</section>
      <button type="button" class="boton borde ancho" data-accion="ver-simulador-puntaje">${icono('subir')}Simular el efecto en mi puntaje</button>` };
  };

  const NIVELES_NOMBRE = { '': 'Sin dato', excelente: 'Excelente', bueno: 'Bueno', regular: 'Regular', malo: 'Malo' };
  VISTAS.reporte = (v) => {
    const diag = estado.diagnostico || { fecha: M.hoy(), fuente: 'Midatacrédito', factores: {}, datos: {} };
    const b = v.borrador || (v.borrador = JSON.parse(JSON.stringify(diag)));
    const p = estado.puntajes.find((x) => x.fecha === b.fecha);
    const num = (id, etiqueta, ayuda, sufijo = '') => `<label class="campo"><span>${etiqueta}</span><div class="con-sufijo"><input id="r-${id}" class="entrada" inputmode="decimal" value="${b.datos[id] != null ? esc(M.decimal(b.datos[id], 2)) : ''}" placeholder="—">${sufijo ? `<span class="sub" style="align-self:center">${sufijo}</span>` : ''}</div>${ayuda ? `<small>${ayuda}</small>` : ''}</label>`;
    const si = (id, etiqueta, ayuda) => `<label class="interruptor"><span>${etiqueta}${ayuda ? `<small>${ayuda}</small>` : ''}</span><input type="checkbox" id="r-${id}"${b.datos[id] ? ' checked' : ''}></label>`;
    return { titulo: 'Mi reporte de crédito', html: `<form id="form-reporte" autocomplete="off">
      <p class="texto">Copia aquí los datos de tu diagnóstico de Midatacrédito (o de TransUnion). Están en el PDF «Conoce tu diagnóstico» y en la app.</p>
      <div class="fila-campos"><label class="campo"><span>Fecha del reporte</span><input id="r-fecha" type="date" class="entrada" value="${esc(b.fecha)}" max="${M.hoy()}"></label>
      <label class="campo"><span>Puntaje</span><input id="r-puntaje" class="entrada" inputmode="numeric" maxlength="4" value="${p ? p.valor : ''}" placeholder="0 a 1.000"></label></div>
      <h3>Resultado de cada factor</h3>
      ${Object.entries(M.FACTORES).map(([id, f]) => `<label class="campo"><span>${f.nombre}</span><select id="r-f-${id}" class="entrada">${['', ...M.NIVELES].map((n) => `<option value="${n}"${(b.factores[id] || '') === n ? ' selected' : ''}>${NIVELES_NOMBRE[n]}</option>`).join('')}</select></label>`).join('')}
      <h3>Experiencia crediticia</h3>
      ${num('antiguedadPromedio', 'Antigüedad promedio de tus productos', '«El promedio general de la antigüedad de tus productos financieros es…»', 'meses')}
      ${num('aperturas6m', 'Productos abiertos en los últimos 6 meses', 'Si dice «3 o más», escribe 3.')}
      ${num('mesesUltimaApertura', 'Meses desde la última apertura', '', 'meses')}
      <h3>Estado del portafolio</h3>
      ${num('probIncumplimiento', 'Probabilidad de incumplimiento que perciben las entidades', '«…hasta del 20%»', '%')}
      <h3>Endeudamiento</h3>
      ${num('utilizacionRotativos', 'Uso de tarjetas de crédito o rotativos', '«El porcentaje de utilización de tus productos abiertos de Tarjeta de Crédito o Rotativos es…»', '%')}
      ${num('saldoPlazoFijo', 'Saldo pendiente de los préstamos a plazo fijo', '«…el saldo pendiente por pagar es del …% del valor inicial»', '%')}
      ${num('utilizacionGeneral', 'Utilización general (sin hipotecarios)', '«…tu utilización en general es de…»', '%')}
      <h3>Hábitos de pago</h3>
      ${num('productosSinNegativos', 'Productos sin reportes negativos en el último año', '')}
      <div class="tarjeta plana" style="padding:4px 14px">
        ${si('moraActual', 'Tengo saldos en mora', '')}
        ${si('moras60', 'Tuve moras de más de 60 días en los últimos 3 años', '')}
        ${si('pagosATiempo12m', 'Pagué todo a tiempo en los últimos 12 meses', '')}
        ${si('codeudor', 'Tengo obligaciones como codeudor', '')}
      </div>
      <div id="r-error" class="error-texto" hidden></div>
      <button type="submit" class="boton primario ancho mt">${icono('check')}Guardar reporte</button>
      ${estado.diagnostico ? `<button type="button" class="boton peligro ancho mt" data-accion="borrar-reporte">${icono('basura')}Borrar reporte</button>` : ''}</form>`,
    montar: (raiz) => {
      $('#form-reporte', raiz).addEventListener('submit', (ev) => {
        ev.preventDefault();
        const fecha = $('#r-fecha', raiz).value;
        if (!M.esFecha(fecha)) return mostrarError($('#r-error', raiz), 'Elige la fecha del reporte.');
        const leerNum = (id) => {
          const t = $(`#r-${id}`, raiz).value.trim();
          return t ? M.leerDecimal(t) : null;
        };
        const datos = {};
        for (const id of ['antiguedadPromedio', 'aperturas6m', 'mesesUltimaApertura', 'probIncumplimiento', 'utilizacionRotativos', 'saldoPlazoFijo', 'utilizacionGeneral', 'productosSinNegativos']) datos[id] = leerNum(id);
        for (const id of ['moraActual', 'moras60', 'pagosATiempo12m', 'codeudor']) datos[id] = $(`#r-${id}`, raiz).checked;
        const factores = {};
        for (const id of Object.keys(M.FACTORES)) factores[id] = $(`#r-f-${id}`, raiz).value;
        estado.diagnostico = M.normalizarEstado({ diagnostico: { fecha, fuente: b.fuente || 'Midatacrédito', factores, datos } }).diagnostico;
        const puntaje = M.leerMonto($('#r-puntaje', raiz).value);
        if (puntaje) registrarPuntaje(Math.min(1000, puntaje), fecha, b.fuente || 'Midatacrédito');
        guardar();
        cerrarVista();
        avisar('Reporte guardado');
      });
    } };
  };
  function registrarPuntaje(valor, fecha, fuente) {
    const previo = estado.puntajes.find((x) => x.fecha === fecha);
    if (previo) Object.assign(previo, { valor, fuente });
    else estado.puntajes.push({ id: M.idNuevo(), fecha, valor, fuente });
    estado.puntajes.sort((a, b) => a.fecha.localeCompare(b.fecha));
  }
  VISTAS.puntaje = () => ({ titulo: 'Registrar puntaje', html: `<form id="form-puntaje" autocomplete="off">
    <div class="monto-grande"><label class="oculto-visual" for="pp-valor">Puntaje</label><input id="pp-valor" inputmode="numeric" maxlength="4" placeholder="0"><small>De 0 a 1.000</small></div>
    <label class="campo"><span>Fecha</span><input id="pp-fecha" type="date" class="entrada" value="${M.hoy()}" max="${M.hoy()}"></label>
    <label class="campo"><span>Dónde lo consultaste</span><select id="pp-fuente" class="entrada"><option>Midatacrédito</option><option>TransUnion</option><option>Otra</option></select></label>
    <div id="pp-error" class="error-texto" hidden></div>
    <button type="submit" class="boton primario ancho">${icono('check')}Guardar</button></form>`,
  montar: (raiz) => {
    setTimeout(() => $('#pp-valor', raiz).focus(), 60);
    $('#form-puntaje', raiz).addEventListener('submit', (ev) => {
      ev.preventDefault();
      const texto = $('#pp-valor', raiz).value.replace(/\D/g, '');
      const valor = Number(texto);
      const fecha = $('#pp-fecha', raiz).value;
      if (!texto || valor > 1000) return mostrarError($('#pp-error', raiz), 'Escribe un puntaje entre 0 y 1.000.');
      if (!M.esFecha(fecha)) return mostrarError($('#pp-error', raiz), 'Elige una fecha válida.');
      registrarPuntaje(valor, fecha, $('#pp-fuente', raiz).value);
      guardar();
      cerrarVista();
      avisar(`Puntaje ${valor} guardado`);
    });
  } });
  VISTAS.puntajes = () => ({ titulo: 'Historial de puntajes', html: estado.puntajes.length
    ? `<div class="lista tarjeta plana">${[...estado.puntajes].reverse().map((p) => `<div class="fila"><span class="centro"><strong>${p.valor} · ${esc(M.BANDAS[M.bandaPuntaje(p.valor)].nombre)}</strong><small>${esc(p.fuente)} · ${esc(M.fechaLarga(p.fecha))}</small></span>
      <button type="button" class="boton-icono" data-accion="eliminar-puntaje" data-id="${esc(p.id)}" aria-label="Eliminar el puntaje del ${esc(M.fechaLarga(p.fecha))}">${icono('basura')}</button></div>`).join('')}</div>
      <button type="button" class="boton primario ancho mt" data-accion="nuevo-puntaje">${icono('suma')}Registrar puntaje</button>`
    : `<div class="vacio"><p>Aún no registras puntajes.</p><button type="button" class="boton primario" data-accion="nuevo-puntaje">Registrar puntaje</button></div>` });

  // ----- recomendaciones y resumen -----
  VISTAS.recomendaciones = (v) => ({ titulo: `Recomendaciones de ${M.mesSolo(v.mes)}`, html: `<section class="tarjeta">${M.recomendacionesMes(estado, v.mes).map(recoHtml).join('') || '<p class="texto">Nada por ahora.</p>'}</section>` });
  VISTAS.resumen = (v) => {
    const r = M.resumenMes(estado, v.mes);
    const anterior = M.resumenMes(estado, M.sumarMeses(v.mes, -1));
    const rep = M.reparto(estado, r);
    const cambio = anterior.total > 0 ? r.total / anterior.total - 1 : null;
    const ahorro = r.ingresos > 0 ? r.disponible / r.ingresos : null;
    const antes = new Map(anterior.porCategoria.map((x) => [x.id, x.total]));
    let html = `${selectorMes('mes-resumen', v.mes)}${v.automatico ? `<div class="banner bien">${icono('trofeo')}<div><strong>Terminó ${esc(M.mesSolo(v.mes))}</strong><p>Este es tu resumen del mes. Lo encuentras siempre en Inicio.</p></div></div>` : ''}
      <section class="tarjeta heroe"><span class="etiqueta">${r.ingresos > 0 ? (r.disponible >= 0 ? (r.esActual ? 'Te queda por ahora' : 'Te quedó') : (r.esActual ? 'Te pasaste por' : 'Te faltaron')) : 'Gastaste'}</span>
      <strong class="cifra-heroe${r.ingresos > 0 && r.disponible < 0 ? ' negativa' : ''}">${pesos(r.ingresos > 0 ? Math.abs(r.disponible) : r.total)}</strong>
      <div class="cifras"><div class="cifra"><span>Ingresos</span><strong>${cifra(r.ingresos)}</strong><small>${detalleIngresos(r)}</small></div>
      <div class="cifra"><span>Gastos</span><strong>${cifra(r.total)}</strong><small>${cambio != null ? `${cambio >= 0 ? '↑' : '↓'} ${porcentaje(Math.abs(cambio))} vs. ${esc(M.mesCorto(anterior.mes))}` : plural(r.cantidad, 'pago', 'pagos')}</small></div>
      <div class="cifra"><span>Ahorro</span><strong class="${ahorro != null && ahorro < 0 ? 'texto-critico' : ''}">${ahorro != null ? porcentaje(ahorro) : '—'}</strong><small>${r.esActual ? 'hasta hoy' : 'de tus ingresos'}</small></div></div></section>`;
    if (r.ingresoPendiente) {
      html += `<div class="banner aviso">${icono('billetera')}<div><strong>${r.esActual ? 'Aún no registras tus ingresos de este mes' : `No registraste ingresos en ${esc(M.mesSolo(v.mes))}`}</strong>
        <p>Agrégalos para saber cuánto te quedó y qué parte se fue en gastos.</p>
        <div class="botones"><button type="button" class="boton primario pequeno" data-accion="nuevo-ingreso" data-mes="${v.mes}">${icono('suma')}Agregar ingreso</button></div></div></div>`;
    }
    html += htmlFlujo(r) + htmlDeudasDelMes(r, v.mes);
    const fijosMes = M.pagosDelMes(estado, v.mes).filter((x) => x.clase === 'fijo');
    if (fijosMes.length) {
      html += `<section class="tarjeta"><div class="cabecera-tarjeta"><h2>Pagos fijos</h2><span class="sub">${pesos(M.suma(fijosMes.filter((x) => x.estado === 'pagado'), 'monto'))} de ${pesos(M.suma(fijosMes, 'monto'))}</span></div>
        <div class="lista">${fijosMes.map((x) => filaPagoMes(x, r.esActual)).join('')}</div></section>`;
    }
    if (!r.cantidad) return { titulo: `Resumen de ${M.mesSolo(v.mes)}`, html: html + '<div class="vacio"><p>No hay gastos registrados en este mes.</p></div>' };
    html += `<section class="tarjeta"><h2>Por categoría</h2><div class="tabla-scroll"><table class="tabla"><thead><tr><th>Categoría</th><th>Gasto</th><th>%</th><th>vs. mes anterior</th></tr></thead><tbody>
      ${r.porCategoria.map((x) => {
        const prev = antes.get(x.id) || 0;
        const delta = prev ? x.total / prev - 1 : null;
        return `<tr><td><i class="punto-cat cat-${M.categoria(estado, x.id).color}" style="display:inline-block;margin-right:6px"></i>${esc(M.categoria(estado, x.id).nombre)}</td><td>${pesos(x.total)}</td><td>${porcentaje(x.pct)}</td>
          <td class="${delta == null ? '' : delta > 0.1 ? 'texto-aviso' : delta < -0.1 ? 'texto-bien' : ''}">${delta == null ? 'nuevo' : `${delta >= 0 ? '+' : ''}${porcentaje(delta)}`}</td></tr>`;
      }).join('')}</tbody></table></div></section>`;
    if (r.ingresos > 0) html += `<section class="tarjeta"><h2>Regla 50/30/20</h2>${htmlReparto(rep)}</section>`;
    html += `<section class="tarjeta"><h2>Tus gastos más grandes</h2><div class="lista">${r.mayores.map((g) => {
      const cat = M.categoria(estado, g.categoria);
      return `<button type="button" class="fila" data-accion="editar-gasto" data-id="${esc(g.id)}">${iconoCat(cat)}<span class="centro"><strong>${esc(g.nota || cat.nombre)}</strong><small>${esc(cat.nombre)} · ${esc(M.fechaCorta(g.fecha))}</small></span><span class="valor">${pesos(g.monto)}</span></button>`;
    }).join('')}</div></section>
      <section class="tarjeta"><h2>Datos del mes</h2><table class="tabla-indicadores"><tbody>
      <tr><td>Pagos registrados</td><td>${r.cantidad.toLocaleString('es-CO')}</td></tr>
      <tr><td>Gasto promedio por día</td><td>${pesos(r.total / (r.dia || r.dias))}</td></tr>
      <tr><td>Día que más gastaste</td><td>${r.diaMayor.dia ? `${esc(M.fechaCorta(`${v.mes}-${String(r.diaMayor.dia).padStart(2, '0')}`))} · ${pesos(r.diaMayor.total)}` : '—'}</td></tr>
      <tr><td>Gastos hormiga (${pesos(M.PAGO_GRANDE_HORMIGA)} o menos)</td><td>${r.hormiga.cantidad} · ${pesos(r.hormiga.total)}</td></tr>
      <tr><td>Pagado con tarjeta de crédito</td><td>${pesos(r.conCredito)}</td></tr></tbody></table></section>
      <section class="tarjeta"><h2>Recomendaciones</h2>${M.recomendacionesMes(estado, v.mes).map(recoHtml).join('')}</section>
      ${ANDROID ? `<button type="button" class="boton borde ancho" data-accion="compartir-resumen" data-mes="${v.mes}">${icono('compartir')}Compartir resumen</button>` : ''}`;
    return { titulo: `Resumen de ${M.mesSolo(v.mes)}`, html };
  };

  // Todo lo que entró y salió en el mes, en un solo lugar: gastos del día a día, pagos fijos y deudas.
  function htmlFlujo(r) {
    const fila = (nombre, valor, clase = '') => `<div class="${clase}"><span>${nombre}</span><strong>${valor}</strong></div>`;
    return `<section class="tarjeta"><h2>Así se movió tu plata</h2><div class="flujo">
      ${fila('Ingresos', `<span class="texto-bien">+${pesos(r.ingresos)}</span>`)}
      ${fila('Gastos del día a día', `−${pesos(r.flujo.diaADia)}`)}
      ${r.flujo.fijos ? fila('Pagos fijos', `−${pesos(r.flujo.fijos)}`) : ''}
      ${r.flujo.deudas ? fila('Cuotas y abonos a deudas', `−${pesos(r.flujo.deudas)}`) : ''}
      ${fila(r.disponible >= 0 ? (r.esActual ? 'Te queda por ahora' : 'Te quedó') : (r.esActual ? 'Te pasaste por' : 'Te faltaron'),
        `<span class="${r.disponible < 0 ? 'texto-critico' : ''}">${pesos(Math.abs(r.disponible))}</span>`, 'total')}</div>
      ${r.flujo.tarjeta ? `<p class="nota">Además pagaste ${pesos(r.flujo.tarjeta)} a tus tarjetas por compras que ya estaban en tus gastos: no se cuentan otra vez.</p>` : ''}
      ${r.esActual && r.pendientes ? `<p class="nota">Faltan ${pesos(r.pendientes)} en cuotas y pagos fijos de este mes.</p>` : ''}</section>`;
  }
  function htmlDeudasDelMes(r, mes) {
    const rd = M.resumenDeudas(estado, mes);
    if (!rd.pagos.length && !rd.cuotas.length && !rd.saldoInicio && !rd.saldoFin) return '';
    const cambio = rd.saldoFin - rd.saldoInicio;
    return `<section class="tarjeta"><h2>Tus deudas en ${esc(M.mesSolo(mes))}</h2>
      <div class="cifras"><div class="cifra"><span>Pagaste</span><strong>${cifra(rd.total)}</strong><small>${plural(rd.pagos.length, 'pago', 'pagos')}</small></div>
      <div class="cifra"><span>A capital</span><strong>${cifra(rd.capital)}</strong><small>baja la deuda</small></div>
      <div class="cifra"><span>Intereses</span><strong>${cifra(rd.intereses)}</strong><small>y cargos</small></div></div>
      ${rd.sinDetalle ? `<p class="nota">${pesos(rd.sinDetalle)} se registraron en Deudas sin elegir la deuda: no se sabe cuánto fue a capital.</p>` : ''}
      ${rd.saldoInicio || rd.saldoFin ? `<div class="flujo mt"><div><span>Deuda total al empezar el mes</span><strong>${pesos(rd.saldoInicio)}</strong></div>
        <div class="total"><span>${r.esActual ? 'Deuda total hoy' : 'Al terminar el mes'}</span><strong>${pesos(rd.saldoFin)}</strong></div></div>
        <p class="nota ${cambio < 0 ? 'texto-bien' : cambio > 0 ? 'texto-aviso' : ''}">${cambio < 0 ? `Bajó ${pesos(-cambio)}.` : cambio > 0
          ? `Subió ${pesos(cambio)}${rd.nuevas.length ? `: incluye ${esc(rd.nuevas.join(', '))}, ${rd.nuevas.length === 1 ? 'que empezó' : 'que empezaron'} este mes` : ''}.` : 'No cambió.'}</p>` : ''}
      ${rd.cuotas.length ? `<h3>Cuotas del mes</h3><div class="lista">${rd.cuotas.map((x) => filaPagoMes(x, r.esActual)).join('')}</div>` : ''}
      ${rd.terminadas.length ? `<div class="banner bien mt">${icono('trofeo')}<div><p>Terminaste de pagar: ${esc(rd.terminadas.join(', '))}.</p></div></div>` : ''}</section>`;
  }

  // ----- aprende -----
  const ARTICULOS = {
    puntaje: { titulo: 'Cómo funciona tu puntaje de crédito', icono: 'medidor', cuerpo: () => `
      <p>En Colombia, los bancos, almacenes, cooperativas y empresas de telefonía reportan cada mes cómo pagas a las centrales de información: <strong>Datacrédito Experian</strong> y <strong>TransUnion</strong>. Con esa historia se calcula tu puntaje, que en Midatacrédito va de 0 a 1.000.</p>
      <h2>Los cuatro factores</h2><ul>
      <li><strong>Hábitos de pago:</strong> si pagas a tiempo. Es el que más pesa.</li>
      <li><strong>Endeudamiento:</strong> cuánto debes frente a tus cupos y montos aprobados. Lo sano es usar menos del 30% del cupo de tus tarjetas y no pasar del 55% en general.</li>
      <li><strong>Experiencia crediticia:</strong> cuánto tiempo llevas con productos y qué tan seguido abres nuevos.</li>
      <li><strong>Estado del portafolio:</strong> los tipos de crédito que tienes y el riesgo que ven las entidades.</li></ul>
      <h2>Qué lo sube</h2><ul><li>Pagar todas las cuotas a tiempo, mes tras mes.</li><li>Bajar el saldo de tus tarjetas.</li><li>Terminar de pagar una obligación.</li><li>Dejar pasar tiempo sin abrir productos nuevos.</li></ul>
      <h2>Qué lo baja</h2><ul><li>Atrasarte, sobre todo 60 días o más.</li><li>Usar las tarjetas cerca o por encima del cupo.</li><li>Abrir varios créditos en pocos meses: cada solicitud deja una huella de consulta.</li><li>Ser codeudor de alguien que no paga.</li></ul>
      <p>Consultar tu propia historia no baja el puntaje. Puedes hacerlo gratis en Midatacrédito y en TransUnion.</p>` },
    tarjetas: { titulo: 'Tarjetas de crédito sin sustos', icono: 'tarjeta', cuerpo: () => `
      <ul><li><strong>Usa menos del 30% del cupo.</strong> Si tu cupo es de $1.000.000, intenta no deber más de $300.000.</li>
      <li><strong>Paga el total</strong> antes de la fecha límite, no solo el mínimo: el mínimo te deja pagando intereses sobre todo lo demás.</li>
      <li><strong>Difiere a una cuota.</strong> En muchas tarjetas, las compras a una cuota no generan intereses si pagas a tiempo.</li>
      <li><strong>Evita los avances:</strong> suelen cobrar intereses desde el primer día y una comisión.</li>
      <li><strong>Nunca uses una tarjeta para pagar otra deuda.</strong> Es una de las peores prácticas de finanzas personales.</li>
      <li>Revisa la <strong>cuota de manejo</strong> y pregunta si te la pueden quitar.</li></ul>` },
    reportes: { titulo: 'Reportes negativos: lo que dice la ley', icono: 'escudo', cuerpo: () => `
      <p>El reporte en centrales de riesgo lo regulan la Ley 1266 de 2008 (Habeas Data financiero) y la Ley 2157 de 2021, conocida como «borrón y cuenta nueva».</p><ul>
      <li><strong>Te deben avisar antes:</strong> la entidad debe enviarte una comunicación previa y esperar 20 días calendario antes de reportarte, para que puedas pagar o aclarar.</li>
      <li><strong>Cuánto dura el dato negativo:</strong> el doble del tiempo que duró la mora, máximo 4 años contados desde que pagas.</li>
      <li><strong>Caducidad:</strong> aunque no pagues, el dato negativo se elimina a los 8 años desde que empezó la mora.</li>
      <li><strong>Tienes derecho a conocer, actualizar y rectificar</strong> tu información. Si hay un error, reclama primero ante la entidad que te reportó o ante la central. Si no te responden, puedes acudir a la Superintendencia de Industria y Comercio.</li></ul>
      <p>Lo más importante: si estás en mora, ponerte al día cuanto antes acorta el tiempo del reporte.</p>` },
    tasas: { titulo: 'E.A., M.V. y la tasa de usura', icono: 'porcentaje', cuerpo: () => `
      <ul><li><strong>E.A. (efectiva anual):</strong> lo que pagas de intereses en un año, ya con el interés compuesto.</li>
      <li><strong>M.V. (mes vencido):</strong> la tasa de cada mes. 1,5% M.V. equivale a ${M.decimal(M.tasaEA({ valor: 1.5, tipo: 'MV' }) * 100, 2)}% E.A., no a 18%.</li></ul>
      <p>Para comparar créditos, usa siempre la E.A. La calculadora de cuotas convierte una en otra.</p>
      <h2>La tasa de usura</h2><p>Es el máximo legal que te pueden cobrar. La Superintendencia Financiera la certifica cada mes. En ${esc(M.mesSolo(estado.ajustes.usura.vigencia))} de ${estado.ajustes.usura.vigencia.slice(0, 4)} es de <strong>${M.decimal(estado.ajustes.usura.ea, 2)}% E.A.</strong> para crédito de consumo y ordinario. Cobrar por encima de la usura es un delito.</p>` },
    deudas: { titulo: 'Cómo salir de deudas', icono: 'objetivo', cuerpo: () => `
      <ul><li><strong>Haz la lista completa:</strong> saldo, cuota, tasa y fecha de pago de cada deuda (para eso está la pestaña Deudas).</li>
      <li><strong>Paga siempre las cuotas mínimas</strong> de todas para no caer en mora.</li>
      <li><strong>Elige una estrategia para el dinero extra:</strong> avalancha (primero la tasa más alta, pagas menos intereses) o bola de nieve (primero la más pequeña, te motiva).</li>
      <li><strong>Abona a capital y pide reducir el plazo.</strong> En los créditos de consumo puedes hacer abonos extraordinarios sin pagar sanción.</li>
      <li><strong>Compra de cartera o refinanciación:</strong> si otra entidad te ofrece una tasa más baja, puede valer la pena, pero revisa el costo total y no vuelvas a usar las tarjetas que liberaste.</li>
      <li><strong>Si no puedes pagar, habla con la entidad antes de atrasarte</strong> y pide un acuerdo de pago.</li>
      <li><strong>Nunca acudas al «gota a gota»:</strong> es ilegal, cobra intereses muy por encima de la usura y usa la intimidación.</li></ul>` },
    presupuesto: { titulo: 'Presupuesto 50/30/20 y fondo de emergencia', icono: 'grafica', cuerpo: () => `
      <p>La regla 50/30/20 es una guía sencilla para repartir tus ingresos:</p><ul>
      <li><strong>Hasta 50% para necesidades:</strong> arriendo, servicios, comida, salud, transporte y las cuotas mínimas de tus deudas.</li>
      <li><strong>Hasta 30% para gustos:</strong> salidas, ropa, suscripciones, antojos.</li>
      <li><strong>Al menos 20% para ahorrar</strong> o abonar de más a tus deudas.</li></ul>
      <p>En Platica cada categoría está marcada como necesidad o gusto; puedes cambiarlo en Más → Categorías.</p>
      <h2>Fondo de emergencia</h2><p>Junta entre 3 y 6 meses de tus gastos básicos en una cuenta aparte. Así un imprevisto (una cita médica, un daño, perder el trabajo) no termina en la tarjeta de crédito.</p>
      <h2>Gastos hormiga</h2><p>Son los gastos pequeños y frecuentes: tintos, domicilios, recargas, antojos. Uno a uno no se notan, pero juntos pueden ser una buena parte del mes. El resumen mensual te muestra cuánto suman.</p>` },
    codeudor: { titulo: 'Antes de ser codeudor', icono: 'bebe', cuerpo: () => `
      <p>Ser codeudor es prometer que pagarás si el deudor principal no lo hace. Para las centrales de riesgo, esa deuda también es tuya:</p><ul>
      <li>Reduce tu capacidad de endeudamiento: los bancos la cuentan cuando pides un crédito.</li>
      <li>Si el deudor se atrasa, el reporte negativo te llega a ti también.</li>
      <li>Tienes poco control sobre si se paga o no.</li></ul>
      <p>Acepta solo si estás dispuesto y puedes pagar esa deuda tú mismo.</p>` },
  };
  VISTAS.aprende = () => ({ titulo: 'Aprende', html: `<section class="tarjeta">${Object.entries(ARTICULOS).map(([id, a]) => `<button type="button" class="ajuste" data-accion="articulo" data-id="${id}">${icono(a.icono)}<span>${a.titulo}</span>${icono('adelante', 'chevron')}</button>`).join('')}</section>
    <p class="nota">Información general para Colombia. No reemplaza la asesoría de un profesional ni las condiciones de tu entidad.</p>` });
  VISTAS.articulo = (v) => (ARTICULOS[v.id] ? { titulo: ARTICULOS[v.id].titulo, html: `<div class="articulo">${ARTICULOS[v.id].cuerpo()}</div>` } : null);

  // ----- ajustes -----
  VISTAS.perfil = (v) => {
    const b = v.borrador || (v.borrador = { nombre: estado.perfil.nombre, ...ingresosActuales() });
    const historial = [...estado.perfil.periodos].reverse();
    return { titulo: 'Tu perfil', html: `<form id="form-perfil" autocomplete="off">
      <label class="campo"><span>Nombre</span><input id="pf-nombre" class="entrada" maxlength="40" value="${esc(b.nombre)}"></label>
      <h3>Tus ingresos</h3>
      ${camposIngreso('pf', b)}
      <div id="pf-error" class="error-texto" hidden></div>
      <button type="submit" class="boton primario ancho">${icono('check')}Guardar</button>
      <p class="nota">Los cambios cuentan desde este mes; los meses anteriores conservan los ingresos que tenían.</p>
      ${historial.length ? `<h3>Historial</h3><div class="lista tarjeta plana">${historial.map((x) => `<div class="fila"><span class="centro"><strong>${esc(textoPeriodo(x))}</strong>
        <small>Desde ${esc(M.mesSolo(x.desde))} de ${x.desde.slice(0, 4)}</small></span></div>`).join('')}</div>` : ''}</form>`,
    montar: (raiz) => {
      montarCamposIngreso(raiz, 'pf');
      $('#form-perfil', raiz).addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const datos = leerCamposIngreso(raiz, 'pf');
        if (datos.fijo && !datos.salario) return mostrarError($('#pf-error', raiz), 'Escribe cuánto ganas al mes.');
        const nombre = $('#pf-nombre', raiz).value.trim().slice(0, 40);
        // Cambiar de modalidad a mitad de mes: que el mes no cuente el salario dos veces ni se quede sin él.
        const mes = M.mesActual();
        const antes = M.ingresoDelMes(estado, mes);
        let quitar = [];
        let anotar = null;
        if (datos.fijo && !antes.fijo) {
          const anotados = antes.lista.filter((i) => i.tipo !== 'salario');
          if (anotados.length && await confirmar({ titulo: '¿Eran parte de tu salario?',
            texto: `Este mes ya anotaste ${pesos(M.suma(anotados, 'monto'))} en ingresos. Si eran parte de tu salario, se quitan para no contarlo dos veces; si no, quedan como ingresos extra.`,
            si: 'Sí, quitarlos', no: 'No, son extras' })) quitar = anotados;
        } else if (!datos.fijo && antes.fijo && !antes.ajuste && antes.salario > 0) {
          if (await confirmar({ titulo: `¿Ya recibiste el salario de ${M.mesSolo(mes)}?`,
            texto: `Con ingresos variables, cada mes cuenta solo lo que anotes. Si ya te pagaron este mes, lo dejo anotado por ${pesos(antes.salario)}.`,
            si: 'Sí, anotarlo', no: 'Todavía no' })) {
            anotar = { id: M.idNuevo(), fecha: M.hoy(), concepto: `Salario de ${M.mesSolo(mes)}`, monto: antes.salario, tipo: 'ingreso' };
          }
        }
        estado.perfil.nombre = nombre;
        aplicarIngresos(datos);
        if (quitar.length) estado.ingresos = estado.ingresos.filter((i) => !quitar.includes(i));
        if (anotar) estado.ingresos.push(anotar);
        guardar();
        cerrarVista();
        avisar('Perfil guardado');
      });
    } };
  };
  CAPTURAR.perfil = (v, raiz) => {
    if (!$('#pf-nombre', raiz)) return;
    v.borrador = { nombre: $('#pf-nombre', raiz).value, ...leerCamposIngreso(raiz, 'pf') };
  };
  let permisoNotif = 'concedido';
  try { if (ANDROID) permisoNotif = ANDROID.permisoNotificaciones(); } catch (e) { permisoNotif = 'denegado'; }
  VISTAS.recordatorios = () => {
    const a = estado.ajustes;
    const proximos = M.recordatorios(estado).slice(0, 4);
    const fecha = (ms) => {
      const d = new Date(ms);
      return `${M.fechaCorta(M.hoy(d))} · ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    };
    return { titulo: 'Recordatorios', html: `${ANDROID && permisoNotif !== 'concedido' ? `<div class="banner aviso">${icono('campana')}<div><strong>Las notificaciones están desactivadas</strong><p>Actívalas para recibir los recordatorios aunque la app esté cerrada.</p>
        <div class="botones"><button type="button" class="boton primario pequeno" data-accion="pedir-notificaciones">Activar</button></div></div></div>` : ''}
      <section class="tarjeta" style="padding:4px 16px">
        <label class="interruptor"><span>Cuotas por vencer<small>Dos días antes y el día del pago, para cada deuda con día de pago</small></span><input type="checkbox" data-ajuste="recordatorioCuotas"${a.recordatorioCuotas ? ' checked' : ''}></label>
        <label class="interruptor"><span>Registrar los gastos del día<small>Un aviso diario a la hora que elijas</small></span><input type="checkbox" data-ajuste="recordatorioDiario"${a.recordatorioDiario ? ' checked' : ''}></label>
        <label class="interruptor"><span>Resumen del mes<small>El día 1 de cada mes</small></span><input type="checkbox" data-ajuste="resumenMensual"${a.resumenMensual ? ' checked' : ''}></label>
        <label class="interruptor"><span>Pagos fijos<small>El día del pago; si se cobra solo, la víspera</small></span><input type="checkbox" data-ajuste="recordatorioFijos"${a.recordatorioFijos ? ' checked' : ''}></label>
        ${M.esFijo(estado.perfil, M.mesActual()) ? '' : `<label class="interruptor"><span>Anotar tus ingresos<small>Tus ingresos son variables: te recuerdo registrarlos cada mes</small></span><input type="checkbox" data-ajuste="recordatorioIngresos"${a.recordatorioIngresos ? ' checked' : ''}></label>`}
      </section>
      <label class="campo"${a.recordatorioDiario ? '' : ' hidden'} id="rc-hora-campo"><span>Hora del aviso diario</span><input id="rc-hora" type="time" class="entrada" value="${esc(a.horaDiario)}"></label>
      <h3>Próximos avisos</h3>${proximos.length ? `<div class="lista tarjeta plana">${proximos.map((r) => `<div class="fila"><span class="centro"><strong>${esc(r.titulo)}</strong><small>${esc(fecha(r.cuando))}</small></span></div>`).join('')}</div>` : '<p class="texto">No hay avisos programados.</p>'}`,
    montar: (raiz) => {
      for (const caja of $$('[data-ajuste]', raiz)) {
        caja.addEventListener('change', () => {
          estado.ajustes[caja.dataset.ajuste] = caja.checked;
          guardar();
          if (caja.checked && ANDROID && permisoNotif !== 'concedido') ANDROID.pedirNotificaciones();
          setTimeout(() => render(true), 0);
        });
      }
      const hora = $('#rc-hora', raiz);
      hora.addEventListener('change', () => {
        if (/^\d{2}:\d{2}$/.test(hora.value)) {
          estado.ajustes.horaDiario = hora.value;
          guardar();
        }
      });
    } };
  };
  function ofrecerNotificaciones() {
    if (!ANDROID || permisoNotif === 'concedido' || estado.vistos.notificaciones) return;
    estado.vistos.notificaciones = true;
    guardar();
    confirmar({ titulo: '¿Te recuerdo las cuotas?', texto: 'Platica puede avisarte dos días antes de cada fecha de pago, aunque la app esté cerrada. Pagar a tiempo es lo que más cuida tu puntaje.', si: 'Sí, avísame', no: 'Ahora no' })
      .then((si) => { if (si) ANDROID.pedirNotificaciones(); });
  }
  VISTAS.usura = () => {
    const u = estado.ajustes.usura;
    return { titulo: 'Tasa de usura', html: `<section class="tarjeta heroe"><span class="etiqueta">Crédito de consumo y ordinario · ${esc(M.mesSolo(u.vigencia))} de ${u.vigencia.slice(0, 4)}</span>
      <strong class="cifra-heroe">${M.decimal(u.ea, 2)}% E.A.</strong><span class="sub">Equivale a ${M.decimal(M.eaAMensual(u.ea / 100) * 100, 2)}% M.V.</span></section>
      <p class="texto">Es el interés máximo que te puede cobrar cualquier entidad. La certifica la Superintendencia Financiera cada mes. Platica te avisa si alguna de tus deudas o simulaciones la supera.</p>
      <p class="texto">Se actualiza sola cuando hay conexión. Si quieres, puedes escribirla tú.</p>
      <form id="form-usura" autocomplete="off"><div class="fila-campos"><label class="campo"><span>Tasa (% E.A.)</span><input id="u-ea" class="entrada" inputmode="decimal" value="${esc(M.decimal(u.ea, 2))}"></label>
      <label class="campo"><span>Mes</span><input id="u-mes" type="month" class="entrada" value="${esc(u.vigencia)}"></label></div>
      <button type="submit" class="boton primario ancho">Guardar</button></form>
      <a class="boton borde ancho mt" href="https://www.superfinanciera.gov.co/">Ver en la Superintendencia Financiera</a>`,
    montar: (raiz) => {
      $('#form-usura', raiz).addEventListener('submit', (ev) => {
        ev.preventDefault();
        const ea = M.leerDecimal($('#u-ea', raiz).value);
        const mes = $('#u-mes', raiz).value;
        if (!(ea >= 1 && ea <= 200) || !M.esMes(mes)) return avisar('Revisa la tasa y el mes.');
        estado.ajustes.usura = { ea, vigencia: mes };
        guardar();
        cerrarVista();
        avisar('Tasa de usura guardada');
      });
    } };
  };
  VISTAS.respaldo = () => ({ titulo: 'Respaldo y exportar', html: `<p class="texto">Tus datos viven solo en este teléfono. Si lo pierdes o desinstalas la app sin respaldo, se pierden. Guarda una copia de vez en cuando (por ejemplo, en Google Drive).</p>
    <section class="tarjeta">
      <button type="button" class="ajuste" data-accion="guardar-respaldo">${icono('guardar')}<span>Guardar respaldo<small>Un archivo .json con todo</small></span></button>
      <label class="ajuste">${icono('descarga')}<span>Restaurar un respaldo<small>Reemplaza lo que hay en la app</small></span><input type="file" accept="application/json,.json" class="oculto-visual" data-respaldo></label>
      <button type="button" class="ajuste" data-accion="exportar-csv">${icono('documento')}<span>Exportar a Excel<small>Gastos e ingresos en .csv</small></span></button>
    </section>
    <section class="tarjeta"><button type="button" class="ajuste" data-accion="borrar-todo" style="color:var(--critico-texto)">${icono('basura')}<span>Borrar todos los datos<small>No se puede deshacer</small></span></button></section>
    <p class="nota">${plural(estado.gastos.length, 'gasto', 'gastos')}, ${plural(estado.ingresos.length, 'ingreso', 'ingresos')}, ${plural(estado.deudas.length, 'deuda', 'deudas')} y ${plural(estado.puntajes.length, 'puntaje', 'puntajes')} guardados.</p>` });
  VISTAS.acerca = () => ({ titulo: 'Acerca de Platica', html: `<div class="centrado" style="padding:12px 0 8px"><div class="logo" style="margin:0 auto 14px">${icono('moneda')}</div>
    <h2 style="margin-bottom:4px">Platica ${esc(app.nombre || '')}</h2><p class="sub">Gastos, ingresos, deudas y vida crediticia para Colombia.</p></div>
    <section class="tarjeta"><div class="parrafos"><p>Autor: Daniel Lezcano (Yextep).</p><p>Tus datos se guardan solo en este teléfono. La app solo se conecta a GitHub para saber si hay una versión nueva y la tasa de usura vigente.</p>
    <p>Los cálculos y recomendaciones son orientativos y no reemplazan la asesoría de un profesional ni la información oficial de tu entidad o de las centrales de riesgo.</p></div></section>
    <a class="boton borde ancho" href="https://github.com/Yextep/platica">Código en GitHub</a>` });

  // ---------- versiones nuevas de la app ----------
  // El APK dice qué versión es; en el navegador de las pruebas no hay nada que actualizar.
  function versionInstalada() {
    try {
      const v = JSON.parse(ANDROID.version());
      if (typeof v.nombre === 'string' && Number.isInteger(v.codigo) && v.codigo > 0) return v;
    } catch (e) { /* fuera de Android */ }
    return { nombre: '', codigo: 0 };
  }
  const app = versionInstalada();
  let nuevaVersion = null;
  let versionRevisada = false;
  let descarga = { estado: '', detalle: '' };
  // Solo se aceptan descargas de las releases del repositorio; Android además exige la misma firma para instalar encima.
  function aplicarManifiesto(m) {
    if (!app.codigo || !m || typeof m.version !== 'string' || !/^\d+(\.\d+){0,3}$/.test(m.version)
      || !Number.isInteger(m.codigo) || typeof m.apk !== 'string' || !m.apk.startsWith(DESCARGAS) || !m.apk.endsWith('.apk')
      || /[?#]|\.\./.test(m.apk)) return false;
    nuevaVersion = m.codigo > app.codigo ? {
      version: m.version, codigo: m.codigo, apk: m.apk,
      notas: typeof m.notas === 'string' ? m.notas.trim().slice(0, 600) : '',
      obligatoria: Number.isInteger(m.codigo_minimo) && app.codigo < m.codigo_minimo,
    } : null;
    return true;
  }
  // version.json también trae la tasa de usura del mes; se toma si es más reciente que la guardada.
  function aplicarUsura(m) {
    const u = m && m.usura;
    if (!u || typeof u.ea !== 'number' || !(u.ea >= 1 && u.ea <= 200) || !M.esMes(u.vigencia)) return;
    if (u.vigencia > estado.ajustes.usura.vigencia) {
      estado.ajustes.usura = { ea: u.ea, vigencia: u.vigencia };
      guardar();
    }
  }
  async function revisarVersion(manual) {
    if (!app.codigo) {
      if (manual) avisar('Las actualizaciones se buscan desde la app de Android.');
      versionRevisada = true;
      return;
    }
    try {
      const respuesta = await fetch(MANIFIESTO, { cache: 'no-store' });
      if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}`);
      const m = await respuesta.json();
      aplicarUsura(m);
      if (!aplicarManifiesto(m)) throw new Error('version.json no válido');
      ofrecerVersion(manual);
      if (manual && !nuevaVersion) avisar(`Tienes la versión más reciente (${app.nombre}).`);
    } catch (e) {
      // Sin conexión: se revisa otra vez la próxima vez que se abra la app.
      if (manual) avisar('No se pudo buscar la actualización. Revisa la conexión a internet.');
    } finally {
      versionRevisada = true;
      render();
    }
  }
  // Al abrir la app el aviso aparece solo si no hay otra cosa en pantalla y no se pospuso hace poco.
  function ofrecerVersion(manual) {
    if (!nuevaVersion) return;
    if (vistaActual() && vistaActual().tipo === 'version') return;
    if (nuevaVersion.obligatoria) {
      pila = [{ tipo: 'version', clave: ++claves }];
      render();
      return;
    }
    if (!manual) {
      let pospuesta = null;
      try { pospuesta = JSON.parse(localStorage.getItem(CLAVE_POSPUESTA)); } catch (e) { /* nada pospuesto */ }
      // El aviso también sale sobre la bienvenida: si algo impide terminarla, la versión nueva debe poder instalarse.
      const soloBienvenida = pila.length === 1 && pila[0].tipo === 'bienvenida';
      if ((pila.length && !soloBienvenida) || (pospuesta && pospuesta.codigo === nuevaVersion.codigo && Date.now() < pospuesta.hasta)) return;
    }
    mostrar({ tipo: 'version' });
  }
  function posponerVersion() {
    try {
      localStorage.setItem(CLAVE_POSPUESTA, JSON.stringify({ codigo: nuevaVersion.codigo, hasta: Date.now() + 3 * UN_DIA }));
    } catch (e) { /* se vuelve a ofrecer en la próxima apertura */ }
    cerrarVista();
  }
  VISTAS.version = () => {
    const n = nuevaVersion;
    if (!n) return null;
    const d = descarga;
    let estadoHtml = '';
    if (d.estado === 'descargando') {
      const pct = Number(d.detalle);
      estadoHtml = `<div class="progreso${pct >= 0 ? '' : ' indefinido'}"><span style="width:${pct >= 0 ? pct : 40}%"></span></div><p class="sub centrado">Descargando${pct >= 0 ? ` · ${pct}%` : '…'}</p>`;
    } else if (d.estado === 'permiso') {
      estadoHtml = `<div class="banner aviso">${icono('info')}<div><strong>Falta un permiso</strong><p>Android te pide permitir que Platica instale apps. Activa «Permitir de esta fuente», vuelve atrás y la instalación sigue sola.</p></div></div>`;
    } else if (d.estado === 'instalando') {
      estadoHtml = `<div class="banner bien">${icono('check')}<div><strong>Se abrió el instalador</strong><p>Toca «Actualizar». Platica se instala encima y conservas todos tus datos.</p></div></div>`;
    } else if (d.estado === 'error') {
      estadoHtml = `<div class="banner critico">${icono('alerta')}<div><p>${esc(d.detalle)}</p></div></div>`;
    }
    const descargandoAhora = d.estado === 'descargando';
    return { titulo: 'Actualización', sinCerrar: n.obligatoria, html: `<div class="centrado" style="padding:10px 0 6px"><div class="logo" style="margin:0 auto 16px">${icono('descarga')}</div>
      <h2 style="font-size:22px">Platica ${esc(n.version)} está disponible</h2>
      <p class="texto">${n.obligatoria ? `La versión ${esc(app.nombre)} ya no funciona. Actualiza para seguir usando Platica.` : `Tienes la versión ${esc(app.nombre)}.`}</p></div>
      ${n.notas ? `<div class="notas-version">${esc(n.notas)}</div>` : ''}
      <p class="texto">Se descarga de GitHub y se instala encima de la que tienes: no pierdes tus gastos, deudas ni puntajes.</p>
      ${estadoHtml}
      <button type="button" class="boton primario ancho" data-accion="instalar-version"${descargandoAhora ? ' disabled' : ''}>${icono('descarga')}${d.estado === 'error' ? 'Intentar otra vez' : 'Actualizar ahora'}</button>
      <a class="boton borde ancho mt" href="${esc(n.apk)}">Descargar en el navegador</a>
      ${n.obligatoria ? `<button type="button" class="boton ancho mt" data-accion="guardar-respaldo">${icono('guardar')}Guardar un respaldo de mis datos</button>`
        : '<button type="button" class="boton ancho mt" data-accion="posponer-version">Más tarde</button>'}` };
  };

  // ---------- recordatorios ----------
  let ultimosRecordatorios = [];
  let firmaRecordatorios = '';
  function sincronizarRecordatorios() {
    ultimosRecordatorios = M.recordatorios(estado);
    if (!ANDROID || typeof ANDROID.programarRecordatorios !== 'function') return;
    const json = JSON.stringify(ultimosRecordatorios);
    if (json === firmaRecordatorios) return;
    firmaRecordatorios = json;
    try { ANDROID.programarRecordatorios(json); } catch (e) { /* se reintenta en el próximo guardado */ }
  }

  // ---------- respaldo ----------
  function guardarArchivo(nombre, tipo, contenido) {
    if (ANDROID) {
      ANDROID.guardarArchivo(nombre, tipo, contenido);
      return;
    }
    const enlace = document.createElement('a');
    enlace.href = URL.createObjectURL(new Blob([contenido], { type: tipo }));
    enlace.download = nombre;
    document.body.appendChild(enlace);
    enlace.click();
    setTimeout(() => {
      URL.revokeObjectURL(enlace.href);
      enlace.remove();
    }, 1000);
  }
  function guardarRespaldo() {
    guardarYa();
    const contenido = JSON.stringify({ app: 'Platica', formato: 1, exportado: new Date().toISOString(), datos: estado }, null, 1);
    guardarArchivo(`Platica-respaldo-${M.hoy()}.json`, 'application/json', contenido);
  }
  async function restaurar(archivo) {
    if (!archivo) return;
    if (archivo.size > 16 * 1024 * 1024) return avisar('El archivo es demasiado grande.');
    let entrada;
    try {
      entrada = JSON.parse(await archivo.text());
    } catch (e) {
      return avisar('Ese archivo no es un respaldo de Platica.');
    }
    const datos = entrada && entrada.app === 'Platica' ? entrada.datos : entrada;
    if (!datos || typeof datos !== 'object' || !('gastos' in datos || 'deudas' in datos || 'perfil' in datos)) {
      return avisar('Ese archivo no es un respaldo de Platica.');
    }
    const nuevo = M.normalizarEstado(datos);
    const hayDatos = estado.gastos.length || estado.deudas.length || estado.ingresos.length;
    const resumen = `${plural(nuevo.gastos.length, 'gasto', 'gastos')}, ${plural(nuevo.ingresos.length, 'ingreso', 'ingresos')}, ${plural(nuevo.deudas.length, 'deuda', 'deudas')} y ${plural(nuevo.puntajes.length, 'puntaje', 'puntajes')}.`;
    if (!(await confirmar({ titulo: 'Restaurar respaldo', texto: `${hayDatos ? 'Se reemplazará todo lo que hay en la app. ' : ''}El respaldo tiene ${resumen}`, si: 'Restaurar', peligro: !!hayDatos }))) return;
    estado = nuevo;
    datosDanados = false;
    guardarYa();
    mesVista = M.mesActual();
    pila = estado.perfil.configurado ? [] : [{ tipo: 'bienvenida', paso: 2, clave: ++claves }];
    render(true);
    avisar('Respaldo restaurado');
  }
  document.addEventListener('change', (ev) => {
    if (ev.target.matches('input[data-respaldo]')) {
      const archivo = ev.target.files && ev.target.files[0];
      ev.target.value = '';
      restaurar(archivo);
    }
  });

  // ---------- acciones ----------
  const ACCIONES = {
    atras: () => atras(),
    pestana: (el) => irA(el.dataset.p),
    mes: (el) => {
      mesVista = M.sumarMeses(mesVista, Number(el.dataset.d));
      render();
    },
    'mes-ingresos': (el) => {
      const v = vistaActual();
      v.mes = M.sumarMeses(v.mes, Number(el.dataset.d));
      render(true);
    },
    'mes-resumen': (el) => {
      const v = vistaActual();
      v.mes = M.sumarMeses(v.mes, Number(el.dataset.d));
      v.automatico = false;
      render(true);
    },
    'nuevo-gasto': () => mostrar({ tipo: 'gasto' }),
    'editar-gasto': (el) => mostrar({ tipo: 'gasto', id: el.dataset.id }),
    'eliminar-gasto': async (el) => {
      const g = estado.gastos.find((x) => x.id === el.dataset.id);
      if (!g) return;
      if (!(await confirmar({ titulo: 'Eliminar gasto', texto: `${pesos(g.monto)} en ${M.categoria(estado, g.categoria).nombre}${g.deuda ? '. El saldo de la deuda vuelve a subir.' : '.'}`, si: 'Eliminar', peligro: true }))) return;
      pila.pop();
      eliminarGasto(g.id);
    },
    'nuevo-pago': () => {
      const deudas = M.activas(estado);
      mostrar({ tipo: 'gasto', categoria: 'deudas', deuda: deudas.length === 1 ? deudas[0].id : '', monto: deudas.length === 1 ? M.cuotaUsada(deudas[0]).cuota : 0 });
    },
    'pagar-deuda': (el) => {
      const d = deudaPorId(el.dataset.id);
      mostrar({ tipo: 'gasto', categoria: 'deudas', deuda: d.id, monto: M.cuotaUsada(d).cuota, fecha: el.dataset.fecha || M.hoy() });
    },
    'ver-fijos': () => {
      filtro.modo = 'fijos';
      irA('movimientos');
    },
    'nuevo-fijo': () => mostrar({ tipo: 'fijoForm' }),
    'ver-fijo': (el) => mostrar({ tipo: 'fijo', id: el.dataset.id }),
    'editar-fijo': (el) => mostrar({ tipo: 'fijoForm', id: el.dataset.id }),
    // Pagar un pago fijo: un gasto ya lleno con su valor, su categoría y su medio de pago.
    'pagar-fijo': (el) => {
      const f = estado.fijos.find((x) => x.id === el.dataset.id);
      if (!f) return;
      const mes = el.dataset.mes || M.mesActual();
      mostrar({ tipo: 'gasto', fijo: f.id, monto: f.monto, categoria: f.categoria, nota: f.nombre, medio: f.medio,
        fecha: mes === M.mesActual() ? M.hoy() : M.fechaFijo(f, mes) });
    },
    'cancelar-fijo': async (el) => {
      const f = estado.fijos.find((x) => x.id === el.dataset.id);
      const mes = M.mesActual();
      const siguiente = M.sumarMeses(mes, 1);
      const pagadoEsteMes = !!M.pagoDeFijo(estado, f, mes);
      const opcion = await elegir({ titulo: `Cancelar ${f.nombre}`, texto: 'Los pagos que ya registraste se quedan en tu historial y en tus resúmenes.',
        opciones: [{ valor: 'este', texto: pagadoEsteMes ? `Ya no lo pago desde ${M.mesSolo(siguiente)} (${M.mesSolo(mes)} ya está pagado)` : `Ya no lo pago desde ${M.mesSolo(mes)}`, clase: 'primario' },
          ...(pagadoEsteMes ? [] : [{ valor: 'proximo', texto: `Pago ${M.mesSolo(mes)} y lo cancelo desde ${M.mesSolo(siguiente)}` }])] });
      if (!opcion) return;
      f.fin = opcion === 'este' && !pagadoEsteMes ? M.sumarMeses(mes, -1) : mes;
      guardar();
      render(true);
      avisar(`${f.nombre} cancelado: desde ${M.mesSolo(M.sumarMeses(f.fin, 1))} ya no se cuenta.`);
    },
    'reactivar-fijo': (el) => {
      const f = estado.fijos.find((x) => x.id === el.dataset.id);
      const mes = M.mesActual();
      // Los meses en que estuvo cancelado no se cobran.
      for (let m = M.sumarMeses(f.fin, 1); m < mes; m = M.sumarMeses(m, 1)) if (m >= f.desde && !f.omitidos.includes(m)) f.omitidos.push(m);
      f.fin = '';
      guardar();
      render(true);
      avisar(`${f.nombre} vuelve a contarse desde ${M.mesSolo(mes)}.`);
    },
    'eliminar-fijo': async (el) => {
      const f = estado.fijos.find((x) => x.id === el.dataset.id);
      if (!(await confirmar({ titulo: `Eliminar ${f.nombre}`, texto: 'Los pagos que ya registraste se quedan en tus gastos. Si solo dejaste de pagarlo, mejor cancélalo: así se conserva el historial.', si: 'Eliminar', peligro: true }))) return;
      for (const g of estado.gastos) if (g.fijo === f.id) g.fijo = null;
      estado.fijos = estado.fijos.filter((x) => x !== f);
      guardar();
      cerrarVista();
      avisar('Pago fijo eliminado');
    },
    'nueva-categoria': () => mostrar({ tipo: 'categoria' }),
    'editar-categoria': (el) => mostrar({ tipo: 'categoria', id: el.dataset.id }),
    'eliminar-categoria': async (el) => {
      const cat = estado.categorias.find((x) => x.id === el.dataset.id);
      const usados = estado.gastos.filter((g) => g.categoria === cat.id).length;
      if (!(await confirmar({ titulo: `Eliminar ${cat.nombre}`, texto: usados ? `Sus ${usados} gastos pasarán a «Gastos personales».` : '', si: 'Eliminar', peligro: true }))) return;
      for (const g of estado.gastos) if (g.categoria === cat.id) g.categoria = 'personales';
      estado.categorias = estado.categorias.filter((x) => x !== cat);
      if (filtro.categoria === cat.id) filtro.categoria = '';
      guardar();
      cerrarVista();
      avisar('Categoría eliminada');
    },
    'ver-categorias': () => mostrar({ tipo: 'categorias' }),
    'filtrar-categoria': (el) => {
      filtro = { modo: 'gastos', categoria: el.dataset.id, texto: '' };
      irA('movimientos');
    },
    'filtro-cat': (el) => {
      filtro.categoria = el.dataset.id;
      render();
    },
    'modo-mov': (el) => {
      filtro.modo = el.dataset.m;
      render();
    },
    'ver-ingresos': () => mostrar({ tipo: 'ingresos', mes: mesVista }),
    'nuevo-ingreso': (el) => mostrar({ tipo: 'ingreso', mes: el.dataset.mes || (vistaActual() && vistaActual().mes) || mesVista }),
    'editar-ingreso': (el) => mostrar({ tipo: 'ingreso', id: el.dataset.id }),
    'eliminar-ingreso': async (el) => {
      const i = estado.ingresos.find((x) => x.id === el.dataset.id);
      if (!i || !(await confirmar({ titulo: 'Eliminar ingreso', texto: `${i.concepto}: ${pesos(i.monto)}`, si: 'Eliminar', peligro: true }))) return;
      estado.ingresos = estado.ingresos.filter((x) => x !== i);
      guardar();
      cerrarVista();
      avisar('Ingreso eliminado', () => {
        estado.ingresos.push(i);
        guardar();
        render(true);
      });
    },
    'ajustar-salario': (el) => {
      const mes = el.dataset.mes || mesVista;
      mostrar({ tipo: 'ingreso', mes, clase: 'salario', monto: ingresoMes(mes).salarioFijo });
    },
    'nueva-deuda': () => mostrar({ tipo: 'deudaForm' }),
    'editar-deuda': (el) => mostrar({ tipo: 'deudaForm', id: el.dataset.id }),
    'ver-deuda': (el) => mostrar({ tipo: 'deuda', id: el.dataset.id }),
    'actualizar-saldo': async (el) => {
      const d = deudaPorId(el.dataset.id);
      const valor = await pedirMonto({ titulo: 'Saldo actual', texto: `Escribe lo que debes hoy en ${d.nombre}, como aparece en la app o el extracto de la entidad.`, valor: d.saldo });
      if (valor == null) return;
      d.saldo = valor;
      d.historial.push({ fecha: M.hoy(), saldo: valor });
      d.historial = d.historial.slice(-240);
      guardar();
      render(true);
      avisar('Saldo actualizado');
    },
    'cerrar-deuda': async (el) => {
      const d = deudaPorId(el.dataset.id);
      if (d.cerrada) {
        d.cerrada = false;
        d.cerradaFecha = '';
      } else {
        if (d.saldo > 0 && !(await confirmar({ titulo: 'Marcar como pagada', texto: `El saldo de ${pesos(d.saldo)} quedará en cero.`, si: 'Marcar pagada' }))) return;
        d.cerrada = true;
        d.cerradaFecha = M.hoy();
        if (d.saldo) {
          d.saldo = 0;
          d.historial.push({ fecha: M.hoy(), saldo: 0 });
        }
      }
      guardar();
      render(true);
      avisar(d.cerrada ? `¡${d.nombre} pagada! Pide el paz y salvo.` : 'Deuda reabierta');
    },
    'eliminar-deuda': async (el) => {
      const d = deudaPorId(el.dataset.id);
      const pagos = M.pagosDe(estado, d.id).length;
      if (!(await confirmar({ titulo: `Eliminar ${d.nombre}`, texto: pagos ? `Sus ${pagos} pagos seguirán en tus gastos, pero sin enlazarse a la deuda.` : 'No se puede deshacer.', si: 'Eliminar', peligro: true }))) return;
      for (const g of estado.gastos) if (g.deuda && g.deuda.id === d.id) g.deuda = null;
      estado.deudas = estado.deudas.filter((x) => x !== d);
      guardar();
      cerrarVista();
      avisar('Deuda eliminada');
    },
    'ver-plan': () => mostrar({ tipo: 'plan' }),
    'ver-cuota': () => mostrar({ tipo: 'cuota' }),
    'ver-capacidad': () => mostrar({ tipo: 'capacidad' }),
    'ver-simulador-puntaje': () => mostrar({ tipo: 'simuladorPuntaje' }),
    'ver-diagnostico': (el) => mostrar({ tipo: 'diagnostico', f: el.dataset.f }),
    'ver-plan-puntaje': () => mostrar({ tipo: 'planPuntaje' }),
    'editar-reporte': () => mostrar({ tipo: 'reporte' }),
    'borrar-reporte': async () => {
      if (!(await confirmar({ titulo: 'Borrar reporte', texto: 'Se borran los datos del diagnóstico. Tus puntajes y deudas se conservan.', si: 'Borrar', peligro: true }))) return;
      estado.diagnostico = null;
      guardar();
      cerrarVista();
    },
    'nuevo-puntaje': () => mostrar({ tipo: 'puntaje' }),
    'ver-puntajes': () => mostrar({ tipo: 'puntajes' }),
    'eliminar-puntaje': async (el) => {
      if (!(await confirmar({ titulo: 'Eliminar puntaje', si: 'Eliminar', peligro: true }))) return;
      estado.puntajes = estado.puntajes.filter((p) => p.id !== el.dataset.id);
      guardar();
      render(true);
    },
    'ver-recomendaciones': () => mostrar({ tipo: 'recomendaciones', mes: mesVista }),
    'ver-resumen': () => mostrar({ tipo: 'resumen', mes: mesVista }),
    'compartir-resumen': (el) => { if (ANDROID) ANDROID.compartir(M.textoResumen(estado, el.dataset.mes)); },
    'ver-aprende': () => mostrar({ tipo: 'aprende' }),
    articulo: (el) => mostrar({ tipo: 'articulo', id: el.dataset.id }),
    'ver-perfil': () => mostrar({ tipo: 'perfil' }),
    'ver-recordatorios': () => mostrar({ tipo: 'recordatorios' }),
    'pedir-notificaciones': () => { if (ANDROID) ANDROID.pedirNotificaciones(); },
    'ver-usura': () => mostrar({ tipo: 'usura' }),
    'ver-respaldo': () => mostrar({ tipo: 'respaldo' }),
    'ver-acerca': () => mostrar({ tipo: 'acerca' }),
    'guardar-respaldo': () => guardarRespaldo(),
    'exportar-csv': () => guardarArchivo(`Platica-movimientos-${M.hoy()}.csv`, 'text/csv', M.gastosCSV(estado)),
    'borrar-todo': async () => {
      if (!(await confirmar({ titulo: 'Borrar todos los datos', texto: 'Se borran gastos, ingresos, deudas, puntajes y ajustes. Guarda un respaldo antes si lo quieres conservar.', si: 'Borrar todo', peligro: true }))) return;
      estado = M.estadoVacio();
      guardarYa();
      mesVista = M.mesActual();
      pestana = 'inicio';
      pila = [{ tipo: 'bienvenida', clave: ++claves }];
      render(true);
    },
    'bienvenida-siguiente': () => {
      vistaActual().paso = 2;
      render(true);
    },
    'buscar-version': () => revisarVersion(true),
    'ver-version': () => mostrar({ tipo: 'version' }),
    'posponer-version': () => posponerVersion(),
    'instalar-version': () => {
      if (!nuevaVersion) return;
      if (ANDROID && typeof ANDROID.descargarActualizacion === 'function') {
        descarga = { estado: 'descargando', detalle: '-1' };
        render(true);
        ANDROID.descargarActualizacion(nuevaVersion.apk);
      } else {
        window.open(nuevaVersion.apk, '_blank');
      }
    },
  };
  document.addEventListener('click', (ev) => {
    const el = ev.target.closest('[data-accion]');
    if (!el || el.disabled) return;
    const accion = ACCIONES[el.dataset.accion];
    if (!accion) return;
    ev.preventDefault();
    // Una acción puede cambiar la pantalla: primero se guarda lo escrito y se sale del campo.
    if (escribiendo() && !el.matches(CAMPOS_TEXTO)) {
      capturar();
      document.activeElement.blur();
    }
    accion(el, ev);
  });

  // El teclado de Android encoge la pantalla: cambia el alto, no el ancho. Eso no debe redibujar nada, porque el campo
  // donde se escribe se reemplazaría y el teclado se cerraría. Solo un cambio de ancho (girar el teléfono) redibuja
  // las gráficas, y se espera a que no haya un campo activo.
  let anchoVista = document.documentElement.clientWidth;
  let altoLibre = window.innerHeight;
  let redibujar = false;
  let temporizadorAncho = null;
  function redibujarSiHaceFalta() {
    if (!redibujar || escribiendo()) return;
    redibujar = false;
    capturar();
    render(true);
  }
  window.addEventListener('resize', () => {
    const ancho = document.documentElement.clientWidth;
    const alto = window.innerHeight;
    if (ancho !== anchoVista) {
      anchoVista = ancho;
      altoLibre = alto;
      redibujar = true;
    } else {
      altoLibre = Math.max(altoLibre, alto);
    }
    // Con el teclado abierto se esconden las pestañas y el botón +, y el campo activo queda a la vista.
    const teclado = alto < altoLibre * 0.8;
    document.body.classList.toggle('teclado', teclado);
    if (teclado && escribiendo()) {
      setTimeout(() => { if (escribiendo()) document.activeElement.scrollIntoView({ block: 'center', behavior: 'smooth' }); }, 150);
    }
    clearTimeout(temporizadorAncho);
    temporizadorAncho = setTimeout(redibujarSiHaceFalta, 200);
  });
  document.addEventListener('focusout', () => setTimeout(redibujarSiHaceFalta, 50));

  // ---------- cambio de mes y vuelta a la app ----------
  let mesAbierto = M.mesActual();
  function revisarCambioDeMes() {
    const actual = M.mesActual();
    if (actual !== mesAbierto) {
      if (mesVista === mesAbierto) mesVista = actual;
      mesAbierto = actual;
    }
    // El resumen del mes anterior aparece una sola vez, al abrir la app en el mes siguiente.
    const anterior = M.sumarMeses(actual, -1);
    if (estado.perfil.configurado && !pila.length && estado.vistos.resumen < anterior
      && estado.gastos.some((g) => g.fecha.startsWith(anterior))) {
      estado.vistos.resumen = anterior;
      guardar();
      mostrar({ tipo: 'resumen', mes: anterior, automatico: true });
    }
  }

  // ---------- API para Android y las pruebas ----------
  window.Platica = {
    listo: false,
    atras,
    guardarYa,
    alVolver() {
      let cambio = false;
      if (ANDROID) {
        try {
          const p = ANDROID.permisoNotificaciones();
          if (p !== permisoNotif) {
            permisoNotif = p;
            cambio = true;
          }
        } catch (e) { /* sin cambios */ }
      }
      revisarCambioDeMes();
      if (aplicarCobrosAutomaticos()) render();
      sincronizarRecordatorios();
      if (cambio && vistaActual() && vistaActual().tipo === 'recordatorios') render(true);
    },
    permisoNotificaciones(p) {
      permisoNotif = p;
      if (vistaActual() && vistaActual().tipo === 'recordatorios') render(true);
      if (p === 'concedido') avisar('Listo: te avisaré antes de cada cuota.');
    },
    estadoDescarga(e, detalle) {
      descarga = { estado: e, detalle: detalle || '' };
      if (vistaActual() && vistaActual().tipo === 'version') {
        if (e === 'descargando') {
          const barra = $('#hoja .progreso span');
          const texto = $('#hoja .progreso + p');
          if (barra && texto && Number(detalle) >= 0) {
            barra.parentElement.classList.remove('indefinido');
            barra.style.width = `${detalle}%`;
            texto.textContent = `Descargando · ${detalle}%`;
            return;
          }
        }
        render(true);
      }
    },
    archivoGuardado() { avisar('Archivo guardado'); },
    descarga: () => ({ ...descarga }),
    vista: () => (pila.length ? pila[pila.length - 1].tipo : pestana),
    pestana: () => pestana,
    estado: () => JSON.parse(JSON.stringify(estado)),
    recordatorios: () => ultimosRecordatorios.map((r) => ({ ...r })),
    versionApp: () => ({ ...app }),
    nuevaVersion: () => (nuevaVersion ? { ...nuevaVersion } : null),
    versionRevisada: () => versionRevisada || !app.codigo,
    // Las pruebas entregan un version.json sin publicarlo.
    probarManifiesto(m) {
      aplicarUsura(m);
      if (!aplicarManifiesto(m)) return false;
      ofrecerVersion(false);
      render();
      return !!nuevaVersion;
    },
  };

  // ---------- arranque ----------
  if (!estado.perfil.configurado) pila = [{ tipo: 'bienvenida', clave: ++claves }];
  aplicarCobrosAutomaticos();
  render();
  revisarCambioDeMes();
  sincronizarRecordatorios();
  window.Platica.listo = true;
  revisarVersion(false);
})();
