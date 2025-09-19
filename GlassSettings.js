import { uniform } from "three/tsl";
import * as THREE from "three";

const normalTexturePath = "assets/textures/normal.jpg";
const loader = new THREE.TextureLoader();

const envTexturePath = "assets/textures/env1.jpg";

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
    dispersion: uniform(5.0),
    attenuationColor: uniform(new THREE.Color(0xffffff)),
    attenuationDistance: uniform(1),
    envMapIntensity: uniform(1),
    envMap: envTexture,
    opacity: uniform(1),
    transmission: uniform(1),
    specularIntensity: uniform(1),
    specularColor: uniform(new THREE.Color(0xffffff)),
};
