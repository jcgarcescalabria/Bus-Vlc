// Ajustes de la app dentro de Zepp (móvil): gestionar paradas favoritas.
import { STOPS_KEY, addStop, moveStop, parseStops, removeStop } from '../app-side/stops'

const ACCENT = '#ffb020'

AppSettingsPage({
  state: { props: null },

  stops() {
    return parseStops(this.state.props.settingsStorage.getItem(STOPS_KEY))
  },

  save(list) {
    this.state.props.settingsStorage.setItem(STOPS_KEY, JSON.stringify(list))
  },

  draft(key, value) {
    const s = this.state.props.settingsStorage
    if (value === undefined) return s.getItem(`draft:${key}`) || ''
    s.setItem(`draft:${key}`, value)
  },

  build(props) {
    this.state.props = props
    const stops = this.stops()
    const err = this.draft('error')

    const row = (s, i) =>
      View(
        {
          style: {
            display: 'flex',
            alignItems: 'center',
            padding: '10px 0',
            borderBottom: '1px solid #e5e5e5',
          },
        },
        [
          View({ style: { flex: 1 } }, [
            TextInput({
              label: `Parada ${s.id}`,
              placeholder: 'Nombre (p. ej. Casa)',
              value: s.name,
              onChange: (v) => this.save(addStop(this.stops(), s.id, v)),
            }),
          ]),
          Button({
            label: '↑',
            style: { minWidth: '40px', marginLeft: '6px' },
            onClick: () => this.save(moveStop(this.stops(), s.id, -1)),
          }),
          Button({
            label: '✕',
            style: { minWidth: '40px', marginLeft: '6px', color: '#d33' },
            onClick: () => this.save(removeStop(this.stops(), s.id)),
          }),
        ],
      )

    return Section({}, [
      View({ style: { padding: '16px 12px 4px' } }, [
        Text({ bold: true, paragraph: true, style: { fontSize: '20px' } }, 'Bus VLC · Mis paradas'),
        Text(
          { paragraph: true, style: { color: '#777', fontSize: '13px', marginTop: '6px' } },
          'El número de parada aparece en el poste de la parada y en la web de la EMT. ' +
            'Los cambios llegan al reloj la próxima vez que abras la app.',
        ),
      ]),

      View({ style: { padding: '0 12px' } }, stops.length ? stops.map(row) : [
        Text({ paragraph: true, style: { color: '#999', padding: '12px 0' } }, 'Todavía no hay paradas.'),
      ]),

      View({ style: { padding: '18px 12px', marginTop: '10px', background: '#f6f6f6' } }, [
        Text({ bold: true, paragraph: true }, 'Añadir parada'),
        TextInput({
          label: 'Número de parada',
          placeholder: 'p. ej. 636',
          value: this.draft('id'),
          onChange: (v) => this.draft('id', String(v).replace(/\D/g, '')),
        }),
        TextInput({
          label: 'Nombre (opcional)',
          placeholder: 'p. ej. Casa, Curro, Box…',
          value: this.draft('name'),
          onChange: (v) => this.draft('name', v),
        }),
        err ? Text({ paragraph: true, style: { color: '#d33', marginTop: '6px' } }, err) : null,
        Button({
          label: 'Añadir',
          style: { marginTop: '12px', background: ACCENT, color: '#000', borderRadius: '24px' },
          onClick: () => {
            try {
              this.save(addStop(this.stops(), this.draft('id'), this.draft('name')))
              this.draft('id', '')
              this.draft('name', '')
              this.draft('error', '')
            } catch (e) {
              this.draft('error', e.message)
            }
          },
        }),
      ].filter(Boolean)),
    ])
  },
})
