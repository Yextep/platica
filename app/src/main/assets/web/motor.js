// Cálculos de Platica: dinero, fechas, resúmenes del mes, deudas, vida crediticia y simuladores.
// No toca la página: la interfaz lo usa como window.Motor y las pruebas lo cargan con Node.
(function (raiz, fabrica) {
  const motor = fabrica();
  if (typeof module === 'object' && module.exports) module.exports = motor;
  else raiz.Motor = motor;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ---------- catálogos ----------
  // color: posición en la paleta de categorías (1 a 8); 0 es el gris de «otras».
  const CATEGORIAS_BASE = [
    { id: 'servicios', nombre: 'Servicios', icono: 'bombillo', color: 1, tipo: 'necesidad' },
    { id: 'imprevistos', nombre: 'Imprevistos', icono: 'alerta', color: 2, tipo: 'necesidad' },
    { id: 'personales', nombre: 'Gastos personales', icono: 'bolsa', color: 3, tipo: 'deseo' },
    { id: 'deudas', nombre: 'Deudas', icono: 'tarjeta', color: 4, tipo: 'necesidad' },
    { id: 'arriendo', nombre: 'Arriendo', icono: 'casa', color: 5, tipo: 'necesidad' },
    { id: 'salud', nombre: 'Salud', icono: 'salud', color: 6, tipo: 'necesidad' },
    { id: 'comida', nombre: 'Comida', icono: 'comida', color: 7, tipo: 'necesidad' },
  ];
  // Sugerencias al crear una categoría propia.
  const SUGERENCIAS = [
    { nombre: 'Transporte', icono: 'bus', tipo: 'necesidad' },
    { nombre: 'Educación', icono: 'libro', tipo: 'necesidad' },
    { nombre: 'Hogar', icono: 'herramienta', tipo: 'necesidad' },
    { nombre: 'Mascotas', icono: 'huella', tipo: 'necesidad' },
    { nombre: 'Entretenimiento', icono: 'ticket', tipo: 'deseo' },
    { nombre: 'Ropa', icono: 'camisa', tipo: 'deseo' },
    { nombre: 'Regalos', icono: 'regalo', tipo: 'deseo' },
    { nombre: 'Suscripciones', icono: 'pantalla', tipo: 'deseo' },
  ];
  const ICONOS_CATEGORIA = ['etiqueta', 'bus', 'libro', 'herramienta', 'huella', 'ticket', 'camisa', 'regalo', 'pantalla',
    'bolsa', 'bombillo', 'casa', 'salud', 'comida', 'alerta', 'tarjeta', 'celular', 'avion', 'bebe', 'deporte'];
  const MEDIOS = {
    efectivo: 'Efectivo', debito: 'Tarjeta débito', credito: 'Tarjeta de crédito',
    nequi: 'Nequi', daviplata: 'Daviplata', transferencia: 'Transferencia',
  };
  const TIPOS_DEUDA = {
    tarjeta: { nombre: 'Tarjeta de crédito', grupo: 'rotativo' },
    rotativo: { nombre: 'Crédito rotativo', grupo: 'rotativo' },
    libre_inversion: { nombre: 'Libre inversión', grupo: 'plazo_fijo' },
    libranza: { nombre: 'Libranza', grupo: 'plazo_fijo' },
    vehiculo: { nombre: 'Crédito de vehículo', grupo: 'plazo_fijo' },
    educativo: { nombre: 'Crédito educativo', grupo: 'plazo_fijo' },
    hipotecario: { nombre: 'Hipotecario o leasing habitacional', grupo: 'hipotecario' },
    sector_real: { nombre: 'Almacén, cooperativa o crédito de consumo', grupo: 'otros' },
    telecom: { nombre: 'Celular o internet a plazos', grupo: 'otros' },
    personal: { nombre: 'Préstamo de un familiar o conocido', grupo: 'otros' },
    otro: { nombre: 'Otro', grupo: 'otros' },
  };
  const GRUPOS_DEUDA = {
    plazo_fijo: 'Créditos de plazo fijo', hipotecario: 'Hipotecarios',
    rotativo: 'Tarjetas y rotativos', otros: 'Otros',
  };
  const NIVELES = ['excelente', 'bueno', 'regular', 'malo'];
  const FACTORES = {
    habitos: { nombre: 'Hábitos de pago', descripcion: 'Qué tan puntual pagas tus deudas. Es el factor que más pesa.' },
    endeudamiento: { nombre: 'Endeudamiento', descripcion: 'Cuánto debes frente a los cupos y montos que te aprobaron.' },
    experiencia: { nombre: 'Experiencia crediticia', descripcion: 'Cuánto tiempo llevas con productos financieros y qué tan seguido abres nuevos.' },
    portafolio: { nombre: 'Estado del portafolio', descripcion: 'Qué tipos de crédito tienes y el riesgo que las entidades ven en tu perfil.' },
  };
  // Franjas del puntaje de Midatacrédito (Datacrédito Experian), de 0 a 1.000.
  const BANDAS = [
    { min: 0, max: 365, nombre: 'Muy bajo' },
    { min: 366, max: 470, nombre: 'Bajo' },
    { min: 471, max: 670, nombre: 'Medio' },
    { min: 671, max: 815, nombre: 'Bueno' },
    { min: 816, max: 1000, nombre: 'Excelente' },
  ];
  // Tasa de usura de crédito de consumo y ordinario (Superfinanciera). La app la actualiza desde version.json.
  const USURA = { ea: 28.59, vigencia: '2026-10' };
  const PAGO_GRANDE_HORMIGA = 20000;
  // Se pagan una vez al mes: la proyección no los multiplica por el ritmo diario.
  const CATEGORIAS_FIJAS = new Set(['arriendo', 'servicios', 'deudas']);

  // ---------- dinero ----------
  const separador = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 });
  function pesos(valor) {
    const n = Math.round(Number(valor) || 0);
    return (n < 0 ? '-$' : '$') + separador.format(Math.abs(n));
  }
  function compacto(valor) {
    const n = Math.round(Number(valor) || 0);
    const signo = n < 0 ? '-' : '';
    const a = Math.abs(n);
    if (a >= 1e6) return `${signo}$${decimal(a / 1e6, a >= 1e7 ? 0 : 1)} M`;
    if (a >= 1e3) return `${signo}$${Math.round(a / 1e3)} mil`;
    return `${signo}$${a}`;
  }
  function decimal(valor, cifras = 1) {
    const n = Number(valor) || 0;
    return n.toFixed(cifras).replace(/\.0+$/, '').replace('.', ',');
  }
  function porcentaje(fraccion, cifras = 0) {
    if (fraccion == null || !isFinite(fraccion)) return '—';
    return `${decimal(fraccion * 100, cifras)}%`;
  }
  // «25.000», «$ 25000» o «25000» dan 25000. Los pesos no llevan centavos.
  function leerMonto(texto) {
    const digitos = String(texto == null ? '' : texto).replace(/[^\d]/g, '').slice(0, 13);
    return digitos ? parseInt(digitos, 10) : 0;
  }
  function leerDecimal(texto) {
    const limpio = String(texto == null ? '' : texto).trim().replace(/\s/g, '').replace(',', '.').replace(/[^\d.]/g, '');
    const n = parseFloat(limpio);
    return isFinite(n) ? n : 0;
  }
  function suma(lista, campo) {
    let total = 0;
    for (const x of lista) total += campo ? (Number(x[campo]) || 0) : (Number(x) || 0);
    return total;
  }

  // ---------- fechas (hora del teléfono, que en Colombia es la de Bogotá) ----------
  const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  const dos = (n) => String(n).padStart(2, '0');
  const fechaISO = (y, m, d) => `${y}-${dos(m)}-${dos(d)}`;
  const esFecha = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !isNaN(Date.parse(v + 'T00:00:00Z'));
  const esMes = (v) => typeof v === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(v);
  function hoy(ahora = new Date()) {
    return fechaISO(ahora.getFullYear(), ahora.getMonth() + 1, ahora.getDate());
  }
  function mesActual(ahora = new Date()) {
    return hoy(ahora).slice(0, 7);
  }
  function partes(fecha) {
    const [y, m, d] = fecha.split('-').map(Number);
    return { y, m, d: d || 1 };
  }
  function sumarMeses(mes, n) {
    let [y, m] = mes.split('-').map(Number);
    m += n;
    y += Math.floor((m - 1) / 12);
    m = ((m - 1) % 12 + 12) % 12 + 1;
    return `${y}-${dos(m)}`;
  }
  function diasDelMes(mes) {
    const [y, m] = mes.split('-').map(Number);
    return new Date(y, m, 0).getDate();
  }
  function mesesEntre(a, b) {
    const [y1, m1] = a.split('-').map(Number);
    const [y2, m2] = b.split('-').map(Number);
    return (y2 - y1) * 12 + (m2 - m1);
  }
  function sumarDias(fecha, n) {
    const { y, m, d } = partes(fecha);
    return hoy(new Date(y, m - 1, d + n));
  }
  function diasEntre(a, b) {
    const pa = partes(a);
    const pb = partes(b);
    return Math.round((Date.UTC(pb.y, pb.m - 1, pb.d) - Date.UTC(pa.y, pa.m - 1, pa.d)) / 864e5);
  }
  const mayuscula = (t) => t.charAt(0).toUpperCase() + t.slice(1);
  function nombreMes(mes) {
    const { y, m } = partes(mes + '-01');
    return `${mayuscula(MESES[m - 1])} ${y}`;
  }
  function mesSolo(mes) {
    return MESES[partes(mes + '-01').m - 1];
  }
  function mesCorto(mes) {
    return MESES[partes(mes + '-01').m - 1].slice(0, 3);
  }
  function fechaCorta(fecha) {
    const { m, d } = partes(fecha);
    return `${d} ${MESES[m - 1].slice(0, 3)}`;
  }
  function fechaLarga(fecha) {
    const { y, m, d } = partes(fecha);
    return `${d} de ${MESES[m - 1]} de ${y}`;
  }
  function diaSemana(fecha) {
    const { y, m, d } = partes(fecha);
    return DIAS[new Date(y, m - 1, d).getDay()];
  }
  function fechaRelativa(fecha, referencia) {
    const dias = diasEntre(referencia, fecha);
    if (dias === 0) return 'hoy';
    if (dias === 1) return 'mañana';
    if (dias === -1) return 'ayer';
    if (dias > 1 && dias < 7) return `el ${diaSemana(fecha)} ${partes(fecha).d}`;
    return `el ${fechaCorta(fecha)}`;
  }

  // ---------- datos guardados ----------
  function idNuevo() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }
  function texto(v, maximo) {
    return typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, maximo) : '';
  }
  function entero(v, minimo, maximo, porDefecto = 0) {
    const n = Math.round(Number(v));
    return isFinite(n) && n >= minimo && n <= maximo ? n : porDefecto;
  }
  function numero(v, minimo, maximo) {
    const n = Number(v);
    return v !== null && v !== '' && isFinite(n) && n >= minimo && n <= maximo ? n : null;
  }
  const idValido = (v) => typeof v === 'string' && /^[a-z0-9_-]{1,40}$/i.test(v);

  function estadoVacio() {
    return {
      formato: 1,
      perfil: { nombre: '', ingresoBase: 0, desde: '', configurado: false },
      categorias: CATEGORIAS_BASE.map((c) => ({ ...c, base: true, limite: 0 })),
      ingresos: [],
      gastos: [],
      deudas: [],
      puntajes: [],
      diagnostico: null,
      ajustes: {
        recordatorioCuotas: true, recordatorioDiario: false, horaDiario: '20:00', resumenMensual: true,
        usura: { ...USURA },
      },
      vistos: { resumen: '', notificaciones: false },
    };
  }

  function normalizarDiagnostico(d) {
    if (!d || typeof d !== 'object') return null;
    const f = d.factores || {};
    const datos = d.datos || {};
    const nivel = (v) => (NIVELES.includes(v) ? v : '');
    const si = (v) => (v === true || v === false ? v : null);
    return {
      fecha: esFecha(d.fecha) ? d.fecha : '',
      fuente: texto(d.fuente, 40) || 'Midatacrédito',
      factores: {
        habitos: nivel(f.habitos), endeudamiento: nivel(f.endeudamiento),
        experiencia: nivel(f.experiencia), portafolio: nivel(f.portafolio),
      },
      datos: {
        antiguedadPromedio: numero(datos.antiguedadPromedio, 0, 1200),
        aperturas6m: numero(datos.aperturas6m, 0, 100),
        mesesUltimaApertura: numero(datos.mesesUltimaApertura, 0, 1200),
        probIncumplimiento: numero(datos.probIncumplimiento, 0, 100),
        utilizacionRotativos: numero(datos.utilizacionRotativos, 0, 1000),
        saldoPlazoFijo: numero(datos.saldoPlazoFijo, 0, 1000),
        utilizacionGeneral: numero(datos.utilizacionGeneral, 0, 1000),
        productosSinNegativos: numero(datos.productosSinNegativos, 0, 100),
        moraActual: si(datos.moraActual),
        moras60: si(datos.moras60),
        pagosATiempo12m: si(datos.pagosATiempo12m),
        codeudor: si(datos.codeudor),
      },
    };
  }

  // Revisa todo lo que llega del almacenamiento o de un respaldo: nada mal formado entra al estado.
  function normalizarEstado(entrada) {
    const e = estadoVacio();
    if (!entrada || typeof entrada !== 'object') return e;
    const p = entrada.perfil || {};
    e.perfil = {
      nombre: texto(p.nombre, 40),
      ingresoBase: entero(p.ingresoBase, 0, 1e11),
      desde: esMes(p.desde) ? p.desde : '',
      configurado: p.configurado === true,
    };

    const propias = Array.isArray(entrada.categorias) ? entrada.categorias : [];
    const porId = new Map(propias.filter((c) => c && idValido(c.id)).map((c) => [c.id, c]));
    e.categorias = CATEGORIAS_BASE.map((c) => {
      const guardada = porId.get(c.id) || {};
      return { ...c, base: true, limite: entero(guardada.limite, 0, 1e11),
        tipo: guardada.tipo === 'deseo' || guardada.tipo === 'necesidad' ? guardada.tipo : c.tipo };
    });
    const nombres = new Set(e.categorias.map((c) => c.nombre.toLowerCase()));
    for (const c of propias) {
      if (!c || !idValido(c.id) || CATEGORIAS_BASE.some((b) => b.id === c.id)) continue;
      const nombre = texto(c.nombre, 30);
      if (!nombre || nombres.has(nombre.toLowerCase()) || e.categorias.length >= 40) continue;
      nombres.add(nombre.toLowerCase());
      e.categorias.push({
        id: c.id, nombre, base: false,
        icono: ICONOS_CATEGORIA.includes(c.icono) ? c.icono : 'etiqueta',
        color: c.color === 8 ? 8 : 0,
        tipo: c.tipo === 'necesidad' ? 'necesidad' : 'deseo',
        limite: entero(c.limite, 0, 1e11),
      });
    }
    // Solo una categoría propia lleva el octavo color; las demás van en gris.
    let octavo = false;
    for (const c of e.categorias) {
      if (c.base) continue;
      if (c.color === 8 && !octavo) octavo = true;
      else c.color = 0;
    }
    const categorias = new Set(e.categorias.map((c) => c.id));

    e.deudas = (Array.isArray(entrada.deudas) ? entrada.deudas : []).filter((d) => d && idValido(d.id)).slice(0, 200).map((d) => {
      const tipo = TIPOS_DEUDA[d.tipo] ? d.tipo : 'otro';
      const tasa = d.tasa || {};
      return {
        id: d.id,
        nombre: texto(d.nombre, 60) || TIPOS_DEUDA[tipo].nombre,
        entidad: texto(d.entidad, 60),
        tipo,
        inicial: entero(d.inicial, 0, 1e12),
        saldo: entero(d.saldo, 0, 1e12),
        cuota: entero(d.cuota, 0, 1e11),
        tasa: { valor: numero(tasa.valor, 0, 1000) || 0, tipo: tasa.tipo === 'MV' ? 'MV' : 'EA' },
        diaPago: entero(d.diaPago, 0, 31),
        apertura: esMes(d.apertura) ? d.apertura : '',
        plazo: entero(d.plazo, 0, 600),
        estado: d.estado === 'mora' ? 'mora' : 'al_dia',
        diasMora: entero(d.diasMora, 0, 3650),
        reportada: d.reportada === false ? false : (d.reportada === true ? true : tipo !== 'personal'),
        codeudor: d.codeudor === true,
        cerrada: d.cerrada === true,
        cerradaFecha: esFecha(d.cerradaFecha) ? d.cerradaFecha : '',
        notas: texto(d.notas, 200),
        creada: esFecha(d.creada) ? d.creada : '',
        historial: (Array.isArray(d.historial) ? d.historial : [])
          .filter((h) => h && esFecha(h.fecha)).slice(-240)
          .map((h) => ({ fecha: h.fecha, saldo: entero(h.saldo, 0, 1e12) })),
      };
    });
    const deudas = new Set(e.deudas.map((d) => d.id));

    e.gastos = (Array.isArray(entrada.gastos) ? entrada.gastos : []).filter((g) => g && idValido(g.id) && esFecha(g.fecha))
      .slice(-100000).map((g) => {
        const deuda = g.deuda && deudas.has(g.deuda.id)
          ? { id: g.deuda.id, capital: entero(g.deuda.capital, -1e12, 1e12), interes: entero(g.deuda.interes, 0, 1e12) }
          : null;
        return {
          id: g.id, fecha: g.fecha, monto: entero(g.monto, 1, 1e11),
          categoria: categorias.has(g.categoria) ? g.categoria : 'personales',
          nota: texto(g.nota, 120), medio: MEDIOS[g.medio] ? g.medio : '', deuda,
        };
      }).filter((g) => g.monto > 0);

    e.ingresos = (Array.isArray(entrada.ingresos) ? entrada.ingresos : []).filter((i) => i && idValido(i.id) && esFecha(i.fecha))
      .slice(-5000).map((i) => ({ id: i.id, fecha: i.fecha, concepto: texto(i.concepto, 60) || 'Ingreso', monto: entero(i.monto, 1, 1e11) }))
      .filter((i) => i.monto > 0);

    e.puntajes = (Array.isArray(entrada.puntajes) ? entrada.puntajes : []).filter((s) => s && idValido(s.id) && esFecha(s.fecha))
      .slice(-500).map((s) => ({ id: s.id, fecha: s.fecha, valor: entero(s.valor, 0, 1000), fuente: texto(s.fuente, 40) || 'Midatacrédito' }))
      .sort((a, b) => a.fecha.localeCompare(b.fecha));

    e.diagnostico = normalizarDiagnostico(entrada.diagnostico);

    const a = entrada.ajustes || {};
    const usura = a.usura || {};
    e.ajustes = {
      recordatorioCuotas: a.recordatorioCuotas !== false,
      recordatorioDiario: a.recordatorioDiario === true,
      horaDiario: typeof a.horaDiario === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(a.horaDiario) ? a.horaDiario : '20:00',
      resumenMensual: a.resumenMensual !== false,
      usura: { ea: numero(usura.ea, 1, 200) || USURA.ea, vigencia: esMes(usura.vigencia) ? usura.vigencia : USURA.vigencia },
    };
    const v = entrada.vistos || {};
    e.vistos = { resumen: esMes(v.resumen) ? v.resumen : '', notificaciones: v.notificaciones === true };
    return e;
  }

  function categoria(estado, id) {
    return estado.categorias.find((c) => c.id === id) || { id, nombre: 'Sin categoría', icono: 'etiqueta', color: 0, tipo: 'deseo', limite: 0 };
  }

  // ---------- ingresos y resumen del mes ----------
  function ingresosDe(estado, mes) {
    return estado.ingresos.filter((i) => i.fecha.startsWith(mes)).sort((a, b) => b.fecha.localeCompare(a.fecha));
  }
  // Si en el mes no se registró ningún ingreso, se usa el ingreso mensual que la persona indicó (marcado como estimado).
  function ingresoDelMes(estado, mes, ahora = new Date()) {
    const lista = ingresosDe(estado, mes);
    if (lista.length) return { total: suma(lista, 'monto'), estimado: false, lista };
    const desde = estado.perfil.desde;
    const usaBase = estado.perfil.ingresoBase > 0 && desde && mes >= desde && mes <= mesActual(ahora);
    return { total: usaBase ? estado.perfil.ingresoBase : 0, estimado: usaBase, lista };
  }

  function resumenMes(estado, mes, ahora = new Date()) {
    const gastos = estado.gastos.filter((g) => g.fecha.startsWith(mes));
    const ingreso = ingresoDelMes(estado, mes, ahora);
    const total = suma(gastos, 'monto');
    const dias = diasDelMes(mes);
    const actual = mesActual(ahora);
    const esActual = mes === actual;
    const dia = esActual ? ahora.getDate() : (mes < actual ? dias : 0);
    const porCategoria = new Map();
    const porDia = new Array(dias).fill(0);
    let hormigaCantidad = 0;
    let hormigaTotal = 0;
    let conCredito = 0;
    let fijos = 0;
    for (const g of gastos) {
      if (CATEGORIAS_FIJAS.has(g.categoria)) fijos += g.monto;
      const c = porCategoria.get(g.categoria) || { id: g.categoria, total: 0, cantidad: 0 };
      c.total += g.monto;
      c.cantidad += 1;
      porCategoria.set(g.categoria, c);
      porDia[partes(g.fecha).d - 1] += g.monto;
      if (g.monto <= PAGO_GRANDE_HORMIGA && !['arriendo', 'deudas', 'servicios', 'salud'].includes(g.categoria)) {
        hormigaCantidad += 1;
        hormigaTotal += g.monto;
      }
      if (g.medio === 'credito') conCredito += g.monto;
    }
    const categorias = [...porCategoria.values()]
      .map((c) => ({ ...c, pct: total > 0 ? c.total / total : 0 }))
      .sort((a, b) => b.total - a.total);
    const acumulado = [];
    let corrido = 0;
    for (let i = 0; i < dias; i++) {
      corrido += porDia[i];
      acumulado.push(corrido);
    }
    // La proyección necesita al menos una semana de datos; solo los gastos variables siguen el ritmo diario.
    const proyeccion = esActual && dia >= 7 && dia < dias ? Math.round(fijos + (total - fijos) / dia * dias) : total;
    return {
      mes, esActual, dias, dia, gastos, cantidad: gastos.length, total,
      ingresos: ingreso.total, ingresoEstimado: ingreso.estimado, listaIngresos: ingreso.lista,
      disponible: ingreso.total - total,
      pctGastado: ingreso.total > 0 ? total / ingreso.total : null,
      porCategoria: categorias, porDia, acumulado, proyeccion,
      hormiga: { cantidad: hormigaCantidad, total: hormigaTotal },
      conCredito,
      mayores: [...gastos].sort((a, b) => b.monto - a.monto).slice(0, 5),
      diaMayor: porDia.reduce((mejor, v, i) => (v > mejor.total ? { dia: i + 1, total: v } : mejor), { dia: 0, total: 0 }),
      abonosDeuda: suma(gastos.filter((g) => g.categoria === 'deudas'), 'monto'),
    };
  }

  function historialMeses(estado, mes, cantidad = 6, ahora = new Date()) {
    const lista = [];
    for (let i = cantidad - 1; i >= 0; i--) {
      const m = sumarMeses(mes, -i);
      const r = resumenMes(estado, m, ahora);
      lista.push({ mes: m, ingresos: r.ingresos, gastos: r.total, estimado: r.ingresoEstimado });
    }
    return lista;
  }

  // Regla 50/30/20: necesidades, gustos y lo que queda para ahorrar o abonar a deudas.
  function reparto(estado, resumen) {
    let necesidades = 0;
    let deseos = 0;
    for (const c of resumen.porCategoria) {
      if (categoria(estado, c.id).tipo === 'necesidad') necesidades += c.total;
      else deseos += c.total;
    }
    const ingresos = resumen.ingresos;
    const ahorro = ingresos - necesidades - deseos;
    const base = ingresos > 0 ? ingresos : necesidades + deseos;
    return {
      necesidades, deseos, ahorro, ingresos,
      pNecesidades: base > 0 ? necesidades / base : 0,
      pDeseos: base > 0 ? deseos / base : 0,
      pAhorro: ingresos > 0 ? ahorro / ingresos : null,
    };
  }

  function promedioCategorias(estado, mes, meses = 3, ahora = new Date()) {
    const totales = new Map();
    let conDatos = 0;
    for (let i = 1; i <= meses; i++) {
      const r = resumenMes(estado, sumarMeses(mes, -i), ahora);
      if (!r.cantidad) continue;
      conDatos += 1;
      for (const c of r.porCategoria) totales.set(c.id, (totales.get(c.id) || 0) + c.total);
    }
    const promedio = new Map();
    if (conDatos) for (const [id, t] of totales) promedio.set(id, t / conDatos);
    return { promedio, meses: conDatos };
  }

  function gastosBasicos(estado, mes, ahora = new Date()) {
    // Lo mínimo para vivir un mes: necesidades del mes o el promedio reciente si el mes va empezando.
    const meses = [mes, sumarMeses(mes, -1), sumarMeses(mes, -2), sumarMeses(mes, -3)]
      .map((m) => resumenMes(estado, m, ahora)).filter((r) => r.cantidad > 0 && (!r.esActual || r.dia >= 20));
    if (!meses.length) return 0;
    return Math.round(suma(meses.map((r) => reparto(estado, r).necesidades)) / meses.length);
  }

  const PRIORIDAD = { alerta: 0, aviso: 1, idea: 2, bien: 3 };

  function recomendacionesMes(estado, mes, ahora = new Date()) {
    const r = resumenMes(estado, mes, ahora);
    const lista = [];
    const agregar = (id, nivel, titulo, cuerpo) => lista.push({ id, nivel, titulo, texto: cuerpo });
    const ing = r.ingresos;
    const de = (id) => (r.porCategoria.find((c) => c.id === id) || { total: 0 }).total;
    const nombre = (id) => categoria(estado, id).nombre;

    if (!r.cantidad) {
      if (r.esActual) {
        agregar('empezar', 'idea', 'Registra tus gastos del día a día',
          'Toca el botón + cada vez que pagues algo: con un par de semanas de datos Platica te muestra en qué se va tu plata y qué ajustar.');
      }
      return lista;
    }
    if (ing <= 0) {
      agregar('sin-ingresos', 'idea', 'Registra lo que recibiste este mes',
        'Sin los ingresos no se puede saber qué parte de tu plata se fue en gastos. En la pantalla de inicio toca «Ingresos» y escribe lo que te entró.');
    }
    // El mes en curso se juzga por la proyección, y solo cuando ya hay una semana de datos.
    const cierre = r.esActual ? r.proyeccion : r.total;
    const confiable = !r.esActual || r.dia >= 7;
    if (ing > 0) {
      const top = r.porCategoria.slice(0, 2).map((c) => `${nombre(c.id)} (${pesos(c.total)})`).join(' y ');
      if (r.total > ing) {
        agregar('deficit', 'alerta', `Gastaste ${pesos(r.total - ing)} más de lo que recibiste`,
          `Ese faltante sale de tus ahorros o de deuda nueva. Lo que más pesó fue ${top}: recortar ahí es lo que más rápido cierra la brecha.`);
      } else if (r.esActual && confiable && r.proyeccion > ing) {
        const restantes = r.dias - r.dia;
        agregar('ritmo', 'alerta', 'A este ritmo no te alcanza el mes',
          `Llevas ${pesos(r.total)} en ${r.dia} días. Si sigues igual, cerrarías el mes en unos ${pesos(r.proyeccion)}, ${pesos(r.proyeccion - ing)} más de lo que recibiste. `
          + `Te quedan ${pesos(ing - r.total)} para ${restantes} ${restantes === 1 ? 'día' : 'días'}: unos ${pesos((ing - r.total) / Math.max(1, restantes))} por día.`);
      }
      if (confiable && cierre <= ing) {
        const ahorro = (ing - cierre) / ing;
        const sufijo = r.esActual ? ' (proyectado)' : '';
        if (ahorro >= 0.2) {
          agregar('ahorro-alto', 'bien', `Te queda el ${porcentaje(ahorro)} de tus ingresos${sufijo}`,
            'Superas la meta del 20%. Si ya tienes un fondo de emergencia, pon a rendir ese dinero (un CDT o una cuenta de ahorro de alto rendimiento) o abónalo a capital de tu deuda más cara.');
        } else if (ahorro >= 0.1) {
          agregar('ahorro-medio', 'idea', `Te queda el ${porcentaje(ahorro)} de tus ingresos${sufijo}`,
            'Vas bien; apunta al 20%. Un truco que funciona: el día que te pagan, pasa primero el ahorro a otra cuenta o a un bolsillo y vive con el resto.');
        } else {
          agregar('ahorro-bajo', 'aviso', `Solo te queda el ${porcentaje(ahorro)} de tus ingresos${sufijo}`,
            'Págate primero: aparta al menos el 10% apenas recibas el pago, antes de empezar a gastar. Lo que no ves, no lo gastas.');
        }
      }
      const arriendo = de('arriendo') / ing;
      if (arriendo > 0.35) {
        agregar('arriendo', 'aviso', `El arriendo se lleva el ${porcentaje(arriendo)} de tus ingresos`,
          'Lo sano es que la vivienda no pase del 30%. Si se mantiene así, cualquier imprevisto te descuadra el mes. Al renovar puedes negociar el canon: en vivienda urbana el aumento anual no puede superar el IPC del año anterior (Ley 820 de 2003).');
      }
      const cuotas = cuotasMensuales(estado);
      const pagoDeudas = Math.max(de('deudas'), r.esActual ? cuotas : 0);
      const carga = pagoDeudas / ing;
      if (carga > 0.4) {
        agregar('carga-alta', 'alerta', `Las deudas se comen el ${porcentaje(carga)} de tus ingresos`,
          'Pasar del 40% es sobreendeudamiento: un imprevisto te puede llevar a la mora. No saques créditos nuevos, abona primero a la deuda con la tasa más alta y pregunta en tu banco por una compra de cartera o una refinanciación a menor tasa.');
      } else if (carga > 0.3) {
        agregar('carga-media', 'aviso', `Las deudas usan el ${porcentaje(carga)} de tus ingresos`,
          'Lo recomendable es no pasar del 30%. Evita sacar créditos nuevos hasta bajar de ese nivel; el plan de pagos en Deudas te dice por cuál empezar.');
      }
      const comida = de('comida') / ing;
      if (comida > 0.3) {
        agregar('comida', 'aviso', `La comida se llevó el ${porcentaje(comida)} de tus ingresos`,
          'Planear el mercado de la semana, comprar en plaza o en tiendas de descuento, cocinar en cantidad y llevar almuerzo bajan bastante este rubro. Revisa también cuánto se va en domicilios.');
      }
      const personales = de('personales') / ing;
      if (personales > 0.2) {
        agregar('personales', 'aviso', `Los gastos personales fueron el ${porcentaje(personales)} de tus ingresos`,
          'Son gastos que puedes elegir. Ponles un tope mensual en Más → Categorías y la app te avisa cuando te acerques.');
      }
      if (de('imprevistos') > ing * 0.1) {
        const basicos = gastosBasicos(estado, mes, ahora);
        const meta = basicos > 0 ? ` La meta es de 3 a 6 meses de gastos básicos: entre ${pesos(basicos * 3)} y ${pesos(basicos * 6)}.` : '';
        agregar('emergencia', 'idea', `Los imprevistos fueron el ${porcentaje(de('imprevistos') / ing)} del mes`,
          `Un fondo de emergencia evita que un imprevisto termine en la tarjeta de crédito.${meta} Empieza con un monto fijo cada quincena, aunque sea pequeño.`);
      }
      if (r.hormiga.cantidad >= 8 && r.hormiga.total >= ing * 0.05) {
        agregar('hormiga', 'aviso', `${r.hormiga.cantidad} gastos pequeños sumaron ${pesos(r.hormiga.total)}`,
          `Son los «gastos hormiga» de ${pesos(PAGO_GRANDE_HORMIGA)} o menos: tintos, domicilios, antojos, recargas. Uno a uno no se notan, pero juntos pesan. Ponles un tope semanal.`);
      }
    }
    for (const c of estado.categorias) {
      if (!c.limite) continue;
      const gastado = de(c.id);
      if (gastado >= c.limite) {
        agregar(`limite-${c.id}`, 'alerta', `Te pasaste del límite de ${c.nombre}`,
          `Llevas ${pesos(gastado)} de un límite de ${pesos(c.limite)} (${pesos(gastado - c.limite)} por encima).`);
      } else if (gastado >= c.limite * 0.8 && r.esActual) {
        agregar(`limite-${c.id}`, 'aviso', `Vas en el ${porcentaje(gastado / c.limite)} del límite de ${c.nombre}`,
          `Te quedan ${pesos(c.limite - gastado)} para lo que resta del mes.`);
      }
    }
    const { promedio, meses } = promedioCategorias(estado, mes, 3, ahora);
    if (meses >= 1) {
      const subidas = r.porCategoria
        .map((c) => ({ ...c, antes: promedio.get(c.id) || 0 }))
        .filter((c) => c.antes > 0 && c.total > c.antes * 1.3 && c.total - c.antes >= 50000)
        .sort((a, b) => (b.total - b.antes) - (a.total - a.antes))
        .slice(0, 2);
      for (const c of subidas) {
        agregar(`subida-${c.id}`, 'aviso', `${nombre(c.id)} subió ${porcentaje(c.total / c.antes - 1)} frente a tus meses anteriores`,
          `Este mes ${r.esActual ? 'llevas' : 'gastaste'} ${pesos(c.total)}; tu promedio era de ${pesos(c.antes)}.`);
      }
    }
    if (r.total > 0 && r.conCredito / r.total > 0.15) {
      agregar('credito', 'idea', `Pagaste con tarjeta de crédito el ${porcentaje(r.conCredito / r.total)} de tus gastos`,
        'Si la usas, difiere a una sola cuota y paga el total antes de la fecha límite: así no pagas intereses. Actualiza su saldo en Deudas para que tu análisis de crédito siga al día.');
    }
    if (ing > 0 && !lista.some((x) => x.nivel === 'alerta' || x.nivel === 'aviso') && confiable) {
      agregar('orden', 'bien', 'Tu mes va en orden',
        'Gastas menos de lo que recibes y ninguna categoría se sale de lo recomendable. Sigue registrando para que el resumen del mes sea exacto.');
    }
    return lista.sort((a, b) => PRIORIDAD[a.nivel] - PRIORIDAD[b.nivel]);
  }

  // ---------- tasas y cuotas ----------
  function tasaMensual(tasa) {
    if (!tasa || !(tasa.valor > 0)) return 0;
    return tasa.tipo === 'MV' ? tasa.valor / 100 : Math.pow(1 + tasa.valor / 100, 1 / 12) - 1;
  }
  function tasaEA(tasa) {
    if (!tasa || !(tasa.valor > 0)) return 0;
    return tasa.tipo === 'MV' ? Math.pow(1 + tasa.valor / 100, 12) - 1 : tasa.valor / 100;
  }
  function eaAMensual(ea) {
    return Math.pow(1 + ea, 1 / 12) - 1;
  }
  function cuotaFija(monto, i, n) {
    if (!(n > 0) || !(monto > 0)) return 0;
    if (!(i > 0)) return monto / n;
    return monto * i / (1 - Math.pow(1 + i, -n));
  }
  function valorPresente(cuota, i, n) {
    if (!(n > 0) || !(cuota > 0)) return 0;
    if (!(i > 0)) return cuota * n;
    return cuota * (1 - Math.pow(1 + i, -n)) / i;
  }
  function tablaAmortizacion(monto, i, n, seguro = 0) {
    const cuota = cuotaFija(monto, i, n);
    const filas = [];
    let saldo = monto;
    let intereses = 0;
    for (let k = 1; k <= n && saldo > 0.5; k++) {
      const interes = saldo * i;
      let capital = cuota - interes;
      if (k === n || capital > saldo) capital = saldo;
      saldo -= capital;
      intereses += interes;
      filas.push({ n: k, cuota: capital + interes + seguro, interes, capital, saldo: Math.max(0, saldo) });
    }
    return { cuota: cuota + seguro, filas, intereses, total: monto + intereses + seguro * filas.length, seguros: seguro * filas.length };
  }
  function mesesParaPagar(saldo, i, cuota, limite = 600) {
    if (!(saldo > 0)) return { meses: 0, intereses: 0 };
    if (!(cuota > 0) || cuota <= saldo * i + 0.5) return { meses: Infinity, intereses: Infinity };
    let s = saldo;
    let meses = 0;
    let intereses = 0;
    while (s > 0.5 && meses < limite) {
      const interes = s * i;
      intereses += interes;
      s = s + interes - cuota;
      meses += 1;
    }
    return meses >= limite && s > 0.5 ? { meses: Infinity, intereses: Infinity } : { meses, intereses };
  }

  // ---------- deudas ----------
  const grupoDe = (d) => TIPOS_DEUDA[d.tipo].grupo;
  const esRotativa = (d) => grupoDe(d) === 'rotativo';
  function activas(estado) {
    return estado.deudas.filter((d) => !d.cerrada && !d.codeudor);
  }
  function cuotasMensuales(estado) {
    return suma(activas(estado).map((d) => cuotaUsada(d).cuota));
  }
  function plazoRestante(d, ahora = new Date()) {
    if (!d.plazo) return 0;
    const transcurridos = d.apertura ? Math.max(0, mesesEntre(d.apertura, mesActual(ahora))) : 0;
    return Math.max(1, d.plazo - transcurridos);
  }
  // Cuota con la que se proyecta la deuda: la que escribió la persona o una estimación razonable.
  function cuotaUsada(d, ahora = new Date()) {
    if (d.cuota > 0) return { cuota: d.cuota, estimada: false };
    if (!(d.saldo > 0)) return { cuota: 0, estimada: false };
    const i = tasaMensual(d.tasa);
    let cuota;
    if (esRotativa(d)) cuota = d.saldo * i + d.saldo / 24;
    else if (d.plazo) cuota = cuotaFija(d.saldo, i, plazoRestante(d, ahora));
    else cuota = d.saldo * i + d.saldo / 12;
    return { cuota: Math.round(cuota), estimada: true };
  }
  function proximoPago(d, referencia) {
    if (!d.diaPago || d.cerrada) return '';
    const mes = referencia.slice(0, 7);
    const enMes = (m) => fechaISO(...m.split('-').map(Number), Math.min(d.diaPago, diasDelMes(m)));
    const este = enMes(mes);
    return este >= referencia ? este : enMes(sumarMeses(mes, 1));
  }
  function pagosDe(estado, id) {
    return estado.gastos.filter((g) => g.deuda && g.deuda.id === id).sort((a, b) => b.fecha.localeCompare(a.fecha));
  }
  // Un pago se reparte entre el interés del mes y el capital; el saldo nuevo es editable en el formulario.
  function repartoPago(saldo, tasa, pago) {
    const interes = Math.min(pago, Math.round(saldo * tasaMensual(tasa)));
    const capital = Math.min(saldo, Math.max(0, pago - interes));
    return { interes, capital, saldo: saldo - capital };
  }
  function proyeccionDeuda(d, extra = 0, ahora = new Date()) {
    const { cuota, estimada } = cuotaUsada(d, ahora);
    const i = tasaMensual(d.tasa);
    const r = mesesParaPagar(d.saldo, i, cuota + extra);
    return {
      cuota, estimada, i,
      meses: r.meses, intereses: r.intereses,
      fin: isFinite(r.meses) ? sumarMeses(mesActual(ahora), r.meses) : '',
    };
  }
  function pctPagado(d) {
    if (!(d.inicial > 0) || esRotativa(d)) return null;
    return Math.max(0, Math.min(1, 1 - d.saldo / d.inicial));
  }

  // Simula mes a mes cómo salir de las deudas: cada mes se paga la cuota de todas y el extra va a la prioritaria.
  // Cuando una deuda termina, su cuota se suma al extra (efecto bola de nieve).
  function planPagos(deudas, extra = 0, estrategia = 'avalancha', ahora = new Date()) {
    const lista = deudas.filter((d) => d.saldo > 0).map((d) => {
      const c = cuotaUsada(d, ahora);
      return { id: d.id, nombre: d.nombre, saldo: d.saldo, i: tasaMensual(d.tasa), cuota: c.cuota, estimada: c.estimada, fin: 0, intereses: 0 };
    });
    const total0 = suma(lista, 'saldo');
    const serie = [total0];
    let intereses = 0;
    let mes = 0;
    const orden = () => lista.filter((d) => d.saldo > 0.5).sort((a, b) => (estrategia === 'avalancha'
      ? b.i - a.i || a.saldo - b.saldo
      : a.saldo - b.saldo || b.i - a.i));
    const prioridad = orden();
    while (lista.some((d) => d.saldo > 0.5) && mes < 600) {
      mes += 1;
      let libre = extra;
      for (const d of lista) {
        if (d.saldo <= 0.5) {
          libre += d.cuota;
          continue;
        }
        const interes = d.saldo * d.i;
        d.saldo += interes;
        d.intereses += interes;
        intereses += interes;
        const pago = Math.min(d.saldo, d.cuota);
        d.saldo -= pago;
        libre += d.cuota - pago;
      }
      for (const d of orden()) {
        if (libre <= 0) break;
        const pago = Math.min(d.saldo, libre);
        d.saldo -= pago;
        libre -= pago;
      }
      for (const d of lista) if (d.saldo <= 0.5 && !d.fin) { d.saldo = 0; d.fin = mes; }
      serie.push(Math.max(0, suma(lista, 'saldo')));
    }
    const termina = lista.every((d) => d.fin);
    return {
      posible: termina,
      meses: termina ? mes : Infinity,
      intereses: termina ? intereses : Infinity,
      // El orden es la prioridad del abono extra al empezar; cada una dice en qué mes termina.
      orden: prioridad.map((d) => ({ id: d.id, nombre: d.nombre, mes: d.fin, fecha: d.fin ? sumarMeses(mesActual(ahora), d.fin) : '', estimada: d.estimada })),
      sinTerminar: lista.filter((d) => !d.fin).map((d) => d.nombre),
      serie,
      total: total0,
    };
  }

  // ---------- vida crediticia ----------
  function analisisCredito(estado, ahora = new Date()) {
    const mes = mesActual(ahora);
    const abiertas = estado.deudas.filter((d) => !d.cerrada);
    const propias = abiertas.filter((d) => !d.codeudor);
    const reportadas = abiertas.filter((d) => d.reportada);
    const porGrupo = {};
    for (const g of Object.keys(GRUPOS_DEUDA)) porGrupo[g] = { saldo: 0, inicial: 0, cantidad: 0 };
    for (const d of propias) {
      const g = porGrupo[grupoDe(d)];
      g.saldo += d.saldo;
      g.inicial += d.inicial;
      g.cantidad += 1;
    }
    const rot = reportadas.filter((d) => !d.codeudor && esRotativa(d));
    const rotSaldo = suma(rot, 'saldo');
    const rotCupo = suma(rot, 'inicial');
    const fijas = reportadas.filter((d) => !d.codeudor && !esRotativa(d) && grupoDe(d) !== 'hipotecario' && d.inicial > 0);
    const sinHipoteca = reportadas.filter((d) => !d.codeudor && grupoDe(d) !== 'hipotecario' && d.inicial > 0);
    const conApertura = estado.deudas.filter((d) => d.reportada && d.apertura);
    const abiertasConApertura = conApertura.filter((d) => !d.cerrada);
    const edades = abiertasConApertura.map((d) => Math.max(0, mesesEntre(d.apertura, mes)));
    const ultima = conApertura.reduce((max, d) => (d.apertura > max ? d.apertura : max), '');
    const ingreso = ingresoDelMes(estado, mes, ahora).total;
    const cuotas = cuotasMensuales(estado);
    const usura = estado.ajustes.usura.ea / 100;
    return {
      total: suma(propias, 'saldo'),
      cantidad: propias.length,
      porGrupo,
      cuotas,
      ingreso,
      carga: ingreso > 0 ? cuotas / ingreso : null,
      rotSaldo, rotCupo,
      rotUtil: rotCupo > 0 ? rotSaldo / rotCupo : null,
      rotativas: rot.map((d) => ({ id: d.id, nombre: d.nombre, saldo: d.saldo, cupo: d.inicial, util: d.inicial > 0 ? d.saldo / d.inicial : null })),
      saldoFijas: fijas.length ? suma(fijas, 'saldo') / suma(fijas, 'inicial') : null,
      utilGeneral: sinHipoteca.length ? suma(sinHipoteca, 'saldo') / suma(sinHipoteca, 'inicial') : null,
      etapaInicial: fijas.filter((d) => d.saldo / d.inicial > 0.89).map((d) => d.nombre),
      antiguedad: edades.length ? Math.round(suma(edades) / edades.length) : null,
      aperturas6m: conApertura.filter((d) => mesesEntre(d.apertura, mes) < 6).length,
      ultimaApertura: ultima,
      mesesUltima: ultima ? Math.max(0, mesesEntre(ultima, mes)) : null,
      enMora: abiertas.filter((d) => d.estado === 'mora'),
      diasMora: Math.max(0, ...abiertas.filter((d) => d.estado === 'mora').map((d) => d.diasMora)),
      codeudor: abiertas.filter((d) => d.codeudor),
      tipos: [...new Set(reportadas.filter((d) => !d.codeudor).map((d) => d.tipo))],
      sobreUsura: propias.filter((d) => d.tasa.valor > 0 && tasaEA(d.tasa) > usura + 0.0001),
      sinTasa: propias.filter((d) => !(d.tasa.valor > 0) && d.tipo !== 'personal'),
      reportadas: reportadas.length,
    };
  }

  // Lo que dicen los datos guardados en Platica, con las mismas escalas del diagnóstico de Midatacrédito.
  function factoresEstimados(an) {
    const r = {};
    if (!an.reportadas) return { habitos: null, endeudamiento: null, experiencia: null, portafolio: null };
    r.habitos = an.enMora.length ? (an.diasMora >= 60 ? 'malo' : 'regular') : 'excelente';
    if (an.utilGeneral == null && an.rotUtil == null) r.endeudamiento = null;
    else {
      const u = an.utilGeneral != null ? an.utilGeneral : an.rotUtil;
      r.endeudamiento = u < 0.3 ? 'excelente' : u < 0.55 ? 'bueno' : u < 0.87 ? 'regular' : 'malo';
      if (an.rotUtil != null && an.rotUtil > 1 && r.endeudamiento === 'excelente') r.endeudamiento = 'bueno';
    }
    if (an.antiguedad == null) r.experiencia = an.aperturas6m >= 3 ? 'regular' : null;
    else {
      r.experiencia = an.antiguedad >= 48 ? 'excelente' : an.antiguedad >= 24 ? 'bueno' : 'regular';
      if (an.aperturas6m >= 3 && r.experiencia !== 'regular') r.experiencia = 'regular';
    }
    if (an.enMora.length) r.portafolio = 'regular';
    else if (an.tipos.length >= 3 && (an.utilGeneral == null || an.utilGeneral < 0.3) && !an.codeudor.length) r.portafolio = 'excelente';
    else r.portafolio = 'bueno';
    return r;
  }

  function bandaPuntaje(valor) {
    const i = BANDAS.findIndex((b) => valor >= b.min && valor <= b.max);
    return i < 0 ? 0 : i;
  }

  // Combina el reporte de Midatacrédito (una foto del pasado) con las deudas registradas hoy.
  // Los datos del reporte envejecen: un mes después, la antigüedad y los meses desde la última apertura suben en uno.
  function indicadores(estado, an, ahora = new Date()) {
    const diag = estado.diagnostico;
    const d = diag ? diag.datos : {};
    const pasados = diag && diag.fecha ? Math.max(0, mesesEntre(diag.fecha.slice(0, 7), mesActual(ahora))) : 0;
    const mas = (v) => (v != null ? v + pasados : null);
    const elegir = (app, rep) => (app != null ? app : rep);
    return {
      antiguedad: elegir(an.antiguedad, mas(d.antiguedadPromedio)),
      aperturas6m: an.ultimaApertura ? an.aperturas6m : (pasados < 6 ? d.aperturas6m : null),
      mesesUltima: elegir(an.mesesUltima, mas(d.mesesUltimaApertura)),
      rotUtil: elegir(an.rotUtil, d.utilizacionRotativos != null ? d.utilizacionRotativos / 100 : null),
      saldoFijas: elegir(an.saldoFijas, d.saldoPlazoFijo != null ? d.saldoPlazoFijo / 100 : null),
      utilGeneral: elegir(an.utilGeneral, d.utilizacionGeneral != null ? d.utilizacionGeneral / 100 : null),
      mora: an.reportadas ? an.enMora.length > 0 : d.moraActual === true,
      fuenteApp: an.reportadas > 0,
    };
  }

  function planPuntaje(estado, an, ahora = new Date()) {
    const ind = indicadores(estado, an, ahora);
    const acciones = [];
    const agregar = (id, impacto, titulo, cuerpo) => acciones.push({ id, impacto, titulo, texto: cuerpo });
    for (const d of an.enMora) {
      agregar(`mora-${d.id}`, 'alto', `Ponte al día con ${d.nombre}`,
        `Lleva ${d.diasMora || 'algunos'} días en mora. Es lo primero que debes resolver: el reporte negativo dura el doble del tiempo de la mora, máximo 4 años desde que pagas (Ley 2157 de 2021). Si no puedes pagar todo, llama a la entidad y pide un acuerdo de pago antes de que la mora crezca.`);
    }
    const sobrecupo = an.rotativas.filter((t) => t.util != null && t.util > 1);
    for (const t of sobrecupo) {
      agregar(`sobrecupo-${t.id}`, 'alto', `Baja ${t.nombre} por debajo del cupo`,
        `Debes ${pesos(t.saldo)} sobre un cupo de ${pesos(t.cupo)} (${porcentaje(t.util)}). Abona ${pesos(t.saldo - t.cupo)} para quedar dentro del cupo y ${pesos(t.saldo - t.cupo * 0.3)} en total para llegar al 30%, que es un uso sano. Mientras tanto, no hagas compras nuevas con ella.`);
    }
    if (!sobrecupo.length && ind.rotUtil != null && ind.rotUtil > 0.3) {
      const exceso = an.rotCupo > 0 ? an.rotSaldo - an.rotCupo * 0.3 : 0;
      agregar('uso-tarjetas', ind.rotUtil > 0.87 ? 'alto' : 'medio', `Usa menos del 30% del cupo de tus tarjetas`,
        `Hoy usas el ${porcentaje(ind.rotUtil)}.${exceso > 0 ? ` Abonar ${pesos(exceso)} te deja en el 30%.` : ''} Mantener cupo libre es una de las formas más rápidas de mejorar el factor de endeudamiento.`);
    }
    if (ind.utilGeneral != null && ind.utilGeneral >= 0.55) {
      agregar('util-general', 'medio', 'Baja tu endeudamiento general por debajo del 55%',
        `Debes el ${porcentaje(ind.utilGeneral)} de todo lo que te han prestado o aprobado (sin hipotecarios). Usa el plan de pagos para abonar a capital y bajar de ese nivel.`);
    }
    // Las tarjetas no se «terminan de pagar»: para ellas cuenta el uso del cupo, que ya tiene su propia acción.
    const cercanas = activas(estado).filter((d) => d.saldo > 0 && !esRotativa(d) && d.saldo <= Math.max(500000, (d.inicial || 0) * 0.15) && d.reportada)
      .sort((a, b) => a.saldo - b.saldo);
    if (cercanas.length) {
      const d = cercanas[0];
      agregar(`cierre-${d.id}`, 'alto', `Termina de pagar ${d.nombre}`,
        `Te faltan ${pesos(d.saldo)}. Cerrar una obligación pagándola completa y bajar el endeudamiento es de lo que más sube el puntaje. Cuando la termines, pide el paz y salvo.`);
    }
    if (ind.mesesUltima != null && (ind.mesesUltima < 3 || (ind.aperturas6m || 0) >= 3)) {
      const base = an.ultimaApertura || sumarMeses(mesActual(ahora), -Math.round(ind.mesesUltima));
      const hasta = sumarMeses(base, 3);
      agregar('sin-creditos', 'medio', `No pidas créditos nuevos hasta ${mesSolo(hasta)} de ${hasta.slice(0, 4)}`,
        `${(ind.aperturas6m || 0) >= 3 ? `Abriste ${ind.aperturas6m} productos en los últimos 6 meses. ` : ''}Abrir muchos créditos seguidos se asocia con más riesgo de mora, y cada solicitud deja una huella de consulta en tu historial. Deja que tu flujo de caja se acomode a las cuotas actuales.`);
    }
    agregar('al-dia', ind.mora ? 'alto' : 'medio', 'Paga todas las cuotas antes de la fecha límite',
      'Los hábitos de pago son el factor que más pesa. Activa los recordatorios de cuotas en Más → Recordatorios y, si puedes, programa el débito automático de la cuota mínima.');
    agregar('no-cupos', 'medio', 'No uses una tarjeta para pagar otra deuda',
      'Pagar cuotas con avances o con el cupo de otra tarjeta es una de las peores prácticas: suma intereses altos y esconde el problema. Si no te alcanza, habla con la entidad.');
    if (an.codeudor.length) {
      agregar('codeudor', 'medio', `Vigila las deudas donde eres codeudor (${an.codeudor.length})`,
        'Si el deudor principal se atrasa, el reporte negativo también es tuyo. Pregúntale cada mes si está al día.');
    }
    if (ind.antiguedad != null && ind.antiguedad < 24) {
      agregar('antiguedad', 'bajo', 'Conserva tus productos más antiguos',
        `Tu antigüedad promedio es de ${Math.round(ind.antiguedad)} meses. La experiencia solo crece con el tiempo: mantén abiertos y al día tus productos más viejos, con poco uso, y evita cancelar la tarjeta más antigua si no te cobra cuota de manejo alta.`);
    }
    for (const d of an.sobreUsura) {
      agregar(`usura-${d.id}`, 'medio', `Revisa la tasa de ${d.nombre}`,
        `Registraste ${decimal(tasaEA(d.tasa) * 100, 2)}% E.A., más que la tasa de usura (${decimal(estado.ajustes.usura.ea, 2)}% E.A.). Confírmala en tu extracto: cobrar por encima de la usura es ilegal y puedes quejarte ante la entidad y la Superintendencia Financiera.`);
    }
    const orden = { alto: 0, medio: 1, bajo: 2 };
    return acciones.sort((a, b) => orden[a.impacto] - orden[b.impacto]);
  }

  // Textos del diagnóstico, al estilo del reporte de Midatacrédito pero con tus datos actuales.
  function textosDiagnostico(estado, an, ahora = new Date()) {
    const rep = estado.diagnostico ? estado.diagnostico.datos : {};
    const ind = indicadores(estado, an, ahora);
    const puntaje = ultimoPuntaje(estado);
    const t = { experiencia: [], portafolio: [], endeudamiento: [], habitos: [] };

    if (ind.antiguedad != null) {
      const a = Math.round(ind.antiguedad);
      t.experiencia.push(`El promedio de antigüedad de tus productos es de ${a} ${a === 1 ? 'mes' : 'meses'}. `
        + (a < 24 ? 'Es una experiencia crediticia reducida: las entidades todavía tienen poca historia tuya para evaluar.'
          : a < 48 ? 'Es un portafolio reciente (menos de 4 años): cada mes al día suma historia positiva.'
            : 'Es una historia larga, que juega a tu favor.')
        + ' La experiencia solo mejora con el tiempo: conserva al día tus productos más antiguos.');
    }
    if (ind.aperturas6m != null) {
      const n = ind.aperturas6m;
      t.experiencia.push(n >= 3
        ? `Abriste ${n} o más productos en los últimos 6 meses. Abrir muchos créditos en poco tiempo se asocia con más riesgo de mora, y las entidades lo tienen en cuenta al estudiar tus próximas solicitudes. Después de un crédito nuevo, espera unos 3 meses antes de pedir otro.`
        : n > 0 ? `Abriste ${n} ${n === 1 ? 'producto' : 'productos'} en los últimos 6 meses: es un ritmo moderado.`
          : 'No abriste productos nuevos en los últimos 6 meses: eso le da estabilidad a tu perfil.');
    }
    if (ind.mesesUltima != null && ind.mesesUltima < 3) {
      const base = an.ultimaApertura || sumarMeses(mesActual(ahora), -Math.round(ind.mesesUltima));
      const hasta = sumarMeses(base, 3);
      t.experiencia.push(`Tu última apertura fue hace ${Math.round(ind.mesesUltima)} ${Math.round(ind.mesesUltima) === 1 ? 'mes' : 'meses'}. Espera por lo menos hasta ${mesSolo(hasta)} de ${hasta.slice(0, 4)} para que tu flujo de caja se adapte a esa cuota.`);
    }

    if (rep.probIncumplimiento != null) {
      t.portafolio.push(`Comparado con personas de tu edad, las entidades podrían ver una probabilidad de incumplimiento de hasta el ${decimal(rep.probIncumplimiento, 0)}%.`);
    }
    if (puntaje) {
      const b = bandaPuntaje(puntaje.valor);
      t.portafolio.push(b <= 1 ? 'Tu puntaje está en una franja de riesgo alto: las entidades serán exigentes con tus solicitudes.'
        : b === 2 ? 'Tu puntaje indica un riesgo medio de caer en mora. Si no tienes saldos vencidos, sigue pagando a tiempo para bajar ese riesgo mes a mes.'
          : 'Tu puntaje indica un riesgo bajo: las entidades te ven como buen pagador.');
    }
    if (an.tipos.length) {
      const nombres = an.tipos.map((x) => TIPOS_DEUDA[x].nombre.toLowerCase());
      const rotativos = an.tipos.some((x) => TIPOS_DEUDA[x].grupo === 'rotativo');
      t.portafolio.push(`Tienes ${nombres.length === 1 ? nombres[0] : nombres.slice(0, -1).join(', ') + ' y ' + nombres[nombres.length - 1]}. `
        + (rotativos ? 'Las tarjetas y los créditos rotativos requieren un manejo más cuidadoso, porque sus cupos y tasas suelen ser más altos que los de otras obligaciones.' : 'Tener productos al día de distintos tipos muestra que sabes manejar crédito.'));
    }
    const codeudor = an.codeudor.length || rep.codeudor === true;
    t.portafolio.push(codeudor
      ? `Eres codeudor${an.codeudor.length ? ` de ${an.codeudor.length} ${an.codeudor.length === 1 ? 'obligación' : 'obligaciones'}` : ''}. Esa deuda cuenta como tuya: si el deudor principal se atrasa, el reporte negativo también te llega a ti.`
      : 'No tienes obligaciones como codeudor. Si te lo piden, recuerda que esa deuda cuenta como tuya: afecta tu capacidad de endeudamiento y tu puntaje si el deudor no paga.');

    if (ind.rotUtil != null) {
      const u = ind.rotUtil;
      t.endeudamiento.push(`Usas el ${porcentaje(u, 1)} del cupo de tus tarjetas y créditos rotativos. `
        + (u > 1 ? 'Estás por encima del cupo aprobado (sobrecupo): es la señal más fuerte de endeudamiento alto. Baja ese saldo primero.'
          : u > 0.87 ? 'Es una utilización alta: estás cerca del límite y te queda poco cupo para emergencias.'
            : u > 0.3 ? 'Es un nivel medio: tienes cupo libre, pero conviene bajarlo del 30%.'
              : 'Es un nivel sano: mantén cupo libre para emergencias.')
        + ' Los intereses de tarjetas y rotativos son de los más altos del mercado: úsalos de forma puntual, difiere a pocas cuotas (ojalá a una) y nunca los uses para pagar cuotas de otras deudas.');
    }
    if (ind.saldoFijas != null) {
      const s = ind.saldoFijas;
      t.endeudamiento.push(`En tus créditos de plazo fijo debes el ${porcentaje(s, 1)} del valor inicial. `
        + (s > 0.89 ? 'Estás en la etapa inicial, la de mayor riesgo: casi todo lo que pagas se va en intereses y tu flujo de caja todavía se está acomodando.'
          : 'Ya pasaste la etapa inicial (cuando se debe más del 89%), que es la de mayor riesgo de incumplimiento.'));
    }
    if (ind.utilGeneral != null) {
      t.endeudamiento.push(`Tu utilización general, sin hipotecarios, es del ${porcentaje(ind.utilGeneral, 1)}. `
        + (ind.utilGeneral < 0.55 ? 'Está por debajo del 55% recomendado: así mantienes el riesgo controlado y cupo disponible para un imprevisto.'
          : 'Supera el 55% recomendado: bajarla libera cupo para emergencias y mejora este factor.'));
    }
    if (an.carga != null && an.cuotas > 0) {
      t.endeudamiento.push(`Tus cuotas suman ${pesos(an.cuotas)} al mes, el ${porcentaje(an.carga)} de tus ingresos. `
        + (an.carga > 0.4 ? 'Es una carga muy alta: no tomes créditos nuevos.' : an.carga > 0.3 ? 'Está por encima del 30% recomendado.' : 'Está dentro del 30% recomendado.'));
    }

    if (ind.mora) {
      t.habitos.push(`Tienes ${an.enMora.length || 'alguna'} ${an.enMora.length === 1 ? 'obligación' : 'obligaciones'} en mora${an.diasMora ? ` (hasta ${an.diasMora} días)` : ''}. Ponerte al día es lo primero: el dato negativo dura el doble del tiempo de la mora, máximo 4 años desde que pagas, y caduca a los 8 años desde que empezó la mora (Ley 2157 de 2021).`);
    } else {
      t.habitos.push('No tienes saldos en mora. Es el factor que más pesa en tu puntaje: indica que adaptaste tus ingresos para cumplir con tus obligaciones.');
    }
    if (rep.moras60 === false) {
      t.habitos.push('No has tenido moras de más de 60 días en los últimos 3 años. Es muy positivo: menos del 40% de quienes llegan a moras graves logra ponerse al día.');
    }
    if (rep.pagosATiempo12m === true) {
      t.habitos.push('En los últimos 12 meses pagaste todas tus obligaciones a tiempo. Mantenerlo te abre la puerta a nuevos productos en mejores condiciones.');
    }
    if (rep.productosSinNegativos != null) {
      t.habitos.push(`${rep.productosSinNegativos} ${rep.productosSinNegativos === 1 ? 'producto no tiene' : 'productos no tienen'} reportes negativos en el último año. Cada mes al día suma reportes positivos a tu historial.`);
    }
    return t;
  }

  function ultimoPuntaje(estado) {
    return estado.puntajes.length ? estado.puntajes[estado.puntajes.length - 1] : null;
  }

  // Estimación orientativa: Datacrédito no publica su fórmula. Sirve para comparar escenarios entre sí.
  function simularPuntaje(base, escenario, ind) {
    const efectos = [];
    const agregar = (texto, m1, m3) => efectos.push({ texto, m1, m3 });
    if (escenario.usoObjetivo != null && ind.rotUtil != null) {
      const actual = Math.min(150, Math.round(ind.rotUtil * 100));
      const meta = Math.max(0, Math.min(actual, escenario.usoObjetivo));
      if (meta < actual) {
        const g = (actual - meta) * 0.4;
        agregar(`Bajar el uso de tus tarjetas del ${actual}% al ${meta}%`, [g * 0.3, g * 0.6], [g * 0.6, g * 1.1]);
      }
    }
    if (escenario.cerrarDeuda) agregar('Pagar por completo una obligación', [5, 15], [10, 25]);
    if (escenario.alDia) {
      if (ind.mora) agregar('Ponerte al día con lo que está en mora', [10, 30], [20, 50]);
      else agregar('Pagar todas las cuotas a tiempo', [0, 5], [5, 15]);
    }
    if (escenario.nuevoCredito) agregar('Abrir un crédito nuevo', [-35, -10], [-20, -5]);
    if (escenario.mora === 30) agregar('Atrasarte 30 días en un pago', [-90, -40], [-80, -30]);
    if (escenario.mora === 60) agregar('Atrasarte 60 días o más', [-150, -80], [-140, -70]);
    const limitar = (v) => Math.max(0, Math.min(1000, Math.round(v)));
    const rango = (clave) => {
      const min = suma(efectos.map((e) => e[clave][0]));
      const max = suma(efectos.map((e) => e[clave][1]));
      return { min: limitar(base + min), max: limitar(base + max) };
    };
    return { base, efectos, mes1: rango('m1'), mes3: rango('m3') };
  }

  // Cuánto podrías pedir prestado sin apretarte: cuotas totales hasta el 30% de los ingresos (máximo 40%)
  // y nunca más de lo que de verdad te sobra cada mes.
  function capacidadEndeudamiento({ ingresos, gastosFinancieros, gastos, tasaMV, plazo }) {
    const libre = ingresos - gastosFinancieros - gastos;
    const i = tasaMV / 100;
    const cuotaRecomendada = Math.max(0, Math.min(ingresos * 0.3 - gastosFinancieros, libre * 0.7));
    const cuotaMaxima = Math.max(0, Math.min(ingresos * 0.4 - gastosFinancieros, libre * 0.9));
    return {
      libre,
      cargaActual: ingresos > 0 ? gastosFinancieros / ingresos : null,
      cuotaRecomendada: Math.round(cuotaRecomendada),
      cuotaMaxima: Math.round(cuotaMaxima),
      montoRecomendado: Math.round(valorPresente(cuotaRecomendada, i, plazo) / 10000) * 10000,
      montoMaximo: Math.round(valorPresente(cuotaMaxima, i, plazo) / 10000) * 10000,
      ea: Math.pow(1 + i, 12) - 1,
      vivienda: Math.round(Math.max(0, ingresos * 0.3)),
    };
  }

  function viabilidadCreditos(estado, an, capacidad, ahora = new Date()) {
    const ind = indicadores(estado, an, ahora);
    const p = ultimoPuntaje(estado);
    const base = p ? [0, 0.5, 1.5, 2.3, 3][bandaPuntaje(p.valor)] : 1.5;
    const comunes = [];
    let castigo = 0;
    if (ind.mora) {
      comunes.push('Tienes obligaciones en mora: casi cualquier solicitud será negada hasta que te pongas al día.');
      castigo += 3;
    }
    if (ind.mesesUltima != null && (ind.mesesUltima < 3 || (ind.aperturas6m || 0) >= 3)) {
      comunes.push('Abriste créditos hace poco: las entidades prefieren que esperes unos meses.');
      castigo += 0.7;
    }
    if (!p) comunes.push('Registra tu puntaje en «Mi puntaje» para una estimación más precisa.');
    const productos = [];
    const nivel = (v) => (v >= 2.2 ? 'alta' : v >= 1.3 ? 'media' : 'baja');
    {
      let v = base - castigo;
      const razones = [];
      if (ind.rotUtil != null && ind.rotUtil > 0.87) {
        v -= 1.5;
        razones.push(`Ya usas el ${porcentaje(ind.rotUtil)} del cupo de tus tarjetas: otra tarjeta suele negarse con un uso tan alto.`);
      } else if (ind.rotUtil != null && ind.rotUtil > 0.3) {
        v -= 0.5;
        razones.push('Bajar el uso de tus tarjetas del 30% mejora la respuesta.');
      }
      productos.push({ id: 'tarjeta', nombre: 'Tarjeta de crédito', nivel: nivel(v), razones });
    }
    {
      let v = base - castigo;
      const razones = [];
      if (capacidad.cuotaRecomendada <= 0) {
        v -= 2;
        razones.push('Tus ingresos ya están comprometidos: no te queda margen para otra cuota.');
      } else {
        razones.push(`Con tus números, una cuota de hasta ${pesos(capacidad.cuotaRecomendada)} es manejable: unos ${pesos(capacidad.montoRecomendado)} con la tasa y el plazo del simulador.`);
      }
      if (an.carga != null && an.carga > 0.3) v -= 0.7;
      productos.push({ id: 'libre', nombre: 'Libre inversión', nivel: nivel(v), razones });
    }
    {
      let v = base - castigo - 0.3;
      const razones = ['Suelen financiar hasta el 80% o 90% del carro; necesitas la cuota inicial.'];
      if (capacidad.cuotaRecomendada <= 0) v -= 2;
      productos.push({ id: 'vehiculo', nombre: 'Crédito de vehículo', nivel: nivel(v), razones });
    }
    {
      let v = base - castigo - 0.5;
      const razones = [`La cuota de vivienda no puede pasar del 30% de los ingresos del hogar: para ti, unos ${pesos(capacidad.vivienda)} al mes. `
        + 'Financian hasta el 70% del valor del inmueble (80% si es vivienda de interés social).'];
      if (ind.antiguedad != null && ind.antiguedad < 12) {
        v -= 0.5;
        razones.push('Con menos de un año de historia crediticia, los bancos piden más soportes.');
      }
      productos.push({ id: 'hipotecario', nombre: 'Crédito hipotecario', nivel: nivel(v), razones });
    }
    return { comunes, productos };
  }

  // ---------- recordatorios ----------
  function aMilisegundos(fecha, hora) {
    const { y, m, d } = partes(fecha);
    const [hh, mm] = hora.split(':').map(Number);
    return new Date(y, m - 1, d, hh, mm, 0, 0).getTime();
  }
  function recordatorios(estado, ahora = new Date()) {
    const lista = [];
    const ref = hoy(ahora);
    const t = ahora.getTime();
    const agregar = (id, cuando, titulo, cuerpo) => { if (cuando > t) lista.push({ id, cuando, titulo, texto: cuerpo }); };
    if (estado.ajustes.recordatorioCuotas) {
      for (const d of activas(estado)) {
        if (!d.diaPago || !(d.saldo > 0)) continue;
        let fecha = proximoPago(d, ref);
        for (let ciclo = 0; ciclo < 2 && fecha; ciclo++) {
          // Si ya registraste el pago de este ciclo, no se recuerda.
          const pagado = estado.gastos.some((g) => g.deuda && g.deuda.id === d.id && g.fecha <= fecha && diasEntre(g.fecha, fecha) <= 20);
          const cuota = cuotaUsada(d, ahora).cuota;
          const monto = cuota ? ` por ${pesos(cuota)}` : '';
          if (!pagado) {
            agregar(`${d.id}-${fecha}-antes`, aMilisegundos(sumarDias(fecha, -2), '09:00'), `Se acerca la cuota de ${d.nombre}`,
              `Vence el ${diaSemana(fecha)} ${partes(fecha).d}${monto}. Pagar a tiempo es lo que más cuida tu puntaje.`);
            agregar(`${d.id}-${fecha}-dia`, aMilisegundos(fecha, '08:00'), `Hoy vence la cuota de ${d.nombre}`,
              `Págala hoy${monto} y regístrala en Platica para mantener tu saldo al día.`);
          }
          fecha = proximoPago(d, sumarDias(fecha, 1));
        }
      }
    }
    if (estado.ajustes.recordatorioDiario) {
      const registradoHoy = estado.gastos.some((g) => g.fecha === ref);
      for (let i = registradoHoy ? 1 : 0; i < 30; i++) {
        const fecha = sumarDias(ref, i);
        agregar(`diario-${fecha}`, aMilisegundos(fecha, estado.ajustes.horaDiario), '¿Ya registraste tus gastos de hoy?',
          'Toma menos de un minuto y te deja ver en qué se va tu plata.');
      }
    }
    if (estado.ajustes.resumenMensual) {
      for (let i = 1; i <= 2; i++) {
        const mes = sumarMeses(mesActual(ahora), i);
        const anterior = sumarMeses(mes, -1);
        agregar(`resumen-${anterior}`, aMilisegundos(`${mes}-01`, '09:00'), `Tu resumen de ${mesSolo(anterior)} está listo`,
          'Mira cuánto gastaste, en qué y qué puedes mejorar este mes.');
      }
    }
    return lista.sort((a, b) => a.cuando - b.cuando).slice(0, 300);
  }

  // ---------- exportar ----------
  function gastosCSV(estado) {
    const celda = (v) => {
      const s = String(v == null ? '' : v);
      // Una celda que empieza con =, +, - o @ se toma como fórmula en Excel: se antepone un apóstrofo.
      const segura = /^[=+\-@]/.test(s) ? `'${s}` : s;
      return /[;"\n]/.test(segura) ? `"${segura.replace(/"/g, '""')}"` : segura;
    };
    const filas = [['Fecha', 'Tipo', 'Categoría', 'Monto', 'Medio de pago', 'Nota', 'Deuda']];
    for (const g of [...estado.gastos].sort((a, b) => a.fecha.localeCompare(b.fecha))) {
      const deuda = g.deuda ? (estado.deudas.find((d) => d.id === g.deuda.id) || {}).nombre : '';
      filas.push([g.fecha, 'Gasto', categoria(estado, g.categoria).nombre, g.monto, MEDIOS[g.medio] || '', g.nota, deuda || '']);
    }
    for (const i of [...estado.ingresos].sort((a, b) => a.fecha.localeCompare(b.fecha))) {
      filas.push([i.fecha, 'Ingreso', i.concepto, i.monto, '', '', '']);
    }
    // Excel en español separa columnas con punto y coma; el BOM hace que lea bien las tildes.
    return '﻿' + filas.map((f) => f.map(celda).join(';')).join('\r\n') + '\r\n';
  }

  function textoResumen(estado, mes, ahora = new Date()) {
    const r = resumenMes(estado, mes, ahora);
    const lineas = [`Mi resumen de ${mesSolo(mes)} ${mes.slice(0, 4)} (Platica)`, ''];
    lineas.push(`Ingresos: ${pesos(r.ingresos)}${r.ingresoEstimado ? ' (estimado)' : ''}`);
    lineas.push(`Gastos: ${pesos(r.total)} en ${r.cantidad} ${r.cantidad === 1 ? 'pago' : 'pagos'}`);
    lineas.push(`${r.disponible >= 0 ? 'Me quedó' : 'Me faltó'}: ${pesos(Math.abs(r.disponible))}`);
    if (r.porCategoria.length) {
      lineas.push('', 'Por categoría:');
      for (const c of r.porCategoria) lineas.push(`• ${categoria(estado, c.id).nombre}: ${pesos(c.total)} (${porcentaje(c.pct)})`);
    }
    return lineas.join('\n');
  }

  return {
    CATEGORIAS_BASE, SUGERENCIAS, ICONOS_CATEGORIA, MEDIOS, TIPOS_DEUDA, GRUPOS_DEUDA, NIVELES, FACTORES, BANDAS, USURA,
    PAGO_GRANDE_HORMIGA,
    pesos, compacto, decimal, porcentaje, leerMonto, leerDecimal, suma,
    hoy, mesActual, sumarMeses, diasDelMes, mesesEntre, sumarDias, diasEntre, nombreMes, mesSolo, mesCorto,
    fechaCorta, fechaLarga, diaSemana, fechaRelativa, esFecha, esMes, partes,
    idNuevo, estadoVacio, normalizarEstado, categoria,
    ingresosDe, ingresoDelMes, resumenMes, historialMeses, reparto, recomendacionesMes, gastosBasicos,
    tasaMensual, tasaEA, eaAMensual, cuotaFija, valorPresente, tablaAmortizacion, mesesParaPagar,
    grupoDe, esRotativa, activas, cuotasMensuales, cuotaUsada, proximoPago, pagosDe, repartoPago, proyeccionDeuda,
    pctPagado, planPagos, plazoRestante,
    analisisCredito, factoresEstimados, bandaPuntaje, indicadores, planPuntaje, textosDiagnostico, ultimoPuntaje,
    simularPuntaje, capacidadEndeudamiento, viabilidadCreditos,
    recordatorios, gastosCSV, textoResumen,
  };
});
