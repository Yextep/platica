package com.platica.app;

import android.Manifest;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
import android.content.res.Configuration;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.util.Log;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.Toast;

import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.FileProvider;
import androidx.core.graphics.Insets;
import androidx.core.util.AtomicFile;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import androidx.webkit.WebViewAssetLoader;

import org.json.JSONObject;

import java.io.ByteArrayInputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.Collections;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public final class MainActivity extends Activity {
    static final String ORIGEN = "https://appassets.androidplatform.net";
    static final String INICIO = ORIGEN + "/assets/web/index.html";
    // Solo se descargan actualizaciones publicadas en las releases del repositorio.
    static final String DESCARGAS = "https://github.com/Yextep/platica/releases/download/";
    private static final int ABRIR_RESPALDO = 52;
    private static final int GUARDAR_ARCHIVO = 53;
    private static final int PEDIR_NOTIFICACIONES = 54;
    private static final int PERMITIR_INSTALAR = 55;
    private static final int MAXIMO_DATOS = 16 * 1024 * 1024;
    private static final int MAXIMO_APK = 150 * 1024 * 1024;

    private final ExecutorService trabajador = Executors.newSingleThreadExecutor();
    private final ExecutorService descargas = Executors.newSingleThreadExecutor();
    private final Object candado = new Object();
    private WebView navegador;
    private FrameLayout contenedor;
    private WebViewAssetLoader cargador;
    boolean paginaLista;
    private ValueCallback<Uri[]> archivoElegido;
    private String archivoPendiente;
    private volatile boolean descargando;
    private File apkPendiente;

    @Override
    protected void onCreate(Bundle estado) {
        super.onCreate(estado);
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        contenedor = new FrameLayout(this);
        ViewCompat.setOnApplyWindowInsetsListener(contenedor, (vista, insets) -> {
            int seguras = WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout();
            Insets barras = insets.getInsets(seguras);
            Insets teclado = insets.getInsets(WindowInsetsCompat.Type.ime());
            vista.setPadding(barras.left, barras.top, barras.right, Math.max(barras.bottom, teclado.bottom));
            // El contenedor ya reservó esas zonas; el WebView recibe cero para no contarlas dos veces.
            return new WindowInsetsCompat.Builder(insets)
                    .setInsets(seguras | WindowInsetsCompat.Type.ime(), Insets.NONE)
                    .setInsetsIgnoringVisibility(seguras, Insets.NONE)
                    .setDisplayCutout(null)
                    .build();
        });

        navegador = new WebView(this);
        navegador.setId(R.id.navegador);
        WebSettings ajustes = navegador.getSettings();
        ajustes.setJavaScriptEnabled(true);
        ajustes.setDomStorageEnabled(true);
        ajustes.setAllowFileAccess(false);
        ajustes.setAllowContentAccess(true);
        ajustes.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        ajustes.setSupportMultipleWindows(false);
        ajustes.setUserAgentString(ajustes.getUserAgentString() + " Platica/" + BuildConfig.VERSION_NAME);
        if (Build.VERSION.SDK_INT >= 33) ajustes.setAlgorithmicDarkeningAllowed(false);
        navegador.addJavascriptInterface(new Puente(), "PlaticaAndroid");

        cargador = new WebViewAssetLoader.Builder()
                .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))
                .build();
        navegador.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView vista, WebResourceRequest pedido) {
                Uri url = pedido.getUrl();
                if (esLocal(url)) return cargador.shouldInterceptRequest(url);
                // La página solo consulta version.json en GitHub; cualquier otro servidor está bloqueado.
                if ("https".equals(url.getScheme()) && "raw.githubusercontent.com".equals(url.getHost())) return null;
                return new WebResourceResponse("text/plain", "UTF-8", 403, "Bloqueado",
                        Collections.emptyMap(), new ByteArrayInputStream(new byte[0]));
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView vista, WebResourceRequest pedido) {
                if (esLocal(pedido.getUrl())) return false;
                abrirFuera(pedido.getUrl());
                return true;
            }

            @Override
            public void onPageFinished(WebView vista, String url) {
                if (esLocal(Uri.parse(url))) paginaLista = true;
            }
        });
        navegador.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView vista, ValueCallback<Uri[]> respuesta, FileChooserParams parametros) {
                if (archivoElegido != null) archivoElegido.onReceiveValue(null);
                archivoElegido = respuesta;
                Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType("*/*");
                try {
                    startActivityForResult(intent, ABRIR_RESPALDO);
                } catch (ActivityNotFoundException exc) {
                    archivoElegido.onReceiveValue(null);
                    archivoElegido = null;
                    avisar("No se pudo abrir el selector de archivos.");
                }
                return true;
            }
        });

        contenedor.addView(navegador, new FrameLayout.LayoutParams(-1, -1));
        setContentView(contenedor);
        aplicarColores();
        ViewCompat.requestApplyInsets(contenedor);
        limpiarActualizacionInstalada();
        navegador.loadUrl(INICIO);
    }

    private boolean esOscuro() {
        return (getResources().getConfiguration().uiMode & Configuration.UI_MODE_NIGHT_MASK)
                == Configuration.UI_MODE_NIGHT_YES;
    }

    // Mismos colores de fondo que la página, para que no haya destellos al abrir.
    private void aplicarColores() {
        boolean oscuro = esOscuro();
        int fondo = Color.parseColor(oscuro ? "#0e1312" : "#f3f5f4");
        contenedor.setBackgroundColor(fondo);
        navegador.setBackgroundColor(fondo);
        WindowInsetsControllerCompat barras = WindowCompat.getInsetsController(getWindow(), contenedor);
        barras.setAppearanceLightStatusBars(!oscuro);
        barras.setAppearanceLightNavigationBars(!oscuro);
    }

    @Override
    public void onWindowFocusChanged(boolean enfoque) {
        super.onWindowFocusChanged(enfoque);
        // Android puede restablecer el color de los íconos de las barras al cambiar de navegación.
        if (enfoque && contenedor != null) aplicarColores();
    }

    static boolean esLocal(Uri url) {
        return url != null && "https".equals(url.getScheme()) && "appassets.androidplatform.net".equals(url.getHost());
    }

    // Enlaces externos (Superfinanciera, Midatacrédito, la descarga en el navegador) se abren fuera de la app.
    private void abrirFuera(Uri url) {
        if (!"https".equals(url.getScheme())) return;
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, url));
        } catch (ActivityNotFoundException exc) {
            avisar("No hay una app para abrir este enlace.");
        }
    }

    private void js(String codigo) {
        runOnUiThread(() -> {
            if (!isDestroyed() && paginaLista) navegador.evaluateJavascript(codigo, null);
        });
    }

    private void estadoDescarga(String estado, String detalle) {
        js("window.Platica && Platica.estadoDescarga(" + JSONObject.quote(estado) + "," + JSONObject.quote(detalle) + ")");
    }

    // ---------- datos ----------
    // Todo lo que registra la persona vive en este archivo del almacenamiento privado de la app.
    private AtomicFile archivoDatos() {
        File carpeta = new File(getFilesDir(), "datos");
        if (!carpeta.isDirectory() && !carpeta.mkdirs()) Log.w("Platica", "No se pudo crear la carpeta de datos");
        return new AtomicFile(new File(carpeta, "platica.json"));
    }

    // ---------- actualizaciones ----------
    private File apkDescargado() {
        return new File(new File(getCacheDir(), "actualizacion"), "Platica.apk");
    }

    private long codigoVersion(PackageInfo info) {
        return Build.VERSION.SDK_INT >= 28 ? info.getLongVersionCode() : info.versionCode;
    }

    // Un APK ya descargado sirve si es de Platica y más nuevo que el instalado.
    private PackageInfo apkValido(File apk) {
        if (!apk.isFile()) return null;
        PackageInfo info = getPackageManager().getPackageArchiveInfo(apk.getPath(), 0);
        if (info == null || !getPackageName().equals(info.packageName)) return null;
        return codigoVersion(info) > BuildConfig.VERSION_CODE ? info : null;
    }

    private void limpiarActualizacionInstalada() {
        File apk = apkDescargado();
        if (apk.exists() && apkValido(apk) == null && !apk.delete()) Log.w("Platica", "No se pudo borrar el APK viejo");
    }

    // Android solo instala encima si la firma coincide; aquí se comprueba antes para dar un mensaje claro.
    // Si el sistema no deja leer alguna de las dos firmas, decide el instalador.
    private boolean firmaDistinta(File apk) {
        if (Build.VERSION.SDK_INT < 28) return false;
        try {
            PackageManager pm = getPackageManager();
            PackageInfo nuevo = pm.getPackageArchiveInfo(apk.getPath(), PackageManager.GET_SIGNING_CERTIFICATES);
            PackageInfo actual = pm.getPackageInfo(getPackageName(), PackageManager.GET_SIGNING_CERTIFICATES);
            if (nuevo == null || nuevo.signingInfo == null || actual.signingInfo == null) return false;
            Signature[] a = actual.signingInfo.getApkContentsSigners();
            Signature[] b = nuevo.signingInfo.getApkContentsSigners();
            if (a == null || b == null || a.length == 0 || b.length == 0) return false;
            return !Arrays.equals(a, b);
        } catch (Exception exc) {
            Log.w("Platica", "No se pudo comparar la firma", exc);
            return false;
        }
    }

    private void descargar(String direccion) {
        File apk = apkDescargado();
        File carpeta = apk.getParentFile();
        File parcial = new File(carpeta, "Platica.apk.part");
        HttpURLConnection conexion = null;
        try {
            if (!carpeta.isDirectory() && !carpeta.mkdirs()) throw new IllegalStateException("Sin espacio para la descarga");
            conexion = (HttpURLConnection) new URL(direccion).openConnection();
            conexion.setInstanceFollowRedirects(true);
            conexion.setConnectTimeout(20000);
            conexion.setReadTimeout(30000);
            conexion.setRequestProperty("User-Agent", "Platica/" + BuildConfig.VERSION_NAME);
            int estado = conexion.getResponseCode();
            String servidor = conexion.getURL().getHost();
            if (estado != 200) throw new IllegalStateException("GitHub respondió " + estado);
            if (!"https".equals(conexion.getURL().getProtocol())
                    || !(servidor.equals("github.com") || servidor.endsWith(".githubusercontent.com"))) {
                throw new IllegalStateException("La descarga terminó en otro servidor");
            }
            long total = conexion.getContentLengthLong();
            if (total > MAXIMO_APK) throw new IllegalStateException("El archivo es demasiado grande");
            long leidos = 0;
            int ultimo = -1;
            try (InputStream entrada = conexion.getInputStream(); OutputStream salida = new FileOutputStream(parcial)) {
                byte[] bloque = new byte[64 * 1024];
                int n;
                while ((n = entrada.read(bloque)) != -1) {
                    leidos += n;
                    if (leidos > MAXIMO_APK) throw new IllegalStateException("El archivo es demasiado grande");
                    salida.write(bloque, 0, n);
                    int porcentaje = total > 0 ? (int) (leidos * 100 / total) : -1;
                    if (porcentaje != ultimo) {
                        ultimo = porcentaje;
                        estadoDescarga("descargando", String.valueOf(porcentaje));
                    }
                }
            }
            if (total > 0 && leidos != total) throw new IllegalStateException("La descarga quedó incompleta");
            if (apk.exists() && !apk.delete()) throw new IllegalStateException("No se pudo reemplazar la descarga anterior");
            if (!parcial.renameTo(apk)) throw new IllegalStateException("No se pudo guardar la descarga");
            runOnUiThread(() -> instalar(apk));
        } catch (Exception exc) {
            Log.w("Platica", "Falló la descarga de la actualización", exc);
            if (parcial.exists() && !parcial.delete()) Log.w("Platica", "No se pudo borrar la descarga parcial");
            estadoDescarga("error", "No se pudo descargar la actualización. Revisa la conexión e inténtalo otra vez.");
        } finally {
            if (conexion != null) conexion.disconnect();
            descargando = false;
        }
    }

    private void instalar(File apk) {
        if (isDestroyed()) return;
        if (apkValido(apk) == null) {
            if (apk.exists() && !apk.delete()) Log.w("Platica", "No se pudo borrar el APK no válido");
            estadoDescarga("error", "El archivo descargado no es una versión más nueva de Platica.");
            return;
        }
        if (firmaDistinta(apk)) {
            if (!apk.delete()) Log.w("Platica", "No se pudo borrar el APK con otra firma");
            estadoDescarga("error", "El archivo descargado no tiene la firma de Platica. No se instaló.");
            return;
        }
        if (Build.VERSION.SDK_INT >= 26 && !getPackageManager().canRequestPackageInstalls()) {
            apkPendiente = apk;
            estadoDescarga("permiso", "");
            try {
                startActivityForResult(new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                        Uri.parse("package:" + getPackageName())), PERMITIR_INSTALAR);
            } catch (ActivityNotFoundException exc) {
                estadoDescarga("error", "Permite a Platica instalar apps desde Ajustes y vuelve a tocar «Actualizar».");
            }
            return;
        }
        apkPendiente = null;
        Uri uri = FileProvider.getUriForFile(this, getPackageName() + ".archivos", apk);
        Intent intent = new Intent(Intent.ACTION_VIEW)
                .setDataAndType(uri, "application/vnd.android.package-archive")
                .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
        try {
            startActivity(intent);
            estadoDescarga("instalando", "");
        } catch (ActivityNotFoundException exc) {
            estadoDescarga("error", "No se encontró el instalador de Android.");
        }
    }

    // Lo que la página puede pedirle a Android.
    public final class Puente {
        @JavascriptInterface
        public String version() {
            return "{\"nombre\":" + JSONObject.quote(BuildConfig.VERSION_NAME) + ",\"codigo\":" + BuildConfig.VERSION_CODE + "}";
        }

        @JavascriptInterface
        public String leerDatos() {
            synchronized (candado) {
                try {
                    AtomicFile archivo = archivoDatos();
                    if (!archivo.getBaseFile().exists()) return "";
                    return new String(archivo.readFully(), StandardCharsets.UTF_8);
                } catch (Exception exc) {
                    // null (y no "") le dice a la página que hay datos que no se pudieron leer: así no los pisa.
                    Log.e("Platica", "No se pudieron leer los datos", exc);
                    return null;
                }
            }
        }

        // Se escribe en otro hilo y en orden de llegada: el último guardado es el que queda.
        @JavascriptInterface
        public void guardarDatos(String json) {
            if (json == null || json.isEmpty() || json.length() > MAXIMO_DATOS) return;
            trabajador.execute(() -> {
                synchronized (candado) {
                    AtomicFile archivo = archivoDatos();
                    FileOutputStream salida = null;
                    try {
                        salida = archivo.startWrite();
                        salida.write(json.getBytes(StandardCharsets.UTF_8));
                        archivo.finishWrite(salida);
                    } catch (Exception exc) {
                        if (salida != null) archivo.failWrite(salida);
                        Log.e("Platica", "No se pudieron guardar los datos", exc);
                        runOnUiThread(() -> avisar("No se pudieron guardar los cambios. Revisa el espacio del teléfono."));
                    }
                }
            });
        }

        @JavascriptInterface
        public void guardarArchivo(String nombre, String tipo, String contenido) {
            if (contenido == null || contenido.length() > MAXIMO_DATOS) return;
            String mime = "text/csv".equals(tipo) ? "text/csv" : "application/json";
            String titulo = nombre != null && nombre.matches("[A-Za-z0-9._-]{1,80}") ? nombre : "Platica-respaldo.json";
            runOnUiThread(() -> {
                if (isDestroyed()) return;
                archivoPendiente = contenido;
                Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType(mime);
                intent.putExtra(Intent.EXTRA_TITLE, titulo);
                try {
                    startActivityForResult(intent, GUARDAR_ARCHIVO);
                } catch (ActivityNotFoundException exc) {
                    archivoPendiente = null;
                    avisar("No se pudo abrir el selector para guardar el archivo.");
                }
            });
        }

        @JavascriptInterface
        public void compartir(String texto) {
            if (texto == null || texto.isEmpty() || texto.length() > 20000) return;
            runOnUiThread(() -> {
                Intent intent = new Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, texto);
                try {
                    startActivity(Intent.createChooser(intent, "Compartir resumen"));
                } catch (ActivityNotFoundException exc) {
                    avisar("No hay una app para compartir.");
                }
            });
        }

        @JavascriptInterface
        public String permisoNotificaciones() {
            if (NotificationManagerCompat.from(MainActivity.this).areNotificationsEnabled()) return "concedido";
            if (Build.VERSION.SDK_INT >= 33
                    && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                return "preguntar";
            }
            return "denegado";
        }

        @JavascriptInterface
        public void pedirNotificaciones() {
            runOnUiThread(() -> {
                if (Build.VERSION.SDK_INT >= 33
                        && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                    requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, PEDIR_NOTIFICACIONES);
                } else if (!NotificationManagerCompat.from(MainActivity.this).areNotificationsEnabled()) {
                    // Las notificaciones están apagadas en Ajustes: se abre la pantalla de la app.
                    Intent intent = new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS)
                            .putExtra(Settings.EXTRA_APP_PACKAGE, getPackageName());
                    try {
                        startActivity(intent);
                    } catch (ActivityNotFoundException exc) {
                        avisar("Activa las notificaciones de Platica en Ajustes.");
                    }
                } else {
                    js("window.Platica && Platica.permisoNotificaciones('concedido')");
                }
            });
        }

        @JavascriptInterface
        public void programarRecordatorios(String json) {
            if (json == null || json.length() > 200000) return;
            trabajador.execute(() -> Recordatorios.guardar(MainActivity.this, json));
        }

        @JavascriptInterface
        public void descargarActualizacion(String direccion) {
            if (direccion == null || !direccion.startsWith(DESCARGAS) || !direccion.endsWith(".apk")
                    || direccion.contains("..") || direccion.contains("?") || direccion.contains("#")) {
                estadoDescarga("error", "La dirección de la actualización no es de las releases de Platica.");
                return;
            }
            // Si ya se descargó (por ejemplo, antes de dar el permiso de instalar), se instala sin bajarla otra vez.
            File apk = apkDescargado();
            if (apkValido(apk) != null) {
                runOnUiThread(() -> instalar(apk));
                return;
            }
            if (descargando) return;
            descargando = true;
            estadoDescarga("descargando", "0");
            descargas.execute(() -> descargar(direccion));
        }
    }

    @Override
    public void onRequestPermissionsResult(int pedido, String[] permisos, int[] resultados) {
        super.onRequestPermissionsResult(pedido, permisos, resultados);
        if (pedido != PEDIR_NOTIFICACIONES) return;
        boolean concedido = NotificationManagerCompat.from(this).areNotificationsEnabled();
        js("window.Platica && Platica.permisoNotificaciones(" + JSONObject.quote(concedido ? "concedido" : "denegado") + ")");
    }

    @Override
    protected void onActivityResult(int pedido, int resultado, Intent datos) {
        super.onActivityResult(pedido, resultado, datos);
        Uri elegido = resultado == RESULT_OK && datos != null ? datos.getData() : null;
        if (pedido == ABRIR_RESPALDO && archivoElegido != null) {
            archivoElegido.onReceiveValue(elegido == null ? null : new Uri[]{elegido});
            archivoElegido = null;
        } else if (pedido == GUARDAR_ARCHIVO) {
            String contenido = archivoPendiente;
            archivoPendiente = null;
            if (elegido == null || contenido == null) return;
            trabajador.execute(() -> {
                try (OutputStream salida = getContentResolver().openOutputStream(elegido, "wt")) {
                    if (salida == null) throw new IllegalStateException("No se pudo abrir el archivo");
                    salida.write(contenido.getBytes(StandardCharsets.UTF_8));
                    js("window.Platica && Platica.archivoGuardado()");
                } catch (Exception exc) {
                    Log.e("Platica", "No se pudo guardar el archivo", exc);
                    runOnUiThread(() -> avisar("No se pudo guardar el archivo. Vuelve a intentarlo."));
                }
            });
        } else if (pedido == PERMITIR_INSTALAR) {
            File apk = apkPendiente;
            if (apk == null) return;
            if (Build.VERSION.SDK_INT >= 26 && getPackageManager().canRequestPackageInstalls()) instalar(apk);
            else estadoDescarga("error", "Sin ese permiso Platica no puede instalar la versión nueva. También puedes descargarla en el navegador.");
        }
    }

    private void avisar(String mensaje) {
        if (!isDestroyed()) Toast.makeText(this, mensaje, Toast.LENGTH_LONG).show();
    }

    // Atrás cierra primero la ventana abierta; en la pantalla de inicio, sale de la app.
    @Override
    public void onBackPressed() {
        if (archivoElegido != null) {
            archivoElegido.onReceiveValue(null);
            archivoElegido = null;
            return;
        }
        if (!paginaLista) {
            super.onBackPressed();
            return;
        }
        navegador.evaluateJavascript("window.Platica ? Platica.atras() : false", valor -> {
            if (!"true".equals(valor) && !isFinishing()) super.onBackPressed();
        });
    }

    @Override
    protected void onResume() {
        super.onResume();
        navegador.onResume();
        // Al volver de Ajustes o de otra app, la página revisa permisos y recordatorios.
        js("window.Platica && Platica.alVolver()");
    }

    @Override
    protected void onPause() {
        js("window.Platica && Platica.guardarYa()");
        navegador.onPause();
        super.onPause();
    }

    @Override
    protected void onDestroy() {
        if (archivoElegido != null) archivoElegido.onReceiveValue(null);
        navegador.removeJavascriptInterface("PlaticaAndroid");
        navegador.destroy();
        trabajador.shutdown();
        descargas.shutdownNow();
        super.onDestroy();
    }
}
