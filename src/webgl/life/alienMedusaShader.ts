export const alienMedusaBellVertexShader = /* glsl */ `
uniform float uFormation;
uniform float uContraction;
uniform float uDetail;

varying vec3 vBellPosition;
varying vec3 vBellNormal;
varying vec3 vViewDirection;

void main() {
  vec3 bellPosition = position;
  float theta = atan(bellPosition.z, bellPosition.x);
  float fold6 = cos(6.0 * theta + bellPosition.y * 1.8);
  float fold3 = cos(3.0 * theta - bellPosition.y * 2.2);
  float lowerRim = 1.0 - smoothstep(-0.18, 0.58, bellPosition.y);
  float membraneFold = 0.055 * fold6 + 0.026 * fold3 * uDetail;
  bellPosition.xz *= 1.0 + membraneFold * uFormation;
  bellPosition.xz *= 1.0 + lowerRim * 0.11 * uFormation;
  bellPosition.x += uDetail
    * uFormation
    * 0.022
    * (bellPosition.y * bellPosition.y - 0.2);

  bellPosition.xz *= 1.0 - 0.14 * uContraction;
  bellPosition.y *= 1.0 + 0.1 * uContraction;
  bellPosition.y += lowerRim * 0.08 * uContraction;

  vec4 worldPosition = modelMatrix * vec4(bellPosition, 1.0);
  vBellPosition = bellPosition;
  vBellNormal = normalize(normalMatrix * normal);
  vViewDirection = normalize(cameraPosition - worldPosition.xyz);
  gl_Position = projectionMatrix * viewMatrix * worldPosition;
}
`

export const alienMedusaBellFragmentShader = /* glsl */ `
uniform float uFormation;
uniform float uContraction;
uniform float uDetail;

varying vec3 vBellPosition;
varying vec3 vBellNormal;
varying vec3 vViewDirection;

void main() {
  vec3 normal = normalize(vBellNormal);
  if (!gl_FrontFacing) normal *= -1.0;
  vec3 viewDirection = normalize(vViewDirection);
  float facing = max(dot(normal, viewDirection), 0.0);
  float rim = pow(1.0 - facing, 3.0);
  float theta = atan(vBellPosition.z, vBellPosition.x);
  float fold6 = 0.5 + 0.5 * cos(
    6.0 * theta + vBellPosition.y * 4.5
  );
  float membraneBand = 0.5 + 0.5 * cos(
    vBellPosition.y * 13.0 - fold6 * 1.3
  );
  float lowerRim = 1.0 - smoothstep(-0.2, 0.42, vBellPosition.y);

  vec3 deepViolet = vec3(0.03, 0.006, 0.085);
  vec3 turquoise = vec3(0.015, 0.78, 0.68);
  vec3 cyan = vec3(0.08, 0.72, 1.0);
  vec3 violet = vec3(0.5, 0.075, 0.96);
  vec3 magenta = vec3(0.9, 0.02, 0.45);
  vec3 warmWhite = vec3(1.0, 0.97, 0.82);

  vec3 membrane = mix(turquoise, violet, 0.2 + 0.5 * fold6);
  membrane = mix(membrane, magenta, membraneBand * 0.12 * uDetail);
  vec3 color = mix(deepViolet, membrane, 0.16 + 0.22 * facing);
  color += membrane * rim * (0.52 + 0.22 * membraneBand);
  color += mix(cyan, warmWhite, 0.2)
    * pow(rim, 5.0)
    * (0.76 + 0.22 * uContraction);
  color += mix(violet, turquoise, 0.58)
    * lowerRim
    * (0.12 + 0.18 * membraneBand);
  float backLight = pow(1.0 - abs(dot(normal, viewDirection)), 2.0);
  color += turquoise * backLight * 0.08;

  float alpha = uFormation * (0.42 + 0.28 * rim + 0.12 * lowerRim);
  gl_FragColor = vec4(color, alpha);
}
`

export const alienMedusaOrganVertexShader = /* glsl */ `
uniform float uFormation;
uniform float uContraction;
uniform float uDetail;

varying vec3 vOrganPosition;
varying vec3 vOrganNormal;
varying vec3 vViewDirection;

void main() {
  vec3 organPosition = position;
  float theta = atan(organPosition.z, organPosition.x);
  float lobes = 0.08 * cos(6.0 * theta + organPosition.y * 3.0);
  lobes += 0.025 * cos(3.0 * theta - organPosition.y) * uDetail;
  organPosition.xz *= 1.0 + lobes;
  organPosition.y *= 1.12 - 0.08 * uContraction;
  organPosition *= mix(0.3, 1.0, uFormation);

  vec4 worldPosition = modelMatrix * vec4(organPosition, 1.0);
  vOrganPosition = organPosition;
  vOrganNormal = normalize(normalMatrix * normal);
  vViewDirection = normalize(cameraPosition - worldPosition.xyz);
  gl_Position = projectionMatrix * viewMatrix * worldPosition;
}
`

export const alienMedusaOrganFragmentShader = /* glsl */ `
uniform float uFormation;
uniform float uContraction;

varying vec3 vOrganPosition;
varying vec3 vOrganNormal;
varying vec3 vViewDirection;

void main() {
  vec3 normal = normalize(vOrganNormal);
  vec3 viewDirection = normalize(vViewDirection);
  float facing = max(dot(normal, viewDirection), 0.0);
  float rim = pow(1.0 - facing, 3.0);
  float band = 0.5 + 0.5 * cos(
    length(vOrganPosition.xz) * 18.0 - vOrganPosition.y * 7.0
  );
  vec3 amber = vec3(1.05, 0.48, 0.06);
  vec3 warmWhite = vec3(1.0, 0.97, 0.8);
  vec3 magenta = vec3(0.96, 0.025, 0.48);
  vec3 color = mix(magenta, amber, 0.48 + 0.22 * band);
  color = mix(color, warmWhite, 0.34 + 0.32 * facing);
  color *= 0.62 + 0.36 * band + 0.18 * uContraction;
  color += warmWhite * rim * 0.62;
  gl_FragColor = vec4(color, uFormation * (0.82 + 0.14 * rim));
}
`

export const alienMedusaTentacleVertexShader = /* glsl */ `
attribute float aAcross;
attribute float aCoordinate;
attribute float aTentacleId;
attribute float aType;
attribute float aMobileVisible;

uniform float uGrowth;
uniform float uContraction;
uniform float uTetherOpacity;
uniform float uDetail;
uniform vec3 uTetherTarget;

varying float vAcross;
varying float vCoordinate;
varying float vTentacleId;
varying float vType;
varying float vVisibility;

void main() {
  vec3 tentaclePosition = position;
  float tether = step(0.5, aType);
  float ordinary = 1.0 - tether;
  if (tether > 0.5) {
    vec3 tetherBase = vec3(0.0, -0.16, 0.0);
    float arc = sin(aCoordinate * 3.14159265);
    tentaclePosition = mix(tetherBase, uTetherTarget, aCoordinate);
    tentaclePosition.x += arc * 0.09;
    tentaclePosition.z += arc * 0.08;
    tentaclePosition.x += aAcross * mix(0.024, 0.008, aCoordinate);
  } else {
    float response = sin(aCoordinate * 3.14159265);
    float direction = mix(-1.0, 1.0, mod(aTentacleId, 2.0));
    tentaclePosition.x += direction
      * response
      * uContraction
      * (0.08 + 0.035 * aCoordinate);
    tentaclePosition.y += response * uContraction * 0.12;
  }

  float reveal = 1.0 - smoothstep(
    uGrowth,
    uGrowth + 0.06,
    aCoordinate
  );
  float mobileVisibility = mix(aMobileVisible, 1.0, uDetail);
  vAcross = aAcross;
  vCoordinate = aCoordinate;
  vTentacleId = aTentacleId;
  vType = aType;
  vVisibility = ordinary * reveal * mobileVisibility
    + tether * uTetherOpacity;
  gl_Position = projectionMatrix
    * modelViewMatrix
    * vec4(tentaclePosition, 1.0);
}
`

export const alienMedusaTentacleFragmentShader = /* glsl */ `
varying float vAcross;
varying float vCoordinate;
varying float vTentacleId;
varying float vType;
varying float vVisibility;

void main() {
  if (vVisibility < 0.001) discard;
  vec3 deepViolet = vec3(0.035, 0.006, 0.09);
  vec3 violet = vec3(0.54, 0.09, 0.98);
  vec3 cyan = vec3(0.05, 0.78, 1.0);
  vec3 turquoise = vec3(0.015, 0.86, 0.72);
  vec3 warmWhite = vec3(1.0, 0.97, 0.82);
  float core = 1.0 - smoothstep(0.18, 0.58, abs(vAcross));
  float edge = smoothstep(0.32, 1.0, abs(vAcross));
  float parity = mod(vTentacleId, 2.0);
  vec3 filament = mix(violet, cyan, 0.34 + 0.28 * parity);
  filament = mix(filament, turquoise, vCoordinate * 0.18);
  vec3 color = mix(deepViolet, filament, 0.24 + 0.42 * core + 0.16 * edge);
  float tip = smoothstep(0.72, 1.0, vCoordinate) * (1.0 - step(0.5, vType));
  color += warmWhite * tip * 0.68;
  float alpha = vVisibility * (0.28 + 0.5 * core + 0.12 * edge);
  gl_FragColor = vec4(color, alpha);
}
`
