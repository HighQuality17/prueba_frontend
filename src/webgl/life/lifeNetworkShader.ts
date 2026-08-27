export const lifeNetworkVertexShader = /* glsl */ `
attribute float aAcross;
attribute float aPathCoordinate;
attribute float aNetworkDistance;
attribute float aPathType;
attribute float aMobileVisible;
attribute float aPathHue;

uniform float uPrimaryGrowth;
uniform float uSecondaryGrowth;
uniform float uConnectionGrowth;
uniform float uPulseProgress;
uniform float uDetail;

varying float vAcross;
varying float vNetworkDistance;
varying float vPathHue;
varying float vPulse;
varying float vVisibility;

void main() {
  float primary = 1.0 - step(0.5, aPathType);
  float secondary = step(0.5, aPathType) * (1.0 - step(1.5, aPathType));
  float connection = step(1.5, aPathType);
  float pathGrowth = primary * uPrimaryGrowth
    + secondary * uSecondaryGrowth
    + connection * uConnectionGrowth;
  float reveal = 1.0 - smoothstep(
    pathGrowth,
    pathGrowth + 0.045,
    aPathCoordinate
  );
  float mobileVisibility = mix(aMobileVisible, 1.0, uDetail);
  float pulseCenter = mix(-0.08, 1.18, uPulseProgress);

  vAcross = aAcross;
  vNetworkDistance = aNetworkDistance;
  vPathHue = aPathHue;
  vPulse = exp(-abs(aNetworkDistance - pulseCenter) * 24.0)
    * smoothstep(0.015, 0.12, uPulseProgress);
  vVisibility = reveal * mobileVisibility;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

export const lifeNetworkFragmentShader = /* glsl */ `
uniform float uOpacity;

varying float vAcross;
varying float vNetworkDistance;
varying float vPathHue;
varying float vPulse;
varying float vVisibility;

void main() {
  if (vVisibility < 0.001) discard;

  vec3 deepViolet = vec3(0.035, 0.008, 0.09);
  vec3 turquoise = vec3(0.015, 0.82, 0.72);
  vec3 cyan = vec3(0.1, 0.72, 1.0);
  vec3 violet = vec3(0.52, 0.09, 0.98);
  vec3 gold = vec3(1.02, 0.57, 0.08);
  vec3 warmWhite = vec3(1.0, 0.97, 0.82);

  float edge = smoothstep(0.22, 1.0, abs(vAcross));
  float luminousCore = 1.0 - smoothstep(0.16, 0.56, abs(vAcross));
  vec3 branchColor = mix(turquoise, violet, 0.2 + 0.46 * vPathHue);
  branchColor = mix(branchColor, cyan, vNetworkDistance * 0.18);
  vec3 color = mix(deepViolet, branchColor, 0.28 + 0.28 * edge);
  color += branchColor * luminousCore * 0.48;

  vec3 pulseColor = mix(
    mix(warmWhite, gold, 0.28),
    mix(turquoise, violet, 0.32),
    smoothstep(0.18, 0.86, vNetworkDistance)
  );
  color += pulseColor * vPulse * (0.9 + 0.45 * luminousCore);

  float alpha = uOpacity
    * vVisibility
    * (0.28 + 0.46 * luminousCore + 0.16 * edge);
  gl_FragColor = vec4(color, alpha);
}
`

export const lifeNodeVertexShader = /* glsl */ `
attribute float aNodeDistance;
attribute float aNodeOrder;
attribute float aMobileVisible;

uniform float uNodeGrowth;
uniform float uPulseProgress;
uniform float uDetail;

varying vec3 vNodeNormal;
varying vec3 vViewDirection;
varying float vNodeDistance;
varying float vNodePulse;
varying float vNodeVisibility;

void main() {
  float reveal = smoothstep(
    aNodeOrder - 0.12,
    aNodeOrder + 0.08,
    uNodeGrowth
  );
  float mobileVisibility = mix(aMobileVisible, 1.0, uDetail);
  float pulseCenter = mix(-0.08, 1.18, uPulseProgress);
  float pulse = exp(-abs(aNodeDistance - pulseCenter) * 22.0)
    * smoothstep(0.015, 0.12, uPulseProgress);
  vec3 nodePosition = position
    * mix(0.04, 1.0 + 0.12 * pulse, reveal);
  vec4 worldPosition = modelMatrix
    * instanceMatrix
    * vec4(nodePosition, 1.0);

  vNodeNormal = normalize(normalMatrix * mat3(instanceMatrix) * normal);
  vViewDirection = normalize(cameraPosition - worldPosition.xyz);
  vNodeDistance = aNodeDistance;
  vNodePulse = pulse;
  vNodeVisibility = reveal * mobileVisibility;
  gl_Position = projectionMatrix * viewMatrix * worldPosition;
}
`

export const lifeNodeFragmentShader = /* glsl */ `
uniform float uOpacity;

varying vec3 vNodeNormal;
varying vec3 vViewDirection;
varying float vNodeDistance;
varying float vNodePulse;
varying float vNodeVisibility;

void main() {
  if (vNodeVisibility < 0.001) discard;

  vec3 normal = normalize(vNodeNormal);
  vec3 viewDirection = normalize(vViewDirection);
  float facing = max(dot(normal, viewDirection), 0.0);
  float rim = pow(1.0 - facing, 3.0);
  vec3 deepBody = vec3(0.025, 0.006, 0.065);
  vec3 turquoise = vec3(0.02, 0.82, 0.7);
  vec3 violet = vec3(0.54, 0.1, 1.0);
  vec3 warmWhite = vec3(1.0, 0.97, 0.8);
  vec3 gold = vec3(1.02, 0.56, 0.08);

  vec3 rimColor = mix(turquoise, violet, 0.18 + 0.46 * vNodeDistance);
  vec3 color = deepBody * (0.42 + 0.22 * facing);
  color += rimColor * rim * 0.78;
  float innerGlow = pow(facing, 5.0);
  color += mix(warmWhite, turquoise, vNodeDistance * 0.42)
    * innerGlow * 0.72;
  color += mix(gold, warmWhite, 0.5) * vNodePulse * 1.15;

  gl_FragColor = vec4(
    color,
    uOpacity * vNodeVisibility * (0.72 + 0.22 * rim)
  );
}
`
