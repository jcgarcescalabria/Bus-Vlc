// Buscador de paradas para la página de ajustes. Usa el índice search.json que
// genera tools/gtfs_to_stops.py: { stops: [[id, nombre, [líneas], lat, lon]], lines: { "6": [[destino, [ids]]] } }

const ACCENTS = { á: 'a', à: 'a', ä: 'a', é: 'e', è: 'e', ë: 'e', í: 'i', ì: 'i', ï: 'i', ó: 'o', ò: 'o', ö: 'o', ú: 'u', ù: 'u', ü: 'u', ñ: 'n', ç: 'c', '·': '', "'": ' ', '’': ' ' }

// Sin depender de String.normalize, que no todos los motores de Zepp tienen.
export function norm(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[áàäéèëíìïóòöúùüñç·'’]/g, (c) => ACCENTS[c])
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function toStop(row) {
  return { id: row[0], name: row[1], lines: row[2] || [] }
}

// Cada palabra buscada tiene que coincidir con el principio de una palabra del
// nombre: «la fe» encuentra «Hospital La Fe» pero no «Pare d'Òrfens».
function matches(nameNorm, tokens) {
  const words = nameNorm.split(' ')
  return tokens.every((t) => words.some((w) => w.startsWith(t)))
}

function score(nameNorm, query) {
  if (nameNorm.startsWith(query)) return 3
  if (` ${nameNorm} `.includes(` ${query} `)) return 2
  if (nameNorm.includes(query)) return 1
  return 0
}

// Devuelve { groups: [{ title, stops: [{ id, name, lines }] }], error }
export function searchStops(index, { q = '', line = '' } = {}, limit = 25) {
  if (!index || !Array.isArray(index.stops)) return { groups: [], error: 'Índice de paradas no válido' }
  const query = norm(q)
  const tokens = query ? query.split(' ') : []
  const byId = new Map(index.stops.map((r) => [r[0], r]))
  const ln = String(line || '').trim().toUpperCase()

  if (ln) {
    const dirs = (index.lines || {})[ln]
    if (!dirs) return { groups: [], error: `No hay ninguna línea ${ln}` }
    const groups = []
    for (const [dest, ids] of dirs) {
      const stops = []
      for (const id of ids) {
        const row = byId.get(id)
        if (!row) continue
        if (tokens.length && !(matches(norm(row[1]), tokens) || id === query)) continue
        stops.push(toStop(row))
      }
      if (stops.length) groups.push({ title: `Línea ${ln} → ${dest}`, stops })
    }
    return { groups, error: groups.length ? '' : 'Ninguna parada de esa línea coincide' }
  }

  if (!tokens.length) return { groups: [], error: 'Escribe un nombre, una calle o un número' }

  let found
  if (/^\d+$/.test(query)) {
    // Por número: primero el exacto, luego los que empiezan igual.
    found = index.stops.filter((r) => r[0].startsWith(query)).sort((a, b) => a[0].length - b[0].length || +a[0] - +b[0])
  } else {
    found = index.stops
      .map((r) => [r, norm(r[1])])
      .filter(([, n]) => matches(n, tokens))
      .sort(([, na], [, nb]) => score(nb, query) - score(na, query) || (na < nb ? -1 : na > nb ? 1 : 0))
      .map(([r]) => r)
  }
  if (!found.length) return { groups: [], error: 'No se ha encontrado ninguna parada' }
  const more = found.length > limit ? ` (${found.length}; afina la búsqueda)` : ''
  return { groups: [{ title: `Resultados${more}`, stops: found.slice(0, limit).map(toStop) }], error: '' }
}

// Distancia aproximada en metros (equirectangular: sobra para distancias de una ciudad).
export function distance(lat1, lon1, lat2, lon2) {
  const rad = Math.PI / 180
  const x = (lon2 - lon1) * rad * Math.cos(((lat1 + lat2) / 2) * rad)
  const y = (lat2 - lat1) * rad
  return Math.round(Math.sqrt(x * x + y * y) * 6371000)
}

// Paradas más cercanas a una posición: [{ id, name, lines, dist }]
export function nearestStops(index, lat, lon, limit = 6, maxDist = 1500) {
  if (!index || !Array.isArray(index.stops) || !Number.isFinite(lat) || !Number.isFinite(lon)) return []
  return index.stops
    .filter((r) => Number.isFinite(r[3]) && Number.isFinite(r[4]))
    .map((r) => ({ ...toStop(r), dist: distance(lat, lon, r[3], r[4]) }))
    .filter((s) => s.dist <= maxDist)
    .sort((a, b) => a.dist - b.dist)
    .slice(0, limit)
}
