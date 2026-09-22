/*
  Alien eye shaders.

  A single camera-facing plane carries the iris, pupil, glints and the opposed
  living-petal blink. It reuses the exact analytical construction of the legacy
  tunnel eye, but as an isolated surface behind the mandala rings so the tunnel
  no longer has to raymarch to show it.
*/

export const alienEyeVertexShader = /* glsl */ `
varying vec2 vUv;

void main() {
  vUv = (uv - 0.5) * 2.0;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

export const alienEyeFragmentShader = /* glsl */ `
varying vec2 vUv;

uniform float uEyeStrength;
uniform float uPupilStrength;
uniform float uEyeGlint;
uniform float uEyeBlink;
uniform float uDetail;
uniform float uReveal;

void main() {
  vec2 eyeUv = vUv / 0.82;
  float eyeRadius = length(eyeUv);
  float eyeTheta = atan(eyeUv.y, eyeUv.x);
  float segmentWave = sin(6.0 * eyeTheta + eyeRadius * 9.0);

  float fiberFrequency = mix(12.0, 18.0, uDetail);
  float irisFiber = 1.0 - smoothstep(
    0.12,
    mix(0.5, 0.42, uDetail),
    abs(sin(
      fiberFrequency * eyeTheta
        + eyeRadius * 42.0
        + segmentWave * 0.8
    ))
  );
  float irisBand = smoothstep(0.16, 0.27, eyeRadius)
    * (1.0 - smoothstep(0.88, 1.02, eyeRadius));
  irisFiber *= irisBand;
  float concentricBand = 0.5 + 0.5 * cos(
    eyeRadius * 48.0 + segmentWave * 0.65
  );
  float mandalaFacet = 0.5 + 0.5 * segmentWave;
  float petalRidge = 1.0 - smoothstep(0.1, 0.46, abs(segmentWave));

  vec3 irisDeep = vec3(0.012, 0.025, 0.075);
  vec3 irisTeal = vec3(0.015, 0.78, 0.68);
  vec3 irisViolet = vec3(0.46, 0.08, 0.94);
  vec3 irisMagenta = vec3(0.94, 0.025, 0.52);
  vec3 irisGold = vec3(1.04, 0.55, 0.075);
  vec3 warmWhite = vec3(1.0, 0.98, 0.82);
  vec3 cyan = vec3(0.02, 0.92, 0.68);

  vec3 irisColor = mix(
    irisTeal,
    irisViolet,
    0.22 + 0.52 * mandalaFacet
  );
  irisColor = mix(
    irisColor,
    irisMagenta,
    0.12 + 0.24 * (1.0 - concentricBand)
  );
  float goldAccent = (0.035 + 0.16 * petalRidge) * concentricBand;
  irisColor = mix(irisColor, irisGold, goldAccent);
  irisColor *= 0.34
    + 0.34 * concentricBand
    + 0.58 * irisFiber
    + 0.2 * petalRidge;

  float irisBody = smoothstep(0.08, 0.2, eyeRadius)
    * (1.0 - smoothstep(0.9, 1.02, eyeRadius));
  vec3 eyeColor = mix(irisDeep, irisColor, irisBody);

  float outerIrisRing = smoothstep(0.73, 0.81, eyeRadius)
    * (1.0 - smoothstep(0.91, 1.0, eyeRadius));
  float innerIrisRing = smoothstep(0.2, 0.27, eyeRadius)
    * (1.0 - smoothstep(0.32, 0.39, eyeRadius));
  eyeColor += mix(irisViolet, irisTeal, 0.46)
    * outerIrisRing
    * (0.2 + 0.26 * concentricBand + 0.16 * petalRidge);
  eyeColor += mix(irisMagenta, irisGold, 0.32)
    * innerIrisRing * (0.34 + 0.18 * petalRidge);

  // Tapered analytical slit reads as reptilian without literal eyelids.
  float pupilVertical = clamp(abs(eyeUv.y) / 0.66, 0.0, 1.0);
  float pupilHalfWidth = mix(0.115, 0.026, pupilVertical * pupilVertical);
  float pupilShape = 1.0 - smoothstep(
    pupilHalfWidth,
    pupilHalfWidth + 0.018,
    abs(eyeUv.x)
  );
  pupilShape *= 1.0 - smoothstep(0.58, 0.68, abs(eyeUv.y));
  float pupilOuter = 1.0 - smoothstep(
    pupilHalfWidth + 0.028,
    pupilHalfWidth + 0.05,
    abs(eyeUv.x)
  );
  pupilOuter *= 1.0 - smoothstep(0.61, 0.72, abs(eyeUv.y));
  float pupilMask = pupilShape * uPupilStrength;
  float pupilRim = max(pupilOuter - pupilShape, 0.0) * uPupilStrength;
  eyeColor += mix(irisMagenta, irisGold, 0.38) * pupilRim * 0.62;
  eyeColor = mix(
    eyeColor,
    vec3(0.0004, 0.0007, 0.0012),
    pupilMask * 0.99
  );

  float wetRim = pow(smoothstep(0.55, 1.0, eyeRadius), 3.0);
  eyeColor += mix(irisViolet, irisTeal, 0.64) * wetRim * 0.075;

  vec2 glintOffset = eyeUv - vec2(-0.1, 0.16);
  float primaryGlint = exp(
    -dot(glintOffset * vec2(1.0, 1.35), glintOffset * vec2(1.0, 1.35)) * 420.0
  );
  eyeColor += warmWhite * primaryGlint * uEyeGlint * 2.4;
  if (uDetail > 0.5) {
    vec2 secondaryOffset = eyeUv - vec2(0.15, 0.055);
    float secondaryGlint = exp(
      -dot(secondaryOffset, secondaryOffset) * 760.0
    );
    eyeColor += mix(warmWhite, cyan, 0.35)
      * secondaryGlint * uEyeGlint * 1.15;
  }

  // Opposed living petals close over the iris, borrowing mandala signals.
  float blinkOpening = mix(1.15, 0.018, uEyeBlink);
  float closureWarp = uEyeBlink * (
    0.045 * segmentWave + 0.04 * (concentricBand - 0.5)
  );
  float organicOpening = max(blinkOpening + closureWarp, 0.0);
  float remainingAperture = 1.0 - smoothstep(
    organicOpening - 0.026,
    organicOpening + 0.026,
    abs(eyeUv.y)
  );
  float membraneClosure = (1.0 - remainingAperture) * uEyeBlink;
  vec3 upperPetal = mix(irisDeep, irisViolet, 0.16);
  vec3 lowerPetal = mix(irisDeep, irisTeal, 0.12);
  vec3 closureColor = mix(
    lowerPetal,
    upperPetal,
    step(0.0, eyeUv.y)
  );
  closureColor += mix(irisMagenta, irisTeal, mandalaFacet)
    * petalRidge * 0.035;
  eyeColor = mix(eyeColor, closureColor, membraneClosure);
  float closureSeam = 1.0 - smoothstep(
    0.006,
    0.03,
    abs(abs(eyeUv.y) - organicOpening)
  );
  closureSeam *= uEyeBlink;
  eyeColor += mix(irisMagenta, irisTeal, mandalaFacet)
    * closureSeam * (0.1 + 0.08 * petalRidge);
  eyeColor *= mix(1.0, 0.28, uEyeBlink * uEyeBlink);

  float diskMask = 1.0 - smoothstep(0.9, 1.0, eyeRadius);
  float alpha = uEyeStrength * diskMask;
  if (alpha < 0.01) discard;

  eyeColor *= mix(0.5, 1.0, uEyeStrength) * (0.85 + 0.15 * uReveal);
  gl_FragColor = vec4(eyeColor, alpha);
}
`
