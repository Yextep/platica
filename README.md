# Platica

App Android para llevar el control de tu plata en Colombia: registra tus gastos del día a día por categorías, anota lo que recibes cada mes, mira un resumen mensual con gráficas y recomendaciones, y lleva tus deudas y tu vida crediticia (puntaje, diagnóstico de Midatacrédito, simuladores y un plan para mejorar).

Autor: Daniel Lezcano (Yextep).

## Instalar

Descarga `Platica.apk` desde las [releases](https://github.com/Yextep/platica/releases/latest) e instálalo. Requiere Android 7.0 o posterior. Todas las versiones se firman con la misma clave, así que cada versión nueva se instala encima de la anterior sin perder datos.

La 1.1 corrige un error de la 1.0: al tocar un campo, el teclado se abría y se cerraba enseguida y no dejaba escribir. Como la 1.0 no se puede usar, la 1.1 se publicó como obligatoria: al abrir la 1.0 aparece directamente la pantalla para actualizar.

Desde la 1.0, Platica avisa sola cuando hay una versión nueva: al abrirse consulta [`version.json`](version.json) y, si hay una más reciente, muestra «Platica X está disponible» con **Actualizar ahora**, **Descargar en el navegador** y **Más tarde**. «Actualizar ahora» descarga el APK de la release dentro de la app, comprueba que sea de Platica y abre el instalador de Android (la primera vez Android pide permitir que Platica instale apps). Si eliges «Más tarde», no vuelve a preguntar en tres días, pero la pestaña Más queda marcada con un punto.

## Funciones

- **Gastos en segundos**: valor, categoría y listo. Categorías incluidas: Servicios, Imprevistos, Gastos personales, Deudas, Arriendo, Salud y Comida. Con «Otra» creas las tuyas (hay sugerencias como Transporte, Educación, Mascotas o Ropa). Opcionalmente: fecha, medio de pago (efectivo, débito, crédito, Nequi, Daviplata, transferencia) y una nota.
- **Ingresos de cada mes**: al empezar marcas si tienes un **salario fijo**.
  - Con salario fijo, la app lo cuenta sola cada mes. Las primas, bonos u horas extra se agregan como ingresos extra, y un mes puntual con otro valor (por ejemplo, una incapacidad) se ajusta con «Este mes recibí otro valor».
  - Sin salario fijo (ingresos variables), cada mes anotas lo que de verdad recibiste, en uno o varios pagos. Mientras el mes siga sin ingresos, la app lo recuerda en Inicio y con notificaciones.
  - Cambiar de salario o de modalidad en Más → Tu perfil cuenta desde ese mes; los meses anteriores conservan lo que tenían. Si cambias a mitad de mes, la app pregunta qué hacer con lo ya anotado para no contar el salario dos veces.
- **Inicio**: cuánto te queda, qué parte de tus ingresos ya gastaste, la línea del gasto acumulado contra tus ingresos con la proyección al cierre del mes, el gasto por categoría, la regla 50/30/20, las próximas cuotas y los últimos seis meses.
- **Resumen mensual**: el día 1 de cada mes Platica muestra el resumen del mes anterior (y lo deja disponible siempre): ingresos, gastos, ahorro, cada categoría frente al mes anterior, los gastos más grandes, gastos hormiga y recomendaciones. Se puede compartir.
- **Recomendaciones**: déficit, ritmo de gasto, ahorro, arriendo por encima del 30%, carga de deudas por encima del 30% o 40% de los ingresos, comida, gastos personales, imprevistos (fondo de emergencia), gastos hormiga, límites por categoría, subidas frente a meses anteriores y uso de la tarjeta de crédito.
- **Límites por categoría**: avisan al 80% y cuando se pasan.
- **Deudas**: tarjetas, rotativos, libre inversión, libranza, vehículo, educativo, hipotecario, almacenes y cooperativas, celular a plazos y préstamos de conocidos. Con saldo, cupo o valor inicial, cuota, tasa (E.A. o M.V.), día de pago, apertura, plazo, mora y si eres codeudor. Calcula la deuda total por tipo (como el reporte de Midatacrédito), la carga sobre tus ingresos, el uso de tus tarjetas, cuándo terminas cada deuda, cuántos intereses pagas y cuánto ahorras con un abono extra.
- **Pagos**: registrar el pago de una deuda lo deja en los gastos del mes (categoría Deudas) y baja el saldo, separando interés y capital. El saldo nuevo se puede corregir con el que muestra el banco.
- **Plan para salir de deudas**: avalancha (primero la tasa más alta) o bola de nieve (primero la más pequeña), con abono extra mensual, orden de pago, fecha en que quedas libre, intereses y gráfica frente a pagar solo cuotas.
- **Mi crédito**: historial del puntaje con la escala de Midatacrédito (0 a 1.000), el diagnóstico en sus cuatro factores (hábitos de pago, endeudamiento, experiencia crediticia y estado del portafolio) según el reporte y según las deudas de hoy, y un plan para subir el puntaje ordenado por impacto.
- **Simuladores**: puntaje (qué pasa si bajas el uso de tus tarjetas, pagas una deuda, abres un crédito o te atrasas), capacidad de endeudamiento con viabilidad por tipo de crédito, y calculadora de cuotas con tabla de pagos.
- **Tasa de usura**: aviso si una deuda o simulación la supera. Se actualiza sola desde `version.json`.
- **Aprende**: cómo funciona el puntaje, tarjetas, reportes negativos (Ley 1266 de 2008 y Ley 2157 de 2021), tasas E.A. y M.V., cómo salir de deudas, presupuesto 50/30/20 y codeudores.
- **Recordatorios**: cuotas por vencer (dos días antes y el día del pago), registro diario de gastos a la hora que elijas y resumen del mes, aunque la app esté cerrada.
- **Respaldo**: guardar y restaurar un archivo `.json` con todo y exportar gastos e ingresos a Excel (`.csv`).
- Tema claro u oscuro según el teléfono.

Los cálculos del puntaje son orientativos: Datacrédito y TransUnion no publican su fórmula.

## Privacidad

Todo se guarda solo en el teléfono, en el almacenamiento privado de la app (`files/datos/platica.json`). No hay cuentas ni servidores. La página de la app solo puede conectarse a `raw.githubusercontent.com` (para `version.json`); cualquier otro servidor está bloqueado. La descarga de una actualización solo acepta APK de las releases de este repositorio.

Desinstalar la app o borrar sus datos elimina todo, así que guarda un respaldo de vez en cuando.

## Estructura

- `app/src/main/assets/web/`: la interfaz (HTML, CSS y JavaScript sin librerías).
  - `motor.js`: cálculos (resúmenes, recomendaciones, deudas, crédito, simuladores, recordatorios). No usa la página, así que se prueba con Node.
  - `graficas.js`: gráficas en SVG con tooltip.
  - `app.js`: pantallas, formularios, aviso de versión y respaldo.
- `app/src/main/java/com/platica/app/MainActivity.java`: el WebView, los datos, el respaldo, la descarga e instalación de actualizaciones.
- `app/src/main/java/com/platica/app/Recordatorios.java`: las notificaciones programadas.
- `pruebas/motor.test.cjs`: pruebas de los cálculos.
- `scripts/prueba_navegador.cjs`: recorrido de la interfaz en Chromium con capturas en `docs/`.
- `version.json` y `scripts/publicar_version.py`: el aviso de versión nueva.

## Compilar y probar

GitHub Actions compila con cada cambio en `main` ([Compilar Platica](.github/workflows/platica-apk.yml)):

1. `node --test pruebas/` prueba los cálculos.
2. `scripts/prueba_navegador.cjs` recorre la interfaz en Chromium con tamaño de celular: escribir con el teclado abierto (que encoge la pantalla), bienvenida con salario fijo e ingresos variables, gastos, categoría propia, ingresos, movimientos, deudas, pagos, plan de pagos, puntaje, reporte, diagnóstico, simuladores, resumen mensual, recordatorios, respaldo, exportación, modo oscuro y el aviso de versión nueva (normal, pospuesto y obligatorio).
3. Compila el APK y ejecuta `PlaticaSmokeTest` en un emulador Android 15: tocar los campos y escribir con el teclado de Android sin que se cierre, gasto guardado entre aperturas, aviso de versión nueva, descargas solo desde las releases, bloqueo de servidores y notificación de un recordatorio.
4. Firma `Platica.apk` y guarda el APK, los resultados y las capturas como artefactos.

En un equipo con Node y Playwright:

```sh
node --test pruebas/
node scripts/prueba_navegador.cjs
```

## Publicar una versión nueva

1. Sube `versionCode` (un número entero, siempre mayor) y `versionName` en `app/build.gradle`, y haz push a `main`.
2. Espera a que «Compilar Platica» termine en verde y anota el número de la ejecución.
3. Publícala:

   ```sh
   python scripts/publicar_version.py publicar RUN_ID --notas "Qué cambió, en una o dos frases"
   git pull
   ```

   El script comprueba que el APK tenga la firma de Platica, crea la release `vX.Y` con `Platica.apk` y cambia `version.json`. Desde ese momento, las apps instaladas muestran el aviso la próxima vez que se abran. Con `--guardar CARPETA` deja también una copia del APK en esa carpeta.

Otras órdenes: `estado` muestra el `version.json` publicado; `obligatoria` exige la última versión (las anteriores muestran solo el aviso, sin «Más tarde», hasta actualizar; desde ahí se puede guardar un respaldo) y `opcional` quita esa exigencia. `--obligatoria` al publicar hace lo mismo en un paso. `usura 28.59 2026-10` publica la tasa de usura del mes.

| Campo de `version.json` | Efecto en las apps instaladas |
|---|---|
| `version`, `codigo` | Última versión publicada. Si `codigo` es mayor que el `versionCode` instalado, aparece el aviso. |
| `apk` | Descarga de esa versión. Solo se aceptan enlaces a las releases de este repositorio. |
| `notas` | Novedades que se muestran en el aviso. |
| `codigo_minimo` | Las versiones con un código menor quedan en el aviso hasta actualizar. |
| `usura` | Tasa de usura (`ea`, % E.A.) y su mes (`vigencia`). La app la toma si es más reciente que la que tiene. |

La dirección de `version.json` va dentro de cada APK instalado: el repositorio debe seguir siendo público y conservar su nombre, y el archivo su ruta.

## Licencia

El código de Platica se publica bajo la [PolyForm Noncommercial 1.0.0 con la Commons Clause](LICENSE): puedes usarlo, estudiarlo y modificarlo sin fines comerciales, siempre que conserves el aviso de autoría de Daniel Lezcano (Yextep) y la licencia completa. No se permite venderlo ni ofrecer un producto o servicio pago basado en él.
