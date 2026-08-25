export function Hero() {
  return (
    <section
      id="top"
      className="relative flex min-h-screen items-center overflow-hidden"
    >
      <div className="mx-auto w-full max-w-page px-6 py-120 md:px-60">
        <div className="grid items-center gap-60 lg:grid-cols-2">
          {/* Left: oversized headline + supporting copy + single CTA */}
          <div className="flex flex-col items-start gap-36">
            <p className="eyebrow-label">Collective Intelligence</p>

            <h1 className="max-w-[12ch] text-heading leading-heading tracking-heading font-normal text-bone-white sm:text-heading-lg sm:leading-heading-lg sm:tracking-heading-lg lg:text-display lg:leading-display lg:tracking-display">
              Many minds, one signal.
            </h1>

            <p className="max-w-[480px] text-body leading-body font-extralight text-silver-mist">
              We build tools where human intuition and machine reasoning think
              together — turning scattered perspectives into shared clarity.
            </p>

            <a href="#manifesto" className="btn-primary">
              Enter the Field
            </a>
          </div>

          {/* Right: intentional negative space reserved for the WebGL constellation */}
          <div aria-hidden="true" className="hidden lg:block" />
        </div>
      </div>
    </section>
  )
}
