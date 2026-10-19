// Gráficas de Platica en SVG, sin librerías. Cada función devuelve el HTML de la gráfica;
// Graficas.activar(raiz) conecta el tooltip (cruz sobre las líneas, toque sobre cada columna).
(function () {
  'use strict';
  const registro = new Map();
  let contador = 0;
  const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  const esc = (t) => String(t == null ? '' : t).replace(/[&<>"']/g, (c) => ESC[c]);
  const r1 = (n) => Math.round(n * 10) / 10;

  function pasoBonito(x) {
    if (!(x > 0)) return 1;
    const e = Math.pow(10, Math.floor(Math.log10(x)));
    const f = x / e;
    return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * e;
  }
  // Marcas del eje en números redondos: 0, 500 mil, 1 M...
  function escala(min, max, partes = 3) {
    if (!(max > min)) max = min + 1;
    const paso = pasoBonito((max - min) / partes);
    const desde = Math.floor(min / paso) * paso;
    const hasta = Math.ceil(max / paso) * paso;
    const marcas = [];
    for (let v = desde; v <= hasta + paso / 2; v += paso) marcas.push(Math.round(v * 1000) / 1000);
    return { min: desde, max: hasta, marcas };
  }

  function nuevoId() {
    contador += 1;
    return `g${contador}`;
  }

  function barra(x, y, w, h) {
    // Punta redondeada de 4 px; la base, sobre el eje, queda recta.
    if (h <= 0) return '';
    const r = Math.min(4, w / 2, h);
    return `M${r1(x)},${r1(y + h)}V${r1(y + r)}Q${r1(x)},${r1(y)} ${r1(x + r)},${r1(y)}H${r1(x + w - r)}Q${r1(x + w)},${r1(y)} ${r1(x + w)},${r1(y + r)}V${r1(y + h)}Z`;
  }

  function ejeY(marcas, y, izquierda, derecha, formato) {
    return marcas.map((v) => `<line class="grid" x1="${izquierda}" x2="${derecha}" y1="${r1(y(v))}" y2="${r1(y(v))}"/>`
      + `<text class="eje-texto" x="${izquierda - 6}" y="${r1(y(v) + 4)}" text-anchor="end">${esc(formato(v))}</text>`).join('');
  }

  function ruta(puntos) {
    return puntos.map((p, i) => `${i ? 'L' : 'M'}${r1(p[0])},${r1(p[1])}`).join('');
  }

  // Línea del gasto acumulado del mes, con la línea de ingresos como referencia y la proyección punteada.
  function lineaMes(o) {
    const id = nuevoId();
    const ancho = o.ancho;
    const alto = 200;
    const m = { izq: 48, der: 14, arr: 22, aba: 26 };
    const dias = o.acumulado.length;
    const hasta = Math.max(0, Math.min(o.dia, dias));
    const vistos = o.acumulado.slice(0, hasta);
    const tope = Math.max(o.ingresos || 0, vistos.length ? vistos[vistos.length - 1] : 0, o.proyeccion || 0, 1) * 1.08;
    const ey = escala(0, tope, 3);
    const x = (d) => m.izq + (d - 1) / Math.max(1, dias - 1) * (ancho - m.izq - m.der);
    const y = (v) => alto - m.aba - (v - ey.min) / (ey.max - ey.min) * (alto - m.arr - m.aba);
    let svg = ejeY(ey.marcas, y, m.izq, ancho - m.der, o.formatoEje);
    for (const d of [1, 8, 15, 22, dias]) {
      svg += `<text class="eje-texto" x="${r1(x(d))}" y="${alto - 8}" text-anchor="${d === 1 ? 'start' : d === dias ? 'end' : 'middle'}">${esc(o.etiquetaDia(d, d === 1 || d === dias))}</text>`;
    }
    if (o.ingresos > 0) {
      const yi = y(o.ingresos);
      svg += `<line class="referencia" x1="${m.izq}" x2="${ancho - m.der}" y1="${r1(yi)}" y2="${r1(yi)}"/>`
        + `<text class="eje-texto fuerte" x="${ancho - m.der}" y="${r1(yi - 6)}" text-anchor="end">Ingresos ${esc(o.formatoValor(o.ingresos))}</text>`;
    }
    const puntos = vistos.map((v, i) => [x(i + 1), y(v)]);
    if (puntos.length) {
      const base = y(ey.min);
      svg += `<path class="area" style="fill:${o.color}" d="${ruta(puntos)}L${r1(puntos[puntos.length - 1][0])},${r1(base)}L${r1(puntos[0][0])},${r1(base)}Z"/>`;
      if (o.proyeccion > 0 && hasta < dias && hasta >= 7) {
        const ultimo = puntos[puntos.length - 1];
        svg += `<path class="proyeccion" style="stroke:${o.color}" d="M${r1(ultimo[0])},${r1(ultimo[1])}L${r1(x(dias))},${r1(y(o.proyeccion))}"/>`;
      }
      svg += `<path class="linea" style="stroke:${o.color}" d="${ruta(puntos)}"/>`;
      const fin = puntos[puntos.length - 1];
      svg += `<circle class="punto" style="fill:${o.color}" cx="${r1(fin[0])}" cy="${r1(fin[1])}" r="4"/>`;
    }
    svg += `<line class="cruz" x1="0" x2="0" y1="${m.arr}" y2="${alto - m.aba}" visibility="hidden"/>`
      + `<circle class="cruz-punto" style="fill:${o.color}" r="4" visibility="hidden"/>`
      + `<rect class="zona" x="${m.izq}" y="0" width="${ancho - m.izq - m.der}" height="${alto}"/>`;
    registro.set(id, {
      tipo: 'cruz',
      puntos: puntos.map((p, i) => ({
        x: p[0], y: p[1], titulo: o.etiquetaDia(i + 1, true),
        filas: [{ valor: o.formatoValor(vistos[i]), nombre: 'gastado hasta ese día', color: o.color },
          { valor: o.formatoValor(vistos[i] - (i ? vistos[i - 1] : 0)), nombre: 'ese día' }],
      })),
    });
    return `<div class="grafica" data-grafica="${id}"><svg width="${ancho}" height="${alto}" viewBox="0 0 ${ancho} ${alto}" role="img" aria-label="${esc(o.descripcion)}">${svg}</svg></div>`;
  }

  // Columnas agrupadas (por ejemplo, ingresos y gastos de cada mes).
  function columnas(o) {
    const id = nuevoId();
    const ancho = o.ancho;
    const alto = 190;
    const m = { izq: 48, der: 8, arr: 12, aba: 26 };
    const n = o.grupos.length;
    const tope = Math.max(1, ...o.grupos.flatMap((g) => g.valores)) * 1.05;
    const ey = escala(0, tope, 3);
    const banda = (ancho - m.izq - m.der) / n;
    const series = o.series.length;
    const grosor = Math.min(18, (banda - 14 - (series - 1) * 2) / series);
    const y = (v) => alto - m.aba - v / ey.max * (alto - m.arr - m.aba);
    let svg = ejeY(ey.marcas, y, m.izq, ancho - m.der, o.formatoEje);
    o.grupos.forEach((g, i) => {
      const centro = m.izq + banda * (i + 0.5);
      const inicio = centro - (grosor * series + 2 * (series - 1)) / 2;
      g.valores.forEach((v, s) => {
        const yy = y(v);
        svg += `<path class="columna" style="fill:${o.series[s].color}" d="${barra(inicio + s * (grosor + 2), yy, grosor, y(0) - yy)}"/>`;
      });
      svg += `<text class="eje-texto${g.actual ? ' fuerte' : ''}" x="${r1(centro)}" y="${alto - 8}" text-anchor="middle">${esc(g.etiqueta)}</text>`;
      svg += `<rect class="golpe" tabindex="0" data-i="${i}" x="${r1(m.izq + banda * i)}" y="0" width="${r1(banda)}" height="${alto - m.aba}" aria-label="${esc(g.titulo)}"/>`;
    });
    svg += `<line class="eje" x1="${m.izq}" x2="${ancho - m.der}" y1="${r1(y(0))}" y2="${r1(y(0))}"/>`;
    registro.set(id, {
      tipo: 'columnas',
      grupos: o.grupos.map((g) => ({ titulo: g.titulo, filas: g.valores.map((v, s) => ({ valor: o.formatoValor(v), nombre: o.series[s].nombre, color: o.series[s].color })) })),
    });
    const leyenda = o.series.map((s) => `<span><i class="muestra" style="background:${s.color}"></i>${esc(s.nombre)}</span>`).join('');
    return `<div class="leyenda">${leyenda}</div><div class="grafica" data-grafica="${id}"><svg width="${ancho}" height="${alto}" viewBox="0 0 ${ancho} ${alto}" role="img" aria-label="${esc(o.descripcion)}">${svg}</svg></div>`;
  }

  // Varias líneas sobre el mismo eje (plan de pagos, historial del puntaje o del saldo).
  function lineas(o) {
    const id = nuevoId();
    const ancho = o.ancho;
    const alto = o.alto || 190;
    const m = { izq: 48, der: o.etiquetaFinal ? 64 : 14, arr: 16, aba: 26 };
    const largo = Math.max(...o.series.map((s) => s.valores.length));
    const todos = o.series.flatMap((s) => s.valores);
    const ey = o.dominio ? { min: o.dominio[0], max: o.dominio[1], marcas: o.marcas || escala(o.dominio[0], o.dominio[1], 3).marcas } : escala(0, Math.max(1, ...todos), 3);
    const x = (i) => m.izq + (largo <= 1 ? 0.5 : i / (largo - 1)) * (ancho - m.izq - m.der);
    const y = (v) => alto - m.aba - (Math.max(ey.min, Math.min(ey.max, v)) - ey.min) / (ey.max - ey.min) * (alto - m.arr - m.aba);
    let svg = '';
    for (const b of o.bandas || []) {
      const y1 = y(Math.min(b.max, ey.max));
      const y2 = y(Math.max(b.min, ey.min));
      if (y2 > y1) svg += `<rect class="banda" style="fill:${b.color}" x="${m.izq}" y="${r1(y1)}" width="${ancho - m.izq - m.der}" height="${r1(y2 - y1)}"/>`;
    }
    svg += ejeY(ey.marcas, y, m.izq, ancho - m.der, o.formatoEje);
    const marcasX = o.marcasX || [0, Math.floor((largo - 1) / 2), largo - 1];
    for (const i of [...new Set(marcasX)]) {
      if (i < 0 || i >= largo) continue;
      svg += `<text class="eje-texto" x="${r1(x(i))}" y="${alto - 8}" text-anchor="${largo > 1 && i === 0 ? 'start' : largo > 1 && i === largo - 1 ? 'end' : 'middle'}">${esc(o.etiquetaX(i))}</text>`;
    }
    for (const s of o.series) {
      const puntos = s.valores.map((v, i) => [x(i), y(v)]);
      if (puntos.length > 1) svg += `<path class="linea" style="stroke:${s.color}" d="${ruta(puntos)}"/>`;
      if (o.marcadores || puntos.length === 1) {
        svg += puntos.map((p) => `<circle class="punto" style="fill:${s.color}" cx="${r1(p[0])}" cy="${r1(p[1])}" r="4"/>`).join('');
      } else if (puntos.length) {
        const fin = puntos[puntos.length - 1];
        svg += `<circle class="punto" style="fill:${s.color}" cx="${r1(fin[0])}" cy="${r1(fin[1])}" r="4"/>`;
      }
      if (o.etiquetaFinal && puntos.length) {
        const fin = puntos[puntos.length - 1];
        svg += `<text class="eje-texto fuerte" x="${r1(fin[0] + 8)}" y="${r1(fin[1] + 4)}">${esc(o.etiquetaFinal(s))}</text>`;
      }
    }
    svg += `<line class="cruz" x1="0" x2="0" y1="${m.arr}" y2="${alto - m.aba}" visibility="hidden"/>`
      + `<rect class="zona" x="${m.izq}" y="0" width="${ancho - m.izq - m.der}" height="${alto}"/>`;
    registro.set(id, {
      tipo: 'cruz',
      puntos: Array.from({ length: largo }, (_, i) => ({
        x: x(i), titulo: o.etiquetaX(i, true),
        filas: o.series.filter((s) => i < s.valores.length).map((s) => ({ valor: o.formatoValor(s.valores[i]), nombre: s.nombre, color: s.color })),
      })),
    });
    const leyenda = o.series.length > 1
      ? `<div class="leyenda">${o.series.map((s) => `<span><i class="muestra linea-muestra" style="background:${s.color}"></i>${esc(s.nombre)}</span>`).join('')}</div>` : '';
    return `${leyenda}<div class="grafica" data-grafica="${id}"><svg width="${ancho}" height="${alto}" viewBox="0 0 ${ancho} ${alto}" role="img" aria-label="${esc(o.descripcion)}">${svg}</svg></div>`;
  }

  // ---------- tooltip ----------
  let tip = null;
  function mostrarTip(titulo, filas, px, py) {
    tip = tip || document.getElementById('tooltip');
    if (!tip) return;
    tip.replaceChildren();
    const t = document.createElement('div');
    t.className = 'tip-titulo';
    t.textContent = titulo;
    tip.appendChild(t);
    for (const f of filas) {
      const fila = document.createElement('div');
      fila.className = 'tip-fila';
      if (f.color) {
        const clave = document.createElement('i');
        clave.className = 'tip-clave';
        clave.style.background = f.color;
        fila.appendChild(clave);
      }
      const valor = document.createElement('strong');
      valor.textContent = f.valor;
      const nombre = document.createElement('span');
      nombre.textContent = f.nombre;
      fila.append(valor, nombre);
      tip.appendChild(fila);
    }
    tip.hidden = false;
    const w = tip.offsetWidth;
    const h = tip.offsetHeight;
    const left = Math.max(8, Math.min(window.innerWidth - w - 8, px - w / 2));
    const top = py - h - 14 < 8 ? py + 18 : py - h - 14;
    tip.style.left = `${left}px`;
    tip.style.top = `${top}px`;
  }
  function ocultarTip() {
    tip = tip || document.getElementById('tooltip');
    if (tip) tip.hidden = true;
    document.querySelectorAll('.grafica .cruz, .grafica .cruz-punto').forEach((e) => e.setAttribute('visibility', 'hidden'));
    document.querySelectorAll('.grafica .golpe.activo').forEach((e) => e.classList.remove('activo'));
  }

  function activar(raiz) {
    for (const caja of raiz.querySelectorAll('.grafica[data-grafica]')) {
      if (caja.dataset.activa) continue;
      caja.dataset.activa = '1';
      const datos = registro.get(caja.dataset.grafica);
      if (!datos) continue;
      const svg = caja.querySelector('svg');
      if (datos.tipo === 'cruz') {
        const zona = svg.querySelector('.zona');
        const cruz = svg.querySelector('.cruz');
        const punto = svg.querySelector('.cruz-punto');
        const mover = (ev) => {
          if (!datos.puntos.length) return;
          const caja2 = svg.getBoundingClientRect();
          const px = ev.clientX - caja2.left;
          let mejor = datos.puntos[0];
          for (const p of datos.puntos) if (Math.abs(p.x - px) < Math.abs(mejor.x - px)) mejor = p;
          cruz.setAttribute('x1', mejor.x);
          cruz.setAttribute('x2', mejor.x);
          cruz.setAttribute('visibility', 'visible');
          if (punto && mejor.y != null) {
            punto.setAttribute('cx', mejor.x);
            punto.setAttribute('cy', mejor.y);
            punto.setAttribute('visibility', 'visible');
          }
          mostrarTip(mejor.titulo, mejor.filas, caja2.left + mejor.x, caja2.top + (mejor.y != null ? mejor.y : 30));
        };
        zona.addEventListener('pointermove', mover);
        zona.addEventListener('pointerdown', mover);
        zona.addEventListener('pointerleave', ocultarTip);
      } else {
        for (const golpe of svg.querySelectorAll('.golpe')) {
          const ver = () => {
            ocultarTip();
            const g = datos.grupos[Number(golpe.dataset.i)];
            const r = golpe.getBoundingClientRect();
            golpe.classList.add('activo');
            mostrarTip(g.titulo, g.filas, r.left + r.width / 2, r.top + 20);
          };
          golpe.addEventListener('pointerenter', ver);
          golpe.addEventListener('pointerdown', ver);
          golpe.addEventListener('focus', ver);
          golpe.addEventListener('pointerleave', ocultarTip);
          golpe.addEventListener('blur', ocultarTip);
        }
      }
    }
  }

  // Al volver a dibujar la pantalla se olvidan las gráficas que ya no están.
  function limpiar() {
    for (const id of [...registro.keys()]) if (!document.querySelector(`[data-grafica="${id}"]`)) registro.delete(id);
  }

  window.addEventListener('scroll', ocultarTip, true);
  window.Graficas = { lineaMes, columnas, lineas, activar, limpiar, ocultarTip, escala };
})();
