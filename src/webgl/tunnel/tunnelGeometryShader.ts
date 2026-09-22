/*
  Geometry tunnel shaders.

  The vertex stage reconstructs the curated mandala families on a small tube
  ribbon grid, one instance per (layer, cell). All radial displacement happens
  on vertices, so the cost scales with a few thousand vertices instead of every
  screen pixel. The fragment stage only shades the thin neon ribbons: palette,
  Fresnel rim, biological tint and exponential fog toward black.
*/

export const tunnelGeometryVertexShader = /* glsl */ `
attribute float aAngle;
attribute vec2 aCross;
attribute float aCell;
attribute float aLayerId;
attribute float aRadius;
attribute float aThickness;
attribute float aTwist;
attribute float aZCoef;
attribute float aOrganic;

uniform float uTravel;
uniform float uReveal;
uniform float uTwist;
uniform float uColorPhase;
uniform vec2 uFamilyEvolution;
uniform float uOrganicStrength;
uniform float uCellularStrength;
uniform float uOrganicCore;
uniform float uOrganicPulse;
uniform float uOrganicAsymmetry;
uniform float uDetail;
uniform float uCellLength;
uniform float uSpan;
uniform float uFogDensity;
uniform float uMaxRayDistance;

varying vec3 vWorldPosition;
varying vec3 vNormal;
varying float vFog;
varying float vLayerId;
varying float vPaletteT;
varying float vCore;
varying float vReveal;

#define TWO_PI 6.28318530718

float roseRadius(
  float theta,
  float baseRadius,
  float amplitude,
  float symmetry,
  float phase
) {
  return baseRadius + amplitude * cos(symmetry * theta + phase);
}

float harmonicRadius(
  float theta,
  float baseRadius,
  vec3 amplitudes,
  float symmetry,
  float phase
) {
  float fundamental = symmetry * theta + phase;
  return baseRadius
    + amplitudes.x * cos(fundamental)
    + amplitudes.y * cos(2.0 * fundamental)
    + amplitudes.z * cos(3.0 * fundamental);
}

// Numerically guarded Gielis superformula (same as the legacy raymarcher).
float superformulaRadius(
  float theta,
  float m,
  float a,
  float b,
  float n1,
  float n2,
  float n3
) {
  float safeA = max(abs(a), 0.001);
  float safeB = max(abs(b), 0.001);
  float safeN1 = max(abs(n1), 0.08);
  float angle = m * theta * 0.25;
  float cosineBase = max(abs(cos(angle) / safeA), 0.0001);
  float sineBase = max(abs(sin(angle) / safeB), 0.0001);
  float cosineTerm = pow(cosineBase, clamp(n2, 0.05, 12.0));
  float sineTerm = pow(sineBase, clamp(n3, 0.05, 12.0));
  float denominator = clamp(cosineTerm + sineTerm, 0.0001, 10000.0);
  float exponent = clamp(-1.0 / safeN1, -12.0, -0.02);
  return clamp(pow(denominator, exponent), 0.3, 2.0);
}

float curatedFamilyRadius(
  float family,
  float theta,
  float baseRadius,
  float layer,
  float phase
) {
  float layerProgress = clamp(layer / 3.0, 0.0, 1.0);
  float amplitudeScale = mix(1.0, 0.72, layerProgress);
  float frequencyScale = 1.0;
  if (layer > 1.5) frequencyScale = 2.0;
  if (layer > 2.5) frequencyScale = 3.0;
  float layerPhase = phase + layer * 0.47;

  if (family < 0.5) {
    return roseRadius(
      theta,
      baseRadius,
      baseRadius * 0.11 * amplitudeScale,
      6.0 * frequencyScale,
      layerPhase
    );
  }
  if (family < 1.5) {
    return harmonicRadius(
      theta,
      baseRadius,
      baseRadius * vec3(0.08, 0.035, 0.018) * amplitudeScale,
      8.0 * frequencyScale,
      layerPhase
    );
  }
  if (family < 2.5) {
    return harmonicRadius(
      theta,
      baseRadius,
      baseRadius * vec3(0.055, 0.03, 0.016) * amplitudeScale,
      12.0 * frequencyScale,
      layerPhase
    );
  }
  if (family < 3.5) {
    float m = 8.0 * frequencyScale;
    float superRadius = superformulaRadius(
      theta + layerPhase / m,
      m,
      1.0,
      1.0,
      0.42,
      1.7,
      1.7
    );
    superRadius = clamp(superRadius, 0.55, 1.35);
    return baseRadius * mix(1.0, superRadius, 0.42 * amplitudeScale);
  }
  return harmonicRadius(
    theta,
    baseRadius,
    baseRadius * vec3(0.07, 0.04, 0.022) * amplitudeScale,
    6.0 * frequencyScale,
    layerPhase
  );
}

float mobileFamilyRadius(
  float family,
  float theta,
  float baseRadius,
  float layer,
  float phase
) {
  float symmetry = 6.0;
  if (family > 0.5 && family < 1.5) symmetry = 8.0;
  if (family > 1.5 && family < 2.5) symmetry = 12.0;
  if (family > 2.5 && family < 3.5) symmetry = 8.0;
  if (layer > 1.5) symmetry *= 2.0;

  float layerProgress = clamp(layer / 3.0, 0.0, 1.0);
  float amplitude = baseRadius * mix(0.085, 0.06, layerProgress);
  return roseRadius(theta, baseRadius, amplitude, symmetry, phase + layer * 0.47);
}

float evolvedFamilyRadius(
  float cellId,
  vec2 evolution,
  float theta,
  float baseRadius,
  float layer,
  float phase
) {
  float familyA = mod(cellId + evolution.x, 5.0);
  float radiusA;
  if (uDetail < 0.5) {
    radiusA = mobileFamilyRadius(familyA, theta, baseRadius, layer, phase);
  } else {
    radiusA = curatedFamilyRadius(familyA, theta, baseRadius, layer, phase);
  }
  if (evolution.y <= 0.0001) return radiusA;

  float familyB = mod(familyA + 1.0, 5.0);
  float radiusB;
  if (uDetail < 0.5) {
    radiusB = mobileFamilyRadius(familyB, theta, baseRadius, layer, phase);
  } else {
    radiusB = curatedFamilyRadius(familyB, theta, baseRadius, layer, phase);
  }
  return mix(radiusA, radiusB, evolution.y);
}

void main() {
  float theta = aAngle;
  float cellId = aCell;
  float parity = mod(cellId, 2.0);
  float direction = mix(-1.0, 1.0, parity);
  float cellSlot = mod(cellId, 5.0);
  float cellScale = 0.97 + 0.03 * cos(cellSlot * TWO_PI / 5.0);
  float familyPhase = cellSlot * 0.43 + parity * 0.65;

  // Infinite repetition: each instance wraps along Z as travel advances.
  float ringZ = mod(uTravel - cellId * uCellLength, uSpan) - uSpan;
  float viewDepth = clamp(-ringZ / uMaxRayDistance, 0.0, 1.0);
  float depthEase = smoothstep(0.0, 1.0, viewDepth);
  float depthScale = mix(1.16, 0.84, depthEase);
  float thicknessScale = mix(1.0, 0.72, depthEase);
  float phaseZ = uTravel + ringZ;

  float organicDepth = 0.0;
  float cellularDepth = 0.0;
  float coreDepth = 0.0;
  float organicLobe = 0.0;
  float fiberWave = 0.0;
  float asymmetry = 0.0;
  if (uOrganicStrength > 0.0001) {
    organicDepth = uOrganicStrength * mix(0.35, 1.0, depthEase);
    cellularDepth = uCellularStrength * smoothstep(0.02, 0.42, viewDepth);
    coreDepth = uOrganicCore * smoothstep(0.03, 0.48, viewDepth);

    float zPhase = direction * phaseZ * 0.58 + familyPhase;
    organicLobe = sin(6.0 * theta + zPhase);
    if (uDetail > 0.5) {
      float secondaryLobe = sin(12.0 * theta - 0.7 * zPhase);
      fiberWave = sin(18.0 * theta + familyPhase + direction * ringZ * 0.35);
      organicLobe = (organicLobe + 0.35 * secondaryLobe + 0.15 * fiberWave) / 1.5;
    }
    organicLobe *= uOrganicPulse;
    if (uDetail > 0.5) {
      asymmetry = organicDepth
        * uOrganicAsymmetry
        * sin(theta + phaseZ * 0.11 + familyPhase * 0.37);
    }
  }

  float latticeTheta = theta + phaseZ * uTwist * aTwist;
  float baseRadius = aRadius * depthScale * cellScale;
  float radius = evolvedFamilyRadius(
    cellId,
    uFamilyEvolution,
    latticeTheta,
    baseRadius,
    aLayerId,
    familyPhase
  );
  radius *= 1.0
    + organicDepth * aOrganic * organicLobe
    + asymmetry * (0.15 + 0.22 * aLayerId);

  float tubeRadius = aThickness * thicknessScale * (1.0 + 0.15 * organicDepth);
  vec3 radialDir = vec3(cos(theta), sin(theta), 0.0);
  vec3 center = radialDir * radius + vec3(0.0, 0.0, ringZ + direction * aZCoef);
  vec3 normal = normalize(radialDir * aCross.x + vec3(0.0, 0.0, aCross.y));
  vec3 worldPosition = center
    + radialDir * (aCross.x * tubeRadius)
    + vec3(0.0, 0.0, aCross.y * tubeRadius);

  vec4 viewPosition = viewMatrix * vec4(worldPosition, 1.0);
  gl_Position = projectionMatrix * viewPosition;

  vWorldPosition = worldPosition;
  vNormal = normal;
  vFog = exp(-uFogDensity * length(viewPosition.xyz));
  vLayerId = aLayerId;
  vPaletteT = phaseZ * 0.035
    + radius * 0.12
    + aLayerId * 0.09
    + uColorPhase;
  vCore = coreDepth;
  vReveal = uReveal;
}
`

export const tunnelGeometryFragmentShader = /* glsl */ `
varying vec3 vWorldPosition;
varying vec3 vNormal;
varying float vFog;
varying float vLayerId;
varying float vPaletteT;
varying float vCore;
varying float vReveal;

uniform float uOpacity;
uniform float uSpectralProgress;
uniform float uCellularStrength;

#define TWO_PI 6.28318530718

vec3 cosinePalette(float t) {
  return vec3(0.38, 0.32, 0.45)
    + vec3(0.45, 0.38, 0.45) * cos(TWO_PI * (t + vec3(0.82, 0.58, 0.34)));
}

void main() {
  vec3 viewDir = normalize(cameraPosition - vWorldPosition);
  float rim = pow(1.0 - abs(dot(normalize(vNormal), viewDir)), 2.0);

  vec3 cyan = vec3(0.02, 0.92, 0.68);
  vec3 electricBlue = vec3(0.04, 0.38, 1.0);
  vec3 violet = vec3(0.58, 0.08, 1.0);
  vec3 magenta = vec3(1.0, 0.05, 0.48);
  vec3 orange = vec3(1.0, 0.34, 0.04);
  vec3 yellow = vec3(1.0, 0.86, 0.16);
  vec3 warmWhite = vec3(1.0, 0.98, 0.82);
  vec3 turquoise = vec3(0.03, 0.72, 0.62);
  vec3 deepMagenta = vec3(0.72, 0.015, 0.38);

  float layer = vLayerId;
  vec3 base;
  if (layer < 0.5) {
    base = mix(cyan, electricBlue, 0.4);
  } else if (layer < 1.5) {
    base = mix(violet, magenta, 0.5);
  } else if (layer < 2.5) {
    base = mix(magenta, orange, 0.42);
  } else {
    base = mix(yellow, warmWhite, 0.6);
  }
  base = mix(base, cosinePalette(vPaletteT), 0.16);

  vec3 deep = mix(turquoise, deepMagenta, 0.4);
  base = mix(base, deep, smoothstep(0.38, 1.0, uSpectralProgress) * 0.28);

  float biological = clamp(vCore + uCellularStrength * 0.35, 0.0, 0.85);
  base = mix(base, mix(turquoise, magenta, 0.5), biological * 0.25);

  float glow = (0.22 + 0.78 * rim) * (0.72 + 0.28 * vReveal);
  vec3 color = base * (0.6 + 1.1 * glow);
  float alpha = glow * vFog * uOpacity;
  if (alpha < 0.002) discard;
  gl_FragColor = vec4(color, alpha);
}
`
