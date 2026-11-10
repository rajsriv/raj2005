import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

export function GlassTilesCanvas() {
  const containerRef = useRef(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    container.appendChild(renderer.domElement);

    let dpr = Math.min(window.devicePixelRatio || 1, 2);

    // Continuous Planetary Horizon Gradient Shader
    // Ultra-seamless, infinite-blend transition from obsidian black to vibrant cobalt/electric royal blue to atmospheric sky and white
    const quadGeom = new THREE.PlaneGeometry(2, 2);
    const horizonMat = new THREE.ShaderMaterial({
      uniforms: {
        uResolution: { value: new THREE.Vector2(container.clientWidth * dpr, container.clientHeight * dpr) },
        uTime: { value: 0 },
        uMouse: { value: new THREE.Vector2(0.5, 0.0) }
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec2 uResolution;
        uniform float uTime;
        uniform vec2 uMouse;
        varying vec2 vUv;

        // Smooth cosine-based multi-stop gradient without piecewise if/else hard seams
        void main() {
          vec2 uv = vUv;
          
          // Subtle organic tidal breathing
          float t = uTime * 0.2;
          float breath = sin(t) * 0.02;

          // Planetary horizon center lowered far beneath the bottom edge
          // Placing the center at y = -0.55 creates a wide, sweeping celestial planetary curve (like Earth's limb from space)
          vec2 origin = vec2(0.5 + (uMouse.x - 0.5) * 0.05, -0.55 + breath);
          
          float aspect = uResolution.x / max(1.0, uResolution.y);
          vec2 p = uv - origin;
          p.x *= aspect * 0.45; // Broad sweeping elliptical horizon curve
          
          // Normalized radial distance from planet center upwards
          float dist = length(p);

          // Map radial distance into a continuous 0.0 -> 1.0 parameter
          // Dist spans smoothly from bottom core (~0.46) to top of viewport (~1.60)
          // Reach pure white at or before the top edge (s reaches 1.0 well before 1.50) so it matches the white background seamlessly
          float s = clamp((dist - 0.46) / 0.96, 0.0, 1.0);

          // Rich color anchors matching the celestial planetary horizon:
          vec3 cBlack    = vec3(0.0, 0.0, 0.0);         // Pure black to seamlessly merge into footer black
          vec3 cNavy     = vec3(0.015, 0.05, 0.38);     // Midnight twilight blue
          vec3 cElectric = vec3(0.04, 0.24, 0.94);      // Saturated royal / electric cobalt blue
          vec3 cSky      = vec3(0.58, 0.78, 0.98);      // Atmospheric cyan / sky blue
          vec3 cWhite    = vec3(1.0, 1.0, 1.0);         // Pure crisp white atmosphere matching top section

          // 100% continuous multi-term polynomial / smooth hermite blending
          // Completely eliminates piecewise 'step' boundaries or bands
          float w1 = smoothstep(0.00, 0.35, s);
          float w2 = smoothstep(0.18, 0.60, s);
          float w3 = smoothstep(0.42, 0.80, s);
          float w4 = smoothstep(0.65, 0.95, s);

          vec3 col = cBlack;
          col = mix(col, cNavy,     w1);
          col = mix(col, cElectric, w2);
          col = mix(col, cSky,      w3);
          col = mix(col, cWhite,    w4);

          // Blend seamlessly to solid black at the very bottom edge (uv.y <= 0.08)
          // to guarantee a 100% flawless merge into the black footer below
          float bottomFade = smoothstep(0.08, 0.0, uv.y);
          col = mix(col, cBlack, bottomFade);

          // Ensure it reaches exact pure white at the top boundary
          if (s >= 0.98) {
            col = cWhite;
          } else if (uv.y <= 0.01) {
            col = cBlack;
          } else {
            // High-frequency triangular dither to eliminate 8-bit gradient banding only in gradient zone
            float noise = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
            col += (noise - 0.5) * (1.2 / 255.0);
          }

          gl_FragColor = vec4(col, 1.0);
        }
      `
    });

    const quad = new THREE.Mesh(quadGeom, horizonMat);
    scene.add(quad);

    const mouse = { x: 0.5, y: 0.0, targetX: 0.5, targetY: 0.0 };
    const onPointerMove = (e) => {
      const rect = container.getBoundingClientRect();
      mouse.targetX = (e.clientX - rect.left) / rect.width;
      mouse.targetY = 1.0 - (e.clientY - rect.top) / rect.height;
    };
    window.addEventListener('pointermove', onPointerMove);

    let animationFrameId;
    let clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const elapsedTime = clock.getElapsedTime();

      mouse.x += (mouse.targetX - mouse.x) * 0.04;
      mouse.y += (mouse.targetY - mouse.y) * 0.04;

      horizonMat.uniforms.uTime.value = elapsedTime;
      horizonMat.uniforms.uMouse.value.set(mouse.x, mouse.y);

      renderer.render(scene, camera);
    };

    animate();

    const onResize = () => {
      if (!container) return;
      const width = container.clientWidth;
      const height = container.clientHeight;

      dpr = Math.min(window.devicePixelRatio || 1, 2);
      renderer.setSize(width, height);
      renderer.setPixelRatio(dpr);

      horizonMat.uniforms.uResolution.value.set(width * dpr, height * dpr);
    };

    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('resize', onResize);
      renderer.dispose();
      quadGeom.dispose();
      horizonMat.dispose();
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
