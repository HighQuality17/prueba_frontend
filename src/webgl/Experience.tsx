import { useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import type { Mesh } from 'three'

/**
 * Temporary placeholder object.
 * The final particle constellation replaces this in a later phase.
 */
function PlaceholderObject() {
  const meshRef = useRef<Mesh>(null)

  useFrame((_, delta) => {
    if (!meshRef.current) return
    meshRef.current.rotation.y += delta * 0.15
    meshRef.current.rotation.x += delta * 0.05
  })

  return (
    <mesh ref={meshRef} scale={1.4}>
      <icosahedronGeometry args={[1, 1]} />
      <meshBasicMaterial
        color="#8052ff"
        wireframe
        transparent
        opacity={0.35}
      />
    </mesh>
  )
}

/**
 * Fixed WebGL layer that lives behind all HTML content.
 * - pointer-events-none so the UI stays fully interactive
 * - z-index 0 while page content renders above (z-10)
 * - DPR capped for performance on high-density screens
 */
export function Experience() {
  return (
    <div className="pointer-events-none fixed inset-0 z-0" aria-hidden="true">
      <Canvas
        camera={{ position: [0, 0, 5], fov: 45 }}
        dpr={[1, 1.75]}
        gl={{ alpha: true, antialias: true }}
        style={{ background: 'transparent' }}
      >
        <PlaceholderObject />
      </Canvas>
    </div>
  )
}
