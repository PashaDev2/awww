import { uniform } from "three/tsl";
import * as THREE from "three";

const normalTexturePath = "/textures/normal.jpg";
const loader = new THREE.TextureLoader();

const envTexturePath = "/textures/env1.jpg";

// Load the normal map once and export it so it can be shared
export const normalMapTexture = loader.load(normalTexturePath);
normalMapTexture.wrapS = THREE.RepeatWrapping;
normalMapTexture.wrapT = THREE.RepeatWrapping;

export const envTexture = loader.load(envTexturePath);
// envTexture.wrapS = THREE.RepeatWrapping;
// envTexture.wrapT = THREE.RepeatWrapping;
envTexture.mapping = THREE.EquirectangularReflectionMapping;

// Export all material properties as uniforms so they can be controlled globally
export const glassSettings = {
    transmission: uniform(1.0),
    thickness: uniform(1.5),
    roughness: uniform(0.0),
    ior: uniform(1.15),
    metalness: uniform(0.0),
    clearcoat: uniform(1.0),
    clearcoatRoughness: uniform(0.1),
    clearcoatNormalScale: uniform(0.3),
    normalScale: uniform(0.5),
    color: uniform(new THREE.Color(0xffffff)),
    dispersion: uniform(0.25), // Adjusted for a more realistic effect
    attenuationColor: uniform(new THREE.Color(0xffffff)),
    attenuationDistance: uniform(1),
    envMapIntensity: uniform(1),
    envMap: envTexture,
    opacity: uniform(1),
    specularIntensity: uniform(1),
    specularColor: uniform(new THREE.Color(0xffffff)),
};

// --- Lighting Constants  ---
// ref for lumens: http://www.power-sure.com/lumens.htm
export const bulbLuminousPowers = {
    "110000 lm (1000W)": 110000,
    "3500 lm (300W)": 3500,
    "1700 lm (100W)": 1700,
    "800 lm (60W)": 800,
    "400 lm (40W)": 400,
    "180 lm (25W)": 180,
    "20 lm (4W)": 20,
    Off: 0,
};

// ref for solar irradiances: https://en.wikipedia.org/wiki/Lux
export const hemiLuminousIrradiances = {
    "0.0001 lx (Moonless Night)": 0.0001,
    "0.002 lx (Night Airglow)": 0.002,
    "0.5 lx (Full Moon)": 0.5,
    "3.4 lx (City Twilight)": 3.4,
    "50 lx (Living Room)": 50,
    "100 lx (Very Overcast)": 100,
    "350 lx (Office Room)": 350,
    "400 lx (Sunrise/Sunset)": 400,
    "1000 lx (Overcast)": 1000,
    "18000 lx (Daylight)": 18000,
    "50000 lx (Direct Sun)": 50000,
};

export const lightParams = {
    shadows: false,
    exposure: 0.95,
    bulbPower: Object.keys(bulbLuminousPowers)[6],
    hemiIrradiance: Object.keys(hemiLuminousIrradiances)[3],
    color: new THREE.Color("#fafafa"),
};

// Post-Processing Uniforms
export const postProcessingParams = {
    blurAmount: uniform(1),
    blurSize: uniform(2),
    blurSpread: uniform(4),
    minDistance: uniform(1),
    maxDistance: uniform(3),
    bloomStrength: uniform(0.1),
    bloomRadius: uniform(0.23),
    bloomThreshold: uniform(0.373),
};

// DOF settings
export const dofParams = {
    pointerCoords: new THREE.Vector2(),
    focusPoint: new THREE.Vector3(0, 1, 0), // World-space focus point
    targetFocusPoint: new THREE.Vector3(0, 1, 0),
    focusPointView: uniform(new THREE.Vector3()), // View-space focus point (for shader)
    focusDistance: uniform(0),
};

// --- Asset Paths ---
export const transitionTexturePaths = [
    "/textures/transition/transition1.png",
    "/textures/transition/transition2.png",
    "/textures/transition/transition3.png",
    "/textures/transition/transition4.png",
    "/textures/transition/transition5.png",
    "/textures/transition/transition6.png",
];

export const hdrPath = "https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/venice_sunset_1k.hdr";
