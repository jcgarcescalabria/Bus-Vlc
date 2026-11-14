import ui from '@zos/ui'
import { px } from '@zos/utils'
import { getDeviceInfo } from '@zos/device'
import { LocalStorage } from '@zos/storage'

export const { width: W, height: H } = getDeviceInfo()

export const C = {
  bg: 0x000000,
  text: 0xffffff,
  dim: 0x9a9a9a,
  card: 0x1e1e1e,
  cardPress: 0x3a3a3a,
  accent: 0xffb020,
  accentPress: 0xc98a12,
  danger: 0xff5a4f,
  soon: 0x4cd964,
}

export { px, ui }

// Caché local en el reloj: así la lista y los últimos tiempos se ven al momento,
// aunque el móvil tarde en responder.
let store = null
export function storage() {
  if (!store) store = new LocalStorage()
  return store
}

export function readJson(key, fallback) {
  try {
    const v = storage().getItem(key)
    return v ? JSON.parse(v) : fallback
  } catch (e) {
    return fallback
  }
}

export function writeJson(key, value) {
  try {
    storage().setItem(key, JSON.stringify(value))
  } catch (e) {}
}

export function stopLabel(s) {
  return s.name ? s.name : `Parada ${s.id}`
}

// Conjunto de widgets que se borra y se vuelve a pintar de golpe.
export class Layer {
  constructor() {
    this.items = []
  }
  add(type, opts) {
    const w = ui.createWidget(type, opts)
    this.items.push(w)
    return w
  }
  clear() {
    for (const w of this.items) {
      try {
        if (typeof ui.deleteWidget === 'function') ui.deleteWidget(w)
        else w.setProperty(ui.prop.VISIBLE, false)
      } catch (e) {}
    }
    this.items = []
  }
}

export function text(layer, opts) {
  return layer.add(ui.widget.TEXT, {
    color: C.text,
    text_size: px(28),
    align_h: ui.align.CENTER_H,
    align_v: ui.align.CENTER_V,
    text_style: ui.text_style.ELLIPSIS,
    ...opts,
  })
}

export function button(layer, opts) {
  return layer.add(ui.widget.BUTTON, {
    radius: px(36),
    normal_color: C.card,
    press_color: C.cardPress,
    color: C.text,
    text_size: px(30),
    ...opts,
  })
}

export function errorText(e) {
  if (!e) return 'Error'
  const msg = String(e.message || e.reason || e)
  // Errores del canal reloj ↔ móvil (zml): 1 handshake, 2 Bluetooth, 3 sin side service, 4 timeout
  if (e.code === 2 || /ble disconnect/i.test(msg)) return 'Sin Bluetooth con el móvil'
  if (e.code === 3 || /side service/i.test(msg)) return 'La app Zepp del móvil no responde'
  if (e.code === 1 || e.code === 4 || /timeout/i.test(msg)) return 'El móvil no responde'
  return msg
}
