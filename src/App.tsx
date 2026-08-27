import { Navbar } from './components/Navbar'
import { Hero } from './components/Hero'
import { ContentSection } from './components/ContentSection'
import { CTASection } from './components/CTASection'
import { LifeScrollSection } from './components/LifeScrollSection'
import { Experience } from './webgl/Experience'

export default function App() {
  return (
    <>
      {/* Fixed WebGL layer behind everything */}
      <Experience />

      <div className="relative z-10">
        <Navbar />

        <main>
          <Hero />

          <ContentSection
            id="manifesto"
            eyebrow="Manifesto"
            title="Intelligence was never meant to be solitary."
            align="left"
          >
            <p>
              The sharpest thinking rarely happens inside one head. It happens
              in the space between people — in arguments, sketches, half-finished
              sentences and accidental discoveries.
            </p>
            <p>
              We design environments where those collisions can happen on
              purpose, at scale, without losing the human texture that makes
              them valuable.
            </p>
          </ContentSection>

          <ContentSection
            eyebrow="Principle"
            title="Structure should amplify thought, not contain it."
            align="right"
          >
            <p>
              Most tools ask you to think in their shape. Ours bend around the
              way a group already thinks — loose enough to explore, precise
              enough to remember what mattered.
            </p>
          </ContentSection>

          <ContentSection
            id="practice"
            eyebrow="The Practice"
            title="We prototype with people before we build with code."
            align="left"
          >
            <p>
              Every system we ship starts as a live experiment: small groups,
              hard problems, honest feedback. Technology earns its place only
              after the collaboration works without it.
            </p>
          </ContentSection>

          <ContentSection
            id="notes"
            eyebrow="Field Note 01"
            title="A question held openly by many minds resolves faster than an answer defended by one."
            isolated
          />

          <CTASection />
          <LifeScrollSection />
        </main>
      </div>
    </>
  )
}
