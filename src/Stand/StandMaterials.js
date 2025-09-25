import * as THREE from "three/webgpu";
import { float, vec3, texture, Fn, time, oscSine, positionLocal, uv, sin, color } from "three/tsl";
import { glassSettings } from "../config";
import { marble } from "tsl-textures";

/**
 * This function creates all the materials that can be shared across stand instances.
 * By creating them only once, we improve performance and reduce memory usage.
 */
const createSharedMaterials = () => {
    // --- Base Material ---
    const baseMaterial = new THREE.MeshStandardNodeMaterial({
        metalness: 0.8,
        roughness: 0.1,
        side: THREE.DoubleSide,
    });

    baseMaterial.colorNode = marble({
        scale: 0.5,
        thinness: 1.5,
        noise: 2.3,
        color: new THREE.Color("#000"),
        background: new THREE.Color("#fff"),
        seed: 0,
    });

    // --- Top (Glass) Material ---
    const topMaterial = new THREE.MeshPhysicalNodeMaterial({
        colorNode: glassSettings.color,
        metalnessNode: glassSettings.metalness,
        roughnessNode: glassSettings.roughness,
        iorNode: glassSettings.ior,
        dispersionNode: glassSettings.dispersion,
        thicknessNode: glassSettings.thickness,
        clearcoatNode: glassSettings.clearcoat,
        envMap: texture(glassSettings.envMap),
        envMapIntensity: glassSettings.envMapIntensity.value,
        transmissionNode: glassSettings.transmission,
        specularIntensity: glassSettings.specularIntensity.value,
        specularColor: glassSettings.specularColor.value,
        opacityNode: glassSettings.opacity,
        side: THREE.FrontSide,
        transparent: false,
        depthWrite: false,
    });

    // --- Wave Ring VFX Material ---
    const waveMaterial = new THREE.MeshBasicMaterial({
        color: glassSettings.color,
        transparent: true,
        side: THREE.DoubleSide,
    });

    // TSL function for the wave effect
    const pulseFn = Fn(() => {
        const pulseFrequency = float(1.0);
        const pulseSpeed = time.mul(-0.5);
        const pulseAmplitude = float(0.01);
        const wave = oscSine(uv().x.mul(pulseFrequency).add(pulseSpeed));
        const positiveWave = wave.add(1).mul(0.5).pow(3);
        waveMaterial.opacityNode = positiveWave;
        const direction = positionLocal.xz.normalize();
        const displacement = direction.mul(positiveWave).mul(pulseAmplitude);
        return positionLocal.add(vec3(displacement.x, 0, displacement.y));
    });

    waveMaterial.positionNode = pulseFn();

    // --- Cylinder Aura VFX Material ---
    const cylinderMaterial = new THREE.MeshBasicNodeMaterial({
        transparent: true,
        side: THREE.DoubleSide,
        depthWrite: false, // Important for correct blending
    });

    cylinderMaterial.colorNode = color(glassSettings.color);

    // TSL nodes for the cylinder's opacity and flicker effect
    const speed = time.mul(10.5);
    const strength = float(1.0).sub(uv().y); // Fade from bottom to top
    const flicker = sin(uv().y.mul(20.0).add(speed)).add(1.0).mul(0.5);
    cylinderMaterial.opacityNode = strength.mul(flicker).mul(0.5);

    return {
        baseMaterial,
        topMaterial,
        waveMaterial,
        cylinderMaterial,
    };
};

// Create and export the singleton instance of the materials
export const standMaterials = createSharedMaterials();
