package com.platica.app;

import android.Manifest;
import android.app.AlarmManager;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.os.Build;
import android.util.Log;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;

/**
 * Avisos que la página calcula (cuotas por vencer, registro diario, resumen del mes) y Android muestra
 * aunque la app esté cerrada. Se guarda la lista y se programa una sola alarma: la del próximo aviso.
 */
public final class Recordatorios extends BroadcastReceiver {
    static final String CANAL = "recordatorios";
    static final String ACCION = "com.platica.app.RECORDAR";
    private static final String PREFERENCIAS = "recordatorios";
    private static final int MAXIMO = 300;
    // Un aviso que se perdió (teléfono apagado) se muestra si no pasaron más de 12 horas.
    private static final long VIGENCIA = 12L * 60 * 60 * 1000;

    static synchronized void guardar(Context contexto, String json) {
        try {
            JSONArray entrada = new JSONArray(json);
            JSONArray lista = new JSONArray();
            long ahora = System.currentTimeMillis();
            for (int i = 0; i < entrada.length() && lista.length() < MAXIMO; i++) {
                JSONObject aviso = entrada.optJSONObject(i);
                if (aviso == null) continue;
                long cuando = aviso.optLong("cuando", 0);
                String titulo = aviso.optString("titulo", "").trim();
                String texto = aviso.optString("texto", "").trim();
                if (cuando <= ahora - 60000 || titulo.isEmpty()) continue;
                JSONObject limpio = new JSONObject();
                limpio.put("id", aviso.optString("id", String.valueOf(cuando)));
                limpio.put("cuando", cuando);
                limpio.put("titulo", titulo.length() > 80 ? titulo.substring(0, 80) : titulo);
                limpio.put("texto", texto.length() > 240 ? texto.substring(0, 240) : texto);
                lista.put(limpio);
            }
            preferencias(contexto).edit().putString("lista", lista.toString()).apply();
            programarSiguiente(contexto);
        } catch (Exception exc) {
            Log.w("Platica", "Lista de recordatorios no válida", exc);
        }
    }

    private static SharedPreferences preferencias(Context contexto) {
        return contexto.getSharedPreferences(PREFERENCIAS, Context.MODE_PRIVATE);
    }

    private static List<JSONObject> leer(Context contexto) {
        List<JSONObject> lista = new ArrayList<>();
        try {
            JSONArray guardada = new JSONArray(preferencias(contexto).getString("lista", "[]"));
            for (int i = 0; i < guardada.length(); i++) {
                JSONObject aviso = guardada.optJSONObject(i);
                if (aviso != null) lista.add(aviso);
            }
        } catch (Exception exc) {
            Log.w("Platica", "No se pudieron leer los recordatorios", exc);
        }
        return lista;
    }

    private static PendingIntent alarma(Context contexto) {
        Intent intent = new Intent(contexto, Recordatorios.class).setAction(ACCION);
        return PendingIntent.getBroadcast(contexto, 0, intent,
                PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }

    static synchronized void programarSiguiente(Context contexto) {
        long proximo = Long.MAX_VALUE;
        for (JSONObject aviso : leer(contexto)) proximo = Math.min(proximo, aviso.optLong("cuando", Long.MAX_VALUE));
        AlarmManager alarmas = (AlarmManager) contexto.getSystemService(Context.ALARM_SERVICE);
        if (alarmas == null) return;
        if (proximo == Long.MAX_VALUE) {
            alarmas.cancel(alarma(contexto));
            return;
        }
        // Alarma inexacta: no necesita el permiso de alarmas exactas y llega con pocos minutos de diferencia.
        alarmas.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, Math.max(proximo, System.currentTimeMillis() + 1000),
                alarma(contexto));
    }

    private static synchronized void mostrarVencidos(Context contexto) {
        long ahora = System.currentTimeMillis();
        List<JSONObject> pendientes = new ArrayList<>();
        List<JSONObject> vencidos = new ArrayList<>();
        for (JSONObject aviso : leer(contexto)) {
            long cuando = aviso.optLong("cuando", 0);
            if (cuando > ahora + 60000) pendientes.add(aviso);
            else if (ahora - cuando < VIGENCIA) vencidos.add(aviso);
        }
        preferencias(contexto).edit().putString("lista", new JSONArray(pendientes).toString()).apply();
        for (JSONObject aviso : vencidos) notificar(contexto, aviso);
    }

    static void crearCanal(Context contexto) {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationManager gestor = contexto.getSystemService(NotificationManager.class);
        if (gestor == null || gestor.getNotificationChannel(CANAL) != null) return;
        NotificationChannel canal = new NotificationChannel(CANAL, contexto.getString(R.string.canal_recordatorios),
                NotificationManager.IMPORTANCE_DEFAULT);
        canal.setDescription(contexto.getString(R.string.canal_descripcion));
        gestor.createNotificationChannel(canal);
    }

    private static void notificar(Context contexto, JSONObject aviso) {
        if (Build.VERSION.SDK_INT >= 33 && ContextCompat.checkSelfPermission(contexto,
                Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) return;
        crearCanal(contexto);
        Intent abrir = new Intent(contexto, MainActivity.class)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent toque = PendingIntent.getActivity(contexto, 0, abrir,
                PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        String texto = aviso.optString("texto", "");
        NotificationCompat.Builder constructor = new NotificationCompat.Builder(contexto, CANAL)
                .setSmallIcon(R.drawable.ic_notificacion)
                .setColor(ContextCompat.getColor(contexto, R.color.acento))
                .setContentTitle(aviso.optString("titulo", "Platica"))
                .setContentText(texto)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(texto))
                .setContentIntent(toque)
                .setAutoCancel(true)
                .setPriority(NotificationCompat.PRIORITY_DEFAULT);
        try {
            NotificationManagerCompat.from(contexto).notify(aviso.optString("id", "aviso").hashCode(), constructor.build());
        } catch (SecurityException exc) {
            Log.w("Platica", "Sin permiso para notificar", exc);
        }
    }

    @Override
    public void onReceive(Context contexto, Intent intent) {
        if (ACCION.equals(intent.getAction())) mostrarVencidos(contexto);
        // Al reiniciar el teléfono o actualizar la app, Android olvida las alarmas: se vuelve a programar la próxima.
        programarSiguiente(contexto);
    }
}
