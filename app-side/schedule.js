// Próximas salidas según el horario oficial (GTFS) de la EMT.
// Los datos por parada los genera tools/gtfs_to_stops.py y se publican en la
// rama «datos» del repositorio (ver README).

export const DATA_BASE_URL = 'https://raw.githubusercontent.com/jcgarcescalabria/Bus-Vlc/datos'

export function stopUrl(id) {
  return `${DATA_BASE_URL}/stops/${encodeURIComponent(id)}.json`
}

function two(n) {
  return n < 10 ? `0${n}` : `${n}`
}

export function dateKey(d) {
  return `${d.getFullYear()}${two(d.getMonth() + 1)}${two(d.getDate())}`
}

function addDays(d, n) {
  const c = new Date(d.getTime())
  c.setDate(c.getDate() + n)
  return c
}

function hhmm(min) {
  const m = ((min % 1440) + 1440) % 1440
  return `${two(Math.floor(m / 60))}:${two(m % 60)}`
}

// data: JSON de una parada. now: Date en hora local (la del móvil).
// Devuelve { buses: [{ line, dest, min, time }], error }.
export function nextDepartures(data, now = new Date(), { limit = 8, horizon = 24 * 60 } = {}) {
  if (!data || !Array.isArray(data.g) || !data.d) {
    return { buses: [], error: 'Datos de horario no válidos' }
  }
  const nowMin = now.getHours() * 60 + now.getMinutes()
  const today = dateKey(now)
  if (data.to && today > data.to) {
    return { buses: [], error: 'Horarios caducados: actualiza los datos' }
  }

  // Ayer (servicios pasada la medianoche), hoy y mañana, en minutos desde hoy a las 00:00.
  const days = [
    [dateKey(addDays(now, -1)), -1440],
    [today, 0],
    [dateKey(addDays(now, 1)), 1440],
  ]
  const seen = new Set()
  const out = []
  for (const [key, offset] of days) {
    for (const gi of data.d[key] || []) {
      const [line, dest, times] = data.g[gi] || []
      if (!times) continue
      for (const t of times) {
        const at = t + offset
        const wait = at - nowMin
        if (wait < 0 || wait > horizon) continue
        const k = `${line}|${dest}|${at}`
        if (seen.has(k)) continue // mismo horario en dos servicios
        seen.add(k)
        out.push({ line, dest, min: wait, time: hhmm(at) })
      }
    }
  }
  out.sort((a, b) => a.min - b.min || a.line.localeCompare(b.line))
  return {
    buses: out.slice(0, limit),
    error: out.length ? '' : 'Sin salidas programadas en las próximas horas',
  }
}

export function toWatchPayload(stopId, result, now = Date.now()) {
  return {
    stop: String(stopId),
    ts: now,
    scheduled: true,
    error: result.error,
    buses: result.buses.map((b) => ({ l: b.line, d: b.dest, m: b.min, h: b.time })),
  }
}
