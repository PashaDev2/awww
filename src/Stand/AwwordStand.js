// AwwordStand.js
import * as THREE from "three/webgpu";
import { float, vec3, texture, Fn, time, oscSine, positionLocal, uv, sin, color } from "three/tsl";
import { glassSettings } from "../config";
import { audioManager } from "../Audio/Audio"; // Import the audio manager

const energyWaveSoundPath = "/sounds/energy-hum.mp3";

export class AwwordStand {
    constructor(position, texturePath, envMap, sceneIndex = 0) {
        this.standHeight = 2;
        this.radius = 1.3;
        this.texturePath = texturePath;
        this.envMap = envMap;
        this.mesh = this.createStand();
        this.mesh.position.copy(position);
        this.mesh.userData.isStand = true;
        this.mesh.userData.sceneIndex = sceneIndex;
        this.mesh.userData.parentStand = this;
        this.isSelected = false;
        this.id = sceneIndex;

        // Target scale for the cylinder VFX
        this.targetScale = new THREE.Vector3(1, 1, 1);
    }

    createStand() {
        const standGroup = new THREE.Group();
        const textureLoader = new THREE.TextureLoader();

        const baseHeight = this.standHeight / 4;
        const topHeight = this.standHeight * (3 / 4);

        // Base Material
        const baseMaterial = new THREE.MeshPhysicalNodeMaterial({
            metalness: 0.1,
            roughness: 0.7,
        });
        baseMaterial.colorNode = vec3(0, 0, 0);

        // --- Realistic Glass Material ---
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
        });

        // Base Geometry
        const baseGeometry = new THREE.BoxGeometry(this.radius, baseHeight, this.radius);
        const baseMesh = new THREE.Mesh(baseGeometry, baseMaterial);
        baseMesh.position.y = baseHeight / 2.1;

        // Top Geometry (using the new glass material)
        const topGeometry = new THREE.BoxGeometry(this.radius, topHeight, this.radius);
        const topMesh = new THREE.Mesh(topGeometry, topMaterial);
        topMesh.position.y = baseHeight + topHeight / 2;

        // --- Textured Plane ---
        const imageTexture = textureLoader.load(this.texturePath);
        imageTexture.flipY = true;

        const planeMaterial = new THREE.MeshBasicNodeMaterial({
            side: THREE.DoubleSide,
            colorNode: texture(imageTexture),
            roughness: 0.5,
            metalness: 0.2,
            blending: THREE.MultiplyBlending,
        });

        const planeSize = this.radius * 0.8;
        const planeGeometry = new THREE.PlaneGeometry(planeSize, planeSize);
        const planeMesh = new THREE.Mesh(planeGeometry, planeMaterial);
        planeMesh.position.y = baseHeight + topHeight / 2;

        // Store a reference to the plane for the update loop
        this.planeMesh = planeMesh;

        standGroup.add(baseMesh);
        standGroup.add(topMesh);
        standGroup.add(planeMesh);

        // --- Wave Ring VFX ---
        const waveMaterial = new THREE.MeshBasicMaterial({
            color: glassSettings.color,
            transparent: true,
            side: THREE.DoubleSide,
        });

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

        const waveGeometry = new THREE.RingGeometry(this.radius * 0.9, this.radius * 1.0, 64);
        const waveMesh = new THREE.Mesh(waveGeometry, waveMaterial);
        waveMesh.visible = false;
        waveMesh.rotation.x = -Math.PI / 2;
        waveMesh.position.y = 0.01;
        this.waveMesh = waveMesh;

        standGroup.add(waveMesh);

        // --- Cylinder Aura VFX (using TSL) ---
        const cylinderHeight = this.standHeight * 0.3; // Adjusted height for better visual effect
        const cylinderRadius = this.radius;
        const cylinderGeometry = new THREE.CylinderGeometry(
            cylinderRadius,
            cylinderRadius,
            cylinderHeight,
            64,
            1,
            true // Open-ended to avoid top/bottom faces
        );

        const cylinderMaterial = new THREE.MeshBasicNodeMaterial({
            transparent: true,
            blending: THREE.AdditiveBlending,
            side: THREE.DoubleSide,
            depthWrite: false, // Important for correct blending of transparent objects
        });

        // Set the base color of the aura
        cylinderMaterial.colorNode = color(glassSettings.color);

        // Create the opacity logic using TSL nodes
        const speed = time.mul(10.5);
        // Fade the effect from bottom (1.0) to top (0.0)
        const strength = float(1.0).sub(uv().y);
        // Create a flickering wave pattern along the cylinder's height
        const flicker = sin(uv().y.mul(20.0).add(speed)).add(1.0).mul(0.5);
        // Combine the gradient and flicker, and apply a final intensity multiplier
        cylinderMaterial.opacityNode = strength.mul(flicker).mul(0.5);

        const cylinderMesh = new THREE.Mesh(cylinderGeometry, cylinderMaterial);
        cylinderMesh.position.y = cylinderHeight / 2; // Position it correctly on the stand

        // MODIFICATION: Set initial scale to 0 and ensure it's visible
        cylinderMesh.scale.set(0, 0, 0);
        cylinderMesh.visible = true; // Always visible, scaling will handle appearance

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

        // --- VFX and Sound Visibility ---
        const isVisible = this.isSelected;
        this.waveMesh.visible = isVisible;

        // --- Update target scale and lerp the cylinder scale ---
        if (isVisible) {
            this.targetScale.set(1, 1, 1);
        } else {
            this.targetScale.set(1, 0, 1);
        }

        // Smoothly interpolate the cylinder's scale towards the target scale
        this.cylinderMesh.scale.lerp(this.targetScale, deltaTime * 5);

        // Optimization: If the cylinder is tiny, hide it completely.
        if (this.cylinderMesh.scale.x < 0.01) {
            this.cylinderMesh.visible = false;
        } else {
            this.cylinderMesh.visible = true;
        }

        // --- Sound Control ---
        // if (isVisible && this.waveSound && !this.waveSound.isPlaying) {
        //     this.waveSound.play();
        // } else if (!isVisible && this.waveSound && this.waveSound.isPlaying) {
        //     this.waveSound.stop();
        // }
    }
}
