import { test } from 'node:test'
import assert from 'node:assert/strict'
import { norm, searchStops } from '../app-side/search.js'

const INDEX = {
  stops: [
    ['2158', 'Bulevard Sud (via de servici) - Hospital La Fe', ['6'], 39.4, -0.37],
    ['2157', 'Bulevard Sud (imparell) - Hospital La Fe', ['6', '14'], 39.4, -0.37],
    ['1932', 'Gaspar Aguilar - Costa i Borràs', ['6', '9'], 39.4, -0.38],
    ['21', 'Plaça de l’Ajuntament', ['4', '6'], 39.47, -0.37],
    ['1959', "Blanqueria - Pare d'Òrfens", ['5'], 39.48, -0.38],
  ],
  lines: { 6: [['Torrefiel', ['1932', '2158', '21']], ['Hospital La Fe', ['21', '2157']]] },
}

test('normaliza acentos y signos', () => {
  assert.equal(norm('Plaça de l’Ajuntament'), 'placa de l ajuntament')
  assert.equal(norm('Costa i Borràs'), 'costa i borras')
})

test('busca por nombre, sin acentos y con varias palabras', () => {
  const r = searchStops(INDEX, { q: 'la fe' })
  assert.deepEqual(r.groups[0].stops.map((s) => s.id).sort(), ['2157', '2158'])
  assert.deepEqual(searchStops(INDEX, { q: 'borras gaspar' }).groups[0].stops.map((s) => s.id), ['1932'])
  assert.equal(searchStops(INDEX, { q: 'placa' }).groups[0].stops[0].id, '21')
  // «fe» no debe encontrar «Òrfens»
  assert.ok(!searchStops(INDEX, { q: 'la fe' }).groups[0].stops.some((s) => s.id === '1959'))
})

test('busca por número: exacto primero', () => {
  assert.deepEqual(searchStops(INDEX, { q: '21' }).groups[0].stops.map((s) => s.id), ['21', '2157', '2158'])
})

test('filtra por línea en orden de recorrido, y por línea + nombre', () => {
  const r = searchStops(INDEX, { line: '6' })
  assert.deepEqual(r.groups.map((g) => g.title), ['Línea 6 → Torrefiel', 'Línea 6 → Hospital La Fe'])
  assert.deepEqual(r.groups[0].stops.map((s) => s.id), ['1932', '2158', '21'])
  const r2 = searchStops(INDEX, { line: '6', q: 'fe' })
  assert.deepEqual(r2.groups.map((g) => g.stops.map((s) => s.id)), [['2158'], ['2157']])
})

test('errores', () => {
  assert.match(searchStops(INDEX, { line: '99' }).error, /línea 99/)
  assert.match(searchStops(INDEX, { q: 'zzz' }).error, /ninguna/)
  assert.match(searchStops(INDEX, {}).error, /Escribe/)
  assert.match(searchStops(null).error, /no válido/)
})

test('paradas cercanas', async () => {
  const { nearestStops, distance } = await import('../app-side/search.js')
  const idx = {
    stops: [
      ['2158', 'La Fe', ['6'], 39.44549, -0.37355],
      ['2157', 'La Fe bis', ['6'], 39.4459, -0.3741],
      ['21', 'Ajuntament', ['4'], 39.4697, -0.3763],
      ['9', 'Sin coordenadas', ['4'], null, null],
    ],
  }
  // 0,001° de latitud ≈ 111 m
  assert.ok(Math.abs(distance(39.4, -0.37, 39.401, -0.37) - 111) <= 1)
  const r = nearestStops(idx, 39.4455, -0.3736)
  assert.deepEqual(r.map((s) => s.id), ['2158', '2157']) // el Ajuntament está a ~2,7 km
  assert.ok(r[0].dist < 20)
  assert.deepEqual(nearestStops(idx, NaN, 0), [])
})
