import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import type { OrbState } from '../types';

interface OrbProps {
  state: OrbState;
  audioLevel: number;
  onOrbClick?: () => void;
}

export const Orb: React.FC<OrbProps> = ({ state, audioLevel, onOrbClick }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef(state);
  const audioLevelRef = useRef(audioLevel);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    audioLevelRef.current = audioLevel;
  }, [audioLevel]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 500;
    const height = container.clientHeight || 500;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.z = 4.4;

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance'
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    container.appendChild(renderer.domElement);

    // Color schemes for each state
    const statePalettes = {
      idle: {
        core: new THREE.Color('#00f7ff'),
        surface: new THREE.Color('#005588'),
        emissive: new THREE.Color('#0088cc'),
        corona: new THREE.Color('#00e1ff'),
        lightA: new THREE.Color('#00ffff'),
        lightB: new THREE.Color('#0066ff'),
        speed: 1.0,
        waveFreq: 2.2,
        waveAmp: 0.10,
      },
      listening: {
        core: new THREE.Color('#00ffa3'),
        surface: new THREE.Color('#008855'),
        emissive: new THREE.Color('#00ffaa'),
        corona: new THREE.Color('#38ef7d'),
        lightA: new THREE.Color('#00ff9d'),
        lightB: new THREE.Color('#00e5ff'),
        speed: 2.4,
        waveFreq: 3.5,
        waveAmp: 0.22,
      },
      thinking: {
        core: new THREE.Color('#f43f5e'),
        surface: new THREE.Color('#7c3aed'),
        emissive: new THREE.Color('#c084fc'),
        corona: new THREE.Color('#e879f9'),
        lightA: new THREE.Color('#ec4899'),
        lightB: new THREE.Color('#8b5cf6'),
        speed: 3.0,
        waveFreq: 4.5,
        waveAmp: 0.28,
      },
      speaking: {
        core: new THREE.Color('#fbbf24'),
        surface: new THREE.Color('#d97706'),
        emissive: new THREE.Color('#f59e0b'),
        corona: new THREE.Color('#fde047'),
        lightA: new THREE.Color('#f59e0b'),
        lightB: new THREE.Color('#06b6d4'),
        speed: 2.2,
        waveFreq: 3.0,
        waveAmp: 0.18,
      },
      unsure: {
        core: new THREE.Color('#fb923c'),
        surface: new THREE.Color('#c2410c'),
        emissive: new THREE.Color('#ea580c'),
        corona: new THREE.Color('#fdba74'),
        lightA: new THREE.Color('#f97316'),
        lightB: new THREE.Color('#eab308'),
        speed: 1.3,
        waveFreq: 2.5,
        waveAmp: 0.14,
      },
      error: {
        core: new THREE.Color('#ef4444'),
        surface: new THREE.Color('#991b1b'),
        emissive: new THREE.Color('#dc2626'),
        corona: new THREE.Color('#f87171'),
        lightA: new THREE.Color('#ef4444'),
        lightB: new THREE.Color('#b91c1c'),
        speed: 2.8,
        waveFreq: 5.0,
        waveAmp: 0.32,
      },
    };

    // Lights
    const ambientLight = new THREE.AmbientLight(0x0a1020, 1.2);
    scene.add(ambientLight);

    const pointLightA = new THREE.PointLight(0x00f7ff, 4.0, 12);
    pointLightA.position.set(3, 3, 3);
    scene.add(pointLightA);

    const pointLightB = new THREE.PointLight(0x0066ff, 3.0, 12);
    pointLightB.position.set(-3, -2, 2);
    scene.add(pointLightB);

    // 1. Core Sphere (Inner Sun)
    const coreGeometry = new THREE.SphereGeometry(0.75, 32, 32);
    const coreMaterial = new THREE.MeshBasicMaterial({
      color: 0x00f7ff,
      transparent: true,
      opacity: 0.88,
    });
    const coreMesh = new THREE.Mesh(coreGeometry, coreMaterial);
    scene.add(coreMesh);

    // 2. Liquid Surface Shell
    const shellGeometry = new THREE.SphereGeometry(1.22, 64, 64);
    const originalShellPos = shellGeometry.attributes.position.clone();

    const shellMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x003366,
      emissive: 0x0088cc,
      emissiveIntensity: 0.85,
      roughness: 0.1,
      metalness: 0.15,
      transmission: 0.82,
      thickness: 0.6,
      transparent: true,
      opacity: 0.90,
      clearcoat: 1.0,
      clearcoatRoughness: 0.08,
    });
    const shellMesh = new THREE.Mesh(shellGeometry, shellMaterial);
    scene.add(shellMesh);

    // 3. Corona Glow (Outer Additive Atmosphere)
    const coronaGeometry = new THREE.SphereGeometry(1.42, 32, 32);
    const coronaMaterial = new THREE.MeshBasicMaterial({
      color: 0x00e1ff,
      transparent: true,
      opacity: 0.16,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
    });
    const coronaMesh = new THREE.Mesh(coronaGeometry, coronaMaterial);
    scene.add(coronaMesh);

    // 4. Soft Glow Particle Texture
    const createGlowTexture = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 64;
      canvas.height = 64;
      const ctx = canvas.getContext('2d')!;
      const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
      grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
      grad.addColorStop(0.25, 'rgba(0, 240, 255, 0.85)');
      grad.addColorStop(0.65, 'rgba(0, 160, 255, 0.25)');
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 64, 64);
      return new THREE.CanvasTexture(canvas);
    };

    const particleCount = 90;
    const particleGeometry = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(particleCount * 3);
    const particleVelocities: { theta: number; phi: number; speed: number; radius: number }[] = [];

    for (let i = 0; i < particleCount; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const radius = 1.6 + Math.random() * 0.7;

      particlePositions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      particlePositions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      particlePositions[i * 3 + 2] = radius * Math.cos(phi);

      particleVelocities.push({
        theta,
        phi,
        speed: (Math.random() * 0.4 + 0.2) * (Math.random() > 0.5 ? 1 : -1),
        radius,
      });
    }
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));

    const particleMaterial = new THREE.PointsMaterial({
      size: 0.16,
      map: createGlowTexture(),
      transparent: true,
      opacity: 0.75,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const particles = new THREE.Points(particleGeometry, particleMaterial);
    scene.add(particles);

    // Dynamic Animation Loop
    let animationFrameId: number;
    let startTime = performance.now();
    let smoothedAudio = 0;

    const curCore = new THREE.Color('#00f7ff');
    const curSurface = new THREE.Color('#005588');
    const curEmissive = new THREE.Color('#0088cc');
    const curCorona = new THREE.Color('#00e1ff');
    const curLightA = new THREE.Color('#00ffff');
    const curLightB = new THREE.Color('#0066ff');

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const now = performance.now();
      const time = (now - startTime) * 0.001;

      const currentState = stateRef.current;
      const target = statePalettes[currentState] || statePalettes.idle;

      // Smooth color blending
      curCore.lerp(target.core, 0.07);
      curSurface.lerp(target.surface, 0.07);
      curEmissive.lerp(target.emissive, 0.07);
      curCorona.lerp(target.corona, 0.07);
      curLightA.lerp(target.lightA, 0.07);
      curLightB.lerp(target.lightB, 0.07);

      coreMaterial.color.copy(curCore);
      shellMaterial.color.copy(curSurface);
      shellMaterial.emissive.copy(curEmissive);
      coronaMaterial.color.copy(curCorona);
      particleMaterial.color.copy(curCore);
      pointLightA.color.copy(curLightA);
      pointLightB.color.copy(curLightB);

      // Audio smoothing
      const rawAudio = Math.min(1.0, audioLevelRef.current);
      smoothedAudio += (rawAudio - smoothedAudio) * 0.25;

      // Inner Core Pulsing
      const coreScale = 1.0 + Math.sin(time * target.speed * 2.8) * 0.07 + smoothedAudio * 0.35;
      coreMesh.scale.set(coreScale, coreScale, coreScale);

      // Outer Corona breathing
      const coronaScale = 1.0 + Math.sin(time * target.speed * 1.5) * 0.05 + smoothedAudio * 0.25;
      coronaMesh.scale.set(coronaScale, coronaScale, coronaScale);

      // Fluid deformation of Shell
      const posAttr = shellGeometry.attributes.position;
      const orig = originalShellPos.array;
      const pos = posAttr.array as Float32Array;

      const speed = time * target.speed;
      const amp = target.waveAmp + smoothedAudio * 0.45;
      const freq = target.waveFreq;

      for (let i = 0; i < orig.length; i += 3) {
        const ox = orig[i];
        const oy = orig[i + 1];
        const oz = orig[i + 2];

        // Organic spherical harmonic wave
        const wave = Math.sin(ox * freq + speed * 1.2) *
                     Math.cos(oy * freq + speed * 0.9) *
                     Math.sin(oz * freq + speed * 1.5);

        const factor = 1.0 + wave * amp * 0.14;
        pos[i] = ox * factor;
        pos[i + 1] = oy * factor;
        pos[i + 2] = oz * factor;
      }
      posAttr.needsUpdate = true;
      shellGeometry.computeVertexNormals();

      // Dynamic Particle Orbits
      const pPos = particleGeometry.attributes.position.array as Float32Array;
      for (let i = 0; i < particleCount; i++) {
        const p = particleVelocities[i];
        p.theta += p.speed * 0.008 * target.speed;
        pPos[i * 3] = p.radius * Math.sin(p.phi) * Math.cos(p.theta);
        pPos[i * 3 + 1] = p.radius * Math.sin(p.phi) * Math.sin(p.theta);
        pPos[i * 3 + 2] = p.radius * Math.cos(p.phi);
      }
      particleGeometry.attributes.position.needsUpdate = true;

      // Gentle Rotations
      shellMesh.rotation.y = time * 0.18;
      shellMesh.rotation.x = Math.sin(time * 0.12) * 0.12;
      coreMesh.rotation.y = -time * 0.25;
      coronaMesh.rotation.y = -time * 0.1;

      // Orbiting light dynamics
      pointLightA.position.x = Math.cos(time * 0.8) * 3.5;
      pointLightA.position.z = Math.sin(time * 0.8) * 3.5;
      pointLightB.position.x = -Math.cos(time * 0.6) * 3.2;
      pointLightB.position.z = -Math.sin(time * 0.6) * 3.2;

      renderer.render(scene, camera);
    };

    animate();

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
      if (container && renderer.domElement) {
        container.removeChild(renderer.domElement);
      }
      coreGeometry.dispose();
      coreMaterial.dispose();
      shellGeometry.dispose();
      shellMaterial.dispose();
      coronaGeometry.dispose();
      coronaMaterial.dispose();
      particleGeometry.dispose();
      particleMaterial.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <div
      ref={mountRef}
      id="orb-canvas-container"
      onClick={onOrbClick}
      style={{
        width: '100%',
        height: '100%',
        minHeight: '440px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        position: 'relative',
      }}
    />
  );
};
