package com.platica.app;

import android.app.Notification;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.ParcelFileDescriptor;
import android.service.notification.StatusBarNotification;
import android.webkit.WebView;

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
        exigir(escenario, "!!document.querySelector('#b-ingreso')");
        evaluar(escenario, "document.querySelector('#b-nombre').value = 'Daniel';"
                + "document.querySelector('#b-ingreso').value = '2000000';"
                + "document.querySelector('#form-bienvenida').requestSubmit()");
        exigir(escenario, "Platica.vista() === 'inicio' && Platica.estado().perfil.ingresoBase === 2000000");
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
