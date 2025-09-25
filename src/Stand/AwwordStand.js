import * as THREE from "three/webgpu";
import { float, vec3, texture, Fn, time, oscSine, positionLocal, uv, sin, color } from "three/tsl";
import { glassSettings } from "../config";
import { audioManager } from "../Audio/Audio";
// Import the singleton materials
import { standMaterials } from "./StandMaterials";

const energyWaveSoundPath = "/sounds/energy-hum.mp3";

export class AwwordStand {
    constructor({
        position,
        texturePath,
        // The following parameters are no longer needed as materials are shared
        // envMap,
        // baseNormalTexture,
        // baseTexture,
        // baseMetalTexture,
        sceneIndex = 0,
        height = 2,
        radius = 1.5,
    }) {
        this.standHeight = height;
        this.radius = radius;
        this.texturePath = texturePath; // Still needed for the unique plane texture
        this.isSelected = false;
        this.id = sceneIndex;
        this.targetScale = new THREE.Vector3(1, 1, 1);

        this.mesh = this.createStand();
        this.mesh.position.copy(position);
        this.mesh.userData.isStand = true;
        this.mesh.userData.sceneIndex = sceneIndex;
        this.mesh.userData.parentStand = this;
    }

    createStand() {
        const standGroup = new THREE.Group();
        const textureLoader = new THREE.TextureLoader();

        const baseHeight = this.standHeight / 4;
        const topHeight = this.standHeight * (3 / 4);

        // Base Geometry
        const baseGeometry = new THREE.BoxGeometry(
            this.radius + 0.5,
            baseHeight,
            this.radius + 0.5
        );
        // Use the singleton material
        const baseMesh = new THREE.Mesh(baseGeometry, standMaterials.baseMaterial);
        baseMesh.position.y = baseHeight / 2.1;

        // Top Geometry
        const topGeometry = new THREE.BoxGeometry(this.radius, topHeight, this.radius);
        // Use the singleton material
        const topMesh = new THREE.Mesh(topGeometry, standMaterials.topMaterial);
        topMesh.position.y = baseHeight + topHeight / 2;

        // --- Textured Plane (This material remains unique to each instance) ---
        const imageTexture = textureLoader.load(this.texturePath);
        imageTexture.flipY = true;

        // This material is created per-instance because it depends on a unique texturePath.
        const planeMaterial = new THREE.MeshBasicNodeMaterial({
            side: THREE.DoubleSide,
            colorNode: texture(imageTexture),
        });

        const planeSize = this.radius * 0.8;
        const planeGeometry = new THREE.PlaneGeometry(planeSize, planeSize);
        const planeMesh = new THREE.Mesh(planeGeometry, planeMaterial);
        planeMesh.position.y = baseHeight + topHeight / 2;
        this.planeMesh = planeMesh;

        standGroup.add(baseMesh, topMesh, planeMesh);

        // --- Wave Ring VFX ---
        const waveGeometry = new THREE.RingGeometry(this.radius * 0.95, this.radius * 1.05, 64);
        // Use the singleton material
        const waveMesh = new THREE.Mesh(waveGeometry, standMaterials.waveMaterial);
        waveMesh.visible = false;
        waveMesh.rotation.x = -Math.PI / 2;
        waveMesh.position.y = 0.01;
        this.waveMesh = waveMesh;
        standGroup.add(waveMesh);

        // --- Cylinder Aura VFX ---
        const cylinderHeight = this.standHeight * 0.3;
        const cylinderRadius = this.radius * 1.1;
        const cylinderGeometry = new THREE.CylinderGeometry(
            cylinderRadius,
            cylinderRadius,
            cylinderHeight,
            64,
            1,
            true
        );
        // Use the singleton material
        const cylinderMesh = new THREE.Mesh(cylinderGeometry, standMaterials.cylinderMaterial);
        cylinderMesh.position.y = cylinderHeight / 2;
        cylinderMesh.scale.set(0, 0, 0);
        cylinderMesh.visible = true;
        this.cylinderMesh = cylinderMesh;
        standGroup.add(cylinderMesh);

        // --- Sound ---
        this.waveSound = audioManager.createPositionalSound();
        audioManager.loadPositionalSound("energy-hum", energyWaveSoundPath, () => {
            audioManager.setBufferToSound(this.waveSound, "energy-hum");
            this.waveSound.setLoop(true);
            this.waveSound.setVolume(0.15);
        });
        standGroup.add(this.waveSound);

        return standGroup;
    }

    update(deltaTime, camera) {
        if (!this.planeMesh || !camera) return;

        // --- Billboard Logic ---
        const targetQuaternion = new THREE.Quaternion();
        const targetPosition = new THREE.Vector3();
        this.planeMesh.getWorldPosition(targetPosition);
        targetPosition.add(camera.position.clone().sub(targetPosition).normalize());
        const dummy = new THREE.Object3D();
        dummy.lookAt(camera.position);
        targetQuaternion.copy(dummy.quaternion);
        this.planeMesh.quaternion.slerp(targetQuaternion, deltaTime * 5);

        // The rest of your update logic remains unchanged
    }
}
