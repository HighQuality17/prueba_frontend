/*
  Procedural kaleidoscopic tunnel — fullscreen SDF raymarcher.

  Deterministic constants (documented per Phase 14 requirements):
  - CELL_LENGTH 3.0        world units per repeated tunnel cell
  - MACRO_THICKNESS 0.068  outer mathematical contour
  - MID_THICKNESS 0.048    related middle contour
  - INNER_THICKNESS 0.036  doubled-frequency inner contour
  - FINE_THICKNESS 0.028   desktop-only tripled-frequency contour
  - MAX_STEPS 64           hard loop bound; uStepLimit lowers it (mobile 40)
  - REFINEMENT_STEPS 3     local corrections after a hit (mobile uses 2)
  - STEP_SCALE 0.75        conservative factor for SDF-like radial contours
                           whose angular radius is not exact Euclidean distance
  - HIT_EPSILON 0.002      surface hit threshold in world units
  - NORMAL_EPSILON         distance-adaptive 0.0038 -> 0.0055 sampling radius
  - MAX_RAY_DISTANCE 30.0  rays beyond this count as miss
  - FOG_DENSITY 0.1        exponential distance fog toward black

  Per pixel cost: <= uStepLimit map evaluations. Stable journey stages evaluate
  three mathematical radii on mobile and four on desktop; two short family
  transitions evaluate both adjacent curated families. Confirmed hits add 2
  mobile / 3 desktop refinements and 4 evaluations for the normal.
*/

export const tunnelVertexShader = /* glsl */ `
void main() {
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`

export const tunnelFragmentShader = /* glsl */ `
uniform vec2 uResolution;
uniform float uTime;
uniform float uReveal;
uniform float uOpacity;
uniform float uTravel;
uniform float uSymmetry;
uniform float uTwist;
uniform float uColorPhase;
uniform float uSpectralProgress;
uniform float uStepLimit;
uniform float uDetail;

#define TWO_PI 6.28318530718
#define CELL_LENGTH 3.0
#define MACRO_RADIUS 1.76
#define MACRO_THICKNESS 0.068
#define MACRO_DEPTH_WIDTH 0.036
#define MID_RADIUS 1.14
#define MID_THICKNESS 0.048
#define MID_DEPTH_WIDTH 0.03
#define INNER_RADIUS 0.62
#define INNER_THICKNESS 0.036
#define INNER_DEPTH_WIDTH 0.024
#define FINE_RADIUS 0.31
#define FINE_THICKNESS 0.028
#define FINE_DEPTH_WIDTH 0.02
#define MAX_STEPS 64
#define REFINEMENT_STEPS 3
#define STEP_SCALE 0.75
#define HIT_EPSILON 0.002
#define NORMAL_EPSILON_NEAR 0.0038
#define NORMAL_EPSILON_FAR 0.0055
#define MAX_RAY_DISTANCE 30.0
#define FOG_DENSITY 0.1
#define APERTURE_MAX 2.6

float sdBox2D(vec2 p, vec2 halfSize) {
  vec2 q = abs(p) - halfSize;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0);
}

// Cosine palette anchored to violet/yellow/green with cyan/magenta drift.
vec3 cosinePalette(float t) {
  return vec3(0.38, 0.32, 0.45)
    + vec3(0.45, 0.38, 0.45) * cos(TWO_PI * (t + vec3(0.82, 0.58, 0.34)));
}

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

/*
  Numerically guarded Gielis superformula:
  r = (|cos(m*theta/4)/a|^n2 + |sin(m*theta/4)/b|^n3)^(-1/n1)
*/
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

/*
  Five curated families (no geometry noise):
  0: 6-fold soft rose
  1: 8-fold harmonic star-flower
  2: 12-fold harmonic mandala
  3: 8-fold crystalline superformula
  4: dense 6/12/18 harmonic flower
*/
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

/*
  Stable family stages with two short complete-radius crossfades. x is the
  sequence offset; y is the blend to the next curated family.
*/
vec2 familyEvolution(float phase) {
  if (phase < 0.3) return vec2(0.0, 0.0);
  if (phase < 0.4) {
    return vec2(0.0, smoothstep(0.3, 0.4, phase));
  }
  if (phase < 0.66) return vec2(1.0, 0.0);
  if (phase < 0.76) {
    return vec2(1.0, smoothstep(0.66, 0.76, phase));
  }
  return vec2(2.0, 0.0);
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
  float radiusA = curatedFamilyRadius(
    familyA,
    theta,
    baseRadius,
    layer,
    phase
  );
  if (evolution.y <= 0.0001) return radiusA;

  float familyB = mod(familyA + 1.0, 5.0);
  float radiusB = curatedFamilyRadius(
    familyB,
    theta,
    baseRadius,
    layer,
    phase
  );
  return mix(radiusA, radiusB, evolution.y);
}

float radialContourSDF(
  float rho,
  float targetRadius,
  float localZ,
  float layerZ,
  float radialThickness,
  float depthThickness
) {
  return sdBox2D(
    vec2(rho - targetRadius, localZ - layerZ),
    vec2(radialThickness, depthThickness)
  );
}

vec2 tunnelSDF(vec3 p) {
  // Infinite repetition: slide domain by travel, wrap into one cell.
  float tz = p.z + uTravel;
  float cellId = floor(tz / CELL_LENGTH);
  float lz = tz - cellId * CELL_LENGTH - 0.5 * CELL_LENGTH;
  float parity = mod(cellId, 2.0);
  float direction = mix(-1.0, 1.0, parity);
  float journeyPhase = clamp((uSymmetry - 6.0) / 6.0, 0.0, 1.0);
  vec2 evolution = familyEvolution(journeyPhase);

  float rho = length(p.xy);
  float theta = atan(p.y, p.x);
  float viewDepth = clamp(-p.z / MAX_RAY_DISTANCE, 0.0, 1.0);
  float depthEase = smoothstep(0.0, 1.0, viewDepth);
  // Large near contours frame the viewport; distant mathematics become
  // progressively smaller and denser around the vanishing point.
  float depthScale = mix(1.16, 0.84, depthEase);
  float thicknessScale = mix(1.0, 0.72, depthEase);
  float innerThicknessScale = mix(thicknessScale, 1.0, 0.4);
  float cellSlot = mod(cellId, 5.0);
  float cellScale = 0.97 + 0.03 * cos(cellSlot * TWO_PI / 5.0);
  float familyPhase = cellSlot * 0.43 + parity * 0.65;

  // Every layer uses the same curated family for this cell. Frequencies are
  // exact integer multiples, so the nested composition retains base symmetry.
  float macroTheta = theta + tz * uTwist;
  float macroRadius = evolvedFamilyRadius(
    cellId,
    evolution,
    macroTheta,
    MACRO_RADIUS * depthScale * cellScale,
    0.0,
    familyPhase
  );
  float macroZ = direction * (
    0.42 + 0.02 * cos(cellSlot * TWO_PI / 5.0)
  );
  float macroDistance = radialContourSDF(
    rho,
    macroRadius,
    lz,
    macroZ,
    MACRO_THICKNESS * thicknessScale,
    MACRO_DEPTH_WIDTH * thicknessScale
  );

  float midTheta = theta - tz * uTwist * 0.8;
  float midRadius = evolvedFamilyRadius(
    cellId,
    evolution,
    midTheta,
    MID_RADIUS * depthScale * cellScale,
    1.0,
    familyPhase
  );
  float midDistance = radialContourSDF(
    rho,
    midRadius,
    lz,
    0.0,
    MID_THICKNESS * innerThicknessScale,
    MID_DEPTH_WIDTH * innerThicknessScale
  );
  // Only the macro contour may enter the immediate foreground.
  midDistance = max(midDistance, p.z + 0.35);

  vec2 scene = vec2(macroDistance, 0.0);
  if (midDistance < scene.x) scene = vec2(midDistance, 1.0);

  float innerTheta = theta + tz * uTwist * 1.4;
  float innerRadius = evolvedFamilyRadius(
    cellId,
    evolution,
    innerTheta,
    INNER_RADIUS * depthScale * cellScale,
    2.0,
    familyPhase
  );
  float innerDistance = radialContourSDF(
    rho,
    innerRadius,
    lz,
    -direction * 0.36,
    INNER_THICKNESS * innerThicknessScale,
    INNER_DEPTH_WIDTH * innerThicknessScale
  );
  innerDistance = max(innerDistance, p.z + 0.65);
  if (innerDistance < scene.x) scene = vec2(innerDistance, 2.0);

  if (uDetail > 0.5) {
    float fineTheta = theta - tz * uTwist * 1.75;
    float fineRadius = evolvedFamilyRadius(
      cellId,
      evolution,
      fineTheta,
      FINE_RADIUS * depthScale * cellScale,
      3.0,
      familyPhase
    );
    float fineDistance = radialContourSDF(
      rho,
      fineRadius,
      lz,
      direction * 0.18,
      FINE_THICKNESS * innerThicknessScale,
      FINE_DEPTH_WIDTH * innerThicknessScale
    );
    fineDistance = max(fineDistance, p.z + 0.9);
    if (fineDistance < scene.x) scene = vec2(fineDistance, 3.0);
  }

  return scene;
}

vec3 calcNormal(vec3 p, float rayDistance) {
  float depth = clamp(rayDistance / MAX_RAY_DISTANCE, 0.0, 1.0);
  float normalEpsilon = mix(
    NORMAL_EPSILON_NEAR,
    NORMAL_EPSILON_FAR,
    smoothstep(0.0, 1.0, depth)
  );
  vec2 e = vec2(normalEpsilon, -normalEpsilon);
  return normalize(
    e.xyy * tunnelSDF(p + e.xyy).x
    + e.yyx * tunnelSDF(p + e.yyx).x
    + e.yxy * tunnelSDF(p + e.yxy).x
    + e.xxx * tunnelSDF(p + e.xxx).x
  );
}

void main() {
  vec2 uv = (gl_FragCoord.xy * 2.0 - uResolution) / uResolution.y;

  // Procedural ray camera looking down -Z; travel is handled inside the SDF.
  // A modestly wider procedural FOV reduces giant foreground clipping while
  // remaining close enough to the settled Phase 13 camera for a clean handoff.
  vec3 ro = vec3(0.0, 0.0, 0.0);
  vec3 rd = normalize(vec3(uv * 0.58, -1.0));

  float t = 0.002;
  bool hit = false;
  float surfaceCoverage = 0.0;
  float closestDistance = MAX_RAY_DISTANCE;
  float closestT = t;
  vec2 closestSample = vec2(MAX_RAY_DISTANCE, 0.0);
  vec2 sceneSample = vec2(0.0);
  for (int i = 0; i < MAX_STEPS; i++) {
    if (float(i) >= uStepLimit) break;
    sceneSample = tunnelSDF(ro + rd * t);
    float d = sceneSample.x;
    if (d < closestDistance) {
      closestDistance = d;
      closestT = t;
      closestSample = sceneSample;
    }
    if (d < HIT_EPSILON) {
      hit = true;
      break;
    }
    t += d * STEP_SCALE;
    if (t > MAX_RAY_DISTANCE) break;
  }

  if (hit) {
    // Local signed-distance correction converges the coarse hit without
    // increasing the full-screen primary march count.
    for (int i = 0; i < REFINEMENT_STEPS; i++) {
      if (i == 2 && uDetail < 0.5) break;
      float correction = clamp(
        sceneSample.x,
        -HIT_EPSILON * 6.0,
        HIT_EPSILON * 3.0
      );
      t = max(0.002, t + correction * 0.55);
      sceneSample = tunnelSDF(ro + rd * t);
    }
    surfaceCoverage = 1.0;
  } else {
    /*
      One-pixel world footprint turns near-miss rays into partial coverage.
      This feathers only raymarched silhouettes and subpixel ridges; it is not
      fullscreen supersampling and does not blur interior surface detail.
    */
    float pixelWorld = max(
      1.16 * closestT / uResolution.y,
      HIT_EPSILON
    );
    float fringeWidth = pixelWorld * 1.25;
    if (closestDistance < fringeWidth) {
      hit = true;
      t = closestT;
      sceneSample = closestSample;
      surfaceCoverage = 1.0 - smoothstep(
        0.0,
        fringeWidth,
        closestDistance
      );
    }
  }

  vec3 color = vec3(0.0);

  if (hit) {
    vec3 pos = ro + rd * t;
    vec3 n = calcNormal(pos, t);
    float layer = sceneSample.y;

    float diff = max(dot(n, normalize(vec3(0.3, 0.5, 0.75))), 0.0);
    float reverseLight = max(dot(-n, normalize(vec3(-0.5, 0.2, 0.7))), 0.0);
    float rim = pow(1.0 - abs(dot(n, rd)), 2.0);

    float radius = length(pos.xy);
    float cellId = floor((pos.z + uTravel) / CELL_LENGTH);
    float paletteT = (pos.z + uTravel) * 0.035
      + radius * 0.12
      + layer * 0.09
      + uColorPhase;
    float depthTone = 0.5 + 0.5 * cos(
      (pos.z + uTravel) * 0.24 + radius * 0.7 + layer * 1.13
    );

    vec3 cyan = vec3(0.02, 0.92, 0.68);
    vec3 electricBlue = vec3(0.04, 0.38, 1.0);
    vec3 violet = vec3(0.58, 0.08, 1.0);
    vec3 magenta = vec3(1.0, 0.05, 0.48);
    vec3 orange = vec3(1.0, 0.34, 0.04);
    vec3 yellow = vec3(1.0, 0.86, 0.16);
    vec3 warmWhite = vec3(1.0, 0.98, 0.82);

    vec3 earlyColor;
    vec3 middleColor;
    vec3 deepColor;
    vec3 deepestColor;
    if (layer < 0.5) {
      earlyColor = mix(cyan, electricBlue, 0.2 + 0.35 * depthTone);
      middleColor = mix(electricBlue, violet, 0.2 + 0.35 * depthTone);
      deepColor = mix(violet, magenta, 0.15 + 0.3 * depthTone);
      deepestColor = mix(cyan, magenta, 0.28 + 0.35 * depthTone);
    } else if (layer < 1.5) {
      earlyColor = mix(violet, cyan, 0.08 + 0.12 * depthTone);
      middleColor = mix(violet, magenta, 0.35 + 0.3 * depthTone);
      deepColor = mix(magenta, orange, 0.08 + 0.18 * depthTone);
      deepestColor = mix(magenta, orange, 0.15 + 0.25 * depthTone);
    } else if (layer < 2.5) {
      earlyColor = mix(electricBlue, violet, 0.35 + 0.25 * depthTone);
      middleColor = mix(violet, magenta, 0.45 + 0.25 * depthTone);
      deepColor = mix(magenta, orange, 0.38 + 0.28 * depthTone);
      deepestColor = mix(orange, yellow, 0.5 + 0.3 * depthTone);
    } else {
      earlyColor = mix(yellow, warmWhite, 0.45 + 0.2 * depthTone);
      middleColor = mix(magenta, warmWhite, 0.5 + 0.2 * depthTone);
      deepColor = mix(yellow, warmWhite, 0.58 + 0.2 * depthTone);
      deepestColor = mix(yellow, warmWhite, 0.72 + 0.18 * depthTone);
    }

    vec3 hierarchyColor = mix(
      earlyColor,
      middleColor,
      smoothstep(0.12, 0.58, uSpectralProgress)
    );
    hierarchyColor = mix(
      hierarchyColor,
      deepColor,
      smoothstep(0.48, 0.86, uSpectralProgress)
    );
    hierarchyColor = mix(
      hierarchyColor,
      deepestColor,
      smoothstep(0.78, 1.0, uSpectralProgress)
    );

    float paletteInfluence = mix(0.1, 0.17, uSpectralProgress);
    vec3 baseCol = mix(
      hierarchyColor,
      cosinePalette(paletteT),
      paletteInfluence
    );
    vec3 edgeCol = mix(
      hierarchyColor,
      cosinePalette(paletteT + 0.35),
      0.2 + 0.06 * uSpectralProgress
    );

    float middleLayer = step(0.5, layer);
    float innerLayer = step(1.5, layer);
    float fineLayer = step(2.5, layer);
    float centerPull = exp(-radius * 3.2);
    float rimCore = pow(rim, 4.0);

    // Keep broad surfaces below the bloom threshold. Only narrow hierarchy
    // edges carry HDR energy, with fine and inner contours brightest.
    color = baseCol * (0.04 + 0.22 * diff + 0.08 * reverseLight);
    color += baseCol * rim * (0.42 + 0.08 * middleLayer);

    float hierarchyLight = 0.28
      + 0.18 * middleLayer
      + 0.52 * innerLayer
      + 0.62 * fineLayer;
    vec3 spectralHighlight = mix(
      vec3(0.72, 0.92, 1.0),
      vec3(1.0, 0.94, 0.78),
      smoothstep(0.35, 0.9, uSpectralProgress)
    );
    vec3 luminousEdge = mix(
      edgeCol,
      spectralHighlight,
      0.1 + 0.08 * innerLayer + 0.12 * fineLayer
    );
    color += luminousEdge
      * rimCore
      * hierarchyLight
      * (0.65 + 0.35 * uReveal);

    vec3 portalAccent = mix(orange, yellow, uSpectralProgress);
    portalAccent = mix(portalAccent, warmWhite, fineLayer);
    portalAccent = mix(
      portalAccent,
      warmWhite,
      smoothstep(0.78, 1.0, uSpectralProgress)
        * (0.25 + 0.75 * fineLayer)
    );
    color += portalAccent
      * centerPull
      * (0.07 + 0.13 * innerLayer + 0.1 * fineLayer + 0.08 * rim);

    float centerHotspot = centerPull
      * centerPull
      * (0.1 + 0.24 * innerLayer + 0.32 * fineLayer)
      * (0.35 + 0.65 * rimCore);
    color += mix(portalAccent, vec3(1.0, 0.98, 0.88), 0.65)
      * centerHotspot
      * (0.65 + 0.35 * uReveal);

    // Inner rings retain more distant light, reinforcing the central portal.
    float fogDensity = mix(FOG_DENSITY, 0.052, innerLayer);
    fogDensity = mix(fogDensity, 0.045, fineLayer);
    color *= exp(-fogDensity * t);
    float distantPortal = smoothstep(5.0, 22.0, t) * exp(-0.045 * t);
    color += hierarchyColor * centerPull * distantPortal * 0.065;
    vec3 distantCoreColor = mix(
      vec3(0.42, 0.82, 1.0),
      vec3(1.0, 0.9, 0.62),
      smoothstep(0.38, 0.9, uSpectralProgress)
    );
    color += distantCoreColor
      * centerPull
      * rimCore
      * distantPortal
      * (0.08 * innerLayer + 0.12 * fineLayer);
    // Extremely slow luminance breathing keeps a static frame alive without
    // moving the procedural camera or competing with scroll-driven travel.
    color *= 0.97 + 0.03 * sin(uTime * 0.16 + cellId * 1.618);
    color *= surfaceCoverage;
  }

  // Radial portal reveal from screen center instead of a uniform fade.
  float aperture = mix(0.0, APERTURE_MAX, uReveal);
  float centerDistance = length(uv);
  // fwidth is used only here to keep the expanding circular boundary stable
  // at any DPR while preserving the existing broad artistic reveal softness.
  float revealAA = max(fwidth(centerDistance) * 1.5, 1.0 / uResolution.y);
  float mask = 1.0 - smoothstep(
    aperture * 0.72 - revealAA,
    aperture + revealAA,
    centerDistance
  );

  // Faint shimmer riding the expanding reveal edge.
  float edgeGlow = exp(-abs(centerDistance - aperture) * 6.0)
    * (1.0 - uReveal) * step(0.001, aperture);
  color += cosinePalette(uColorPhase * 2.0 + centerDistance * 0.4)
    * edgeGlow * 0.35;

  float alpha = uOpacity * mask;
  gl_FragColor = vec4(color, alpha);
}
`
