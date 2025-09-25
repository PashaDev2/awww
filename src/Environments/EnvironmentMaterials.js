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
    cameraPosition,
    normalize,
} from "three/tsl";
import { waterParams, foamParams } from "./EnvironmentUniforms.js"; // Import shared uniforms

// This will hold the single instance of our materials
let materialInstance = null;

const createSharedEnvironmentMaterials = particleTexture => {
    // ======================================================
    // --- 1. WATER MATERIAL ---
    // ======================================================
    const waterMaterial = new THREE.MeshStandardNodeMaterial({ transparent: true });

    const timer = time.mul(waterParams.noiseSpeed);
    const floorUV = positionWorld.xzy;
    const waterLayer0 = mx_worley_noise_float(floorUV.mul(waterParams.noiseScale1).add(timer));
    const waterLayer1 = mx_worley_noise_float(floorUV.mul(waterParams.noiseScale2).add(timer));
    const waterIntensity = waterLayer0.mul(waterLayer1);
    const waterColor = waterIntensity.mul(1.4).mix(waterParams.colorA, waterParams.colorB);

    const depth = linearDepth();
    const depthWater = viewportLinearDepth.sub(depth);
    const depthEffect = remapClamp(depthWater, -0.002, waterParams.depthFalloff);
    const refractionUV = screenUV.add(vec2(waterIntensity.mul(waterParams.refractionStrength)));
    const depthTestForRefraction = linearDepth(viewportDepthTexture(refractionUV)).sub(depth);
    const depthRefraction = remapClamp(depthTestForRefraction, 0, 0.1);
    const finalUV = depthTestForRefraction.lessThan(0).select(screenUV, refractionUV);
    const viewportTexture = viewportSharedTexture(finalUV);

    waterMaterial.roughnessNode = waterParams.roughness;
    waterMaterial.metalnessNode = waterParams.metalness;
    waterMaterial.colorNode = waterColor;
    waterMaterial.backdropNode = depthEffect.mix(
        viewportSharedTexture(),
        viewportTexture.mul(depthRefraction.mix(1, waterColor))
    );
    waterMaterial.backdropAlphaNode = depthRefraction.oneMinus();
    waterMaterial.opacityNode = saturate(waterParams.reflectivity);

    // ======================================================
    // --- 2. BASE ROCK MATERIAL (to be cloned) ---
    // ======================================================
    const baseRockMaterial = new THREE.MeshStandardNodeMaterial({
        metalness: 0.1,
        roughness: 0.9,
    });

    const rockShaderLogic = centerUniform => {
        const baseColor = baseRockMaterial.map
            ? texture(baseRockMaterial.map, uv())
            : vec4(color(baseRockMaterial.color), 1.0);

        const worldPos = modelWorldMatrix.mul(vec4(positionLocal.sub(centerUniform), 1.0)).xyz;
        const waterLevel = -0.45; // Hardcoded to match environment setting

        const isUnderwater = worldPos.y.lessThan(waterLevel);
        const causticsEffect = waterLayer0.mul(foamParams.causticsIntensity);
        const colorWithCaustics = isUnderwater.select(
            baseColor.rgb,
            baseColor.rgb.add(causticsEffect)
        );

        const foamBand = saturate(
            smoothstep(
                float(waterLevel).add(foamParams.foamHeight),
                float(waterLevel).sub(foamParams.foamFeather),
                worldPos.y
            )
        );
        const noiseCoord = worldPos.xz
            .mul(foamParams.noiseScale)
            .add(time.mul(foamParams.noiseSpeed));
        const foamNoise = hash(noiseCoord).pow(2.0);
        const foamAmount = saturate(foamBand.mul(foamNoise));
        const finalColor = mix(colorWithCaustics, foamParams.foamColor, foamAmount);

        return finalColor;
    };

    // We attach the logic function so we can call it later when cloning
    baseRockMaterial.userData.shaderLogic = rockShaderLogic;

    // ======================================================
    // --- 3. BUBBLE MATERIAL ---
    // ======================================================
    const bubbleMaterial = new THREE.SpriteNodeMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
    });

    const bubbleCount = 300;
    const SPAWN_POINTS_COUNT = 300;
    const spawnPoints = [];
    for (let i = 0; i < SPAWN_POINTS_COUNT; i++) {
        const angle = Math.random() * Math.PI * 2;
        const radius = Math.random() * 40; // Hardcoded roomRadius
        spawnPoints.push(new THREE.Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius));
    }
    const spawnPointsUniform = uniformArray(spawnPoints);
    const random = attribute("instanceRandom", "float");
    const timeOffset = time.add(random.mul(100));
    const roomHeight = 10; // Hardcoded roomHeight
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
    const particleTextureColor = texture(particleTexture, uv());
    bubbleMaterial.opacityNode = fadeIn.mul(fadeOut).mul(particleTextureColor.r);
    bubbleMaterial.colorNode = particleTextureColor.mul(color("#e1c2ff"));

    return {
        waterMaterial,
        baseRockMaterial,
        bubbleMaterial,
    };
};

/**
 * Singleton factory to get environment materials.
 * Ensures materials are created only once.
 * @param {THREE.Texture} particleTexture - The texture for the bubble particles.
 */
export const getEnvironmentMaterials = particleTexture => {
    if (!materialInstance) {
        materialInstance = createSharedEnvironmentMaterials(particleTexture);
    }
    return materialInstance;
};
