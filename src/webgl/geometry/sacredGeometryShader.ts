export const sacredGeometryVertexShader = /* glsl */ `
void main() {
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`

export const sacredGeometryFragmentShader = /* glsl */ `
precision highp float;

uniform vec2 uResolution;
uniform float uTime;
uniform float uBirth;
uniform float uIntegration;
uniform float uExpansion;
uniform float uBloom;
uniform float uTiger;
uniform float uSerpent;
uniform float uEagle;
uniform float uFinal;
uniform float uDetail;
uniform sampler2D uTigerTex;
uniform sampler2D uSerpentTex;
uniform sampler2D uEagleTex;

#define PI 3.14159265359
#define TAU 6.28318530718
#define PHI 1.61803398875

float lineMask(float distanceToLine, float width, float aa) {
  return 1.0 - smoothstep(width, width + aa, distanceToLine);
}

float sdCircle(vec2 p, vec2 center, float radius) {
  return abs(length(p - center) - radius);
}

float sdSegment(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h);
}

float sdDiamond(vec2 p, vec2 center, vec2 radius) {
  vec2 q = abs(p - center) / radius;
  return (abs(q.x + q.y - 1.0) * min(radius.x, radius.y));
}

float ringFamily(vec2 p, float aa, float reveal) {
  float radius = length(p);
  float rings = 0.0;
  for (int i = 1; i <= 8; i++) {
    if (i > 5 && uDetail < 0.5) continue;
    float r = 0.105 * float(i);
    float order = smoothstep(float(i) * 0.095, float(i) * 0.095 + 0.18, reveal);
    rings = max(rings, lineMask(abs(radius - r), 0.0022, aa) * order);
  }
  return rings;
}

float flowerOfLife(vec2 p, float aa, float reveal) {
  float circles = lineMask(sdCircle(p, vec2(0.0), 0.205), 0.0024, aa);
  for (int i = 0; i < 12; i++) {
    if (i >= 6 && uDetail < 0.5) continue;
    float fi = float(i);
    float radius = i < 6 ? 0.205 : 0.355;
    float angle = TAU * fi / 6.0 + (i < 6 ? 0.0 : PI / 6.0);
    vec2 center = radius * vec2(cos(angle), sin(angle));
    float order = smoothstep(fi * 0.045, fi * 0.045 + 0.24, reveal);
    circles = max(
      circles,
      lineMask(sdCircle(p, center, 0.205), 0.0022, aa) * order
    );
  }
  return circles;
}

float radialSystem(vec2 p, float aa, float reveal) {
  float radius = length(p);
  float angle = atan(p.y, p.x);
  float spokes = abs(sin(angle * 6.0)) * radius;
  float rays = lineMask(spokes, 0.002, aa) * smoothstep(0.05, 0.8, radius);
  float starRadius = 0.43 + 0.105 * cos(6.0 * angle);
  float star = lineMask(abs(radius - starRadius), 0.0025, aa);
  float innerStarRadius = 0.255 + 0.075 * cos(12.0 * angle);
  star = max(star, lineMask(abs(radius - innerStarRadius), 0.002, aa));
  return (rays * 0.75 + star) * smoothstep(0.18, 0.72, reveal);
}

float satelliteMandala(vec2 p, vec2 center, float scale, float aa) {
  vec2 q = (p - center) / scale;
  float radius = length(q);
  float angle = atan(q.y, q.x);
  float ring = lineMask(abs(radius - 0.32), 0.006 / scale, aa / scale);
  ring = max(ring, lineMask(abs(radius - 0.58), 0.005 / scale, aa / scale));
  float petals = lineMask(abs(radius - (0.43 + 0.11 * cos(8.0 * angle))), 0.006 / scale, aa / scale);
  return max(ring, petals);
}

float tigerArchetype(vec2 p, float aa) {
  float aspect = uResolution.x / uResolution.y;
  vec2 offset = aspect > 1.1 ? vec2(0.12, 0.02) : vec2(0.0, 0.06);
  float baseScale = aspect > 1.1 ? 0.90 : 0.82;
  
  float breathe = 1.0 + 0.015 * sin(uTime * 2.2);
  vec2 q = (p - offset) / (baseScale * breathe);
  
  vec2 uv = vec2(q.x + 0.5, q.y + 0.5);
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) return 0.0;
  
  float edgeFade = smoothstep(0.0, 0.04, uv.x) * smoothstep(1.0, 0.96, uv.x)
                 * smoothstep(0.0, 0.04, uv.y) * smoothstep(1.0, 0.96, uv.y);
                 
  float mask = texture2D(uTigerTex, uv).a * edgeFade;
  
  float core = smoothstep(0.18, 0.75, mask);
  float aura = smoothstep(0.05, 0.5, mask) * 0.45;
  float shimmer = 1.0 + 0.06 * sin(uTime * 4.0 + q.y * 6.0);
  
  float eyeDist = length(q - vec2(0.0, 0.12));
  float sacredHalo = lineMask(abs(eyeDist - 0.28), 0.003, aa) * 0.35;
  sacredHalo += lineMask(abs(eyeDist - 0.38), 0.002, aa) * 0.22;
  
  return (core * 1.15 + aura) * shimmer + sacredHalo;
}

float serpentArchetype(vec2 p, float aa) {
  float aspect = uResolution.x / uResolution.y;
  vec2 offset = aspect > 1.1 ? vec2(-0.10, 0.0) : vec2(0.0, 0.04);
  float baseScale = aspect > 1.1 ? 0.96 : 0.86;
  
  float undulation = sin(uTime * 2.0 + p.y * 4.0) * 0.008;
  vec2 q = ((p - offset) + vec2(undulation, 0.0)) / baseScale;
  
  vec2 uv = vec2(q.x + 0.5, q.y + 0.5);
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) return 0.0;
  
  float edgeFade = smoothstep(0.0, 0.03, uv.x) * smoothstep(1.0, 0.97, uv.x)
                 * smoothstep(0.0, 0.03, uv.y) * smoothstep(1.0, 0.97, uv.y);
                 
  float mask = texture2D(uSerpentTex, uv).a * edgeFade;
  
  float core = smoothstep(0.15, 0.70, mask);
  float scales = smoothstep(0.35, 0.90, mask);
  float aura = smoothstep(0.04, 0.45, mask) * 0.4;
  float shimmer = 1.0 + 0.08 * sin(uTime * 3.5 - q.y * 5.0);
  
  float spineRings = lineMask(abs(length(q - vec2(0.0, -0.05)) - 0.42), 0.0025, aa) * 0.28;
  
  return (core + scales * 0.35 + aura) * shimmer + spineRings;
}

float eagleArchetype(vec2 p, float aa) {
  float aspect = uResolution.x / uResolution.y;
  vec2 offset = aspect > 1.1 ? vec2(0.04, 0.02) : vec2(0.0, 0.05);
  float baseScale = aspect > 1.1 ? 1.15 : 0.98;
  
  float breathe = 1.0 + 0.012 * sin(uTime * 1.8);
  vec2 q = (p - offset) / (baseScale * breathe);
  
  vec2 uv = vec2(q.x + 0.5, q.y + 0.5);
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) return 0.0;
  
  float edgeFade = smoothstep(0.0, 0.02, uv.x) * smoothstep(1.0, 0.98, uv.x)
                 * smoothstep(0.0, 0.02, uv.y) * smoothstep(1.0, 0.98, uv.y);
                 
  float mask = texture2D(uEagleTex, uv).a * edgeFade;
  
  float core = smoothstep(0.18, 0.72, mask);
  float details = smoothstep(0.40, 0.88, mask);
  float aura = smoothstep(0.04, 0.50, mask) * 0.42;
  float shimmer = 1.0 + 0.07 * cos(uTime * 2.8 + abs(q.x) * 4.0);
  
  float radDist = length(q);
  float radAngle = atan(q.y, q.x);
  float fanRays = lineMask(abs(sin(radAngle * 12.0)) * radDist, 0.002, aa) * smoothstep(0.2, 0.7, radDist) * 0.18;
  float auraRing = lineMask(abs(radDist - 0.48), 0.0025, aa) * 0.26;
  
  return (core + details * 0.3 + aura) * shimmer + fanRays + auraRing;
}

void main() {
  vec2 p = (gl_FragCoord.xy - 0.5 * uResolution.xy) / min(uResolution.x, uResolution.y);
  float aa = 1.35 / min(uResolution.x, uResolution.y);

  // Golden-ratio scale growth keeps the first diagram pinned to the pupil.
  float fieldScale = mix(0.075, 1.0, uExpansion);
  vec2 geometryP = p / fieldScale;
  float radialReveal = (uBirth * 0.18 + uExpansion * 1.3) * PHI;
  float revealMask = 1.0 - smoothstep(radialReveal, radialReveal + 0.12, length(p));

  float rings = ringFamily(geometryP, aa / fieldScale, radialReveal);
  float flower = flowerOfLife(geometryP, aa / fieldScale, radialReveal);
  float radial = radialSystem(geometryP, aa / fieldScale, radialReveal);
  float centralGeometry = max(rings, max(flower, radial)) * revealMask;

  float satellites = 0.0;
  if (uBloom > 0.0001) {
    satellites = max(satellites, satelliteMandala(p, vec2(-0.82, 0.34), 0.72, aa));
    satellites = max(satellites, satelliteMandala(p, vec2(0.82, 0.34), 0.72, aa));
    satellites = max(satellites, satelliteMandala(p, vec2(-0.58, -0.48), 0.58, aa));
    satellites = max(satellites, satelliteMandala(p, vec2(0.58, -0.48), 0.58, aa));
    satellites *= uBloom;
  }

  float animalPresence = max(uTiger, max(uSerpent, uEagle));
  float field = max(centralGeometry, satellites) * mix(1.0, 0.38, animalPresence);
  float tiger = 0.0;
  float serpent = 0.0;
  float eagle = 0.0;
  if (uTiger > 0.0001) tiger = tigerArchetype(p, aa) * uTiger;
  if (uSerpent > 0.0001) serpent = serpentArchetype(p, aa) * uSerpent;
  if (max(uEagle, uFinal) > 0.0001) {
    eagle = eagleArchetype(p, aa) * max(uEagle, uFinal);
  }

  vec3 cyan = vec3(0.03, 1.45, 1.65);
  vec3 turquoise = vec3(0.02, 1.08, 0.78);
  vec3 violet = vec3(0.68, 0.14, 1.45);
  vec3 magenta = vec3(1.38, 0.04, 0.72);
  vec3 gold = vec3(1.55, 0.74, 0.12);
  vec3 white = vec3(1.7, 1.62, 1.35);

  float angle = atan(p.y, p.x);
  vec3 fieldColor = mix(cyan, violet, 0.5 + 0.5 * sin(angle * 6.0));
  fieldColor = mix(fieldColor, magenta, smoothstep(0.45, 1.2, length(p)) * 0.42);
  vec3 color = fieldColor * field * (0.62 + 0.52 * uBloom);
  
  vec3 tigerColor = mix(gold, magenta, smoothstep(0.05, 0.40, abs(p.x)));
  color += tigerColor * tiger * 1.35;
  color += mix(turquoise, violet, smoothstep(-0.45, 0.35, p.y)) * serpent * 1.4;
  color += mix(cyan, white, smoothstep(0.08, 0.55, abs(p.x))) * eagle * 1.35;

  float origin = exp(-dot(p, p) * mix(640.0, 90.0, uBirth));
  color += mix(white, cyan, 0.42) * origin * uBirth * (1.0 - 0.55 * uBloom) * 1.8;

  float backgroundAlpha = uBloom * mix(0.08, 0.18, 1.0 - animalPresence);
  vec3 background = mix(vec3(0.001, 0.003, 0.012), vec3(0.018, 0.004, 0.045), length(p));
  color += background * backgroundAlpha;
  float lineAlpha = clamp(max(field, max(tiger, max(serpent, eagle))) * 1.18 + origin * uBirth, 0.0, 1.0);
  float alpha = max(backgroundAlpha, lineAlpha) * max(uBirth, uIntegration);
  gl_FragColor = vec4(color, alpha);
}
`
