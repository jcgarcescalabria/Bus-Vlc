import { BaseSideService } from '@zeppos/zml/base-side'
import { EMT_HEADERS, parseTimes, timesUrl, toWatchPayload } from './emt'
import { STOPS_KEY, addStop, parseStops, removeStop } from './stops'

// Caché corta para no repetir la consulta si el reloj pide dos veces seguidas.
const cache = new Map()
const CACHE_MS = 10 * 1000

function bodyText(body) {
  if (typeof body === 'string') return body
  if (body && typeof body.text === 'string') return body.text
  if (body && typeof body === 'object') {
    try {
      return JSON.stringify(body)
    } catch (e) {
      return ''
    }
  }
  return ''
}

AppSideService(
  BaseSideService({
    getStops() {
      return parseStops(this.settings.getItem(STOPS_KEY))
    },

    saveStops(list) {
      this.settings.setItem(STOPS_KEY, JSON.stringify(list))
      return list
    },

    async busTimes(stopId) {
      const id = String(stopId)
      const hit = cache.get(id)
      if (hit && Date.now() - hit.ts < CACHE_MS) return hit
      const res = await this.fetch({
        method: 'GET',
        url: timesUrl(id),
        headers: EMT_HEADERS,
        timeout: 15000,
      })
      if (res.status && res.status >= 400) {
        throw new Error(`La EMT respondió ${res.status}`)
      }
      const payload = toWatchPayload(id, parseTimes(bodyText(res.body)))
      cache.set(id, payload)
      return payload
    },

    onRequest(req, res) {
      const p = req.params || {}
      const fail = (e) => res({ message: (e && e.message) || String(e) })
      try {
        switch (req.method) {
          case 'stops.get':
            return res(null, { stops: this.getStops() })
          case 'stops.add':
            return res(null, { stops: this.saveStops(addStop(this.getStops(), p.id, p.name)) })
          case 'stops.remove':
            return res(null, { stops: this.saveStops(removeStop(this.getStops(), p.id)) })
          case 'bus.times':
            return this.busTimes(p.stop).then((r) => res(null, r), fail)
          default:
            return fail(new Error(`Método desconocido: ${req.method}`))
        }
      } catch (e) {
        return fail(e)
      }
    },

    onSettingsChange() {},
  }),
)
