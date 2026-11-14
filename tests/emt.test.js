import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixMojibake, parseMinutes, parseTimes, stripHtml, timesUrl, toWatchPayload } from '../app-side/emt.js'
import { addStop, cleanId, moveStop, parseStops, removeStop } from '../app-side/stops.js'

// Ejemplos con el formato que devuelve la EMT (sacados de pyemtvlc).
const DOS_BUSES = `<?xml version='1.0' encoding='UTF-8'?>
<estimacion parada="636">
  <solo_parada>
    <bus><linea>9</linea><destino>Pl. Espanya</destino><minutos>10 min.</minutos><horaLlegada/><error/></bus>
    <bus><linea>9</linea><destino>Pl. Espanya</destino><minutos>6 min.</minutos><horaLlegada/><error/></bus>
    <bus><linea>70</linea><destino>Av. Ausi&#224;s March</destino><minutos>Próximo</minutos><horaLlegada/><error/></bus>
  </solo_parada>
  <parada_linea/>
  <info/>
</estimacion>`

const NOCTURNO = `<?xml version='1.0' encoding='UTF-8'?>
<estimacion parada="636"><solo_parada>
  <bus><linea>N7</linea><destino>Pl. Ajuntament</destino><minutos/><horaLlegada>22:38</horaLlegada><error/></bus>
</solo_parada><parada_linea/><info/></estimacion>`

const SIN = `<?xml version='1.0' encoding='UTF-8'?>
<estimacion parada="19321"><solo_parada>
  <bus><linea>9</linea><destino>Pl. Espanya</destino><minutos/><horaLlegada/><error>SIN ESTIMACIONES</error></bus>
</solo_parada><parada_linea/><info/></estimacion>`

test('lee minutos, «Próximo» y ordena por llegada', () => {
  const r = parseTimes(DOS_BUSES)
  assert.equal(r.error, '')
  assert.deepEqual(
    r.buses.map((b) => [b.line, b.min]),
    [['70', 0], ['9', 6], ['9', 10]],
  )
  assert.equal(r.buses[0].dest, 'Av. Ausiàs March')
})

test('nocturnos con hora de llegada', () => {
  const r = parseTimes(NOCTURNO)
  assert.equal(r.buses.length, 1)
  assert.equal(r.buses[0].min, null)
  assert.equal(r.buses[0].time, '22:38')
})

test('sin estimaciones', () => {
  const r = parseTimes(SIN)
  assert.equal(r.buses.length, 0)
  assert.equal(r.error, 'Sin estimaciones ahora mismo')
})

test('respuesta rara (HTML de error)', () => {
  assert.equal(parseTimes('<html>503</html>').error, 'Respuesta inesperada de la EMT')
  assert.equal(parseTimes(undefined).error, 'Respuesta inesperada de la EMT')
})

test('arregla UTF-8 mal decodificado', () => {
  assert.equal(fixMojibake('AusiÃ s March'), 'Ausiàs March')
  assert.equal(fixMojibake('Benimaclet'), 'Benimaclet')
})

test('parseMinutes', () => {
  assert.equal(parseMinutes('3 min.'), 3)
  assert.equal(parseMinutes('Próximo'), 0)
  assert.equal(parseMinutes('Llegando'), 0)
  assert.equal(parseMinutes(''), null)
})

test('URL y carga útil para el reloj', () => {
  assert.equal(
    timesUrl('636'),
    'https://geoportal.emtvalencia.es/EMT/mapfunctions/MapUtilsPetitions.php?sec=getSAE&parada=636&adaptados=false&idioma=es',
  )
  const p = toWatchPayload('636', parseTimes(DOS_BUSES), 123)
  assert.deepEqual(p.buses[0], { l: '70', d: 'Av. Ausiàs March', m: 0, h: '' })
  assert.equal(p.ts, 123)
})

test('lista de paradas', () => {
  assert.equal(cleanId(' 0636 '), '636')
  let l = parseStops('[{"id":"636","name":"Casa"},{"id":636},{"id":"x"}]')
  assert.deepEqual(l, [{ id: '636', name: 'Casa' }])
  l = addStop(l, '1932', 'Curro')
  l = addStop(l, '636') // conserva el nombre
  assert.deepEqual(l.map((s) => s.id), ['1932', '636'])
  assert.equal(l[1].name, 'Casa')
  assert.deepEqual(moveStop(l, '636', -1).map((s) => s.id), ['636', '1932'])
  assert.deepEqual(removeStop(l, '1932').map((s) => s.id), ['636'])
  assert.throws(() => addStop(l, 'abc'))
})

// Lo que devolvía el servidor antiguo (captura del simulador, parada 2416).
const NO_DISPONIBLE = `<?xml version='1.0' encoding='UTF-8'?>
<estimacion parada="2416"><solo_parada>
  <bus><linea/><destino/><minutos/><horaLlegada/><error><![CDATA[<center>Temporalment no disponible des del pla.<br/>Consulta les estimacions a la web</center>]]></error></bus>
</solo_parada><parada_linea/><info/></estimacion>`

test('errores con HTML dentro', () => {
  assert.equal(stripHtml('<center>Hola<br/>adiós</center>'), 'Hola adiós')
  const r = parseTimes(NO_DISPONIBLE)
  assert.equal(r.buses.length, 0)
  assert.equal(r.error, 'La EMT no da estimaciones ahora mismo')
  assert.equal(r.raw, 'Temporalment no disponible des del pla. Consulta les estimacions a la web')
  assert.equal(toWatchPayload('2416', r).raw, r.raw)
  const esc = NO_DISPONIBLE.replace('<![CDATA[<center>', '&lt;center&gt;').replace('<br/>', '&lt;br/&gt;').replace('</center>]]>', '&lt;/center&gt;')
  assert.equal(parseTimes(esc).error, 'La EMT no da estimaciones ahora mismo')
})

test('destino en CDATA y campo adaptado', () => {
  const xml = `<estimacion parada="1"><solo_parada><bus><linea>19</linea><destino><![CDATA[Pl. Ajuntament]]></destino><minutos>4 min.</minutos><horaLlegada/><adaptado>1</adaptado><error/></bus></solo_parada></estimacion>`
  const r = parseTimes(xml)
  assert.deepEqual([r.buses[0].line, r.buses[0].dest, r.buses[0].min], ['19', 'Pl. Ajuntament', 4])
})
