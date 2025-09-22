// /src/Environments/Stand3Environment.js
import * as THREE from "three/webgpu";
import { uv, texture, mix, reflector, vec2, color, sin, mod, step } from "three/tsl";

export class Stand3Environment {
    constructor(floorDiffuseMap, floorNormalMap, gltfModel) {
        this.floorDiffuseMap = floorDiffuseMap;
        this.floorNormalMap = floorNormalMap;
        this.mesh = this.createRoom();
    }

    createRoom() {
        const roomGroup = new THREE.Group();
        const roomSize = { width: 30, height: 12, depth: 30 };

        // --- Floor (Same reflective setup) ---
        const reflection = reflector({ resolutionScale: 0.5 });
        reflection.target.rotateX(-Math.PI / 2);
        roomGroup.add(reflection.target);
        const roughness = 0.9;
        const normalScale = 0.6;
        const floorUV = uv().mul(15);
        const floorNormalMapTex = texture(this.floorNormalMap, floorUV);
        const floorNormalOffset = floorNormalMapTex.xy.mul(2).sub(1).mul(normalScale);
        reflection.uvNode = reflection.uvNode.add(floorNormalOffset);

        const floorMaterial = new THREE.MeshStandardNodeMaterial({ side: THREE.DoubleSide });
        const floorDiffuseColor = texture(this.floorDiffuseMap, floorUV);
        floorMaterial.colorNode = mix(floorDiffuseColor, reflection, reflection.a);
        floorMaterial.emissiveNode = reflection.mul(0.015);
        floorMaterial.normalMapNode = floorNormalMapTex;
        floorMaterial.normalScaleNode = vec2(normalScale);
        floorMaterial.roughness = roughness;

        const floorGeometry = new THREE.PlaneGeometry(roomSize.width, roomSize.depth);
        const floor = new THREE.Mesh(floorGeometry, floorMaterial);
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;
        roomGroup.add(floor);

        // --- Walls and Ceiling with Grid Material ---
        const wallMaterial = new THREE.MeshStandardNodeMaterial({
            side: THREE.BackSide,
            roughness: 0.9,
            metalness: 0.1,
        });

        // TSL for a glowing grid
        const gridUv = uv().mul(20);
        const gridPattern = vec2(
            step(0.05, mod(gridUv.x, 1.0).abs().sub(0.025)),
            step(0.05, mod(gridUv.y, 1.0).abs().sub(0.025))
        );
        const gridStrength = 1.0 - gridPattern.x.max(gridPattern.y);
        const gridColor = color("#00ff77").mul(0.1);

        wallMaterial.colorNode = color("#051a05"); // Dark Green base
        wallMaterial.emissiveNode = gridColor.mul(0.3); // Make the grid glow

        const roomGeometry = new THREE.BoxGeometry(roomSize.width, roomSize.height, roomSize.depth);
        const wallsAndCeilingMesh = new THREE.Mesh(roomGeometry, wallMaterial);
        wallsAndCeilingMesh.position.y = roomSize.height / 2 - 0.01;
        roomGroup.add(wallsAndCeilingMesh);

        return roomGroup;
    }

    update(deltaTime) {
        // Future animations for Stand 3's environment can go here
    }
}
