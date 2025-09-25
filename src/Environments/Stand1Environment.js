import * as THREE from "three/webgpu";
import {
    uv,
    texture,
    mix,
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
    modelWorldMatrix,
    uniform,
    positionWorld,
    mx_worley_noise_float,
    screenUV,
    linearDepth,
    viewportLinearDepth,
    viewportDepthTexture,
    viewportSharedTexture,
    remapClamp,
    saturate,
    smoothstep,
    normalWorld,
    // --- NEW IMPORTS FOR REFLECTION ---
    // fresnel,
    cameraPosition,
    normalize,
} from "three/tsl";

export class Stand1Environment {
    constructor(floorDiffuseMap, floorNormalMap, gltfModel, particleTexture, gui) {
        this.gui = gui;
        this.floorDiffuseMap = floorDiffuseMap;
        this.particleTexture = particleTexture;
        this.floorNormalMap = floorNormalMap;
        this.gltfModel = gltfModel;
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

        // --- UNIFORMS FOR GUI CONTROL ---
        this.waterParams = {
            // Refraction & Color
            colorA: uniform(new THREE.Color(0x0487e2)),
            colorB: uniform(new THREE.Color(0x74ccf4)),
            noiseScale1: uniform(0.18),
            noiseScale2: uniform(0.31),
            noiseSpeed: uniform(0.168),
            refractionStrength: uniform(0.05), // Adjusted default
            depthFalloff: uniform(0.2),
            // NEW: Reflection
            roughness: uniform(0.1),
            metalness: uniform(0.1),
            reflectivity: uniform(0.8),
            fresnelPower: uniform(2.5),
        };

        // --- SHARED WATER NOISE LOGIC (Unchanged) ---
        const timer = time.mul(this.waterParams.noiseSpeed);
        const floorUV = positionWorld.xzy;
        const waterLayer0 = mx_worley_noise_float(
            floorUV.mul(this.waterParams.noiseScale1).add(timer)
        );
        const waterLayer1 = mx_worley_noise_float(
            floorUV.mul(this.waterParams.noiseScale2).add(timer)
        );
        const waterIntensity = waterLayer0.mul(waterLayer1);
        const waterColor = waterIntensity
            .mul(1.4)
            .mix(this.waterParams.colorA, this.waterParams.colorB);

        // --- REFRACTION LOGIC (Unchanged) ---
        const depth = linearDepth();
        const depthWater = viewportLinearDepth.sub(depth);
        const depthEffect = remapClamp(depthWater, -0.002, this.waterParams.depthFalloff);
        const refractionUV = screenUV.add(
            vec2(waterIntensity.mul(this.waterParams.refractionStrength))
        );
        const depthTestForRefraction = linearDepth(viewportDepthTexture(refractionUV)).sub(depth);
        const depthRefraction = remapClamp(depthTestForRefraction, 0, 0.1);
        const finalUV = depthTestForRefraction.lessThan(0).select(screenUV, refractionUV);
        const viewportTexture = viewportSharedTexture(finalUV);

        // ======================================================
        // --- 1. NEW COMBINED REFLECTION/REFRACTION MATERIAL ---
        // ======================================================

        // We now use MeshStandardNodeMaterial to get environment reflections
        const waterMaterial = new THREE.MeshStandardNodeMaterial({
            transparent: true,
        });

        // --- Fresnel Effect for realistic reflections ---
        // Calculates reflections strength based on the viewing angle
        const viewDirection = normalize(cameraPosition.sub(positionWorld));
        // const fresnelEffect = fresnel({
        //     normal: normalWorld,
        //     viewDirection: viewDirection,
        //     power: this.waterParams.fresnelPower,
        // });

        // --- Assign Nodes to the Material ---

        // PBR PROPERTIES FOR REFLECTION
        waterMaterial.roughnessNode = this.waterParams.roughness;
        waterMaterial.metalnessNode = this.waterParams.metalness;

        // The base color of the water, visible when looking straight down
        waterMaterial.colorNode = waterColor;

        // BACKDROP PROPERTIES FOR REFRACTION (seeing through the water)
        waterMaterial.backdropNode = depthEffect.mix(
            viewportSharedTexture(),
            viewportTexture.mul(depthRefraction.mix(1, waterColor))
        );
        waterMaterial.backdropAlphaNode = depthRefraction.oneMinus();

        // TRANSPARENCY
        // We mix the base transparency with the fresnel effect.
        // This makes the water more opaque (and thus more reflective) at grazing angles.
        const baseOpacity = this.waterParams.reflectivity;
        waterMaterial.opacityNode = saturate(baseOpacity);

        const waterGeometry = new THREE.CircleGeometry(roomRadius, 64);
        const water = new THREE.Mesh(waterGeometry, waterMaterial);
        water.rotation.x = -Math.PI / 2;
        water.position.y = waterLevel;
        roomGroup.add(water);

        // ======================================================
        // --- 2. MODEL WITH FOAM & CAUSTICS (Fixed) ---
        // ======================================================

        this.foamParams = {
            foamColor: uniform(new THREE.Color("#FFFFFF")),
            foamHeight: uniform(0.9),
            foamFeather: uniform(0.25),
            noiseScale: uniform(20.0),
            noiseSpeed: uniform(0.1),
            causticsIntensity: uniform(1.0),
        };

        const modelInstance = this.gltfModel.clone();
        modelInstance.traverse(child => {
            // *** IMPORTANT FIX ***
            // This `if` statement was commented out, causing the expensive shader
            // to be applied to every single mesh. This restores the intended behavior
            // of only applying it to meshes named "rock".
            if (child.isMesh && child.name.toLowerCase().includes("rock")) {
                if (!child.material) return;
                child.geometry.computeBoundingBox();
                const geoCenter = new THREE.Vector3();
                child.geometry.boundingBox.getCenter(geoCenter);
                const centerUniform = uniform(geoCenter);

                const originalMaterial = child.material;
                const rockNodeMaterial = new THREE.MeshStandardNodeMaterial();
                rockNodeMaterial.color.copy(originalMaterial.color);
                rockNodeMaterial.map = originalMaterial.map;
                rockNodeMaterial.metalness = 0.1;
                rockNodeMaterial.roughness = 0.9;

                const rockShaderLogic = () => {
                    const baseColor = rockNodeMaterial.map
                        ? texture(rockNodeMaterial.map, uv())
                        : vec4(color(rockNodeMaterial.color), 1.0);

                    const centeredPosition = positionLocal.sub(centerUniform);
                    const worldPos = modelWorldMatrix.mul(vec4(centeredPosition, 1.0)).xyz;

                    const isUnderwater = worldPos.y.lessThan(waterLevel);
                    const causticsEffect = waterLayer0.mul(this.foamParams.causticsIntensity);
                    const colorWithCaustics = isUnderwater.select(
                        baseColor.rgb,
                        baseColor.rgb.add(causticsEffect)
                    );

                    const foamBand = saturate(
                        smoothstep(
                            float(waterLevel).add(this.foamParams.foamHeight),
                            float(waterLevel).sub(this.foamParams.foamFeather),
                            worldPos.y
                        )
                    );
                    const noiseCoord = worldPos.xz
                        .mul(this.foamParams.noiseScale)
                        .add(time.mul(this.foamParams.noiseSpeed));
                    const foamNoise = hash(noiseCoord).pow(2.0);
                    const foamAmount = saturate(foamBand.mul(foamNoise));
                    const finalColor = mix(
                        colorWithCaustics,
                        this.foamParams.foamColor,
                        foamAmount
                    );

                    return finalColor;
                };

                rockNodeMaterial.colorNode = rockShaderLogic();
                child.material = rockNodeMaterial;
            }
        });
        modelInstance.position.y = -0.15;
        modelInstance.rotateY(Math.PI);
        roomGroup.add(modelInstance);

        // --- Bubbles (Unchanged) ---
        // ... (your existing bubble code remains here) ...
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
        bubbleMaterial.colorNode = particleTextureColor.mul(color("#e1c2ff"));
        const particleGeometry = new THREE.PlaneGeometry(0.1, 0.1, 1, 1);
        this.bubbles = new THREE.InstancedMesh(particleGeometry, bubbleMaterial, bubbleCount);
        this.bubbles.geometry.setAttribute(
            "instanceRandom",
            new THREE.InstancedBufferAttribute(randoms, 1)
        );
        roomGroup.add(this.bubbles);

        return roomGroup;
    }

    createGUI() {
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
