// Lista de paradas favoritas. Se guarda en el almacenamiento de ajustes
// (settingsStorage) del móvil para que la vean tanto el reloj como la página
// de ajustes de la app Zepp.

export const STOPS_KEY = 'stops'

export function cleanId(id) {
  const s = String(id ?? '').replace(/\D/g, '')
  return s.replace(/^0+(?=\d)/, '')
}

export function parseStops(raw) {
  if (!raw) return []
  let list = raw
  if (typeof raw === 'string') {
    try {
      list = JSON.parse(raw)
    } catch (e) {
      return []
    }
  }
  if (!Array.isArray(list)) return []
  const seen = new Set()
  const out = []
  for (const s of list) {
    const id = cleanId(s && s.id)
    if (!id || seen.has(id)) continue
    seen.add(id)
    out.push({ id, name: String((s && s.name) || '').trim().slice(0, 40) })
  }
  return out
}

export function addStop(list, id, name) {
  const cid = cleanId(id)
  if (!cid) throw new Error('Número de parada no válido')
  const rest = list.filter((s) => s.id !== cid)
  const prev = list.find((s) => s.id === cid)
  const nm = String(name || (prev && prev.name) || '').trim().slice(0, 40)
  return [...rest, { id: cid, name: nm }]
}

export function removeStop(list, id) {
  const cid = cleanId(id)
  return list.filter((s) => s.id !== cid)
}

export function moveStop(list, id, delta) {
  const i = list.findIndex((s) => s.id === cleanId(id))
  const j = i + delta
  if (i < 0 || j < 0 || j >= list.length) return list
  const copy = list.slice()
  ;[copy[i], copy[j]] = [copy[j], copy[i]]
  return copy
}
