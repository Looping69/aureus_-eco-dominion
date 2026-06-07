
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import * as THREE from 'three';

// Global shared clipping plane removed - surface only architecture

// --- Procedural Textures ---

type TextureFilterMode = 'pixel' | 'smooth';

function finalizeCanvasTexture(canvas: HTMLCanvasElement, filterMode: TextureFilterMode = 'pixel'): THREE.Texture {
  const tex = new THREE.CanvasTexture(canvas);
  if (filterMode === 'smooth') {
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.generateMipmaps = true;
  } else {
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
  }
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function createNoiseTexture(
  width: number,
  height: number,
  colorHex: number,
  grainScale: number = 20,
  filterMode: TextureFilterMode = 'pixel'
): THREE.Texture {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#' + new THREE.Color(colorHex).getHexString();
  ctx.fillRect(0, 0, width, height);
  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;
  for (let i = 0; i < data.length; i += 4) {
    const grain = (Math.random() - 0.5) * grainScale;
    data[i] = Math.max(0, Math.min(255, data[i] + grain));
    data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + grain));
    data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + grain));
  }
  ctx.putImageData(imgData, 0, 0);
  return finalizeCanvasTexture(canvas, filterMode);
}

function varyChannel(channel: number, amount: number) {
  return Math.max(0, Math.min(255, channel + amount));
}

function paintSoftBlob(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  colorHex: number,
  alpha: number,
  minRadius: number,
  maxRadius: number
) {
  const x = Math.random() * width;
  const y = Math.random() * height;
  const radius = minRadius + Math.random() * Math.max(0.01, maxRadius - minRadius);
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
  const color = new THREE.Color(colorHex);
  const r = Math.round(color.r * 255);
  const g = Math.round(color.g * 255);
  const b = Math.round(color.b * 255);
  gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${alpha})`);
  gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
}

function paintSoftSpeckles(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  colors: number[],
  count: number,
  minRadius: number,
  maxRadius: number,
  alphaMin: number,
  alphaMax: number
) {
  for (let i = 0; i < count; i++) {
    const colorHex = colors[i % colors.length];
    paintSoftBlob(
      ctx,
      width,
      height,
      colorHex,
      alphaMin + Math.random() * Math.max(0.001, alphaMax - alphaMin),
      minRadius,
      maxRadius
    );
  }
}

function createLayeredTerrainTexture(
  width: number,
  height: number,
  baseHex: number,
  detailHexes: number[],
  grainScale: number,
  filterMode: TextureFilterMode = 'smooth'
): THREE.Texture {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#' + new THREE.Color(baseHex).getHexString();
  ctx.fillRect(0, 0, width, height);

  for (let i = 0; i < 48; i++) {
    const detailHex = detailHexes[i % detailHexes.length];
    paintSoftBlob(ctx, width, height, detailHex, 0.04 + Math.random() * 0.06, width * 0.04, width * 0.18);
  }

  // Keep the breakup non-directional. Thin stroke overlays shimmer badly when
  // repeated across large surfaces and were the source of the moving ground lines.
  paintSoftSpeckles(
    ctx,
    width,
    height,
    detailHexes,
    32,
    width * 0.014,
    width * 0.036,
    0.018,
    0.038
  );

  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;
  for (let i = 0; i < data.length; i += 4) {
    const grain = (Math.random() - 0.5) * grainScale;
    const secondary = (Math.random() - 0.5) * grainScale * 0.45;
    data[i] = varyChannel(data[i], grain);
    data[i + 1] = varyChannel(data[i + 1], secondary);
    data[i + 2] = varyChannel(data[i + 2], grain * 0.6);
  }
  ctx.putImageData(imgData, 0, 0);

  return finalizeCanvasTexture(canvas, filterMode);
}

function createTerrainSurfaceMaterial(): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.98,
    vertexColors: true,
    side: THREE.DoubleSide,
    clipShadows: true
  });

  mat.customProgramCacheKey = () => 'aureus-designed-terrain-textures-v2';
  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = `
      varying vec3 vWorldPos;
      varying vec3 vBaseColor;
      varying vec3 vTerrainNormal;
      ${shader.vertexShader}
    `
      .replace(
        '#include <color_vertex>',
        `
        #include <color_vertex>
        vBaseColor = color.xyz;
        `
      )
      .replace(
        '#include <beginnormal_vertex>',
        `
        #include <beginnormal_vertex>
        vTerrainNormal = normalize(normalMatrix * objectNormal);
        `
      )
      .replace(
        '#include <begin_vertex>',
        `
        #include <begin_vertex>
        vec4 terrainWorldPosition = modelMatrix * vec4(transformed, 1.0);
        vWorldPos = terrainWorldPosition.xyz;
        `
      );

    shader.fragmentShader = `
      varying vec3 vWorldPos;
      varying vec3 vBaseColor;
      varying vec3 vTerrainNormal;

      float terrainHash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
      }

      float terrainNoise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        float a = terrainHash(i);
        float b = terrainHash(i + vec2(1.0, 0.0));
        float c = terrainHash(i + vec2(0.0, 1.0));
        float d = terrainHash(i + vec2(1.0, 1.0));
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
      }

      float terrainRidge(vec2 p) {
        float n = terrainNoise(p);
        return 1.0 - abs(n * 2.0 - 1.0);
      }

      float terrainFleck(vec2 p, float threshold) {
        return smoothstep(threshold, 1.0, terrainHash(floor(p)));
      }

      ${shader.fragmentShader}
    `.replace(
      '#include <color_fragment>',
      `
      #include <color_fragment>

      vec2 terrainUv = vWorldPos.xz;
      float broadNoise = terrainNoise(terrainUv * 0.075);
      float fineNoise = terrainNoise(terrainUv * 0.44);
      float pebbleNoise = terrainNoise(terrainUv * 1.18);
      float topFace = smoothstep(0.38, 0.72, vTerrainNormal.y);

      float grassMask = smoothstep(0.30, 0.58, vBaseColor.g) * (1.0 - smoothstep(0.50, 0.74, vBaseColor.r));
      float sandMask = smoothstep(0.58, 0.82, vBaseColor.r) * smoothstep(0.46, 0.74, vBaseColor.g) * (1.0 - smoothstep(0.40, 0.55, vBaseColor.b));
      float dirtMask = smoothstep(0.26, 0.50, vBaseColor.r) * (1.0 - smoothstep(0.36, 0.54, vBaseColor.g));
      float stoneMask = clamp(1.0 - max(grassMask, max(sandMask, dirtMask)), 0.0, 1.0);

      vec3 albedo = diffuseColor.rgb;

      float grassBlade = smoothstep(0.56, 0.86, terrainRidge(vec2(terrainUv.x * 2.4 + fineNoise * 1.7, terrainUv.y * 8.4)));
      float grassThatch = smoothstep(0.46, 0.78, terrainNoise(terrainUv * 2.6 + vec2(3.2, 7.1)));
      float grassWildflower = terrainFleck(terrainUv * 3.8, 0.965) * topFace;
      vec3 grassTint = mix(vec3(0.82, 0.94, 0.66), vec3(1.05, 1.10, 0.82), grassBlade * 0.55 + grassThatch * 0.25);
      grassTint *= 0.88 + broadNoise * 0.18;
      grassTint = mix(grassTint, vec3(1.14, 1.05, 0.72), grassWildflower * 0.18);

      float dune = sin((terrainUv.x * 0.64) + (broadNoise * 2.8) + terrainUv.y * 0.12) * 0.5 + 0.5;
      float sandGrain = smoothstep(0.62, 0.96, pebbleNoise) * topFace;
      float shellFleck = terrainFleck(terrainUv * 4.2 + vec2(11.0, 2.0), 0.955) * topFace;
      vec3 sandTint = vec3(1.05, 1.00, 0.86);
      sandTint *= 0.92 + dune * 0.10 + sandGrain * 0.05;
      sandTint = mix(sandTint, vec3(1.16, 1.08, 0.88), shellFleck * 0.20);

      float dirtClump = smoothstep(0.42, 0.78, terrainNoise(terrainUv * 1.75 + vec2(4.0, 1.5)));
      float rootFiber = smoothstep(0.63, 0.90, terrainRidge(vec2(terrainUv.x * 5.5, terrainUv.y * 1.2 + broadNoise * 2.0)));
      vec3 dirtTint = vec3(0.96, 0.86, 0.74);
      dirtTint *= 0.84 + dirtClump * 0.18;
      dirtTint = mix(dirtTint, vec3(0.78, 0.62, 0.48), rootFiber * 0.18 * topFace);

      float stonePlate = smoothstep(0.32, 0.74, terrainNoise(terrainUv * 0.82 + vec2(5.0, 9.0)));
      float stoneCrack = smoothstep(0.80, 0.94, terrainRidge(terrainUv * 1.35 + vec2(fineNoise * 1.8, broadNoise * 1.4))) * topFace;
      float mineralFleck = terrainFleck(terrainUv * 5.0 + vec2(17.0, 13.0), 0.94) * topFace;
      vec3 stoneTint = mix(vec3(0.86, 0.90, 0.88), vec3(1.06, 1.08, 1.03), stonePlate);
      stoneTint *= 0.82 + broadNoise * 0.20;
      stoneTint = mix(stoneTint, vec3(0.50, 0.55, 0.55), stoneCrack * 0.30);
      stoneTint = mix(stoneTint, vec3(1.12, 1.10, 0.95), mineralFleck * 0.12);

      albedo *= mix(vec3(1.0), grassTint, grassMask);
      albedo *= mix(vec3(1.0), sandTint, sandMask);
      albedo *= mix(vec3(1.0), dirtTint, dirtMask);
      albedo *= mix(vec3(1.0), stoneTint, stoneMask);
      albedo = mix(albedo, vBaseColor, 0.12);

      diffuseColor.rgb = clamp(albedo, vec3(0.0), vec3(1.0));
      `
    );
  };

  return mat;
}

function createFoliageInstancedMaterial(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: 0xf4f7ed,
    vertexColors: true,
    roughness: 0.86,
    metalness: 0.0,
    emissive: 0x142414,
    emissiveIntensity: 0.08,
    side: THREE.DoubleSide,
    clipShadows: true,
  });
}

// Universal terrain texture for chunk solids: neutral, layered, and mip-smoothed.
const texMaster = createLayeredTerrainTexture(128, 128, 0xa8aaa0, [0xd4d2c2, 0x777d70, 0xb8b7a8], 12);
const texConcrete = createLayeredTerrainTexture(96, 96, 0x939aa2, [0xc4c9cf, 0x747c83, 0xa5adb4], 12);
const texMetal = createLayeredTerrainTexture(96, 96, 0x626f7d, [0x9aa5b0, 0x4b5660, 0x74808a], 14);
const texWood = createLayeredTerrainTexture(96, 96, 0x7b5534, [0xa17049, 0x5e3d24, 0x8d6543], 14);
const texSand = createLayeredTerrainTexture(128, 128, 0xcbb681, [0xe0d0a0, 0xa99263, 0xd0bc8c], 10);
const texGrass = createLayeredTerrainTexture(128, 128, 0x6d8a45, [0x8ea85d, 0x526b37, 0x7e9852], 12);
const texRock = createLayeredTerrainTexture(128, 128, 0x68706f, [0x8f9794, 0x4c5554, 0x747d7b], 14);
const texAsphalt = createLayeredTerrainTexture(128, 128, 0x343b42, [0x535d66, 0x272d33, 0x444d55], 10);
const texDirt = createLayeredTerrainTexture(128, 128, 0x684b32, [0x8a6846, 0x4c3422, 0x76583a], 12);
const texPine = createLayeredTerrainTexture(96, 96, 0x253a22, [0x395836, 0x1b2918, 0x2f472d], 12);
const texDriedGrass = createLayeredTerrainTexture(96, 96, 0xa89468, [0xc3b080, 0x7f704e, 0xb29f70], 10);
const texSavanna = createLayeredTerrainTexture(96, 96, 0x606f3d, [0x7f8f55, 0x46532d, 0x6e7d48], 10);
const texSandWet = createLayeredTerrainTexture(96, 96, 0xbca879, [0xd0bd8e, 0x9a865e, 0xc2aa78], 8);

function createWaterMaterial(baseColorHex: number, foamColorHex: number): THREE.ShaderMaterial {
    const mat = new THREE.MeshStandardMaterial({
        color: baseColorHex,
        transparent: true,
        opacity: 0.74,
        roughness: 0.22,
        metalness: 0.08,
        side: THREE.FrontSide,
        depthWrite: false
    }) as unknown as THREE.ShaderMaterial;

    const uniforms = {
        time: { value: 0 },
        waterColor: { value: new THREE.Color(baseColorHex) },
        foamColor: { value: new THREE.Color(foamColorHex) }
    };
    (mat as any).uniforms = uniforms;

    mat.onBeforeCompile = (shader) => {
        shader.uniforms.time = uniforms.time;
        shader.uniforms.waterColor = uniforms.waterColor;
        shader.uniforms.foamColor = uniforms.foamColor;

        shader.vertexShader = `
            uniform float time;
            varying vec3 vWorldPos;
            varying float vWaveHeight;
            ${shader.vertexShader}
        `.replace(
            `#include <begin_vertex>`,
            `
            vec3 transformed = vec3(position);
            
            #ifdef USE_INSTANCING
              vec4 myWorldPosition = instanceMatrix * vec4(transformed, 1.0);
            #else
              vec4 myWorldPosition = modelMatrix * vec4(transformed, 1.0);
            #endif

            #ifdef USE_INSTANCING
               myWorldPosition = modelMatrix * myWorldPosition;
            #endif

            float topFaceWaveMask = step(0.55, normal.y);
            float wave1 = sin(myWorldPosition.x * 1.5 + time * 1.2) * 0.045;
            float wave2 = cos(myWorldPosition.z * 1.2 + time * 1.5) * 0.045;
            float wave3 = sin((myWorldPosition.x * 0.8 + myWorldPosition.z * 0.5) - time) * 0.03;
            
            float height = (wave1 + wave2 + wave3) * topFaceWaveMask;
            transformed.y += height;

            vWorldPos = myWorldPosition.xyz + vec3(0.0, height, 0.0);
            vWaveHeight = height;
            `
        ).replace(
            `#include <beginnormal_vertex>`,
            `
            vec3 objectNormal = vec3(normal);
            
            float dHx = 1.5 * 0.045 * cos(vWorldPos.x * 1.5 + time * 1.2) + 0.8 * 0.03 * cos((vWorldPos.x * 0.8 + vWorldPos.z * 0.5) - time);
            float dHz = 1.2 * 0.045 * -sin(vWorldPos.z * 1.2 + time * 1.5) + 0.5 * 0.03 * cos((vWorldPos.x * 0.8 + vWorldPos.z * 0.5) - time);
            
            if (normal.y > 0.55) {
                vec3 modifiedNormal = normalize(vec3(-dHx, 1.0, -dHz));
                objectNormal = modifiedNormal;
            }
            `
        );

        shader.fragmentShader = `
            uniform float time;
            uniform vec3 waterColor;
            uniform vec3 foamColor;
            varying vec3 vWorldPos;
            varying float vWaveHeight;
            ${shader.fragmentShader}
        `.replace(
            `#include <color_fragment>`,
            `
            #include <color_fragment>
            
            float pattern = sin((vWorldPos.x + vWorldPos.z) * 3.0 - time * 1.3) * 0.5 + 0.5;
            pattern += sin((vWorldPos.x - vWorldPos.z) * 1.4 + time * 0.8) * 0.14;
            
            float wavePeak = smoothstep(0.0, 0.1, vWaveHeight); 
            float foam = smoothstep(0.92, 1.0, pattern) * wavePeak * 0.65;
            
            vec3 finalMix = mix(waterColor, foamColor, foam);
            diffuseColor.rgb = finalMix;
            `
        );
    };

    return mat;
}

export const waterFlowMaterial = createWaterMaterial(0x2f8fa3, 0xb9dde2);

export const bioLumeMaterial = new THREE.ShaderMaterial({
  uniforms: {
    time: { value: 0 },
    color: { value: new THREE.Color(0x2f9faf) },
    glowColor: { value: new THREE.Color(0x7dd3d8) }
  },
  vertexShader: `
        varying vec3 vWorldPosition;
        varying vec3 vNormal;
        void main() {
            vNormal = normalize(normalMatrix * normal);
            vec4 worldPosition = modelMatrix * vec4(position, 1.0);
            vWorldPosition = worldPosition.xyz;
            gl_Position = projectionMatrix * viewMatrix * worldPosition;
        }
    `,
  fragmentShader: `
        uniform float time;
        uniform vec3 color;
        uniform vec3 glowColor;
        varying vec3 vWorldPosition;
        varying vec3 vNormal;
        void main() {
            float pulse = (sin(time * 2.0 + vWorldPosition.x * 0.5 + vWorldPosition.z * 0.5) * 0.5 + 0.5);
            vec3 finalColor = mix(color, glowColor, pulse);
            // Fresnel-like effect for soft edges
            float fresnel = pow(1.0 - max(0.0, vNormal.z), 2.0);
            gl_FragColor = vec4(finalColor, 0.72 + fresnel * 0.18);
        }
    `,
  transparent: true,
  side: THREE.DoubleSide
});

// Murky/Oil water material for unpowered reservoirs or industrial waste
export const oilWaterMaterial = createWaterMaterial(0x24384a, 0x41515c);

// Deep turquoise water for reservoirs and basins
export const reservoirWaterMaterial = createWaterMaterial(0x2d7888, 0x7fc2cc);

// Shared terrain material, but with biome-aware breakup so grass, sand, dirt,
// and stone no longer read like the same grey texture with different tinting.
export const terrainSurfaceMaterial = createTerrainSurfaceMaterial();
export const foliageInstancedMaterial = createFoliageInstancedMaterial();
export const matMaster = terrainSurfaceMaterial;

// Base Materials (Still used for specific Buildings/UI/Particles)
export const mats: Record<string, THREE.Material> = {
  concrete: new THREE.MeshStandardMaterial({ map: texConcrete, roughness: 0.88 }),
  metal: new THREE.MeshStandardMaterial({ map: texMetal, metalness: 0.42, roughness: 0.42 }),
  metalLight: new THREE.MeshStandardMaterial({ map: texConcrete, metalness: 0.32, roughness: 0.48 }),
  blueMetal: new THREE.MeshStandardMaterial({ map: texMetal, color: 0x5f89b9, metalness: 0.35, roughness: 0.48 }),
  greenMetal: new THREE.MeshStandardMaterial({ color: 0x3f8f62, metalness: 0.28, roughness: 0.56 }),
  darkPipe: new THREE.MeshStandardMaterial({ color: 0x2f3a40, metalness: 0.35, roughness: 0.55 }),
  solar: new THREE.MeshStandardMaterial({ color: 0x263f66, metalness: 0.65, roughness: 0.28, emissive: 0x172944, emissiveIntensity: 0.16 }),
  wood: new THREE.MeshStandardMaterial({ map: texWood, roughness: 0.82 }),
  leaf: new THREE.MeshStandardMaterial({ color: 0x2f7a3b, roughness: 0.86, emissive: 0x0f220f, emissiveIntensity: 0.06 }),
  leafDark: new THREE.MeshStandardMaterial({ color: 0x183c25, roughness: 0.9, emissive: 0x0c1a0f, emissiveIntensity: 0.08 }),
  sand: new THREE.MeshStandardMaterial({ map: texSand, color: 0xd0bc83, roughness: 0.92 }),
  grass: new THREE.MeshStandardMaterial({ map: texGrass, color: 0x739455, roughness: 1.0 }),
  pine: new THREE.MeshStandardMaterial({ map: texPine, color: 0x284b2d, roughness: 0.92, emissive: 0x0b1d0e, emissiveIntensity: 0.08 }),
  water: new THREE.MeshStandardMaterial({ color: 0x2f8fa3, transparent: true, opacity: 0.74, roughness: 0.22, side: THREE.FrontSide, depthWrite: false }),
  brick: new THREE.MeshStandardMaterial({ map: createNoiseTexture(64, 64, 0x9f2b24, 28, 'smooth'), roughness: 0.9 }),
  white: new THREE.MeshStandardMaterial({ map: createNoiseTexture(128, 128, 0xe8e5d8, 24, 'smooth'), roughness: 0.55 }),
  concreteLight: new THREE.MeshStandardMaterial({ map: createNoiseTexture(128, 128, 0xd3d7d2, 26, 'smooth'), roughness: 0.78 }),
  ghost: new THREE.MeshStandardMaterial({ color: 0x64748b, transparent: true, opacity: 0.3, depthWrite: false, side: THREE.DoubleSide }),
  gold: new THREE.MeshStandardMaterial({ map: createNoiseTexture(64, 64, 0xd9ad35, 8), color: 0xd9ad35, metalness: 0.7, roughness: 0.18, emissive: 0x9a6f12, emissiveIntensity: 0.22 }),
  glass: new THREE.MeshStandardMaterial({ color: 0x9ecfd6, transparent: true, opacity: 0.36, metalness: 0.45, roughness: 0.04 }),
  hazard: new THREE.MeshStandardMaterial({ map: createNoiseTexture(64, 64, 0xd6b73d), color: 0xd6b73d, roughness: 0.55 }),
  cactus: new THREE.MeshStandardMaterial({ map: createNoiseTexture(64, 64, 0x5f8f45, 18), color: 0x5f8f45, roughness: 0.84 }),
  cactusFlower: new THREE.MeshStandardMaterial({ color: 0xc75a8a, emissive: 0x8d315e, emissiveIntensity: 0.18 }),
  driedGrass: new THREE.MeshStandardMaterial({ map: texDriedGrass, color: 0xa89468, roughness: 1.0 }),
  savannaGreen: new THREE.MeshStandardMaterial({ map: texSavanna, color: 0x627445, roughness: 0.92 }),
  rock: new THREE.MeshStandardMaterial({ map: texRock, color: 0x68706f, roughness: 0.92 }),
  stone: new THREE.MeshStandardMaterial({ map: texRock, color: 0x868b87, roughness: 0.96 }),
  tarp: new THREE.MeshStandardMaterial({ map: createNoiseTexture(64, 64, 0x7f2525, 14), roughness: 0.9, side: THREE.DoubleSide }),
  asphalt: new THREE.MeshStandardMaterial({ map: texAsphalt, roughness: 0.94 }),
  dirt: new THREE.MeshStandardMaterial({ map: texDirt, roughness: 1.0 }),
  progressGreen: new THREE.MeshStandardMaterial({ map: texGrass, color: 0x668a50, roughness: 0.96 }),
  emissiveOrange: new THREE.MeshStandardMaterial({ color: 0xd8833e, emissive: 0xd8833e, emissiveIntensity: 1.1 }),
  emissiveRed: new THREE.MeshStandardMaterial({ color: 0xcf4444, emissive: 0xcf4444, emissiveIntensity: 1.35 }),
  emissiveCyan: new THREE.MeshStandardMaterial({ color: 0x57b7c4, emissive: 0x57b7c4, emissiveIntensity: 0.75 }),
  emissiveGreen: new THREE.MeshStandardMaterial({ color: 0x55b66f, emissive: 0x55b66f, emissiveIntensity: 1.2 }),
  pit: new THREE.MeshStandardMaterial({ color: 0x20201d, roughness: 1.0 }),

  // Specific Tree Mats
  birchWood: new THREE.MeshStandardMaterial({ map: createNoiseTexture(64, 64, 0xd9d2bd, 14), roughness: 0.9 }),
  birchLeaf: new THREE.MeshStandardMaterial({ color: 0x7f9b35, roughness: 0.84, emissive: 0x1a260c, emissiveIntensity: 0.05 }),
  willowLeaf: new THREE.MeshStandardMaterial({ map: createNoiseTexture(64, 64, 0x425b25, 20), roughness: 0.84, emissive: 0x0f1a09, emissiveIntensity: 0.06 }),
  appleFruit: new THREE.MeshStandardMaterial({ color: 0xb8453f, roughness: 0.5 }),
  snowLeaf: new THREE.MeshStandardMaterial({ map: createNoiseTexture(64, 64, 0xe9ece2, 8), roughness: 0.7 }),
  palmTrunk: new THREE.MeshStandardMaterial({ map: createNoiseTexture(64, 64, 0x8f6c37, 24), color: 0x8f6c37, roughness: 0.82 }),
  palmLeaf: new THREE.MeshStandardMaterial({ color: 0x557a2f, roughness: 0.84, emissive: 0x102008, emissiveIntensity: 0.05 }),
  deadWood: new THREE.MeshStandardMaterial({ map: createNoiseTexture(64, 64, 0x4f4b45, 26), color: 0x4f4b45, roughness: 1.0 }),
  deadWoodLight: new THREE.MeshStandardMaterial({ map: createNoiseTexture(64, 64, 0x68665d, 18), color: 0x68665d, roughness: 1.0 }),
  mushroomStem: new THREE.MeshStandardMaterial({ color: 0xe4dccb, roughness: 0.9 }),
  mushroomCap: new THREE.MeshStandardMaterial({ map: createNoiseTexture(64, 64, 0xa9443f, 8), color: 0xa9443f, roughness: 0.74 }),
  bone: new THREE.MeshStandardMaterial({ map: createNoiseTexture(64, 64, 0xd6d1c3, 4), roughness: 0.65 }),
  flowerPurple: new THREE.MeshStandardMaterial({ color: 0x9860b8, emissive: 0x4b235f, emissiveIntensity: 0.14 }),
  flowerYellow: new THREE.MeshStandardMaterial({ color: 0xd8b83b, emissive: 0x6f5512, emissiveIntensity: 0.12 }),
  crystalCyan: new THREE.MeshStandardMaterial({ color: 0x4daeb8, metalness: 0.58, roughness: 0.18, emissive: 0x2f8f99, emissiveIntensity: 0.28 }),
  sandStone: new THREE.MeshStandardMaterial({ color: 0xb87b35, roughness: 1.0 }),

  // New Water System Mats
  sandWet: new THREE.MeshStandardMaterial({ map: texSandWet, roughness: 0.7 }),
  waterDeep: new THREE.MeshStandardMaterial({ color: 0x2c7585, transparent: true, opacity: 0.78, roughness: 0.24, side: THREE.FrontSide, depthWrite: false }),
  waterSurface: waterFlowMaterial,
  waterMaterial: waterFlowMaterial,
  waterSeaweed: new THREE.MeshStandardMaterial({ color: 0x2b6638, roughness: 0.85 }),
  waterCoral: new THREE.MeshStandardMaterial({ color: 0xbd5a4f, roughness: 0.82 }),
  waterGold: new THREE.MeshStandardMaterial({ color: 0xd0a336, metalness: 0.65, roughness: 0.24 }),
  oilWater: oilWaterMaterial,
  reservoirWater: reservoirWaterMaterial,
  biolume: bioLumeMaterial
};

// Apply clipping plane to all standard materials in the record
Object.values(mats).forEach(mat => {
  if (mat instanceof THREE.MeshStandardMaterial || mat instanceof THREE.MeshBasicMaterial || mat instanceof THREE.ShaderMaterial) {
    if (mat instanceof THREE.MeshStandardMaterial) {
      mat.clipShadows = true;
    }
    if (mat instanceof THREE.ShaderMaterial) {
      mat.clipping = true;
    }
  }
});

// Specific Shader Materials

// Map keys used in worker to material definitions.
export const terrainMats = {
  ...mats
};