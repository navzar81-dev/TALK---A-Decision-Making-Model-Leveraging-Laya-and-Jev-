import React, { useEffect, useRef } from 'react';
import type { OrbState } from '../types';

// The Voice Orb WebGL implementation from Ship Notes (zero dependencies)
const STATES = ['idle', 'listening', 'thinking', 'speaking'] as const;
type VoiceOrbState = typeof STATES[number];

const PALETTE: [number, number, number][] = [
  [0.62, 0.60, 0.87], // idle: lilac
  [0.16, 0.91, 0.71], // listening: turquoise
  [1.00, 0.57, 0.18], // thinking: amber
  [0.96, 0.27, 0.62], // speaking: pink/violet
];

const clamp = (v: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, Number.isFinite(+v) ? +v : lo));
const weightsFor = (state: VoiceOrbState): [number, number, number, number] => [
  +(state === 'idle'),
  +(state === 'listening'),
  +(state === 'thinking'),
  +(state === 'speaking'),
];

const seeded = (i: number) => {
  const s = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};

const sphere = (count: number) => {
  const data = new Float32Array(count * 4);
  const jitter = 0.55 / Math.sqrt(count);
  for (let i = 0; i < count; i++) {
    const y = clamp(1 - 2 * (i + 0.5) / count + (seeded(i + 7) - 0.5) * jitter, -0.99999, 0.99999);
    const a = i * 2.399963229728653 + (seeded(i + 19) - 0.5) * jitter * 5;
    const r = Math.sqrt(1 - y * y);
    data.set([r * Math.cos(a), y, r * Math.sin(a), seeded(i + 31)], i * 4);
  }
  return data;
};

const VS = `
precision highp float;
attribute vec4 seed;
uniform float time, pixels, density, onset, reduced;
uniform vec4 weights;
uniform vec3 bands;
varying vec3 tint;
varying float strength, spark;

float hash(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float noise(vec3 p) {
  vec3 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = mix(hash(i), hash(i + vec3(1, 0, 0)), f.x);
  float b = mix(hash(i + vec3(0, 1, 0)), hash(i + vec3(1, 1, 0)), f.x);
  float c = mix(hash(i + vec3(0, 0, 1)), hash(i + vec3(1, 0, 1)), f.x);
  float d = mix(hash(i + vec3(0, 1, 1)), hash(i + vec3(1, 1, 1)), f.x);
  return mix(mix(a, b, f.y), mix(c, d, f.y), f.z) * 2.0 - 1.0;
}

vec3 turn(vec3 p, float a) {
  float c = cos(a), s = sin(a);
  return vec3(c * p.x + s * p.z, p.y, c * p.z - s * p.x);
}

void main() {
  float t = time;
  vec3 n = seed.xyz;
  float angle = acos(clamp(n.z, -1.0, 1.0));
  float drift = noise(n * 2.7 + vec3(t * 0.19, -t * 0.11, t * 0.08));
  float bass = noise(n * 1.8 + vec3(t * 0.32, 0.0, -t * 0.2));
  float grain = noise(n * 17.0 + vec3(-t * 1.8, t * 0.7, t));
  float low = bands.x, mid = bands.y, high = bands.z;

  float idleR = 1.0 + 0.018 * drift + 0.008 * sin(t * 0.85);
  float inward = sin(angle * 13.0 + t * 5.4 + drift * 1.6);
  float outward = sin(angle * 12.0 - t * 6.2 + drift * 1.6);
  float listenR = 1.0 - 0.045 * low + 0.10 * low * bass + (0.018 + 0.12 * mid) * inward + 0.032 * high * grain;
  float speakR = 1.0 + 0.065 * low + 0.16 * low * bass + (0.018 + 0.16 * mid) * outward + 0.055 * high * grain;
  speakR += onset * (0.08 + 0.18 * max(0.0, outward)) * (0.4 + 0.6 * seed.w);

  float twist = t * 0.55 + n.y * 1.45 + drift * 0.12;
  vec3 thought = turn(n, twist) * (1.0 + 0.035 * drift);
  thought.y *= 0.92;

  vec3 pos = turn(n, t * 0.11) * idleR * weights.x;
  pos += turn(n, t * 0.16) * listenR * weights.y;
  pos += thought * weights.z;
  pos += turn(n, t * 0.20) * speakR * weights.w;

  float active = weights.y + weights.w;
  float rim = pow(max(0.0, 1.0 - abs(n.z)), 2.2);
  float pop = pow(max(0.0, sin(t * 8.0 + seed.w * 149.0)), 18.0) * step(0.90, seed.w);
  pos *= 1.0 + active * high * pop * 0.17;

  // Three narrow belts in thinking state
  vec3 q = turn(n, t * 0.33);
  float b1 = exp(-pow((dot(q, normalize(vec3(0.24, 0.83, 0.50))) - 0.13) * 23.0, 2.0));
  float b2 = exp(-pow((dot(q, normalize(vec3(-0.71, 0.48, 0.39))) + 0.16) * 23.0, 2.0));
  float b3 = exp(-pow((dot(q, normalize(vec3(0.69, 0.58, -0.41))) - 0.06) * 23.0, 2.0));
  float belts = min(1.5, b1 + b2 + b3) * (0.6 + 0.4 * sin(atan(n.y, n.x) * 2.0 - t * 2.3));

  float flow = pow(0.5 + 0.5 * sin(angle * 13.0 + (weights.y - weights.w) * t * 5.8 + drift * 2.0), 7.0);
  float depth = clamp((pos.z + 1.35) / 2.7, 0.0, 1.0);
  float perspective = 3.8 / (3.8 - pos.z * 0.60);

  gl_Position = vec4(pos.xy * perspective * 0.61, 0.0, 1.0);
  float point = (2.0 + 1.8 * depth + 0.85 * rim) * density;
  point += active * high * pop * 1.8;
  gl_PointSize = max(1.8, point * pixels / 720.0);

  float cool = 0.5 + 0.5 * sin(n.y * 2.1 + n.x * 1.6 + drift * 0.65);
  vec3 ci = mix(vec3(0.42, 0.49, 0.77), vec3(0.80, 0.69, 0.98), cool);
  vec3 cl = mix(vec3(0.07, 0.54, 0.68), vec3(0.43, 1.0, 0.67), cool);
  vec3 ct = mix(vec3(0.71, 0.25, 0.06), vec3(1.0, 0.79, 0.38), cool);
  vec3 cs = mix(vec3(0.36, 0.22, 1.0), vec3(1.0, 0.45, 0.63), cool);

  tint = ci * weights.x + cl * weights.y + ct * weights.z + cs * weights.w;
  strength = (0.22 + 0.45 * depth + 0.70 * rim) * (0.65 + 0.35 * seed.w);
  strength += active * (mid * flow * 0.95 + onset * rim * 0.9) + weights.z * belts * 2.0;
  strength *= mix(1.0, 0.78, weights.z);
  spark = active * (high * pop * 0.8 + onset * rim * 0.22) + weights.z * belts * 0.13;
}
`;

const FS = `
precision mediump float;
varying vec3 tint;
varying float strength, spark;

void main() {
  float r = length(gl_PointCoord - 0.5) * 2.0;
  if (r > 1.0) discard;
  float core = 1.0 - smoothstep(0.18, 0.64, r);
  float halo = exp(-r * r * 4.0) * 0.24 * (1.0 - smoothstep(0.75, 1.0, r));
  float a = (core + halo) * strength;
  vec3 color = tint * a + vec3(1.0, 0.92, 0.86) * spark * core;
  gl_FragColor = vec4(color, min(1.0, a + spark * core));
}
`;

export interface VoiceOrbProps {
  state: OrbState;
  audioBands?: { low: number; mid: number; high: number; all: number };
  onOrbClick?: () => void;
  particles?: number;
  className?: string;
  style?: React.CSSProperties;
}

export const VoiceOrb: React.FC<VoiceOrbProps> = ({
  state,
  audioBands,
  onOrbClick,
  particles = 12000,
  className = '',
  style = {},
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const haloCanvasRef = useRef<HTMLCanvasElement>(null);
  const webglCanvasRef = useRef<HTMLCanvasElement>(null);

  // Animation state refs
  const weightsRef = useRef<[number, number, number, number]>([1, 0, 0, 0]);
  const bandsRef = useRef<[number, number, number]>([0, 0, 0]);
  const onsetRef = useRef<number>(0);
  const bassHistoryRef = useRef<number>(0);
  const timeRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const frameRef = useRef<number>(0);

  // WebGL context & uniform refs
  const glRef = useRef<WebGLRenderingContext | null>(null);
  const programRef = useRef<WebGLProgram | null>(null);
  const bufferRef = useRef<WebGLBuffer | null>(null);
  const uniformsRef = useRef<Record<string, WebGLUniformLocation | null>>({});
  const countRef = useRef<number>(0);
  const seedsRef = useRef<Float32Array | null>(null);

  // Map OrbState to VoiceOrbState
  const mapState = (s: OrbState): VoiceOrbState => {
    if (s === 'listening') return 'listening';
    if (s === 'thinking' || s === 'unsure') return 'thinking';
    if (s === 'speaking' || s === 'error') return 'speaking';
    return 'idle';
  };

  const currentState = mapState(state);

  // Update target audio bands smoothly
  useEffect(() => {
    if (audioBands) {
      const low = clamp(audioBands.low * 1.25);
      const mid = clamp(audioBands.mid * 1.35);
      const high = clamp(audioBands.high * 1.45);
      // Fast bass onset transient calculation for kick hits
      const flux = Math.max(0, low - bassHistoryRef.current - 0.04) * 6;
      bassHistoryRef.current += (low - bassHistoryRef.current) * 0.4;
      onsetRef.current = Math.max(clamp(flux), onsetRef.current * 0.85);

      // Smooth attack/release filter
      bandsRef.current[0] += (low - bandsRef.current[0]) * 0.6;
      bandsRef.current[1] += (mid - bandsRef.current[1]) * 0.55;
      bandsRef.current[2] += (high - bandsRef.current[2]) * 0.5;
    } else {
      bandsRef.current = [0, 0, 0];
      onsetRef.current = 0;
    }
  }, [audioBands]);

  // Setup WebGL and render loop
  useEffect(() => {
    const canvas = webglCanvasRef.current;
    const halo = haloCanvasRef.current;
    if (!canvas || !halo) return;

    const gl = canvas.getContext('webgl', {
      alpha: true,
      premultipliedAlpha: true,
      antialias: false,
      preserveDrawingBuffer: false,
      powerPreference: 'high-performance',
    });

    if (!gl) {
      console.warn('WebGL not available for VoiceOrb');
      return;
    }

    try {
      const vShader = gl.createShader(gl.VERTEX_SHADER)!;
      gl.shaderSource(vShader, VS);
      gl.compileShader(vShader);
      if (!gl.getShaderParameter(vShader, gl.COMPILE_STATUS)) {
        throw new Error(gl.getShaderInfoLog(vShader) || 'Vertex shader failed');
      }

      const fShader = gl.createShader(gl.FRAGMENT_SHADER)!;
      gl.shaderSource(fShader, FS);
      gl.compileShader(fShader);
      if (!gl.getShaderParameter(fShader, gl.COMPILE_STATUS)) {
        throw new Error(gl.getShaderInfoLog(fShader) || 'Fragment shader failed');
      }

      const prog = gl.createProgram()!;
      gl.attachShader(prog, vShader);
      gl.attachShader(prog, fShader);
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
        throw new Error(gl.getProgramInfoLog(prog) || 'Program link failed');
      }

      gl.deleteShader(vShader);
      gl.deleteShader(fShader);

      gl.useProgram(prog);
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      const attr = gl.getAttribLocation(prog, 'seed');
      gl.enableVertexAttribArray(attr);
      gl.vertexAttribPointer(attr, 4, gl.FLOAT, false, 0, 0);

      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE);
      gl.disable(gl.DEPTH_TEST);

      glRef.current = gl;
      programRef.current = prog;
      bufferRef.current = buf;

      const uniformNames = ['time', 'pixels', 'density', 'weights', 'bands', 'onset'];
      const uniforms: Record<string, WebGLUniformLocation | null> = {};
      for (const name of uniformNames) {
        uniforms[name] = gl.getUniformLocation(prog, name);
      }
      uniformsRef.current = uniforms;

      // Generate particles
      const count = particles;
      countRef.current = count;
      const seeds = sphere(count);
      seedsRef.current = seeds;
      gl.bufferData(gl.ARRAY_BUFFER, seeds, gl.STATIC_DRAW);
    } catch (e) {
      console.error('VoiceOrb WebGL initialization error:', e);
      return;
    }

    const hctx = halo.getContext('2d');

    // Resize handling
    const handleResize = () => {
      if (!containerRef.current || !canvas || !halo) return;
      const rect = containerRef.current.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const size = Math.max(1, Math.round(rect.width * dpr));

      if (canvas.width !== size || canvas.height !== size) {
        canvas.width = canvas.height = halo.width = halo.height = size;
      }
    };

    handleResize();
    const ro = new ResizeObserver(handleResize);
    if (containerRef.current) ro.observe(containerRef.current);

    // Animation Tick
    const tick = (now: number) => {
      const elapsed = lastTimeRef.current ? (now - lastTimeRef.current) / 1000 : 1 / 60;
      const dt = Math.min(0.08, elapsed);
      lastTimeRef.current = now;
      timeRef.current += dt;

      // Smooth state weights interpolation over ~240ms (tau = 0.24s)
      const k = 1 - Math.exp(-dt / 0.24);
      const targetWeights = weightsFor(currentState);
      for (let i = 0; i < 4; i++) {
        weightsRef.current[i] += (targetWeights[i] - weightsRef.current[i]) * k;
      }

      // Render frame
      const currentGl = glRef.current;
      const size = canvas.width;
      const w = weightsRef.current;
      const b = bandsRef.current;
      const o = onsetRef.current;

      // 1. Paint 2D Halo on background canvas
      if (hctx && size > 0) {
        const rgb = [0, 1, 2].map((c) =>
          Math.round(PALETTE.reduce((sum, p, i) => sum + p[c] * w[i], 0) * 255)
        );
        hctx.clearRect(0, 0, size, size);
        const glow = hctx.createRadialGradient(size * 0.5, size * 0.5, size * 0.1, size * 0.5, size * 0.5, size * 0.48);
        const energy = (w[1] + w[3]) * (b[0] * 0.025 + o * 0.035);
        glow.addColorStop(0, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},0.015)`);
        glow.addColorStop(0.58, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${0.03 + energy})`);
        glow.addColorStop(1, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},0)`);
        hctx.fillStyle = glow;
        hctx.fillRect(0, 0, size, size);
      }

      // 2. Paint WebGL particle surface
      if (currentGl && programRef.current && size > 0) {
        const u = uniformsRef.current;
        currentGl.viewport(0, 0, size, size);
        currentGl.clearColor(0, 0, 0, 0);
        currentGl.clear(currentGl.COLOR_BUFFER_BIT);

        currentGl.useProgram(programRef.current);
        if (u.time) currentGl.uniform1f(u.time, timeRef.current);
        if (u.pixels) currentGl.uniform1f(u.pixels, size);
        if (u.density) currentGl.uniform1f(u.density, Math.pow(12000 / countRef.current, 0.32));
        if (u.weights) currentGl.uniform4fv(u.weights, w);
        if (u.bands) currentGl.uniform3fv(u.bands, b);
        if (u.onset) currentGl.uniform1f(u.onset, o);

        currentGl.drawArrays(currentGl.POINTS, 0, countRef.current);
      }

      frameRef.current = requestAnimationFrame(tick);
    };

    frameRef.current = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frameRef.current);
      ro.disconnect();
    };
  }, [currentState, particles]);

  return (
    <div
      ref={containerRef}
      className={`voice-orb-wrapper ${className}`}
      onClick={onOrbClick}
      role="img"
      aria-label={`Voice orb: ${state}`}
      style={{
        position: 'relative',
        width: '100%',
        maxWidth: '420px',
        aspectRatio: '1',
        cursor: 'pointer',
        contain: 'layout paint',
        ...style,
      }}
    >
      <canvas
        ref={haloCanvasRef}
        aria-hidden="true"
        style={{
          display: 'block',
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
        }}
      />
      <canvas
        ref={webglCanvasRef}
        aria-hidden="true"
        style={{
          display: 'block',
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
        }}
      />
    </div>
  );
};
