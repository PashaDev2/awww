import * as THREE from "three/webgpu";
import { uniform } from "three/tsl";
// Import the singleton getters
import { waterParams, foamParams } from "./EnvironmentUniforms.js";
import { getEnvironmentMaterials } from "./EnvironmentMaterials.js";

export class Stand1Environment {
    constructor(floorDiffuseMap, floorNormalMap, gltfModel, particleTexture, gui) {
        this.gui = gui;
        // These are no longer needed on the instance if not used elsewhere
        // this.floorDiffuseMap = floorDiffuseMap;
        // this.particleTexture = particleTexture;
        // this.floorNormalMap = floorNormalMap;
        this.gltfModel = gltfModel;

        // Use the shared uniforms for this instance
        this.waterParams = waterParams;
        this.foamParams = foamParams;

        // Get the singleton materials, creating them if it's the first time
        this.materials = getEnvironmentMaterials(particleTexture);

        this.mesh = this.createRoom();

        if (this.gui) {
            this.createGUI();
        }
    }

    createRoom() {
        const roomGroup = new THREE.Group();
        const roomRadius = 40;
        const roomHeight = 10;
        const waterLevel = -0.45;

        // --- WATER ---
        // Use the shared water material
        const waterGeometry = new THREE.CircleGeometry(roomRadius, 64);
        const water = new THREE.Mesh(waterGeometry, this.materials.waterMaterial);
        water.rotation.x = -Math.PI / 2;
        water.position.y = waterLevel;
        roomGroup.add(water);

        // --- MODEL WITH FOAM & CAUSTICS ---
        const modelInstance = this.gltfModel.clone();
        modelInstance.traverse(child => {
            if (child.isMesh && child.name.toLowerCase().includes("rock")) {
                if (!child.material) return;
                child.geometry.computeBoundingBox();
                const geoCenter = new THREE.Vector3();
                child.geometry.boundingBox.getCenter(geoCenter);
                const centerUniform = uniform(geoCenter);

                // Clone the base material to create a unique instance
                const rockNodeMaterial = this.materials.baseRockMaterial.clone();

                // Copy properties from the original GLTF material
                rockNodeMaterial.color.copy(child.material.color);
                rockNodeMaterial.map = child.material.map;

                // debugger;
                // Apply the shared shader logic to the clone
                // rockNodeMaterial.colorNode = rockNodeMaterial.userData.shaderLogic(centerUniform);

                child.material = rockNodeMaterial;
            }
        });
        modelInstance.position.y = -0.15;
        modelInstance.rotateY(Math.PI);
        roomGroup.add(modelInstance);

        // --- BUBBLES ---
        const bubbleCount = 300;
        const randoms = new Float32Array(bubbleCount);
        for (let i = 0; i < bubbleCount; i++) {
            randoms[i] = Math.random() * 2;
        }

        // Use the shared bubble material
        const particleGeometry = new THREE.PlaneGeometry(0.1, 0.1, 1, 1);
        this.bubbles = new THREE.InstancedMesh(
            particleGeometry,
            this.materials.bubbleMaterial,
            bubbleCount
        );
        this.bubbles.geometry.setAttribute(
            "instanceRandom",
            new THREE.InstancedBufferAttribute(randoms, 1)
        );
        roomGroup.add(this.bubbles);

        return roomGroup;
    }

    createGUI() {
        // This function remains the same, but now it will modify the shared uniform objects,
        // affecting all instances of Stand1Environment.
        const folder = this.gui.addFolder("Room_" + Math.random());
        folder.close();
        const waterFolder = folder.addFolder("Water");
        waterFolder.addColor(this.waterParams.colorA, "value").name("Color A (Deep)");
        waterFolder.addColor(this.waterParams.colorB, "value").name("Color B (Shallow)");
        waterFolder.add(this.waterParams.noiseScale1, "value", 0, 1).name("Noise Scale 1");
        waterFolder.add(this.waterParams.noiseScale2, "value", 0, 1).name("Noise Scale 2");
        waterFolder.add(this.waterParams.noiseSpeed, "value", 0, 2).name("Noise Speed");
        waterFolder.add(this.waterParams.refractionStrength, "value", 0, 0.5).name("Refraction");
        waterFolder.add(this.waterParams.depthFalloff, "value", 0, 1).name("Depth Falloff");

        const reflectionFolder = folder.addFolder("Reflection");
        reflectionFolder.add(this.waterParams.roughness, "value", 0, 1).name("Roughness");
        reflectionFolder.add(this.waterParams.metalness, "value", 0, 1).name("Metalness");
        reflectionFolder.add(this.waterParams.reflectivity, "value", 0, 2).name("Reflectivity");
        reflectionFolder.add(this.waterParams.fresnelPower, "value", 0, 10).name("Fresnel Power");

        const foamFolder = folder.addFolder("Foam & Caustics");
        foamFolder.add(this.foamParams.foamHeight, "value", 0, 2).name("Foam Height");
        foamFolder.add(this.foamParams.foamFeather, "value", 0, 1).name("Foam Feather");
        foamFolder.add(this.foamParams.noiseScale, "value", 1, 50).name("Foam Noise Scale");
        foamFolder.add(this.foamParams.causticsIntensity, "value", 0, 5).name("Caustics Intensity");
        foamFolder.addColor(this.foamParams.foamColor, "value").name("Foam Color");
    }

    update(deltaTime) {}
}
