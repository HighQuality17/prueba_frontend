export const lifeSeedVertexShader = /* glsl */ `
uniform float uDetail;
uniform float uFormStrength;
uniform float uTension;
uniform float uOpening;

varying vec3 vSeedPosition;
varying vec3 vSeedNormal;
varying vec3 vViewDirection;

void main() {
  vec3 seedPosition = position;
  float theta = atan(seedPosition.y, seedPosition.x);
  float equator = 1.0 - abs(normal.z);
  float fold6 = cos(6.0 * theta + seedPosition.z * 1.8);
  float fold12 = cos(12.0 * theta - seedPosition.z * 2.4);
  float membraneFold = 0.075 * fold6 + 0.025 * fold12 * uDetail;
  seedPosition.xy *= 1.0 + equator * membraneFold;

  float lobeCenter = 0.5 + 0.5 * fold6;
  float radial = length(seedPosition.xy);
  seedPosition.xy *= 1.0
    + uTension * equator * (0.025 + 0.025 * lobeCenter);
  float frontShell = smoothstep(-0.12, 0.72, seedPosition.z);
  float peel = uOpening
    * frontShell
    * smoothstep(0.14, 0.78, radial);
  seedPosition.xy *= 1.0 + peel * (0.14 + 0.1 * lobeCenter);
  seedPosition.z -= peel * (0.14 + 0.1 * (1.0 - lobeCenter));

  seedPosition.x *= mix(1.0, 0.88, uFormStrength);
  seedPosition.y *= mix(1.0, 1.18, uFormStrength);
  seedPosition.z *= mix(0.74, 0.84, uFormStrength);
  seedPosition.x += uDetail
    * uFormStrength
    * 0.035
    * (seedPosition.y * seedPosition.y - 0.25);

  vec3 shapedNormal = normalize(vec3(
    normal.x / mix(1.0, 0.88, uFormStrength),
    normal.y / mix(1.0, 1.18, uFormStrength),
    normal.z / mix(0.74, 0.84, uFormStrength)
  ));
  vec4 worldPosition = modelMatrix * vec4(seedPosition, 1.0);

  vSeedPosition = seedPosition;
  vSeedNormal = normalize(normalMatrix * shapedNormal);
  vViewDirection = normalize(cameraPosition - worldPosition.xyz);
  gl_Position = projectionMatrix * viewMatrix * worldPosition;
}
`

export const lifeSeedFragmentShader = /* glsl */ `
uniform float uOpacity;
uniform float uPulse;
uniform float uDetail;
uniform float uFormStrength;
uniform float uActivation;
uniform float uTension;
uniform float uOpening;

varying vec3 vSeedPosition;
varying vec3 vSeedNormal;
varying vec3 vViewDirection;

void main() {
  vec3 normal = normalize(vSeedNormal);
  vec3 viewDirection = normalize(vViewDirection);
  float facing = max(dot(normal, viewDirection), 0.0);
  float rim = pow(1.0 - facing, 3.0);
  float theta = atan(vSeedPosition.y, vSeedPosition.x);
  float radial = length(vSeedPosition.xy);

  float fold6 = 0.5 + 0.5 * cos(
    6.0 * theta + vSeedPosition.z * 4.0
  );
  float fold12 = 0.5 + 0.5 * cos(
    12.0 * theta - vSeedPosition.z * 7.0
  );
  float membraneBand = 0.5 + 0.5 * cos(
    vSeedPosition.y * 11.0 + fold6 * 1.4
  );
  float seam = 1.0 - smoothstep(
    0.035,
    0.17,
    abs(sin(3.0 * theta + vSeedPosition.z * 0.38))
  );
  float apertureRadius = uOpening * (
    0.48 + 0.065 * (2.0 * fold6 - 1.0)
  );
  if (
    uOpening > 0.0001
      && vSeedPosition.z > 0.04
      && radial < apertureRadius
  ) discard;

  vec3 deepViolet = vec3(0.055, 0.012, 0.13);
  vec3 turquoise = vec3(0.015, 0.78, 0.68);
  vec3 violet = vec3(0.48, 0.075, 0.94);
  vec3 magenta = vec3(0.96, 0.025, 0.5);
  vec3 amber = vec3(1.02, 0.46, 0.07);
  vec3 warmWhite = vec3(1.0, 0.96, 0.76);

  vec3 membraneColor = mix(turquoise, violet, 0.24 + 0.5 * fold6);
  membraneColor = mix(
    membraneColor,
    magenta,
    (0.08 + 0.16 * fold12 * uDetail) * uFormStrength
  );
  vec3 color = mix(deepViolet, membraneColor, 0.28 + 0.24 * facing);
  color *= 0.2 + 0.32 * membraneBand + 0.2 * facing;

  float filament = 1.0 - smoothstep(
    0.1,
    mix(0.42, 0.3, uDetail),
    abs(sin(6.0 * theta + vSeedPosition.y * 5.0))
  );
  float filamentRegion = smoothstep(0.12, 0.28, radial)
    * (1.0 - smoothstep(0.62, 0.94, radial));
  color += mix(turquoise, amber, 0.24 + 0.28 * fold6)
    * filament
    * filamentRegion
    * (0.12 + 0.14 * uDetail);
  color += mix(magenta, warmWhite, 0.24)
    * seam
    * (0.08 + 0.34 * uActivation + 0.38 * uTension);

  float openingRim = 1.0 - smoothstep(
    0.018,
    0.075,
    abs(radial - apertureRadius)
  );
  openingRim *= step(0.04, vSeedPosition.z) * uOpening;
  color += mix(amber, warmWhite, 0.42)
    * openingRim
    * (0.42 + 0.34 * fold6);

  float coreRadius = length(vSeedPosition.xy * vec2(1.18, 0.88));
  float innerCore = exp(-coreRadius * coreRadius * 16.0) * facing;
  float coreLobes = 0.72 + 0.28 * fold6;
  color += mix(warmWhite, amber, 0.18)
    * innerCore
    * coreLobes
    * (1.05 + 0.34 * uPulse);

  float membraneEdge = pow(rim, 2.0);
  color += mix(turquoise, violet, 0.42)
    * membraneEdge
    * (0.58 + 0.22 * membraneBand);
  color += warmWhite * pow(rim, 7.0) * 0.72;

  float lobeSeparation = 1.0 - seam * uOpening * 0.58;
  float alpha = uOpacity * (0.76 + 0.2 * rim) * lobeSeparation;
  gl_FragColor = vec4(color, alpha);
}
`

export const germinalCoreVertexShader = /* glsl */ `
uniform float uCoreReveal;
uniform float uDetail;

varying vec3 vCorePosition;
varying vec3 vCoreNormal;
varying vec3 vCoreViewDirection;

void main() {
  vec3 corePosition = position;
  float theta = atan(corePosition.y, corePosition.x);
  float equator = 1.0 - abs(normal.z);
  float coreFold = 0.075 * cos(6.0 * theta + corePosition.z * 2.5);
  coreFold += 0.025
    * cos(12.0 * theta - corePosition.z * 3.5)
    * uDetail;
  corePosition.xy *= 1.0 + coreFold * equator;
  corePosition.y *= 1.08;
  corePosition.z *= 0.82;
  corePosition *= mix(0.42, 1.0, uCoreReveal);

  vec4 worldPosition = modelMatrix * vec4(corePosition, 1.0);
  vCorePosition = corePosition;
  vCoreNormal = normalize(normalMatrix * normal);
  vCoreViewDirection = normalize(cameraPosition - worldPosition.xyz);
  gl_Position = projectionMatrix * viewMatrix * worldPosition;
}
`

export const germinalCoreFragmentShader = /* glsl */ `
uniform float uCoreReveal;
uniform float uDetail;

varying vec3 vCorePosition;
varying vec3 vCoreNormal;
varying vec3 vCoreViewDirection;

void main() {
  vec3 normal = normalize(vCoreNormal);
  vec3 viewDirection = normalize(vCoreViewDirection);
  float facing = max(dot(normal, viewDirection), 0.0);
  float rim = pow(1.0 - facing, 3.0);
  float theta = atan(vCorePosition.y, vCorePosition.x);
  float radial = length(vCorePosition.xy);
  float lobes = 0.5 + 0.5 * cos(6.0 * theta + vCorePosition.z * 5.0);
  float innerRings = 0.5 + 0.5 * cos(radial * 22.0 - vCorePosition.z * 8.0);

  vec3 amber = vec3(1.04, 0.48, 0.065);
  vec3 warmWhite = vec3(1.0, 0.97, 0.79);
  vec3 magenta = vec3(0.96, 0.025, 0.48);
  vec3 turquoise = vec3(0.025, 0.76, 0.67);

  vec3 coreColor = mix(magenta, amber, 0.42 + 0.32 * lobes);
  coreColor = mix(coreColor, warmWhite, 0.28 + 0.34 * innerRings);
  vec3 color = coreColor * (0.34 + 0.48 * facing + 0.28 * innerRings);
  color += mix(turquoise, warmWhite, 0.55)
    * rim
    * (0.72 + 0.24 * uDetail);
  float centralKnot = exp(-radial * radial * 18.0) * facing;
  color += warmWhite * centralKnot * (0.78 + 0.34 * uCoreReveal);

  gl_FragColor = vec4(color, uCoreReveal * (0.82 + 0.14 * rim));
}
`

export const germinalFilamentVertexShader = /* glsl */ `
attribute float aGrowth;
attribute float aFilamentId;

uniform float uGrowth;
uniform float uDetail;

varying float vGrowth;
varying float vVisibility;
varying float vFilamentId;

void main() {
  float filamentCount = mix(3.0, 6.0, uDetail);
  float active = 1.0 - step(filamentCount - 0.5, aFilamentId);
  float reveal = 1.0 - smoothstep(uGrowth, uGrowth + 0.075, aGrowth);
  vGrowth = aGrowth;
  vVisibility = active * reveal;
  vFilamentId = aFilamentId;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

export const germinalFilamentFragmentShader = /* glsl */ `
uniform float uOpacity;

varying float vGrowth;
varying float vVisibility;
varying float vFilamentId;

void main() {
  if (vVisibility < 0.001) discard;
  vec3 turquoise = vec3(0.02, 0.9, 0.76);
  vec3 violet = vec3(0.56, 0.14, 1.0);
  vec3 warmWhite = vec3(1.0, 0.98, 0.82);
  float parity = mod(vFilamentId, 2.0);
  vec3 color = mix(turquoise, violet, parity * 0.48);
  float warmTip = smoothstep(0.68, 1.0, vGrowth);
  color = mix(color, warmWhite, warmTip * 0.62);
  color *= 0.72 + 0.58 * warmTip;
  gl_FragColor = vec4(color, uOpacity * vVisibility * 0.88);
}
`
