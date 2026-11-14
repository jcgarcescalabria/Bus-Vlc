# Bus VLC: el autobús de la EMT en tu Amazfit

Mini-app de Zepp OS para el Amazfit Active 3. Eliges una de tus paradas y ves cuándo pasa cada línea.

> **Ahora mismo muestra el horario programado, no el tiempo real.** La EMT ha restringido sus estimaciones en tiempo real a su visor web y a su app oficial, y no publica GTFS-Realtime. Se ha pedido acceso oficial. Cuando lo haya, solo hay que cambiar la fuente de datos en `app-side/`.

## Qué hace

- **Mis paradas** (pantalla principal): tus paradas guardadas. Al tocar una ves sus próximas salidas.
- **Próximas salidas**: cada línea con su destino, la hora programada y los minutos que faltan. «Ya» y el verde indican que el bus sale en 2 min o menos.
- **+ Añadir parada**: teclado numérico para escribir el número de parada, el que aparece en el poste. El nombre se rellena solo.
- **Ajustes en el móvil** (app Zepp › tu reloj › Bus VLC › Ajustes): para añadir paradas con nombre («Casa», «Box»…), renombrarlas, ordenarlas y borrarlas.

## Cómo funciona

```
GTFS oficial (datos abiertos) ──GitHub Actions, cada día──▶ rama «datos»: un JSON por parada
                                                                │
Reloj (page/*) ──Bluetooth──▶ App Zepp del móvil (app-side/) ──HTTPS┘
   pinta                         descarga el JSON de la parada
                                 y calcula las próximas salidas
```

- `tools/download_gtfs.py` baja el GTFS más reciente del [portal de datos abiertos de València](https://opendata.vlci.valencia.es/dataset/google-transit-lines-stops-bus-schedules). La EMT lo renueva cada semana y cada archivo cubre unas 4 o 5 semanas.
- `tools/gtfs_to_stops.py` lo convierte en un JSON pequeño por parada (la 2158 ocupa 1,8 KB; la más grande, unos 27 KB).
- `.github/workflows/horarios.yml` hace las dos cosas cada día y publica el resultado en la rama `datos`.
- La app descarga `https://raw.githubusercontent.com/jcgarcescalabria/Bus-Vlc/datos/stops/<parada>.json`. **Para eso el repositorio tiene que ser público**: los datos son públicos (horarios de la EMT, CC BY 4.0) y en el código no hay nada privado.

El reloj no tiene internet propio: pide los datos al móvil, que es quien los descarga. Por eso el móvil tiene que estar cerca, con Bluetooth y la app Zepp abierta en segundo plano. Los horarios se guardan 6 horas en el móvil.

Para regenerar los datos a mano:

```bash
python3 tools/download_gtfs.py gtfs.zip && python3 tools/gtfs_to_stops.py gtfs.zip out
```

### Tiempo real: qué se ha probado

- `MapUtilsPetitions.php?sec=getSAE` (en `www.` y `geoportal.emtvalencia.es`): la EMT lo ha limitado a su visor y fuera de él responde «Temporalmente no disponible desde el plano». No se debe imitar la sesión del visor para saltárselo.
- Servicios antiguos de su web (`mod_tiempo`) y el enlace «Próximas llegadas» de los datos abiertos: ya no existen.
- Posiciones de buses del Ayuntamiento (`geoportal.valencia.es`, `EMT/Seguimiento_EMT`): abierto y en directo, pero solo cubre unas 19 líneas (no la 6).
- `app-side/emt.js` conserva el lector del XML de `getSAE` por si la EMT abre un acceso oficial con ese formato.

## Instalarla en el reloj (desde el Mac)

1. Instala Node.js (si no lo tienes) y la herramienta de Zepp:

   ```bash
   npm install -g @zeppos/zeus-cli
   ```

2. Activa el modo desarrollador en la app Zepp del móvil: *Perfil › Ajustes › Acerca de* y toca 7 veces el logo de Zepp.
3. En esta carpeta:

   ```bash
   cd bus-vlc && npm install
   ```

   ```bash
   zeus login
   ```

   ```bash
   zeus preview
   ```

   Elige **Amazfit Active 3** en la lista. Saldrá un código QR.
4. En la app Zepp: *Perfil › Modo desarrollador › Escanear*, y escanea el QR. La app se instala en el reloj.

Si `zeus preview` protesta por el `appId`, crea una app en [console.zepp.com](https://console.zepp.com) y pon el número que te dé en `app.json` › `app.appId`.

Para probar sin reloj, `zeus dev` abre el simulador de Zepp (hay que descargarlo de la web de desarrolladores de Zepp).

## Tests

```bash
npm test
```

Comprueban el cálculo de próximas salidas (servicios pasada la medianoche, días sin servicio, horarios caducados), la lista de paradas y el lector del XML de tiempo real de la EMT.

## Ficheros

- `app.json`: configuración de la app (páginas, permisos, versión de API mínima 3.0).
- `page/index.js`: lista de paradas. `page/stop.js`: llegadas con autorefresco. `page/keypad.js`: teclado. `page/ui.js`: estilos y utilidades.
- `app-side/index.js`: servicio en el móvil. `app-side/schedule.js`: próximas salidas según el horario. `app-side/stops.js`: lista de paradas. `app-side/emt.js`: lector del tiempo real de la EMT (sin uso ahora).
- `tools/`: descarga y conversión del GTFS. `.github/workflows/horarios.yml`: actualización diaria.
- `setting/index.js`: página de ajustes en la app Zepp.

## Ideas para más adelante

- Tiempo real cuando la EMT o el Ayuntamiento lo abran (GTFS-Realtime o la línea 6 en el servicio de seguimiento).
- Paradas cercanas usando el GPS del móvil.
- Avisar con una vibración cuando falten 2 minutos.
- Filtrar por línea en una parada con muchas líneas.
