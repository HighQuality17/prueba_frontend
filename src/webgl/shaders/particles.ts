export const particlesVertexShader = /* glsl */ `
uniform float uTime;
uniform float uPixelRatio;
uniform float uMorphProgress;

attribute vec3 aPositionSphere;
attribute float aSize;
attribute float aSeed;
attribute vec3 aColor;

varying vec3 vColor;
varying float vTwinkle;
varying float vRotation;

void main() {
  vColor = aColor;
  vRotation = aSeed * 6.2831853;

  // GPU-only morph: both targets are static buffers, only the uniform moves.
  // sin() adds a subtle outward swirl mid-transition so the path between
  // shapes is not a straight mechanical line.
  float morph = uMorphProgress;
  float swirl = sin(morph * 3.14159265) * 0.18;

  vec3 base = mix(position, aPositionSphere, morph);
  base += normalize(base + 0.0001) * swirl * (0.4 + aSeed);

  // Layered low-frequency trigonometric displacement, unique per particle.
  // Runs entirely on the GPU; positions never leave the buffers.
  // Amplitude is damped as the structure becomes ordered so the sphere
  // silhouette stays recognizable.
  float t = uTime * 0.35;
  float amplitude = mix(1.0, 0.35, morph);
  vec3 pos = base;
  pos.x += sin(t * 0.9 + aSeed * 6.2831853 + base.y * 1.6) * 0.07 * amplitude;
  pos.y += cos(t * 0.7 + aSeed * 12.9898 + base.z * 1.3) * 0.07 * amplitude;
  pos.z += sin(t * 0.5 + aSeed * 78.233 + base.x * 1.1) * 0.05 * amplitude;

  vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mvPosition;

  gl_PointSize = aSize * uPixelRatio * (10.0 / -mvPosition.z);

  // Gentle asynchronous brightness breathing.
  vTwinkle = 0.75 + 0.25 * sin(t * 1.4 + aSeed * 40.0);
}
`

export const particlesFragmentShader = /* glsl */ `
varying vec3 vColor;
varying float vTwinkle;
varying float vRotation;

// Signed distance to an equilateral triangle (circumradius ~1, centered).
float triangleDistance(vec2 p) {
  float d1 = dot(p, vec2(-0.8660254, 0.5));
  float d2 = dot(p, vec2(0.8660254, 0.5));
  float d3 = -p.y;
  return max(max(d1, d2), d3) - 0.5;
}

void main() {
  vec2 p = gl_PointCoord * 2.0 - 1.0;

  float c = cos(vRotation);
  float s = sin(vRotation);
  p = mat2(c, -s, s, c) * p;

  float d = triangleDistance(p * 0.82);

  // Small fixed smoothing band: sharp edges, minimal antialiasing cost.
  float alpha = 1.0 - smoothstep(-0.08, 0.08, d);
  if (alpha < 0.01) discard;

  gl_FragColor = vec4(vColor, alpha * vTwinkle);
}
`
