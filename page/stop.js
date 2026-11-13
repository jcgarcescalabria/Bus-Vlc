// Próximos autobuses de una parada. Se actualiza sola mientras está abierta.
import { BasePage } from '@zeppos/zml/base-page'
import { back } from '@zos/router'
import { setPageBrightTime } from '@zos/display'
import { C, Layer, W, button, errorText, px, readJson, text, ui, writeJson } from './ui'

const REFRESH_MS = 20 * 1000
const MAX_ROWS = 7

function two(n) {
  return n < 10 ? `0${n}` : `${n}`
}

function clock(ts) {
  const d = new Date(ts)
  return `${two(d.getHours())}:${two(d.getMinutes())}:${two(d.getSeconds())}`
}

function when(b) {
  if (b.m === 0) return 'Ya'
  if (typeof b.m === 'number') return `${b.m} min`
  return b.h || '—'
}

Page(
  BasePage({
    state: { id: '', name: '', data: null, status: 'Cargando…', loading: false },

    onInit(params) {
      let p = {}
      try {
        p = typeof params === 'string' ? JSON.parse(params) : params || {}
      } catch (e) {}
      this.state.id = String(p.id || '')
      this.state.name = p.name || `Parada ${this.state.id}`
      this.state.data = readJson(`times:${this.state.id}`, null)
      this.layer = new Layer()
    },

    build() {
      try {
        setPageBrightTime({ brightTime: 60 * 1000 })
      } catch (e) {}
      this.render()
      this.load()
      this.timer = setInterval(() => this.load(), REFRESH_MS)
    },

    load() {
      if (this.state.loading || !this.state.id) return
      this.state.loading = true
      this.request({ method: 'bus.times', params: { stop: this.state.id } }, { timeout: 20000 })
        .then((data) => {
          this.state.data = data
          this.state.status = `Actualizado ${clock(data.ts || Date.now())}`
          writeJson(`times:${this.state.id}`, data)
        })
        .catch((e) => {
          const old = this.state.data
          this.state.status = old ? `${errorText(e)} · datos de ${clock(old.ts)}` : errorText(e)
        })
        .finally(() => {
          this.state.loading = false
          this.render()
        })
    },

    remove() {
      this.request({ method: 'stops.remove', params: { id: this.state.id } })
        .then(({ stops }) => {
          writeJson('stops', stops)
          back()
        })
        .catch((e) => {
          this.state.status = errorText(e)
          this.render()
        })
    },

    render() {
      const L = this.layer
      L.clear()
      let y = px(34)

      text(L, { x: px(60), y, w: W - px(120), h: px(30), text: `Parada ${this.state.id}`, color: C.dim, text_size: px(22) })
      y += px(30)
      text(L, { x: px(50), y, w: W - px(100), h: px(44), text: this.state.name, text_size: px(32) })
      y += px(56)

      const data = this.state.data
      const buses = (data && data.buses) || []

      if (!buses.length) {
        text(L, {
          x: px(60),
          y,
          w: W - px(120),
          h: px(120),
          text: data && data.error ? data.error : this.state.loading ? 'Cargando…' : 'Sin datos',
          color: C.dim,
          text_size: px(28),
          text_style: ui.text_style.WRAP,
        })
        y += px(130)
      }

      for (const b of buses.slice(0, MAX_ROWS)) {
        const soon = typeof b.m === 'number' && b.m <= 2
        L.add(ui.widget.FILL_RECT, { x: px(52), y: y + px(12), w: px(84), h: px(52), radius: px(26), color: C.accent })
        text(L, { x: px(52), y: y + px(12), w: px(84), h: px(52), text: b.l, color: 0x000000, text_size: px(28) })
        text(L, {
          x: px(148),
          y,
          w: px(178),
          h: px(76),
          text: b.d,
          text_size: px(24),
          align_h: ui.align.LEFT,
        })
        text(L, {
          x: px(326),
          y,
          w: px(104),
          h: px(76),
          text: when(b),
          color: soon ? C.soon : C.text,
          text_size: px(b.h && typeof b.m !== 'number' ? 28 : 34),
          align_h: ui.align.RIGHT,
        })
        y += px(80)
      }

      y += px(6)
      text(L, { x: px(60), y, w: W - px(120), h: px(32), text: this.state.status, color: C.dim, text_size: px(20) })
      y += px(42)

      const bw = px(260)
      button(L, {
        x: (W - bw) / 2,
        y,
        w: bw,
        h: px(68),
        text: 'Actualizar',
        click_func: () => this.load(),
      })
      y += px(80)
      button(L, {
        x: (W - bw) / 2,
        y,
        w: bw,
        h: px(68),
        text: 'Quitar parada',
        color: C.danger,
        click_func: () => this.remove(),
      })
      y += px(80)
      text(L, { x: 0, y, w: W, h: px(110), text: '' })
    },

    onDestroy() {
      this.timer && clearInterval(this.timer)
      this.layer && this.layer.clear()
    },
  }),
)
