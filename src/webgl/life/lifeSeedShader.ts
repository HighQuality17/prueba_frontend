export const lifeSeedVertexShader = /* glsl */ `
uniform float uDetail;
uniform float uFormStrength;

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

  float alpha = uOpacity * (0.76 + 0.2 * rim);
  gl_FragColor = vec4(color, alpha);
}
`
