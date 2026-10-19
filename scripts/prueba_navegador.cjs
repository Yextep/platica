// Recorre la interfaz de Platica en Chromium con tamaño de celular y guarda capturas en docs/.
// Uso: node scripts/prueba_navegador.cjs
// Requiere el paquete playwright y su Chromium. La fecha se fija en el 19 de octubre de 2026 (hora de Bogotá).
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { chromium } = require('playwright');

const RAIZ = path.resolve(__dirname, '..');
const WEB = path.join(RAIZ, 'app/src/main/assets/web');
const DOCS = path.join(RAIZ, 'docs');
const MANIFIESTO = 'https://raw.githubusercontent.com/Yextep/platica/main/version.json';
const AHORA = new Date('2026-10-19T12:00:00-05:00');
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css' };

// Sirve los archivos con las mismas rutas que WebViewAssetLoader en Android.
function servidor() {
  return http.createServer((req, res) => {
    const ruta = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    const archivo = ruta.startsWith('/assets/web/') ? path.join(WEB, ruta.slice('/assets/web/'.length)) : null;
    if (!archivo || !archivo.startsWith(WEB) || !fs.existsSync(archivo) || fs.statSync(archivo).isDirectory()) {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(200, { 'Content-Type': TIPOS[path.extname(archivo)] || 'application/octet-stream' });
    fs.createReadStream(archivo).pipe(res);
  });
}

let pruebas = 0;
// Compara dos estados sin importar el orden de las claves.
function canonico(v) {
  if (Array.isArray(v)) return v.map(canonico);
  if (v && typeof v === 'object') return Object.fromEntries(Object.keys(v).sort().map((k) => [k, canonico(v[k])]));
  return v;
}
const igual = (a, b) => JSON.stringify(canonico(a)) === JSON.stringify(canonico(b));
function comprobar(condicion, mensaje) {
  if (!condicion) throw new Error(`Falló: ${mensaje}`);
  pruebas += 1;
  console.log(`ok - ${mensaje}`);
}

async function abrir(navegador, url, opciones = {}) {
  const contexto = await navegador.newContext({
    viewport: { width: 412, height: 860 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
    locale: 'es-CO', timezoneId: 'America/Bogota', colorScheme: opciones.oscuro ? 'dark' : 'light', acceptDownloads: true,
  });
  const errores = [];
  const pagina = await contexto.newPage();
  pagina.on('pageerror', (e) => errores.push(e.message));
  pagina.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errores.push(m.text()); });
  await pagina.clock.setFixedTime(AHORA);
  // GitHub no participa en la prueba salvo que la prueba entregue su propio version.json.
  await pagina.route('https://raw.githubusercontent.com/**', (ruta) => ruta.fulfill({ status: 404, body: '' }));
  if (opciones.preparar) await opciones.preparar(pagina);
  await pagina.goto(url);
  await pagina.waitForFunction(() => window.Platica && window.Platica.listo, null, { timeout: 30000 });
  return { contexto, pagina, errores };
}

const vista = (p) => p.evaluate(() => Platica.vista());
const estado = (p) => p.evaluate(() => Platica.estado());
async function esperarVista(p, nombre) {
  await p.waitForFunction((n) => Platica.vista() === n, nombre, { timeout: 10000 });
}
async function captura(p, nombre, completa = false) {
  await p.waitForTimeout(250);
  // La hoja tiene su propio desplazamiento: para la captura completa se muestra como página normal.
  const hoja = completa && await p.isVisible('#hoja');
  if (hoja) await p.addStyleTag({ content: '#app{display:none!important} #hoja{position:static!important;overflow:visible!important;animation:none!important}', }).then((h) => h.evaluate((e) => e.setAttribute('data-captura', '')));
  await p.screenshot({ path: path.join(DOCS, `platica-${nombre}.png`), fullPage: completa });
  if (hoja) await p.evaluate(() => document.querySelectorAll('style[data-captura]').forEach((e) => e.remove()));
}
async function cerrarAvisos(p) {
  await p.evaluate(() => document.querySelectorAll('#aviso .toast').forEach((t) => t.remove()));
}

async function registrarGasto(p, { monto, categoria, nota, medio, fecha }) {
  await p.click('#agregar');
  await esperarVista(p, 'gasto');
  await p.fill('#g-monto', String(monto));
  await p.click(`[data-cat="${categoria}"]`);
  if (fecha) await p.fill('#g-fecha', fecha);
  if (medio) await p.click(`[data-medio="${medio}"]`);
  if (nota) await p.fill('#g-nota', nota);
  await p.click('#form-gasto button[type=submit]');
  await p.waitForFunction(() => Platica.vista() !== 'gasto');
}

async function agregarDeuda(p, d) {
  await p.evaluate(() => document.querySelector('[data-accion="nueva-deuda"]').click());
  await esperarVista(p, 'deudaForm');
  await p.selectOption('#d-tipo', d.tipo);
  await p.fill('#d-nombre', d.nombre);
  if (d.entidad) await p.fill('#d-entidad', d.entidad);
  await p.fill('#d-inicial', String(d.inicial));
  await p.fill('#d-saldo', String(d.saldo));
  if (d.cuota) await p.fill('#d-cuota', String(d.cuota));
  if (d.dia) await p.fill('#d-dia', String(d.dia));
  if (d.tasa) {
    await p.fill('#d-tasa', d.tasa);
    await p.click(`[data-tasa="${d.tipoTasa || 'EA'}"]`);
  }
  if (d.apertura) await p.fill('#d-apertura', d.apertura);
  if (d.plazo) await p.fill('#d-plazo', String(d.plazo));
  await p.click('#form-deuda button[type=submit]');
  await esperarVista(p, 'deuda');
  await cerrarAvisos(p);
  // Si la app ofrece los recordatorios, se responde «Ahora no».
  if (await p.isVisible('#dialogo [data-r=no]')) await p.click('#dialogo [data-r=no]');
}

async function principal() {
  fs.mkdirSync(DOCS, { recursive: true });
  const srv = servidor();
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${srv.address().port}/assets/web/index.html`;
  const navegador = await chromium.launch();
  const temporal = fs.mkdtempSync(path.join(os.tmpdir(), 'platica-'));
  try {
    // ---------- bienvenida ----------
    const { pagina: p, errores } = await abrir(navegador, url);
    comprobar((await vista(p)) === 'bienvenida', 'la primera vez muestra la bienvenida');
    await captura(p, 'bienvenida');
    comprobar((await p.evaluate(() => Platica.atras())) === false, 'atrás en la bienvenida deja salir de la app');
    await p.click('[data-accion=bienvenida-siguiente]');
    await p.click('#form-bienvenida button[type=submit]');
    comprobar(await p.isVisible('#b-error'), 'pide el ingreso mensual');
    await p.fill('#b-nombre', 'Daniel');
    await p.fill('#b-ingreso', '2000000');
    comprobar((await p.inputValue('#b-ingreso')) === '$2.000.000', 'el ingreso se escribe con puntos de miles');
    await p.click('#form-bienvenida button[type=submit]');
    await esperarVista(p, 'inicio');
    let e = await estado(p);
    comprobar(e.perfil.configurado && e.perfil.ingresoBase === 2000000 && e.perfil.desde === '2026-10' && e.perfil.nombre === 'Daniel',
      'guarda el perfil con el ingreso mensual');
    comprobar(await p.isVisible('text=¿Cuánto recibiste en octubre?'), 'pregunta cuánto se recibió en el mes');
    await captura(p, 'inicio-vacio');

    // ---------- gastos ----------
    await registrarGasto(p, { monto: 45000, categoria: 'comida', nota: 'Mercado', medio: 'efectivo' });
    await registrarGasto(p, { monto: 800000, categoria: 'arriendo', fecha: '2026-10-01' });
    await registrarGasto(p, { monto: 120000, categoria: 'servicios', nota: 'Luz y agua', medio: 'nequi', fecha: '2026-10-05' });
    for (let i = 0; i < 9; i++) await registrarGasto(p, { monto: 12000, categoria: 'personales', nota: `Tinto ${i + 1}`, fecha: `2026-10-1${i}` });
    e = await estado(p);
    comprobar(e.gastos.length === 12 && e.gastos.find((g) => g.nota === 'Luz y agua').medio === 'nequi', 'registra gastos con categoría, fecha, medio y nota');

    // Categoría propia desde el formulario: lo escrito se conserva y queda elegida.
    await p.click('#agregar');
    await p.fill('#g-monto', '9000');
    await p.fill('#g-nota', 'Bus');
    await p.click('[data-accion=nueva-categoria]');
    await esperarVista(p, 'categoria');
    await p.click('[data-sugerencia="Transporte"]');
    await p.click('#form-cat button[type=submit]');
    await esperarVista(p, 'gasto');
    comprobar((await p.inputValue('#g-monto')) === '$9.000' && (await p.inputValue('#g-nota')) === 'Bus', 'al volver de crear la categoría se conserva el gasto escrito');
    comprobar(await p.isVisible('.cat-boton[aria-pressed=true]:has-text("Transporte")'), 'la categoría nueva queda elegida');
    await captura(p, 'gasto');
    await p.click('#form-gasto button[type=submit]');
    await esperarVista(p, 'inicio');
    e = await estado(p);
    const transporte = e.categorias.find((c) => c.nombre === 'Transporte');
    comprobar(transporte && !transporte.base && transporte.color === 8 && transporte.icono === 'bus' && transporte.tipo === 'necesidad'
      && e.gastos.some((g) => g.categoria === transporte.id && g.monto === 9000), 'crea una categoría propia y registra el gasto en ella');

    // Deshacer un gasto recién guardado.
    await registrarGasto(p, { monto: 5000, categoria: 'imprevistos' });
    await p.click('#aviso .toast button');
    comprobar((await estado(p)).gastos.length === 13, '«Deshacer» quita el gasto recién guardado');

    // ---------- ingresos ----------
    await p.click('[data-accion=confirmar-ingreso]');
    e = await estado(p);
    comprobar(e.ingresos.length === 1 && e.ingresos[0].monto === 2000000 && e.ingresos[0].fecha === '2026-10-19', 'confirma el ingreso del mes con un toque');
    await p.click('[data-accion=ver-ingresos]');
    await esperarVista(p, 'ingresos');
    await p.click('[data-accion=nuevo-ingreso]');
    await esperarVista(p, 'ingreso');
    await p.fill('#i-monto', '150000');
    await p.click('[data-concepto="Honorarios"]');
    await p.click('#form-ingreso button[type=submit]');
    await esperarVista(p, 'ingresos');
    comprobar(await p.isVisible('text=+$150.000'), 'agrega otro ingreso al mes');
    await p.click('[data-accion=atras]');
    await esperarVista(p, 'inicio');
    const heroe = await p.textContent('.heroe .cifra-heroe');
    comprobar(heroe === '$1.068.000', `el inicio muestra lo que queda: ${heroe}`);
    comprobar(await p.isVisible('.grafica svg path.linea'), 'dibuja la línea del gasto acumulado');
    comprobar((await p.locator('.barra-cat').count()) === 5, 'muestra una barra por categoría usada');
    comprobar(await p.isVisible('text=Regla 50/30/20'), 'muestra la regla 50/30/20');
    comprobar(await p.isVisible('text=Arriendo').catch(() => false), 'el arriendo aparece en las categorías');
    comprobar(await p.isVisible('.reco:has-text("El arriendo se lleva el")'), 'recomienda revisar el arriendo alto');
    // Tooltip de la gráfica.
    await cerrarAvisos(p);
    await p.locator('.grafica .zona').first().evaluate((el) => el.scrollIntoView({ block: 'center' }));
    const zona = await p.locator('.grafica .zona').first().boundingBox();
    await p.mouse.move(zona.x + zona.width * 0.3, zona.y + 40);
    comprobar(await p.isVisible('#tooltip:has-text("gastado hasta ese día")'), 'el tooltip de la línea muestra el acumulado');
    await p.mouse.move(5, 5);
    await cerrarAvisos(p);
    await captura(p, 'inicio', true);

    // ---------- movimientos ----------
    await p.click('[data-accion=pestana][data-p=movimientos]');
    comprobar((await p.locator('#lista-mov .fila').count()) === 13, 'lista los 13 gastos del mes');
    await p.fill('#buscar', 'tinto');
    comprobar((await p.locator('#lista-mov .fila').count()) === 9, 'busca por nota');
    await p.fill('#buscar', '');
    await p.click('[data-accion=filtro-cat][data-id=arriendo]');
    comprobar((await p.locator('#lista-mov .fila').count()) === 1, 'filtra por categoría');
    await p.click('[data-accion=filtro-cat][data-id=""]');
    await captura(p, 'movimientos');
    await p.click('#lista-mov .fila:has-text("Mercado")');
    await esperarVista(p, 'gasto');
    await p.fill('#g-monto', '52000');
    await p.click('#form-gasto button[type=submit]');
    comprobar((await estado(p)).gastos.find((g) => g.nota === 'Mercado').monto === 52000, 'edita un gasto');
    await p.click('#lista-mov .fila:has-text("Tinto 9")');
    await p.click('[data-accion=eliminar-gasto]');
    await p.click('#dialogo [data-r=si]');
    comprobar((await estado(p)).gastos.length === 12, 'elimina un gasto después de confirmar');
    await p.click('[data-accion=modo-mov][data-m=ingresos]');
    comprobar((await p.locator('.fila .valor.ingreso').count()) === 2, 'muestra los ingresos del mes');
    await p.click('[data-accion=modo-mov][data-m=gastos]');

    // ---------- deudas ----------
    await p.click('[data-accion=pestana][data-p=deudas]');
    comprobar(await p.isVisible('text=Agregar mi primera deuda'), 'sin deudas invita a agregarlas');
    await agregarDeuda(p, { tipo: 'tarjeta', nombre: 'Tarjeta Visa', entidad: 'Banco', inicial: 480000, saldo: 680000, cuota: 60000, dia: 25,
      tasa: '18', tipoTasa: 'EA', apertura: '2026-10' });
    comprobar(await p.isVisible('text=Usas el 142% de tu cupo de $480.000'), 'la tarjeta muestra el uso del cupo');
    await p.click('[data-accion=atras]');
    await agregarDeuda(p, { tipo: 'sector_real', nombre: 'Crédito almacén', inicial: 8959000, saldo: 4453000, cuota: 350000, dia: 10,
      tasa: '1,9', tipoTasa: 'MV', apertura: '2025-09', plazo: 36 });
    comprobar(await p.isVisible('text=Has pagado el 50% de $8.959.000'), 'el crédito muestra cuánto se ha pagado');
    comprobar(await p.isVisible('text=Cuándo terminas de pagar'), 'proyecta cuándo se termina de pagar');
    await p.fill('#dd-extra', '100000');
    comprobar(await p.isVisible('#dd-extra-res .grande'), 'calcula el efecto de un abono extra');
    await captura(p, 'deuda', true);
    await p.click('[data-accion=atras]');
    comprobar((await p.textContent('.heroe .cifra-heroe')) === '$5.133.000', 'suma la deuda total como el reporte de Midatacrédito');
    comprobar(await p.isVisible('.cifra:has-text("Uso de tarjetas"):has-text("142%")'), 'calcula el uso de las tarjetas');
    await captura(p, 'deudas', true);

    // Pago de la tarjeta desde la deuda: baja el saldo y queda como gasto de la categoría Deudas.
    await p.click('.deuda:has-text("Tarjeta Visa")');
    await p.click('[data-accion=pagar-deuda]');
    await esperarVista(p, 'gasto');
    comprobar((await p.inputValue('#g-monto')) === '$60.000', 'el pago propone la cuota de la deuda');
    await p.fill('#g-monto', '200000');
    await p.waitForSelector('#g-saldo');
    const saldoPropuesto = await p.inputValue('#g-saldo');
    comprobar(saldoPropuesto === '$489.444', `reparte el pago entre interés y capital: ${saldoPropuesto}`);
    await p.click('#form-gasto button[type=submit]');
    await esperarVista(p, 'deuda');
    e = await estado(p);
    const tarjeta = e.deudas.find((d) => d.nombre === 'Tarjeta Visa');
    const pago = e.gastos.find((g) => g.deuda && g.deuda.id === tarjeta.id);
    comprobar(tarjeta.saldo === 489444 && pago.categoria === 'deudas' && pago.deuda.capital === 190556 && pago.deuda.interes === 9444,
      'el pago baja el saldo de la deuda y queda en los gastos');
    comprobar(await p.isVisible('.fila:has-text("$190.556 a capital")'), 'la deuda lista sus pagos');
    // Editar el pago con otro saldo corrige la deuda sin contar dos veces.
    await p.click('.fila:has-text("$190.556 a capital")');
    await esperarVista(p, 'gasto');
    await p.fill('#g-saldo', '480000');
    await p.click('#form-gasto button[type=submit]');
    await esperarVista(p, 'deuda');
    e = await estado(p);
    comprobar(e.deudas.find((d) => d.id === tarjeta.id).saldo === 480000 && e.gastos.filter((g) => g.deuda).length === 1,
      'editar el pago con el saldo del banco corrige la deuda');
    await p.click('[data-accion=atras]');

    // Plan de pagos.
    await p.click('[data-accion=ver-plan]');
    await esperarVista(p, 'plan');
    await p.fill('#p-extra', '150000');
    comprobar(await p.isVisible('#p-resultado .cifra-heroe'), 'el plan dice en cuántos meses se sale de deudas');
    const leerPlan = async () => ({
      orden: await p.locator('#p-resultado .fila .centro strong').allTextContents(),
      intereses: Number((await p.textContent('#p-resultado .cifra:has-text("Intereses en total") strong')).replace(/\D/g, '')),
    });
    const avalancha = await leerPlan();
    await p.click('[data-estrategia=bola]');
    const bola = await leerPlan();
    comprobar(avalancha.orden[0] === 'Crédito almacén' && bola.orden[0] === 'Tarjeta Visa', 'avalancha abona primero a la tasa más alta y bola de nieve a la deuda más pequeña');
    comprobar(avalancha.intereses < bola.intereses, `la avalancha paga menos intereses (${avalancha.intereses} contra ${bola.intereses})`);
    comprobar((await p.locator('#p-resultado .leyenda span').count()) === 2, 'la gráfica del plan compara con pagar solo cuotas');
    await captura(p, 'plan', true);
    await p.click('[data-accion=atras]');

    // ---------- mi crédito ----------
    await p.click('[data-accion=pestana][data-p=credito]');
    await p.click('[data-accion=nuevo-puntaje]');
    await esperarVista(p, 'puntaje');
    await p.fill('#pp-valor', '1200');
    await p.click('#form-puntaje button[type=submit]');
    comprobar(await p.isVisible('#pp-error'), 'no acepta puntajes fuera de la escala');
    await p.fill('#pp-valor', '585');
    await p.fill('#pp-fecha', '2026-09-15');
    await p.click('#form-puntaje button[type=submit]');
    await esperarVista(p, 'credito');
    await p.click('[data-accion=editar-reporte]');
    await esperarVista(p, 'reporte');
    await p.fill('#r-fecha', '2026-10-18');
    await p.fill('#r-puntaje', '602');
    await p.selectOption('#r-f-experiencia', 'regular');
    await p.selectOption('#r-f-portafolio', 'bueno');
    await p.selectOption('#r-f-endeudamiento', 'bueno');
    await p.selectOption('#r-f-habitos', 'excelente');
    for (const [id, valor] of [['antiguedadPromedio', '13'], ['aperturas6m', '3'], ['mesesUltimaApertura', '0'], ['probIncumplimiento', '20'],
      ['utilizacionRotativos', '144,44'], ['saldoPlazoFijo', '49,71'], ['utilizacionGeneral', '54,46'], ['productosSinNegativos', '2']]) {
      await p.fill(`#r-${id}`, valor);
    }
    await p.check('#r-pagosATiempo12m', { force: true });
    await p.click('#form-reporte button[type=submit]');
    await esperarVista(p, 'credito');
    e = await estado(p);
    comprobar(e.puntajes.length === 2 && e.puntajes[1].valor === 602 && e.diagnostico.datos.utilizacionRotativos === 144.44
      && e.diagnostico.factores.habitos === 'excelente', 'guarda el reporte de Midatacrédito y el puntaje');
    comprobar(await p.isVisible('.puntaje-grande:has-text("602")') && await p.isVisible('text=+17'), 'muestra el puntaje y el cambio frente al anterior');
    comprobar((await p.locator('.factor').count()) === 4, 'muestra los cuatro factores del diagnóstico');
    comprobar(await p.isVisible('.reco:has-text("Baja Tarjeta Visa por debajo del cupo")') === false, 'con la tarjeta dentro del cupo no pide salir del sobrecupo');
    await captura(p, 'credito', true);
    await p.click('[data-accion=ver-diagnostico] >> nth=0');
    await esperarVista(p, 'diagnostico');
    comprobar(await p.isVisible('text=144,4%') && await p.isVisible('text=Usas el 100% del cupo'), 'el diagnóstico compara el reporte con los datos de hoy');
    comprobar(await p.isVisible('text=No has tenido moras de más de 60 días') && await p.isVisible('text=En los últimos 12 meses pagaste'), 'usa los hábitos de pago del reporte');
    await captura(p, 'diagnostico', true);
    await p.click('[data-accion=atras]');

    await p.click('[data-accion=ver-simulador-puntaje]');
    await esperarVista(p, 'simuladorPuntaje');
    const rango = async () => p.textContent('#s-resultado h3:nth-of-type(2)');
    const conPagos = await rango();
    await p.click('[data-mora="60"]');
    const conMora = await rango();
    const numeros = (t) => t.match(/\d+/g).map(Number);
    comprobar(numeros(conMora.replace('3 meses', ''))[0] < numeros(conPagos.replace('3 meses', ''))[0], `atrasarse baja la estimación (${conPagos} → ${conMora})`);
    await p.click('[data-mora="0"]');
    await captura(p, 'simulador', true);
    await p.click('[data-accion=atras]');

    await p.click('[data-accion=ver-capacidad]');
    await esperarVista(p, 'capacidad');
    comprobar((await p.inputValue('#k-ingresos')) === '$2.150.000' && (await p.inputValue('#k-financieros')) === '$410.000',
      'el simulador de crédito toma los ingresos y las cuotas registradas');
    comprobar((await p.locator('.producto').count()) === 4, 'estima la viabilidad de cada tipo de crédito');
    await captura(p, 'capacidad', true);
    await p.click('[data-accion=atras]');

    await p.click('[data-accion=ver-cuota]');
    await esperarVista(p, 'cuota');
    await p.fill('#q-monto', '10000000');
    await p.fill('#q-tasa', '1,5');
    await p.fill('#q-plazo', '60');
    comprobar((await p.textContent('#q-resultado .grande')) === '$253.934', 'la calculadora da la cuota fija del sistema francés');
    await p.fill('#q-tasa', '2,5');
    comprobar(await p.isVisible('text=Esa tasa supera la usura'), 'avisa cuando la tasa supera la usura');
    await p.click('[data-accion=atras]');

    await p.click('[data-accion=ver-aprende]');
    await p.click('[data-accion=articulo][data-id=reportes]');
    comprobar(await p.isVisible('text=máximo 4 años contados desde que pagas'), 'explica la ley de reportes negativos');
    await p.click('[data-accion=atras]');
    await p.click('[data-accion=atras]');

    // ---------- resumen ----------
    await p.click('[data-accion=pestana][data-p=inicio]');
    await p.click('[data-accion=ver-resumen]');
    await esperarVista(p, 'resumen');
    comprobar(await p.isVisible('text=Por categoría') && await p.isVisible('text=Gastos hormiga'), 'el resumen del mes trae categorías y datos');
    await captura(p, 'resumen', true);
    await p.click('[data-accion=atras]');

    // ---------- recordatorios ----------
    const avisos = (await p.evaluate(() => Platica.recordatorios())).map((r) => r.id);
    const almacen = (await estado(p)).deudas.find((d) => d.nombre === 'Crédito almacén');
    comprobar(!avisos.includes(`${tarjeta.id}-2026-10-25-antes`) && avisos.includes(`${tarjeta.id}-2026-11-25-antes`)
      && avisos.includes(`${almacen.id}-2026-11-10-antes`) && avisos.includes('resumen-2026-10'),
      'programa los recordatorios de las cuotas que faltan y omite la que ya se pagó');

    // ---------- persistencia, respaldo y exportación ----------
    const antes = await estado(p);
    await p.reload();
    await p.waitForFunction(() => window.Platica && Platica.listo);
    comprobar(igual(await estado(p), antes) && (await vista(p)) === 'inicio', 'los datos se conservan al volver a abrir');
    await p.click('[data-accion=pestana][data-p=mas]');
    await p.click('[data-accion=ver-respaldo]');
    const [respaldo] = await Promise.all([p.waitForEvent('download'), p.click('[data-accion=guardar-respaldo]')]);
    const rutaRespaldo = path.join(temporal, respaldo.suggestedFilename());
    await respaldo.saveAs(rutaRespaldo);
    comprobar(/^Platica-respaldo-2026-10-19\.json$/.test(respaldo.suggestedFilename()), 'guarda el respaldo con la fecha');
    const [csv] = await Promise.all([p.waitForEvent('download'), p.click('[data-accion=exportar-csv]')]);
    const textoCsv = fs.readFileSync(await csv.path(), 'utf8');
    comprobar(textoCsv.startsWith('﻿Fecha;Tipo;Categoría') && textoCsv.includes('Luz y agua') && textoCsv.includes('Ingreso'), 'exporta un CSV para Excel');
    await p.click('[data-accion=borrar-todo]');
    await p.click('#dialogo [data-r=si]');
    await esperarVista(p, 'bienvenida');
    comprobar((await estado(p)).gastos.length === 0, 'borra todos los datos');
    await p.setInputFiles('input[data-respaldo]', rutaRespaldo);
    await p.click('#dialogo [data-r=si]');
    await esperarVista(p, 'inicio');
    comprobar(igual(await estado(p), antes), 'restaura el respaldo completo');
    fs.writeFileSync(path.join(temporal, 'malo.json'), '{"hola": 1}');
    await p.click('[data-accion=pestana][data-p=mas]');
    await p.click('[data-accion=ver-respaldo]');
    await p.setInputFiles('input[data-respaldo]', path.join(temporal, 'malo.json'));
    comprobar(await p.waitForSelector('text=Ese archivo no es un respaldo de Platica.', { timeout: 5000 }).then(() => true, () => false), 'rechaza un archivo que no es un respaldo');
    comprobar(errores.length === 0, `sin errores en la consola${errores.length ? `: ${errores.join(' | ')}` : ''}`);

    // ---------- modo oscuro ----------
    const oscuro = await abrir(navegador, url, { oscuro: true, preparar: (pg) => pg.addInitScript((datos) => {
      if (!localStorage.getItem('platica.datos')) localStorage.setItem('platica.datos', datos);
    }, JSON.stringify(antes)) });
    await captura(oscuro.pagina, 'oscuro-inicio', true);
    await oscuro.pagina.click('[data-accion=pestana][data-p=credito]');
    await captura(oscuro.pagina, 'oscuro-credito', true);
    comprobar(oscuro.errores.length === 0, 'el modo oscuro carga sin errores');

    // ---------- resumen automático al empezar el mes ----------
    const conMesAnterior = JSON.parse(JSON.stringify(antes));
    conMesAnterior.perfil.desde = '2026-08';
    conMesAnterior.vistos.resumen = '2026-08';
    conMesAnterior.gastos.push({ id: 'sept1', fecha: '2026-09-12', monto: 300000, categoria: 'comida', nota: 'Septiembre', medio: '', deuda: null });
    const mes = await abrir(navegador, url, { preparar: (pg) => pg.addInitScript((datos) => {
      if (!sessionStorage.getItem('cargado')) {
        localStorage.setItem('platica.datos', datos);
        sessionStorage.setItem('cargado', '1');
      }
    }, JSON.stringify(conMesAnterior)) });
    comprobar((await vista(mes.pagina)) === 'resumen' && await mes.pagina.isVisible('text=Terminó septiembre'), 'al abrir en un mes nuevo muestra el resumen del anterior');
    await mes.pagina.waitForTimeout(400);
    await mes.pagina.reload();
    await mes.pagina.waitForFunction(() => window.Platica && Platica.listo);
    comprobar((await vista(mes.pagina)) === 'inicio', 'el resumen automático aparece una sola vez');

    // ---------- aviso de versión nueva ----------
    // Se simula el APK 1.0 instalado y un version.json publicado con la 1.1.
    const manifiesto = {
      version: '1.1', codigo: 2, apk: 'https://github.com/Yextep/platica/releases/download/v1.1/Platica.apk',
      notas: 'Metas de ahorro y mejores gráficas.', codigo_minimo: 0, usura: { ea: 27.9, vigencia: '2026-11' },
    };
    const conVersion = (m) => async (pg) => {
      await pg.addInitScript((datos) => {
        window.__descargas = [];
        window.__guardado = window.__guardado || datos;
        window.PlaticaAndroid = {
          version: () => '{"nombre":"1.0","codigo":1}',
          leerDatos: () => window.__guardado,
          guardarDatos: (j) => { window.__guardado = j; },
          guardarArchivo: () => {},
          compartir: () => {},
          permisoNotificaciones: () => 'concedido',
          pedirNotificaciones: () => {},
          programarRecordatorios: (j) => { window.__recordatorios = JSON.parse(j); },
          descargarActualizacion: (u) => { window.__descargas.push(u); },
        };
      }, JSON.stringify(antes));
      await pg.route(MANIFIESTO, (ruta) => ruta.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(m) }));
    };
    const nueva = await abrir(navegador, url, { preparar: conVersion(manifiesto) });
    await nueva.pagina.waitForFunction(() => Platica.versionRevisada() && Platica.vista() === 'version', null, { timeout: 10000 });
    comprobar(await nueva.pagina.isVisible('text=Platica 1.1 está disponible') && await nueva.pagina.isVisible('.notas-version:has-text("Metas de ahorro")'),
      'avisa que hay una versión nueva con sus novedades');
    comprobar((await estado(nueva.pagina)).ajustes.usura.ea === 27.9, 'toma la tasa de usura más reciente de version.json');
    comprobar((await nueva.pagina.evaluate(() => window.__recordatorios.length)) > 0, 'entrega los recordatorios a Android');
    await captura(nueva.pagina, 'actualizacion');
    await nueva.pagina.click('[data-accion=instalar-version]');
    comprobar((await nueva.pagina.evaluate(() => window.__descargas)).join() === manifiesto.apk, '«Actualizar ahora» descarga el APK de la release');
    await nueva.pagina.evaluate(() => Platica.estadoDescarga('descargando', '45'));
    comprobar(await nueva.pagina.isVisible('text=Descargando · 45%'), 'muestra el avance de la descarga');
    await nueva.pagina.evaluate(() => Platica.estadoDescarga('error', 'No se pudo descargar la actualización.'));
    comprobar(await nueva.pagina.isVisible('text=Intentar otra vez'), 'si falla la descarga deja intentar otra vez');
    await nueva.pagina.click('[data-accion=posponer-version]');
    comprobar((await vista(nueva.pagina)) === 'inicio' && await nueva.pagina.isVisible('#pestanas .con-novedad'), '«Más tarde» cierra el aviso y deja el punto en Más');
    await nueva.pagina.reload();
    await nueva.pagina.waitForFunction(() => window.Platica && Platica.listo && Platica.versionRevisada());
    await nueva.pagina.waitForTimeout(300);
    comprobar((await vista(nueva.pagina)) === 'inicio', 'después de «Más tarde» no vuelve a preguntar al abrir');
    await nueva.pagina.click('[data-accion=pestana][data-p=mas]');
    comprobar(await nueva.pagina.isVisible('.banner:has-text("Platica 1.1 está disponible")'), 'Más sigue ofreciendo la versión nueva');
    comprobar(await nueva.pagina.evaluate(() => Platica.probarManifiesto({ version: '1.2', codigo: 3, apk: 'https://example.com/Platica.apk' })) === false
      && (await nueva.pagina.evaluate(() => Platica.nuevaVersion().apk)) === manifiesto.apk, 'ignora un version.json que descarga de otro sitio');
    comprobar(nueva.errores.length === 0, 'el aviso de versión no deja errores');

    const obligatoria = await abrir(navegador, url, { preparar: conVersion({ ...manifiesto, codigo_minimo: 2 }) });
    await obligatoria.pagina.waitForFunction(() => Platica.versionRevisada() && Platica.vista() === 'version', null, { timeout: 10000 });
    comprobar(await obligatoria.pagina.isVisible('text=La versión 1.0 ya no funciona'), 'una actualización obligatoria lo dice claramente');
    comprobar((await obligatoria.pagina.evaluate(() => Platica.atras())) === false && (await vista(obligatoria.pagina)) === 'version'
      && !(await obligatoria.pagina.isVisible('#pestanas')), 'ni atrás ni las pestañas salen del aviso obligatorio');
    comprobar(await obligatoria.pagina.isVisible('[data-accion=guardar-respaldo]') && !(await obligatoria.pagina.isVisible('[data-accion=posponer-version]')),
      'el aviso obligatorio deja guardar un respaldo pero no posponer');
    await captura(obligatoria.pagina, 'obligatoria');
    const misma = await abrir(navegador, url, { preparar: conVersion({ ...manifiesto, version: '1.0', codigo: 1 }) });
    await misma.pagina.waitForFunction(() => Platica.versionRevisada());
    comprobar((await vista(misma.pagina)) === 'inicio' && !(await misma.pagina.isVisible('#pestanas .con-novedad')), 'con la versión al día no muestra aviso');
    console.log(`\n${pruebas} comprobaciones superadas.`);
  } finally {
    await navegador.close();
    srv.close();
    fs.rmSync(temporal, { recursive: true, force: true });
  }
}

principal().catch((e) => {
  console.error(e);
  process.exit(1);
});
