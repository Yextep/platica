#!/usr/bin/env bash
# Pruebas en el emulador de GitHub Actions. Conserva las capturas en docs/.
set -u

./gradlew --no-daemon connectedDebugAndroidTest
estado=$?
for vista in gasto inicio actualizacion; do
    adb pull "/sdcard/Download/platica-android-$vista.png" "docs/platica-android-$vista.png" || true
done
exit "$estado"
