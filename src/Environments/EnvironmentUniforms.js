import * as THREE from "three/webgpu";
import { uniform } from "three/tsl";

// --- Water Uniforms ---
export const waterParams = {
    // Refraction & Color
    colorA: uniform(new THREE.Color(0x0487e2)),
    colorB: uniform(new THREE.Color(0x74ccf4)),
    noiseScale1: uniform(0.18),
    noiseScale2: uniform(0.31),
    noiseSpeed: uniform(0.168),
    refractionStrength: uniform(0.05),
    depthFalloff: uniform(0.2),
    // Reflection
    roughness: uniform(0.1),
    metalness: uniform(0.1),
    reflectivity: uniform(0.8),
    fresnelPower: uniform(2.5),
};

// --- Foam & Caustics Uniforms ---
export const foamParams = {
    foamColor: uniform(new THREE.Color("#FFFFFF")),
    foamHeight: uniform(0.9),
    foamFeather: uniform(0.25),
    noiseScale: uniform(20.0),
    noiseSpeed: uniform(0.1),
    causticsIntensity: uniform(1.0),
};
