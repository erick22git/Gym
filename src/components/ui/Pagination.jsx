import { ChevronLeft, ChevronRight } from 'lucide-react'

const RED = 'oklch(0.66 0.22 25)'

function genPages(page, totalPages) {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1)
  const pages = []
  if (page <= 4) {
    for (let i = 1; i <= 5; i++) pages.push(i)
    pages.push('...')
    pages.push(totalPages)
  } else if (page >= totalPages - 3) {
    pages.push(1)
    pages.push('...')
    for (let i = totalPages - 4; i <= totalPages; i++) pages.push(i)
  } else {
    pages.push(1)
    pages.push('...')
    pages.push(page - 1)
    pages.push(page)
    pages.push(page + 1)
    pages.push('...')
    pages.push(totalPages)
  }
  return pages
}

export default function Pagination({ page, pageSize, total, onPageChange, onPageSizeChange, pageSizeOptions = [10, 25, 50] }) {
  if (!total) return null
  const totalPages = Math.ceil(total / pageSize)
  const from = (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)
  const pages = genPages(page, totalPages)

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '12px 4px', flexWrap: 'wrap', gap: 10,
    }}>
      <span style={{ fontSize: 12, color: 'var(--dim)', whiteSpace: 'nowrap' }}>
        Mostrando <strong style={{ color: 'var(--muted)' }}>{from}–{to}</strong> de <strong style={{ color: 'var(--muted)' }}>{total}</strong> registros
      </span>

      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1}
          style={{
            padding: '5px 10px', borderRadius: 7, border: '1px solid var(--line)',
            background: 'var(--glass)', color: page === 1 ? 'var(--dim)' : 'var(--ink)',
            cursor: page === 1 ? 'default' : 'pointer', fontSize: 12,
            display: 'flex', alignItems: 'center', gap: 3, opacity: page === 1 ? 0.4 : 1,
          }}
        >
          <ChevronLeft size={13} /> Anterior
        </button>

        {pages.map((p, i) => (
          p === '...' ? (
            <span key={`dots-${i}`} style={{ padding: '5px 6px', fontSize: 12, color: 'var(--dim)' }}>…</span>
          ) : (
            <button
              key={p}
              onClick={() => onPageChange(p)}
              style={{
                minWidth: 32, height: 30, borderRadius: 7,
                border: p === page ? `1px solid ${RED}60` : '1px solid var(--line)',
                background: p === page ? `${RED}18` : 'var(--glass)',
                color: p === page ? 'oklch(0.85 0.12 25)' : 'var(--ink)',
                cursor: p === page ? 'default' : 'pointer',
                fontSize: 12, fontWeight: p === page ? 700 : 400,
                transition: 'all .15s',
              }}
            >
              {p}
            </button>
          )
        ))}

        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page === totalPages}
          style={{
            padding: '5px 10px', borderRadius: 7, border: '1px solid var(--line)',
            background: 'var(--glass)', color: page === totalPages ? 'var(--dim)' : 'var(--ink)',
            cursor: page === totalPages ? 'default' : 'pointer', fontSize: 12,
            display: 'flex', alignItems: 'center', gap: 3, opacity: page === totalPages ? 0.4 : 1,
          }}
        >
          Siguiente <ChevronRight size={13} />
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 11, color: 'var(--dim)', whiteSpace: 'nowrap' }}>Por página:</span>
        <select
          value={pageSize}
          onChange={e => { onPageSizeChange(Number(e.target.value)); onPageChange(1) }}
          style={{
            background: 'oklch(0.14 0.015 250)', border: '1px solid var(--line)', borderRadius: 7,
            padding: '4px 8px', fontSize: 12, color: 'var(--ink)', cursor: 'pointer',
            colorScheme: 'dark',
          }}
        >
          {pageSizeOptions.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
    </div>
  )
}
