import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  Users, CreditCard, Activity, DollarSign, AlertTriangle,
  Cake, Clock, Star, UserX,
} from 'lucide-react'
import {
  PieChart, Pie, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import KPICard from '../components/dashboard/KPICard'
import { useApp } from '../context/AppContext'
import { PAGES } from '../constants'

// ─── Section card wrapper ─────────────────────────────────────────────────────
function Card({ children, style }) {
  return (
    <div style={{
      background: 'transparent',
      // Antes #dropdown-glass (compartido con el resto de la app, fuera
      // del Dashboard) — cambiado acá, en el default de Card, a
      // #top-clientes-glass (public/filters-menu-glass.svg) para que
      // TODAS las cards del Dashboard que usan este wrapper compartan la
      // misma distorsión sin tener que repetir el override en cada
      // instancia. Pedido explícito de unificar todo el Dashboard a un
      // solo nivel. #dropdown-glass en sí no se tocó.
      backdropFilter: 'url(#top-clientes-glass)',
      WebkitBackdropFilter: 'url(#top-clientes-glass)',
      /* [TRAÍDO DE VUELTA] El "efecto gota" que se había sacado de
         KPICard.jsx/el cuadro de Vencidas — pedido explícito ahora de
         aplicarlo también acá, al default de Card (las 5 cards que lo
         usan: Cumpleaños, Inactivos, Top clientes, Planes activos,
         Asistencias recientes), para que TODAS las cajas del Dashboard
         se vean iguales. Marco nítido reemplazado por transparent — el
         "marco" se repinta en boxShadow como halo difuminado en vez de
         una línea. */
      border: '1px solid transparent',
      borderRadius: 16,
      padding: '18px 20px',
      // Mismo boxShadow "efecto gota" que KPICard.jsx/Vencidas: halo
      // grande y difuso + brillo de esquina más chico y concentrado
      // encima, más el aro exterior difuminado.
      boxShadow: 'inset 0 1px 0 oklch(1 0 0 / .08), inset -14px -14px 28px oklch(1 0 0 / .07), inset -5px -5px 9px oklch(1 0 0 / .10), 0 0 10px 1px oklch(1 0 0 / .05), 0 30px 60px oklch(0 0 0 / .4)',
      ...style,
    }}>
      {children}
    </div>
  )
}

function SectionTitle({ children, compact }) {
  return (
    <div style={{
      fontSize: compact ? 10 : 11, fontWeight: 700,
      // Antes oklch(.../.45) — muy difuminado sobre el vidrio de fondo.
      // Mismo tratamiento que las etiquetas de KPICard.jsx: opacidad casi
      // sólida + text-shadow sin blur (offset puro) para contraste, sin
      // que la letra en sí se vea borrosa.
      color: 'oklch(0.95 0.01 250 / .9)',
      textShadow: '0 1px 0 oklch(0 0 0 / .5)',
      letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: compact ? 8 : 14,
    }}>
      {children}
    </div>
  )
}

// ─── Pie legend ───────────────────────────────────────────────────────────────
// [SOLO COLORES — pedido explícito, sin tocar layout/forma] Segunda vuelta
// de paleta para la torta de Planes activos. La anterior (mismo chroma/
// luminosidad, solo variando hue) se cambia por esta otra combinación,
// también coherente entre sí pero con un carácter distinto: teal, índigo,
// dorado, coral y menta — más variedad de matiz/chroma entre colores
// vecinos para que cada porción se distinga más a simple vista.
const PIE_COLORS = [
  'oklch(0.74 0.15 195)',
  'oklch(0.68 0.19 265)',
  'oklch(0.78 0.15 95)',
  'oklch(0.70 0.20 25)',
  'oklch(0.75 0.13 150)',
]

export default function Dashboard() {
  const { navigate } = useApp()
  const [stats, setStats] = useState(null)
  const [planesData, setPlanesData] = useState([])
  const [recientes, setRecientes] = useState([])
  const [cumpleanios, setCumpleanios] = useState([])
  const [inactivos, setInactivos] = useState([])
  const [topClientes, setTopClientes] = useState([])
  const [cargando, setCargando] = useState(true)

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      const [st, pl, rc, cb, in_, tc] = await Promise.all([
        window.api.dashboard.stats(),
        window.api.dashboard2.distribucionPlanes(),
        window.api.dashboard2.asistenciasHoyRecientes(8),
        window.api.dashboard2.cumpleanosProximos(7),
        window.api.dashboard2.clientesInactivos(14),
        window.api.dashboard2.topClientes(5),
      ])
      setStats(st)
      setPlanesData(pl)
      setRecientes(rc)
      setCumpleanios(cb)
      setInactivos(in_)
      setTopClientes(tc)
    } catch (e) {
      console.error('Dashboard carga error:', e)
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  if (cargando && !stats) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300, color: 'oklch(0.78 0.02 250 / .35)', fontSize: 14 }}>
        Cargando...
      </div>
    )
  }

  const kpis = [
    { icon: Users, label: 'Clientes activos', value: stats?.totalClientes || 0, color: 'oklch(0.68 0.18 200)' },
    { icon: CreditCard, label: 'Membresías activas', value: stats?.memActivas || 0, color: 'oklch(0.66 0.22 25)' },
    { icon: Activity, label: 'Asistencias hoy', value: stats?.asistenciasHoy || 0, color: 'oklch(0.78 0.16 155)' },
    { icon: DollarSign, label: 'Ingresos del mes (Bs.)', value: stats?.ingresosMes || 0, prefix: '', decimals: 0, color: 'oklch(0.75 0.18 60)' },
  ]

  const hayAlertas = stats?.vencidas > 0 || stats?.porVencer > 0
  const totalPlanes = planesData.reduce((s, p) => s + p.cantidad, 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, flex: 1, minHeight: 0, overflow: 'hidden' }}>

      {/* Fila 1: KPIs + Alertas críticas (cuadrada, condicional) — flex en vez de
          grid fijo para que los KPI se repartan el ancho completo sin dejar un
          hueco cuando no hay alertas que mostrar. */}
      <div style={{ display: 'flex', gap: 10, flexShrink: 0 }}>
        {kpis.map((k, i) => (
          <div key={k.label} style={{ flex: 1, minWidth: 0 }}>
            <KPICard {...k} delay={i * 0.07} />
          </div>
        ))}

        {hayAlertas && (
          <div style={{
            /* Antes flex:'0 0 92px' + width/height:92 fijos — quedaba chico
               frente a los KPIs. Ahora comparte el mismo flex:1/minWidth:0
               que el wrapper de cada KPICard (Dashboard.jsx arriba), así
               que se reparte el ancho en partes iguales entre los 5 (los 4
               KPIs se achican un poco, a propósito). Sin wrapper extra:
               este div ES el flex item directo, así que el stretch por
               defecto de la fila ya le da la misma altura que los demás,
               sin necesitar un height:100% como en KPICard.jsx (ahí el
               height:100% es porque KPICard es hijo de OTRO div que es el
               que se estira). */
            flex: 1,
            minWidth: 0,
            background: 'transparent',
            // Antes #dropdown-glass — unificado a #top-clientes-glass
            // como el resto de bloques del Dashboard (pedido explícito).
            backdropFilter: 'url(#top-clientes-glass)',
            WebkitBackdropFilter: 'url(#top-clientes-glass)',
            /* [TRAÍDO DE VUELTA] El "efecto gota" (halo difuminado + brillo
               de esquina) que había sacado — pedido explícito otra vez de
               quitar el marco nítido y ponerle brillos/sombras sutiles a
               TODAS las cajas del Dashboard. */
            border: '1px solid transparent',
            borderRadius: 12,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: 4, padding: 8, textAlign: 'center',
            position: 'relative',
            overflow: 'hidden',
            // Mismo boxShadow "efecto gota" que KPICard.jsx/Card.
            boxShadow: 'inset 0 1px 0 oklch(1 0 0 / .08), inset -14px -14px 28px oklch(1 0 0 / .07), inset -5px -5px 9px oklch(1 0 0 / .10), 0 0 10px 1px oklch(1 0 0 / .05), 0 30px 60px oklch(0 0 0 / .4)',
          }}>
            {/* Resplandor radial rojo centrado — mismo patrón que el de
                KPICard.jsx (div absoluto separado, no anidado en el
                elemento con backdrop-filter, pointerEvents:none). */}
            <div style={{
              position: 'absolute',
              inset: 0,
              borderRadius: 12,
              background: 'radial-gradient(circle at center, oklch(0.66 0.22 25 / 0.17) 0%, oklch(0.66 0.22 25 / 0.06) 50%, transparent 80%)',
              pointerEvents: 'none',
            }} />
            <AlertTriangle size={15} color="oklch(0.66 0.22 25)" style={{ position: 'relative' }} />
            <div style={{ fontSize: 9, color: 'oklch(0.88 0.08 25)', lineHeight: 1.35, position: 'relative' }}>
              {stats.vencidas > 0 && <div><strong>{stats.vencidas}</strong> vencidas</div>}
              {stats.porVencer > 0 && <div><strong>{stats.porVencer}</strong> por vencer</div>}
            </div>
          </div>
        )}
      </div>

      {/* Fila 2: cumpleaños + inactivos + top clientes + planes activos —
          las 4 tarjetas más chicas (padding reducido, títulos compactos) */}
      <div className="dashboard-row2" style={{ flexShrink: 0 }}>

        {/* Cumpleaños próximos — pedido explícito: más sombra en la letra
            (SOLO acá, no en las demás cards) y más compacto. */}
        <Card style={{ padding: '10px 12px', position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6 }}>
            <Cake size={12} color="oklch(0.80 0.18 80)" />
            <SectionTitle compact>Cumpleaños próximos</SectionTitle>
          </div>
          {cumpleanios.length === 0 ? (
            <div style={{ fontSize: 11, color: 'oklch(0.78 0.02 250 / .3)', textAlign: 'center', paddingTop: 6 }}>Sin cumpleaños esta semana</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {cumpleanios.slice(0, 4).map(c => (
                <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <div style={{ fontSize: 14, textShadow: '0 2px 4px rgba(0, 0, 0, 0.7)' }}>🎂</div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'oklch(0.92 0.01 250)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textShadow: '0 2px 4px rgba(0, 0, 0, 0.7)' }}>{c.nombre} {c.apellido}</div>
                    <div style={{ fontSize: 9, color: 'oklch(0.78 0.02 250 / .4)', textShadow: '0 2px 4px rgba(0, 0, 0, 0.7)' }}>{c.fecha_nacimiento?.slice(5, 10)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Clientes inactivos — usaba #inactivos-glass propio (más
            distorsión, para comparar contra el resto). Unificado al
            default de Card (#top-clientes-glass) como todos los demás
            bloques del Dashboard, pedido explícito. #inactivos-glass
            queda definido en el SVG pero sin usar, por si se retoma la
            comparación más adelante. */}
        <Card style={{ padding: '12px 14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <UserX size={12} color="oklch(0.66 0.22 25)" />
            <SectionTitle compact>Inactivos +14 días</SectionTitle>
          </div>
          {inactivos.length === 0 ? (
            <div style={{ fontSize: 11, color: 'oklch(0.78 0.02 250 / .3)', textAlign: 'center', paddingTop: 8 }}>Todos activos</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {/* Pedido explícito: más sombra y letra SOLO blanca (antes
                  el nombre era oklch(0.88...) y el subtítulo tenía un
                  poco de color/alpha propio) — ambos pasan a blanco
                  sólido, sombra más fuerte. */}
              {inactivos.slice(0, 4).map(c => (
                <div key={c.id}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', borderRadius: 6, padding: '3px 4px', transition: 'background .15s' }}
                  onClick={() => navigate(PAGES.PERFIL_CLIENTE, { clienteId: c.id })}
                >
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'oklch(0.66 0.22 25)', flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, color: 'oklch(0.98 0 0)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textShadow: '0 2px 4px rgba(0, 0, 0, 0.7)' }}>{c.nombre} {c.apellido}</div>
                    <div style={{ fontSize: 9, fontWeight: 600, color: 'oklch(0.98 0 0)', textShadow: '0 2px 4px rgba(0, 0, 0, 0.7)' }}>{c.dias_inactivo} días sin visita</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Top clientes — el filtro #top-clientes-glass (nacido acá) es
            ahora el default de Card, así que ya no necesita override
            propio. */}
        <Card style={{ padding: '12px 14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <Star size={12} color="oklch(0.80 0.18 80)" />
            <SectionTitle compact>Top clientes (mes)</SectionTitle>
          </div>
          {topClientes.length === 0 ? (
            <div style={{ fontSize: 11, color: 'oklch(0.78 0.02 250 / .3)', textAlign: 'center', paddingTop: 8 }}>Sin datos</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {topClientes.slice(0, 4).map((c, i) => (
                <div key={c.id}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
                  onClick={() => navigate(PAGES.PERFIL_CLIENTE, { clienteId: c.id })}
                >
                  <div style={{
                    width: 18, height: 18, borderRadius: 5, flexShrink: 0,
                    background: i === 0 ? 'oklch(0.80 0.18 80 / .2)' : 'oklch(1 0 0 / .05)',
                    border: `1px solid ${i === 0 ? 'oklch(0.80 0.18 80 / .4)' : 'oklch(1 0 0 / .08)'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 9, fontWeight: 700,
                    color: i === 0 ? 'oklch(0.80 0.18 80)' : 'oklch(0.78 0.02 250 / .5)',
                  }}>
                    {i + 1}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'oklch(0.92 0.01 250)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.nombre} {c.apellido}</div>
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'oklch(0.80 0.18 80)', fontFamily: 'Oxanium, sans-serif', flexShrink: 0 }}>{c.visitas}</div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Distribución de planes — rediseñada: la columna ahora es más
            ancha (grid-template-columns de .dashboard-row2 en index.css,
            1.8fr contra 0.8fr de las otras 3), así que el layout pasa de
            "torta apilada arriba, leyenda de solo 3 abajo" a torta +
            leyenda COMPLETA lado a lado, con el total de clientes en el
            centro de la dona (paddingAngle/cornerRadius para que se vea
            como piezas separadas, no una torta sólida) y porcentaje por
            plan en vez de solo el conteo crudo. */}
        <Card style={{ padding: '14px 16px' }}>
          <SectionTitle compact>Planes activos</SectionTitle>
          {planesData.length > 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ position: 'relative', width: 128, height: 128, flexShrink: 0 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={planesData}
                      dataKey="cantidad"
                      nameKey="nombre"
                      cx="50%" cy="50%"
                      innerRadius={42}
                      outerRadius={62}
                      paddingAngle={4}
                      cornerRadius={5}
                      stroke="none"
                    >
                      {planesData.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v, n) => [v, n]} contentStyle={{ background: 'oklch(0.11 0.008 265)', border: '1px solid oklch(1 0 0 / .12)', borderRadius: 8, fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
                {/* Total al centro de la dona — div absoluto encima del
                    chart, pointerEvents:none para no tapar el hover del
                    Pie/Tooltip de Recharts. */}
                <div style={{
                  position: 'absolute', inset: 0,
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  pointerEvents: 'none',
                }}>
                  <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'Oxanium, sans-serif', color: 'oklch(0.97 0.01 250)', lineHeight: 1 }}>
                    {totalPlanes}
                  </div>
                  <div style={{ fontSize: 8, color: 'oklch(0.78 0.02 250 / .5)', letterSpacing: '.06em', textTransform: 'uppercase', marginTop: 3 }}>
                    clientes
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1, minWidth: 0 }}>
                {planesData.map((p, i) => (
                  <div key={p.nombre} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: PIE_COLORS[i % PIE_COLORS.length], flexShrink: 0 }} />
                    <span style={{ fontSize: 11, color: 'oklch(0.90 0.01 250 / .85)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.nombre}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'oklch(0.95 0.01 250)', fontFamily: 'Oxanium, sans-serif' }}>{p.cantidad}</span>
                    <span style={{ fontSize: 9, color: 'oklch(0.78 0.02 250 / .45)', width: 30, textAlign: 'right' }}>
                      {totalPlanes > 0 ? Math.round((p.cantidad / totalPlanes) * 100) : 0}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', color: 'oklch(0.78 0.02 250 / .3)', fontSize: 11, paddingTop: 20 }}>Sin datos</div>
          )}
        </Card>
      </div>

      {/* Fila 3: Asistencias recientes — ocupa el alto restante y scrollea
          internamente; el resto de la página no scrollea. */}
      <div style={{ display: 'flex', gap: 10, flex: 1, minHeight: 0 }}>
      {/* Bloque de video (a futuro, reproducido por frames — mismo sistema
          que el fondo animado de la app: src/config/videoTransitions.ts +
          src/components/background/VideoBackground.jsx, público en
          public/frames/). Por ahora, mientras no hay video propio para el
          Dashboard, placeholder estático con una foto que ya existe en el
          proyecto (public/login.png). Pedido explícito: SIN marco ni el
          tratamiento de vidrio/halo del resto de cards — es un bloque de
          imagen/video suelto, no una card de vidrio.
          [POSICIÓN — pedido explícito] Movido antes que la Card de
          Asistencias recientes en el DOM (misma fila flex) para que
          quede a la IZQUIERDA — Asistencias recientes pasa a la derecha. */}
      <div style={{
        flex: 1,
        minWidth: 0,
        minHeight: 0,
        borderRadius: 16,
        overflow: 'hidden',
        position: 'relative',
        backgroundImage: 'url(/login.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }} />

      <Card style={{ padding: '14px 16px', flex: 1.6, minWidth: 0, minHeight: 0, overflowY: 'auto' }}>
        <SectionTitle compact>Asistencias recientes</SectionTitle>
        {recientes.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'oklch(0.78 0.02 250 / .3)', fontSize: 12, paddingTop: 20 }}>Sin asistencias hoy</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingRight: 4 }}>
            {recientes.map((r, i) => (
              <motion.div
                key={r.id || i}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '7px 10px', borderRadius: 9,
                  background: 'oklch(1 0 0 / .03)',
                  cursor: 'pointer', flexShrink: 0,
                }}
                onClick={() => navigate(PAGES.PERFIL_CLIENTE, { clienteId: r.cliente_id })}
              >
                <div style={{
                  width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                  background: 'oklch(0.68 0.18 200 / .15)',
                  border: '1px solid oklch(0.68 0.18 200 / .3)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 700, color: 'oklch(0.68 0.18 200)',
                }}>
                  {(r.nombre?.[0] || '?').toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'oklch(0.92 0.01 250)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {r.nombre} {r.apellido}
                  </div>
                  <div style={{ fontSize: 10, color: 'oklch(0.78 0.02 250 / .4)' }}>{r.plan_nombre || 'Sin plan'}</div>
                </div>
                <div style={{ fontSize: 10, color: 'oklch(0.78 0.02 250 / .35)', flexShrink: 0 }}>
                  <Clock size={10} style={{ display: 'inline', marginRight: 3 }} />
                  {r.fecha_hora ? r.fecha_hora.slice(11, 16) : '—'}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </Card>
      </div>
    </div>
  )
}
