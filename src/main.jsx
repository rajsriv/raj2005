import React, { useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { ArrowUpRight } from 'lucide-react';
import './styles.css';

function TiltWordmark() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const stack = canvas?.parentElement;
    const measure = stack?.querySelector('.wordmark-measure');
    if (!canvas || !stack || !measure) return undefined;

    const gl = canvas.getContext('webgl', { alpha: true, antialias: true, premultipliedAlpha: false });
    if (!gl) {
      canvas.classList.add('webgl-unavailable');
      return undefined;
    }

    const compile = (type, source) => {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
      return shader;
    };

    const vertex = compile(gl.VERTEX_SHADER, `
      attribute vec2 position;
      varying vec2 uv;
      void main() { uv = position * 0.5 + 0.5; gl_Position = vec4(position, 0.0, 1.0); }
    `);
    const fragment = compile(gl.FRAGMENT_SHADER, `
      precision highp float;
      uniform sampler2D tex;
      uniform vec2 resolution;
      uniform float focus;
      uniform float maxBlur;
      uniform float dissolve;
      varying vec2 uv;
      void main() {
        float angle = radians(155.0);
        vec2 normal = vec2(cos(angle), sin(angle));
        // Match the focus distance to the wordmark bounds rather than the full canvas.
        vec2 point = (uv - 0.5) * vec2(resolution.x / resolution.y, 1.0) * 0.45;
        float distanceFromFocus = abs(dot(point, normal));
        float blur = smoothstep(focus, focus + 0.32, distanceFromFocus) * maxBlur;
        vec2 offset = vec2(blur) / resolution;
        vec4 color = texture2D(tex, uv);
        float weightSum = 1.0;
        float jitter = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) * 6.2832;
        for (int i = 1; i < 64; i++) {
          float fi = float(i);
          float radius = sqrt(fi / 64.0);
          float theta = fi * 2.39996 + jitter;
          float weight = exp(-2.0 * radius * radius);
          vec2 sampleOffset = vec2(cos(theta), sin(theta)) * radius * offset;
          color += texture2D(tex, uv + sampleOffset) * weight;
          weightSum += weight;
        }
        color /= weightSum;
        float fadeOut = smoothstep(0.78, 0.88, dissolve);
        color.a *= 1.0 - fadeOut;
        gl_FragColor = color;
      }
    `);
    const program = gl.createProgram();
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
    gl.useProgram(program);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, 'position');
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.clearColor(0, 0, 0, 0);

    const source = document.createElement('canvas');
    const context = source.getContext('2d');
    const resolutionLoc = gl.getUniformLocation(program, 'resolution');
    const focusLoc = gl.getUniformLocation(program, 'focus');
    const blurLoc = gl.getUniformLocation(program, 'maxBlur');
    const dissolveLoc = gl.getUniformLocation(program, 'dissolve');

    let progress = 0;
    let frame = 0;
    const render = () => {
      const rect = canvas.getBoundingClientRect();
      const stackRect = stack.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.max(1, Math.round(rect.width * dpr));
      const height = Math.max(1, Math.round(rect.height * dpr));
      canvas.width = width;
      canvas.height = height;
      source.width = width;
      source.height = height;

      const style = getComputedStyle(measure);
      const fontPx = parseFloat(style.fontSize) * dpr;
      const tracking = parseFloat(style.letterSpacing) * dpr || 0;
      context.clearRect(0, 0, width, height);
      context.textAlign = 'left';
      context.textBaseline = 'alphabetic';
      context.fillStyle = '#050505';
      const normalFont = `${style.fontWeight} ${fontPx}px ${style.fontFamily}`;
      const letterWidths = (text, font, spacing) => {
        context.font = font;
        const widths = [...text].map((letter) => context.measureText(letter).width);
        const kernings = [...text].slice(0, -1).map((letter, index) => (
          context.measureText(letter + text[index + 1]).width - widths[index] - widths[index + 1]
        ));
        return { widths, kernings, total: widths.reduce((sum, width) => sum + width, 0) + kernings.reduce((sum, value) => sum + value, 0) + spacing * (text.length - 1) };
      };
      const runs = [
        { text: "Hi! It's ", font: normalFont, spacing: tracking },
        { text: 'Raj', font: normalFont, spacing: tracking }
      ];
      const total = runs.reduce((sum, run) => sum + letterWidths(run.text, run.font, run.spacing).total, 0);
      const scale = Math.min(1, (stackRect.width * dpr * 0.97) / total);
      const titleLeft = (width - total * scale) / 2;
      context.save();
      context.translate(titleLeft, height / 2 + fontPx * 0.2);
      context.scale(scale, scale);
      for (const run of runs) {
        context.font = run.font;
        const { widths, kernings, total: runWidth } = letterWidths(run.text, run.font, run.spacing);
        context.save();
        context.translate(run.dx || 0, run.dy || 0);
        let cursor = 0;
        [...run.text].forEach((letter, index) => {
          context.fillText(letter, cursor, 0);
          cursor += widths[index] + (kernings[index] || 0) + (index < run.text.length - 1 ? run.spacing : 0);
        });
        context.restore();
        context.translate(runWidth, 0);
      }
      context.restore();

      gl.viewport(0, 0, width, height);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
      gl.uniform2f(resolutionLoc, width, height);
      // The focus strip contracts as scrolling spreads blur across the full word.
      gl.uniform1f(focusLoc, 0.16 - progress * 0.55);
      gl.uniform1f(blurLoc, (9.0 + progress * 45.0) * dpr);
      gl.uniform1f(dissolveLoc, progress);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };

    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        progress = Math.min(1, Math.max(0, window.scrollY / Math.max(1, window.innerHeight)));
        render();
      });
    };

    let resizeObserver;
    const fontReady = document.fonts?.ready || Promise.resolve();
    fontReady.then(render);
    resizeObserver = new ResizeObserver(render);
    resizeObserver.observe(stack);
    window.addEventListener('resize', render);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => {
      if (frame) cancelAnimationFrame(frame);
      resizeObserver?.disconnect();
      window.removeEventListener('resize', render);
      window.removeEventListener('scroll', onScroll);
      gl.deleteTexture(texture);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
      gl.deleteShader(vertex);
      gl.deleteShader(fragment);
    };
  }, []);

  return (
    <div className="wordmark-stack">
      <h1 className="wordmark wordmark-measure" aria-label="Hi! It's Raj">Hi! It's Raj</h1>
      <canvas ref={canvasRef} className="wordmark-canvas" aria-hidden="true" />
      <h1 className="wordmark wordmark-fallback" aria-hidden="true">Hi! It's Raj</h1>
    </div>
  );
}

function App() {
  const resourcePanelRef = useRef(null);
  useEffect(() => {
    let frame = 0;
    const updateProgress = () => {
      frame = 0;
      const pageProgress = Math.min(4, Math.max(0, window.scrollY / Math.max(1, window.innerHeight)));
      const progress = Math.min(1, pageProgress);
      document.documentElement.style.setProperty('--scroll-progress', progress);
      const aboutProgress = Math.min(1, Math.max(0, (progress - 0.9) / 0.1));
      const aboutEase = aboutProgress * aboutProgress * (3 - 2 * aboutProgress);
      const aboutExitProgress = Math.min(1, Math.max(0, (pageProgress - 1.65) / 0.35));
      const aboutExit = aboutExitProgress * aboutExitProgress * (3 - 2 * aboutExitProgress);
      const designProgress = Math.min(1, Math.max(0, (pageProgress - 1.65) / 0.35));
      const designEase = designProgress * designProgress * (3 - 2 * designProgress);
      const designExitProgress = Math.min(1, Math.max(0, (pageProgress - 2.1) / 0.75));
      const designExit = designExitProgress * designExitProgress * (3 - 2 * designExitProgress);
      const designVisibility = designEase * (1 - Math.min(1, Math.max(0, (pageProgress - 2.85) / 0.15)));
      const footerProgress = Math.min(1, Math.max(0, (pageProgress - 3.05) / 0.35));
      const footerEase = footerProgress * footerProgress * (3 - 2 * footerProgress);
      document.documentElement.style.setProperty('--about-opacity', aboutEase * (1 - aboutExit));
      document.documentElement.style.setProperty('--about-y', `${(1 - aboutEase) * 24}px`);
      document.documentElement.style.setProperty('--design-opacity', designVisibility);
      document.documentElement.style.setProperty('--design-y', `${(1 - designEase) * 28}px`);
      document.documentElement.style.setProperty('--resource-lift', `${(1 - designEase) * 36 - designExit * 80}px`);
      document.documentElement.style.setProperty('--footer-opacity', footerEase);
      document.documentElement.style.setProperty('--footer-y', `${(1 - footerEase) * 96}px`);
      resourcePanelRef.current?.setAttribute('data-tiles-active', designEase > 0.02 && designExit < 0.01 ? 'true' : 'false');
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(updateProgress);
    };
    updateProgress();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  return (
    <main className="landing" id="top">
      <div className="wash wash-pink" />
      <div className="wash wash-coral" />
      <div className="wash wash-amber" />
      <div className="wash wash-lilac" />
      <section className="hero" aria-label="Portfolio introduction">
        <div className="wordmark-wrap">
          <TiltWordmark />
        </div>
        <section className="about-panel" aria-label="About Raj">
          <p className="about-eyebrow">A LITTLE ABOUT ME</p>
          <h2>Designing with curiosity and care.</h2>
          <p className="about-copy">I’m Raj, a digital designer interested in thoughtful interfaces, clear systems, and expressive visual details.</p>
          <p className="about-copy about-note">I turn ideas into useful, human experiences across mobile, dashboards, and emerging AI products.</p>
        </section>
        <section className="resource-panel" ref={resourcePanelRef} aria-label="Design inspiration resources">
          <div className="tile-grid" aria-hidden="true">
            {Array.from({ length: 140 }, (_, index) => {
              const row = Math.floor(index / 14);
              const col = index % 14;
              const leftGlow = Math.max(0, 1 - Math.abs(col - (3.2 + row * 0.42)) / 5.4);
              const rightGlow = Math.max(0, 1 - Math.abs(col - (10.4 - row * 0.2)) / 3.2);
              const vertical = Math.max(0, Math.min(1, (row - 0.1) / 5.2));
              const seed = Math.sin((row + 1) * 127.1 + (col + 1) * 311.7) * 43758.5453;
              const random = seed - Math.floor(seed);
              const baseStrength = Math.max(leftGlow, rightGlow) * vertical * (0.48 + 0.52 * random);
              const titleArea = row >= 2 && row <= 4 && col >= 1 && col <= 5 ? 0.78 : 0;
              const bottomTextArea = row >= 6 && row <= 7 && ((col >= 1 && col <= 5) || (col >= 9 && col <= 12)) ? 0.7 : 0;
              const strength = Math.min(0.9, Math.max(baseStrength, titleArea, bottomTextArea));
              const delay = (random * 0.72 + (row + col) * 0.006).toFixed(2);
              return <span className="tile" key={index} style={{ '--tile-alpha': strength, '--tile-visibility': 0.22 + strength * 0.78, '--tile-delay': `${delay}s` }} />;
            })}
          </div>
          <div className="resource-copy">
            <div className="resource-copy-inner">
              <div className="resource-title">
                <h2>Design<br />Inspiration<br /><span>Websites</span></h2>
                <p className="resource-author">©&nbsp; Vasil Enev</p>
              </div>
              <div className="resource-bottom">
                <h3>GO-TO SOURCES<br />BEYOND INSTAGRAM</h3>
                <p className="save-copy">SAVE IT<br />FOR LATER</p>
              </div>
              <div className="resource-footer">
                <strong>DESIGN<br />RESOURCES</strong>
                <strong>2025<br />JULY</strong>
                <span className="bookmark" aria-hidden="true" />
              </div>
            </div>
          </div>
        </section>
        <footer className="footer-panel">
          <p className="footer-eyebrow">RAJ · DIGITAL DESIGNER</p>
          <h2>Thanks for stopping by.</h2>
          <div className="footer-bottom">
            <p>Thoughtful interfaces. Expressive details.<br />Made with curiosity and care.</p>
            <a href="#top">BACK TO TOP <ArrowUpRight size={14} /></a>
            <span>© 2026 RAJ</span>
          </div>
        </footer>
      </section>
      <a className="corner-link" href="#work" aria-label="View selected work"><ArrowUpRight size={16} /></a>
    </main>
  );
}

createRoot(document.getElementById('root')).render(<App />);
