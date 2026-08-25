import type { ReactNode } from 'react'

interface ContentSectionProps {
  id?: string
  eyebrow: string
  title: string
  children?: ReactNode
  /** Which side of the viewport the text column sits on */
  align?: 'left' | 'right'
  /** Renders an isolated oversized statement instead of a two-column block */
  isolated?: boolean
}

export function ContentSection({
  id,
  eyebrow,
  title,
  children,
  align = 'left',
  isolated = false,
}: ContentSectionProps) {
  const alignmentClasses =
    align === 'right' ? 'lg:col-start-2' : 'lg:col-start-1'

  if (isolated) {
    return (
      <section
        id={id}
        className="relative flex min-h-[80vh] items-center overflow-hidden"
      >
        <div className="mx-auto w-full max-w-page px-6 py-96 md:px-60">
          <div className="flex flex-col items-start gap-30">
            <p className="eyebrow-label">{eyebrow}</p>
            <h2 className="max-w-[16ch] text-subheading font-normal text-bone-white sm:text-heading-sm sm:tracking-heading-sm lg:text-heading lg:tracking-heading">
              {title}
            </h2>
            {children}
          </div>
        </div>
      </section>
    )
  }

  return (
    <section
      id={id}
      className="relative flex min-h-screen items-center overflow-hidden"
    >
      <div className="mx-auto w-full max-w-page px-6 py-96 md:px-60">
        <div className="grid gap-60 lg:grid-cols-2">
          <div
            className={`flex flex-col items-start gap-30 ${alignmentClasses}`}
          >
            <p className="eyebrow-label">{eyebrow}</p>

            <h2 className="max-w-[14ch] text-heading-sm tracking-heading-sm font-normal text-bone-white lg:text-heading-lg lg:leading-heading-lg lg:tracking-heading-lg">
              {title}
            </h2>

            <div className="max-w-[520px] text-body leading-body font-extralight text-silver-mist [&_strong]:font-semibold [&_strong]:text-bone-white">
              {children}
            </div>
          </div>

          {/* Opposite column stays empty: negative space for future WebGL */}
          <div aria-hidden="true" className="hidden lg:block" />
        </div>
      </div>
    </section>
  )
}
