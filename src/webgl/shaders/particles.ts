export const particlesVertexShader = /* glsl */ `
uniform float uTime;
uniform float uPixelRatio;
uniform float uShapeProgress;

attribute vec3 aPositionSphere;
attribute vec3 aPositionHelix;
attribute vec3 aPositionMesh;
attribute float aSize;
attribute float aSeed;
attribute vec3 aColor;

varying vec3 vColor;
varying float vTwinkle;
varying float vRotation;

// Rotate a vector around the Y axis.
vec3 rotateY(vec3 v, float a) {
  float c = cos(a);
  float s = sin(a);
  return vec3(c * v.x + s * v.z, v.y, -s * v.x + c * v.z);
}

void main() {
  vColor = aColor;
  vRotation = aSeed * 6.2831853;

  /*
    Piecewise four-state morph, branchless:
      seg1 blends cloud -> sphere over progress [0, 1]
      seg2 blends the result -> helix over progress [1, 2]
      seg3 blends the result -> torus knot over progress [2, 3]
    Chaining one more mix() extends this to a fifth state.
    Only uShapeProgress changes at runtime; all targets are static.
  */
  float p = uShapeProgress;
  float seg1 = clamp(p, 0.0, 1.0);
  float seg2 = clamp(p - 1.0, 0.0, 1.0);
  float seg3 = clamp(p - 2.0, 0.0, 1.0);

  vec3 stage1 = mix(position, aPositionSphere, seg1);
  vec3 stage2 = mix(stage1, aPositionHelix, seg2);
  vec3 base = mix(stage2, aPositionMesh, seg3);

  // Transitional swirl peaks midway through any segment and vanishes
  // exactly at each stable shape endpoint.
  float swirl = max(max(sin(seg1 * 3.14159265), sin(seg2 * 3.14159265)), sin(seg3 * 3.14159265)) * 0.18;
  base += normalize(base + vec3(0.0001)) * swirl * (0.4 + aSeed);

  // Flow: while in / approaching the helix state the whole structure
  // slowly rotates around its axis, entirely GPU-driven. The rotation
  // fades out again so the knot silhouette stays stable.
  base = rotateY(base, uTime * 0.15 * seg2 * (1.0 - seg3 * 0.85));

  // Layered low-frequency trigonometric displacement, unique per particle.
  // Amplitude follows the structure's order: alive cloud, ordered sphere,
  // gently flowing helix, calm knot surface.
  float t = uTime * 0.35;
  float amplitude = mix(1.0, 0.35, seg1);
  amplitude = mix(amplitude, 0.6, seg2);
  amplitude = mix(amplitude, 0.4, seg3);
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
