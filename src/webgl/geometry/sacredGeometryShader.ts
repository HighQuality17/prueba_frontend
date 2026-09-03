export const sacredGeometryVertexShader = /* glsl */ `
void main() {
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`

export const sacredGeometryFragmentShader = /* glsl */ `
precision highp float;

uniform vec2 uResolution;
uniform float uBirth;
uniform float uIntegration;
uniform float uExpansion;
uniform float uBloom;
uniform float uTiger;
uniform float uSerpent;
uniform float uEagle;
uniform float uFinal;
uniform float uDetail;

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
  vec2 q = vec2(abs(p.x), p.y);
  float line = 0.0;

  line = max(line, lineMask(sdSegment(q, vec2(0.02, 0.55), vec2(0.25, 0.72)), 0.005, aa));
  line = max(line, lineMask(sdSegment(q, vec2(0.25, 0.72), vec2(0.47, 0.53)), 0.005, aa));
  line = max(line, lineMask(sdSegment(q, vec2(0.47, 0.53), vec2(0.43, 0.03)), 0.005, aa));
  line = max(line, lineMask(sdSegment(q, vec2(0.43, 0.03), vec2(0.25, -0.42)), 0.005, aa));
  line = max(line, lineMask(sdSegment(q, vec2(0.25, -0.42), vec2(0.0, -0.53)), 0.005, aa));
  line = max(line, lineMask(sdSegment(q, vec2(0.09, 0.22), vec2(0.36, 0.3)), 0.006, aa));
  line = max(line, lineMask(sdSegment(q, vec2(0.09, 0.22), vec2(0.31, 0.12)), 0.004, aa));
  line = max(line, lineMask(sdCircle(q, vec2(0.235, 0.205), 0.052), 0.004, aa));
  line = max(line, lineMask(sdSegment(q, vec2(0.0, -0.06), vec2(0.19, -0.14)), 0.004, aa));
  line = max(line, lineMask(sdSegment(q, vec2(0.19, -0.14), vec2(0.0, -0.27)), 0.004, aa));

  for (int i = 0; i < 5; i++) {
    float fi = float(i);
    vec2 a = vec2(0.08 + fi * 0.035, 0.48 - fi * 0.15);
    vec2 b = vec2(0.38 + fi * 0.012, 0.4 - fi * 0.145);
    line = max(line, lineMask(sdSegment(q, a, b), 0.0045, aa));
  }

  float browSun = lineMask(sdCircle(p, vec2(0.0, 0.35), 0.12), 0.004, aa);
  browSun = max(browSun, lineMask(sdDiamond(p, vec2(0.0, 0.35), vec2(0.085, 0.14)), 0.004, aa));
  return max(line, browSun);
}

float serpentArchetype(vec2 p, float aa) {
  float y = clamp(p.y, -0.7, 0.58);
  float wave = 0.23 * sin((y + 0.62) * 5.4);
  float slope = 1.242 * cos((y + 0.62) * 5.4);
  float spineDistance = abs(p.x - wave) / sqrt(1.0 + slope * slope);
  float yMask = smoothstep(-0.76, -0.68, p.y) * (1.0 - smoothstep(0.58, 0.68, p.y));
  float body = lineMask(abs(spineDistance - 0.065), 0.004, aa) * yMask;
  float axis = lineMask(spineDistance, 0.0025, aa) * yMask * 0.65;
  float rhythm = abs(fract((p.y + 0.72) * 7.5) - 0.5);
  float segments = lineMask(rhythm * 0.12 + spineDistance * 0.28, 0.012, aa) * yMask;

  vec2 head = vec2(p.x - 0.23 * sin(1.2 * 5.4), p.y - 0.62);
  float crown = lineMask(sdDiamond(head, vec2(0.0), vec2(0.18, 0.14)), 0.005, aa);
  crown = max(crown, lineMask(sdCircle(head, vec2(-0.055, 0.01), 0.018), 0.003, aa));
  crown = max(crown, lineMask(sdCircle(head, vec2(0.055, 0.01), 0.018), 0.003, aa));

  float nodes = 0.0;
  for (int i = 0; i < 7; i++) {
    if (i >= 5 && uDetail < 0.5) continue;
    float ny = -0.55 + float(i) * 0.17;
    float nx = 0.23 * sin((ny + 0.62) * 5.4);
    nodes = max(nodes, lineMask(sdCircle(p, vec2(nx, ny), 0.035), 0.003, aa));
  }
  return max(max(body, axis), max(segments, max(crown, nodes)));
}

float eagleArchetype(vec2 p, float aa) {
  vec2 q = vec2(abs(p.x), p.y);
  float line = 0.0;
  line = max(line, lineMask(sdSegment(q, vec2(0.02, 0.22), vec2(0.3, 0.45)), 0.005, aa));
  line = max(line, lineMask(sdSegment(q, vec2(0.3, 0.45), vec2(0.67, 0.57)), 0.005, aa));
  line = max(line, lineMask(sdSegment(q, vec2(0.67, 0.57), vec2(1.02, 0.42)), 0.005, aa));
  line = max(line, lineMask(sdSegment(q, vec2(1.02, 0.42), vec2(0.76, 0.14)), 0.005, aa));
  line = max(line, lineMask(sdSegment(q, vec2(0.76, 0.14), vec2(0.38, 0.04)), 0.005, aa));
  line = max(line, lineMask(sdSegment(q, vec2(0.38, 0.04), vec2(0.09, -0.2)), 0.005, aa));

  for (int i = 0; i < 7; i++) {
    if (i >= 5 && uDetail < 0.5) continue;
    float fi = float(i);
    vec2 root = vec2(0.1 + fi * 0.075, 0.22 + fi * 0.035);
    vec2 tip = vec2(0.42 + fi * 0.095, -0.02 + fi * 0.065);
    line = max(line, lineMask(sdSegment(q, root, tip), 0.004, aa));
  }

  line = max(line, lineMask(sdCircle(p, vec2(0.0, 0.17), 0.135), 0.004, aa));
  line = max(line, lineMask(sdDiamond(p, vec2(0.0, -0.16), vec2(0.15, 0.31)), 0.004, aa));
  line = max(line, lineMask(sdDiamond(p, vec2(0.0, 0.12), vec2(0.06, 0.075)), 0.004, aa));
  line = max(line, lineMask(sdSegment(p, vec2(0.0, 0.08), vec2(0.13, 0.02)), 0.004, aa));
  return line;
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
  color += mix(gold, magenta, 0.26) * tiger * 1.3;
  color += mix(turquoise, violet, smoothstep(-0.7, 0.65, p.y)) * serpent * 1.35;
  color += mix(cyan, white, smoothstep(0.0, 0.9, abs(p.x))) * eagle * 1.3;

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
