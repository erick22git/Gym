import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  Users, CreditCard, Activity, DollarSign, AlertTriangle,
  Cake, Clock, Star, UserX, TrendingUp,
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, AreaChart, Area,
} from 'recharts'
import KPICard from '../components/dashboard/KPICard'
import { useApp } from '../context/AppContext'
import { PAGES } from '../constants'

// ─── Tooltip genérico ────────────────────────────────────────────────────────
function ChartTooltip({ active, payload, label, prefix = '', suffix = '' }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: 'oklch(0.11 0.008 265 / .96)',
      border: '1px solid oklch(1 0 0 / .12)',
      borderRadius: 10, padding: '10px 14px',
      backdropFilter: 'blur(20px)',
    }}>
      <div style={{ fontSize: 11, color: 'oklch(0.78 0.02 250 / .5)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.08em' }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: 'oklch(0.85 0.12 25)', fontFamily: 'Oxanium, sans-serif' }}>
        {prefix}{(payload[0]?.value || 0).toLocaleString('es-BO', { minimumFractionDigits: 0 })}{suffix}
      </div>
    </div>
  )
}

// ─── Section card wrapper ─────────────────────────────────────────────────────
function Card({ children, style }) {
  return (
    <div style={{
      background: 'var(--glass)',
      backdropFilter: 'blur(28px) saturate(140%)',
      WebkitBackdropFilter: 'blur(28px) saturate(140%)',
      border: '1px solid var(--line)',
      borderRadius: 16,
      padding: '18px 20px',
      boxShadow: 'inset 0 1px 0 oklch(1 0 0 / .08), 0 30px 60px oklch(0 0 0 / .4)',
      ...style,
    }}>
      {children}
    </div>
  )
}

function SectionTitle({ children }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 600, color: 'oklch(0.78 0.02 250 / .45)', letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 14 }}>
      {children}
    </div>
  )
}

// ─── Pie legend ───────────────────────────────────────────────────────────────
const PIE_COLORS = [
  'oklch(0.66 0.22 25)',
  'oklch(0.68 0.18 200)',
  'oklch(0.72 0.17 280)',
  'oklch(0.75 0.16 140)',
  'oklch(0.65 0.20 50)',
]

// ─── Período selector ────────────────────────────────────────────────────────
const PERIODOS = [
  { label: 'Hoy', dias: 1 },
  { label: 'Semana', dias: 7 },
  { label: 'Mes', dias: 30 },
  { label: 'Año', dias: 365 },
]

function getDateRange(dias) {
  const fin = new Date()
  const inicio = new Date()
  inicio.setDate(inicio.getDate() - (dias - 1))
  const fmt = d => d.toISOString().slice(0, 10)
  return { inicio: fmt(inicio), fin: fmt(fin) }
}

export default function Dashboard() {
  const { navigate } = useApp()
  const [stats, setStats] = useState(null)
  const [ingresosMes, setIngresosMes] = useState([])
  const [planesData, setPlanesData] = useState([])
  const [horasData, setHorasData] = useState([])
  const [recientes, setRecientes] = useState([])
  const [cumpleanios, setCumpleanios] = useState([])
  const [inactivos, setInactivos] = useState([])
  const [topClientes, setTopClientes] = useState([])
  const [resumen, setResumen] = useState(null)
  const [ingresos, setIngresos] = useState([])
  const [periodo, setPeriodo] = useState(1) // index into PERIODOS
  const [cargando, setCargando] = useState(true)

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      const [st, im, pl, hr, rc, cb, in_, tc, rs] = await Promise.all([
        window.api.dashboard.stats(),
        window.api.dashboard.ingresosMes(),
        window.api.dashboard2.distribucionPlanes(),
        window.api.dashboard2.asistenciasPorHora(),
        window.api.dashboard2.asistenciasHoyRecientes(8),
        window.api.dashboard2.cumpleanosProximos(7),
        window.api.dashboard2.clientesInactivos(14),
        window.api.dashboard2.topClientes(5),
        window.api.dashboard2.resumenRapido(),
      ])
      setStats(st)
      setIngresosMes(im)
      setPlanesData(pl)
      setHorasData(hr)
      setRecientes(rc)
      setCumpleanios(cb)
      setInactivos(in_)
      setTopClientes(tc)
      setResumen(rs)
    } catch (e) {
      console.error('Dashboard carga error:', e)
    } finally {
      setCargando(false)
    }
  }, [])

  const cargarIngresosPeriodo = useCallback(async (periodoIdx) => {
    const { inicio, fin } = getDateRange(PERIODOS[periodoIdx].dias)
    const data = await window.api.dashboard2.ingresosPorRango(inicio, fin)
    setIngresos(data)
  }, [])

  useEffect(() => { cargar() }, [cargar])
  useEffect(() => { cargarIngresosPeriodo(periodo) }, [periodo, cargarIngresosPeriodo])

  if (cargando && !stats) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300, color: 'oklch(0.78 0.02 250 / .35)', fontSize: 13 }}>
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
        {kpis.map((k, i) => (
          <KPICard key={k.label} {...k} delay={i * 0.07} />
        ))}
      </div>

      {/* Fila: gráfico de ingresos + distribución de planes */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 14 }}>

        {/* Ingresos por período */}
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <SectionTitle>Ingresos</SectionTitle>
            <div style={{ display: 'flex', gap: 4 }}>
              {PERIODOS.map((p, i) => (
                <button
                  key={p.label}
                  onClick={() => setPeriodo(i)}
                  style={{
                    padding: '4px 10px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 11,
                    background: periodo === i ? 'oklch(0.66 0.22 25 / .2)' : 'transparent',
                    color: periodo === i ? 'oklch(0.66 0.22 25)' : 'oklch(0.78 0.02 250 / .4)',
                    fontWeight: periodo === i ? 700 : 400,
                    transition: 'all .15s',
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={ingresos.length ? ingresos : ingresosMes} barSize={ingresos.length > 15 ? 6 : 18}>
              <XAxis dataKey={ingresos.length ? 'dia' : 'mes'} tick={{ fill: 'oklch(0.78 0.02 250 / .35)', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'oklch(0.78 0.02 250 / .3)', fontSize: 10 }} axisLine={false} tickLine={false} width={48}
                tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} />
              <Tooltip content={<ChartTooltip prefix="Bs. " />} cursor={{ fill: 'oklch(1 0 0 / .04)' }} />
              <defs>
                <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="oklch(0.66 0.22 25)" />
                  <stop offset="100%" stopColor="oklch(0.58 0.19 25)" />
                </linearGradient>
              </defs>
              <Bar dataKey="total" fill="url(#barGrad)" radius={[4, 4, 0, 0]}>
                {(ingresos.length ? ingresos : ingresosMes).map((_, i) => (
                  <Cell key={i} fill={`oklch(0.${62 + (i % 3)}  0.20 25)`} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* Distribución de planes */}
        <Card>
          <SectionTitle>Planes activos</SectionTitle>
          {planesData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={150}>
                <PieChart>
                  <Pie
                    data={planesData}
                    dataKey="cantidad"
                    nameKey="nombre"
                    cx="50%" cy="50%"
                    innerRadius={42}
                    outerRadius={62}
                    paddingAngle={3}
                    stroke="none"
                  >
                    {planesData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v, n) => [v, n]} contentStyle={{ background: 'oklch(0.11 0.008 265)', border: '1px solid oklch(1 0 0 / .12)', borderRadius: 8, fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
                {planesData.slice(0, 4).map((p, i) => (
                  <div key={p.nombre} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 8, height: 8, borderRadius: 2, background: PIE_COLORS[i % PIE_COLORS.length], flexShrink: 0 }} />
                    <span style={{ fontSize: 11, color: 'oklch(0.78 0.02 250 / .6)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.nombre}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'oklch(0.90 0.01 250)', fontFamily: 'Oxanium, sans-serif' }}>{p.cantidad}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div style={{ textAlign: 'center', color: 'oklch(0.78 0.02 250 / .3)', fontSize: 12, paddingTop: 40 }}>Sin datos</div>
          )}
        </Card>
      </div>

      {/* Fila: asistencias por hora + recientes */}
      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 14 }}>

        {/* Asistencias por hora */}
        <Card>
          <SectionTitle>Visitas por hora — hoy</SectionTitle>
          <ResponsiveContainer width="100%" height={150}>
            <AreaChart data={horasData}>
              <defs>
                <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="oklch(0.68 0.18 200)" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="oklch(0.68 0.18 200)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="hora" tick={{ fill: 'oklch(0.78 0.02 250 / .35)', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis hide />
              <Tooltip content={<ChartTooltip suffix=" visitas" />} cursor={{ stroke: 'oklch(1 0 0 / .08)' }} />
              <Area type="monotone" dataKey="cantidad" stroke="oklch(0.68 0.18 200)" strokeWidth={2} fill="url(#areaGrad)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        {/* Asistencias recientes */}
        <Card>
          <SectionTitle>Asistencias recientes</SectionTitle>
          {recientes.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'oklch(0.78 0.02 250 / .3)', fontSize: 12, paddingTop: 20 }}>Sin asistencias hoy</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
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
                    cursor: 'pointer',
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

      {/* Fila: resumen rápido */}
      {resumen && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
          {[
            { label: 'Visitas esta semana', value: resumen.visitasSemana, icon: Activity, color: 'oklch(0.78 0.16 155)' },
            { label: 'Promedio ingresos/mes', value: `Bs. ${Number(resumen.promedioIngreso || 0).toFixed(0)}`, icon: TrendingUp, color: 'oklch(0.75 0.18 60)' },
            { label: 'Plan popular', value: resumen.planPopular, icon: Star, color: 'oklch(0.80 0.18 80)' },
            { label: 'Top cliente (mes)', value: resumen.clienteMes, icon: Users, color: 'oklch(0.68 0.18 200)' },
          ].map((item, i) => (
            <motion.div
              key={item.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + i * 0.06 }}
              style={{
                background: 'var(--glass)',
                backdropFilter: 'blur(28px) saturate(140%)',
                WebkitBackdropFilter: 'blur(28px) saturate(140%)',
                border: '1px solid var(--line)',
                borderRadius: 14, padding: '14px 16px',
                display: 'flex', alignItems: 'center', gap: 12,
                boxShadow: 'inset 0 1px 0 oklch(1 0 0 / .08)',
              }}
            >
              <div style={{
                width: 34, height: 34, borderRadius: 9, flexShrink: 0,
                background: item.color.replace(')', ' / .12)'),
                border: `1px solid ${item.color.replace(')', ' / .25)')}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <item.icon size={16} color={item.color} />
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'oklch(0.94 0.01 250)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {item.value}
                </div>
                <div style={{ fontSize: 10, color: 'oklch(0.78 0.02 250 / .4)', marginTop: 2 }}>{item.label}</div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Fila: cumpleaños + inactivos + top clientes */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>

        {/* Cumpleaños próximos */}
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <Cake size={14} color="oklch(0.80 0.18 80)" />
            <SectionTitle>Cumpleaños próximos</SectionTitle>
          </div>
          {cumpleanios.length === 0 ? (
            <div style={{ fontSize: 12, color: 'oklch(0.78 0.02 250 / .3)', textAlign: 'center', paddingTop: 12 }}>Sin cumpleaños esta semana</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {cumpleanios.map(c => (
                <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ fontSize: 18 }}>🎂</div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'oklch(0.92 0.01 250)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.nombre} {c.apellido}</div>
                    <div style={{ fontSize: 10, color: 'oklch(0.78 0.02 250 / .4)' }}>{c.fecha_nacimiento?.slice(5, 10)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Clientes inactivos */}
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <UserX size={14} color="oklch(0.66 0.22 25)" />
            <SectionTitle>Inactivos +14 días</SectionTitle>
          </div>
          {inactivos.length === 0 ? (
            <div style={{ fontSize: 12, color: 'oklch(0.78 0.02 250 / .3)', textAlign: 'center', paddingTop: 12 }}>Todos activos</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {inactivos.slice(0, 5).map(c => (
                <div key={c.id}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', borderRadius: 6, padding: '4px 6px', transition: 'background .15s' }}
                  onClick={() => navigate(PAGES.PERFIL_CLIENTE, { clienteId: c.id })}
                >
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'oklch(0.66 0.22 25)', flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, color: 'oklch(0.88 0.01 250)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.nombre} {c.apellido}</div>
                    <div style={{ fontSize: 10, color: 'oklch(0.78 0.02 250 / .4)' }}>{c.dias_inactivo} días sin visita</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Top clientes */}
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <Star size={14} color="oklch(0.80 0.18 80)" />
            <SectionTitle>Top clientes (mes)</SectionTitle>
          </div>
          {topClientes.length === 0 ? (
            <div style={{ fontSize: 12, color: 'oklch(0.78 0.02 250 / .3)', textAlign: 'center', paddingTop: 12 }}>Sin datos</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {topClientes.map((c, i) => (
                <div key={c.id}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}
                  onClick={() => navigate(PAGES.PERFIL_CLIENTE, { clienteId: c.id })}
                >
                  <div style={{
                    width: 22, height: 22, borderRadius: 6, flexShrink: 0,
                    background: i === 0 ? 'oklch(0.80 0.18 80 / .2)' : 'oklch(1 0 0 / .05)',
                    border: `1px solid ${i === 0 ? 'oklch(0.80 0.18 80 / .4)' : 'oklch(1 0 0 / .08)'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 10, fontWeight: 700,
                    color: i === 0 ? 'oklch(0.80 0.18 80)' : 'oklch(0.78 0.02 250 / .5)',
                  }}>
                    {i + 1}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'oklch(0.92 0.01 250)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.nombre} {c.apellido}</div>
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'oklch(0.80 0.18 80)', fontFamily: 'Oxanium, sans-serif', flexShrink: 0 }}>{c.visitas}</div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Alertas críticas (si las hay) */}
      {(stats?.vencidas > 0 || stats?.porVencer > 0) && (
        <Card style={{ borderColor: 'oklch(0.66 0.22 25 / .25)', background: 'oklch(0.66 0.22 25 / .06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <AlertTriangle size={16} color="oklch(0.66 0.22 25)" />
            <div style={{ fontSize: 12, color: 'oklch(0.88 0.08 25)' }}>
              {stats.vencidas > 0 && <span><strong>{stats.vencidas}</strong> membresías vencidas · </span>}
              {stats.porVencer > 0 && <span><strong>{stats.porVencer}</strong> por vencer esta semana</span>}
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}
