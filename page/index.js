// Pantalla principal: tus paradas guardadas.
import { BasePage } from '@zeppos/zml/base-page'
import { push } from '@zos/router'
import { C, Layer, W, button, errorText, px, readJson, stopLabel, text, ui, writeJson } from './ui'

const CACHE_KEY = 'stops'

Page(
  BasePage({
    state: { stops: [], status: '' },

    onInit() {
      this.layer = new Layer()
      this.state.stops = readJson(CACHE_KEY, [])
      this.state.status = 'Sincronizando…'
    },

    build() {
      this.render()
      this.sync()
    },

    onResume() {
      // Al volver del teclado o de una parada borrada.
      this.state.stops = readJson(CACHE_KEY, this.state.stops)
      this.render()
    },

    sync() {
      this.request({ method: 'stops.get' }, { timeout: 15000 })
        .then(({ stops }) => {
          this.state.stops = stops
          this.state.status = ''
          writeJson(CACHE_KEY, stops)
          this.render()
        })
        .catch((e) => {
          this.state.status = errorText(e)
          this.render()
        })
    },

    render() {
      const L = this.layer
      L.clear()
      const bw = px(360)
      const bx = (W - bw) / 2
      let y = px(40)

      text(L, { x: 0, y, w: W, h: px(50), text: 'Bus VLC', color: C.accent, text_size: px(34) })
      y += px(50)
      text(L, { x: px(60), y, w: W - px(120), h: px(34), text: this.state.status, color: C.dim, text_size: px(22) })
      y += px(40)

      const stops = this.state.stops
      if (!stops.length) {
        text(L, {
          x: px(70),
          y,
          w: W - px(140),
          h: px(150),
          text: 'Aún no tienes paradas.\nAñádelas con el botón + o en los ajustes de la app en Zepp.',
          color: C.dim,
          text_size: px(24),
          text_style: ui.text_style.WRAP,
        })
        y += px(160)
      }

      for (const s of stops) {
        button(L, {
          x: bx,
          y,
          w: bw,
          h: px(84),
          text: s.name ? `${s.name} · ${s.id}` : `Parada ${s.id}`,
          click_func: () => push({ url: 'page/stop', params: { id: s.id, name: stopLabel(s) } }),
        })
        y += px(96)
      }

      button(L, {
        x: bx + px(40),
        y: y + px(6),
        w: bw - px(80),
        h: px(72),
        text: '+ Añadir parada',
        color: 0x000000,
        normal_color: C.accent,
        press_color: C.accentPress,
        click_func: () => push({ url: 'page/keypad' }),
      })
      y += px(90)
      // Hueco final para que el último botón no quede cortado en pantallas redondas.
      text(L, { x: 0, y, w: W, h: px(110), text: '' })
    },

    onDestroy() {
      this.layer && this.layer.clear()
    },
  }),
)
