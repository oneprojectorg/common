'use client';

/* eslint-disable react/no-unknown-property */
import { Loader } from '@react-three/drei';
import { Canvas, RootState, useFrame, useThree } from '@react-three/fiber';
import React, {
  Suspense,
  forwardRef,
  useLayoutEffect,
  useMemo,
  useRef,
} from 'react';
import { Color, Mesh, ShaderMaterial } from 'three';
import { IUniform } from 'three';

type NormalizedRGB = [number, number, number];

const hexToNormalizedRGB = (hex: string): NormalizedRGB => {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  return [r, g, b];
};

interface UniformValue<T = number | Color> {
  value: T;
}

interface SoftBlobsUniforms {
  uSpeed: UniformValue<number>;
  uSoftness: UniformValue<number>;
  uBlobColor: UniformValue<Color>;
  uBackgroundColor: UniformValue<Color>;
  uNoiseIntensity: UniformValue<number>;
  uTime: UniformValue<number>;
  uAspect: UniformValue<number>;
  [uniform: string]: IUniform;
}

const vertexShader = `
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const fragmentShader = `
varying vec2 vUv;

uniform float uTime;
uniform vec3 uBlobColor;
uniform vec3 uBackgroundColor;
uniform float uSpeed;
uniform float uSoftness;
uniform float uAspect;
uniform float uNoiseIntensity;

// 3D Simplex Noise by Nikita Miropolskiy
// https://www.shadertoy.com/view/XsX3zB (MIT License)

vec3 random3(vec3 c) {
    float j = 4096.0*sin(dot(c,vec3(17.0, 59.4, 15.0)));
    vec3 r;
    r.z = fract(512.0*j);
    j *= .125;
    r.x = fract(512.0*j);
    j *= .125;
    r.y = fract(512.0*j);
    return r-0.5;
}

const float F3 = 0.3333333;
const float G3 = 0.1666667;

float simplex3d(vec3 p) {
    vec3 s = floor(p + dot(p, vec3(F3)));
    vec3 x = p - s + dot(s, vec3(G3));

    vec3 e = step(vec3(0.0), x - x.yzx);
    vec3 i1 = e*(1.0 - e.zxy);
    vec3 i2 = 1.0 - e.zxy*(1.0 - e);

    vec3 x1 = x - i1 + G3;
    vec3 x2 = x - i2 + 2.0*G3;
    vec3 x3 = x - 1.0 + 3.0*G3;

    vec4 w, d;

    w.x = dot(x, x);
    w.y = dot(x1, x1);
    w.z = dot(x2, x2);
    w.w = dot(x3, x3);

    w = max(0.6 - w, 0.0);

    d.x = dot(random3(s), x);
    d.y = dot(random3(s + i1), x1);
    d.z = dot(random3(s + i2), x2);
    d.w = dot(random3(s + 1.0), x3);

    w *= w;
    w *= w;
    d *= w;

    return dot(d, vec4(52.0));
}

void main() {
    vec2 uv = vUv;

    // Aspect-corrected UV for distance calculations
    vec2 uvCorrected = vec2(uv.x * uAspect, uv.y);

    // Alternating opacity - 180 degrees out of phase
    float fadeSpeed = uSpeed * 0.5;
    float opacity1 = 0.5 + 0.5 * cos(uTime * fadeSpeed);
    float opacity2 = 0.5 - 0.5 * cos(uTime * fadeSpeed);

    // Scale variation over time - separate X and Y for stretching
    vec2 scale1 = vec2(
        3.0 + 1.0 * sin(uTime * uSpeed * 0.3),
        3.0 + 1.0 * cos(uTime * uSpeed * 0.7)
    );
    vec2 scale2 = vec2(
        3.0 + 1.0 * cos(uTime * uSpeed * 0.6),
        3.0 + 1.0 * sin(uTime * uSpeed * 0.35)
    );

    // Orbital movement - blobs orbit around viewport center, opposite each other
    float angle = uTime * uSpeed * 0.2;
    float orbitX = 0.25;
    float orbitY = 0.2;

    // Wavy modulation on top of orbit
    float waveAmp = .1;
    float waveFreq = .5;
    float wave1X = waveAmp * sin(angle * waveFreq);
    float wave1Y = waveAmp * cos(angle * waveFreq * 0.7);

    // Blob 1
    vec2 blob1Pos = vec2(
        (0.5 + orbitX * cos(angle) + wave1X) * uAspect,
        0.5 + orbitY * sin(angle) + wave1Y
    );
    vec2 diff1 = (uvCorrected - blob1Pos) / (uSoftness * scale1);
    float dist1 = length(diff1);
    float linear1 = clamp(1.0 - dist1, 0.1, 1.0);
    float blob1 = pow(linear1, 2.0) * opacity1;

    // Blob 2 - opposite side of orbit (π offset) with opposite wave
    vec2 blob2Pos = vec2(
        (0.5 - orbitX * cos(angle) - wave1X) * uAspect,
        0.5 - orbitY * sin(angle) - wave1Y
    );
    vec2 diff2 = (uvCorrected - blob2Pos) / (uSoftness * scale2);
    float dist2 = length(diff2);
    float linear2 = clamp(1.0 - dist2, 0.1, 1.0);
    float blob2 = pow(linear2, 2.0) * opacity2;

    // Combine - blobs add together softly
    float blobMask = clamp(blob1 + blob2, 0.1, 1.0);
    vec3 animatedColor = mix(uBackgroundColor, uBlobColor, blobMask);

    // Fade in from solid blobColor over ~3 seconds
    float fadeIn = smoothstep(0.0, 2.0, uTime);
    vec3 color = mix(uBlobColor, animatedColor, fadeIn);

    // Film grain - 3D simplex noise with time for animation
    vec3 noiseCoord = vec3(gl_FragCoord.xy * 0.5, uTime * 0.5);
    float grain = simplex3d(noiseCoord);
    grain = 0.5 + 0.5 * grain; // remap from [-1,1] to [0,1]
    color -= grain * 0.1 * uNoiseIntensity;

    gl_FragColor = vec4(color, 1.0);
}
`;

interface SoftBlobsPlaneProps {
  uniforms: SoftBlobsUniforms;
}

const SoftBlobsPlane = forwardRef<Mesh, SoftBlobsPlaneProps>(
  function SoftBlobsPlane({ uniforms }, ref) {
    const { viewport } = useThree();

    useLayoutEffect(() => {
      const mesh = ref as React.RefObject<Mesh | null>;
      if (mesh.current) {
        mesh.current.scale.set(viewport.width, viewport.height, 1);
        const material = mesh.current.material as ShaderMaterial & {
          uniforms: SoftBlobsUniforms;
        };
        material.uniforms.uAspect.value = viewport.width / viewport.height;
      }
    }, [ref, viewport]);

    useFrame((_state: RootState, delta: number) => {
      const mesh = ref as React.RefObject<Mesh | null>;
      if (mesh.current) {
        const material = mesh.current.material as ShaderMaterial & {
          uniforms: SoftBlobsUniforms;
        };
        material.uniforms.uTime.value += delta;
      }
    });

    return (
      <mesh ref={ref}>
        <planeGeometry args={[1, 1, 1, 1]} />
        <shaderMaterial
          uniforms={uniforms}
          vertexShader={vertexShader}
          fragmentShader={fragmentShader}
        />
      </mesh>
    );
  },
);
SoftBlobsPlane.displayName = 'SoftBlobsPlane';

export interface SoftBlobsProps {
  speed?: number;
  softness?: number;
  blobColor?: string;
  backgroundColor?: string;
  noiseIntensity?: number;
}

const SoftBlobs: React.FC<SoftBlobsProps> = ({
  speed = 1,
  softness = 0.75,
  blobColor = '#6200C3',
  backgroundColor = '#FF613D',
  noiseIntensity = 1,
}) => {
  const meshRef = useRef<Mesh>(null);

  const uniforms = useMemo<SoftBlobsUniforms>(
    () => ({
      uSpeed: { value: speed },
      uSoftness: { value: softness },
      uBlobColor: { value: new Color(...hexToNormalizedRGB(blobColor)) },
      uBackgroundColor: {
        value: new Color(...hexToNormalizedRGB(backgroundColor)),
      },
      uNoiseIntensity: { value: noiseIntensity },
      uTime: { value: 0 },
      uAspect: { value: 1 },
    }),
    [speed, softness, blobColor, backgroundColor, noiseIntensity],
  );

  return (
    <>
      <Canvas
        dpr={[1, 1.5]}
        frameloop="always"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          width: '100vw',
          height: '100vh',
          minHeight: '-webkit-fill-available',
        }}
      >
        <Suspense fallback={null}>
          <SoftBlobsPlane ref={meshRef} uniforms={uniforms} />
        </Suspense>
      </Canvas>
      <Loader />
    </>
  );
};

export { SoftBlobs };
