import * as THREE from "three/webgpu";
import { uv, texture, mix, reflector, vec2, time } from "three/tsl";

export class Stand1Environment {
    constructor(floorDiffuseMap, floorNormalMap, gltfModel) {
        this.floorDiffuseMap = floorDiffuseMap;
        this.floorNormalMap = floorNormalMap;
        this.gltfModel = gltfModel;
        this.mesh = this.createRoom();
    }

    createRoom() {
        const roomGroup = new THREE.Group();

        const directionalLight = new THREE.DirectionalLight("#005b96", 0.25); // Soft blueish, low intensity
        directionalLight.position.set(5, 10, 7);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 1024;
        directionalLight.shadow.mapSize.height = 1024;
        directionalLight.shadow.camera.near = 1;
        directionalLight.shadow.camera.far = 50;
        roomGroup.add(directionalLight);

        const roomRadius = 35;
        const roomHeight = 10;

        // --- Floor ---
        const reflection = reflector({ resolutionScale: 0.5 });
        reflection.target.rotateX(-Math.PI / 2);
        roomGroup.add(reflection.target);

        // --- Water Material ---
        const roughness = 0.9; // Lower roughness for sharper reflections
        const normalScale = 0.3;

        // Animate UVs to create moving ripples
        const floorUV = uv()
            .mul(8)
            .add(vec2(time.mul(0.02), time.mul(0.01)));
        const floorUV2 = uv()
            .mul(6)
            .add(vec2(time.mul(-0.015), time.mul(0.025)));

        const floorNormalMapTex = texture(this.floorNormalMap, floorUV);
        const floorNormalMapTex2 = texture(this.floorNormalMap, floorUV2);

        // Blend two moving normal maps for a more complex wave pattern
        const blendedNormal = mix(floorNormalMapTex, floorNormalMapTex2, 0.5);

        const floorNormalOffset = blendedNormal.xy.mul(2).sub(1).mul(normalScale);
        reflection.uvNode = reflection.uvNode.add(floorNormalOffset);

        const floorMaterial = new THREE.MeshStandardNodeMaterial({ side: THREE.DoubleSide });
        const floorDiffuseColor = texture(this.floorDiffuseMap, floorUV);

        // Mix the base color with the reflection, and add a tint of color to the water
        const waterColor = new THREE.Color("#005eb8"); // A blue tint for the water
        const baseColor = mix(floorDiffuseColor, waterColor, 0.5);
        floorMaterial.colorNode = mix(baseColor, reflection, reflection.a);

        floorMaterial.emissiveNode = reflection.mul(0.05);
        floorMaterial.normalMapNode = blendedNormal;
        floorMaterial.normalScaleNode = vec2(normalScale);
        floorMaterial.roughness = roughness;
        floorMaterial.metalness = 0.1; // A slight metallic feel can enhance reflections

        const floorGeometry = new THREE.CircleGeometry(roomRadius, 64);
        const floor = new THREE.Mesh(floorGeometry, floorMaterial);
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;
        roomGroup.add(floor);

        // --- Cylindrical Wall ---
        const wallMaterial = new THREE.MeshStandardMaterial({
            color: new THREE.Color("#101033"), // Dark Blue
            side: THREE.BackSide,
            roughness: 0.9,
            metalness: 0.1,
        });
        const wallGeometry = new THREE.CylinderGeometry(
            roomRadius,
            roomRadius,
            roomHeight,
            64,
            1,
            true
        );
        const wallMesh = new THREE.Mesh(wallGeometry, wallMaterial);
        wallMesh.position.y = roomHeight / 2 - 0.01;
        roomGroup.add(wallMesh);

        const innerRadius = 10; // Minimum distance from center (donut hole)
        const outerRadius = 30;
        this.gltfModel.children.forEach(child => {
            // For each mesh, calculate a new random position in the donut area
            const angle = Math.random() * Math.PI * 2;
            const radius = innerRadius + Math.random() * (outerRadius - innerRadius);

            child.position.set(
                Math.cos(angle) * radius,
                0, // Place it on the floor
                Math.sin(angle) * radius
            );

            // Optional: Give each a random rotation
            child.rotation.y = Math.random() * Math.PI * 2;
        });

        roomGroup.add(this.gltfModel);

        return roomGroup;
    }

    update(deltaTime) {
        // The animation is now handled by the shader using `timerLocal()`
    }
}
