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
} from "three/tsl";

export class Stand3Environment {
    constructor(floorDiffuseMap, floorNormalMap, gltfModel, particleTexture) {
        this.floorDiffuseMap = floorDiffuseMap;
        this.particleTexture = particleTexture;
        this.floorNormalMap = floorNormalMap;
        this.gltfModel = gltfModel;
        this.mesh = this.createRoom();
    }

    createRoom() {
        const roomGroup = new THREE.Group();

        const ambLight = new THREE.AmbientLight("#975599", 1);
        roomGroup.add(ambLight);

        const roomRadius = 105;
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

        const floorGeometry = new THREE.CircleGeometry(roomRadius, 64);
        const floor = new THREE.Mesh(floorGeometry, floorMaterial);
        floor.rotation.x = -Math.PI / 2;
        floor.position.y = -0.45;
        floor.receiveShadow = true;
        roomGroup.add(floor);

        this.gltfModel.position.y = -0.25;
        const roomModelGroup = new THREE.Group();
        this.gltfModel.traverse(child => {
            roomModelGroup.add(child.clone());
        });
        roomModelGroup.position.y = -0.15;
        roomModelGroup.rotateY(Math.PI);
        roomGroup.add(roomModelGroup);

        const light = new THREE.PointLight(0xffffff, 10, 0, 1); // Color, Intensity, Distance, Decay
        light.position.set(0, 5, 0); // Position it above the center
        roomGroup.add(light);

        const bubbleCount = 300;
        const SPAWN_POINTS_COUNT = 1500;
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

        const particleWorldPosition = positionWorld.add(instanceOffset);
        const viewDirection = normalize(cameraPosition.sub(particleWorldPosition));
        const rightDirection = normalize(cross(modelViewMatrix[1].xyz, viewDirection));
        const upDirection = cross(viewDirection, rightDirection);
        const billboardMatrix = mat3(rightDirection, upDirection, viewDirection);

        const particleSize = random.mul(0.02).add(0.1); // Random size for each particle
        const billboardPosition = positionLocal.mul(billboardMatrix).mul(particleSize);
        bubbleMaterial.positionNode = billboardPosition.add(instanceOffset);

        const fadeDuration = float(2.5);
        const roomHeightNode = float(roomHeight);

        const fadeIn = yPosition.smoothstep(0, fadeDuration);
        const fadeOut = yPosition.smoothstep(roomHeightNode, roomHeightNode.sub(fadeDuration));

        const particleTextureColor = texture(this.particleTexture, uv());
        // Use the red channel of the texture to determine opacity, combined with the fade in/out
        bubbleMaterial.opacityNode = fadeIn.mul(fadeOut).mul(particleTextureColor.r);

        // --- Visual Properties ---
        bubbleMaterial.emissiveNode = particleTextureColor.mul(color("#e1c2ff")).rgb;

        // --- InstancedMesh Setup (Unchanged) ---
        const particleGeometry = new THREE.PlaneGeometry(0.1, 0.1);
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
