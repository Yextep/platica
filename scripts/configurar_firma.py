"""Crea la firma de Platica una sola vez, la guarda en este equipo y la sube como secreto a GitHub.

Todas las versiones deben firmarse con la misma clave para instalarse encima de la anterior.
"""
import base64
import os
from pathlib import Path
import secrets
import subprocess

REPOSITORIO = 'Yextep/platica'
carpeta = Path('/root/.local/share/platica/signing')
carpeta.mkdir(parents=True, exist_ok=True)
carpeta.chmod(0o700)
archivo_clave = carpeta / 'password'
almacen = carpeta / 'platica.p12'
if not archivo_clave.exists():
    fd = os.open(archivo_clave, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, 'w') as salida:
        salida.write(secrets.token_urlsafe(40))
if not almacen.exists():
    subprocess.run([
        'keytool', '-genkeypair', '-keystore', str(almacen), '-storetype', 'PKCS12',
        '-storepass:file', str(archivo_clave), '-keypass:file', str(archivo_clave),
        '-alias', 'platica', '-keyalg', 'RSA', '-keysize', '3072', '-validity', '10000',
        '-dname', 'CN=Platica, OU=Android, O=Platica', '-noprompt',
    ], check=True)
    almacen.chmod(0o600)
for nombre, valor in (
    ('PLATICA_SIGNING_KEYSTORE', base64.b64encode(almacen.read_bytes())),
    ('PLATICA_SIGNING_PASSWORD', archivo_clave.read_bytes()),
):
    subprocess.run(['gh', 'secret', 'set', nombre, '--repo', REPOSITORIO], input=valor, check=True)
print('Firma de Platica lista y guardada en', carpeta)
