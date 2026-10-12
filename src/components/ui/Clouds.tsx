"use client";

import { useEffect, useRef, type CSSProperties } from "react";

/**
 * Soft, slowly drifting clouds drawn with WebGL: layered Perlin noise, domain
 * warped so the shapes billow instead of looking like static. Fills its
 * container, renders at a reduced internal resolution (clouds have no edges to
 * keep sharp), pauses while off screen or in a hidden tab, and draws a single
 * still frame when the visitor prefers reduced motion. It never reacts to the
 * cursor. Colours are CSS colour strings.
 */

export interface CloudsProps {
  /** Sky colour at the top and the bottom edge. */
  skyTop?: string;
  skyBottom?: string;
  /** Lit cloud body and the greyer, thinner edges. */
  cloud?: string;
  shade?: string;
  /** Drift speed; 1 is already brisk. */
  speed?: number;
  /** Noise scale: smaller numbers mean bigger clouds. */
  scale?: number;
  /** Coverage threshold 0..1: lower means more cloud. */
  cover?: number;
  /** Edge softness 0..1. */
  softness?: number;
  /** Internal render width in pixels; the canvas is scaled up to its box. */
  resolution?: number;
  className?: string;
  style?: CSSProperties;
}

type Settings = Required<Omit<CloudsProps, "className" | "style">>;

const FRAME_MS = 1000 / 30; // clouds drift slowly; 30 fps is plenty and halves the GPU work

const VERTEX = `attribute vec2 aPosition;
void main() {
  gl_Position = vec4(aPosition, 0.0, 1.0);
}`;

const FRAGMENT = `precision highp float;
uniform vec2 uResolution;
uniform float uTime;
uniform float uScale;
uniform float uCover;
uniform float uSoft;
uniform vec3 uSkyTop;
uniform vec3 uSkyBottom;
uniform vec3 uCloud;
uniform vec3 uShade;

vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
vec2 fade(vec2 t) { return t * t * t * (t * (t * 6.0 - 15.0) + 10.0); }

float cnoise(vec2 P) {
  vec4 Pi = floor(P.xyxy) + vec4(0.0, 0.0, 1.0, 1.0);
  vec4 Pf = fract(P.xyxy) - vec4(0.0, 0.0, 1.0, 1.0);
  Pi = mod289(Pi);
  vec4 ix = Pi.xzxz;
  vec4 iy = Pi.yyww;
  vec4 fx = Pf.xzxz;
  vec4 fy = Pf.yyww;
  vec4 i = permute(permute(ix) + iy);
  vec4 gx = fract(i * (1.0 / 41.0)) * 2.0 - 1.0;
  vec4 gy = abs(gx) - 0.5;
  vec4 tx = floor(gx + 0.5);
  gx = gx - tx;
  vec2 g00 = vec2(gx.x, gy.x);
  vec2 g10 = vec2(gx.y, gy.y);
  vec2 g01 = vec2(gx.z, gy.z);
  vec2 g11 = vec2(gx.w, gy.w);
  vec4 norm = taylorInvSqrt(vec4(dot(g00, g00), dot(g01, g01), dot(g10, g10), dot(g11, g11)));
  g00 *= norm.x;
  g01 *= norm.y;
  g10 *= norm.z;
  g11 *= norm.w;
  float n00 = dot(g00, vec2(fx.x, fy.x));
  float n10 = dot(g10, vec2(fx.y, fy.y));
  float n01 = dot(g01, vec2(fx.z, fy.z));
  float n11 = dot(g11, vec2(fx.w, fy.w));
  vec2 fadeXY = fade(Pf.xy);
  vec2 nx = mix(vec2(n00, n01), vec2(n10, n11), fadeXY.x);
  return 2.3 * mix(nx.x, nx.y, fadeXY.y);
}

float fbm(vec2 p) {
  float value = 0.0;
  float amp = 0.5;
  for (int i = 0; i < 5; i++) {
    value += amp * cnoise(p);
    p = mat2(1.6, 1.2, -1.2, 1.6) * p;
    amp *= 0.5;
  }
  return value;
}

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;
  vec2 p = vec2(uv.x * uResolution.x / uResolution.y, uv.y) * uScale;
  vec2 drift = vec2(uTime * 0.6, uTime * 0.07);
  // Domain warp: one noise field bends the other, which is what makes the shapes billow.
  vec2 q = vec2(fbm(p + drift), fbm(p + drift + vec2(3.1, 1.7)));
  float density = 0.5 + 0.5 * fbm(p + 1.4 * q + drift * 0.5);
  float cloud = smoothstep(uCover, uCover + uSoft, density);
  float lit = smoothstep(uCover - 0.05, uCover + uSoft + 0.25, density);
  vec3 sky = mix(uSkyBottom, uSkyTop, uv.y);
  vec3 body = mix(uShade, uCloud, lit);
  gl_FragColor = vec4(mix(sky, body, cloud), 1.0);
}`;

const compile = (gl: WebGLRenderingContext, type: number, source: string) => {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return shader;
  gl.deleteShader(shader);
  return null;
};

const link = (gl: WebGLRenderingContext) => {
  const vertex = compile(gl, gl.VERTEX_SHADER, VERTEX);
  const fragment = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT);
  const program = gl.createProgram();
  if (!vertex || !fragment || !program) return null;
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.bindAttribLocation(program, 0, "aPosition");
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    gl.deleteProgram(program);
    return null;
  }
  return program;
};

/** Parses any CSS colour through a 2D canvas into 0..1 RGB. */
function makeColorParser() {
  const probe = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
  const cache = new Map<string, [number, number, number]>();
  return (value: string): [number, number, number] => {
    const cached = cache.get(value);
    if (cached) return cached;
    let rgb: [number, number, number] = [0, 0, 0];
    if (probe) {
      probe.clearRect(0, 0, 1, 1);
      probe.fillStyle = "#000000";
      probe.fillStyle = value;
      probe.fillRect(0, 0, 1, 1);
      const [r, g, b] = probe.getImageData(0, 0, 1, 1).data;
      rgb = [r / 255, g / 255, b / 255];
    }
    cache.set(value, rgb);
    return rgb;
  };
}

export default function Clouds({
  skyTop = "#8fc3ec",
  skyBottom = "#dcedfa",
  cloud = "#ffffff",
  shade = "#b7d1e8",
  speed = 0.03,
  scale = 2.2,
  cover = 0.45,
  softness = 0.3,
  resolution = 640,
  className = "",
  style,
}: CloudsProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const settings: Settings = { skyTop, skyBottom, cloud, shade, speed, scale, cover, softness, resolution };
  // The render loop reads the latest props through this ref; the effect below keeps it current after every render.
  const settingsRef = useRef(settings);
  const redrawRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;
    // A fresh canvas per effect run: the cleanup below loses the context for
    // good, so a remount (React's Strict Mode in development runs effects
    // twice) must not reuse the same element.
    const canvas = document.createElement("canvas");
    canvas.className = "absolute inset-0 block h-full w-full";
    canvas.setAttribute("aria-hidden", "true");
    container.appendChild(canvas);
    const gl = canvas.getContext("webgl", { alpha: false, antialias: false, depth: false, stencil: false });
    const program = gl && link(gl);
    if (!gl || !program) {
      canvas.remove();
      return undefined;
    }

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.useProgram(program);
    const u = (name: string) => gl.getUniformLocation(program, name);
    const uniforms = {
      resolution: u("uResolution"),
      time: u("uTime"),
      scale: u("uScale"),
      cover: u("uCover"),
      soft: u("uSoft"),
      skyTop: u("uSkyTop"),
      skyBottom: u("uSkyBottom"),
      cloud: u("uCloud"),
      shade: u("uShade"),
    };
    const parse = makeColorParser();
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

    let time = 0;
    let last = 0;
    let raf = 0;
    let visible = true;

    const render = () => {
      const s = settingsRef.current;
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(uniforms.resolution, canvas.width, canvas.height);
      gl.uniform1f(uniforms.time, time);
      gl.uniform1f(uniforms.scale, s.scale);
      gl.uniform1f(uniforms.cover, s.cover);
      gl.uniform1f(uniforms.soft, Math.max(0.01, s.softness));
      gl.uniform3fv(uniforms.skyTop, parse(s.skyTop));
      gl.uniform3fv(uniforms.skyBottom, parse(s.skyBottom));
      gl.uniform3fv(uniforms.cloud, parse(s.cloud));
      gl.uniform3fv(uniforms.shade, parse(s.shade));
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    const frame = (now: number) => {
      raf = 0;
      if (!visible || document.hidden || reduce) return;
      if (last && now - last < FRAME_MS) {
        raf = requestAnimationFrame(frame);
        return;
      }
      const dt = last ? Math.min((now - last) / 1000, 0.1) : 1 / 60;
      last = now;
      time += dt * settingsRef.current.speed;
      render();
      raf = requestAnimationFrame(frame);
    };

    const wake = () => {
      if (!raf && visible && !document.hidden && !reduce) raf = requestAnimationFrame(frame);
    };

    const resize = () => {
      const width = Math.max(1, container.clientWidth);
      const height = Math.max(1, container.clientHeight);
      const target = Math.min(width, settingsRef.current.resolution);
      canvas.width = Math.max(1, Math.round(target));
      canvas.height = Math.max(1, Math.round((target * height) / width));
      render();
      wake();
    };

    const onVisibility = () => {
      last = 0;
      wake();
    };

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);
    const intersection = new IntersectionObserver((entries) => {
      visible = entries.some((entry) => entry.isIntersecting);
      if (visible) {
        last = 0;
        wake();
      }
    });
    intersection.observe(container);
    document.addEventListener("visibilitychange", onVisibility);
    resize();

    redrawRef.current = () => {
      if (!raf) render();
      wake();
    };

    return () => {
      cancelAnimationFrame(raf);
      redrawRef.current = null;
      resizeObserver.disconnect();
      intersection.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      gl.deleteProgram(program);
      gl.deleteBuffer(buffer);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
      canvas.remove();
    };
  }, []);

  useEffect(() => {
    settingsRef.current = settings;
    redrawRef.current?.();
  });

  return (
    <div
      ref={containerRef}
      className={["relative h-full w-full overflow-hidden", className].filter(Boolean).join(" ")}
      style={style}
    />
  );
}
