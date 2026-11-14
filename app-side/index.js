import { BaseSideService } from '@zeppos/zml/base-side'
import { nextDepartures, stopUrl, toWatchPayload } from './schedule'
import { STOPS_KEY, addStop, parseStops, removeStop } from './stops'

// Horarios por parada descargados de la rama «datos». Se guardan unas horas:
// cambian como mucho una vez al día.
const cache = new Map()
const CACHE_MS = 6 * 60 * 60 * 1000

function bodyJson(body) {
  if (body && typeof body === 'object') return body
  if (typeof body === 'string') return JSON.parse(body)
  throw new Error('Respuesta vacía')
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

    async stopData(stopId) {
      const id = String(stopId)
      const hit = cache.get(id)
      if (hit && Date.now() - hit.at < CACHE_MS) return hit.data
      const res = await this.fetch({ method: 'GET', url: stopUrl(id), timeout: 15000 })
      if (res.status === 404) throw new Error(`La parada ${id} no tiene horarios`)
      if (res.status && res.status >= 400) throw new Error(`Error ${res.status} al bajar horarios`)
      const data = bodyJson(res.body)
      cache.set(id, { at: Date.now(), data })
      return data
    },

    async busTimes(stopId) {
      const data = await this.stopData(stopId)
      return toWatchPayload(stopId, nextDepartures(data, new Date()))
    },

    async addStopNamed(id, name) {
      let nm = name
      if (!nm) {
        try {
          nm = (await this.stopData(id)).name
        } catch (e) {
          nm = '' // sin nombre: el reloj mostrará «Parada N»
        }
      }
      return this.saveStops(addStop(this.getStops(), id, nm))
    },

    onRequest(req, res) {
      const p = req.params || {}
      const fail = (e) => res({ message: (e && e.message) || String(e) })
      try {
        switch (req.method) {
          case 'stops.get':
            return res(null, { stops: this.getStops() })
          case 'stops.add':
            return this.addStopNamed(p.id, p.name).then((stops) => res(null, { stops }), fail)
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
