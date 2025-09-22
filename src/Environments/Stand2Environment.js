import * as THREE from "three/webgpu";
import { uv, texture, mix, reflector, vec2 } from "three/tsl";

export class Stand2Environment {
    constructor(floorDiffuseMap, floorNormalMap, gltfModel) {
        this.floorDiffuseMap = floorDiffuseMap;
        this.floorNormalMap = floorNormalMap;
        this.mesh = this.createRoom();
    }

    createRoom() {
        const roomGroup = new THREE.Group();
        const roomRadius = 18;

        // --- Floor ---
        const reflection = reflector({ resolutionScale: 0.5 });
        reflection.target.rotateX(-Math.PI / 2);
        roomGroup.add(reflection.target);

        const roughness = 0.95; // More rough
        const normalScale = 0.8;
        const floorUV = uv().mul(12);

        const floorNormalMapTex = texture(this.floorNormalMap, floorUV);
        const floorNormalOffset = floorNormalMapTex.xy.mul(2).sub(1).mul(normalScale);
        reflection.uvNode = reflection.uvNode.add(floorNormalOffset);

        const floorMaterial = new THREE.MeshStandardNodeMaterial({ side: THREE.DoubleSide });
        const floorDiffuseColor = texture(this.floorDiffuseMap, floorUV);
        floorMaterial.colorNode = mix(floorDiffuseColor, reflection, reflection.a);
        floorMaterial.emissiveNode = reflection.mul(0.01);
        floorMaterial.normalMapNode = floorNormalMapTex;
        floorMaterial.normalScaleNode = vec2(normalScale);
        floorMaterial.roughness = roughness;

        const floorGeometry = new THREE.CircleGeometry(roomRadius, 64);
        const floor = new THREE.Mesh(floorGeometry, floorMaterial);
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;
        roomGroup.add(floor);

        // --- Spherical Dome ---
        const domeMaterial = new THREE.MeshStandardMaterial({
            color: new THREE.Color("#2a0f2a"), // Dark Purple
            side: THREE.BackSide,
            roughness: 0.8,
            metalness: 0.2,
        });
        const domeGeometry = new THREE.SphereGeometry(
            roomRadius,
            64,
            32,
            0,
            Math.PI * 2,
            0,
            Math.PI / 2
        );
        const domeMesh = new THREE.Mesh(domeGeometry, domeMaterial);
        domeMesh.position.y = -0.01;
        roomGroup.add(domeMesh);

        return roomGroup;
    }

    update(deltaTime) {
        // Future animations for Stand 2's environment can go here
    }
}
