// «Cerca de mí»: usa el GPS del reloj para proponer las paradas más próximas.
import { BasePage } from '@zeppos/zml/base-page'
import { replace } from '@zos/router'
import { Geolocation } from '@zos/sensor'
import { setPageBrightTime } from '@zos/display'
import { C, Layer, W, button, errorText, px, text, ui, writeJson } from './ui'

const GPS_TIMEOUT_S = 120

function meters(d) {
  return d < 1000 ? `${d} m` : `${(d / 1000).toFixed(1).replace('.', ',')} km`
}

Page(
  BasePage({
    state: { phase: 'gps', secs: 0, stops: [], msg: '' },

    onInit() {
      this.layer = new Layer()
    },

    build() {
      try {
        setPageBrightTime({ brightTime: GPS_TIMEOUT_S * 1000 })
      } catch (e) {}
      this.render()
      try {
        this.geo = new Geolocation()
        this.onGeo = () => this.check()
        this.geo.start()
        this.geo.onChange(this.onGeo)
      } catch (e) {
        this.state.phase = 'error'
        this.state.msg = 'Este reloj no deja usar el GPS'
        this.render()
        return
      }
      this.tick = setInterval(() => {
        this.state.secs += 1
        if (this.state.phase !== 'gps') return
        this.check()
        if (this.state.secs >= GPS_TIMEOUT_S) {
          this.stopGps()
          this.state.phase = 'error'
          this.state.msg = 'Sin señal GPS. Prueba al aire libre o busca la parada en los ajustes del móvil.'
        }
        this.render()
      }, 1000)
    },

    check() {
      if (this.state.phase !== 'gps' || !this.geo || this.geo.getStatus() !== 'A') return
      const lat = Number(this.geo.getLatitude())
      const lon = Number(this.geo.getLongitude())
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return
      this.stopGps()
      this.state.phase = 'loading'
      this.render()
      this.request({ method: 'stops.near', params: { lat, lon } }, { timeout: 25000 })
        .then(({ stops }) => {
          this.state.stops = stops || []
          this.state.phase = 'list'
          if (!this.state.stops.length) {
            this.state.phase = 'error'
            this.state.msg = 'No hay paradas de la EMT a menos de 1,5 km'
          }
        })
        .catch((e) => {
          this.state.phase = 'error'
          this.state.msg = errorText(e)
        })
        .finally(() => this.render())
    },

    stopGps() {
      try {
        if (this.geo) {
          this.geo.offChange(this.onGeo)
          this.geo.stop()
        }
      } catch (e) {}
      this.geo = null
    },

    choose(s) {
      this.state.phase = 'loading'
      this.render()
      this.request({ method: 'stops.add', params: { id: s.id, name: s.name } })
        .then(({ stops }) => {
          writeJson('stops', stops)
          replace({ url: 'page/stop', params: { id: s.id, name: s.name } })
        })
        .catch((e) => {
          this.state.phase = 'error'
          this.state.msg = errorText(e)
          this.render()
        })
    },

    render() {
      const L = this.layer
      L.clear()
      let y = px(40)
      text(L, { x: 0, y, w: W, h: px(48), text: 'Cerca de mí', color: C.accent, text_size: px(32) })
      y += px(60)

      const { phase } = this.state
      if (phase === 'gps' || phase === 'loading') {
        const msg = phase === 'gps' ? `Buscando señal GPS…\n${this.state.secs} s` : 'Buscando paradas…'
        text(L, { x: px(60), y: y + px(40), w: W - px(120), h: px(120), text: msg, color: C.dim, text_size: px(28), text_style: ui.text_style.WRAP })
        if (phase === 'gps') {
          text(L, { x: px(70), y: y + px(170), w: W - px(140), h: px(80), text: 'Al aire libre tarda menos', color: C.dim, text_size: px(20), text_style: ui.text_style.WRAP })
        }
        return
      }
      if (phase === 'error') {
        text(L, { x: px(60), y: y + px(30), w: W - px(120), h: px(180), text: this.state.msg, color: C.dim, text_size: px(26), text_style: ui.text_style.WRAP })
        return
      }

      const bw = px(340)
      for (const s of this.state.stops) {
        button(L, {
          x: (W - bw) / 2,
          y,
          w: bw,
          h: px(66),
          text: `${s.id} · ${meters(s.dist)}`,
          click_func: () => this.choose(s),
        })
        y += px(70)
        text(L, {
          x: px(70),
          y,
          w: W - px(140),
          h: px(52),
          text: `${s.name}${s.lines.length ? ` · ${s.lines.join(', ')}` : ''}`,
          color: C.dim,
          text_size: px(20),
          text_style: ui.text_style.WRAP,
        })
        y += px(64)
      }
      text(L, { x: 0, y, w: W, h: px(110), text: '' })
    },

    onDestroy() {
      this.tick && clearInterval(this.tick)
      this.stopGps()
      this.layer && this.layer.clear()
    },
  }),
)
