import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  BarChart, Bar, AreaChart, Area, PieChart, Pie, Cell, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { BarChart2, Users, DollarSign, TrendingUp, RefreshCw, Calendar, Award, Wallet, CreditCard, ShoppingCart } from 'lucide-react'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtMoney(n) { return 'Bs. ' + Number(n || 0).toFixed(0) }
function fmtK(n) { return n >= 1000 ? (n / 1000).toFixed(1) + 'k' : String(Math.round(n || 0)) }
function fmtDate(s) { return s ? new Date(s).toLocaleDateString('es-BO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—' }

const TABS = [
  { id: 'general',    label: 'General',    icon: BarChart2 },
  { id: 'ingresos',   label: 'Ingresos',   icon: DollarSign },
  { id: 'ventas',     label: 'Ventas',     icon: ShoppingCart },
  { id: 'caja',       label: 'Caja',       icon: Wallet },
  { id: 'clientes',   label: 'Clientes',   icon: Users },
  { id: 'asistencia', label: 'Asistencia', icon: Calendar },
]

const COLORS = {
  red:    '#d94040',
  green:  '#36b06e',
  blue:   '#4070d0',
  yellow: '#c09030',
  purple: '#8855cc',
  cyan:   '#30a0b8',
}

const TOOLTIP_STYLE = {
  contentStyle: {
    background: 'rgba(14, 14, 26, 0.95)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 10,
    fontSize: 12,
    color: '#d0d0e8',
    backdropFilter: 'blur(20px)',
    boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
  },
  labelStyle: { color: '#8080a8', fontWeight: 600 },
  cursor: { fill: 'rgba(255,255,255,0.04)' },
}

function KPICard({ label, value, desc, color, Icon }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        background: `${color}0c`, border: `1px solid ${color}30`,
        borderRadius: 12, padding: '16px 18px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <Icon size={14} color={color} />
        <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.14em', color, textTransform: 'uppercase' }}>{label}</span>
      </div>
      <div style={{ fontSize: 28, fontWeight: 800, fontFamily: 'var(--display)', color, lineHeight: 1, marginBottom: 4 }}>
        {value}
      </div>
      {desc && <div style={{ fontSize: 11, color: 'var(--dim)' }}>{desc}</div>}
    </motion.div>
  )
}

function ChartCard({ title, children, height = 260 }) {
  return (
    <div className="gym-card" style={{ padding: '18px 20px' }}>
      <h3 style={{ fontFamily: 'var(--display)', fontSize: 12, fontWeight: 700, color: 'var(--muted)', letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 16 }}>
        {title}
      </h3>
      <div style={{ height }}>{children}</div>
    </div>
  )
}

// ─── Tab General ──────────────────────────────────────────────────────────────

function TabGeneral() {
  const [stats, setStats] = useState(null)
  const [ingresos, setIngresos] = useState([])
  const [planes, setPlanes] = useState([])

  useEffect(() => {
    Promise.all([
      window.api.dashboard.stats(),
      window.api.dashboard.ingresosMes(),
      window.api.dashboard2.distribucionPlanes(),
    ]).then(([s, ing, pl]) => {
      setStats(s)
      // Formatear meses para display
      setIngresos((ing || []).map(i => ({
        ...i,
        mesLabel: new Date(i.mes + '-01').toLocaleDateString('es-BO', { month: 'short' }),
        total: Math.round(i.total || 0),
      })).reverse())
      setPlanes((pl || []).filter(p => p.cantidad > 0))
    })
  }, [])

  if (!stats) return <div style={{ textAlign: 'center', padding: 40 }}><div className="spinner" style={{ margin: '0 auto' }} /></div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        <KPICard label="Ingresos del mes" value={fmtMoney(stats.ingresosMes)} color={COLORS.green} Icon={DollarSign} desc="Total cobrado" />
        <KPICard label="Membresías activas" value={stats.memActivas} color={COLORS.blue} Icon={Award} desc="Vigentes hoy" />
        <KPICard label="Total clientes" value={stats.totalClientes} color={COLORS.purple} Icon={Users} desc="Registrados" />
        <KPICard label="Asistencias hoy" value={stats.asistenciasHoy} color={COLORS.cyan} Icon={Calendar} desc="Visitas de hoy" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
        <ChartCard title="Ingresos por mes (últimos 6 meses)" height={260}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={ingresos} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="gradGreen" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={COLORS.green} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={COLORS.green} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="mesLabel" tick={{ fill: '#6060a0', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#6060a0', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={fmtK} />
              <Tooltip {...TOOLTIP_STYLE} formatter={(v) => [fmtMoney(v), 'Ingresos']} />
              <Area type="monotone" dataKey="total" stroke={COLORS.green} strokeWidth={2} fill="url(#gradGreen)" dot={{ fill: COLORS.green, r: 3 }} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Distribución por plan" height={260}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={planes} dataKey="cantidad" nameKey="nombre" cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={3}>
                {planes.map((_, i) => (
                  <Cell key={i} fill={[COLORS.red, COLORS.blue, COLORS.green, COLORS.yellow, COLORS.purple][i % 5]} />
                ))}
              </Pie>
              <Tooltip {...TOOLTIP_STYLE} formatter={(v) => [v + ' clientes', '']} />
              <Legend formatter={(v) => <span style={{ fontSize: 11, color: '#8080a8' }}>{v}</span>} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  )
}

// ─── Tab Ventas ───────────────────────────────────────────────────────────────

function TabVentas() {
  const [ventas, setVentas] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Misma fuente que la página Ventas: tabla ventas, filtrar completadas
    window.api.ventas.getAll({}).then(data => {
      setVentas(data || [])
      setLoading(false)
    })
  }, [])

  if (loading) return <div style={{ textAlign: 'center', padding: 40 }}><div className="spinner" style={{ margin: '0 auto' }} /></div>

  const mesActual = new Date().toISOString().slice(0, 7)
  const ventasMes = ventas.filter(v => v.estado === 'completada' && v.fecha?.startsWith(mesActual))

  // Agrupar por método (solo completadas del mes)
  const porMetodo = {}
  let totalMes = 0
  for (const v of ventasMes) {
    const m = v.metodo_pago || 'efectivo'
    porMetodo[m] = (porMetodo[m] || 0) + (v.total || 0)
    totalMes += v.total || 0
  }
  const metodosData = Object.entries(porMetodo).map(([name, value]) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), value: Math.round(value) }))

  // Ingresos por día (últimos 30 días, solo completadas)
  const porDia = {}
  const hace30 = new Date(Date.now() - 30 * 86400000)
  for (const v of ventas.filter(v => v.estado === 'completada')) {
    const fecha = v.fecha?.slice(0, 10)
    if (fecha && new Date(fecha) >= hace30) {
      porDia[fecha] = (porDia[fecha] || 0) + (v.total || 0)
    }
  }
  const diasData = Object.entries(porDia).sort(([a], [b]) => a.localeCompare(b)).map(([fecha, total]) => ({
    dia: new Date(fecha).toLocaleDateString('es-BO', { day: '2-digit', month: 'short' }),
    total: Math.round(total),
  }))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        <KPICard label="Ventas del mes" value={fmtMoney(totalMes)} color={COLORS.green} Icon={DollarSign} desc="Mes actual (completadas)" />
        <KPICard label="Transacciones" value={ventasMes.length} color={COLORS.blue} Icon={TrendingUp} desc="Este mes" />
        <KPICard label="Ticket promedio" value={fmtMoney(ventasMes.length > 0 ? totalMes / ventasMes.length : 0)} color={COLORS.purple} Icon={Award} desc="Por transacción" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
        <ChartCard title="Ingresos diarios (últimos 30 días)" height={260}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={diasData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="dia" tick={{ fill: '#6060a0', fontSize: 9 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fill: '#6060a0', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={fmtK} />
              <Tooltip {...TOOLTIP_STYLE} formatter={(v) => [fmtMoney(v), 'Ingresos']} />
              <Bar dataKey="total" fill={COLORS.blue} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Por método de pago (mes actual)" height={260}>
          {metodosData.length === 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--dim)', fontSize: 13 }}>Sin datos este mes</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={metodosData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={85} paddingAngle={3}>
                  {metodosData.map((_, i) => (
                    <Cell key={i} fill={[COLORS.green, COLORS.blue, COLORS.yellow, COLORS.red][i % 4]} />
                  ))}
                </Pie>
                <Tooltip {...TOOLTIP_STYLE} formatter={(v) => [fmtMoney(v), '']} />
                <Legend formatter={(v) => <span style={{ fontSize: 11, color: '#8080a8' }}>{v}</span>} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>
    </div>
  )
}

// ─── Tab Clientes ─────────────────────────────────────────────────────────────

function TabClientes() {
  const [stats, setStats] = useState(null)
  const [inactivos, setInactivos] = useState([])
  const [cumpleanos, setCumpleanos] = useState([])
  const [top, setTop] = useState([])

  useEffect(() => {
    Promise.all([
      window.api.dashboard.stats(),
      window.api.dashboard2.clientesInactivos(14),
      window.api.dashboard2.cumpleanosProximos(15),
      window.api.dashboard2.topClientes(10),
    ]).then(([s, i, c, t]) => {
      setStats(s)
      setInactivos(i || [])
      setCumpleanos(c || [])
      setTop(t || [])
    })
  }, [])

  if (!stats) return <div style={{ textAlign: 'center', padding: 40 }}><div className="spinner" style={{ margin: '0 auto' }} /></div>

  const topData = top.map(c => ({ nombre: `${c.nombre} ${c.apellido}`.slice(0, 18), visitas: c.visitas }))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        <KPICard label="Clientes activos" value={stats.totalClientes} color={COLORS.blue} Icon={Users} />
        <KPICard label="Membresías activas" value={stats.memActivas} color={COLORS.green} Icon={Award} />
        <KPICard label="Inactivos >14 días" value={inactivos.length} color={COLORS.red} Icon={Users} desc="Con membresía activa" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <ChartCard title="Top 10 — Asistencias del mes" height={280}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={topData} layout="vertical" margin={{ top: 0, right: 20, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" horizontal={false} />
              <XAxis type="number" tick={{ fill: '#6060a0', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="nombre" tick={{ fill: '#a0a0c0', fontSize: 10 }} axisLine={false} tickLine={false} width={110} />
              <Tooltip {...TOOLTIP_STYLE} formatter={(v) => [v + ' visitas', '']} />
              <Bar dataKey="visitas" fill={COLORS.purple} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {cumpleanos.length > 0 && (
            <div className="gym-card" style={{ padding: '16px 18px', flex: 1 }}>
              <h3 style={{ fontFamily: 'var(--display)', fontSize: 12, fontWeight: 700, color: 'var(--muted)', letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 12 }}>
                Cumpleaños próximos (15 días)
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {cumpleanos.slice(0, 6).map(c => (
                  <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderBottom: '1px solid var(--line)' }}>
                    <span style={{ fontSize: 16 }}>🎂</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)' }}>{c.nombre} {c.apellido}</div>
                      <div style={{ fontSize: 11, color: 'var(--dim)' }}>{new Date(c.fecha_nacimiento).toLocaleDateString('es-BO', { day: 'numeric', month: 'long' })} · {c.edad} años</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {inactivos.length > 0 && (
        <div className="gym-card" style={{ padding: '16px 18px' }}>
          <h3 style={{ fontFamily: 'var(--display)', fontSize: 12, fontWeight: 700, color: 'var(--muted)', letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 12 }}>
            Clientes en riesgo de baja (membresía activa, sin venir +14 días)
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {inactivos.slice(0, 8).map(c => (
              <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
                <div style={{ width: 36, height: 36, borderRadius: 9, background: 'oklch(0.66 0.22 25 / .12)', border: '1px solid oklch(0.66 0.22 25 / .25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: 'oklch(0.75 0.18 25)', flexShrink: 0 }}>
                  {c.dias_inactivo}d
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{c.nombre} {c.apellido}</div>
                  <div style={{ fontSize: 11, color: 'var(--dim)' }}>{c.plan_nombre || 'Sin plan'} · {c.telefono || 'Sin teléfono'}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Tab Asistencia ───────────────────────────────────────────────────────────

function TabAsistencia() {
  const [porHora, setPorHora] = useState([])
  const [recientes, setRecientes] = useState([])
  const [stats, setStats] = useState(null)

  useEffect(() => {
    Promise.all([
      window.api.dashboard2.asistenciasPorHora(),
      window.api.dashboard2.asistenciasHoyRecientes(20),
      window.api.dashboard.stats(),
    ]).then(([h, r, s]) => {
      const horasFull = Array.from({ length: 24 }, (_, i) => {
        const entry = (h || []).find(x => x.hora === i)
        return { hora: `${String(i).padStart(2, '0')}:00`, cantidad: entry?.cantidad || 0 }
      }).filter((_, i) => i >= 5 && i <= 22)
      setPorHora(horasFull)
      setRecientes(r || [])
      setStats(s)
    })
  }, [])

  if (!stats) return <div style={{ textAlign: 'center', padding: 40 }}><div className="spinner" style={{ margin: '0 auto' }} /></div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
        <KPICard label="Asistencias hoy" value={stats.asistenciasHoy} color={COLORS.blue} Icon={Calendar} />
        <KPICard label="Membresías activas" value={stats.memActivas} color={COLORS.green} Icon={Users} />
      </div>

      <ChartCard title="Asistencias por hora — hoy" height={240}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={porHora} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
            <XAxis dataKey="hora" tick={{ fill: '#6060a0', fontSize: 9 }} axisLine={false} tickLine={false} interval={1} />
            <YAxis tick={{ fill: '#6060a0', fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip {...TOOLTIP_STYLE} formatter={(v) => [v + ' asistencias', '']} />
            <Bar dataKey="cantidad" fill={COLORS.cyan} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {recientes.length > 0 && (
        <div className="gym-card" style={{ padding: '16px 18px' }}>
          <h3 style={{ fontFamily: 'var(--display)', fontSize: 12, fontWeight: 700, color: 'var(--muted)', letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 12 }}>
            Asistencias recientes — hoy
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {recientes.map((a, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '7px 0', borderBottom: '1px solid var(--line)' }}>
                <span style={{ fontSize: 11, color: 'var(--dim)', minWidth: 50 }}>
                  {new Date(a.fecha_hora || a.created_at).toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' })}
                </span>
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{a.nombre} {a.apellido}</span>
                  <span style={{ fontSize: 11, color: 'var(--dim)', marginLeft: 8 }}>{a.plan_nombre || ''}</span>
                </div>
                <span style={{
                  fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 8,
                  background: a.mem_estado === 'activa' ? 'oklch(0.78 0.16 155 / .15)' : 'oklch(0.66 0.22 25 / .15)',
                  color: a.mem_estado === 'activa' ? 'oklch(0.78 0.16 155)' : 'oklch(0.75 0.18 25)',
                  border: `1px solid ${a.mem_estado === 'activa' ? 'oklch(0.78 0.16 155 / .3)' : 'oklch(0.66 0.22 25 / .3)'}`,
                }}>
                  {a.mem_estado === 'activa' ? 'ACTIVA' : 'VENCIDA'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Tab Caja ─────────────────────────────────────────────────────────────────

function TabCaja() {
  const [sesiones, setSesiones] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    window.api.caja.getHistorial(60).then(data => {
      setSesiones(data || [])
      setLoading(false)
    })
  }, [])

  if (loading) return <div style={{ textAlign: 'center', padding: 40 }}><div className="spinner" style={{ margin: '0 auto' }} /></div>

  const cerradas = sesiones.filter(s => s.estado === 'cerrada')
  const totalIngresos = cerradas.reduce((s, x) => s + (x.total_ingresos || 0), 0)
  const totalEgresos = cerradas.reduce((s, x) => s + (x.total_egresos || 0), 0)
  // diferencias solo de efectivo (campo diferencia en caja_sesiones es solo de efectivo)
  const diferenciasEfectivo = cerradas.reduce((s, x) => s + Math.abs(x.diferencia || 0), 0)

  // Datos para gráfica: últimos 15 turnos (solo cerrados)
  const ultimos15 = cerradas.slice(0, 15).reverse()
  const chartData = ultimos15.map((s, i) => ({
    turno: `T${i + 1}`,
    ingresos: +(s.total_ingresos || 0).toFixed(2),
    egresos: +(s.total_egresos || 0).toFixed(2),
    dif_efectivo: +(s.diferencia || 0).toFixed(2),
  }))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        <KPICard label="Sesiones registradas" value={sesiones.length} color={COLORS.blue} Icon={Wallet} />
        <KPICard label="Total ingresos" value={fmtMoney(totalIngresos)} color={COLORS.green} Icon={TrendingUp} desc="Todos los turnos" />
        <KPICard label="Total egresos" value={fmtMoney(totalEgresos)} color={COLORS.red} Icon={TrendingUp} desc="Todos los turnos" />
        <KPICard label="Diferencias efectivo" value={fmtMoney(diferenciasEfectivo)} color={diferenciasEfectivo > 0 ? COLORS.yellow : COLORS.green} Icon={Award} desc="Solo arqueo de efectivo" />
      </div>

      {/* Gráfica: ingresos vs egresos por turno */}
      {chartData.length > 1 && (
        <ChartCard title="Ingresos vs Egresos por turno (últimos 15)">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="turno" tick={{ fill: '#8080a8', fontSize: 11 }} />
              <YAxis tick={{ fill: '#8080a8', fontSize: 11 }} tickFormatter={v => 'Bs.' + v} />
              <Tooltip {...TOOLTIP_STYLE} formatter={(v, n) => ['Bs. ' + v.toFixed(2), n === 'ingresos' ? 'Ingresos' : 'Egresos']} />
              <Legend wrapperStyle={{ fontSize: 11, color: '#8080a8' }} />
              <Bar dataKey="ingresos" name="Ingresos" fill={COLORS.green} radius={[3, 3, 0, 0]} />
              <Bar dataKey="egresos" name="Egresos" fill={COLORS.red} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      )}

      {/* Gráfica: diferencias de efectivo */}
      {chartData.length > 1 && (
        <ChartCard title="Diferencias de arqueo de efectivo por turno" height={200}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="turno" tick={{ fill: '#8080a8', fontSize: 11 }} />
              <YAxis tick={{ fill: '#8080a8', fontSize: 11 }} tickFormatter={v => v.toFixed(0)} />
              <Tooltip {...TOOLTIP_STYLE} formatter={(v) => ['Bs. ' + v.toFixed(2), 'Diferencia efectivo']} />
              <Bar dataKey="dif_efectivo" name="Dif. efectivo" radius={[3, 3, 0, 0]}
                fill={COLORS.yellow}
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      )}

      {/* Nota: historial detallado está en Ventas */}
      <div className="gym-card" style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <Wallet size={16} color="oklch(0.74 0.13 250)" style={{ flexShrink: 0 }} />
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)', marginBottom: 3 }}>Historial detallado de turnos</div>
          <div style={{ fontSize: 11, color: 'var(--dim)' }}>
            El historial completo de sesiones de caja — con arqueo, conciliación electrónica, ventas y notas — está en <strong style={{ color: 'oklch(0.74 0.13 250)' }}>Ventas → pestaña "Historial de Caja"</strong>.
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Tab Ingresos ─────────────────────────────────────────────────────────────

function TabIngresos() {
  const [pagos, setPagos] = useState([])
  const [periodo, setPeriodo] = useState('mes')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    window.api.pagos.getAll().then(data => {
      setPagos(data || [])
      setLoading(false)
    })
  }, [])

  if (loading) return <div style={{ textAlign: 'center', padding: 40 }}><div className="spinner" style={{ margin: '0 auto' }} /></div>

  const ahora = new Date()
  const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1)
  const inicioSemana = new Date(ahora); inicioSemana.setDate(ahora.getDate() - ahora.getDay())
  const inicioAnio = new Date(ahora.getFullYear(), 0, 1)

  function filtrarPeriodo(lista) {
    const corte = periodo === 'dia' ? new Date(ahora.toDateString())
                : periodo === 'semana' ? inicioSemana
                : periodo === 'mes' ? inicioMes
                : inicioAnio
    return lista.filter(p => new Date(p.fecha) >= corte)
  }

  const pagosFiltrados = filtrarPeriodo(pagos)
  const totalPeriodo = pagosFiltrados.reduce((s, p) => s + (p.monto || 0), 0)
  const porMembresias = pagosFiltrados.filter(p => !p.concepto || p.concepto.toLowerCase().includes('membresía') || p.concepto.toLowerCase().includes('plan')).reduce((s, p) => s + (p.monto || 0), 0)
  const porProductos = pagosFiltrados.filter(p => p.concepto && p.concepto.toLowerCase().includes('producto')).reduce((s, p) => s + (p.monto || 0), 0)

  // Desglose por método
  const porMetodo = {}
  for (const p of pagosFiltrados) {
    const m = p.metodo || 'efectivo'
    porMetodo[m] = (porMetodo[m] || 0) + (p.monto || 0)
  }
  const metodoData = Object.entries(porMetodo).map(([m, v]) => ({ name: m.charAt(0).toUpperCase() + m.slice(1), value: v }))

  // Ingresos por día (últimos 30 días)
  const porDia = {}
  const hace30 = new Date(ahora); hace30.setDate(ahora.getDate() - 29)
  pagos.filter(p => new Date(p.fecha) >= hace30).forEach(p => {
    const dia = new Date(p.fecha).toLocaleDateString('es-BO', { day: '2-digit', month: 'short' })
    porDia[dia] = (porDia[dia] || 0) + (p.monto || 0)
  })
  const chartData = Object.entries(porDia).map(([dia, total]) => ({ dia, total })).slice(-20)

  const METODO_COLORES = { Efectivo: COLORS.green, Qr: COLORS.blue, Tarjeta: COLORS.purple, Transferencia: COLORS.cyan }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Filtro de período */}
      <div style={{ display: 'flex', gap: 6 }}>
        {[['dia', 'Hoy'], ['semana', 'Esta semana'], ['mes', 'Este mes'], ['anio', 'Este año']].map(([id, lbl]) => (
          <button key={id} onClick={() => setPeriodo(id)} style={{
            padding: '5px 14px', borderRadius: 8, fontSize: 12, cursor: 'pointer', fontWeight: periodo === id ? 700 : 400,
            background: periodo === id ? 'oklch(0.66 0.22 25 / .18)' : 'oklch(1 0 0 / .04)',
            border: `1px solid ${periodo === id ? 'oklch(0.66 0.22 25 / .4)' : 'var(--line)'}`,
            color: periodo === id ? 'oklch(0.85 0.12 25)' : 'var(--dim)',
          }}>{lbl}</button>
        ))}
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        <KPICard label="Total ingresos" value={fmtMoney(totalPeriodo)} color={COLORS.green} Icon={DollarSign} desc="Período seleccionado" />
        <KPICard label="Por membresías" value={fmtMoney(porMembresias)} color={COLORS.blue} Icon={CreditCard} desc="Planes y renovaciones" />
        <KPICard label="Por productos" value={fmtMoney(porProductos)} color={COLORS.cyan} Icon={ShoppingCart} desc="Ventas POS" />
        <KPICard label="Cantidad de pagos" value={pagosFiltrados.length} color={COLORS.yellow} Icon={TrendingUp} />
      </div>

      {/* Gráficas */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
        {/* Ingresos por día */}
        <div className="gym-card" style={{ padding: '18px 20px' }}>
          <h3 style={{ fontFamily: 'var(--display)', fontSize: 12, fontWeight: 700, color: 'var(--muted)', letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 16 }}>
            Ingresos últimos 20 días
          </h3>
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={chartData} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="dia" tick={{ fontSize: 9, fill: '#6060a0' }} tickLine={false} />
              <YAxis tick={{ fontSize: 9, fill: '#6060a0' }} tickLine={false} axisLine={false} tickFormatter={v => 'Bs.' + fmtK(v)} />
              <Tooltip {...TOOLTIP_STYLE} formatter={v => [fmtMoney(v), 'Ingresos']} />
              <Area type="monotone" dataKey="total" stroke={COLORS.green} strokeWidth={2} fill={COLORS.green + '25'} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Desglose por método */}
        <div className="gym-card" style={{ padding: '18px 20px' }}>
          <h3 style={{ fontFamily: 'var(--display)', fontSize: 12, fontWeight: 700, color: 'var(--muted)', letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 16 }}>
            Por método de pago
          </h3>
          {metodoData.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 30, color: 'var(--dim)', fontSize: 12 }}>Sin datos</div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={110}>
                <PieChart>
                  <Pie data={metodoData} cx="50%" cy="50%" outerRadius={50} dataKey="value" label={false}>
                    {metodoData.map((m, i) => (
                      <Cell key={i} fill={Object.values(COLORS)[i % Object.values(COLORS).length]} />
                    ))}
                  </Pie>
                  <Tooltip {...TOOLTIP_STYLE} formatter={v => [fmtMoney(v)]} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 8 }}>
                {metodoData.map((m, i) => (
                  <div key={m.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 8, height: 8, borderRadius: 2, background: Object.values(COLORS)[i % Object.values(COLORS).length] }} />
                      <span style={{ color: 'var(--muted)' }}>{m.name}</span>
                    </div>
                    <span style={{ fontWeight: 600, color: 'var(--ink)' }}>{fmtMoney(m.value)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Tabla de pagos */}
      <div className="gym-card" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--line)' }}>
          <h3 style={{ fontFamily: 'var(--display)', fontSize: 12, fontWeight: 700, color: 'var(--muted)', letterSpacing: '.1em', textTransform: 'uppercase' }}>
            Detalle de pagos — {pagosFiltrados.length} registros
          </h3>
        </div>
        {pagosFiltrados.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--dim)' }}>Sin pagos en el período seleccionado</div>
        ) : (
          <div style={{ overflowX: 'auto', maxHeight: 380, overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ position: 'sticky', top: 0, background: 'oklch(0.13 0.01 250)' }}>
                <tr style={{ borderBottom: '1px solid var(--line)' }}>
                  {['Fecha', 'Cliente', 'Concepto', 'Método', 'Monto'].map(h => (
                    <th key={h} style={{ padding: '8px 14px', textAlign: 'left', fontSize: 10, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--dim)', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pagosFiltrados.map((p, i) => (
                  <tr key={p.id || i} style={{ borderBottom: '1px solid oklch(1 0 0 / .04)' }}>
                    <td style={{ padding: '9px 14px', fontSize: 11, color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                      {new Date(p.fecha).toLocaleDateString('es-BO', { day: '2-digit', month: 'short', year: '2-digit' })}
                    </td>
                    <td style={{ padding: '9px 14px', fontSize: 12, color: 'var(--ink)' }}>{p.nombre} {p.apellido}</td>
                    <td style={{ padding: '9px 14px', fontSize: 12, color: 'var(--muted)' }}>{p.concepto || 'Membresía'}</td>
                    <td style={{ padding: '9px 14px' }}>
                      <span style={{
                        fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 5,
                        background: 'oklch(0.74 0.13 250 / .12)', color: 'oklch(0.74 0.13 250)',
                        border: '1px solid oklch(0.74 0.13 250 / .25)',
                      }}>{p.metodo || 'efectivo'}</span>
                    </td>
                    <td style={{ padding: '9px 14px', fontSize: 13, fontWeight: 700, color: COLORS.green }}>{fmtMoney(p.monto)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function Reportes() {
  const [tab, setTab] = useState('general')

  return (
    <div style={{ padding: '0 2px' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 className="titulo-metalico" style={{ marginBottom: 6 }}>REPORTES</h1>
        <p style={{ fontSize: 13, color: 'var(--dim)' }}>Análisis y métricas del gimnasio</p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: 'oklch(1 0 0 / .03)', border: '1px solid var(--line)', borderRadius: 10, padding: 4 }}>
        {TABS.map(t => {
          const Icon = t.icon
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                flex: 1, padding: '8px 12px', borderRadius: 7, fontSize: 12, fontWeight: 600,
                background: tab === t.id ? 'oklch(0.66 0.22 25 / .18)' : 'transparent',
                border: tab === t.id ? '1px solid oklch(0.66 0.22 25 / .4)' : '1px solid transparent',
                color: tab === t.id ? 'oklch(0.85 0.12 25)' : 'var(--dim)',
                cursor: 'pointer', transition: 'all .2s',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}
            >
              <Icon size={13} /> {t.label}
            </button>
          )
        })}
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
          {tab === 'general' && <TabGeneral />}
          {tab === 'ingresos' && <TabIngresos />}
          {tab === 'ventas' && <TabVentas />}
          {tab === 'caja' && <TabCaja />}
          {tab === 'clientes' && <TabClientes />}
          {tab === 'asistencia' && <TabAsistencia />}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
