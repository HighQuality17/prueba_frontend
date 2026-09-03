import { Navbar } from './components/Navbar'
import { Hero } from './components/Hero'
import {
  ContactSection,
  Footer,
  IntegrationSection,
} from './components/EditorialSections'
import { StoryJourney } from './components/StoryJourney'
import { Experience } from './webgl/Experience'

export default function App() {
  return (
    <>
      <Experience />

      <div className="relative z-10">
        <Navbar />

        <main>
          <Hero />
          <StoryJourney />
          <div id="journey-end" aria-hidden="true" />
          <IntegrationSection />
          <ContactSection />
        </main>
        <Footer />
      </div>
    </>
  )
}
