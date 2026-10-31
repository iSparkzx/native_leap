import { accentRGB } from "../lib/palette.ts";
import { onTick } from "../lib/ticker.ts";
import { clamp, damp, lerp, prefersReducedMotion } from "../lib/util.ts";

/* Hero background (WebGL). A perspective field of white points rolls slowly toward the viewer beneath a soft
   horizon light: forward movement, in monochrome. Crests catch more light, an occasional scan of light sweeps in
   from the horizon, the pointer raises a gentle swell and a click sends a ripple. Each carries one of the site's
   accents: the scan is plasma, ripples are nebula, the swell and the horizon glow are ion; resting points stay
   white. The copy sits in a quieter zone.
   Without WebGL the hero keeps its CSS horizon glow; with reduced motion one still frame is drawn. */

const F = 1 / Math.tan((60 * Math.PI) / 360); // focal length for a 60° vertical field of view
const NEAR = 0.6;
const FAR = 11;
const FLOW_SPEED = 0.18; // world units per second toward the viewer
const SPACING_X = 0.06;
const SPACING_Z = 0.07;
const OBSIDIAN = [8 / 255, 9 / 255, 11 / 255];

const POINTS_VS = `
attribute vec2 aGrid;
uniform float uTime, uAspect, uF, uShift, uCamH, uNear, uFar, uFlow, uDpr, uIntro;
uniform vec3 uPointer, uIon, uNebula, uPlasma;
uniform vec4 uRipples[4];
uniform vec4 uQuiet;
varying float vAlpha;
varying vec3 vColor;

void main() {
  float range = uFar - uNear;
  float z = uNear + mod(aGrid.y - uFlow - uNear, range);
  float x = aGrid.x;
  float zw = z + uFlow;
  float t = uTime;

  float h = 0.060 * sin(x * 0.80 + t * 0.30) * sin(zw * 0.55 - t * 0.22)
          + 0.040 * sin(x * 0.33 - zw * 0.41 + t * 0.45)
          + 0.022 * sin(x * 1.70 + zw * 1.30 - t * 0.60);

  vec2 dp = vec2(x - uPointer.x, z - uPointer.y);
  float swell = exp(-dot(dp, dp) / (0.3 * max(uPointer.y, 1.0))) * uPointer.z;
  h += swell * 0.16;

  float ring = 0.0;
  for (int i = 0; i < 4; i++) {
    vec4 r = uRipples[i];
    if (r.w <= 0.0) continue;
    float d = length(vec2(x - r.x, z - r.y));
    float e = (d - r.z * 2.2) / 0.4;
    ring += exp(-e * e) * exp(-r.z * 0.8) * r.w;
  }
  h += ring * 0.15;

  float Y = h - uCamH;
  vec4 clip = vec4(x * uF / uAspect, Y * uF + uShift * z, 0.0, z);
  gl_Position = clip;
  vec2 ndc = clip.xy / z;

  float size = uDpr * clamp(2.6 * pow(1.0 / z, 0.7), 0.9, 3.0);
  gl_PointSize = size;

  float fog = 1.0 - smoothstep(uFar * 0.3, uFar * 0.92, z);
  float nearFade = smoothstep(uNear, uNear + 1.3, z);
  float edge = 1.0 - smoothstep(0.78, 1.04, abs(ndc.x));
  float crest = smoothstep(-0.05, 0.09, h);
  float scanZ = uFar - mod(t * 1.25, range * 2.2);
  float sd = (z - scanZ) / 0.5;
  float scan = exp(-sd * sd);
  vec2 q = (ndc - uQuiet.xy) / uQuiet.zw;
  float quiet = mix(0.42, 1.0, smoothstep(0.55, 1.1, length(q)));
  float front = uFar - uIntro * (range + 3.0);
  float intro = smoothstep(front - 1.5, front, z);
  float tiny = clamp(size / (1.4 * uDpr), 0.4, 1.0);

  float light = 0.3 + 0.6 * crest + 0.55 * scan + 0.9 * swell + 1.1 * ring;
  vAlpha = light * fog * nearFade * edge * quiet * intro * tiny;
  // Colour comes only from the moving light: each source tints the points it lifts, weighted by its share.
  float lift = 0.55 * scan + 0.9 * swell + 1.1 * ring;
  vec3 tint = (0.55 * scan * uPlasma + 0.9 * swell * uIon + 1.1 * ring * uNebula) / max(lift, 0.001);
  vColor = mix(vec3(1.0), tint, smoothstep(0.05, 0.45, lift / light) * 0.95);
}
`;

const POINTS_FS = `
precision mediump float;
varying float vAlpha;
varying vec3 vColor;
void main() {
  float d = length(gl_PointCoord - 0.5);
  gl_FragColor = vec4(vColor, smoothstep(0.5, 0.18, d) * vAlpha);
}
`;

const SKY_VS = `
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

const SKY_FS = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec2 uRes, uLight;
uniform vec3 uBase, uIon, uNebula, uPlasma;
uniform float uShift, uIntro;
void main() {
  vec2 ndc = gl_FragCoord.xy / uRes * 2.0 - 1.0;
  float aspect = uRes.x / uRes.y;
  float hy = (ndc.y - uShift) / 0.15;
  float hx = ndc.x / 0.95;
  float horizon = exp(-hy * hy - hx * hx) * 0.11;
  vec2 dome = vec2(ndc.x * aspect * 0.42, (ndc.y - uShift - 0.08) * 1.3);
  float glow = exp(-dot(dome, dome) * 2.4) * 0.06;
  vec2 lp = (ndc - uLight) * vec2(aspect, 1.0);
  float follow = exp(-dot(lp, lp) * 1.8) * 0.035;
  // An ion-blue horizon under a faint nebula dome; the pointer light is plasma.
  vec3 col = horizon * mix(vec3(1.0), uIon, 0.7) + glow * mix(vec3(1.0), uNebula, 0.6) + follow * mix(vec3(1.0), uPlasma, 0.6);
  float n = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
  col = col * uIntro + (n - 0.5) * 1.5 / 255.0;
  gl_FragColor = vec4(uBase + col, 1.0);
}
`;

function compile(gl: WebGLRenderingContext, vs: string, fs: string): WebGLProgram {
  const program = gl.createProgram()!;
  for (const [type, source] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]] as const) {
    const shader = gl.createShader(type)!;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) ?? "shader");
    gl.attachShader(program, shader);
  }
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) ?? "link");
  return program;
}

function uniforms(gl: WebGLRenderingContext, program: WebGLProgram, names: string[]): Record<string, WebGLUniformLocation | null> {
  return Object.fromEntries(names.map((name) => [name, gl.getUniformLocation(program, name)]));
}

/** Grid of (x, z) points covering the view out to FAR, with rows evenly spaced so the flow wraps seamlessly. */
function buildGrid(aspect: number): Float32Array {
  const halfWidth = ((aspect * FAR) / F) * 1.05;
  const cols = Math.ceil((halfWidth * 2) / SPACING_X);
  const rows = Math.round((FAR - NEAR) / SPACING_Z);
  const dz = (FAR - NEAR) / rows;
  const data = new Float32Array(cols * rows * 2);
  let i = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      data[i++] = -halfWidth + c * SPACING_X;
      data[i++] = NEAR + r * dz;
    }
  }
  return data;
}

const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3);

export function initField(): void {
  const hero = document.querySelector<HTMLElement>(".hero");
  const canvas = document.querySelector<HTMLCanvasElement>(".hero-field");
  const inner = document.querySelector<HTMLElement>(".hero-inner");
  const title = document.querySelector<HTMLElement>(".hero-title");
  if (!hero || !canvas || !inner || !title) return;

  const gl = canvas.getContext("webgl", { alpha: false, antialias: false, powerPreference: "low-power" });
  if (!gl) {
    hero.classList.add("no-field");
    return;
  }

  let pointsProgram: WebGLProgram;
  let skyProgram: WebGLProgram;
  try {
    pointsProgram = compile(gl, POINTS_VS, POINTS_FS);
    skyProgram = compile(gl, SKY_VS, SKY_FS);
  } catch {
    hero.classList.add("no-field");
    return;
  }
  hero.classList.add("has-field");

  const pu = uniforms(gl, pointsProgram, [
    "uTime", "uAspect", "uF", "uShift", "uCamH", "uNear", "uFar", "uFlow", "uDpr", "uIntro",
    "uPointer", "uIon", "uNebula", "uPlasma", "uRipples[0]", "uQuiet",
  ]);
  const su = uniforms(gl, skyProgram, ["uRes", "uLight", "uBase", "uShift", "uIntro", "uIon", "uNebula", "uPlasma"]);
  const accents = (["ion", "nebula", "plasma"] as const).map((name) => accentRGB(name).map((c) => c / 255));
  const setAccents = (u: Record<string, WebGLUniformLocation | null>): void => {
    gl.uniform3fv(u.uIon, accents[0]);
    gl.uniform3fv(u.uNebula, accents[1]);
    gl.uniform3fv(u.uPlasma, accents[2]);
  };
  const gridAttr = gl.getAttribLocation(pointsProgram, "aGrid");
  const skyAttr = gl.getAttribLocation(skyProgram, "aPos");

  const gridBuffer = gl.createBuffer();
  const skyBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, skyBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);

  const reduced = prefersReducedMotion();
  const view = { width: 1, height: 1, dpr: 1, aspect: 1, shift: 0, camH: 0.7, quiet: [0, 0, 1, 1] };
  let gridAspect = 0;
  let pointCount = 0;
  let time = reduced ? 9 : 0;
  let scrollFlow = 0;
  const pointer = { x: 0, z: 4, amount: 0, targetX: 0, targetZ: 4, targetAmount: 0 };
  const light = { x: 0, y: 0.2, targetX: 0, targetY: 0.2 };
  const ripples: { x: number; z: number; born: number }[] = [];
  const rippleData = new Float32Array(16);

  function measure(): void {
    view.width = hero!.clientWidth;
    view.height = hero!.clientHeight;
    view.dpr = Math.min(2, window.devicePixelRatio || 1);
    view.aspect = view.width / view.height;
    canvas!.width = Math.round(view.width * view.dpr);
    canvas!.height = Math.round(view.height * view.dpr);
    gl!.viewport(0, 0, canvas!.width, canvas!.height);

    // Layout offsets ignore transforms, so the intro animation doesn't move the horizon.
    const titleTop = inner!.offsetTop + title!.offsetTop;
    const horizonPx = titleTop + title!.offsetHeight * 0.62;
    view.shift = 1 - (2 * horizonPx) / view.height;
    // Camera height puts the ground plane's z = 1.5 row on the bottom edge.
    view.camH = ((view.shift + 1) * 1.5) / F;

    const top = titleTop - 8;
    const bottom = inner!.offsetTop + inner!.offsetHeight;
    const left = inner!.offsetLeft;
    const right = left + inner!.offsetWidth;
    view.quiet = [
      ((left + right) / 2 / view.width) * 2 - 1,
      1 - ((top + bottom) / 2 / view.height) * 2,
      ((right - left) / view.width) * 1.05,
      ((bottom - top) / view.height) * 1.1,
    ];
    light.targetX = light.x = 0;
    light.targetY = light.y = view.shift + 0.25;

    if (Math.abs(view.aspect - gridAspect) > 0.02) {
      gridAspect = view.aspect;
      const grid = buildGrid(view.aspect);
      pointCount = grid.length / 2;
      gl!.bindBuffer(gl!.ARRAY_BUFFER, gridBuffer);
      gl!.bufferData(gl!.ARRAY_BUFFER, grid, gl!.STATIC_DRAW);
    }
  }

  /** Where a screen point lands on the ground plane, or null above the horizon. */
  function toPlane(clientX: number, clientY: number): { x: number; z: number } | null {
    const rect = hero!.getBoundingClientRect();
    const nx = ((clientX - rect.left) / rect.width) * 2 - 1;
    const ny = 1 - ((clientY - rect.top) / rect.height) * 2;
    if (ny > view.shift - 0.02) return null;
    const z = (view.camH * F) / (view.shift - ny);
    if (z > FAR) return null;
    return { x: (nx * view.aspect * z) / F, z };
  }

  function draw(intro: number): void {
    const g = gl!;
    g.disable(g.BLEND);
    g.useProgram(skyProgram);
    g.uniform2f(su.uRes, canvas!.width, canvas!.height);
    g.uniform2f(su.uLight, light.x, light.y);
    g.uniform3f(su.uBase, OBSIDIAN[0], OBSIDIAN[1], OBSIDIAN[2]);
    g.uniform1f(su.uShift, view.shift);
    g.uniform1f(su.uIntro, Math.min(1, intro * 1.4));
    setAccents(su);
    g.bindBuffer(g.ARRAY_BUFFER, skyBuffer);
    g.enableVertexAttribArray(skyAttr);
    g.vertexAttribPointer(skyAttr, 2, g.FLOAT, false, 0, 0);
    g.drawArrays(g.TRIANGLES, 0, 3);

    g.enable(g.BLEND);
    g.blendFunc(g.SRC_ALPHA, g.ONE);
    g.useProgram(pointsProgram);
    g.uniform1f(pu.uTime, time);
    g.uniform1f(pu.uAspect, view.aspect);
    g.uniform1f(pu.uF, F);
    g.uniform1f(pu.uShift, view.shift);
    g.uniform1f(pu.uCamH, view.camH);
    g.uniform1f(pu.uNear, NEAR);
    g.uniform1f(pu.uFar, FAR);
    g.uniform1f(pu.uFlow, reduced ? 0 : time * FLOW_SPEED + scrollFlow);
    g.uniform1f(pu.uDpr, view.dpr);
    g.uniform1f(pu.uIntro, intro);
    g.uniform3f(pu.uPointer, pointer.x, pointer.z, pointer.amount);
    setAccents(pu);
    rippleData.fill(0);
    ripples.slice(0, 4).forEach((r, i) => rippleData.set([r.x, r.z, time - r.born, 1], i * 4));
    g.uniform4fv(pu["uRipples[0]"], rippleData);
    g.uniform4f(pu.uQuiet, view.quiet[0], view.quiet[1], view.quiet[2], view.quiet[3]);
    g.bindBuffer(g.ARRAY_BUFFER, gridBuffer);
    g.enableVertexAttribArray(gridAttr);
    g.vertexAttribPointer(gridAttr, 2, g.FLOAT, false, 0, 0);
    g.drawArrays(g.POINTS, 0, pointCount);
  }

  measure();

  if (reduced) {
    draw(1);
    new ResizeObserver(() => {
      measure();
      draw(1);
    }).observe(hero);
    return;
  }

  function step(dt: number): void {
    time += dt;
    scrollFlow = lerp(scrollFlow, Math.min(window.scrollY, view.height) * 0.0025, damp(6, dt));
    pointer.x = lerp(pointer.x, pointer.targetX, damp(5, dt));
    pointer.z = lerp(pointer.z, pointer.targetZ, damp(5, dt));
    pointer.amount = lerp(pointer.amount, pointer.targetAmount, damp(3, dt));
    light.x = lerp(light.x, light.targetX, damp(2, dt));
    light.y = lerp(light.y, light.targetY, damp(2, dt));
    while (ripples.length && time - ripples[0].born > 4.5) ripples.shift();
    draw(easeOutCubic(clamp((time - 0.15) / 2.6, 0, 1)));
  }

  let stop: (() => void) | null = null;
  new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting && !stop) stop = onTick(step);
    else if (!entry.isIntersecting && stop) {
      stop();
      stop = null;
    }
  }).observe(hero);

  let queued = false;
  new ResizeObserver(() => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      measure();
    });
  }).observe(hero);
  document.fonts?.ready.then(measure);

  hero.addEventListener("pointermove", (event) => {
    if (event.pointerType !== "mouse") return;
    const rect = hero.getBoundingClientRect();
    light.targetX = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    light.targetY = 1 - ((event.clientY - rect.top) / rect.height) * 2;
    const hit = toPlane(event.clientX, event.clientY);
    pointer.targetAmount = hit ? 1 : 0;
    if (hit) {
      pointer.targetX = hit.x;
      pointer.targetZ = hit.z;
    }
  });
  hero.addEventListener("pointerleave", () => {
    pointer.targetAmount = 0;
    light.targetX = 0;
    light.targetY = view.shift + 0.25;
  });
  hero.addEventListener("click", (event) => {
    if ((event.target as Element).closest("a, button")) return;
    const hit = toPlane(event.clientX, event.clientY) ?? { x: 0, z: 5 };
    ripples.push({ x: hit.x, z: hit.z, born: time });
    if (ripples.length > 4) ripples.shift();
  });

  canvas.addEventListener("webglcontextlost", (event) => {
    event.preventDefault();
    stop?.();
    stop = null;
    hero.classList.replace("has-field", "no-field");
  });
}
