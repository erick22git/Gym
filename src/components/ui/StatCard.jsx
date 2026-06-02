export default function StatCard({ label, value, sub, icon: Icon, color, onClick }) {
  const iconStyle = color
    ? { background: color + '22', border: `1px solid ${color}44`, borderRadius: 12, padding: 10 }
    : {}

  return (
    <div
      className="stat-card"
      style={{ cursor: onClick ? 'pointer' : 'default', transition: 'border-color .2s' }}
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="stat-label">{label}</div>
          <div className="stat-value" style={{ fontSize: typeof value === 'string' && value.length > 10 ? 22 : 32 }}>
            {value}
          </div>
          {sub && (
            <div style={{ fontSize: 11.5, color: 'oklch(0.78 0.02 250 / .42)', marginTop: 8, letterSpacing: '.04em' }}>
              {sub}
            </div>
          )}
        </div>
        {Icon && (
          <div style={iconStyle} className={!color ? 'stat-icon' : undefined}>
            <Icon size={20} color={color || 'oklch(0.78 0.02 250 / .6)'} />
          </div>
        )}
      </div>
    </div>
  )
}
