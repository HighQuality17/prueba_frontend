export const particlesVertexShader = /* glsl */ `
uniform float uTime;
uniform float uPixelRatio;
uniform float uMorphProgress;
uniform float uSourceMotionAmplitude;
uniform float uTargetMotionAmplitude;
uniform float uSourceRotationAmount;
uniform float uTargetRotationAmount;

attribute vec3 aPositionSource;
attribute vec3 aPositionTarget;
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

  vec3 base = mix(aPositionSource, aPositionTarget, uMorphProgress);

  // Transitional swirl peaks midway and vanishes at both shape endpoints.
  float swirl = max(0.0, sin(uMorphProgress * 3.14159265)) * 0.18;
  base += normalize(base + vec3(0.0001)) * swirl * (0.4 + aSeed);

  float rotationAmount = mix(
    uSourceRotationAmount,
    uTargetRotationAmount,
    uMorphProgress
  );
  base = rotateY(base, uTime * 0.15 * rotationAmount);

  // Layered low-frequency trigonometric displacement, unique per particle.
  float t = uTime * 0.35;
  float amplitude = mix(
    uSourceMotionAmplitude,
    uTargetMotionAmplitude,
    uMorphProgress
  );
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
