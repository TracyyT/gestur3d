import { AdditiveBlending, Color, DoubleSide, ShaderMaterial } from 'three';
import { palette } from '@/ui/theme';

export interface HoloMaterialOptions {
  color?: string;
  rimColor?: string;
  opacity?: number;
  /** Higher = thinner rim. */
  fresnelPower?: number;
  /** Scanline bands per world unit. 0 disables scanlines. */
  scanDensity?: number;
}

const vertexShader = /* glsl */ `
  varying vec3 vNormalV;
  varying vec3 vViewDir;
  varying float vWorldY;

  void main() {
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vec4 viewPos = viewMatrix * worldPos;
    vNormalV = normalize(normalMatrix * normal);
    vViewDir = normalize(-viewPos.xyz);
    vWorldY = worldPos.y;
    gl_Position = projectionMatrix * viewPos;
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 uColor;
  uniform vec3 uRimColor;
  uniform float uOpacity;
  uniform float uFresnelPower;
  uniform float uScanDensity;
  uniform float uTime;
  uniform float uHighlight;

  varying vec3 vNormalV;
  varying vec3 vViewDir;
  varying float vWorldY;

  void main() {
    vec3 n = normalize(vNormalV);
    if (!gl_FrontFacing) n = -n;
    float fresnel = pow(1.0 - clamp(dot(n, vViewDir), 0.0, 1.0), uFresnelPower);

    float scan = uScanDensity > 0.0
      ? smoothstep(0.55, 1.0, 0.5 + 0.5 * sin(vWorldY * uScanDensity * 6.2831 - uTime * 1.6))
      : 0.0;

    vec3 color = mix(uColor, uRimColor, fresnel);
    color *= 1.0 + uHighlight * 0.8;
    float alpha = (0.02 + fresnel * 0.9 + scan * 0.05) * uOpacity;
    gl_FragColor = vec4(color * (0.35 + fresnel * 1.25), alpha);
  }
`;

/**
 * Holographic shell: fresnel rim light, soft scanlines, additive blending.
 * Shared by the landing hero and workspace objects. Animate via uniforms.uTime.
 */
export function createHoloMaterial({
  color = palette.cyan,
  rimColor = palette.violet,
  opacity = 1,
  fresnelPower = 2.2,
  scanDensity = 3,
}: HoloMaterialOptions = {}) {
  return new ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      uColor: { value: new Color(color) },
      uRimColor: { value: new Color(rimColor) },
      uOpacity: { value: opacity },
      uFresnelPower: { value: fresnelPower },
      uScanDensity: { value: scanDensity },
      uTime: { value: 0 },
      uHighlight: { value: 0 },
    },
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
    blending: AdditiveBlending,
    toneMapped: false,
  });
}
