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

// El teclado de Android encoge la pantalla: mismo ancho, menos alto.
async function abrirTeclado(p) {
  await p.setViewportSize({ width: 412, height: 480 });
  await p.waitForTimeout(450);
}
async function cerrarTeclado(p) {
  await p.setViewportSize({ width: 412, height: 860 });
  await p.waitForTimeout(450);
}
const foco = (p) => p.evaluate(() => document.activeElement.id);

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

async function registrarGastoFijo(p) {
  await p.click('#agregar');
  await esperarVista(p, 'gasto');
  await p.fill('#g-monto', '55000');
  await p.click('[data-cat="servicios"]');
  await p.fill('#g-fecha', '2026-10-05');
  await p.click('[data-medio="nequi"]');
  await p.fill('#g-nota', 'Plan Claro');
  await p.click('label.interruptor:has(#g-repetir)');
  await p.click('#form-gasto button[type=submit]');
  await p.waitForFunction(() => Platica.vista() !== 'gasto');
}
async function nuevoFijo(p, f) {
  await p.click('[data-accion=nuevo-fijo]');
  await esperarVista(p, 'fijoForm');
  await p.fill('#f-monto', f.monto);
  if (f.sugerencia) await p.click(`[data-sug="${f.sugerencia}"]`);
  if (f.nombre) await p.fill('#f-nombre', f.nombre);
  await p.fill('#f-dia', f.dia);
  await p.click(`[data-auto="${f.automatico ? 1 : 0}"]`);
  if (f.yaPagado === false && await p.isVisible('#f-ya-campo')) await p.click('label.interruptor:has(#f-ya)');
  await p.click('#form-fijo button[type=submit]');
  await esperarVista(p, 'fijo');
}
async function abrirFormDeuda(p) {
  await p.evaluate(() => document.querySelector('[data-accion="nueva-deuda"]').click());
  await esperarVista(p, 'deudaForm');
}
// Tarjetas y rotativos piden cupo y saldo; los créditos de cuota fija, lo que se sepa (Platica calcula el resto).
async function agregarDeuda(p, d) {
  await abrirFormDeuda(p);
  await p.selectOption('#d-tipo', d.tipo);
  await p.fill('#d-nombre', d.nombre);
  if (d.entidad) await p.fill('#d-entidad', d.entidad);
  if (d.tipo === 'tarjeta' || d.tipo === 'rotativo') {
    await p.fill('#d-cupo', String(d.inicial));
    await p.fill('#d-saldo-rot', String(d.saldo));
    if (d.cuota) await p.fill('#d-minimo', String(d.cuota));
    if (d.dia) await p.fill('#d-dia', String(d.dia));
    if (d.apertura) await p.fill('#d-apertura', d.apertura);
  } else {
    if (d.inicial) await p.fill('#d-monto', String(d.inicial));
    if (d.cuota) await p.fill('#d-cuota', String(d.cuota));
    if (d.plazo) await p.fill('#d-plazo', String(d.plazo));
    if (d.inicio) await p.fill('#d-inicio', d.inicio);
    if (d.saldo) await p.fill('#d-saldo', String(d.saldo));
  }
  if (d.tasa) {
    await p.fill('#d-tasa', d.tasa);
    await p.click(`[data-tasa="${d.tipoTasa || 'EA'}"]`);
  }
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
    // Antes, al abrirse el teclado la pantalla se redibujaba, el campo perdía el foco y el teclado se cerraba.
    await p.tap('#b-nombre');
    await p.keyboard.type('Dan');
    await abrirTeclado(p);
    comprobar((await foco(p)) === 'b-nombre', 'al abrirse el teclado el campo del nombre conserva el foco');
    await p.keyboard.type('iel');
    comprobar((await p.inputValue('#b-nombre')) === 'Daniel', 'se puede seguir escribiendo con el teclado abierto');
    comprobar(await p.evaluate(() => document.body.classList.contains('teclado')), 'detecta el teclado abierto');
    await captura(p, 'bienvenida-teclado');
    comprobar(await p.isHidden('#b-campo-salario') && await p.isVisible('#b-promedio'), 'sin marcar «salario fijo» no pide un salario');
    await p.click('label.interruptor:has(#b-fijo)');
    await p.click('#form-bienvenida button[type=submit]');
    comprobar(await p.isVisible('#b-error:has-text("Escribe cuánto ganas al mes")'), 'con salario fijo pide el valor');
    await p.tap('#b-salario');
    await p.keyboard.type('2000000');
    comprobar((await foco(p)) === 'b-salario' && (await p.inputValue('#b-salario')) === '$2.000.000', 'el salario se escribe con puntos de miles');
    // Corregir en medio del número: el cursor no salta al final.
    await p.evaluate(() => document.querySelector('#b-salario').setSelectionRange(4, 4));
    await p.keyboard.type('5');
    const cursor = () => p.evaluate(() => document.querySelector('#b-salario').selectionStart);
    comprobar((await p.inputValue('#b-salario')) === '$20.500.000' && (await cursor()) === 5, 'al escribir en medio del número el cursor sigue en su lugar');
    await p.keyboard.press('Backspace');
    // Se borró el 5 que estaba después de «20»: el cursor queda después de esos dos dígitos, en «$2.0|00.000».
    comprobar((await p.inputValue('#b-salario')) === '$2.000.000' && (await cursor()) === 4, 'borrar en medio del número también respeta el cursor');
    await cerrarTeclado(p);
    // Atrás de Android mientras se escribe vuelve al primer paso, y lo escrito se conserva.
    await p.focus('#b-nombre');
    await p.evaluate(() => Platica.atras());
    comprobar(await p.isVisible('[data-accion=bienvenida-siguiente]'), 'atrás vuelve al primer paso aunque se esté escribiendo');
    await p.click('[data-accion=bienvenida-siguiente]');
    comprobar((await p.inputValue('#b-nombre')) === 'Daniel' && (await p.inputValue('#b-salario')) === '$2.000.000' && await p.isChecked('#b-fijo'),
      'al volver al segundo paso se conserva lo escrito');
    await p.click('#form-bienvenida button[type=submit]');
    await esperarVista(p, 'inicio');
    let e = await estado(p);
    comprobar(e.perfil.configurado && e.perfil.desde === '2026-10' && e.perfil.nombre === 'Daniel'
      && JSON.stringify(e.perfil.periodos) === JSON.stringify([{ desde: '2026-10', tipo: 'fijo', monto: 2000000 }]), 'guarda el salario fijo desde este mes');
    comprobar(!(await p.isVisible('text=¿Cuánto has recibido')) && await p.isVisible('.cifra:has-text("salario fijo"):has-text("$2.000.000")'),
      'con salario fijo no pregunta cada mes: lo cuenta solo');
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

    // El formulario de gasto también se llena con el teclado abierto; luego se deshace el gasto recién guardado.
    await p.click('#agregar');
    await esperarVista(p, 'gasto');
    await p.tap('#g-monto');
    await abrirTeclado(p);
    await p.keyboard.type('7500');
    comprobar((await foco(p)) === 'g-monto' && (await p.inputValue('#g-monto')) === '$7.500', 'el valor del gasto se escribe con el teclado abierto');
    await p.click('[data-cat=imprevistos]');
    await cerrarTeclado(p);
    await p.click('#form-gasto button[type=submit]');
    await esperarVista(p, 'inicio');
    comprobar((await estado(p)).gastos.length === 14, 'guarda el gasto escrito con el teclado');
    await p.click('#aviso .toast button');
    comprobar((await estado(p)).gastos.length === 13, '«Deshacer» quita el gasto recién guardado');

    // ---------- ingresos ----------
    await p.click('[data-accion=ver-ingresos]');
    await esperarVista(p, 'ingresos');
    comprobar(await p.isVisible('.fila:has-text("Salario fijo"):has-text("+$2.000.000")'), 'el salario fijo aparece solo en los ingresos del mes');
    await p.click('[data-accion=nuevo-ingreso]');
    await esperarVista(p, 'ingreso');
    comprobar(await p.isVisible('[data-clase=ingreso][aria-pressed=true]'), 'con salario fijo, un ingreso nuevo es un extra');
    await p.fill('#i-monto', '150000');
    await p.click('[data-concepto="Honorarios"]');
    await p.click('#form-ingreso button[type=submit]');
    await esperarVista(p, 'ingresos');
    comprobar(await p.isVisible('text=+$150.000') && await p.isVisible('text=$2.150.000 en total'), 'los ingresos extra se suman al salario');
    // Un mes con otro salario (por ejemplo, una incapacidad) se ajusta sin cambiar el salario fijo.
    await p.click('[data-accion=ajustar-salario]');
    await esperarVista(p, 'ingreso');
    comprobar((await p.inputValue('#i-monto')) === '$2.000.000' && await p.isVisible('[data-clase=salario][aria-pressed=true]'), 'ajustar el salario propone el valor fijo');
    await p.fill('#i-monto', '1700000');
    await p.click('#form-ingreso button[type=submit]');
    await esperarVista(p, 'ingresos');
    comprobar(await p.isVisible('text=$1.850.000 en total') && await p.isVisible('.fila:has-text("Salario de este mes")'), 'el salario ajustado reemplaza al fijo solo ese mes');
    await captura(p, 'ingresos', true);
    await p.click('.fila:has-text("Salario de este mes")');
    await esperarVista(p, 'ingreso');
    await p.click('[data-accion=eliminar-ingreso]');
    await p.click('#dialogo [data-r=si]');
    await esperarVista(p, 'ingresos');
    comprobar(await p.isVisible('text=$2.150.000 en total'), 'al quitar el ajuste vuelve a contar el salario fijo');
    e = await estado(p);
    comprobar(e.ingresos.length === 1 && e.ingresos[0].tipo === 'ingreso' && e.ingresos[0].monto === 150000, 'solo se guardan los extras: el salario se cuenta solo');
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
    // Desplazarse oculta el tooltip a propósito: se espera a que termine el desplazamiento antes de pasar el puntero.
    await p.waitForTimeout(300);
    const zona = await p.locator('.grafica .zona').first().boundingBox();
    await p.mouse.move(zona.x + zona.width * 0.3, zona.y + 40);
    comprobar(await p.waitForSelector('#tooltip:has-text("gastado hasta ese día")', { state: 'visible', timeout: 3000 }).then(() => true, () => false),
      'el tooltip de la línea muestra el acumulado');
    await p.mouse.move(5, 5);
    await cerrarAvisos(p);
    await captura(p, 'inicio', true);

    // ---------- movimientos ----------
    await p.click('[data-accion=pestana][data-p=movimientos]');
    comprobar((await p.locator('#lista-mov .fila').count()) === 13, 'lista los 13 gastos del mes');
    await p.fill('#buscar', 'tinto');
    comprobar((await p.locator('#lista-mov .fila').count()) === 9, 'busca por nota');
    await p.fill('#buscar', '12.000');
    comprobar((await p.locator('#lista-mov .fila').count()) === 9, 'busca por valor escrito con puntos');
    // El buscador con el teclado abierto, y girar el teléfono mientras se escribe.
    await p.fill('#buscar', '');
    await p.tap('#buscar');
    await abrirTeclado(p);
    await p.keyboard.type('tin');
    comprobar((await foco(p)) === 'buscar' && (await p.locator('#lista-mov .fila').count()) === 9, 'el buscador funciona con el teclado abierto');
    comprobar(await p.isHidden('#pestanas') && await p.isHidden('#agregar'), 'con el teclado abierto se esconden las pestañas y el botón +');
    await p.setViewportSize({ width: 600, height: 400 });
    await p.waitForTimeout(450);
    comprobar((await foco(p)) === 'buscar', 'girar el teléfono mientras se escribe no quita el foco');
    await p.evaluate(() => document.activeElement.blur());
    await cerrarTeclado(p);
    comprobar(await p.isVisible('#pestanas') && (await p.inputValue('#buscar')) === 'tin', 'al cerrar el teclado vuelven las pestañas');
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
    await agregarDeuda(p, { tipo: 'sector_real', nombre: 'Crédito almacén', inicial: 8959000, saldo: 4453000, cuota: 350000,
      tasa: '1,9', tipoTasa: 'MV', inicio: '2025-09-10', plazo: 36 });
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
    comprobar((await p.inputValue('#k-ingresos')) === '$2.000.000' && (await p.inputValue('#k-financieros')) === '$410.000',
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

    // ---------- ingresos variables ----------
    const vari = await abrir(navegador, url);
    const pv = vari.pagina;
    await pv.click('[data-accion=bienvenida-siguiente]');
    await pv.fill('#b-nombre', 'Laura');
    await pv.fill('#b-promedio', '1800000');
    await pv.click('#form-bienvenida button[type=submit]');
    await esperarVista(pv, 'inicio');
    let ev = await estado(pv);
    comprobar(JSON.stringify(ev.perfil.periodos) === JSON.stringify([{ desde: '2026-10', tipo: 'variable', monto: 0 }]) && ev.perfil.ingresoAproximado === 1800000,
      'sin salario fijo guarda ingresos variables');
    comprobar(await pv.isVisible('text=¿Cuánto has recibido en octubre?') && await pv.isVisible('.cifra:has-text("sin registrar")'),
      'con ingresos variables pide anotar lo recibido en el mes');
    comprobar((await pv.evaluate(() => Platica.recordatorios().map((r) => r.id))).includes('ingresos-2026-10-20'), 'recuerda anotar los ingresos del mes');
    await captura(pv, 'variable');
    await pv.click('.banner [data-accion=nuevo-ingreso]');
    await esperarVista(pv, 'ingreso');
    comprobar(!(await pv.isVisible('[data-clase]')), 'con ingresos variables no hay salario que ajustar');
    await pv.fill('#i-monto', '900000');
    await pv.click('[data-concepto="Quincena"]');
    await pv.click('#form-ingreso button[type=submit]');
    await esperarVista(pv, 'inicio');
    comprobar(!(await pv.isVisible('text=¿Cuánto has recibido en octubre?')) && await pv.isVisible('.cifra:has-text("1 registro"):has-text("$900.000")'),
      'al anotar un ingreso desaparece el aviso');
    comprobar(!(await pv.evaluate(() => Platica.recordatorios().map((r) => r.id))).includes('ingresos-2026-10-20'), 'ya no recuerda anotar los ingresos de este mes');
    // Pasar a salario fijo a mitad de mes: lo ya anotado no se cuenta dos veces.
    await pv.click('[data-accion=pestana][data-p=mas]');
    await pv.click('[data-accion=ver-perfil]');
    await esperarVista(pv, 'perfil');
    await pv.click('label.interruptor:has(#pf-fijo)');
    await pv.fill('#pf-salario', '2500000');
    await pv.click('#form-perfil button[type=submit]');
    comprobar(await pv.isVisible('#dialogo:has-text("¿Eran parte de tu salario?")'), 'al pasar a salario fijo pregunta por lo ya anotado');
    await pv.click('#dialogo [data-r=si]');
    await esperarVista(pv, 'mas');
    ev = await estado(pv);
    comprobar(ev.ingresos.length === 0 && JSON.stringify(ev.perfil.periodos) === JSON.stringify([{ desde: '2026-10', tipo: 'fijo', monto: 2500000 }]),
      'pasa a salario fijo sin contar el salario dos veces');
    await pv.click('[data-accion=pestana][data-p=inicio]');
    comprobar(await pv.isVisible('.cifra:has-text("salario fijo"):has-text("$2.500.000")'), 'el inicio cuenta el salario fijo nuevo');
    // Y de vuelta a variables: ofrece anotar el salario de este mes.
    await pv.click('[data-accion=pestana][data-p=mas]');
    await pv.click('[data-accion=ver-perfil]');
    await esperarVista(pv, 'perfil');
    await pv.click('label.interruptor:has(#pf-fijo)');
    await pv.click('#form-perfil button[type=submit]');
    comprobar(await pv.isVisible('#dialogo:has-text("¿Ya recibiste el salario de octubre?")'), 'al pasar a ingresos variables pregunta por el salario del mes');
    await pv.click('#dialogo [data-r=si]');
    await esperarVista(pv, 'mas');
    ev = await estado(pv);
    comprobar(ev.ingresos.length === 1 && ev.ingresos[0].monto === 2500000 && JSON.stringify(ev.perfil.periodos) === JSON.stringify([{ desde: '2026-10', tipo: 'variable', monto: 0 }]),
      'anota el salario del mes al pasar a ingresos variables');
    comprobar(vari.errores.length === 0, 'los ingresos variables no dejan errores');

    // ---------- crédito de cuota fija sin saber la tasa (el crédito móvil del usuario) ----------
    const cred = await abrir(navegador, url);
    const pc = cred.pagina;
    await pc.click('[data-accion=bienvenida-siguiente]');
    await pc.click('label.interruptor:has(#b-fijo)');
    await pc.fill('#b-salario', '2500000');
    await pc.click('#form-bienvenida button[type=submit]');
    await esperarVista(pc, 'inicio');
    await pc.click('[data-accion=pestana][data-p=deudas]');
    await abrirFormDeuda(pc);
    await pc.fill('#d-nombre', 'Crédito móvil');
    await pc.fill('#d-monto', '2000000');
    await pc.fill('#d-cuota', '220000');
    comprobar(await pc.isVisible('#d-calculo:has-text("Escribe al menos tres")'), 'con dos datos pide un tercero');
    await pc.fill('#d-plazo', '12');
    await pc.fill('#d-inicio', '2026-10-08');
    comprobar((await pc.inputValue('#d-primera')) === '2026-11-08', 'propone la primera cuota un mes después de recibir el crédito');
    const calculo = await pc.textContent('#d-calculo');
    comprobar(calculo.includes('4,55% M.V. · 70,6% E.A.') && calculo.includes('$2.640.000') && calculo.includes('$640.000') && calculo.includes('0 de 12')
      && calculo.includes('$2.000.000') && calculo.includes('8 de octubre de 2027'), 'con monto, cuota y plazo calcula la tasa, el total, los intereses, el saldo y la última cuota');
    comprobar(await pc.isVisible('#d-calculo .banner.critico:has-text("Este crédito cuesta 70,6% E.A.")'), 'avisa que el costo pasa la tasa de usura');
    comprobar((await pc.getAttribute('#d-saldo', 'placeholder')) === '$2.000.000 (calculado)', 'el saldo vacío muestra el que calculó');
    await captura(pc, 'deuda-calculo', true);
    await pc.click('#form-deuda button[type=submit]');
    await esperarVista(pc, 'deuda');
    const movil = (await estado(pc)).deudas[0];
    comprobar(movil.inicial === 2000000 && movil.cuota === 220000 && movil.plazo === 12 && movil.saldo === 2000000 && movil.tasa.tipo === 'MV'
      && Math.abs(movil.tasa.valor - 4.5532) < 0.001 && movil.diaPago === 8 && movil.primera === '2026-11-08' && movil.inicio === '2026-10-08'
      && movil.apertura === '2026-10' && movil.estimados.includes('tasa') && movil.estimados.includes('saldo'), 'guarda la deuda con lo calculado marcado como tal');
    comprobar(await pc.isVisible('td:has-text("1 de 12")') && await pc.isVisible('td:has-text("$2.640.000")') && await pc.isVisible('text=Cuesta más que la tasa de usura')
      && await pc.isVisible('.cifra:has-text("calculada")'), 'el detalle muestra en qué cuota va, el total y que la tasa es calculada');
    await captura(pc, 'deuda-movil', true);
    await pc.click('[data-accion=pagar-deuda]');
    await esperarVista(pc, 'gasto');
    comprobar((await pc.inputValue('#g-monto')) === '$220.000' && (await pc.inputValue('#g-saldo')) === '$1.871.064', 'el pago de la cuota baja el capital según la tasa calculada');
    await pc.click('#form-gasto button[type=submit]');
    await esperarVista(pc, 'deuda');
    await pc.click('[data-accion=atras]');
    // Un plan pospago no es una deuda: el formulario lo dice.
    await abrirFormDeuda(pc);
    await pc.selectOption('#d-tipo', 'telecom');
    comprobar(await pc.isVisible('#d-nota-telecom:has-text("pago fijo")'), 'si es un plan del celular, sugiere registrarlo como pago fijo');
    await pc.click('[data-accion=atras]');
    comprobar(await pc.isVisible('.banner:has-text("¿Suscripciones, plan del celular o gimnasio?")'), 'la pestaña de deudas explica dónde van las suscripciones');

    // ---------- pagos fijos ----------
    await pc.click('[data-accion=pestana][data-p=inicio]');
    // Desde un gasto: «Es un pago fijo cada mes».
    await registrarGastoFijo(pc);
    let ec = await estado(pc);
    const plan = ec.fijos.find((f) => f.nombre === 'Plan Claro');
    comprobar(plan && plan.dia === 5 && plan.monto === 55000 && !plan.automatico && plan.desde === '2026-10' && ec.gastos.some((g) => g.fijo === plan.id && g.fecha === '2026-10-05'),
      'un gasto se puede volver pago fijo y queda como el pago de ese mes');
    // Desde la lista: uno que se cobra solo y aún no llega, y uno que se paga a mano y ya venció.
    await pc.click('[data-accion=ver-fijos]');
    comprobar((await vista(pc)) === 'movimientos' && await pc.isVisible('.fila:has-text("Plan Claro")'), 'los pagos fijos están en Movimientos → Fijos');
    await nuevoFijo(pc, { monto: '26900', sugerencia: 'Streaming', dia: '25', automatico: true });
    await pc.click('[data-accion=atras]');
    await nuevoFijo(pc, { monto: '90000', nombre: 'Gimnasio', dia: '1', automatico: false, yaPagado: false });
    await pc.click('[data-accion=atras]');
    ec = await estado(pc);
    const streaming = ec.fijos.find((f) => f.nombre === 'Streaming');
    const gimnasio = ec.fijos.find((f) => f.nombre === 'Gimnasio');
    comprobar(streaming.automatico && streaming.categoria === 'personales' && !gimnasio.automatico && !ec.gastos.some((g) => g.fijo === gimnasio.id),
      'crea pagos fijos que se cobran solos o que se pagan a mano');
    await captura(pc, 'fijos', true);
    await pc.click('[data-accion=pestana][data-p=inicio]');
    const tarjetaPagos = await pc.textContent('#pagos-mes');
    comprobar(tarjetaPagos.includes('Gimnasio') && tarjetaPagos.includes('Vencido') && tarjetaPagos.includes('Plan Claro') && tarjetaPagos.includes('Pagado')
      && tarjetaPagos.includes('Streaming') && tarjetaPagos.includes('Pendiente'), 'Inicio junta los pagos del mes con su estado');
    comprobar(await pc.isVisible('#por-pagar:has-text("Faltan $116.900")'), 'Inicio dice cuánto falta por pagar este mes');
    comprobar(await pc.isVisible('.reco:has-text("Gimnasio venció sin registrarse")'), 'avisa del pago fijo vencido');
    await captura(pc, 'inicio-pagos', true);
    await pc.click('#pagos-mes .fila:has-text("Gimnasio")');
    await esperarVista(pc, 'gasto');
    comprobar((await pc.inputValue('#g-monto')) === '$90.000' && (await pc.inputValue('#g-nota')) === 'Gimnasio' && await pc.isVisible('#g-fijo .banner:has-text("Gimnasio")'),
      'pagar un pago fijo abre el gasto ya lleno');
    await pc.click('#form-gasto button[type=submit]');
    await esperarVista(pc, 'inicio');
    comprobar(await pc.isVisible('#pagos-mes .fila:has-text("Gimnasio"):has-text("Pagado")'), 'al pagarlo queda como pagado');
    // El 26 de octubre se registra solo el que se cobra solo.
    await pc.clock.setFixedTime(new Date('2026-10-26T12:00:00-05:00'));
    await pc.reload();
    await pc.waitForFunction(() => window.Platica && Platica.listo);
    ec = await estado(pc);
    const cobro = ec.gastos.find((g) => g.fijo === streaming.id);
    comprobar(cobro && cobro.fecha === '2026-10-25' && cobro.monto === 26900 && await pc.isVisible('text=Se registró Streaming ($26.900), que se cobra solo.'),
      'el pago que se cobra solo se registra el día del cobro');
    // Si se borra (no se cobró), ese mes no se vuelve a registrar.
    await pc.click('[data-accion=pestana][data-p=movimientos]');
    await pc.click('[data-accion=modo-mov][data-m=gastos]');
    await pc.click(`#lista-mov [data-id="${cobro.id}"]`);
    await pc.click('[data-accion=eliminar-gasto]');
    await pc.click('#dialogo [data-r=si]');
    await pc.reload();
    await pc.waitForFunction(() => window.Platica && Platica.listo);
    ec = await estado(pc);
    comprobar(!ec.gastos.some((g) => g.fijo === streaming.id) && ec.fijos.find((f) => f.id === streaming.id).omitidos.includes('2026-10'),
      'si se borra un cobro automático, ese mes no se vuelve a registrar');
    // Cancelar: los pagos de antes se quedan.
    await pc.click('[data-accion=pestana][data-p=movimientos]');
    await pc.click('[data-accion=modo-mov][data-m=fijos]');
    await pc.click('.fila:has-text("Gimnasio")');
    await esperarVista(pc, 'fijo');
    await pc.click('[data-accion=cancelar-fijo]');
    comprobar(await pc.isVisible('#dialogo:has-text("Ya no lo pago desde noviembre (octubre ya está pagado)")'), 'cancelar pregunta desde cuándo y respeta lo ya pagado');
    await pc.click('#dialogo [data-r=este]');
    ec = await estado(pc);
    comprobar(ec.fijos.find((f) => f.id === gimnasio.id).fin === '2026-10' && ec.gastos.some((g) => g.fijo === gimnasio.id) && await pc.isVisible('[data-accion=reactivar-fijo]'),
      'cancelar un pago fijo deja de contarlo desde el mes siguiente y conserva lo pagado');
    await pc.click('[data-accion=atras]');

    // ---------- pago de tarjeta cuyas compras ya están en los gastos ----------
    await pc.click('[data-accion=pestana][data-p=deudas]');
    await agregarDeuda(pc, { tipo: 'tarjeta', nombre: 'Visa', inicial: 1000000, saldo: 500000, cuota: 50000, dia: 28 });
    await pc.click('[data-accion=atras]');
    await pc.click('[data-accion=pestana][data-p=inicio]');
    await registrarGasto(pc, { monto: 100000, categoria: 'personales', nota: 'Zapatos', medio: 'credito' });
    const antesPagoTarjeta = (await pc.evaluate(() => Platica.estado())).gastos.length;
    await pc.click('[data-accion=pestana][data-p=deudas]');
    await pc.click('.deuda:has-text("Visa")');
    await pc.click('[data-accion=pagar-deuda]');
    await esperarVista(pc, 'gasto');
    await pc.fill('#g-monto', '200000');
    comprobar(await pc.isVisible('#g-tarjeta:has-text("Este mes registraste $100.000 en compras con tarjeta")'), 'al pagar la tarjeta recuerda cuánto se registró en compras con ella');
    await pc.click('label.interruptor:has(#g-sin-gasto)');
    await pc.click('#form-gasto button[type=submit]');
    await esperarVista(pc, 'deuda');
    ec = await estado(pc);
    const pagoVisa = ec.gastos[ec.gastos.length - 1];
    comprobar(ec.gastos.length === antesPagoTarjeta + 1 && pagoVisa.deuda.sinGasto === true && ec.deudas.find((d) => d.nombre === 'Visa').saldo < 500000,
      'el pago de la tarjeta baja la deuda y queda marcado para no contarse dos veces');
    await pc.click('[data-accion=atras]');

    // ---------- resumen del mes con todo junto ----------
    await pc.click('[data-accion=pestana][data-p=inicio]');
    await pc.click('[data-accion=ver-resumen]');
    await esperarVista(pc, 'resumen');
    const flujo = await pc.textContent('.flujo');
    // 55.000 + 90.000 de pagos fijos; 220.000 de la cuota del crédito móvil; 100.000 de compras; el pago de la tarjeta no suma.
    comprobar(flujo.includes('Ingresos+$2.500.000') && flujo.includes('Gastos del día a día−$100.000') && flujo.includes('Pagos fijos−$145.000')
      && flujo.includes('Cuotas y abonos a deudas−$220.000') && flujo.includes('$2.035.000'), `el resumen junta gastos, pagos fijos y deudas: ${flujo}`);
    comprobar(await pc.isVisible('text=Además pagaste $200.000 a tus tarjetas por compras que ya estaban en tus gastos'), 'el pago de la tarjeta se explica pero no se cuenta otra vez');
    const deudasMes = await pc.textContent('section:has(h2:has-text("Tus deudas en octubre"))');
    comprobar(deudasMes.includes('$420.000') && deudasMes.includes('Deuda total al empezar el mes') && deudasMes.includes('Crédito móvil'),
      'el resumen trae lo pagado a las deudas, la deuda total y las cuotas');
    comprobar(await pc.isVisible('section:has(h2:has-text("Pagos fijos")) .fila:has-text("Gimnasio")'), 'el resumen trae los pagos fijos del mes');
    await captura(pc, 'resumen-completo', true);
    comprobar(cred.errores.length === 0, `el crédito y los pagos fijos no dejan errores${cred.errores.length ? `: ${cred.errores.join(' | ')}` : ''}`);

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
