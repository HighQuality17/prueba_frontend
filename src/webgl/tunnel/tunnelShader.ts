/*
  Procedural kaleidoscopic tunnel — fullscreen SDF raymarcher.

  Deterministic constants (documented per Phase 14 requirements):
  - CELL_LENGTH 3.0        world units per repeated tunnel cell
  - OUTER_THICKNESS 0.09   thin macro arch cage (previously 0.16)
  - MID_THICKNESS 0.07     counter-rotating diamond lattice
  - FINE_THICKNESS 0.05    desktop-only folded octahedral ridges
  - MAX_STEPS 64           hard loop bound; uStepLimit lowers it (mobile 40)
  - REFINEMENT_STEPS 3     local corrections after a hit (mobile uses 2)
  - STEP_SCALE 0.75        conservative step factor: folds/abs() overestimate
                           distance, so steps are shortened to avoid skipping
  - HIT_EPSILON 0.002      surface hit threshold in world units
  - NORMAL_EPSILON         distance-adaptive 0.0038 -> 0.0055 sampling radius
  - MAX_RAY_DISTANCE 30.0  rays beyond this count as miss
  - FOG_DENSITY 0.1        exponential distance fog toward black

  Per pixel cost: <= uStepLimit map evaluations. Each map evaluates two layer
  distances on mobile and three on desktop. Confirmed hits add 2 mobile / 3
  desktop local refinements and 4 map evaluations for the tetrahedral normal.
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
uniform float uStepLimit;
uniform float uDetail;

#define TWO_PI 6.28318530718
#define CELL_LENGTH 3.0
#define OUTER_RADIUS 1.72
#define OUTER_ARCH_SIZE 0.36
#define OUTER_THICKNESS 0.09
#define MID_RADIUS 1.06
#define MID_THICKNESS 0.07
#define FINE_RADIUS 0.68
#define FINE_THICKNESS 0.05
#define MAX_STEPS 64
#define REFINEMENT_STEPS 3
#define STEP_SCALE 0.75
#define HIT_EPSILON 0.002
#define NORMAL_EPSILON_NEAR 0.0038
#define NORMAL_EPSILON_FAR 0.0055
#define MAX_RAY_DISTANCE 30.0
#define FOG_DENSITY 0.1
#define APERTURE_MAX 2.6

float hash11(float n) {
  return fract(sin(n * 127.1) * 43758.5453);
}

vec2 rotate2D(vec2 v, float a) {
  float c = cos(a);
  float s = sin(a);
  return mat2(c, -s, s, c) * v;
}

// Cosine palette anchored to violet/yellow/green with cyan/magenta drift.
vec3 cosinePalette(float t) {
  return vec3(0.38, 0.32, 0.45)
    + vec3(0.45, 0.38, 0.45) * cos(TWO_PI * (t + vec3(0.82, 0.58, 0.34)));
}

float foldAngle(float angle, float symmetry) {
  float sector = TWO_PI / symmetry;
  float centered = mod(angle + 0.5 * sector, sector) - 0.5 * sector;
  // Nonnegative mirror coordinates stay continuous at wrapped sector edges
  // and avoid blending opposite signs during staged symmetry transitions.
  return abs(centered);
}

float symmetryCount(float phase) {
  if (phase < 0.28) return 6.0;
  if (phase < 0.4) {
    return mix(6.0, 8.0, smoothstep(0.28, 0.4, phase));
  }
  if (phase < 0.62) return 8.0;
  if (phase < 0.76) {
    return mix(8.0, 12.0, smoothstep(0.62, 0.76, phase));
  }
  return 12.0;
}

/*
  Keep folds at stable integer sector counts, only crossfading folded angles
  during two short 6 -> 8 -> 12 transitions. This avoids persistent seams
  from feeding a fractional sector count directly to mod().
*/
float stagedFoldAngle(float angle, float phase, float frequency) {
  if (phase < 0.28) return foldAngle(angle, 6.0 * frequency);
  if (phase < 0.4) {
    float blend = smoothstep(0.28, 0.4, phase);
    return mix(
      foldAngle(angle, 6.0 * frequency),
      foldAngle(angle, 8.0 * frequency),
      blend
    );
  }
  if (phase < 0.62) return foldAngle(angle, 8.0 * frequency);
  if (phase < 0.76) {
    float blend = smoothstep(0.62, 0.76, phase);
    return mix(
      foldAngle(angle, 8.0 * frequency),
      foldAngle(angle, 12.0 * frequency),
      blend
    );
  }
  return foldAngle(angle, 12.0 * frequency);
}

vec2 tunnelSDF(vec3 p) {
  // Infinite repetition: slide domain by travel, wrap into one cell.
  float tz = p.z + uTravel;
  float cellId = floor(tz / CELL_LENGTH);
  float lz = tz - cellId * CELL_LENGTH - 0.5 * CELL_LENGTH;

  float h1 = hash11(cellId);
  float h2 = hash11(cellId + 31.7);
  float h3 = hash11(cellId + 67.4);
  float parity = mod(cellId, 2.0);
  float direction = mix(-1.0, 1.0, parity);

  float symmetryPhase = clamp((uSymmetry - 6.0) / 6.0, 0.0, 1.0);
  float symmetry = symmetryCount(symmetryPhase);
  float sector = TWO_PI / symmetry;

  // Near arches sit farther out to frame the viewport; distant cells become
  // slightly smaller and thinner, concentrating detail at the vanishing point.
  float viewDepth = clamp(-p.z / MAX_RAY_DISTANCE, 0.0, 1.0);
  float depthEase = smoothstep(0.0, 1.0, viewDepth);
  float depthScale = mix(1.14, 0.86, depthEase);
  float thicknessScale = mix(1.0, 0.72, depthEase);
  float cellRadiusScale = 0.94 + 0.12 * h2;
  float zOffset = (h3 - 0.5) * 0.2 + (parity - 0.5) * 0.08;
  float cellRotation = (h1 - 0.5) * sector * 0.7 + parity * sector * 0.5;

  // Macro layer: hollow arch contours replace the former solid toroidal tube.
  vec2 outerXY = rotate2D(
    p.xy,
    direction * lz * uTwist + cellRotation
  );
  float radius = length(outerXY);
  float outerAngle = stagedFoldAngle(
    atan(outerXY.y, outerXY.x),
    symmetryPhase,
    1.0
  );
  float outerRadius = OUTER_RADIUS * cellRadiusScale * depthScale
    + 0.12 * cos(outerAngle * symmetry + parity * 3.14159265);
  float archSize = OUTER_ARCH_SIZE * (0.9 + 0.2 * h3);
  vec2 outerProfile = vec2(
    radius - outerRadius,
    (lz + zOffset) * 0.82
  );
  float outerDistance = abs(length(outerProfile) - archSize)
    - OUTER_THICKNESS * thicknessScale * (0.9 + 0.2 * h2);

  // Mid layer: mirrored diamond contours counter-rotate against the arches.
  vec2 midXY = rotate2D(
    p.xy,
    -direction * lz * uTwist * 1.3
      - cellRotation * 0.65
      + parity * sector * 0.25
  );
  float midRawAngle = atan(midXY.y, midXY.x);
  float midAngle = stagedFoldAngle(
    midRawAngle,
    symmetryPhase,
    2.0
  );
  vec2 midFolded = vec2(cos(midAngle), sin(midAngle)) * radius;
  float midRadial = midFolded.x
    - MID_RADIUS * cellRadiusScale * depthScale;
  float midZ = lz - zOffset * 0.55;
  float diamondSize = 0.3 + 0.055 * parity + 0.035 * (h1 - 0.5);
  float diamondContour = abs(
    abs(midFolded.y) * 1.2 + abs(midZ) * 0.72 - diamondSize
  ) * 0.72;
  float midDistance = length(vec2(midRadial, diamondContour))
    - MID_THICKNESS * thicknessScale * (0.9 + 0.15 * h3);

  vec2 scene = vec2(outerDistance, 0.0);
  if (midDistance < scene.x) scene = vec2(midDistance, 1.0);

  if (uDetail > 0.5) {
    // Fine layer: cheap abs/add octahedral shells at 3x angular frequency.
    float fineAngle = stagedFoldAngle(
      midRawAngle
        + direction * lz * uTwist * 0.55
        + parity * sector * 0.18,
      symmetryPhase,
      3.0
    );
    vec2 fineFolded = vec2(cos(fineAngle), sin(fineAngle)) * radius;
    vec3 finePoint = vec3(
      fineFolded.x - FINE_RADIUS * depthScale * (0.96 + 0.08 * h2),
      fineFolded.y * 1.45,
      (lz + zOffset * 0.35) * 0.78
    );
    float fineSize = 0.19 + 0.03 * h1;
    float octahedralContour = abs(
      (abs(finePoint.x) + abs(finePoint.y) + abs(finePoint.z))
        * 0.57735
        - fineSize
    );
    float fineDistance = octahedralContour
      - FINE_THICKNESS * thicknessScale;
    if (fineDistance < scene.x) scene = vec2(fineDistance, 2.0);
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
    float paletteT = hash11(cellId) * 0.22
      + radius * 0.12
      + pos.z * 0.03
      + uColorPhase
      + uTime * 0.015;

    vec3 hierarchyColor;
    if (layer < 0.5) {
      hierarchyColor = vec3(0.08, 0.72, 0.61);
    } else if (layer < 1.5) {
      hierarchyColor = vec3(0.67, 0.25, 0.94);
    } else {
      hierarchyColor = vec3(1.0, 0.63, 0.13);
    }

    vec3 baseCol = mix(hierarchyColor, cosinePalette(paletteT), 0.32);
    vec3 edgeCol = mix(
      hierarchyColor,
      cosinePalette(paletteT + 0.35),
      0.45
    );

    // Thin structures read through emissive rims rather than plastic shading.
    color = baseCol * (0.08 + 0.32 * diff + 0.12 * reverseLight);
    color += baseCol * rim * 1.42;
    color += edgeCol * pow(rim, 3.0) * 1.05;

    float fineLayer = step(1.5, layer);
    float centerPull = exp(-radius * 2.3);
    color += vec3(1.0, 0.68, 0.16)
      * centerPull
      * (0.08 + 0.24 * fineLayer + 0.12 * rim);

    // Inner/fine surfaces retain more distant light at the focal point.
    float fogDensity = mix(FOG_DENSITY, 0.055, fineLayer);
    color *= exp(-fogDensity * t);
    color += hierarchyColor
      * centerPull
      * smoothstep(5.0, 22.0, t)
      * exp(-0.045 * t)
      * 0.08;
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
