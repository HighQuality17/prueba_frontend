export function Hero() {
  return (
    <section
      id="top"
      className="hero-section relative flex min-h-screen items-center overflow-hidden"
    >
      <div className="mx-auto w-full max-w-page px-6 py-120 md:px-60">
        <div className="grid items-center gap-60 lg:grid-cols-2">
          <div className="flex flex-col items-start gap-30">
            <p className="eyebrow-label">Medicinas sagradas · Memoria · Conciencia</p>

            <h1 className="hero-title max-w-[13ch] text-bone-white">
              Hay conocimientos que no se explican. Se atraviesan.
            </h1>

            <p className="max-w-[540px] text-body leading-body font-extralight text-silver-mist">
              Un recorrido visual por símbolos, plantas, rituales y tradiciones
              que durante generaciones han acompañado procesos de introspección,
              comunidad y búsqueda de sentido.
            </p>

            <div className="flex flex-col items-start gap-18">
              <a href="#recorrido" className="btn-primary">
                Explorar el recorrido
              </a>
              <p className="hero-instruction">Desplázate para entrar.</p>
            </div>
          </div>

          <div aria-hidden="true" className="hidden lg:block" />
        </div>
      </div>
    </section>
  )
}
