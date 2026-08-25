import { useState } from 'react'

const NAV_LINKS = [
  { label: 'Manifesto', href: '#manifesto' },
  { label: 'Practice', href: '#practice' },
  { label: 'Field Notes', href: '#notes' },
]

export function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <header className="fixed inset-x-0 top-0 z-20">
      <nav
        aria-label="Primary"
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
            <path d="M9 1L17 15H1L9 1Z" fill="#8052ff" />
          </svg>
          <span className="text-nav-label tracking-nav-label font-semibold uppercase text-bone-white">
            Prisma
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
          <a href="#join" className="btn-primary">
            Join Us
          </a>
          <button
            type="button"
            className="nav-link md:hidden"
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? 'Close' : 'Menu'}
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
