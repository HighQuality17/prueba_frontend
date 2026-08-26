export const particlesVertexShader = /* glsl */ `
uniform float uTime;
uniform float uPixelRatio;
uniform float uMorphProgress;
uniform float uRadialScale;
uniform float uDistortionStrength;
uniform float uDistortionPhase;
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

float hash31(vec3 p) {
  return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453);
}

float valueNoise(vec3 p) {
  vec3 cell = floor(p);
  vec3 localCoord = fract(p);
  localCoord = localCoord * localCoord * (3.0 - 2.0 * localCoord);

  float n000 = hash31(cell + vec3(0.0, 0.0, 0.0));
  float n100 = hash31(cell + vec3(1.0, 0.0, 0.0));
  float n010 = hash31(cell + vec3(0.0, 1.0, 0.0));
  float n110 = hash31(cell + vec3(1.0, 1.0, 0.0));
  float n001 = hash31(cell + vec3(0.0, 0.0, 1.0));
  float n101 = hash31(cell + vec3(1.0, 0.0, 1.0));
  float n011 = hash31(cell + vec3(0.0, 1.0, 1.0));
  float n111 = hash31(cell + vec3(1.0, 1.0, 1.0));

  float bottom = mix(
    mix(n000, n100, localCoord.x),
    mix(n010, n110, localCoord.x),
    localCoord.y
  );
  float top = mix(
    mix(n001, n101, localCoord.x),
    mix(n011, n111, localCoord.x),
    localCoord.y
  );
  return mix(bottom, top, localCoord.z);
}

float fbm(vec3 p) {
  float value = 0.0;
  float amplitude = 0.5;

  for (int octave = 0; octave < 3; octave++) {
    value += amplitude * valueNoise(p);
    p = p * 2.03 + vec3(0.71, 1.37, 2.17);
    amplitude *= 0.5;
  }

  return value / 0.875;
}

void main() {
  vColor = aColor;
  vRotation = aSeed * 6.2831853;

  vec3 base = mix(aPositionSource, aPositionTarget, uMorphProgress);

  // Transitional swirl peaks midway and vanishes at both shape endpoints.
  float swirl = max(0.0, sin(uMorphProgress * 3.14159265)) * 0.18;
  base += normalize(base + vec3(0.0001)) * swirl * (0.4 + aSeed);

  // Generic origin-centered deformation track, independent of shape type.
  base *= uRadialScale;

  if (uDistortionStrength > 0.0) {
    // Scroll-phased coherent distortion: one low-frequency domain warp feeds
    // a compact three-octave fBm field, producing radial lobes and soft folds.
    vec3 phaseOffset = vec3(
      uDistortionPhase * 2.1,
      -uDistortionPhase * 1.7,
      uDistortionPhase * 1.3
    );
    vec3 domain = base * 1.35 + phaseOffset;
    float warp = valueNoise(domain * 0.72 + vec3(4.2, -1.7, 2.8));
    vec3 warpedDomain = domain
      + (warp - 0.5) * vec3(1.1, -0.85, 0.95);
    float field = fbm(warpedDomain);
    float radialField = field * 2.0 - 1.0;
    float foldField = sin(
      (field * 1.6 + warp + uDistortionPhase * 0.4) * 6.2831853
    );

    float baseLength = max(length(base), 0.0001);
    vec3 radialDirection = base / baseLength;
    vec3 tangentDirection = cross(
      radialDirection,
      vec3(0.37, 0.83, 0.41)
    );
    tangentDirection /= max(length(tangentDirection), 0.0001);

    base += radialDirection * radialField * uDistortionStrength;
    base += tangentDirection * foldField * uDistortionStrength * 0.22;
  }

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
