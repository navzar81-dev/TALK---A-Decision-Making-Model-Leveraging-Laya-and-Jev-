import React, { useEffect, useRef, useState } from 'react';
import type { OrbState } from '../types';
import { Orb } from './Orb';

interface LiquidOrbProps {
  state: OrbState;
  audioBands: { low: number; mid: number; high: number; all: number };
  onOrbClick?: () => void;
}

export const LiquidOrb: React.FC<LiquidOrbProps> = ({ state, audioBands, onOrbClick }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [webGpuError, setWebGpuError] = useState<string | null>(null);

  const stateRef = useRef(state);
  const audioBandsRef = useRef(audioBands);

  useEffect(() => {
    stateRef.current = state;
    if ((window as any).liquidOrb?.setState) {
      try {
        const mappedState = (state === 'speaking' || state === 'listening') ? 'thinking' : (state === 'idle' ? 'idle' : 'thinking');
        (window as any).liquidOrb.setState(mappedState);
      } catch (e) {
        console.warn('Error setting liquid orb state:', e);
      }
    }
  }, [state]);

  useEffect(() => {
    audioBandsRef.current = audioBands;
    if ((window as any).liquidOrb?.setAudioBands) {
      (window as any).liquidOrb.setAudioBands(audioBands);
    }
  }, [audioBands]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let stopped = false;
    let animationFrame = 0;
    let device: any = null;
    let ribbonTarget: any = null;
    const cvs = canvas;
    if (!cvs) return;

    // Full WGSL Shader provided by user
    const shaderSource = `
struct Uniforms {
  size:           vec2<f32>,
  time:           f32,
  speed:          f32,
  radius:         f32,
  zoom:           f32,
  warp:           f32,
  ridgeAmt:       f32,
  sharp:          f32,
  shade:          f32,
  sheen:          f32,
  gloss:          f32,
  shellMidAlpha:  f32,
  shellEdgeAlpha: f32,
  exposure:       f32,
  style:          f32,
  edgeSoftness:   f32,
  edgeGlow:       f32,
  paletteCount:   f32,
  glassEnabled:   f32,
  glassOpacity:   f32,
  contourDeform:  f32,
  bandDensity:    f32,
  chromaticShift: f32,
  metalScale:     f32,
  metalStretch:   f32,
  metalAngle:     f32,
  metalOffset:    f32,
  metalPhase:     f32,
  metalEvolution: f32,
  metalRoughness: f32,
  metalDepth:     f32,
  particleDensity: f32,
  ribbonCount:     f32,
  ribbonWidth:     f32,
  ribbonTwist:     f32,
  ribbonFold:      f32,
  ribbonBreath:    f32,
  particleSize:    f32,
  particleBloom:   f32,
  colorA:         vec4<f32>,
  colorB:         vec4<f32>,
  colorC:         vec4<f32>,
  colorD:         vec4<f32>,
  highlightColor: vec4<f32>,
  shellInner:     vec4<f32>,
  shellMid:       vec4<f32>,
  shellEdge:      vec4<f32>,
  sheenColor:     vec4<f32>,
  specColor:      vec4<f32>,
  canvasColor:    vec4<f32>,
  glowColor:      vec4<f32>,
  paletteStop0:    vec4<f32>,
  paletteStop1:    vec4<f32>,
  paletteStop2:    vec4<f32>,
  paletteStop3:    vec4<f32>,
  paletteStop4:    vec4<f32>,
  paletteStop5:    vec4<f32>,
  paletteStop6:    vec4<f32>,
  paletteStop7:    vec4<f32>,
  paletteStop8:    vec4<f32>,
  paletteStop9:    vec4<f32>,
  paletteStop10:   vec4<f32>,
  paletteStop11:   vec4<f32>,
};
@group(0) @binding(0) var<uniform> u: Uniforms;

fn mfEdgeD(soft: f32) -> f32 {
  return soft - 0.005;
}

fn mfEdgeGlow(col: vec3<f32>, uv: vec2<f32>, ctr: vec2<f32>, rad: f32,
              soft: f32, glow: f32, glowRGB: vec3<f32>) -> vec3<f32> {
  if (glow <= 0.0) { return col; }
  let r = length(uv - ctr);
  let outside = smoothstep(rad - max(soft, 0.0005), rad + max(soft, 0.0005), r);
  return col + glowRGB * (glow * exp(-max(r - rad, 0.0) * 11.0) * outside);
}

fn mfRampPick(idx: f32,
              s0: vec3<f32>, s1: vec3<f32>, s2:  vec3<f32>, s3:  vec3<f32>,
              s4: vec3<f32>, s5: vec3<f32>, s6:  vec3<f32>, s7:  vec3<f32>,
              s8: vec3<f32>, s9: vec3<f32>, s10: vec3<f32>, s11: vec3<f32>) -> vec3<f32> {
  var r = s0;
  r = select(r, s1,  idx == 1.0);
  r = select(r, s2,  idx == 2.0);
  r = select(r, s3,  idx == 3.0);
  r = select(r, s4,  idx == 4.0);
  r = select(r, s5,  idx == 5.0);
  r = select(r, s6,  idx == 6.0);
  r = select(r, s7,  idx == 7.0);
  r = select(r, s8,  idx == 8.0);
  r = select(r, s9,  idx == 9.0);
  r = select(r, s10, idx == 10.0);
  r = select(r, s11, idx == 11.0);
  return r;
}

fn mfRampCyc(tIn: f32, n: f32,
             s0: vec3<f32>, s1: vec3<f32>, s2:  vec3<f32>, s3:  vec3<f32>,
             s4: vec3<f32>, s5: vec3<f32>, s6:  vec3<f32>, s7:  vec3<f32>,
             s8: vec3<f32>, s9: vec3<f32>, s10: vec3<f32>, s11: vec3<f32>) -> vec3<f32> {
  let k  = clamp(floor(n + 0.5), 1.0, 12.0);
  let x  = fract(tIn) * k;
  let i0 = min(floor(x), k - 1.0);
  let i1 = select(i0 + 1.0, 0.0, i0 + 1.0 >= k);
  return mix(mfRampPick(i0, s0, s1, s2, s3, s4, s5, s6, s7, s8, s9, s10, s11),
             mfRampPick(i1, s0, s1, s2, s3, s4, s5, s6, s7, s8, s9, s10, s11),
             x - i0);
}

fn mfRampLin(tIn: f32, n: f32,
             s0: vec3<f32>, s1: vec3<f32>, s2:  vec3<f32>, s3:  vec3<f32>,
             s4: vec3<f32>, s5: vec3<f32>, s6:  vec3<f32>, s7:  vec3<f32>,
             s8: vec3<f32>, s9: vec3<f32>, s10: vec3<f32>, s11: vec3<f32>) -> vec3<f32> {
  let k  = clamp(floor(n + 0.5), 1.0, 12.0);
  let x  = clamp(tIn, 0.0, 1.0) * (k - 1.0);
  let i0 = clamp(floor(x), 0.0, max(k - 2.0, 0.0));
  return mix(mfRampPick(i0,     s0, s1, s2, s3, s4, s5, s6, s7, s8, s9, s10, s11),
             mfRampPick(i0 + 1.0, s0, s1, s2, s3, s4, s5, s6, s7, s8, s9, s10, s11),
             x - i0);
}

const GL_FU:   f32 = 0.88172043;
const GL_BSIG_CLEAR: f32 = 0.01800000;
const GL_BSIG_GLASS: f32 = 0.03990000;
const GL_KA:  f32 = 6.0;
const GL_KG:  f32 = 4.1209;
const GL_KWA: f32 = 0.5;
const GL_KR:  f32 = 0.32;
const GL_GH:  f32 = 1.73205081;
const GL_CLEAR_EA: f32 = 0.995;
const GL_CLEAR_EB: f32 = 1.04;

fn lqHash(pIn: vec2<f32>) -> f32 {
  var p = fract(pIn * vec2<f32>(123.34, 456.21));
  p = p + vec2<f32>(dot(p, p + vec2<f32>(45.32)));
  return fract(p.x * p.y);
}

fn lqNoise(p: vec2<f32>) -> f32 {
  let i = floor(p);
  var f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(lqHash(i), lqHash(i + vec2<f32>(1.0, 0.0)), f.x),
             mix(lqHash(i + vec2<f32>(0.0, 1.0)), lqHash(i + vec2<f32>(1.0, 1.0)), f.x), f.y);
}

fn lqFbm(pIn: vec2<f32>, bs: f32) -> vec2<f32> {
  var p = pIn;
  var s:  f32 = 0.0;
  var a:  f32 = 0.5;
  var m:  f32 = 0.0;
  var vr: f32 = 0.0;
  let e = -GL_KA * bs * bs;
  var g: f32 = 1.0;
  for (var i: i32 = 0; i < 5; i = i + 1) {
    let b = exp(e * g);
    s  = s  + a * (0.5 + b * (lqNoise(p) - 0.5));
    vr = vr + a * a * (1.0 - b * b);
    m  = m + a;
    a  = a * 0.5;
    g  = g * GL_KG;
    p = vec2<f32>(0.8 * p.x - 0.6 * p.y, 0.6 * p.x + 0.8 * p.y) * 2.03;
  }
  return vec2<f32>(s / m, GL_KR * sqrt(vr) / m);
}

fn lqRidge(v: f32, k: f32) -> f32 {
  return pow(clamp(1.0 - abs(v * 2.0 - 1.0), 0.0, 1.0), k);
}

fn lqRamp(v: f32, cA: vec3<f32>, cB: vec3<f32>, cC: vec3<f32>, cD: vec3<f32>) -> vec3<f32> {
  var c = mix(cA, cB, smoothstep(0.0, 0.45, v));
  c = mix(c, cC, smoothstep(0.38, 0.72, v));
  c = mix(c, cD, smoothstep(0.68, 1.0, v));
  return select(c, mfRampLin(v, u.paletteCount,
                             u.paletteStop0.rgb, u.paletteStop1.rgb, u.paletteStop2.rgb,
                             u.paletteStop3.rgb, u.paletteStop4.rgb, u.paletteStop5.rgb,
                             u.paletteStop6.rgb, u.paletteStop7.rgb, u.paletteStop8.rgb,
                             u.paletteStop9.rgb, u.paletteStop10.rgb, u.paletteStop11.rgb), u.paletteCount > 0.5);
}

fn lqRidgeS(vs: vec2<f32>, k: f32) -> f32 {
  let d = GL_GH * vs.y;
  return (lqRidge(vs.x - d, k) + 4.0 * lqRidge(vs.x, k) + lqRidge(vs.x + d, k)) / 6.0;
}

fn lqStepS(vs: vec2<f32>, a: f32, b: f32) -> f32 {
  let d = GL_GH * vs.y;
  return (smoothstep(a, b, vs.x - d) + 4.0 * smoothstep(a, b, vs.x)
        + smoothstep(a, b, vs.x + d)) / 6.0;
}

fn lqPowS(vs: vec2<f32>, k: f32) -> f32 {
  let d = GL_GH * vs.y;
  return (pow(clamp(vs.x - d, 0.0, 1.0), k) + 4.0 * pow(clamp(vs.x, 0.0, 1.0), k)
        + pow(clamp(vs.x + d, 0.0, 1.0), k)) / 6.0;
}

fn glsFinishPresetFluid(colorIn: vec3<f32>, p: vec2<f32>) -> vec3<f32> {
  var color = colorIn;
  color = mix(color, u.highlightColor.rgb,
              u.shade * 0.22 * smoothstep(0.15, 1.15, dot(p, vec2<f32>(-0.32, 0.78))));
  color = color * (1.0 - u.shade * 0.34
                  * smoothstep(-0.1, 1.2, dot(p, vec2<f32>(0.45, -0.62))));
  color = color * (1.0 - u.shade * 0.22 * smoothstep(0.72, 1.08, length(p)));
  return clamp(color, vec3<f32>(0.0), vec3<f32>(1.0));
}

fn glsFinishEmissionFluid(colorIn: vec3<f32>, p: vec2<f32>) -> vec3<f32> {
  var color = colorIn;
  if (u.glassEnabled > 0.5) {
    color = mix(color, u.highlightColor.rgb,
                u.shade * 0.22 * smoothstep(0.15, 1.15, dot(p, vec2<f32>(-0.32, 0.78))));
  }
  color = color * (1.0 - u.shade * 0.34
                  * smoothstep(-0.1, 1.2, dot(p, vec2<f32>(0.45, -0.62))));
  color = color * (1.0 - u.shade * 0.22 * smoothstep(0.72, 1.08, length(p)));
  return clamp(color, vec3<f32>(0.0), vec3<f32>(1.0));
}

fn glsRotate(p: vec2<f32>, angle: f32) -> vec2<f32> {
  let c = cos(angle);
  let s = sin(angle);
  return vec2<f32>(c * p.x - s * p.y, s * p.x + c * p.y);
}

fn glsRefractiveBlobFluid(p: vec2<f32>, t: f32) -> vec3<f32> {
  let radial2 = clamp(dot(p, p), 0.0, 1.0);
  let depth = sqrt(max(1.0 - radial2, 0.0));
  let scale = 0.82 + u.zoom * 1.08;
  let blur = 0.012 + 0.005 * u.zoom;
  var q = glsRotate(p * scale, 0.08 * sin(t * 0.17));
  let driftA = lqFbm(q * 1.16 + vec2<f32>(t * 0.052, -t * 0.078), blur * 1.16);
  let driftB = lqFbm(glsRotate(q, 1.21) * 1.34
                     + vec2<f32>(-t * 0.064, t * 0.041), blur * 1.34);
  q = q + vec2<f32>(driftA.x - 0.5, driftB.x - 0.5)
          * (0.34 + u.warp * 0.105);

  let body = lqFbm(q * 1.42 + vec2<f32>(driftB.x * 0.82, driftA.x * 0.66),
                   blur * 1.42);
  let ribbonPhase = q.y * (2.2 + u.warp * 0.11)
                  + sin(q.x * 1.72 - t * 0.19) * 0.92
                  + sin((q.x + q.y) * 1.08 + t * 0.13) * 0.46;
  let ribbon = pow(clamp(1.0 - abs(sin(ribbonPhase)), 0.0, 1.0),
                   0.82 + u.sharp * 0.23);
  let fold = lqRidgeS(lqFbm(q * 2.05 + vec2<f32>(2.8, -t * 0.037),
                            blur * 2.05), 0.9 + u.sharp * 0.32);
  let value = clamp(body.x * 0.5 + driftA.x * 0.16
                    + ribbon * (0.2 + u.ridgeAmt * 0.2)
                    + fold * u.ridgeAmt * 0.18, 0.0, 1.0);

  var color = lqRamp(value, u.colorA.rgb, u.colorB.rgb, u.colorC.rgb, u.colorD.rgb);
  let caustic = pow(ribbon, 3.1) * (0.24 + 0.28 * u.ridgeAmt)
               + pow(fold, 4.2) * 0.08;
  color = mix(color, u.colorD.rgb, clamp(caustic, 0.0, 0.52));
  color = color * (0.7 + depth * 0.3);
  let key = pow(max(dot(normalize(vec3<f32>(p, depth)),
                        normalize(vec3<f32>(-0.42, 0.58, 0.9))), 0.0), 4.0);
  color = mix(color, u.highlightColor.rgb, key * 0.055);
  return glsFinishPresetFluid(color, p);
}

fn glsPresetFluid(p: vec2<f32>, style: i32, t: f32) -> vec3<f32> {
  return glsRefractiveBlobFluid(p, t);
}

fn glsOver(dst: vec3<f32>, src: vec3<f32>, a: f32) -> vec3<f32> {
  let k = clamp(a, 0.0, 1.0);
  return src * k + dst * (1.0 - k);
}

fn glsRefractionProfile(t: f32) -> f32 {
  let depth = clamp(t, 0.0, 1.0);
  let circular = sqrt(max(1.0 - (1.0 - depth) * (1.0 - depth), 0.0));
  return 1.0 - circular;
}

fn glsHighlightLobe(normal: vec2<f32>, direction: vec2<f32>, cut: f32,
                     power: f32) -> f32 {
  let angular = clamp((dot(normal, direction) - cut) / max(1.0 - cut, 0.001),
                      0.0, 1.0);
  return pow(angular, power);
}

fn glsContourWave(angle: f32, t: f32) -> vec2<f32> {
  let wave = sin(angle * 3.0 + t * 0.62) * 0.52
             + sin(angle * 5.0 - t * 0.41 + 1.7) * 0.31
             + sin(angle * 2.0 + t * 0.23 + 3.1) * 0.17;
  let slope = cos(angle * 3.0 + t * 0.62) * 1.56
              + cos(angle * 5.0 - t * 0.41 + 1.7) * 1.55
              + cos(angle * 2.0 + t * 0.23 + 3.1) * 0.34;
  return vec2<f32>(wave, slope);
}

fn glsContourScale(uv: vec2<f32>, t: f32, amount: f32) -> f32 {
  if (amount <= 0.0) { return 1.0; }
  let contour = glsContourWave(atan2(uv.y, uv.x), t);
  return 1.0 + clamp(amount, 0.0, 1.0) * 0.11 * contour.x;
}

fn glsContourNormal(uv: vec2<f32>, rad: f32, t: f32, amount: f32) -> vec2<f32> {
  let distance = length(uv);
  if (distance <= 0.0001) { return vec2<f32>(0.0); }
  let radial = uv / distance;
  let contour = glsContourWave(atan2(uv.y, uv.x), t);
  let slope = clamp(amount, 0.0, 1.0) * 0.11 * contour.y;
  let tangent = vec2<f32>(-radial.y, radial.x);
  return normalize(radial - tangent * (rad * slope / distance));
}

fn orbGlassLiquidAnim(uv01: vec2<f32>) -> vec4<f32> {
  let fc = vec2<f32>(uv01.x, 1.0 - uv01.y) * u.size;
  let uv = (2.0 * fc - u.size) / max(min(u.size.x, u.size.y), 1.0);

  let rad = max(u.radius, 0.05);
  let t = u.time * u.speed;
  let s = i32(u.style + 0.5);
  let contourRad = rad * glsContourScale(uv, t, u.contourDeform);

  if (length(uv) > contourRad * (1.01 + mfEdgeD(u.edgeSoftness))) {
    let halo = clamp(mfEdgeGlow(vec3<f32>(0.0), uv, vec2<f32>(0.0), contourRad,
                                u.edgeSoftness, u.edgeGlow, u.glowColor.rgb),
                     vec3<f32>(0.0), vec3<f32>(1.0));
    let haloAlpha = max(halo.r, max(halo.g, halo.b));
    return vec4<f32>(halo, haloAlpha);
  }

  let p   = uv / contourRad;
  let pd  = length(p);

  let clearFa = 1.0 - smoothstep(GL_CLEAR_EA, GL_CLEAR_EB, pd);
  let contourNormal = glsContourNormal(uv, rad, t, u.contourDeform);
  let normal = contourNormal;
  let edgeDepth = max(1.0 - pd, 0.0);
  let refractionWidth = 0.015 + 0.95 * clamp(u.shellMidAlpha, 0.0, 1.0);
  let refractionT = edgeDepth / max(refractionWidth, 0.001);
  let refractionProfile = pow(glsRefractionProfile(refractionT), 0.68);
  let refractionAmount = 1.6 * clamp(u.glassOpacity, 0.0, 1.0) * refractionProfile;
  let refractedP = p - normal * refractionAmount;
  var fcol = vec3<f32>(0.0);
  if (clearFa > 0.0) {
    if (u.glassEnabled > 0.5) {
      let channelSplit = 0.14 * clamp(u.gloss, 0.0, 2.0) * clamp(u.glassOpacity, 0.0, 1.0) * refractionProfile;
      let redSample = glsPresetFluid(refractedP - normal * channelSplit, s, t);
      let greenSample = glsPresetFluid(refractedP, s, t);
      let blueSample = glsPresetFluid(refractedP + normal * channelSplit, s, t);
      fcol = vec3<f32>(redSample.r, greenSample.g, blueSample.b);
    } else {
      fcol = glsPresetFluid(p, s, t);
    }
  }

  let lum = dot(fcol, vec3<f32>(0.213, 0.715, 0.072));
  let clearSat = clamp(vec3<f32>(lum) + (fcol - vec3<f32>(lum)) * 1.22,
                       vec3<f32>(0.0), vec3<f32>(1.0));
  var col = glsOver(u.canvasColor.rgb, clearSat, 0.99 * clearFa);

  if (u.glassEnabled > 0.5) {
    let surfaceWidth = 0.026 + 0.055 * clamp(u.shellEdgeAlpha, 0.0, 1.0);
    let surfaceBand = (1.0 - smoothstep(0.0, surfaceWidth, edgeDepth)) * clearFa;
    let opticalRim = pow(surfaceBand, 1.8);
    let innerRimAlpha = opticalRim * u.glassOpacity * 0.45;
    col = glsOver(col, u.shellInner.rgb, innerRimAlpha);

    let coolDirection = normalize(vec2<f32>(0.84, 0.54));
    let warmDirection = normalize(vec2<f32>(-0.62, -0.78));
    let coolSplit = glsHighlightLobe(normal, coolDirection, -0.32, 1.8);
    let warmSplit = glsHighlightLobe(normal, warmDirection, -0.28, 2.0);
    let dispersion = opticalRim * clamp(u.gloss, 0.0, 2.0) * (0.8 + 0.8 * u.shellEdgeAlpha);
    col = glsOver(col, u.shellMid.rgb, dispersion * coolSplit);
    col = glsOver(col, u.shellEdge.rgb, dispersion * warmSplit);

    let edgeShadow = opticalRim * (0.015 + 0.15 * u.shellEdgeAlpha)
                     * (0.15 + 0.85 * max(dot(normal, vec2<f32>(0.45, -0.89)), 0.0));
    col = col * (1.0 - edgeShadow);

    let keyDirection = normalize(vec2<f32>(-0.68, 0.73));
    let fillDirection = normalize(vec2<f32>(0.74, -0.67));
    let key = opticalRim * glsHighlightLobe(normal, keyDirection, 0.2, 2.8) * clamp(u.sheen, 0.0, 2.0) * 1.4;
    let fill = opticalRim * glsHighlightLobe(normal, fillDirection, 0.4, 3.6) * clamp(u.sheen, 0.0, 2.0) * 1.0;
    col = glsOver(col, u.sheenColor.rgb, key);
    col = glsOver(col, u.specColor.rgb, fill);
  }

  let ballA = 1.0 - smoothstep(0.99 - mfEdgeD(u.edgeSoftness), 1.01 + mfEdgeD(u.edgeSoftness), pd);
  col = clamp(col * max(u.exposure, 0.0), vec3<f32>(0.0), vec3<f32>(1.0)) * ballA;
  let edged = mfEdgeGlow(col, uv, vec2<f32>(0.0), contourRad,
                         u.edgeSoftness, u.edgeGlow, u.glowColor.rgb);
  let finalColor = clamp(edged, vec3<f32>(0.0), vec3<f32>(1.0));
  let emissionAlpha = max(finalColor.r, max(finalColor.g, finalColor.b));
  let sphereAlpha = clamp(max(ballA, emissionAlpha), 0.0, 1.0);
  return vec4<f32>(finalColor, sphereAlpha);
}

struct VOut {
  @builtin(position) pos: vec4<f32>,
  @location(0) uv: vec2<f32>,
};

@vertex
fn vs_main(@builtin(vertex_index) i: u32) -> VOut {
  var p = array<vec2<f32>, 3>(
    vec2<f32>(-1.0, -1.0),
    vec2<f32>( 3.0, -1.0),
    vec2<f32>(-1.0,  3.0),
  );
  var out: VOut;
  out.pos = vec4<f32>(p[i], 0.0, 1.0);
  let uv01 = (p[i] + vec2<f32>(1.0)) * 0.5;
  out.uv = vec2<f32>(uv01.x, 1.0 - uv01.y);
  return out;
}

@fragment
fn fs_main(in: VOut) -> @location(0) vec4<f32> {
  let c = orbGlassLiquidAnim(in.uv);
  let fc = vec2<f32>(in.uv.x, 1.0 - in.uv.y) * u.size;
  let uv = (2.0 * fc - u.size) / max(min(u.size.x, u.size.y), 1.0);
  let rad = max(u.radius, 0.05);
  let t = u.time * u.speed;
  let contourRad = rad * glsContourScale(uv, t, u.contourDeform);
  let q = (2.0 * fc - u.size) / u.size;
  let fitEnd = 1.0;
  let fitFeather = 2.0 / max(min(u.size.x, u.size.y), 1.0);
  let fitStart = min(mix(contourRad, fitEnd, 0.5), fitEnd - fitFeather);
  let fit = 1.0 - smoothstep(fitStart, fitEnd, max(abs(q.x), abs(q.y)));
  return vec4<f32>(c.rgb * fit, c.a * fit);
}
    `;

    const stateSeeds: Record<string, number[]> = {
      idle: [1,1,0,0.228,0.73,0.432,1.825,0.255,2.214,0.14,0.14,0.52,0.42,0.2,0.816,23,0.005,0,0,1,0.82,0.051,2,0.42,0.77,0.23,65,0,0,1,0.22,0.25,0.72,5,0.42,1.25,0.55,0.3,1.2,0.7,0.059,0.043,0.086,1,0.251,0.208,0.322,1,0.467,0.412,0.565,1,0.682,0.643,0.741,1,0.788,0.769,0.82,1,0.965,0.941,1,1,0.851,0.78,1,1,0.71,0.604,0.91,1,1,1,1,1,0.914,0.871,1,1,0.02,0.008,0.031,1,0.431,0.38,0.522,1,0.969,0.984,1,1,0.937,0.965,0.992,1,0.878,0.933,0.976,1,0.831,0.902,0.969,1,0.733,0.835,0.953,1,0.651,0.78,0.941,1,0.529,0.69,0.922,1,0.435,0.62,0.91,1,0.435,0.62,0.91,1,0.435,0.62,0.91,1,0.435,0.62,0.91,1,0.435,0.62,0.91,1],
      thinking: [1,1,0,0.76,0.73,0.46,3.65,0.58,2.7,0.14,0.14,0.52,0.42,0.2,1.2,23,0.005,0,0,1,0.82,0.16,2,0.42,0.77,0.23,65,0,0,1,0.22,0.25,0.72,5,0.42,1.25,0.55,0.3,1.2,0.7,0.106,0.063,0.169,1,0.439,0.337,0.659,1,0.749,0.647,0.961,1,0.945,0.91,1,1,1,1,1,1,0.965,0.941,1,1,0.851,0.78,1,1,0.71,0.604,0.91,1,1,1,1,1,0.914,0.871,1,1,0.02,0.008,0.031,1,0.694,0.549,1,1,0.969,0.984,1,1,0.937,0.965,0.992,1,0.878,0.933,0.976,1,0.831,0.902,0.969,1,0.733,0.835,0.953,1,0.651,0.78,0.941,1,0.529,0.69,0.922,1,0.435,0.62,0.91,1,0.435,0.62,0.91,1,0.435,0.62,0.91,1,0.435,0.62,0.91,1,0.435,0.62,0.91,1]
    };

    let currentState = stateRef.current === 'idle' ? 'idle' : 'thinking';
    let transitionTargetState = currentState;
    let fromUniforms = new Float32Array(stateSeeds[currentState]);
    let targetUniforms = new Float32Array(stateSeeds[currentState]);
    const displayedUniforms = new Float32Array(stateSeeds[currentState]);
    let transitionStartedAt = 0;
    let activeTransitionDuration = 0;
    let lastFrameAt: number | null = null;
    let motionPhase = 0;

    const audioRules: [number, string, number, number, number][] = [
      [3, "all", 0, 0.7, 5],
      [6, "mid", 0.85, 0, 7],
      [21, "low", 0.075, 0, 1],
      [10, "high", 0.16, 0, 2],
      [14, "all", 0, 0.12, 4]
    ];
    const audioFlowStrengths: Record<string, number> = { "9": 0.8, "10": 0.65, "11": 0.65, "14": 0.75, "19": 1, "21": 0.7, "23": 0.8 };

    function applyAudioUniforms(values: Float32Array, bands: any) {
      const strength = audioFlowStrengths[Math.round(values[15])] ?? 0.8;
      for (const [index, band, additive, proportional, ceiling] of audioRules) {
        const input = bands[band];
        const level = (Number.isFinite(input) ? Math.max(0, Math.min(1, input)) : 0) * strength;
        if (!level) continue;
        values[index] = Math.min(Math.max(ceiling, values[index]), values[index] * (1 + proportional * level) + additive * level);
      }
    }

    function srgbToLinear(value: number) {
      return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    }
    function linearToSrgb(value: number) {
      return value <= 0.0031308 ? value * 12.92 : 1.055 * value ** (1 / 2.4) - 0.055;
    }
    function mixSrgb(from: number, to: number, progress: number) {
      return linearToSrgb(srgbToLinear(from) + (srgbToLinear(to) - srgbToLinear(from)) * progress);
    }
    function transitionProgress(now: number) {
      if (activeTransitionDuration === 0) return 1;
      const raw = Math.min(1, Math.max(0, (now - transitionStartedAt) / activeTransitionDuration));
      return transitionTargetState === "thinking" ? 1 - (1 - raw) ** 3 : raw * raw * (3 - 2 * raw);
    }
    function sampleTransition(now: number) {
      const progress = transitionProgress(now);
      for (let index = 3; index < displayedUniforms.length; index += 1) {
        const colorComponent = index >= 40 && (index - 40) % 4 < 3;
        displayedUniforms[index] = colorComponent
          ? mixSrgb(fromUniforms[index], targetUniforms[index], progress)
          : fromUniforms[index] + (targetUniforms[index] - fromUniforms[index]) * progress;
      }
      return displayedUniforms;
    }

    function setState(nextState: string) {
      if (!stateSeeds[nextState]) return;
      if (nextState === currentState) return;
      const now = performance.now();
      sampleTransition(now);
      fromUniforms = new Float32Array(displayedUniforms);
      targetUniforms = new Float32Array(stateSeeds[nextState]);
      transitionTargetState = nextState;
      transitionStartedAt = now;
      activeTransitionDuration = nextState === "thinking" ? 220 : 650;
      currentState = nextState;
    }

    (window as any).liquidOrb = {
      getState: () => currentState,
      setState,
      setAudioBands: (bands: any) => {
        audioBandsRef.current = bands;
      },
    };

    async function initWebGpu() {
      if (!(navigator as any).gpu) {
        throw new Error("WebGPU is not supported in this browser. Please use Chrome/Edge with hardware acceleration.");
      }
      const adapter = await (navigator as any).gpu.requestAdapter();
      if (!adapter) throw new Error("No compatible WebGPU adapter was found.");
      device = await adapter.requestDevice();
      const context: any = (cvs as any).getContext("webgpu");
      if (!context) throw new Error("Unable to create a WebGPU canvas context.");

      const format = (navigator as any).gpu.getPreferredCanvasFormat();
      context.configure({ device, format, alphaMode: "premultiplied" });

      const shader = device.createShaderModule({ code: shaderSource });
      const compilation = await shader.getCompilationInfo();
      const errors = compilation.messages.filter((m: any) => m.type === "error");
      if (errors.length) {
        throw new Error(errors.map((m: any) => `${m.lineNum}:${m.linePos} ${m.message}`).join("\n"));
      }

      const pipeline = device.createRenderPipeline({
        layout: "auto",
        vertex: { module: shader, entryPoint: "vs_main" },
        fragment: {
          module: shader,
          entryPoint: "fs_main",
          targets: [{
            format,
            blend: {
              color: { srcFactor: "one", dstFactor: "one-minus-src-alpha", operation: "add" },
              alpha: { srcFactor: "one", dstFactor: "one-minus-src-alpha", operation: "add" },
            },
          }],
        },
        primitive: { topology: "triangle-list" },
      });

      const values = new Float32Array(displayedUniforms);
      // GPUBufferUsage.UNIFORM (0x0040) | GPUBufferUsage.COPY_DST (0x0008)
      const uniformUsage = 0x0040 | 0x0008;
      const uniformBuffer = device.createBuffer({
        size: values.byteLength,
        usage: uniformUsage,
      });
      const bindGroup = device.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: [{ binding: 0, resource: { buffer: uniformBuffer } }],
      });

      function frame(now: number) {
        if (stopped || !device) return;
        try {
          const dpr = Math.min(window.devicePixelRatio || 1, 2);
          const width = Math.max(1, Math.floor(cvs.clientWidth * dpr));
          const height = Math.max(1, Math.floor(cvs.clientHeight * dpr));
          if (cvs.width !== width || cvs.height !== height) {
            cvs.width = width;
            cvs.height = height;
          }

          values.set(sampleTransition(now));
          const frameDelta = lastFrameAt === null ? 0 : Math.min(0.1, Math.max(0, (now - lastFrameAt) / 1000));
          lastFrameAt = now;

          applyAudioUniforms(values, audioBandsRef.current);
          motionPhase += frameDelta * Math.max(values[3], 0);
          values[0] = width;
          values[1] = height;
          values[2] = motionPhase / Math.max(values[3], 0.001);

          device.queue.writeBuffer(uniformBuffer, 0, values);

          const encoder = device.createCommandEncoder();
          const pass = encoder.beginRenderPass({
            colorAttachments: [{
              view: context.getCurrentTexture().createView(),
              clearValue: { r: 0, g: 0, b: 0, a: 0 },
              loadOp: "clear",
              storeOp: "store",
            }],
          });
          pass.setPipeline(pipeline);
          pass.setBindGroup(0, bindGroup);
          pass.draw(3);
          pass.end();

          device.queue.submit([encoder.finish()]);
          animationFrame = requestAnimationFrame(frame);
        } catch (e: any) {
          console.error('Frame render error:', e);
        }
      }

      animationFrame = requestAnimationFrame(frame);
    }

    initWebGpu().catch((err) => {
      console.warn('WebGPU Init Warning:', err);
      setWebGpuError(err.message || String(err));
    });

    return () => {
      stopped = true;
      cancelAnimationFrame(animationFrame);
      if (ribbonTarget && typeof ribbonTarget.destroy === 'function') {
        ribbonTarget.destroy();
      }
      if (device && typeof device.destroy === 'function') {
        device.destroy();
      }
    };
  }, []);

  if (webGpuError) {
    return (
      <div
        id="liquid-orb-wrapper"
        onClick={onOrbClick}
        style={{
          width: '100%',
          height: '100%',
          minHeight: '460px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          position: 'relative',
        }}
      >
        <Orb state={state} audioLevel={audioBands.all} onOrbClick={onOrbClick} />
      </div>
    );
  }

  return (
    <div
      id="liquid-orb-wrapper"
      onClick={onOrbClick}
      style={{
        width: '100%',
        height: '100%',
        minHeight: '460px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        position: 'relative',
      }}
    >
      <canvas
        ref={canvasRef}
        id="orb"
        style={{
          width: '100%',
          height: '100%',
          maxWidth: '520px',
          maxHeight: '520px',
          display: 'block',
        }}
      />
    </div>
  );
};
