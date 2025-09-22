import * as THREE from "three/webgpu";
import { vec3, vec4, mix, uniform, reflector, Fn, color, texture, uv, vec2 } from "three/tsl";

export class Environment {
    constructor(floorDiffuseMap, floorNormalMap) {
        this.floorDiffuseMap = floorDiffuseMap;
        this.floorNormalMap = floorNormalMap;
        this.mesh = this.createRoom();
    }

    createRoom() {
        const roomGroup = new THREE.Group();
        const roomSize = { width: 30, height: 8, depth: 20 };

        // --- Floor ---

        // 1. Create the reflector which will capture the scene for reflection
        const reflection = reflector({ resolutionScale: 0.5 }); // Use a fixed resolution
        reflection.target.rotateX(-Math.PI / 2); // Orient the reflector to look down
        roomGroup.add(reflection.target);

        // 2. Define uniforms and nodes for material customization
        const roughness = uniform(0.9);
        const normalScale = uniform(0.6);
        const floorUV = uv().mul(15); // Repeated UVs for the floor texture

        // 3. Use the normal map to distort the reflection's UV coordinates
        const floorNormalMapTex = texture(this.floorNormalMap, floorUV);
        const floorNormalOffset = floorNormalMapTex.xy.mul(2).sub(1).mul(normalScale);
        reflection.uvNode = reflection.uvNode.add(floorNormalOffset); // Apply distortion here

        // 4. Create the floor material using MeshStandardNodeMaterial for PBR properties
        const floorMaterial = new THREE.MeshStandardNodeMaterial({
            side: THREE.DoubleSide,
        });

        // 5. Define the material's appearance using TSL nodes
        const floorDiffuseColor = texture(this.floorDiffuseMap, floorUV);

        // The color is a mix of the diffuse texture and the sharp reflection
        floorMaterial.colorNode = mix(floorDiffuseColor, reflection, reflection.a);

        // The emissive channel makes the reflection glow
        floorMaterial.emissiveNode = reflection.mul(0.01); // Adjust intensity as needed

        // Apply the normal map to the material itself for lighting calculations
        floorMaterial.normalMapNode = floorNormalMapTex;
        floorMaterial.normalScaleNode = vec2(normalScale);

        // Floor Geometry
        const floorGeometry = new THREE.PlaneGeometry(roomSize.width, roomSize.depth);
        const floor = new THREE.Mesh(floorGeometry, floorMaterial);
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;
        roomGroup.add(floor);

        // --- Walls and Ceiling ---
        const roomMaterial = new THREE.MeshStandardMaterial({
            color: new THREE.Color("black"),
            side: THREE.BackSide,
            roughness: 0.9,
            metalness: 0.1,
        });
        const roomGeometry = new THREE.BoxGeometry(roomSize.width, roomSize.height, roomSize.depth);
        const wallsAndCeilingMesh = new THREE.Mesh(roomGeometry, roomMaterial);
        wallsAndCeilingMesh.position.y = roomSize.height / 2 - 0.01; // Lower slightly to avoid z-fighting
        roomGroup.add(wallsAndCeilingMesh);

        // --- Expose controls for GUI ---
        this.floorReflection = {
            roughness,
            normalScale,
            reflector: reflection.reflector,
        };

        return roomGroup;
    }

    update(deltaTime) {
        // Future animations can go here
    }
}
