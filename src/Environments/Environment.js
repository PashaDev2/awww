import * as THREE from "three/webgpu";
import { vec3, vec4, mix, uniform, reflector, Fn, color, texture, uv, vec2 } from "three/tsl";

export class Environment {
    constructor({ floorDiffuseMap, floorNormalMap, gui }) {
        this.floorDiffuseMap = floorDiffuseMap;
        this.floorNormalMap = floorNormalMap;
        this.gui = gui;
        this.mesh = this.createRoom();

        if (this.gui) {
            this.createGUI();
        }
    }

    createRoom() {
        const roomGroup = new THREE.Group();
        const roomSize = { width: 50, height: 8, depth: 50 };

        // --- Floor ---

        // 1. Create the reflector which will capture the scene for reflection
        const reflection = reflector({ resolutionScale: 0.5 });
        reflection.target.rotateX(-Math.PI / 2);
        roomGroup.add(reflection.target);

        // 2. Define uniforms and nodes for material customization
        const roughness = uniform(0.5);
        const normalScale = uniform(1.5);
        const floorUV = uv().mul(1);

        // 3. Use the normal map to distort the reflection's UV coordinates
        const floorNormalMapTex = texture(this.floorNormalMap, floorUV);
        const floorNormalOffset = floorNormalMapTex.xy.mul(2).sub(1).mul(normalScale);
        reflection.uvNode = reflection.uvNode.add(floorNormalOffset);

        // 4. Create the floor material using MeshStandardNodeMaterial for PBR properties
        const floorMaterial = new THREE.MeshStandardNodeMaterial({
            // side: THREE.DoubleSide,
        });

        // 5. Define the material's appearance using TSL nodes
        const floorDiffuseColor = texture(this.floorDiffuseMap, floorUV);
        floorMaterial.colorNode = mix(floorDiffuseColor, reflection, reflection.a);
        floorMaterial.emissiveNode = reflection.mul(0.1);
        floorMaterial.normalMapNode = floorNormalMapTex;
        floorMaterial.normalScaleNode = vec2(normalScale);

        // Floor Geometry
        const floorGeometry = new THREE.PlaneGeometry(roomSize.width, roomSize.depth);
        const floor = new THREE.Mesh(floorGeometry, floorMaterial);
        floor.rotation.x = -Math.PI / 2;
        roomGroup.add(floor);

        // --- Walls and Ceiling ---
        const roomMaterial = new THREE.MeshStandardMaterial({
            color: new THREE.Color("black"),
            side: THREE.BackSide,
            roughness: 0.9,
            metalness: 0.1,
        });

        // --- Expose controls for GUI ---
        this.floorReflection = {
            roughness,
            normalScale,
            reflector: reflection.reflector,
        };

        return roomGroup;
    }

    createGUI() {
        const folder = this.gui.addFolder("Floor Reflection");
        folder.add(this.floorReflection.roughness, "value", 0, 1).name("Roughness");
        folder.add(this.floorReflection.normalScale, "value", 0, 5).name("Normal Scale");
    }

    update(deltaTime) {
        // Future animations can go here
    }
}
