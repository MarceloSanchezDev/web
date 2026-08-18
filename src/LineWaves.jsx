import { Mesh, Program, Renderer, Triangle } from 'ogl';
import { useEffect, useRef } from 'react';

const vertex = `
attribute vec2 uv;
attribute vec2 position;
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position, 0.0, 1.0); }
`;

const fragment = `
precision highp float;
uniform float uTime;
uniform vec2 uResolution;
uniform float uSpeed;
uniform float uBrightness;
uniform vec3 uColor;

mat2 rotate2d(float a) { return mat2(cos(a), -sin(a), sin(a), cos(a)); }

void main() {
  vec2 p = (gl_FragCoord.xy / uResolution.xy) * 2.0 - 1.0;
  p.x *= uResolution.x / uResolution.y;
  p = rotate2d(-0.78) * p;
  float t = uTime * uSpeed;
  float warp = sin(p.x * 2.0 + t) * .11 + sin(p.x * 5.0 - t * .7) * .045;
  float waves = sin((p.y + warp) * 42.0 + sin(p.x * 3.0 + t) * 2.0);
  float lines = smoothstep(.88, .99, waves);
  float edge = smoothstep(1.35, .12, length(p));
  float shimmer = .68 + sin(p.x * 2.5 + t * .6) * .32;
  gl_FragColor = vec4(uColor * lines * edge * shimmer * uBrightness, lines * edge * uBrightness);
}
`;

function hexToVec3(hex) {
  const value = hex.replace('#', '');
  return [parseInt(value.slice(0, 2), 16) / 255, parseInt(value.slice(2, 4), 16) / 255, parseInt(value.slice(4, 6), 16) / 255];
}

/** Lightweight OGL adaptation of React Bits' Line Waves background. */
export default function LineWaves({ speed = .22, brightness = .16, color = '#9fb4ff' }) {
  const ref = useRef(null);

  useEffect(() => {
    const container = ref.current;
    if (!container || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const renderer = new Renderer({ alpha: true, dpr: Math.min(window.devicePixelRatio, 1.5) });
    const gl = renderer.gl;
    gl.clearColor(0, 0, 0, 0);
    const program = new Program(gl, { vertex, fragment, uniforms: { uTime: { value: 0 }, uResolution: { value: [1, 1] }, uSpeed: { value: speed }, uBrightness: { value: brightness }, uColor: { value: hexToVec3(color) } } });
    const mesh = new Mesh(gl, { geometry: new Triangle(gl), program });
    container.appendChild(gl.canvas);
    const resize = () => { renderer.setSize(container.offsetWidth, container.offsetHeight); program.uniforms.uResolution.value = [gl.canvas.width, gl.canvas.height]; };
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    resize();
    let frame;
    const render = time => { program.uniforms.uTime.value = time * .001; renderer.render({ scene: mesh }); frame = requestAnimationFrame(render); };
    frame = requestAnimationFrame(render);
    return () => { cancelAnimationFrame(frame); observer.disconnect(); gl.canvas.remove(); gl.getExtension('WEBGL_lose_context')?.loseContext(); };
  }, [speed, brightness, color]);

  return <div ref={ref} className="line-waves-container" aria-hidden="true" />;
}
