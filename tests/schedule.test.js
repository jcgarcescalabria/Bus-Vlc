import { test } from 'node:test'
import assert from 'node:assert/strict'
import { dateKey, nextDepartures, stopUrl, toWatchPayload } from '../app-side/schedule.js'

// Datos con la forma que genera tools/gtfs_to_stops.py
const DATA = {
  id: '2158',
  name: 'Bulevard Sud - Hospital La Fe',
  from: '20261106',
  to: '20261209',
  g: [
    ['6', 'Torrefiel', [346, 600, 612, 1430, 1445]], // 0: laborable (1445 = 00:05 del día siguiente)
    ['6', 'Torrefiel', [341, 605, 1500]], // 1: sábado
    ['6', 'Torrefiel', [605]], // 2: mismo horario en otro servicio (duplicado)
  ],
  d: { '20261113': [0], '20261114': [1, 2], '20261116': [0] },
}

const at = (y, mo, d, h, mi) => new Date(y, mo - 1, d, h, mi)

test('próximas salidas de hoy, sin duplicados', () => {
  const r = nextDepartures(DATA, at(2026, 11, 14, 10, 0))
  assert.equal(r.error, '')
  assert.deepEqual(r.buses.map((b) => [b.min, b.time]), [[5, '10:05'], [900, '01:00']])
})

test('servicios de ayer pasada la medianoche', () => {
  // Viernes 13 tiene una salida a 1445 = sábado 00:05
  const r = nextDepartures(DATA, at(2026, 11, 14, 0, 1))
  assert.deepEqual(r.buses[0], { line: '6', dest: 'Torrefiel', min: 4, time: '00:05' })
})

test('de madrugada enlaza con el día siguiente', () => {
  const r = nextDepartures(DATA, at(2026, 11, 15, 23, 0)) // domingo sin servicio; lunes a las 05:46
  assert.equal(r.buses[0].time, '05:46')
  assert.equal(r.buses[0].min, 406)
})

test('sin salidas y horarios caducados', () => {
  assert.match(nextDepartures(DATA, at(2026, 11, 20, 10, 0)).error, /Sin salidas/)
  assert.match(nextDepartures(DATA, at(2026, 12, 20, 10, 0)).error, /caducados/)
  assert.match(nextDepartures(null).error, /no válidos/)
})

test('utilidades', () => {
  assert.equal(dateKey(at(2026, 1, 5, 0, 0)), '20260105')
  assert.match(stopUrl('2158'), /\/datos\/stops\/2158\.json$/)
  const p = toWatchPayload('2158', nextDepartures(DATA, at(2026, 11, 14, 10, 0)), 1)
  assert.equal(p.scheduled, true)
  assert.deepEqual(p.buses[0], { l: '6', d: 'Torrefiel', m: 5, h: '10:05' })
})
