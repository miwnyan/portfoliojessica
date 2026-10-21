(() => {
  'use strict';

  const LENS_MODES = Object.freeze({ bulge: 0, pinch: 1, swirl: 2 });
  const MAX_CLICKS = 4;
  const RIPPLE_LIFE = 1.6;
  const DEFAULTS = Object.freeze({
    text: '',
    color: null,
    warpStrength: 0.04,
    warpScale: 1.45,
    speed: 0.32,
    lens: 'bulge',
    pointerInfluence: 0.5,
    pointerStrength: 0.24,
    idleDrift: 0.08,
    refraction: 0.01,
    chromatic: 0.14,
    ripple: true,
    clickRipple: true,
    intro: true,
    introDuration: 1200,
    fontSize: null,
    fontWeight: null,
    fontFamily: null,
    letterSpacing: null,
    lineHeight: null
  });

  const VERTEX_SHADER = `#version 300 es
in vec2 position;
out vec2 vUv;

void main() {
  vUv = position * 0.5 + 0.5;
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

  const FRAGMENT_SHADER = `#version 300 es
precision highp float;

uniform sampler2D uTextTexture;
uniform vec2 uResolution;
uniform vec2 uPointer;
uniform float uPointerActive;
uniform float uTime;
uniform float uWarpStrength;
uniform float uWarpScale;
uniform float uSpeed;
uniform float uPointerInfluence;
uniform float uPointerStrength;
uniform float uRefraction;
uniform float uChromatic;
uniform float uRipple;
uniform float uMotion;
uniform float uLens;
uniform float uIntro;
uniform float uReveal;
uniform float uBackdrop;
uniform vec4 uClicks[4];

in vec2 vUv;
out vec4 fragColor;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);

  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));

  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float fbm(vec2 p) {
  float value = 0.0;
  float amplitude = 0.5;
  for (int i = 0; i < 4; i++) {
    value += amplitude * noise(p);
    p *= 2.02;
    amplitude *= 0.5;
  }
  return value;
}

vec4 sampleText(vec2 uv) {
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
    return vec4(0.0);
  }
  return texture(uTextTexture, uv);
}

void main() {
  vec2 uv = vUv;
  float aspect = uResolution.x / max(uResolution.y, 1.0);
  float time = uTime * uSpeed;
  float scale = max(uWarpScale, 0.001);

  vec2 drift = vec2(time * 0.055, -time * 0.045);
  float n1 = fbm(uv * scale * 3.1 + drift);
  float n2 = fbm((uv + 19.17) * scale * 3.4 - drift.yx);
  vec2 ambient = (vec2(n1, n2) - 0.5) * (uWarpStrength * 0.045 * uMotion + uIntro * 0.18);

  vec2 pointerDelta = uv - uPointer;
  vec2 aspectDelta = vec2(pointerDelta.x * aspect, pointerDelta.y);
  float dist = length(aspectDelta);
  float radius = max(uPointerInfluence, 0.001);
  float t = clamp(dist / radius, 0.0, 1.0);
  float lens = smoothstep(radius, 0.0, dist) * uPointerActive;
  float bulge = t * (1.0 - t) * (1.0 - t) * 6.75 * uPointerActive;
  vec2 dir = dist > 0.0001
    ? vec2(aspectDelta.x / aspect, aspectDelta.y) / dist
    : vec2(0.0);

  float rippleWave = sin(dist * 28.0 - time * 4.2) * 0.5 + 0.5;
  float rippleRing = (rippleWave - 0.5) * uRipple;
  vec2 pointerWarp = dir * rippleRing * bulge * uPointerStrength * 0.016;

  if (uLens > 1.5) {
    float twist = (1.0 - t) * (1.0 - t) * uPointerActive * uPointerStrength * 2.4;
    float s = sin(twist);
    float c = cos(twist);
    vec2 turned = vec2(
      aspectDelta.x * c - aspectDelta.y * s,
      aspectDelta.x * s + aspectDelta.y * c
    );
    pointerWarp += vec2(turned.x / aspect, turned.y) - pointerDelta;
  } else {
    float side = uLens > 0.5 ? -1.0 : 1.0;
    pointerWarp -= dir * side * bulge * uPointerStrength * 0.045;
  }

  vec2 shock = vec2(0.0);
  float shockLight = 0.0;
  for (int i = 0; i < 4; i++) {
    vec4 click = uClicks[i];
    if (click.w <= 0.0) continue;
    vec2 clickDelta = uv - click.xy;
    vec2 clickAspect = vec2(clickDelta.x * aspect, clickDelta.y);
    float clickDist = length(clickAspect);
    float age = click.z;
    float offset = (clickDist - age * 0.9) / (0.06 + age * 0.06);
    float fade = 1.0 - smoothstep(0.0, 1.6, age);
    float energy = exp(-offset * offset) * fade * smoothstep(0.0, 0.08, age) * click.w;
    vec2 clickDir = clickDist > 0.0001
      ? vec2(clickAspect.x / aspect, clickAspect.y) / clickDist
      : vec2(0.0);
    shock -= clickDir * offset * energy * 0.09;
    shockLight += energy;
  }

  vec2 bend = pointerWarp + shock;
  vec2 rest = uv + ambient;
  vec2 splitDir = ambient + bend;
  float splitLen = length(splitDir);
  splitDir = splitLen > 0.00001 ? splitDir / splitLen : vec2(0.7071, 0.7071);
  vec2 split = splitDir * uRefraction * 0.16 * (0.35 + lens * 1.65 + uIntro * 3.0);
  float dispersion = uChromatic * 0.5;

  vec3 ink = vec3(0.0);
  vec3 cover = vec3(0.0);
  vec3 weight = vec3(0.0);
  for (int i = 0; i < 7; i++) {
    float k = 1.0 - float(i) / 3.0;
    vec4 tap = sampleText(rest + bend * (1.0 + dispersion * k) + split * k);
    vec3 band = vec3(max(k, 0.0), 1.0 - abs(k), max(-k, 0.0));
    ink += tap.rgb * band;
    cover += tap.a * band;
    weight += band;
  }
  ink /= weight;
  cover /= weight;
  float a = max(max(cover.r, cover.g), cover.b);
  vec3 color = ink + (a - cover) * uBackdrop;
  color = min(color + (lens + shockLight * 0.5) * cover.g * 0.055, vec3(a));
  fragColor = vec4(color, a) * uReveal;
}
`;

  const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
  const smooth = value => value * value * (3 - 2 * value);
  const toCssValue = value => (typeof value === 'number' ? `${value}px` : value);

  function listenToMediaQuery(query, handler) {
    if (!query) return () => {};
    if (typeof query.addEventListener === 'function') {
      query.addEventListener('change', handler);
      return () => query.removeEventListener('change', handler);
    }
    if (typeof query.addListener === 'function') {
      query.addListener(handler);
      return () => query.removeListener(handler);
    }
    return () => {};
  }

  function getLuminance(color) {
    const probe = document.createElement('canvas');
    probe.width = 1;
    probe.height = 1;
    const context = probe.getContext('2d', { willReadFrequently: true });
    if (!context) return 1;

    try {
      context.clearRect(0, 0, 1, 1);
      context.fillStyle = color;
      context.fillRect(0, 0, 1, 1);
      const [red, green, blue] = context.getImageData(0, 0, 1, 1).data;
      return (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255;
    } catch (error) {
      void error;
      return 1;
    }
  }

  function measureLine(context, line, letterSpacing) {
    const characters = Array.from(line);
    const glyphWidth = characters.reduce(
      (width, character) => width + context.measureText(character).width,
      0
    );
    return glyphWidth + Math.max(0, characters.length - 1) * letterSpacing;
  }

  function drawLine(context, line, centerX, centerY, letterSpacing) {
    const characters = Array.from(line);
    let cursor = centerX - measureLine(context, line, letterSpacing) / 2;

    characters.forEach((character, index) => {
      context.fillText(character, cursor, centerY);
      cursor += context.measureText(character).width;
      if (index < characters.length - 1) cursor += letterSpacing;
    });
  }

  function buildTextCanvas({ fallback, text, width, height, dpr, props }) {
    const source = document.createElement('canvas');
    source.width = Math.max(1, Math.round(width * dpr));
    source.height = Math.max(1, Math.round(height * dpr));

    const context = source.getContext('2d');
    const computed = window.getComputedStyle(fallback);
    const ink = props.color || computed.color || 'rgb(255, 255, 255)';
    if (!context) return { canvas: source, ink };

    let fontSize = Number.parseFloat(computed.fontSize) || 64;
    const fontFamily = props.fontFamily || computed.fontFamily || 'sans-serif';
    const fontWeight = props.fontWeight || computed.fontWeight || '800';
    const fontStyle = computed.fontStyle || 'normal';
    let letterSpacing = computed.letterSpacing === 'normal'
      ? 0
      : Number.parseFloat(computed.letterSpacing) || 0;
    let lineHeight = Number.parseFloat(computed.lineHeight);

    if (props.letterSpacing !== null && props.letterSpacing !== undefined) {
      const spacingProbe = document.createElement('span');
      spacingProbe.style.position = 'absolute';
      spacingProbe.style.visibility = 'hidden';
      spacingProbe.style.fontSize = `${fontSize}px`;
      spacingProbe.style.letterSpacing = toCssValue(props.letterSpacing);
      fallback.appendChild(spacingProbe);
      const spacing = window.getComputedStyle(spacingProbe).letterSpacing;
      letterSpacing = spacing === 'normal' ? 0 : Number.parseFloat(spacing) || 0;
      spacingProbe.remove();
    }

    if (!Number.isFinite(lineHeight)) lineHeight = fontSize * 0.98;

    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, width, height);
    context.textAlign = 'left';
    context.textBaseline = 'middle';
    context.fillStyle = ink;
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';

    const lines = String(text || '').split('\n');
    const applyFont = () => {
      context.font = `${fontStyle} ${fontWeight} ${fontSize}px ${fontFamily}`;
    };
    applyFont();

    const maxWidth = width * 0.86;
    const maxHeight = height * 0.78;
    const widestLine = Math.max(
      ...lines.map(line => measureLine(context, line, letterSpacing)),
      1
    );
    const blockHeight = Math.max(lineHeight * lines.length, 1);
    const fit = Math.min(1, maxWidth / widestLine, maxHeight / blockHeight);

    if (fit < 1) {
      fontSize *= fit;
      letterSpacing *= fit;
      lineHeight *= fit;
      applyFont();
    }

    const firstLineY = height / 2 - (lineHeight * (lines.length - 1)) / 2;
    lines.forEach((line, index) => {
      drawLine(context, line, width / 2, firstLineY + index * lineHeight, letterSpacing);
    });

    return { canvas: source, ink };
  }

  function compileShader(gl, type, source) {
    const shader = gl.createShader(type);
    if (!shader) throw new Error('Não foi possível criar o shader.');
    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const details = gl.getShaderInfoLog(shader) || 'Erro de compilação desconhecido.';
      gl.deleteShader(shader);
      throw new Error(details);
    }
    return shader;
  }

  function createProgram(gl) {
    const vertex = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
    const fragment = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
    const program = gl.createProgram();
    if (!program) throw new Error('Não foi possível criar o programa WebGL.');

    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const details = gl.getProgramInfoLog(program) || 'Erro de link desconhecido.';
      gl.deleteProgram(program);
      throw new Error(details);
    }
    return program;
  }

  function createFallbackInstance(element, props, reason) {
    const text = String(props.text || '');
    const fallback = document.createElement('span');
    fallback.className = 'warp-name__fallback';
    fallback.textContent = text;
    element.replaceChildren(fallback);
    element.classList.add('warp-name');
    element.classList.remove('is-webgl-ready');
    element.dataset.warpState = reason;

    const update = nextOptions => {
      Object.assign(props, nextOptions || {});
      if (nextOptions && Object.hasOwn(nextOptions, 'text')) {
        props.text = String(nextOptions.text || '');
        fallback.textContent = props.text;
      }
    };

    const destroy = () => {
      if (element.__warpTextInstance !== instance) return;
      delete element.__warpTextInstance;
      element.classList.remove('warp-name', 'is-webgl-ready');
      delete element.dataset.warpState;
      element.textContent = props.text;
    };

    const instance = Object.freeze({ destroy, refresh: () => {}, update });
    element.__warpTextInstance = instance;
    return instance;
  }

  function createWarpText(element, options = {}) {
    if (!(element instanceof Element)) return null;

    const requestedText = options.text ?? element.dataset.text ?? element.textContent ?? '';
    if (element.__warpTextInstance?.destroy) element.__warpTextInstance.destroy();

    const props = {
      ...DEFAULTS,
      ...options,
      text: String(requestedText)
    };
    props.introDuration = Math.max(1, Number(props.introDuration) || DEFAULTS.introDuration);

    const reducedMotionQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const forcedColorsQuery = window.matchMedia?.('(forced-colors: active)');
    const printQuery = window.matchMedia?.('print');

    if (reducedMotionQuery?.matches) {
      return createFallbackInstance(element, props, 'reduced-motion');
    }
    if (forcedColorsQuery?.matches) {
      return createFallbackInstance(element, props, 'forced-colors');
    }
    if (printQuery?.matches) {
      return createFallbackInstance(element, props, 'print');
    }

    const fallback = document.createElement('span');
    fallback.className = 'warp-name__fallback';
    fallback.textContent = props.text;
    if (props.color) fallback.style.color = props.color;
    if (props.fontSize !== null) fallback.style.fontSize = toCssValue(props.fontSize);
    if (props.fontWeight !== null) fallback.style.fontWeight = String(props.fontWeight);
    if (props.fontFamily !== null) fallback.style.fontFamily = props.fontFamily;
    if (props.letterSpacing !== null) fallback.style.letterSpacing = toCssValue(props.letterSpacing);
    if (props.lineHeight !== null) fallback.style.lineHeight = String(props.lineHeight);

    const canvas = document.createElement('canvas');
    canvas.className = 'warp-name__canvas';
    canvas.setAttribute('aria-hidden', 'true');

    element.replaceChildren(fallback, canvas);
    element.classList.add('warp-name');
    element.classList.remove('is-webgl-ready');
    element.dataset.warpState = 'loading';

    let gl = null;
    let program = null;
    let positionBuffer = null;
    let vertexArray = null;
    let texture = null;
    let resizeObserver = null;
    let intersectionObserver = null;
    let animationFrame = 0;
    let rasterVersion = 0;
    let disposed = false;
    let contextLost = false;
    let intersecting = true;
    let pageVisible = !document.hidden;
    let mediaSuppressed = false;
    let textReady = false;
    let webglReady = false;
    let introProgress = props.intro ? 0 : 1;
    let startTime = performance.now();
    let lastFrameTime = 0;
    let lastInk = '';
    let frameCount = 0;
    let clickSlot = 0;

    const pointer = {
      x: 0.5,
      y: 0.5,
      targetX: 0.5,
      targetY: 0.5,
      active: 0,
      activeTarget: 0
    };
    const clicks = Array.from({ length: MAX_CLICKS }, () => [0.5, 0.5, 0, 0]);
    const clickUniform = new Float32Array(MAX_CLICKS * 4);
    const cleanups = [];
    const uniforms = {};

    const setFallbackState = reason => {
      element.classList.remove('is-webgl-ready');
      element.dataset.warpState = reason;
    };

    const reportFailure = error => {
      setFallbackState('fallback');
      if (error) console.warn('WarpText: usando o texto HTML de fallback.', error);
    };

    try {
      gl = canvas.getContext('webgl2', {
        alpha: true,
        antialias: true,
        depth: false,
        stencil: false,
        premultipliedAlpha: true,
        powerPreference: 'high-performance'
      });
      if (!gl) throw new Error('WebGL2 indisponível neste navegador.');

      program = createProgram(gl);
      positionBuffer = gl.createBuffer();
      vertexArray = gl.createVertexArray();
      texture = gl.createTexture();
      if (!positionBuffer || !vertexArray || !texture) {
        throw new Error('Não foi possível reservar os recursos WebGL.');
      }

      gl.bindVertexArray(vertexArray);
      gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([-1, -1, 3, -1, -1, 3]),
        gl.STATIC_DRAW
      );
      const positionLocation = gl.getAttribLocation(program, 'position');
      if (positionLocation < 0) throw new Error('Atributo de posição não encontrado.');
      gl.enableVertexAttribArray(positionLocation);
      gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
      gl.bindVertexArray(null);

      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        1,
        1,
        0,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        new Uint8Array([0, 0, 0, 0])
      );
      gl.bindTexture(gl.TEXTURE_2D, null);

      [
        'uTextTexture',
        'uResolution',
        'uPointer',
        'uPointerActive',
        'uTime',
        'uWarpStrength',
        'uWarpScale',
        'uSpeed',
        'uPointerInfluence',
        'uPointerStrength',
        'uRefraction',
        'uChromatic',
        'uRipple',
        'uMotion',
        'uLens',
        'uIntro',
        'uReveal',
        'uBackdrop'
      ].forEach(name => {
        uniforms[name] = gl.getUniformLocation(program, name);
      });
      uniforms.uClicks = gl.getUniformLocation(program, 'uClicks[0]');

      gl.useProgram(program);
      gl.uniform1i(uniforms.uTextTexture, 0);
      gl.disable(gl.DEPTH_TEST);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.clearColor(0, 0, 0, 0);
    } catch (error) {
      reportFailure(error);
      if (canvas.parentNode === element) canvas.remove();
      return createFallbackInstance(element, props, 'fallback');
    }

    const syncStaticUniforms = () => {
      if (!gl || !program || contextLost || disposed) return;
      gl.useProgram(program);
      gl.uniform1f(uniforms.uWarpStrength, Number(props.warpStrength) || 0);
      gl.uniform1f(uniforms.uWarpScale, Math.max(Number(props.warpScale) || 0, 0.001));
      gl.uniform1f(uniforms.uSpeed, Number(props.speed) || 0);
      gl.uniform1f(uniforms.uPointerInfluence, Math.max(Number(props.pointerInfluence) || 0, 0.001));
      gl.uniform1f(uniforms.uPointerStrength, Number(props.pointerStrength) || 0);
      gl.uniform1f(uniforms.uRefraction, Number(props.refraction) || 0);
      gl.uniform1f(uniforms.uChromatic, Number(props.chromatic) || 0);
      gl.uniform1f(uniforms.uRipple, props.ripple ? 1 : 0);
      gl.uniform1f(uniforms.uMotion, 1);
      gl.uniform1f(uniforms.uLens, LENS_MODES[props.lens] ?? LENS_MODES.bulge);
    };

    const shouldRun = () => (
      !disposed &&
      !contextLost &&
      !mediaSuppressed &&
      pageVisible &&
      intersecting
    );

    const renderFrame = now => {
      if (!gl || !program || !texture || !vertexArray || contextLost || disposed) return false;

      const elapsed = Math.max(0, now - startTime) / 1000;
      const delta = lastFrameTime ? Math.min(now - lastFrameTime, 50) : 16;
      lastFrameTime = now;
      frameCount += 1;

      if (textReady && introProgress < 1) {
        introProgress = Math.min(1, introProgress + delta / props.introDuration);
      }
      const settle = 1 - introProgress;

      const drift = clamp(Number(props.idleDrift) || 0, 0, 1);
      const isEngaged = pointer.activeTarget > 0;
      const idleX = 0.5 + Math.sin(elapsed * 0.33) * (0.08 + drift * 0.2);
      const idleY = 0.5 + Math.cos(elapsed * 0.27) * (0.06 + drift * 0.2);
      const follow = 1 - Math.exp(-delta / (isEngaged ? 130 : 470));

      pointer.x += ((isEngaged ? pointer.targetX : idleX) - pointer.x) * follow;
      pointer.y += ((isEngaged ? pointer.targetY : idleY) - pointer.y) * follow;
      pointer.active += ((isEngaged ? 1 : drift) - pointer.active) * (1 - Math.exp(-delta / 270));

      clicks.forEach((click, index) => {
        if (click[3] > 0) {
          click[2] += delta / 1000;
          if (click[2] > RIPPLE_LIFE) click[3] = 0;
        }
        clickUniform.set(click, index * 4);
      });

      gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(program);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.uniform2f(uniforms.uResolution, gl.drawingBufferWidth, gl.drawingBufferHeight);
      gl.uniform2f(uniforms.uPointer, pointer.x, pointer.y);
      gl.uniform1f(uniforms.uPointerActive, pointer.active);
      gl.uniform1f(uniforms.uTime, elapsed);
      gl.uniform1f(uniforms.uIntro, settle * settle * settle);
      gl.uniform1f(
        uniforms.uReveal,
        textReady ? smooth(Math.min(1, introProgress / 0.45)) : 0
      );
      gl.uniform4fv(uniforms.uClicks, clickUniform);
      gl.bindVertexArray(vertexArray);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.bindVertexArray(null);

      if (textReady && !webglReady && gl.getError() === gl.NO_ERROR) {
        webglReady = true;
        element.classList.add('is-webgl-ready');
        element.dataset.warpState = 'ready';
      }

      if (textReady && frameCount % 20 === 0) {
        const currentInk = window.getComputedStyle(fallback).color;
        if (currentInk !== lastInk) rasterize();
      }
      return true;
    };

    const loop = now => {
      animationFrame = 0;
      if (!shouldRun()) return;
      renderFrame(now);
      animationFrame = requestAnimationFrame(loop);
    };

    const startLoop = () => {
      if (shouldRun() && !animationFrame) animationFrame = requestAnimationFrame(loop);
    };

    const stopLoop = () => {
      if (animationFrame) cancelAnimationFrame(animationFrame);
      animationFrame = 0;
      lastFrameTime = 0;
    };

    const getStageRect = () => {
      const canvasRect = canvas.getBoundingClientRect();
      if (canvasRect.width > 0 && canvasRect.height > 0) return canvasRect;
      return element.getBoundingClientRect();
    };

    async function rasterize() {
      const version = ++rasterVersion;
      if (document.fonts?.ready) {
        try {
          await document.fonts.ready;
        } catch (error) {
          void error;
        }
      }
      if (disposed || contextLost || version !== rasterVersion) return;

      const rect = getStageRect();
      if (rect.width <= 0 || rect.height <= 0) return;

      const maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE) || 4096;
      const requestedDpr = Math.min(window.devicePixelRatio || 1, 2);
      const safeDpr = Math.min(
        requestedDpr,
        maxTextureSize / Math.max(rect.width, 1),
        maxTextureSize / Math.max(rect.height, 1)
      );
      const dpr = Math.max(1, safeDpr);
      const raster = buildTextCanvas({
        fallback,
        text: props.text,
        width: rect.width,
        height: rect.height,
        dpr,
        props
      });

      if (disposed || contextLost || version !== rasterVersion) return;
      lastInk = window.getComputedStyle(fallback).color;
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        raster.canvas
      );
      gl.uniform1f(uniforms.uBackdrop, getLuminance(raster.ink) < 0.5 ? 1 : 0);
      textReady = true;
      renderFrame(performance.now());
      startLoop();
    }

    const resize = () => {
      if (disposed || contextLost) return;
      const rect = getStageRect();
      if (rect.width <= 0 || rect.height <= 0) return;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.max(1, Math.round(rect.width * dpr));
      const height = Math.max(1, Math.round(rect.height * dpr));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
        gl.viewport(0, 0, width, height);
      }
      rasterize();
    };

    const pointerPosition = event => {
      const rect = getStageRect();
      if (rect.width <= 0 || rect.height <= 0) return null;
      return {
        x: clamp((event.clientX - rect.left) / rect.width, 0, 1),
        y: clamp(1 - (event.clientY - rect.top) / rect.height, 0, 1)
      };
    };

    const onPointerMove = event => {
      if (event.pointerType === 'touch') return;
      const position = pointerPosition(event);
      if (!position) return;
      pointer.targetX = position.x;
      pointer.targetY = position.y;
      pointer.activeTarget = 1;
      startLoop();
    };

    const onPointerLeave = () => {
      pointer.activeTarget = 0;
    };

    const onPointerDown = event => {
      if (!props.clickRipple || mediaSuppressed) return;
      const position = pointerPosition(event);
      if (!position) return;

      const click = clicks[clickSlot];
      clickSlot = (clickSlot + 1) % clicks.length;
      click[0] = position.x;
      click[1] = position.y;
      click[2] = 0;
      click[3] = 1;
      startLoop();
    };

    const onContextLost = event => {
      event.preventDefault();
      contextLost = true;
      stopLoop();
      setFallbackState('context-lost');
    };

    const onContextRestored = () => {
      if (disposed) return;
      const restartOptions = { ...props };
      destroy();
      window.setTimeout(() => {
        if (element.isConnected) createWarpText(element, restartOptions);
      }, 0);
    };

    const onVisibilityChange = () => {
      pageVisible = !document.hidden;
      if (pageVisible) startLoop();
      else stopLoop();
    };

    const syncMediaState = () => {
      mediaSuppressed = Boolean(
        reducedMotionQuery?.matches || forcedColorsQuery?.matches || printQuery?.matches
      );

      if (mediaSuppressed) {
        stopLoop();
        setFallbackState(
          forcedColorsQuery?.matches
            ? 'forced-colors'
            : printQuery?.matches
              ? 'print'
              : 'reduced-motion'
        );
        return;
      }

      if (webglReady) {
        element.classList.add('is-webgl-ready');
        element.dataset.warpState = 'ready';
      }
      startLoop();
    };

    const onFontsLoaded = () => rasterize();

    const update = nextOptions => {
      if (!nextOptions || disposed) return;
      const hasText = Object.hasOwn(nextOptions, 'text');
      Object.assign(props, nextOptions);
      props.introDuration = Math.max(1, Number(props.introDuration) || DEFAULTS.introDuration);

      if (hasText) {
        props.text = String(nextOptions.text || '');
        fallback.textContent = props.text;
      }
      if (Object.hasOwn(nextOptions, 'color')) fallback.style.color = props.color || '';
      if (Object.hasOwn(nextOptions, 'fontSize')) {
        fallback.style.fontSize = props.fontSize === null ? '' : toCssValue(props.fontSize);
      }
      if (Object.hasOwn(nextOptions, 'fontWeight')) {
        fallback.style.fontWeight = props.fontWeight === null ? '' : String(props.fontWeight);
      }
      if (Object.hasOwn(nextOptions, 'fontFamily')) {
        fallback.style.fontFamily = props.fontFamily || '';
      }
      if (Object.hasOwn(nextOptions, 'letterSpacing')) {
        fallback.style.letterSpacing = props.letterSpacing === null
          ? ''
          : toCssValue(props.letterSpacing);
      }
      if (Object.hasOwn(nextOptions, 'lineHeight')) {
        fallback.style.lineHeight = props.lineHeight === null ? '' : String(props.lineHeight);
      }

      syncStaticUniforms();
      rasterize();
    };

    const refresh = () => {
      if (!disposed) resize();
    };

    function destroy() {
      if (disposed) return;
      disposed = true;
      stopLoop();
      cleanups.splice(0).forEach(cleanup => cleanup());
      resizeObserver?.disconnect();
      intersectionObserver?.disconnect();
      rasterVersion += 1;

      if (gl && !contextLost) {
        try {
          if (texture) gl.deleteTexture(texture);
          if (positionBuffer) gl.deleteBuffer(positionBuffer);
          if (vertexArray) gl.deleteVertexArray(vertexArray);
          if (program) gl.deleteProgram(program);
        } catch (error) {
          void error;
        }
      }

      if (element.__warpTextInstance === instance) delete element.__warpTextInstance;
      element.classList.remove('warp-name', 'is-webgl-ready');
      delete element.dataset.warpState;
      element.textContent = props.text;
    }

    const instance = Object.freeze({ destroy, refresh, update });
    element.__warpTextInstance = instance;

    element.addEventListener('pointermove', onPointerMove);
    element.addEventListener('pointerleave', onPointerLeave);
    element.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('webglcontextlost', onContextLost, false);
    canvas.addEventListener('webglcontextrestored', onContextRestored, false);
    document.addEventListener('visibilitychange', onVisibilityChange);
    cleanups.push(
      () => element.removeEventListener('pointermove', onPointerMove),
      () => element.removeEventListener('pointerleave', onPointerLeave),
      () => element.removeEventListener('pointerdown', onPointerDown),
      () => canvas.removeEventListener('webglcontextlost', onContextLost),
      () => canvas.removeEventListener('webglcontextrestored', onContextRestored),
      () => document.removeEventListener('visibilitychange', onVisibilityChange),
      listenToMediaQuery(reducedMotionQuery, syncMediaState),
      listenToMediaQuery(forcedColorsQuery, syncMediaState),
      listenToMediaQuery(printQuery, syncMediaState)
    );

    if (document.fonts?.addEventListener) {
      document.fonts.addEventListener('loadingdone', onFontsLoaded);
      cleanups.push(() => document.fonts.removeEventListener('loadingdone', onFontsLoaded));
    }

    if ('ResizeObserver' in window) {
      resizeObserver = new ResizeObserver(resize);
      resizeObserver.observe(element);
    } else {
      window.addEventListener('resize', resize, { passive: true });
      cleanups.push(() => window.removeEventListener('resize', resize));
    }

    if ('IntersectionObserver' in window) {
      intersectionObserver = new IntersectionObserver(
        ([entry]) => {
          intersecting = Boolean(entry?.isIntersecting);
          if (intersecting) startLoop();
          else stopLoop();
        },
        { threshold: 0 }
      );
      intersectionObserver.observe(element);
    }

    syncStaticUniforms();
    resize();
    startLoop();
    return instance;
  }

  window.createWarpText = createWarpText;
})();
