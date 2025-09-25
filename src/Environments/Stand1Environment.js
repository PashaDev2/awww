import * as THREE from "three/webgpu";
import {
    uv,
    texture,
    mix,
    reflector,
    vec2,
    time,
    attribute,
    mod,
    positionLocal,
    sin,
    vec3,
    color,
    float,
    cos,
    vec4,
    hash,
    uniformArray,
    cameraPosition,
    modelViewMatrix,
    positionWorld,
    normalize,
    cross,
    mat3,
    Fn,
    saturate,
    modelWorldMatrix,
    uniform,
} from "three/tsl";

export class Stand1Environment {
    constructor(floorDiffuseMap, floorNormalMap, gltfModel, particleTexture, gui) {
        this.gui = gui;
        this.floorDiffuseMap = floorDiffuseMap;
        this.particleTexture = particleTexture;
        this.floorNormalMap = floorNormalMap;
        this.gltfModel = gltfModel;
        this.mesh = this.createRoom();
    }

    createRoom() {
        const roomGroup = new THREE.Group();

        const roomRadius = 40;
        const roomHeight = 10;

        // --- Floor ---
        const reflection = reflector({ resolutionScale: 0.5 });
        reflection.target.rotateX(-Math.PI / 2);
        roomGroup.add(reflection.target);

        // --- Water Material ---
        const roughness = 0.9;
        const normalScale = 0.3;

        const floorUV = uv()
            .mul(8)
            .add(vec2(time.mul(0.02), time.mul(0.01)));
        const floorUV2 = uv()
            .mul(6)
            .add(vec2(time.mul(-0.015), time.mul(0.025)));

        const floorNormalMapTex = texture(this.floorNormalMap, floorUV);
        const floorNormalMapTex2 = texture(this.floorNormalMap, floorUV2);

        const blendedNormal = mix(floorNormalMapTex, floorNormalMapTex2, 0.5);
        const floorNormalOffset = blendedNormal.xy.mul(2).sub(1).mul(normalScale);
        reflection.uvNode = reflection.uvNode.add(floorNormalOffset);

        const floorMaterial = new THREE.MeshStandardNodeMaterial({ side: THREE.DoubleSide });
        const floorDiffuseColor = texture(this.floorDiffuseMap, floorUV);

        const waterColor = new THREE.Color("#975599");
        const baseColor = mix(floorDiffuseColor, waterColor, 0.5);
        floorMaterial.colorNode = mix(baseColor, reflection, reflection.a);

        floorMaterial.emissiveNode = reflection.mul(0.05);
        floorMaterial.normalMapNode = blendedNormal;
        floorMaterial.normalScaleNode = vec2(normalScale);
        floorMaterial.roughness = roughness;
        floorMaterial.metalness = 0.1;

        const floorGeometry = new THREE.CircleGeometry(roomRadius, 32);
        const floor = new THREE.Mesh(floorGeometry, floorMaterial);
        floor.rotation.x = -Math.PI / 2;
        floor.position.y = -0.45;
        floor.receiveShadow = false;
        roomGroup.add(floor);

        // --- Model with Foam Effect ---
        // Clone the entire model to avoid modifying the original asset
        const modelInstance = this.gltfModel.clone();

        // Traverse the cloned model to apply the foam material to rocks
        modelInstance.traverse(child => {
            // --- THIS IS THE KEY CHANGE ---
            // We use .toLowerCase() to make the name check case-insensitive.
            if (child.isMesh && child.name.toLowerCase().includes("rock")) {
                if (!child.material) return;

                // 1. Ensure the geometry has a bounding box.
                child.geometry.computeBoundingBox();

                // 2. Get the center of that bounding box.
                const geoCenter = new THREE.Vector3();
                child.geometry.boundingBox.getCenter(geoCenter);

                // 3. Create a uniform to pass this center point to the shader.
                const centerUniform = uniform(geoCenter);

                const originalMaterial = child.material;
                const rockNodeMaterial = new THREE.MeshStandardNodeMaterial();
                // ... copy properties as before ...
                rockNodeMaterial.color.copy(originalMaterial.color);
                rockNodeMaterial.map = originalMaterial.map;
                rockNodeMaterial.metalness = 0.1;
                rockNodeMaterial.roughness = 0.9;

                // --- NEW DEBUG SHADER: Visualize Local Y-Position ---
                const debugLocalPosition = Fn(() => {
                    // Get the raw, untransformed vertex position data from the geometry buffer.
                    const localPos = positionLocal;

                    // Map the LOCAL Y-position to a visible grayscale color.
                    // We'll look at the range from y=-2 to y=2.
                    const yColor = positionWorld.y.remap(-1, 1, 0, 1);

                    // Display the result.
                    return vec3(yColor);
                });

                const foamLogic = Fn(() => {
                    const baseColor = rockNodeMaterial.map
                        ? texture(rockNodeMaterial.map, uv())
                        : vec4(color(rockNodeMaterial.color), 1.0);

                    const foamColor = color("#FFFFFF");
                    const waterLevel = float(-0.4);
                    const foamHeight = float(0.9);
                    const foamFeather = float(0.25);
                    const noiseScale = float(20.0);
                    const noiseSpeed = float(0.1);

                    // --- THE FIX ---
                    // 4. Subtract the pre-calculated center from the local position
                    // to create a "virtual" centered position before transforming to world space.
                    const centeredPosition = positionLocal.sub(centerUniform);
                    const worldPos = modelWorldMatrix.mul(centeredPosition).xyz;

                    const foamBand = saturate(
                        worldPos.y.smoothstep(
                            waterLevel.add(foamHeight),
                            waterLevel.sub(foamFeather)
                        )
                    );
                    const noiseCoord = worldPos.xz.mul(noiseScale).add(time.mul(noiseSpeed));
                    const foamNoise = hash(noiseCoord).pow(2.0);
                    const foamAmount = saturate(foamBand.mul(foamNoise));
                    const finalColor = mix(baseColor.rgb, foamColor, foamAmount);

                    return finalColor;
                });

                rockNodeMaterial.colorNode = foamLogic();
                child.material = rockNodeMaterial;
            }
        });

        modelInstance.position.y = -0.15;
        modelInstance.rotateY(Math.PI);
        roomGroup.add(modelInstance);

        // --- Bubbles ---
        const bubbleCount = 300;
        const SPAWN_POINTS_COUNT = 300;
        const spawnPoints = [];
        for (let i = 0; i < SPAWN_POINTS_COUNT; i++) {
            const angle = Math.random() * Math.PI * 2;
            const radius = Math.random() * roomRadius;
            spawnPoints.push(
                new THREE.Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius)
            );
        }
        const spawnPointsUniform = uniformArray(spawnPoints);

        const bubbleMaterial = new THREE.SpriteNodeMaterial({
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
        });

        const randoms = new Float32Array(bubbleCount);
        for (let i = 0; i < bubbleCount; i++) {
            randoms[i] = Math.random() * 2;
        }

        // TSL Shader Logic
        const random = attribute("instanceRandom", "float");
        const timeOffset = time.add(random.mul(100));
        const bubbleProgress = timeOffset.mul(random.mul(1.0).add(0.2));
        const yPosition = mod(bubbleProgress, roomHeight);
        const cycle = bubbleProgress.div(roomHeight).floor();
        const cycleSeed = random.add(cycle);
        const spawnIndex = hash(cycleSeed).mul(SPAWN_POINTS_COUNT).toUint();
        const spawnPos = spawnPointsUniform.element(spawnIndex);
        const wobbleFrequency = hash(cycleSeed.add(0.1)).mul(0.5).add(0.1);
        const wobbleAmplitude = hash(cycleSeed.add(0.2)).mul(2.0).add(1.0);
        const xWobble = sin(yPosition.mul(wobbleFrequency)).mul(wobbleAmplitude);
        const zWobble = cos(yPosition.mul(wobbleFrequency)).mul(wobbleAmplitude);
        const instanceOffset = vec3(spawnPos.x.add(xWobble), yPosition, spawnPos.z.add(zWobble));
        bubbleMaterial.positionNode = positionLocal.add(instanceOffset);

        const fadeDuration = float(2.5);
        const roomHeightNode = float(roomHeight);

        const fadeIn = yPosition.smoothstep(0, fadeDuration);
        const fadeOut = yPosition.smoothstep(roomHeightNode, roomHeightNode.sub(fadeDuration));

        const particleTextureColor = texture(this.particleTexture, uv());
        bubbleMaterial.opacityNode = fadeIn.mul(fadeOut).mul(particleTextureColor.r);
        bubbleMaterial.emissiveNode = particleTextureColor.mul(color("#e1c2ff")).rgb;

        const particleGeometry = new THREE.PlaneGeometry(0.1, 0.1, 1, 1);
        this.bubbles = new THREE.InstancedMesh(particleGeometry, bubbleMaterial, bubbleCount);
        this.bubbles.geometry.setAttribute(
            "instanceRandom",
            new THREE.InstancedBufferAttribute(randoms, 1)
        );
        roomGroup.add(this.bubbles);

        return roomGroup;
    }

    update(deltaTime) {}
}
