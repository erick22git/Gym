import { motion } from 'framer-motion'
import CountUp from 'react-countup'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

export default function KPICard({ icon: Icon, label, value, prefix = '', suffix = '', decimals = 0, color = 'oklch(0.66 0.22 25)', trend = null, delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay, ease: 'easeOut' }}
      style={{
        background: 'transparent',
        // Antes #dropdown-glass (compartido con el resto de la app) —
        // cambiado a #top-clientes-glass (public/filters-menu-glass.svg)
        // para que los 4 KPIs tengan la misma distorsión que el resto de
        // bloques del Dashboard, pedido explícito de unificar todo el
        // Dashboard a un solo nivel. No se tocó #dropdown-glass en sí:
        // sigue siendo el que usan dropdowns/buscador/otras pantallas.
        backdropFilter: 'url(#top-clientes-glass)',
        WebkitBackdropFilter: 'url(#top-clientes-glass)',
        /* [TRAÍDO DE VUELTA] Se había sacado el "efecto gota" (halo
           difuminado + brillo de esquina) para volver al borde simple.
           Pedido explícito otra vez: quitar el marco nítido de TODAS las
           cajas del Dashboard y ponerles brillos/sombras sutiles, como
           esto — así que vuelve, y de paso se replica en Card
           (Dashboard.jsx) para que las cajas de abajo hagan juego. */
        border: '1px solid transparent',
        borderRadius: 12,
        padding: '12px 14px',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        position: 'relative',
        overflow: 'hidden',
        // Mismo boxShadow "efecto gota" que Card (Dashboard.jsx): halo
        // grande y difuso + brillo de esquina más chico y concentrado
        // encima, más el aro exterior difuminado en vez de un borde nítido.
        boxShadow: 'inset 0 1px 0 oklch(1 0 0 / .08), inset -14px -14px 28px oklch(1 0 0 / .07), inset -5px -5px 9px oklch(1 0 0 / .10), 0 0 10px 1px oklch(1 0 0 / .05), 0 30px 60px oklch(0 0 0 / .4)',
      }}
    >
      {/* Glow de fondo */}
      <div style={{
        position: 'absolute', inset: 0,
        background: `radial-gradient(ellipse at top left, ${color.replace(')', ' / .06)')}, transparent 70%)`,
        pointerEvents: 'none',
      }} />

      {/* Resplandor radial por color propio de cada KPI — generalizado a los
          4 (antes solo "Clientes activos", con oklch(0.68 0.18 200) fijo).
          Mismo patrón que la capa gris de Cumpleaños próximos (Dashboard.jsx):
          div absoluto separado, no anidado dentro de otro elemento con
          backdrop-filter propio (el backdropFilter vive en el motion.div raíz,
          no en este hijo), pointerEvents:none, mismo border-radius que la
          card. `inset:0` dentro del padre `position:relative` ya cubre el
          100% del área de CADA card (no de un sub-elemento) — cada instancia
          de KPICard tiene su propio div, así que el centro es siempre el de
          su propia card, nunca el de otra. Opacidad subida otra vez (.13/.045
          → .17/.06) a pedido. */}
      <div style={{
        position: 'absolute',
        inset: 0,
        borderRadius: 12,
        background: `radial-gradient(circle at center, ${color.replace(')', ' / 0.17)')} 0%, ${color.replace(')', ' / 0.06)')} 50%, transparent 80%)`,
        pointerEvents: 'none',
      }} />

      {/* [SOLO "Clientes activos" — pedido explícito, tras auditar la
          burbuja del menú (glass-engine/glass.css .glass-layer--rainbow +
          glass.js, sin tocar nada ahí)] Copia ESTÁTICA de esa capa de
          dispersión cromática de borde: mismo gradiente diagonal rojo→
          transparente→azul, mismo mix-blend-mode:screen, mismo recorte al
          anillo del borde vía mask-composite:exclude (padding:6 crea el
          "agujero" interior que la máscara resta). La diferencia real es
          que en el motor, JS mueve --rainbow-opacity/--rainbow-offset en
          cada frame según la velocidad del cursor — acá no hay cursor
          reaccionando a esta card específica ni un GlassMaterial montado,
          así que queda en un valor fijo (opacity 0.4) en vez de reactivo.
          Puertar el motor entero (cursor.js + renderer.js + Spring) solo
          para esta card sería mucho más de lo pedido ("solo ese"). */}
      {label === 'Clientes activos' && (
        <div style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 12,
          padding: 6,
          background: 'linear-gradient(115deg, rgba(255, 90, 70, .3) 0%, transparent 12%, transparent 88%, rgba(70, 150, 255, .3) 100%)',
          opacity: 0.4,
          mixBlendMode: 'screen',
          WebkitMask: 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
          WebkitMaskComposite: 'xor',
          maskComposite: 'exclude',
          pointerEvents: 'none',
        }} />
      )}

      {/* Cabecera — centrada (antes space-between para dejar lugar al badge
          de trend en la esquina opuesta; con el contenido centrado ese
          badge, cuando exista, se centra junto al ícono en vez de flotar
          en la esquina). */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        <div style={{
          width: 26, height: 26, borderRadius: 8,
          /* Generalizado a los 4 KPIs: se quita el chip de fondo/borde
             propio del ícono en todos — el color ya lo aporta el
             resplandor de toda la card (arriba). Se conserva el div
             (26x26, flex/center) para no mover el layout del header,
             solo pierde su relleno visual. */
          background: 'transparent',
          border: 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <Icon size={14} color={color} />
        </div>

        {trend !== null && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 4,
            fontSize: 11, fontWeight: 600,
            color: trend > 0 ? 'oklch(0.78 0.16 155)' : trend < 0 ? 'oklch(0.66 0.22 25)' : 'oklch(0.78 0.02 250 / .5)',
          }}>
            {trend > 0 ? <TrendingUp size={14} /> : trend < 0 ? <TrendingDown size={14} /> : <Minus size={14} />}
            {trend !== 0 && `${Math.abs(trend)}%`}
          </div>
        )}
      </div>

      {/* Valor — centrado (antes texto alineado a la izquierda por defecto
          de un div de bloque). */}
      <div style={{ textAlign: 'center' }}>
        <div style={{
          fontSize: 19,
          fontWeight: 700,
          fontFamily: 'Oxanium, sans-serif',
          color: 'oklch(0.97 0.01 250)',
          lineHeight: 1,
          letterSpacing: '-0.01em',
        }}>
          {prefix}
          <CountUp
            end={value}
            duration={1.8}
            delay={delay}
            decimals={decimals}
            separator=","
            decimal="."
          />
          {suffix}
        </div>
        <div style={{
          fontSize: 9,
          fontWeight: 700,
          /* Antes oklch(.../.45) — con el fondo de vidrio detrás se leía
             difuminada/poco notoria. Subida a .92 (prácticamente sólida)
             + un text-shadow SIN blur (0 de blur-radius, solo offset) para
             sumar contraste sin que la letra en sí se vea borrosa. */
          color: 'oklch(0.95 0.01 250 / .92)',
          textShadow: '0 1px 0 oklch(0 0 0 / .5)',
          marginTop: 3,
          letterSpacing: '.06em',
          textTransform: 'uppercase',
        }}>
          {label}
        </div>
      </div>
    </motion.div>
  )
}
