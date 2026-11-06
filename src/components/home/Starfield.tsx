"use client";

import { useEffect, useRef } from "react";
import {
  ACESFilmicToneMapping,
  AdditiveBlending,
  BufferGeometry,
  Color,
  DirectionalLight,
  Float32BufferAttribute,
  FogExp2,
  HemisphereLight,
  PerspectiveCamera,
  Points,
  Scene,
  ShaderMaterial,
  SRGBColorSpace,
  WebGLRenderer,
} from "three";

const fieldVert = /* glsl */ `
  attribute float aSeed;
  attribute float aKind;
  attribute float aT;
  uniform float uTime, uSize, uPR, uOpacity, uFar, uSpeed;
  varying float vA;
  varying float vHot;
  void main() {
    float hot = 0.0;
    if (aKind > 0.5 && aKind < 1.5) hot = pow(fract(aT - uTime * uSpeed), 18.0);
    else if (aKind > 1.5 && aKind < 2.5) hot = step(0.93, fract(aSeed * 91.7 + uTime * (0.05 + aSeed * 0.12)));
    else if (aKind > 3.5) hot = 0.5 + 0.5 * sin(uTime * 1.3 + aSeed * 40.0);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    float d = -mv.z;
    gl_Position = projectionMatrix * mv;
    if (aKind > 2.5 && aKind < 3.5) {
      float tw = 0.65 + 0.35 * sin(uTime * (0.8 + aSeed * 2.0) + aSeed * 90.0);
      gl_PointSize = (0.9 + aSeed * aSeed * 2.6) * uPR;
      vA = uOpacity * tw * (0.25 + 0.75 * aSeed * aSeed);
      vHot = 0.0;
      return;
    }
    gl_PointSize = clamp(uSize * uPR * (0.5 + aSeed * 0.8) * (1.0 + hot * 1.2) / d, 0.8 * uPR, 7.0 * uPR);
    vA = uOpacity * (0.3 + 0.5 * aSeed) * exp(-d / uFar) * (1.0 + hot * 4.0) * smoothstep(0.5, 3.0, d);
    vHot = hot;
  }`;

const fieldFrag = /* glsl */ `
  uniform vec3 uTint;
  varying float vA;
  varying float vHot;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float r = dot(c, c);
    if (r > 0.25) discard;
    float a = smoothstep(0.25, 0.0, r) * vA;
    vec3 col = mix(vec3(0.93, 0.95, 1.0), uTint, clamp(vHot * 0.8, 0.0, 1.0));
    gl_FragColor = vec4(col * a, a);
  }`;

class Builder {
  p: number[] = [];
  s: number[] = [];
  k: number[] = [];
  t: number[] = [];
  add(x: number, y: number, z: number, kind = 0, t = 0, seed = Math.random()) {
    this.p.push(x, y, z);
    this.s.push(seed);
    this.k.push(kind);
    this.t.push(t);
  }
  build(o: { size?: number; far?: number; speed?: number; opacity?: number }) {
    const g = new BufferGeometry();
    g.setAttribute("position", new Float32BufferAttribute(this.p, 3));
    g.setAttribute("aSeed", new Float32BufferAttribute(this.s, 1));
    g.setAttribute("aKind", new Float32BufferAttribute(this.k, 1));
    g.setAttribute("aT", new Float32BufferAttribute(this.t, 1));
    const m = new ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uSize: { value: o.size ?? 14 },
        uPR: { value: Math.min(devicePixelRatio, 2) },
        uOpacity: { value: o.opacity ?? 1 },
        uFar: { value: o.far ?? 60 },
        uSpeed: { value: o.speed ?? 0.15 },
        uTint: { value: new Color("#9cf2cf").toArray() },
      },
      vertexShader: fieldVert,
      fragmentShader: fieldFrag,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    });
    const pts = new Points(g, m);
    pts.frustumCulled = false;
    return pts;
  }
}

function buildStars() {
  const b = new Builder();
  for (let i = 0; i < 2600; i++) {
    const theta = Math.acos(2 * Math.random() - 1);
    const phi = Math.random() * Math.PI * 2;
    const x = Math.sin(theta) * Math.cos(phi);
    let y = Math.sin(theta) * Math.sin(phi);
    const z = Math.cos(theta);
    y = Math.abs(y) * 0.9 + 0.02 - (Math.random() < 0.3 ? Math.random() * 0.5 : 0);
    const len = Math.sqrt(x * x + y * y + z * z) || 1;
    const R = 420;
    b.add((x / len) * R, (y / len) * R, (z / len) * R, 3);
  }
  const pts = b.build({});
  pts.renderOrder = -3;
  return pts;
}

function buildCity() {
  const b = new Builder();
  const y = -1;
  const step = 3.8;
  const roofs: [number, number, number][] = [];
  const clear = (x: number, z: number) =>
    Math.hypot(x, z) < 9 || Math.hypot(x, z + 34) < 8 || (Math.abs(x) < 4 && z < 4 && z > -30);

  for (let x = -84; x <= 84; x += step)
    for (let z = -120; z <= 56; z += step) {
      const jx = x + (Math.random() - 0.5) * 0.8;
      const jz = z + (Math.random() - 0.5) * 0.8;
      if (clear(jx, jz) || Math.random() < 0.18) continue;
      const dc = Math.hypot(jx, jz + 17);
      const h =
        (0.6 + Math.pow(Math.random(), 2.2) * 9) *
        (0.55 + 0.45 * Math.exp(-dc / 60)) *
        (1 + 0.6 * Math.sin(jx * 0.07) * Math.cos(jz * 0.05));
      const w = 0.35 + Math.random() * 0.5;
      const d = 0.35 + Math.random() * 0.5;
      const cs: [number, number][] = [[-w, -d], [w, -d], [w, d], [-w, d]];
      const dy = 0.3;
      for (const [cx, cz] of cs)
        for (let q = 0; q <= h; q += dy) b.add(jx + cx, y + q, jz + cz, 0, 0, 0.35 + Math.random() * 0.4);
      for (let f = 0; f <= h; f += 2.4)
        for (let e = 0; e < 4; e++) {
          const [ax, az] = cs[e];
          const [bx, bz] = cs[(e + 1) % 4];
          for (let q = 0.25; q < 1; q += 0.25) b.add(jx + ax + (bx - ax) * q, y + f, jz + az + (bz - az) * q, 0, 0, 0.25);
        }
      for (let e = 0; e < 4; e++) {
        const [ax, az] = cs[e];
        const [bx, bz] = cs[(e + 1) % 4];
        for (let q = 0; q < 1; q += 0.2) b.add(jx + ax + (bx - ax) * q, y + h, jz + az + (bz - az) * q, 0, 0, 0.6);
      }
      b.add(jx, y + h + 0.15, jz, 2);
      roofs.push([jx, y + h + 0.15, jz]);
    }

  for (let a = 0; a < 90; a++) {
    const A = roofs[(Math.random() * roofs.length) | 0];
    let B = roofs[(Math.random() * roofs.length) | 0];
    for (let tries = 0; tries < 20 && (dist3(A, B) < 8 || dist3(A, B) > 38); tries++)
      B = roofs[(Math.random() * roofs.length) | 0];
    const L = dist3(A, B);
    if (L < 8 || L > 38) continue;
    const n = Math.round(L * 2.2);
    const ph = Math.random();
    for (let q = 0; q <= n; q++) {
      const t = q / n;
      b.add(
        A[0] + (B[0] - A[0]) * t,
        A[1] + (B[1] - A[1]) * t + Math.sin(t * Math.PI) * (2 + L * 0.22),
        A[2] + (B[2] - A[2]) * t,
        1, t * L * 0.03 + ph, 0.35 + Math.random() * 0.3,
      );
    }
  }

  for (let z = -120; z <= 56; z += step * 2)
    for (let x = -84; x <= 84; x += 0.7) b.add(x, y + 0.02, z + step * 0.5, 1, x * 0.018 + z * 0.37);
  for (let x = -84; x <= 84; x += step * 2)
    for (let z = -120; z <= 56; z += 0.7) b.add(x + step * 0.5, y + 0.02, z, 1, -z * 0.018 + x * 0.53);

  return b.build({ size: 50, far: 90, speed: 0.12 });
}

function dist3(a: number[], b: number[]) {
  return Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2);
}

const FRAME_MS = 1000 / 30;

export function Starfield() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const canvas = document.createElement("canvas");
    canvas.className = "absolute inset-0 block h-full w-full";
    canvas.setAttribute("aria-hidden", "true");
    container.appendChild(canvas);

    const renderer = new WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: "default", stencil: false, depth: true });
    renderer.setClearColor(new Color("#050505"));
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    renderer.outputColorSpace = SRGBColorSpace;
    renderer.toneMapping = ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1;

    const scene = new Scene();
    scene.background = new Color("#050505");
    scene.fog = new FogExp2(0x050505, 0.008);

    const camera = new PerspectiveCamera(36, 1, 0.05, 600);
    camera.position.set(8, 4, 14);
    camera.lookAt(0, 1, 0);

    scene.add(new HemisphereLight("#c9ccd8", "#030304", 0.3));
    const key = new DirectionalLight("#f3f4fa", 0.6);
    key.position.set(-14, 26, 18);
    scene.add(key);
    const rim = new DirectionalLight("#dfe3ee", 0.3);
    rim.position.set(16, 10, -20);
    scene.add(rim);

    const stars = buildStars();
    scene.add(stars);

    const city = buildCity();
    scene.add(city);

    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    let time = 0;
    let last = 0;
    let raf = 0;
    let visible = true;

    const render = () => {
      renderer.render(scene, camera);
    };

    const tick = (now: number) => {
      raf = 0;
      if (!visible || document.hidden || reduce) return;
      if (last && now - last < FRAME_MS) {
        raf = requestAnimationFrame(tick);
        return;
      }
      const dt = last ? Math.min((now - last) / 1000, 0.1) : 1 / 60;
      last = now;
      time += dt;

      const angle = time * 0.015 - 0.3;
      const radius = 14;
      camera.position.set(
        Math.sin(angle) * radius,
        4 + Math.sin(time * 0.04) * 0.5,
        Math.cos(angle) * radius,
      );
      camera.lookAt(0, 1, 0);

      stars.position.copy(camera.position);
      (stars.material as ShaderMaterial).uniforms.uTime.value = time;
      (city.material as ShaderMaterial).uniforms.uTime.value = time;

      render();
      raf = requestAnimationFrame(tick);
    };

    const wake = () => {
      if (!raf && visible && !document.hidden && !reduce) raf = requestAnimationFrame(tick);
    };

    const resize = () => {
      const w = Math.max(1, container.clientWidth);
      const h = Math.max(1, container.clientHeight);
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
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
      visible = entries.some((e) => e.isIntersecting);
      if (visible) { last = 0; wake(); }
    });
    intersection.observe(container);
    document.addEventListener("visibilitychange", onVisibility);
    resize();
    if (reduce) render();

    return () => {
      cancelAnimationFrame(raf);
      resizeObserver.disconnect();
      intersection.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      renderer.dispose();
      scene.clear();
      canvas.remove();
    };
  }, []);

  return <div ref={containerRef} className="relative h-full w-full overflow-hidden" />;
}
