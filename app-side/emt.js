// Consulta de tiempos de llegada de la EMT de València.
// Usa el mismo servicio que el mapa web de la EMT (geoportal.emtvalencia.es).
// No es una API pública documentada, así que puede cambiar sin aviso: el
// antiguo www.emtvalencia.es/EMT/mapfunctions/... ya responde «temporalment
// no disponible des del pla». Responde XML como:
//
// <estimacion parada="636">
//   <solo_parada>
//     <bus><linea>9</linea><destino>Pl. Espanya</destino>
//          <minutos>6 min.</minutos><horaLlegada/><error/></bus>
//   </solo_parada>
// </estimacion>

export const EMT_TIMES_URL =
  'https://geoportal.emtvalencia.es/EMT/mapfunctions/MapUtilsPetitions.php'

export const EMT_HEADERS = {
  Accept: 'application/json, text/plain, */*',
  'Accept-Language': 'es-ES,es;q=0.9',
  Referer: 'https://geoportal.emtvalencia.es/visor?lang=es',
}

export function timesUrl(stopId, line) {
  let url = `${EMT_TIMES_URL}?sec=getSAE&parada=${encodeURIComponent(stopId)}&adaptados=false&idioma=es`
  if (line) url += `&linea=${encodeURIComponent(line)}`
  return url
}

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }

function decodeEntities(s) {
  return s.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, code) => {
    if (code[0] === '#') {
      const n = code[1] === 'x' || code[1] === 'X' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10)
      return Number.isFinite(n) ? String.fromCharCode(n) : m
    }
    return ENTITIES[code.toLowerCase()] ?? m
  })
}

// La EMT a veces devuelve UTF-8 leído como Latin-1 («AvinguÃ¶da»). Lo arreglamos.
export function fixMojibake(s) {
  if (!s || !/[ÃÂ]/.test(s)) return s
  try {
    const bytes = Uint8Array.from(Array.from(s, (c) => c.charCodeAt(0) & 0xff))
    if (typeof TextDecoder !== 'undefined') {
      return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
    }
    // eslint-disable-next-line no-undef
    return decodeURIComponent(escape(s))
  } catch (e) {
    return s
  }
}

// Quita etiquetas HTML que a veces vienen dentro del texto (<center>, <br/>…).
export function stripHtml(s) {
  return s
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/?[a-z][^>]*>/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function tag(xml, name) {
  const m = xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`))
  if (!m) return ''
  return stripHtml(fixMojibake(decodeEntities(m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1'))))
}

// Convierte el texto de <minutos> en minutos. null si no se entiende.
export function parseMinutes(text) {
  if (!text) return null
  const t = text.trim().toLowerCase()
  const n = t.match(/(\d+)\s*min/)
  if (n) return parseInt(n[1], 10)
  if (/^\d+$/.test(t)) return parseInt(t, 10)
  // «Próximo», «Llegando», «En parada»…
  if (/^(pr|lleg|en parada|inminente)/.test(t)) return 0
  return null
}

// Devuelve { buses: [{ line, dest, min, time, raw }], error }
// min: minutos (0 = llegando); time: hora «HH:MM» cuando la EMT no da minutos.
export function parseTimes(xml) {
  if (typeof xml !== 'string' || !/<estimacion[\s>]/.test(xml)) {
    return { buses: [], error: 'Respuesta inesperada de la EMT' }
  }
  const buses = []
  const errors = []
  const re = /<bus>([\s\S]*?)<\/bus>/g
  let m
  while ((m = re.exec(xml))) {
    const block = m[1]
    const line = tag(block, 'linea')
    const dest = tag(block, 'destino')
    const minutes = tag(block, 'minutos')
    const time = tag(block, 'horaLlegada')
    const error = tag(block, 'error')
    if (error) {
      errors.push(error)
      continue
    }
    const min = parseMinutes(minutes)
    if (min === null && !time && !minutes) continue
    buses.push({ line, dest, min, time: min === null ? time || minutes : '', raw: minutes })
  }
  buses.sort((a, b) => sortKey(a) - sortKey(b))
  let error = ''
  if (!buses.length) {
    error = errors.length ? prettyError(errors[0]) : 'Sin autobuses previstos'
  }
  return { buses, error }
}

function sortKey(b) {
  if (b.min !== null) return b.min
  const hm = (b.time || '').match(/(\d{1,2}):(\d{2})/)
  if (!hm) return 9999
  const now = new Date()
  let diff = parseInt(hm[1], 10) * 60 + parseInt(hm[2], 10) - (now.getHours() * 60 + now.getMinutes())
  if (diff < -60) diff += 24 * 60 // pasa de medianoche
  return Math.max(diff, 0) + 0.5
}

function prettyError(e) {
  if (/sin estimaci/i.test(e)) return 'Sin estimaciones ahora mismo'
  if (/no corresponde/i.test(e)) return 'Esa línea no pasa por esta parada'
  if (/no disponible|no est[aà] disponible/i.test(e)) return 'La EMT no da estimaciones ahora mismo'
  const t = e.length > 90 ? `${e.slice(0, 87)}…` : e
  return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase()
}

// Respuesta compacta para mandar al reloj por Bluetooth.
export function toWatchPayload(stopId, parsed, now = Date.now()) {
  return {
    stop: String(stopId),
    ts: now,
    error: parsed.error,
    buses: parsed.buses.slice(0, 8).map((b) => ({ l: b.line, d: b.dest, m: b.min, h: b.time })),
  }
}
