// Pruebas del motor de cálculos. Uso: node --test pruebas/
const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('../app/src/main/assets/web/motor.js');

// 19 de octubre de 2026 a mediodía, hora del teléfono.
const AHORA = new Date(2026, 9, 19, 12, 0, 0);

function estadoCon(cambios = {}) {
  const e = M.estadoVacio();
  e.perfil = { nombre: 'Daniel', ingresoBase: 2000000, desde: '2026-08', configurado: true };
  return M.normalizarEstado({ ...e, ...cambios });
}
const gasto = (id, fecha, monto, categoria, extra = {}) => ({ id, fecha, monto, categoria, nota: '', medio: '', ...extra });

test('formatea pesos colombianos', () => {
  assert.equal(M.pesos(1234567), '$1.234.567');
  assert.equal(M.pesos(-5000), '-$5.000');
  assert.equal(M.pesos(0), '$0');
  assert.equal(M.compacto(4453000), '$4,5 M');
  assert.equal(M.compacto(12500000), '$13 M');
  assert.equal(M.compacto(850000), '$850 mil');
  assert.equal(M.leerMonto('$ 25.000'), 25000);
  assert.equal(M.leerMonto(''), 0);
  assert.equal(M.leerDecimal('1,2'), 1.2);
  assert.equal(M.porcentaje(0.5446, 1), '54,5%');
});

test('maneja fechas y meses', () => {
  assert.equal(M.hoy(AHORA), '2026-10-19');
  assert.equal(M.sumarMeses('2026-11', 2), '2027-01');
  assert.equal(M.sumarMeses('2026-01', -1), '2025-12');
  assert.equal(M.diasDelMes('2028-02'), 29);
  assert.equal(M.mesesEntre('2025-09', '2026-10'), 13);
  assert.equal(M.sumarDias('2026-10-31', 1), '2026-11-01');
  assert.equal(M.diasEntre('2026-10-19', '2026-11-02'), 14);
  assert.equal(M.nombreMes('2026-10'), 'Octubre 2026');
  assert.equal(M.fechaLarga('2026-10-19'), '19 de octubre de 2026');
  assert.equal(M.diaSemana('2026-10-19'), 'lunes');
});

test('normaliza datos dañados sin perder lo válido', () => {
  const e = M.normalizarEstado({
    perfil: { ingresoBase: '3000000', configurado: true, desde: '2026-13' },
    categorias: [{ id: 'comida', limite: 600000 }, { id: 'transporte', nombre: 'Transporte', icono: 'bus', color: 8 },
      { id: 'otra', nombre: 'Mascotas', color: 8 }, { id: 'x y', nombre: 'Mala' }],
    gastos: [gasto('a', '2026-10-01', 1000, 'comida'), gasto('b', 'ayer', 5, 'comida'), gasto('c', '2026-10-02', -4, 'comida'),
      gasto('d', '2026-10-03', 9000, 'borrada')],
    deudas: [{ id: 'd1', tipo: 'nada', saldo: 100, tasa: { valor: 2, tipo: 'MV' } }],
  });
  assert.equal(e.perfil.ingresoBase, 3000000);
  assert.equal(e.perfil.desde, '');
  assert.equal(e.categorias.find((c) => c.id === 'comida').limite, 600000);
  assert.equal(e.categorias.length, 9);
  // Solo la primera categoría propia conserva el octavo color.
  assert.deepEqual(e.categorias.filter((c) => !c.base).map((c) => c.color), [8, 0]);
  assert.deepEqual(e.gastos.map((g) => g.id), ['a', 'd']);
  assert.equal(e.gastos[1].categoria, 'personales');
  assert.equal(e.deudas[0].tipo, 'otro');
  assert.equal(e.deudas[0].tasa.tipo, 'MV');
  assert.equal(e.deudas[0].reportada, true);
});

test('el ingreso del mes es el registrado o, si no hay, el ingreso mensual estimado', () => {
  const e = estadoCon({ ingresos: [{ id: 'i1', fecha: '2026-09-30', concepto: 'Salario', monto: 2100000 },
    { id: 'i2', fecha: '2026-09-15', concepto: 'Extra', monto: 150000 }] });
  assert.deepEqual([M.ingresoDelMes(e, '2026-09', AHORA).total, M.ingresoDelMes(e, '2026-09', AHORA).estimado], [2250000, false]);
  assert.deepEqual([M.ingresoDelMes(e, '2026-10', AHORA).total, M.ingresoDelMes(e, '2026-10', AHORA).estimado], [2000000, true]);
  // Antes de empezar a usar la app no se inventan ingresos.
  assert.equal(M.ingresoDelMes(e, '2026-07', AHORA).total, 0);
});

test('resume el mes por categoría, con proyección y gastos hormiga', () => {
  const gastos = [gasto('a', '2026-10-01', 800000, 'arriendo'), gasto('b', '2026-10-02', 120000, 'servicios'),
    gasto('c', '2026-10-10', 300000, 'comida', { medio: 'credito' })];
  for (let i = 0; i < 9; i++) gastos.push(gasto(`h${i}`, `2026-10-1${i}`, 15000, 'personales'));
  const e = estadoCon({ gastos });
  const r = M.resumenMes(e, '2026-10', AHORA);
  assert.equal(r.total, 1355000);
  assert.equal(r.porCategoria[0].id, 'arriendo');
  assert.equal(r.disponible, 645000);
  assert.equal(r.hormiga.cantidad, 9);
  assert.equal(r.hormiga.total, 135000);
  assert.equal(r.acumulado[30], 1355000);
  // Arriendo y servicios se pagan una vez; solo comida y gastos personales siguen el ritmo diario.
  assert.equal(r.proyeccion, Math.round(920000 + 435000 / 19 * 31));
  assert.equal(r.conCredito, 300000);
  const reparto = M.reparto(e, r);
  assert.equal(reparto.necesidades, 1220000);
  assert.equal(reparto.deseos, 135000);
});

test('recomienda según cómo va el mes', () => {
  const e = estadoCon({ gastos: [gasto('a', '2026-10-01', 900000, 'arriendo'), gasto('b', '2026-10-05', 700000, 'comida'),
    gasto('c', '2026-10-06', 500000, 'personales')] });
  const ids = M.recomendacionesMes(e, '2026-10', AHORA).map((r) => r.id);
  assert.ok(ids.includes('deficit'), ids.join());
  assert.ok(ids.includes('arriendo'));
  assert.ok(ids.includes('comida'));
  assert.ok(ids.includes('personales'));
  assert.equal(ids[0], 'deficit');
  const vacio = M.recomendacionesMes(estadoCon(), '2026-10', AHORA);
  assert.deepEqual(vacio.map((r) => r.id), ['empezar']);
});

test('avisa cuando una categoría pasa su límite', () => {
  const e = estadoCon({ categorias: [{ id: 'comida', limite: 400000 }], gastos: [gasto('a', '2026-10-03', 450000, 'comida')] });
  const r = M.recomendacionesMes(e, '2026-10', AHORA).find((x) => x.id === 'limite-comida');
  assert.equal(r.nivel, 'alerta');
});

test('convierte tasas y calcula cuotas fijas', () => {
  assert.ok(Math.abs(M.tasaEA({ valor: 1.2, tipo: 'MV' }) - 0.153895) < 1e-5);
  assert.ok(Math.abs(M.tasaMensual({ valor: 28.59, tipo: 'EA' }) - 0.021178) < 1e-5);
  // 10 millones a 60 meses al 1,5% M.V.
  assert.equal(Math.round(M.cuotaFija(10000000, 0.015, 60)), 253934);
  assert.equal(Math.round(M.valorPresente(253934, 0.015, 60) / 1000), 10000);
  const t = M.tablaAmortizacion(1000000, 0.02, 12);
  assert.equal(t.filas.length, 12);
  assert.ok(t.filas[11].saldo < 1);
  assert.ok(Math.abs(t.total - t.cuota * 12) < 1);
  assert.equal(M.mesesParaPagar(1000000, 0.02, 15000).meses, Infinity);
});

test('reparte un pago entre interés y capital', () => {
  const r = M.repartoPago(1000000, { valor: 2, tipo: 'MV' }, 120000);
  assert.deepEqual(r, { interes: 20000, capital: 100000, saldo: 900000 });
  assert.deepEqual(M.repartoPago(50000, { valor: 0, tipo: 'EA' }, 80000), { interes: 0, capital: 50000, saldo: 0 });
});

test('calcula el próximo pago respetando meses cortos', () => {
  const d = { diaPago: 31, cerrada: false };
  assert.equal(M.proximoPago(d, '2026-10-19'), '2026-10-31');
  assert.equal(M.proximoPago(d, '2026-11-05'), '2026-11-30');
  assert.equal(M.proximoPago({ diaPago: 5 }, '2026-10-19'), '2026-11-05');
});

test('el plan avalancha paga menos intereses que la bola de nieve', () => {
  const deudas = [
    { id: 't', nombre: 'Tarjeta', tipo: 'tarjeta', saldo: 3000000, inicial: 4000000, cuota: 150000, tasa: { valor: 28, tipo: 'EA' } },
    { id: 'c', nombre: 'Celular', tipo: 'telecom', saldo: 600000, inicial: 1200000, cuota: 100000, tasa: { valor: 12, tipo: 'EA' } },
  ];
  const av = M.planPagos(deudas, 200000, 'avalancha', AHORA);
  const bn = M.planPagos(deudas, 200000, 'bola', AHORA);
  const solo = M.planPagos(deudas, 0, 'avalancha', AHORA);
  assert.ok(av.posible && bn.posible && solo.posible);
  assert.ok(av.intereses <= bn.intereses);
  assert.ok(av.meses < solo.meses);
  assert.equal(bn.orden[0].id, 'c');
  assert.equal(av.serie[0], 3600000);
  assert.equal(av.serie[av.serie.length - 1], 0);
  const imposible = M.planPagos([{ ...deudas[0], cuota: 10000 }], 0, 'avalancha', AHORA);
  assert.equal(imposible.posible, false);
});

// Las deudas del reporte de Midatacrédito del 18 de octubre de 2026.
function estadoDelReporte() {
  return estadoCon({
    deudas: [
      { id: 'otros', nombre: 'Créditos «Otros»', tipo: 'sector_real', inicial: 8959000, saldo: 4453000, cuota: 0, apertura: '2025-09' },
      { id: 'tc', nombre: 'Tarjeta de crédito', tipo: 'tarjeta', inicial: 480000, saldo: 680000, apertura: '2026-10',
        tasa: { valor: 27, tipo: 'EA' } },
    ],
    puntajes: [{ id: 'p1', fecha: '2026-10-18', valor: 602, fuente: 'Midatacrédito' }],
    diagnostico: {
      fecha: '2026-10-18',
      factores: { experiencia: 'regular', portafolio: 'bueno', endeudamiento: 'bueno', habitos: 'excelente' },
      datos: { antiguedadPromedio: 13, aperturas6m: 3, mesesUltimaApertura: 0, probIncumplimiento: 20, utilizacionRotativos: 144.44,
        saldoPlazoFijo: 49.71, utilizacionGeneral: 54.46, moraActual: false, moras60: false, pagosATiempo12m: true, codeudor: false,
        productosSinNegativos: 2 },
    },
  });
}

test('analiza la vida crediticia con los datos del reporte', () => {
  const e = estadoDelReporte();
  const an = M.analisisCredito(e, AHORA);
  assert.equal(an.total, 5133000);
  assert.ok(Math.abs(an.rotUtil - 680000 / 480000) < 1e-9);
  assert.ok(Math.abs(an.saldoFijas - 4453000 / 8959000) < 1e-9);
  assert.ok(Math.abs(an.utilGeneral - 5133000 / 9439000) < 1e-9);
  assert.equal(an.aperturas6m, 1);
  assert.equal(an.mesesUltima, 0);
  const f = M.factoresEstimados(an);
  assert.deepEqual(f, { habitos: 'excelente', endeudamiento: 'bueno', experiencia: 'regular', portafolio: 'bueno' });
  const plan = M.planPuntaje(e, an, AHORA);
  assert.equal(plan[0].id, 'sobrecupo-tc');
  assert.match(plan[0].texto, /Abona \$200\.000 para quedar dentro del cupo y \$536\.000/);
  assert.ok(plan.some((a) => a.id === 'sin-creditos' && /enero de 2027/.test(a.titulo)));
  const t = M.textosDiagnostico(e, an, AHORA);
  assert.match(t.endeudamiento[0], /141,7%/);
  assert.match(t.habitos[0], /No tienes saldos en mora/);
  assert.match(t.portafolio[0], /20%/);
});

test('sin deudas registradas usa el reporte y lo envejece con el tiempo', () => {
  const e = estadoDelReporte();
  e.deudas = [];
  const enero = new Date(2027, 0, 10);
  const ind = M.indicadores(e, M.analisisCredito(e, enero), enero);
  assert.equal(ind.antiguedad, 16);
  assert.equal(ind.mesesUltima, 3);
  assert.ok(Math.abs(ind.rotUtil - 1.4444) < 1e-9);
});

test('simula el puntaje con rangos orientativos', () => {
  const s = M.simularPuntaje(602, { usoObjetivo: 30, alDia: true }, { rotUtil: 1.4444, mora: false });
  assert.ok(s.mes3.min > 602 && s.mes3.max > s.mes3.min);
  assert.ok(s.mes1.max <= s.mes3.max);
  const mala = M.simularPuntaje(602, { mora: 60 }, { rotUtil: 0.2, mora: false });
  assert.ok(mala.mes1.max < 602);
  assert.equal(M.simularPuntaje(990, { usoObjetivo: 0 }, { rotUtil: 1.5 }).mes3.max, 1000);
});

test('estima la capacidad de endeudamiento', () => {
  const c = M.capacidadEndeudamiento({ ingresos: 2000000, gastosFinancieros: 500000, gastos: 200000, tasaMV: 1.2, plazo: 60 });
  assert.equal(c.cuotaRecomendada, 100000);
  assert.equal(c.cuotaMaxima, 300000);
  assert.equal(c.montoRecomendado, 4260000);
  const sin = M.capacidadEndeudamiento({ ingresos: 1000000, gastosFinancieros: 500000, gastos: 600000, tasaMV: 1.5, plazo: 60 });
  assert.equal(sin.cuotaRecomendada, 0);
  const v = M.viabilidadCreditos(estadoDelReporte(), M.analisisCredito(estadoDelReporte(), AHORA), c, AHORA);
  assert.equal(v.productos.find((p) => p.id === 'tarjeta').nivel, 'baja');
});

test('programa recordatorios de cuotas sin repetir las ya pagadas', () => {
  const e = estadoCon({
    deudas: [{ id: 'tc', nombre: 'Tarjeta', tipo: 'tarjeta', inicial: 1000000, saldo: 500000, cuota: 80000, diaPago: 25 }],
    ajustes: { recordatorioCuotas: true, recordatorioDiario: true, horaDiario: '20:00', resumenMensual: true },
  });
  const lista = M.recordatorios(e, AHORA);
  assert.ok(lista.some((r) => r.id === 'tc-2026-10-25-antes'));
  assert.ok(lista.some((r) => r.id === 'tc-2026-11-25-dia'));
  assert.ok(lista.some((r) => r.id === 'diario-2026-10-19'));
  assert.ok(lista.some((r) => r.id === 'resumen-2026-10'));
  assert.ok(lista.every((r, i) => i === 0 || lista[i - 1].cuando <= r.cuando));
  e.gastos.push({ id: 'p', fecha: '2026-10-19', monto: 80000, categoria: 'deudas', nota: '', medio: '', deuda: { id: 'tc', capital: 70000, interes: 10000 } });
  const despues = M.recordatorios(e, AHORA);
  assert.ok(!despues.some((r) => r.id.startsWith('tc-2026-10-25')));
  assert.ok(!despues.some((r) => r.id === 'diario-2026-10-19'));
});

test('exporta un CSV seguro para Excel', () => {
  const e = estadoCon({ gastos: [gasto('a', '2026-10-01', 5000, 'comida', { nota: '=HYPERLINK("x")' }), gasto('b', '2026-10-02', 7000, 'salud', { nota: 'gafas; lentes' })] });
  const csv = M.gastosCSV(e);
  assert.ok(csv.startsWith('﻿Fecha;Tipo;Categoría'));
  assert.match(csv, /"'=HYPERLINK\(""x""\)"/);
  assert.match(csv, /"gafas; lentes"/);
});
