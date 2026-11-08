import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

export function GlassTilesCanvas() {
  const containerRef = useRef(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, container.clientWidth / container.clientHeight, 0.1, 100);
    camera.position.set(0, 0, 8.5);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    container.appendChild(renderer.domElement);

    let dpr = Math.min(window.devicePixelRatio || 1, 2);

    // ============================================================
    // 1. GENERATE RICH PROCEDURAL HIGH-RES TYPOGRAPHIC MANIFESTO
    // ============================================================
    const createArtTexture = () => {
      const cv = document.createElement('canvas');
      cv.width = 2048;
      cv.height = 1024;
      const ctx = cv.getContext('2d');
      ctx.fillStyle = '#fafbfa';
      ctx.fillRect(0, 0, cv.width, cv.height);

      // Fine graph grid
      ctx.strokeStyle = '#e2eae4';
      ctx.lineWidth = 1.0;
      const step = 32;
      for (let x = 0; x <= cv.width; x += step) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, cv.height);
        ctx.stroke();
      }
      for (let y = 0; y <= cv.height; y += step) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(cv.width, y);
        ctx.stroke();
      }

      // Staggered typographic field phrases
      const phrases = [
        'ARCHIVE.01', 'SWISS STYLE', 'CURATED BY RAJ', 'INSPIRATION',
        'SYSTEMS', 'EDITORIAL DESIGN', 'GRID-BASED', 'EXPERIMENTS',
        'TYPOGRAPHIC RHYTHM', 'INDEX 2026', 'AVANT-GARDE', 'HUMAN INTERACTION'
      ];

      // Repeating dense micro-text watermark
      ctx.fillStyle = 'rgba(12, 28, 16, 0.28)';
      ctx.font = '700 19px "DM Mono", monospace';
      for (let y = 30; y < cv.height; y += 44) {
        for (let x = -40; x < cv.width; x += 220) {
          const phrase = phrases[Math.floor((x * 11 + y * 17) % phrases.length)];
          ctx.fillText(phrase, x, y);
        }
      }

      // Large bold editorial typographic statements across sections
      ctx.fillStyle = 'rgba(10, 24, 14, 0.72)';
      ctx.font = '900 84px "DM Mono", monospace';
      ctx.fillText('DESIGN', 90, 220);
      ctx.fillText('INSPIRATION', 90, 310);
      ctx.fillText('WEBSITES', 90, 400);

      ctx.fillStyle = 'rgba(15, 30, 18, 0.65)';
      ctx.font = '700 48px "DM Mono", monospace';
      ctx.fillText('GO-TO SOURCES', 90, 780);
      ctx.fillText('BEYOND INSTAGRAM', 90, 835);

      ctx.font = '700 48px "DM Mono", monospace';
      ctx.fillText('SAVE IT', 1650, 780);
      ctx.fillText('FOR LATER', 1650, 835);

      ctx.font = '600 24px "DM Mono", monospace';
      ctx.fillText('CURATED BY RAJ · DIGITAL DESIGNER · 2026', 90, 930);

      const tex = new THREE.CanvasTexture(cv);
      tex.needsUpdate = true;
      return tex;
    };

    const artTexture = createArtTexture();

    // ============================================================
    // 2. AVANT-GARDE POSTER SHADER:
    // Organic Liquid Distortion + Directional Chromatic Aberration +
    // Multi-Tap Gaussian Bleed + Film Grain & Scanning Beam
    // ============================================================
    const planeGeom = new THREE.PlaneGeometry(18, 10.5);
    const planeMat = new THREE.ShaderMaterial({
      uniforms: {
        uTexture: { value: artTexture },
        uTime: { value: 0 },
        uMouse: { value: new THREE.Vector2(0.5, 0.5) },
        uResolution: { value: new THREE.Vector2(container.clientWidth * dpr, container.clientHeight * dpr) }
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D uTexture;
        uniform float uTime;
        uniform vec2 uMouse;
        uniform vec2 uResolution;
        varying vec2 vUv;

        #define PI 3.14159265359

        // Simplex noise / curl noise approximation
        vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
        vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
        vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }

        float snoise(vec2 v) {
          const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
          vec2 i  = floor(v + dot(v, C.yy));
          vec2 x0 = v - i + dot(i, C.xx);
          vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
          vec4 x12 = x0.xyxy + C.xxzz;
          x12.xy -= i1;
          i = mod289(i);
          vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
          vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
          m = m*m;
          m = m*m;
          vec3 x = 2.0 * fract(p * C.www) - 1.0;
          vec3 h = abs(x) - 0.5;
          vec3 ox = floor(x + 0.5);
          vec3 a0 = x - ox;
          m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
          vec3 g;
          g.x  = a0.x  * x0.x  + h.x  * x0.y;
          g.yz = a0.yz * x12.xz + h.yz * x12.yw;
          return 130.0 * dot(m, g);
        }

        void main() {
          vec2 uv = vUv;
          float t = uTime * 0.45;

          // Multi-octave organic fluid warp
          vec2 q = vec2(snoise(uv * 2.2 + vec2(t * 0.2, -t * 0.15)),
                        snoise(uv * 2.2 + vec2(-t * 0.18, t * 0.22)));

          vec2 r = vec2(snoise(uv * 3.8 + q * 1.5 + vec2(1.7, 9.2) + t * 0.1),
                        snoise(uv * 3.8 + q * 1.5 + vec2(8.3, 2.8) - t * 0.12));

          // Interactive fluid cursor wake
          vec2 mouseDist = uv - uMouse;
          float mouseStrength = exp(-dot(mouseDist, mouseDist) * 16.0) * 0.035;

          vec2 warpedUv = uv + r * 0.022 + mouseDist * mouseStrength;

          // Creamy directional Gaussian bleed convolution
          float sigma = 0.016;
          float twoSigmaSq = 2.0 * sigma * sigma;

          vec3 accumColor = vec3(0.0);
          float totalWeight = 0.0;

          // 28-sample spiral kernel with chromatic dispersion
          for (int i = 0; i < 28; i++) {
            float fi = float(i);
            float theta = fi * 2.39996323;
            float rad = sqrt(fi / 28.0) * (sigma * 2.5);
            vec2 offset = vec2(cos(theta), sin(theta)) * rad;

            float weight = exp(-(rad * rad) / twoSigmaSq);

            // Prism split (Red/Cyan chromatic aberration on fluid edges)
            float rSample = texture2D(uTexture, warpedUv + offset * 1.025).r;
            float gSample = texture2D(uTexture, warpedUv + offset).g;
            float bSample = texture2D(uTexture, warpedUv + offset * 0.975).b;

            accumColor += vec3(rSample, gSample, bSample) * weight;
            totalWeight += weight;
          }
          accumColor /= totalWeight;

          // Fine analogue film grain
          float grain = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233)) + uTime) * 43758.5453);
          accumColor += (grain - 0.5) * 0.038;

          // Subtle scanline rhythm
          float scanline = sin(gl_FragCoord.y * 0.8) * 0.012;
          accumColor -= scanline;

          gl_FragColor = vec4(accumColor, 1.0);
        }
      `
    });

    const planeMesh = new THREE.Mesh(planeGeom, planeMat);
    scene.add(planeMesh);

    // Interactive pointer
    const mouse = { x: 0.5, y: 0.5, targetX: 0.5, targetY: 0.5 };
    const onPointerMove = (e) => {
      const rect = container.getBoundingClientRect();
      mouse.targetX = (e.clientX - rect.left) / rect.width;
      mouse.targetY = 1.0 - (e.clientY - rect.top) / rect.height;
    };
    window.addEventListener('pointermove', onPointerMove);

    // Animation loop
    let animationFrameId;
    let clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const elapsedTime = clock.getElapsedTime();

      mouse.x += (mouse.targetX - mouse.x) * 0.06;
      mouse.y += (mouse.targetY - mouse.y) * 0.06;

      planeMat.uniforms.uTime.value = elapsedTime;
      planeMat.uniforms.uMouse.value.set(mouse.x, mouse.y);

      renderer.render(scene, camera);
    };

    animate();

    const onResize = () => {
      if (!container) return;
      const width = container.clientWidth;
      const height = container.clientHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();

      dpr = Math.min(window.devicePixelRatio || 1, 2);
      renderer.setSize(width, height);
      renderer.setPixelRatio(dpr);

      planeMat.uniforms.uResolution.value.set(width * dpr, height * dpr);
    };

    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('resize', onResize);
      renderer.dispose();
      planeGeom.dispose();
      planeMat.dispose();
      artTexture.dispose();
      if (renderer.domElement.parentElement) {
        renderer.domElement.parentElement.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="glass-tiles-container"
      data-revealed="true"
      aria-hidden="true"
    />
  );
}
