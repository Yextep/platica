package com.platica.app;

import android.app.Notification;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.ParcelFileDescriptor;
import android.service.notification.StatusBarNotification;
import android.webkit.WebView;

import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.test.core.app.ActivityScenario;
import androidx.test.core.app.ApplicationProvider;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;

import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.InputStream;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertTrue;
import static org.junit.Assert.fail;

@RunWith(AndroidJUnit4.class)
public class PlaticaSmokeTest {
    private static final String LISTO = "!!(window.Platica && Platica.listo)";

    private String evaluar(ActivityScenario<MainActivity> escenario, String codigo) throws Exception {
        CountDownLatch listo = new CountDownLatch(1);
        AtomicReference<String> resultado = new AtomicReference<>("");
        escenario.onActivity(actividad -> {
            WebView vista = actividad.findViewById(R.id.navegador);
            vista.evaluateJavascript(codigo, valor -> {
                resultado.set(valor);
                listo.countDown();
            });
        });
        assertTrue("El WebView no respondió", listo.await(15, TimeUnit.SECONDS));
        return resultado.get();
    }

    private boolean esperar(ActivityScenario<MainActivity> escenario, String condicion, int segundos) throws Exception {
        for (int intento = 0; intento < segundos * 2; intento++) {
            if ("true".equals(evaluar(escenario, condicion))) return true;
            Thread.sleep(500);
        }
        return false;
    }

    private void exigir(ActivityScenario<MainActivity> escenario, String condicion) throws Exception {
        if (!esperar(escenario, condicion, 40)) fail("No se cumplió: " + condicion);
    }

    private String shell(String comando) throws Exception {
        ParcelFileDescriptor descriptor = InstrumentationRegistry.getInstrumentation().getUiAutomation().executeShellCommand(comando);
        try (InputStream entrada = new ParcelFileDescriptor.AutoCloseInputStream(descriptor);
             ByteArrayOutputStream salida = new ByteArrayOutputStream()) {
            byte[] bloque = new byte[4096];
            int leidos;
            while ((leidos = entrada.read(bloque)) != -1) salida.write(bloque, 0, leidos);
            return salida.toString("UTF-8");
        }
    }

    private void captura(String nombre) throws Exception {
        InstrumentationRegistry.getInstrumentation().waitForIdleSync();
        Thread.sleep(1200);
        shell("screencap -p /sdcard/Download/platica-android-" + nombre + ".png");
    }

    private static File archivoDatos() {
        Context contexto = ApplicationProvider.getApplicationContext();
        return new File(new File(contexto.getFilesDir(), "datos"), "platica.json");
    }

    // Cada prueba empieza como una instalación nueva: sin datos guardados.
    @Before
    public void borrarDatos() {
        File archivo = archivoDatos();
        // AtomicFile usa archivos auxiliares .new y .bak mientras escribe.
        for (File f : new File[]{archivo, new File(archivo.getPath() + ".new"), new File(archivo.getPath() + ".bak")}) {
            if (f.exists()) assertTrue(f.delete());
        }
    }

    private void configurar(ActivityScenario<MainActivity> escenario) throws Exception {
        exigir(escenario, LISTO + " && Platica.vista() === 'bienvenida'");
        evaluar(escenario, "document.querySelector('[data-accion=bienvenida-siguiente]').click()");
        exigir(escenario, "!!document.querySelector('#b-salario')");
        evaluar(escenario, "document.querySelector('#b-nombre').value = 'Daniel';"
                + "document.querySelector('#b-fijo').click();"
                + "document.querySelector('#b-salario').value = '2000000';"
                + "document.querySelector('#form-bienvenida').requestSubmit()");
        exigir(escenario, "Platica.vista() === 'inicio' && Platica.estado().perfil.periodos[0].monto === 2000000");
    }

    private JSONObject centro(ActivityScenario<MainActivity> escenario, String selector, boolean desplazar) throws Exception {
        String valor = evaluar(escenario, "(() => { const e = document.querySelector(" + JSONObject.quote(selector) + ");"
                + (desplazar ? " e.scrollIntoView({block: 'center'});" : "") + " const r = e.getBoundingClientRect();"
                + " return JSON.stringify({x: r.left + r.width / 2, y: r.top + r.height / 2, d: window.devicePixelRatio}); })()");
        return new JSONObject(new JSONArray("[" + valor + "]").getString(0));
    }

    // Toca un elemento de la página como lo haría un dedo: así Android abre el teclado de verdad.
    // Al abrirse o cerrarse el teclado la página se acomoda; se toca solo cuando el elemento ya no se mueve.
    private void tocar(ActivityScenario<MainActivity> escenario, String selector) throws Exception {
        JSONObject punto = centro(escenario, selector, true);
        for (int intento = 0; intento < 12; intento++) {
            Thread.sleep(250);
            JSONObject otra = centro(escenario, selector, false);
            boolean quieto = Math.abs(otra.getDouble("x") - punto.getDouble("x")) < 1 && Math.abs(otra.getDouble("y") - punto.getDouble("y")) < 1;
            punto = otra;
            if (quieto) break;
        }
        int[] origen = new int[2];
        escenario.onActivity(actividad -> actividad.findViewById(R.id.navegador).getLocationOnScreen(origen));
        long x = Math.round(origen[0] + punto.getDouble("x") * punto.getDouble("d"));
        long y = Math.round(origen[1] + punto.getDouble("y") * punto.getDouble("d"));
        shell("input tap " + x + " " + y);
    }

    private boolean tecladoVisible(ActivityScenario<MainActivity> escenario) {
        AtomicBoolean visible = new AtomicBoolean(false);
        escenario.onActivity(actividad -> {
            WindowInsetsCompat insets = ViewCompat.getRootWindowInsets(actividad.getWindow().getDecorView());
            visible.set(insets != null && insets.isVisible(WindowInsetsCompat.Type.ime()));
        });
        return visible.get();
    }

    private boolean esperarTeclado(ActivityScenario<MainActivity> escenario, int segundos) throws Exception {
        for (int i = 0; i < segundos * 4; i++) {
            if (tecladoVisible(escenario)) return true;
            Thread.sleep(250);
        }
        return false;
    }

    // En el emulador de GitHub a veces queda encima un aviso del sistema («Pixel Launcher isn't responding»)
    // que se queda con los toques: se espera a que la ventana de la app tenga el foco.
    private void esperarVentana(ActivityScenario<MainActivity> escenario) throws Exception {
        for (int i = 0; i < 30; i++) {
            AtomicBoolean foco = new AtomicBoolean(false);
            escenario.onActivity(actividad -> foco.set(actividad.hasWindowFocus()));
            if (foco.get()) return;
            shell("am broadcast -a android.intent.action.CLOSE_SYSTEM_DIALOGS");
            Thread.sleep(1000);
        }
        fail("Una ventana del sistema sigue encima de la app");
    }

    // Toca un campo como una persona: si el emulador no abre el teclado al primer toque, lo vuelve a tocar.
    private void tocarCampo(ActivityScenario<MainActivity> escenario, String id) throws Exception {
        for (int intento = 0; intento < 3; intento++) {
            esperarVentana(escenario);
            tocar(escenario, "#" + id);
            if (esperar(escenario, "!!document.activeElement && document.activeElement.id === '" + id + "'", 5)
                    && esperarTeclado(escenario, 8)) return;
        }
        fail("No se abrió el teclado al tocar #" + id);
    }

    // En la 1.0, al abrirse el teclado la página se redibujaba, el campo perdía el foco y el teclado se cerraba enseguida.
    @Test
    public void escribeConElTecladoSinQueSeCierre() throws Exception {
        shell("settings put secure show_ime_with_hard_keyboard 1");
        // El lanzador del emulador suele quedarse sin responder y su aviso tapa la app; durante la prueba no hace falta.
        shell("am force-stop com.google.android.apps.nexuslauncher");
        shell("am force-stop com.android.launcher3");
        shell("am broadcast -a android.intent.action.CLOSE_SYSTEM_DIALOGS");
        Thread.sleep(2000);
        try (ActivityScenario<MainActivity> escenario = ActivityScenario.launch(MainActivity.class)) {
            exigir(escenario, LISTO + " && Platica.vista() === 'bienvenida'");
            evaluar(escenario, "document.querySelector('[data-accion=bienvenida-siguiente]').click()");
            exigir(escenario, "!!document.querySelector('#b-nombre')");
            tocarCampo(escenario, "b-nombre");
            // En la 1.0 el teclado se cerraba a los pocos milisegundos de abrirse.
            Thread.sleep(1500);
            assertTrue("El teclado se cerró solo", tecladoVisible(escenario));
            assertEquals("\"b-nombre\"", evaluar(escenario, "document.activeElement.id"));
            shell("input text Daniel");
            exigir(escenario, "document.querySelector('#b-nombre').value === 'Daniel'");
            captura("teclado");

            tocar(escenario, "#b-fijo");
            exigir(escenario, "document.querySelector('#b-fijo').checked && !document.querySelector('#b-campo-salario').hidden");
            tocarCampo(escenario, "b-salario");
            shell("input text 2500000");
            exigir(escenario, "document.querySelector('#b-salario').value === '$2.500.000'");
            Thread.sleep(1000);
            assertTrue("El teclado se cerró mientras se escribía el salario", tecladoVisible(escenario));
            assertEquals("\"b-salario\"", evaluar(escenario, "document.activeElement.id"));
            evaluar(escenario, "document.querySelector('#form-bienvenida').requestSubmit()");
            exigir(escenario, "Platica.vista() === 'inicio' && Platica.estado().perfil.periodos[0].tipo === 'fijo'"
                    + " && Platica.estado().perfil.periodos[0].monto === 2500000 && Platica.estado().perfil.nombre === 'Daniel'");

            // Un gasto escrito con el teclado.
            exigir(escenario, "!document.body.classList.contains('teclado')");
            esperarVentana(escenario);
            tocar(escenario, "#agregar");
            exigir(escenario, "Platica.vista() === 'gasto' && !!document.querySelector('#g-monto')");
            tocarCampo(escenario, "g-monto");
            shell("input text 45000");
            exigir(escenario, "document.querySelector('#g-monto').value === '$45.000'");
            Thread.sleep(800);
            assertEquals("\"g-monto\"", evaluar(escenario, "document.activeElement.id"));
            tocar(escenario, "[data-cat=comida]");
            exigir(escenario, "document.querySelector('[data-cat=comida]').getAttribute('aria-pressed') === 'true'");
            // Se cierra el teclado y se espera a que la página termine de acomodarse antes de tocar «Guardar».
            evaluar(escenario, "document.activeElement && document.activeElement.blur()");
            for (int i = 0; i < 40 && tecladoVisible(escenario); i++) Thread.sleep(250);
            exigir(escenario, "!document.body.classList.contains('teclado')");
            tocar(escenario, "#form-gasto button[type=submit]");
            exigir(escenario, "Platica.vista() === 'inicio' && Platica.estado().gastos.length === 1 && Platica.estado().gastos[0].monto === 45000");
        }
    }

    @Test
    public void registraUnGastoYLoConservaAlVolverAAbrir() throws Exception {
        try (ActivityScenario<MainActivity> escenario = ActivityScenario.launch(MainActivity.class)) {
            configurar(escenario);
            evaluar(escenario, "document.querySelector('#agregar').click()");
            exigir(escenario, "Platica.vista() === 'gasto'");
            evaluar(escenario, "const m = document.querySelector('#g-monto'); m.value = '45000'; m.dispatchEvent(new Event('input', {bubbles: true}));"
                    + "document.querySelector('[data-cat=comida]').click();"
                    + "document.querySelector('#g-nota').value = 'Mercado'");
            captura("gasto");
            evaluar(escenario, "document.querySelector('#form-gasto').requestSubmit()");
            exigir(escenario, "Platica.vista() === 'inicio' && Platica.estado().gastos.length === 1");
            assertEquals("45000", evaluar(escenario, "Platica.estado().gastos[0].monto"));
            captura("inicio");
        }
        // Los datos quedan en el almacenamiento privado de la app.
        for (int i = 0; i < 20 && !archivoDatos().exists(); i++) Thread.sleep(250);
        assertTrue("No se escribió el archivo de datos", archivoDatos().exists());
        try (ActivityScenario<MainActivity> escenario = ActivityScenario.launch(MainActivity.class)) {
            exigir(escenario, LISTO);
            assertEquals("\"inicio\"", evaluar(escenario, "Platica.vista()"));
            assertEquals("\"Mercado\"", evaluar(escenario, "Platica.estado().gastos[0].nota"));
            assertEquals("\"Daniel\"", evaluar(escenario, "Platica.estado().perfil.nombre"));
        }
    }

    @Test
    public void avisaDeUnaVersionNueva() throws Exception {
        try (ActivityScenario<MainActivity> escenario = ActivityScenario.launch(MainActivity.class)) {
            configurar(escenario);
            // Primero termina la consulta real a version.json, para que no pise el manifiesto de prueba.
            exigir(escenario, "Platica.versionRevisada()");
            assertEquals("\"" + BuildConfig.VERSION_NAME + "\"", evaluar(escenario, "Platica.versionApp().nombre"));
            assertEquals(String.valueOf(BuildConfig.VERSION_CODE), evaluar(escenario, "Platica.versionApp().codigo"));
            assertEquals("true", evaluar(escenario, "Platica.probarManifiesto({version: '9.9', codigo: 999, "
                    + "apk: 'https://github.com/Yextep/platica/releases/download/v9.9/Platica.apk', notas: 'Versión de prueba.'})"));
            exigir(escenario, "Platica.vista() === 'version' && !!document.querySelector('a[href$=\"/v9.9/Platica.apk\"]')");
            captura("actualizacion");
            escenario.onActivity(MainActivity::onBackPressed);
            exigir(escenario, "Platica.vista() === 'inicio' && !!document.querySelector('#pestanas .con-novedad')");
            escenario.onActivity(actividad -> assertFalse(actividad.isFinishing()));
        }
    }

    @Test
    public void soloDescargaActualizacionesDeLasReleases() throws Exception {
        try (ActivityScenario<MainActivity> escenario = ActivityScenario.launch(MainActivity.class)) {
            exigir(escenario, LISTO);
            evaluar(escenario, "PlaticaAndroid.descargarActualizacion('https://example.com/Platica.apk')");
            exigir(escenario, "Platica.descarga().estado === 'error'");
            evaluar(escenario, "PlaticaAndroid.descargarActualizacion('https://github.com/Yextep/platica/releases/download/../x.apk')");
            exigir(escenario, "Platica.descarga().estado === 'error' && /releases de Platica/.test(Platica.descarga().detalle)");
        }
    }

    @Test
    public void bloqueaServidoresNoPermitidos() throws Exception {
        try (ActivityScenario<MainActivity> escenario = ActivityScenario.launch(MainActivity.class)) {
            exigir(escenario, LISTO);
            evaluar(escenario, "fetch('https://example.com/').then(r => window.__prueba = 'status ' + r.status, () => window.__prueba = 'bloqueado')");
            exigir(escenario, "!!window.__prueba");
            assertEquals("\"bloqueado\"", evaluar(escenario, "window.__prueba"));
        }
    }

    @Test
    public void muestraLosRecordatoriosProgramados() throws Exception {
        shell("pm grant com.platica.app android.permission.POST_NOTIFICATIONS");
        Context contexto = ApplicationProvider.getApplicationContext();
        long ahora = System.currentTimeMillis();
        JSONArray lista = new JSONArray()
                .put(new JSONObject().put("id", "prueba-ya").put("cuando", ahora + 1500)
                        .put("titulo", "Hoy vence la cuota de Prueba").put("texto", "Págala hoy por $60.000."))
                .put(new JSONObject().put("id", "prueba-luego").put("cuando", ahora + 3600000)
                        .put("titulo", "Se acerca la cuota de Prueba").put("texto", "Vence en dos días."));
        Recordatorios.guardar(contexto, lista.toString());
        Intent intento = new Intent(contexto, Recordatorios.class).setAction(Recordatorios.ACCION);
        assertNotNull("No quedó programada la alarma", PendingIntent.getBroadcast(contexto, 0, intento,
                PendingIntent.FLAG_NO_CREATE | PendingIntent.FLAG_IMMUTABLE));
        Thread.sleep(2000);
        // Lo mismo que hace Android cuando suena la alarma.
        new Recordatorios().onReceive(contexto, new Intent(Recordatorios.ACCION));
        NotificationManager gestor = contexto.getSystemService(NotificationManager.class);
        boolean vista = false;
        for (int i = 0; i < 10 && !vista; i++) {
            for (StatusBarNotification n : gestor.getActiveNotifications()) {
                if ("Hoy vence la cuota de Prueba".equals(n.getNotification().extras.getString(Notification.EXTRA_TITLE))) vista = true;
            }
            if (!vista) Thread.sleep(300);
        }
        assertTrue("No apareció la notificación del recordatorio", vista);
        String guardada = contexto.getSharedPreferences("recordatorios", Context.MODE_PRIVATE).getString("lista", "");
        assertTrue("El aviso futuro debe seguir pendiente", guardada.contains("prueba-luego") && !guardada.contains("prueba-ya"));
        gestor.cancelAll();
        Recordatorios.guardar(contexto, "[]");
    }
}
