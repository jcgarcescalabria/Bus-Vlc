# Bus VLC: el autobús de la EMT en tu Amazfit

Mini-app de Zepp OS para el Amazfit Active 3. Eliges una de tus paradas y ves en cuántos minutos llega cada línea. La pantalla se actualiza sola cada 20 s mientras la tienes abierta.

## Qué hace

- **Mis paradas** (pantalla principal): tus paradas guardadas. Al tocar una ves sus llegadas.
- **Llegadas**: cada línea con su destino y los minutos que faltan. «Ya» y el verde indican que el bus está a 2 min o menos. Los nocturnos que no dan minutos muestran la hora. Abajo están la hora de la última actualización, el botón *Actualizar* y *Quitar parada*.
- **+ Añadir parada**: teclado numérico para escribir el número de parada, el que aparece en el poste y en la web de la EMT.
- **Ajustes en el móvil** (app Zepp › tu reloj › Bus VLC › Ajustes): para añadir paradas con nombre («Casa», «Box»…), renombrarlas, ordenarlas y borrarlas.

## Cómo funciona

```
Reloj (page/*)  ──Bluetooth──▶  App Zepp del móvil (app-side/)  ──HTTPS──▶  emtvalencia.es
   pinta                          pide los tiempos, lee el XML
                                  y guarda las paradas (ajustes)
```

El reloj no tiene internet propio: pide los datos al móvil y la app Zepp hace la consulta. Por eso el móvil tiene que estar cerca, con Bluetooth y la app Zepp abierta en segundo plano.

Los tiempos salen del mismo servicio que usa la web de la EMT (`MapUtilsPetitions.php?sec=getSAE`). **No es una API pública documentada**: si la EMT lo cambia, la app dejará de dar tiempos y habrá que adaptar `app-side/emt.js`.

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

Comprueban la lectura del XML de la EMT (minutos, «Próximo», nocturnos con hora, «sin estimaciones», acentos mal codificados) y la gestión de la lista de paradas.

## Ficheros

- `app.json`: configuración de la app (páginas, permisos, versión de API mínima 3.0).
- `page/index.js`: lista de paradas. `page/stop.js`: llegadas con autorefresco. `page/keypad.js`: teclado. `page/ui.js`: estilos y utilidades.
- `app-side/index.js`: servicio en el móvil. `app-side/emt.js`: consulta y lectura de la respuesta de la EMT. `app-side/stops.js`: lista de paradas.
- `setting/index.js`: página de ajustes en la app Zepp.

## Ideas para más adelante

- Paradas cercanas usando el GPS del móvil (la EMT tiene un buscador de paradas por zona).
- Avisar con una vibración cuando falten 2 minutos.
- Filtrar por línea en una parada con muchas líneas.
