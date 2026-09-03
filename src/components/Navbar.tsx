import { useState } from 'react'

const NAV_LINKS = [
  { label: 'Origen', href: '#origen' },
  { label: 'Medicinas', href: '#medicinas' },
  { label: 'Integración', href: '#integracion' },
  { label: 'Contacto', href: '#contacto' },
]

export function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <header className="site-header fixed inset-x-0 top-0 z-20">
      <nav
        aria-label="Navegación principal"
        className="mx-auto flex max-w-page items-center justify-between px-6 py-30 md:px-60"
      >
        <a href="#top" className="flex items-center gap-12">
          <svg
            width="18"
            height="18"
            viewBox="0 0 18 18"
            fill="none"
            aria-hidden="true"
          >
            <circle cx="9" cy="9" r="7.25" stroke="currentColor" />
            <path d="M9 2.5V15.5M2.5 9H15.5" stroke="currentColor" />
          </svg>
          <span className="text-nav-label tracking-nav-label font-semibold uppercase text-bone-white">
            Umbral
          </span>
        </a>

        <ul className="hidden items-center gap-36 md:flex">
          {NAV_LINKS.map((link) => (
            <li key={link.href}>
              <a href={link.href} className="nav-link">
                {link.label}
              </a>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-18">
          <a href="#contacto" className="btn-primary nav-cta">
            Conocer el espacio
          </a>
          <button
            type="button"
            className="nav-link md:hidden"
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? 'Cerrar' : 'Menú'}
          </button>
        </div>
      </nav>

      {menuOpen && (
        <ul
          id="mobile-menu"
          className="mx-6 flex flex-col items-start gap-18 bg-black p-24 md:hidden"
        >
          {NAV_LINKS.map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                className="nav-link"
                onClick={() => setMenuOpen(false)}
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>
      )}
    </header>
  )
}
