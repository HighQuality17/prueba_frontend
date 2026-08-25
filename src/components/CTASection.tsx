export function CTASection() {
  return (
    <section
      id="join"
      className="relative flex min-h-[170vh] items-start overflow-hidden pt-[40vh]"
    >
      <div className="mx-auto flex w-full max-w-page flex-col items-center gap-36 px-6 py-120 text-center md:px-60">
        <p className="eyebrow-label">Open Invitation</p>

        <h2 className="max-w-[14ch] text-heading-sm tracking-heading-sm font-normal text-bone-white sm:text-heading sm:tracking-heading lg:text-heading-lg lg:leading-heading-lg lg:tracking-heading-lg">
          The next idea is already between us.
        </h2>

        <p className="max-w-[520px] text-body leading-body font-extralight text-silver-mist">
          Bring a question you cannot solve alone. We will bring a room full of
          people who can.
        </p>

        <a href="#top" className="btn-primary">
          Request Access
        </a>
      </div>
    </section>
  )
}
