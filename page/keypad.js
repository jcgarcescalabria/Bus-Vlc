// Teclado numérico para añadir una parada por su número (el que aparece en
// el poste de la parada y en la web/app de la EMT).
import { BasePage } from '@zeppos/zml/base-page'
import { back } from '@zos/router'
import { C, Layer, W, button, errorText, px, text, ui, writeJson } from './ui'

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '⌫', '0', 'OK']
const MAX_DIGITS = 5

Page(
  BasePage({
    state: { value: '', status: 'Nº de parada', busy: false },

    onInit() {
      this.fixed = new Layer()
    },

    build() {
      this.display = text(this.fixed, { x: px(90), y: px(52), w: W - px(180), h: px(64), text: '', text_size: px(48) })
      this.hint = text(this.fixed, { x: px(90), y: px(106), w: W - px(180), h: px(30), text: '', color: C.dim, text_size: px(22) })

      const kw = px(96)
      const kh = px(64)
      const gap = px(8)
      const x0 = (W - (kw * 3 + gap * 2)) / 2
      const y0 = px(142)
      KEYS.forEach((k, i) => {
        const col = i % 3
        const row = Math.floor(i / 3)
        const ok = k === 'OK'
        button(this.fixed, {
          x: x0 + col * (kw + gap),
          y: y0 + row * (kh + gap),
          w: kw,
          h: kh,
          radius: px(20),
          text: k,
          text_size: px(ok ? 28 : 34),
          color: ok ? 0x000000 : C.text,
          normal_color: ok ? C.accent : C.card,
          press_color: ok ? C.accentPress : C.cardPress,
          click_func: () => this.press(k),
        })
      })
      this.refresh()
    },

    refresh() {
      this.display.setProperty(ui.prop.TEXT, this.state.value || '–')
      this.hint.setProperty(ui.prop.TEXT, this.state.status)
    },

    press(k) {
      if (this.state.busy) return
      if (k === '⌫') {
        this.state.value = this.state.value.slice(0, -1)
      } else if (k === 'OK') {
        return this.save()
      } else if (this.state.value.length < MAX_DIGITS) {
        this.state.value += k
      }
      this.state.status = 'Nº de parada'
      this.refresh()
    },

    save() {
      if (!this.state.value) return
      this.state.busy = true
      this.state.status = 'Guardando…'
      this.refresh()
      this.request({ method: 'stops.add', params: { id: this.state.value } })
        .then(({ stops }) => {
          writeJson('stops', stops)
          back()
        })
        .catch((e) => {
          this.state.busy = false
          this.state.status = errorText(e)
          this.refresh()
        })
    },

    onDestroy() {
      this.fixed && this.fixed.clear()
    },
  }),
)
