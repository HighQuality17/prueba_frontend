import { useEffect, useRef } from 'react'
import type { CSSProperties } from 'react'
import {
  editorialStoryEffects,
  type EditorialStoryEffect,
} from '../webgl/timeline/experienceTimeline'
import {
  segmentProgress,
  smootherstep01,
} from '../webgl/timeline/mapJourneyProgress'
import { subscribeJourneyProgress } from '../webgl/timeline/useJourneyScroll'

const STORIES = [
  {
    key: 'origin',
    index: '01',
    section: 'Origen',
    label: 'Origen',
    title: 'Antes de ser tendencia, fue tradición.',
    body: 'En distintas culturas, ciertas plantas y hongos han ocupado un lugar ceremonial durante generaciones. Su significado no nace únicamente de una sustancia, sino del contexto: comunidad, intención, música, silencio y acompañamiento.',
    placement: 'story-card--left',
  },
  {
    key: 'ayahuasca',
    index: '02',
    section: 'Ayahuasca',
    label: 'Amazonía',
    title: 'La selva como maestra.',
    body: 'La ayahuasca forma parte de diversas tradiciones amazónicas. En contextos ceremoniales suele asociarse con introspección, memoria emocional y una percepción distinta de la relación entre individuo, comunidad y naturaleza.',
    note: 'La experiencia puede ser intensa y no está exenta de riesgos. El contexto y el acompañamiento importan.',
    placement: 'story-card--right',
  },
  {
    key: 'psilocybin',
    index: '03',
    section: 'Psilocibina',
    label: 'Tradición y estudio contemporáneo',
    title: 'Cambiar la forma de mirar.',
    body: 'Los hongos con psilocibina han tenido usos rituales en distintas culturas. Hoy también son objeto de investigación científica en contextos clínicos controlados, especialmente por su relación con percepción, emoción e introspección.',
    note: 'Investigación no significa tratamiento universal. Los resultados dependen del contexto, la persona y la supervisión profesional.',
    placement: 'story-card--left story-card--upper',
  },
  {
    key: 'geometry',
    index: '04',
    section: 'Visión',
    label: 'Visión',
    title: 'A veces la experiencia habla en símbolos.',
    body: 'Patrones repetidos, simetrías, animales, colores y formas imposibles aparecen con frecuencia en relatos de experiencias visionarias. No necesitan una interpretación única: pueden funcionar como espejos sobre los que cada persona proyecta significado.',
    placement: 'story-card--right story-card--upper',
  },
  {
    key: 'tiger',
    index: '05',
    section: 'Tigre',
    label: 'Fuerza',
    title: 'Habitar la propia fuerza.',
    body: 'El tigre aparece aquí como un símbolo de presencia, instinto y capacidad de sostener aquello que normalmente evitamos mirar.',
    placement: 'story-card--lower-left story-card--compact',
  },
  {
    key: 'serpent',
    index: '06',
    section: 'Serpiente',
    label: 'Transformación',
    title: 'Cambiar también implica soltar.',
    body: 'La serpiente representa transformación: abandonar una forma conocida para permitir que aparezca otra. En este viaje, su geometría se construye con las mismas líneas que antes formaban el mandala.',
    placement: 'story-card--lower-right story-card--compact',
  },
  {
    key: 'eagle',
    index: '07',
    section: 'Águila',
    label: 'Perspectiva',
    title: 'Alejarse también puede ser una forma de comprender.',
    body: 'El águila simboliza perspectiva. Después de atravesar intensidad, forma y transformación, el recorrido termina ampliando el campo de visión.',
    placement: 'story-card--lower-left story-card--compact',
  },
] as const

type StoryKey = (typeof STORIES)[number]['key']
type StoryStyle = CSSProperties & {
  '--story-opacity': number
  '--story-shift': string
}

function storyMotion(progress: number, effect: EditorialStoryEffect) {
  const entering = smootherstep01(segmentProgress(progress, effect.enter))
  const exiting = smootherstep01(segmentProgress(progress, effect.exit))
  return {
    opacity: entering * (1 - exiting),
    shift: 18 * (1 - entering) - 12 * exiting,
  }
}

export function StoryJourney() {
  const storyRefs = useRef<Partial<Record<StoryKey, HTMLElement>>>({})

  useEffect(
    () =>
      subscribeJourneyProgress((progress) => {
        STORIES.forEach(({ key }) => {
          const element = storyRefs.current[key]
          if (!element) return
          const motion = storyMotion(progress, editorialStoryEffects[key])
          element.style.setProperty('--story-opacity', motion.opacity.toFixed(4))
          element.style.setProperty('--story-shift', `${motion.shift.toFixed(2)}px`)
        })
      }),
    [],
  )

  return (
    <section id="recorrido" className="story-journey" aria-label="Recorrido editorial">
      <span id="origen" className="journey-anchor journey-anchor--origin" />
      <span id="medicinas" className="journey-anchor journey-anchor--medicinas" />
      <div className="story-stage">
        {STORIES.map((story) => (
          <article
            key={story.key}
            ref={(element) => {
              if (element) storyRefs.current[story.key] = element
            }}
            className={`story-card ${story.placement}`}
            style={
              {
                '--story-opacity': 0,
                '--story-shift': '18px',
              } as StoryStyle
            }
          >
            <div className="story-index" aria-hidden="true">
              <span>{story.index}</span>
              <span>{story.section}</span>
            </div>
            <p className="story-eyebrow">{story.label}</p>
            <h2>{story.title}</h2>
            <p className="story-body">{story.body}</p>
            {'note' in story && <p className="story-note">{story.note}</p>}
          </article>
        ))}
      </div>
    </section>
  )
}
