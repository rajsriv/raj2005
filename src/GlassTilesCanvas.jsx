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

    // Fullscreen quad with smooth Radial Horizon shader
    // Inverted/Flipped: bottom black/deep navy -> middle electric royal blue -> top clean luminous white
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

        // Smooth cubic Hermite interpolation
        float easeInOut(float t) {
          return t * t * (3.0 - 2.0 * t);
        }

        void main() {
          vec2 uv = vUv;
          
          // Subtle breathing shift
          float t = uTime * 0.25;
          float breath = sin(t) * 0.015;

          // Horizon center origin at bottom center (flipped from top arc)
          // Curved planetary radial horizon lifting from the bottom
          vec2 origin = vec2(0.5 + (uMouse.x - 0.5) * 0.06, -0.32 + breath);
          
          // Aspect ratio correction for an expansive elliptical dome/horizon
          float aspect = uResolution.x / max(1.0, uResolution.y);
          vec2 p = uv - origin;
          p.x *= aspect * 0.62; // Wider elliptical curvature
          
          float dist = length(p);

          // Deep spectrum matching reference flipped:
          // 0.0: Bottom core - Pure obsidian black / midnight
          // 0.35: Deepest midnight indigo
          // 0.62: Electric cobalt & vivid royal blue
          // 0.82: Atmospheric sky cyan / soft cerulean
          // 1.0+: Pristine luminous white
          vec3 cBlack    = vec3(0.005, 0.008, 0.022);   // Deep obsidian black
          vec3 cMidnight = vec3(0.03, 0.06, 0.36);      // Darkest midnight blue
          vec3 cCobalt   = vec3(0.06, 0.22, 0.88);      // Electric cobalt / vibrant royal blue
          vec3 cSky      = vec3(0.56, 0.78, 0.98);      // Atmospheric cyan / cerulean
          vec3 cWhite    = vec3(0.98, 0.99, 1.0);       // Crisp white

          // Smooth curved radial color bands
          vec3 col;
          if (dist < 0.42) {
            float f = smoothstep(0.0, 0.42, dist);
            col = mix(cBlack, cMidnight, easeInOut(f));
          } else if (dist < 0.72) {
            float f = smoothstep(0.42, 0.72, dist);
            col = mix(cMidnight, cCobalt, easeInOut(f));
          } else if (dist < 0.98) {
            float f = smoothstep(0.72, 0.98, dist);
            col = mix(cCobalt, cSky, easeInOut(f));
          } else {
            float f = smoothstep(0.98, 1.32, dist);
            col = mix(cSky, cWhite, easeInOut(f));
          }

          // Subtle analog dithering to prevent any 8-bit banding across the ultra-soft gradient
          float dither = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5;
          col += (dither / 255.0) * 1.8;

          gl_FragColor = vec4(col, 1.0);
        }
      `
    });

    const quad = new THREE.Mesh(quadGeom, horizonMat);
    scene.add(quad);

    // Mouse tracking for subtle parallax perspective
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

      mouse.x += (mouse.targetX - mouse.x) * 0.05;
      mouse.y += (mouse.targetY - mouse.y) * 0.05;

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
