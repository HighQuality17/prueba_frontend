const INTEGRATION_CONCEPTS = [
  {
    title: 'Escuchar',
    body: 'Dar espacio antes de interpretar.',
  },
  {
    title: 'Integrar',
    body: 'Traducir una experiencia intensa a la vida cotidiana.',
  },
  {
    title: 'Acompañar',
    body: 'Reconocer cuándo es útil buscar apoyo profesional.',
  },
]

export function IntegrationSection() {
  return (
    <section id="integracion" className="grounded-section">
      <div className="editorial-shell">
        <p className="section-kicker">Después del umbral</p>
        <h2>La experiencia no termina cuando termina la ceremonia.</h2>
        <p className="grounded-intro">
          Integrar significa volver a la vida cotidiana y encontrar una manera
          responsable de relacionarse con lo vivido. Conversar, escribir,
          descansar, pedir acompañamiento y evitar decisiones impulsivas pueden
          ser partes importantes de ese proceso.
        </p>

        <div className="concept-list">
          {INTEGRATION_CONCEPTS.map((concept, index) => (
            <article key={concept.title}>
              <span aria-hidden="true">0{index + 1}</span>
              <h3>{concept.title}</h3>
              <p>{concept.body}</p>
            </article>
          ))}
        </div>

        <aside className="disclaimer" aria-label="Información responsable">
          <span>Nota informativa</span>
          <p>
            Este proyecto es una experiencia artística y educativa. No ofrece
            diagnóstico, tratamiento ni recomendación de consumo. Algunas
            sustancias mencionadas pueden presentar riesgos, interacciones y
            restricciones legales según el país.
          </p>
        </aside>
      </div>
    </section>
  )
}

export function ContactSection() {
  return (
    <section id="contacto" className="contact-section">
      <div className="editorial-shell contact-grid">
        <div>
          <p className="section-kicker">Casa Umbral</p>
          <h2>Conversaciones que empiezan después del viaje.</h2>
          <p className="contact-intro">
            Un espacio ficticio para encuentros, charlas sobre tradición,
            integración y cultura psicodélica.
          </p>
        </div>

        <address className="contact-details">
          <p>Casa Umbral</p>
          <p>Manizales, Colombia</p>
          <a href="mailto:hola@casaumbral.example">hola@casaumbral.example</a>
          <a href="tel:+573000000000">+57 300 000 0000</a>
          <p>Instagram · @casaumbral.demo</p>
          <small>
            Información ficticia utilizada únicamente como demostración del
            diseño.
          </small>
        </address>
      </div>
    </section>
  )
}

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="editorial-shell footer-grid">
        <div>
          <a href="#top" className="footer-brand">UMBRAL</a>
          <p>Arte · Tradición · Conciencia</p>
        </div>
        <nav aria-label="Navegación de pie de página">
          <a href="#origen">Origen</a>
          <a href="#medicinas">Medicinas</a>
          <a href="#integracion">Integración</a>
          <a href="#contacto">Contacto</a>
        </nav>
        <p className="footer-legal">© 2026 Casa Umbral<br />Proyecto conceptual.</p>
      </div>
    </footer>
  )
}
