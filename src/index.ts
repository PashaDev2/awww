import * as THREE from "three/webgpu";
import {
    pass,
    uniform,
    mrt,
    velocity,
    output,
    mix,
    smoothstep,
    texture,
    vec3,
    Fn,
    uv,
    time,
    color,
} from "three/tsl";
import { transition } from "three/addons/tsl/display/TransitionNode.js";
import { boxBlur } from "three/addons/tsl/display/boxBlur.js";
import { fxaa } from "three/addons/tsl/display/FXAANode.js";
import { bloom } from "three/addons/tsl/display/BloomNode.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { AwwordStand } from "./Stand/AwwordStand.js";
import { Environment } from "./Environments/Environment.js";
import { Stand1Environment } from "./Environments/Stand1Environment.js";
import { HDRLoader } from "three/addons/loaders/HDRLoader.js";
import { GUI } from "three/addons/libs/lil-gui.module.min.js";
import TWEEN from "three/addons/libs/tween.module.js";
import {
    dofParams,
    glassSettings,
    hdrPath,
    postProcessingParams,
    transitionTexturePaths,
} from "./config.js";
import Stats from "three/addons/libs/stats.module.js";
import { audioManager } from "./Audio/Audio.js";
import { uiManager } from "./UI/UIManager.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";

const ON_MOBILE =
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
    window.innerWidth < 768;

let renderer, bloomNode;
const gui = new GUI();
const clock = new THREE.Clock();
const stats = new Stats();

const assets = {
    hdrMap: null,
    gltfModel: null,
    transitionTextures: [],
    configTextures: {},
};

const scenes = [];
const postProcessingInstances = [];
let fromSceneTarget, toSceneTarget, transitionPost;
let transitionTexture;

let scenesInitialized = false;
let activeSceneIndex = 0;
let fromSceneIndex = 0;
let transitionActive = false;
let currentTransitionTween = null;

let isClicked = false;
const controlsConfig = { useOrbitControls: false };
const targetPosition = new THREE.Vector3();

const standConfigurations = [
    { id: 1, texturePath: "/textures/texture1.png", position: new THREE.Vector3(3, 0, -1) },
    { id: 2, texturePath: "/textures/cssAwwords.png", position: new THREE.Vector3(-3, 0, -1) },
    { id: 3, texturePath: "/textures/awwords.png", position: new THREE.Vector3(0, 0, 1.5) },
];

const transitionController = {
    transition: 0,
    _transition: uniform(0),
    useTexture: true,
    _useTexture: uniform(1),
    texture: 0,
    threshold: uniform(0.3),
};

function init() {
    renderer = new THREE.WebGPURenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setAnimationLoop(render);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.5;

    document.body.appendChild(renderer.domElement);
    document.body.appendChild(stats.dom);

    addEventListeners();
    loadAssets();
}

function addEventListeners() {
    renderer.domElement.addEventListener("pointermove", onPointerMove);
    renderer.domElement.addEventListener("mousedown", onMouseDown);
    renderer.domElement.addEventListener("mouseup", onMouseUp);
    window.addEventListener("resize", onWindowResize);
}

function loadAssets() {
    const loadingManager = new THREE.LoadingManager();
    loadingManager.onStart = () =>
        uiManager.showMessage({
            id: "loading-screen",
            content: "Loading... 0%",
            persistent: true,
        });
    loadingManager.onProgress = (url, itemsLoaded, itemsTotal) =>
        uiManager.showMessage({
            id: "loading-screen",
            content: `Loading... ${Math.round((itemsLoaded / itemsTotal) * 100)}%`,
            persistent: true,
        });
    loadingManager.onLoad = onAssetsLoaded;
    loadingManager.onError = url => console.error("Error loading assets: " + url);

    const dracoLoader = new DRACOLoader(loadingManager);
    dracoLoader.setDecoderPath("https://www.gstatic.com/draco/v1/decoders/");
    const gltfLoader = new GLTFLoader(loadingManager);
    gltfLoader.setDRACOLoader(dracoLoader);
    const textureLoader = new THREE.TextureLoader(loadingManager);
    const hdrLoader = new HDRLoader(loadingManager);

    gltfLoader.load("/models/env2.glb", gltf => (assets.gltfModel = gltf.scene));
    hdrLoader.load(hdrPath, texture => (assets.hdrMap = texture));

    transitionTexturePaths.forEach(path =>
        textureLoader.load(path, texture => assets.transitionTextures.push(texture))
    );

    const textureConfigs = {
        normalMap: "/textures/normal.jpg",
        waterNormalMap: "/textures/normalWater.jpg",
        skyTexture: "/textures/sky_06_2k/sky_06_2k.png",
        skyTexture2: "/textures/sky_04_2k/sky_04_2k.png",
        skyTexture3: "/textures/sky_17_2k/sky_17_2k.png",
        metalPlateNormal: "/textures/metal_plate/metal_plate_02_nor_gl_1k.png",
        metalPlateMetal: "/textures/metal_plate/metal_plate_02_metal_1k.png",
        metalPlate: "/textures/metal_plate/metal_plate_02_diff_1k.jpg",
        particleTexture: "/textures/T_basic1_vfx.PNG",
        env: "/textures/env3.jpg",
    };

    for (const key in textureConfigs) {
        assets.configTextures[key] = textureLoader.load(textureConfigs[key], tex => {
            if (key.includes("skyTexture") || key === "env")
                tex.mapping = THREE.EquirectangularReflectionMapping;
            if (key.includes("Normal") || key.includes("metalPlate"))
                tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        });
    }
}

function onAssetsLoaded() {
    assets.hdrMap.mapping = THREE.EquirectangularReflectionMapping;
    glassSettings.envMap = assets.configTextures.env;
    setupScenes();
    setupPostProcessing();
    setupGUI();
    scenesInitialized = true;
    uiManager.hideMessage("loading-screen");
}

function setupScenes() {
    scenes.push(createMainScene());
    standConfigurations.forEach(config => {
        const standScene = createStandScene(config.id);
        if (standScene) scenes[config.id] = standScene;
    });
    scenes[0].scene.add(new THREE.HemisphereLight(0xffffff, 0x8d8d8d, 1.15));
}

function createMainScene() {
    const scene = new THREE.Scene();
    scene.environment = assets.configTextures.env;
    scene.fog = new THREE.Fog(0x000000, 15, 105);
    scene.background = new THREE.Color("black");

    const camera = new THREE.PerspectiveCamera(
        75,
        window.innerWidth / window.innerHeight,
        0.1,
        1000
    );
    camera.position.set(0, 3, 7);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 1, 0);
    controls.update();
    controls.enabled = controlsConfig.useOrbitControls;

    audioManager.initialize(camera);
    audioManager.load2DSound("energy", "/sounds/energy-hum.mp3", { loop: true, volume: 0.5 });
    audioManager.load2DSound("transition", "/sounds/whoosh-fire-movement-243099.mp3", {
        loop: false,
        volume: 0.15,
        rate: 0.75,
    });

    const environment = new Environment({
        floorDiffuseMap: assets.configTextures.normalMap,
        floorNormalMap: assets.configTextures.normalMap,
        gui,
    });
    scene.add(environment.mesh);

    const stands = standConfigurations.map((config, idx) => {
        const stand = new AwwordStand({
            position: config.position,
            texturePath: config.texturePath,
            envMap: assets.configTextures[`skyTexture${idx > 0 ? idx : ""}`],
            sceneIndex: config.id,
            baseNormalTexture: assets.configTextures.metalPlateNormal,
            baseTexture: assets.configTextures.metalPlate,
            baseMetalTexture: assets.configTextures.metalPlateMetal,
            height: idx * 0.5 + 2,
        });
        scene.add(stand.mesh);
        return stand;
    });

    return {
        scene,
        camera,
        controls,
        stands,
        environment,
        raycaster: new THREE.Raycaster(),
        initialCameraQuaternion: camera.quaternion.clone(),
        initialCameraPosition: camera.position.clone(),
    };
}

function createStandScene(standId) {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
        60,
        window.innerWidth / window.innerHeight,
        0.1,
        1000
    );
    camera.position.set(0, 2, 8);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 1, 0);
    controls.update();
    controls.enabled = controlsConfig.useOrbitControls;

    scene.add(new THREE.AmbientLight(0xffffff, 0.3));

    const config = standConfigurations.find(c => c.id === standId);
    if (!config) return null;

    let environment, skyText;
    switch (standId) {
        case 1:
            environment = new Stand1Environment(
                assets.configTextures.waterNormalMap,
                assets.configTextures.waterNormalMap,
                assets.gltfModel,
                assets.configTextures.particleTexture,
                gui
            );
            skyText = assets.configTextures.skyTexture;
            break;
        case 2:
            environment = new Stand1Environment(
                assets.configTextures.waterNormalMap,
                assets.configTextures.waterNormalMap,
                assets.gltfModel,
                assets.configTextures.particleTexture,
                gui
            );
            skyText = assets.configTextures.skyTexture2;
            break;
        case 3:
            environment = new Stand1Environment(
                assets.configTextures.waterNormalMap,
                assets.configTextures.waterNormalMap,
                assets.gltfModel,
                assets.configTextures.particleTexture,
                gui
            );
            skyText = assets.configTextures.skyTexture3;
            break;
    }

    const stand = new AwwordStand({
        position: new THREE.Vector3(0, 0, 0),
        texturePath: config.texturePath,
        envMap: skyText,
        sceneIndex: standId,
        baseNormalTexture: assets.configTextures.metalPlateNormal,
        baseTexture: assets.configTextures.metalPlate,
        baseMetalTexture: assets.configTextures.metalPlateMetal,
    });
    scene.add(stand.mesh);

    scene.backgroundNode = Fn(() => {
        const angle = time.mul(0.002);
        const u = uv();
        const rotatedU = u.x.add(angle).mod(1.0);
        return texture(skyText, vec3(rotatedU, u.y, 0));
    })();

    scene.environment = skyText;
    if (environment) scene.add(environment.mesh);

    return {
        scene,
        camera,
        controls,
        stands: [stand],
        environment,
        raycaster: new THREE.Raycaster(),
        initialCameraQuaternion: camera.quaternion.clone(),
        initialCameraPosition: camera.position.clone(),
    };
}

function buildSceneEffects(scene, camera, isFirstScene = false) {
    const scenePass = pass(scene, camera);
    if (ON_MOBILE) return fxaa(scenePass.getTextureNode());

    scenePass.setMRT(mrt({ output, velocity }));
    const sceneColor = scenePass.getTextureNode();
    const sceneViewZ = scenePass.getViewZNode();
    const blurred = boxBlur(sceneColor, {
        size: postProcessingParams.blurSize,
        separation: postProcessingParams.blurSpread,
    });
    const dofAmount = smoothstep(
        postProcessingParams.minDistance,
        postProcessingParams.maxDistance,
        sceneViewZ.sub(dofParams.focusDistance).abs()
    );
    const dofPass = mix(sceneColor, blurred, dofAmount);
    const bloomPass = bloom(
        dofPass,
        postProcessingParams.bloomStrength.value,
        postProcessingParams.bloomRadius.value,
        postProcessingParams.bloomThreshold.value
    );

    if (isFirstScene) bloomNode = bloomPass;
    return fxaa(dofPass.add(bloomPass));
}

function setupPostProcessing() {
    const renderTargetParams = {
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        format: THREE.RGBAFormat,
    };
    fromSceneTarget = new THREE.WebGLRenderTarget(
        window.innerWidth,
        window.innerHeight,
        renderTargetParams
    );
    toSceneTarget = new THREE.WebGLRenderTarget(
        window.innerWidth,
        window.innerHeight,
        renderTargetParams
    );

    scenes.forEach((sceneData, index) => {
        const scenePost = new THREE.PostProcessing(renderer);
        scenePost.outputNode = buildSceneEffects(sceneData.scene, sceneData.camera, index === 0);
        postProcessingInstances.push(scenePost);
    });

    transitionPost = new THREE.PostProcessing(renderer);
    transitionTexture = texture(assets.transitionTextures[transitionController.texture]);

    const transitionNode = transition(
        texture(fromSceneTarget.texture),
        texture(toSceneTarget.texture),
        transitionTexture,
        transitionController._transition,
        transitionController.threshold,
        transitionController._useTexture
    );
    transitionPost.outputNode = transitionNode;
}

function startTransition(target) {
    if (target === activeSceneIndex || transitionActive) return;

    fromSceneIndex = activeSceneIndex;
    activeSceneIndex = target;
    transitionActive = true;

    audioManager.play2DSound("transition");
    uiManager.hideMessage("scene-context-message");
    uiManager.hideMessage("hover-info");

    if (target === 0) {
        uiManager.showMessage({
            id: "transition-info",
            content: "Returning to Main Scene",
            side: "left",
            duration: 1500,
        });
    } else {
        uiManager.showMessage({
            id: "scene-context-message",
            content: `Viewing Stand ${target}`,
            side: "left",
            persistent: true,
            showCloseButton: true,
            onClose: () => startTransition(0),
        });
    }

    if (currentTransitionTween) currentTransitionTween.stop();

    transitionController.transition = 0;
    transitionController._transition.value = 0;
    currentTransitionTween = new TWEEN.Tween(transitionController)
        .to({ transition: 1 }, 1200)
        .onUpdate(() => (transitionController._transition.value = transitionController.transition))
        .onComplete(() => {
            transitionActive = false;
            currentTransitionTween = null;
        })
        .start();
}

function onWindowResize() {
    const { innerWidth, innerHeight } = window;
    scenes.forEach(sceneData => {
        sceneData.camera.aspect = innerWidth / innerHeight;
        sceneData.camera.updateProjectionMatrix();
    });
    renderer.setSize(innerWidth, innerHeight);
    fromSceneTarget.setSize(innerWidth, innerHeight);
    toSceneTarget.setSize(innerWidth, innerHeight);
}

function onPointerMove(event) {
    dofParams.pointerCoords.x = (event.clientX / window.innerWidth) * 2 - 1;
    dofParams.pointerCoords.y = -(event.clientY / window.innerHeight) * 2 + 1;
}

function onMouseDown() {
    isClicked = true;
}

function onMouseUp() {
    setTimeout(() => (isClicked = false), 50);
}

function updateScene(sceneData, deltaTime, isControlledByUser) {
    sceneData.environment?.update(renderer, sceneData.scene);
    sceneData.stands?.forEach(stand => stand.update(deltaTime, sceneData.camera));

    if (isControlledByUser) {
        if (controlsConfig.useOrbitControls) {
            sceneData.controls.enabled = true;
            sceneData.controls.update(deltaTime);
        } else {
            sceneData.controls.enabled = false;
            const targetQuaternion = new THREE.Quaternion();
            const euler = new THREE.Euler(0, 0, 0, "YXZ");
            const maxAngle = THREE.MathUtils.degToRad(20);
            euler.set(
                -dofParams.pointerCoords.y * maxAngle,
                dofParams.pointerCoords.x * maxAngle,
                0
            );
            targetQuaternion.setFromEuler(euler);

            const finalQuaternion = sceneData.initialCameraQuaternion
                .clone()
                .multiply(targetQuaternion);
            sceneData.camera.quaternion.slerp(finalQuaternion, deltaTime * 5.0);

            if (sceneData.initialCameraPosition) {
                const iPos = sceneData.initialCameraPosition;
                const hRad = Math.sqrt(iPos.x ** 2 + iPos.z ** 2);
                const vRange = 1;
                const orbitYaw = dofParams.pointerCoords.x * THREE.MathUtils.degToRad(20);
                targetPosition.set(
                    hRad * Math.sin(orbitYaw),
                    iPos.y + dofParams.pointerCoords.y * vRange,
                    hRad * Math.cos(orbitYaw)
                );
                sceneData.camera.position.lerp(targetPosition, deltaTime * 5.0);
            }
        }
    } else {
        sceneData.controls.enabled = false;
        sceneData.camera.updateMatrixWorld();
    }
}

function updateInteractivity(deltaTime) {
    const activeSceneData = scenes[activeSceneIndex];
    if (!activeSceneData.raycaster) return;

    activeSceneData.raycaster.setFromCamera(dofParams.pointerCoords, activeSceneData.camera);
    const intersects = activeSceneData.raycaster.intersectObjects(
        activeSceneData.scene.children,
        true
    );
    let hoveredStand = null;

    if (intersects.length > 0) {
        let intersectedObject = intersects[0].object;
        while (intersectedObject) {
            if (intersectedObject.userData.isStand) {
                hoveredStand = intersectedObject.userData.parentStand;
                if (isClicked && !transitionActive) {
                    startTransition(hoveredStand.mesh.userData.sceneIndex);
                }
                break;
            }
            intersectedObject = intersectedObject.parent;
        }
    }

    activeSceneData.stands.forEach(stand => (stand.isSelected = stand === hoveredStand));

    if (hoveredStand) {
        dofParams.targetFocusPoint.copy(intersects[0].point);
    } else {
        dofParams.targetFocusPoint.copy(activeSceneData.controls.target);
    }

    dofParams.focusPoint.lerp(dofParams.targetFocusPoint, deltaTime * 5);
    const focusPointInViewSpace = new THREE.Vector3().copy(dofParams.focusPoint);
    activeSceneData.camera.worldToLocal(focusPointInViewSpace);
    dofParams.focusDistance.value = focusPointInViewSpace.z;
}

async function render() {
    TWEEN.update();
    const deltaTime = clock.getDelta();
    stats.update();
    if (!scenesInitialized) return;

    updateScene(scenes[activeSceneIndex], deltaTime, true);
    if (transitionActive) {
        updateScene(scenes[fromSceneIndex], deltaTime, false);
    }

    updateInteractivity(deltaTime);

    if (transitionActive) {
        renderer.setRenderTarget(fromSceneTarget);
        await postProcessingInstances[activeSceneIndex].renderAsync();
        renderer.setRenderTarget(toSceneTarget);
        await postProcessingInstances[fromSceneIndex].renderAsync();
        renderer.setRenderTarget(null);
        await transitionPost.renderAsync();
    } else {
        renderer.setRenderTarget(null);
        await postProcessingInstances[activeSceneIndex].renderAsync();
    }
}

function toggleOrbitControls(useOrbit) {
    scenes.forEach(sceneData => {
        if (sceneData.controls) sceneData.controls.enabled = useOrbit;
    });

    if (!useOrbit) {
        const activeSceneData = scenes[activeSceneIndex];
        if (activeSceneData.initialCameraQuaternion)
            activeSceneData.camera.quaternion.copy(activeSceneData.initialCameraQuaternion);
        if (activeSceneData.initialCameraPosition)
            activeSceneData.camera.position.copy(activeSceneData.initialCameraPosition);
    }
}

function setupGUI() {
    gui.close();

    const controlsFolder = gui.addFolder("Controls");
    controlsFolder
        .add(controlsConfig, "useOrbitControls")
        .name("Enable Orbit Controls")
        .onChange(toggleOrbitControls);
    controlsFolder.close();

    const sceneFolder = gui.addFolder("Scene Control");
    sceneFolder
        .add(transitionController, "texture", { 1: 0, 2: 1, 3: 2, 4: 3, 5: 4, 6: 5 })
        .name("Transition Texture")
        .onChange(() => {
            // 1. If a transition pass already exists, dispose of it to clear GPU memory and prevent leaks.
            if (transitionPost) {
                transitionPost.dispose();
            }

            // 2. Create a brand new PostProcessing instance. This is the key.
            transitionPost = new THREE.PostProcessing(renderer);

            // 3. Assign a new outputNode built with the currently selected texture.
            //    The new instance will compile a new shader from this node graph.
            transitionPost.outputNode = transition(
                texture(fromSceneTarget.texture),
                texture(toSceneTarget.texture),
                texture(assets.transitionTextures[transitionController.texture]), // Use the new value
                transitionController._transition,
                transitionController.threshold,
                transitionController._useTexture
            );
        });

    sceneFolder.close();

    const glassFolder = gui.addFolder("Glass");
    glassFolder.close();
    glassFolder.add(glassSettings.transmission, "value", 0, 1, 0.01).name("Transmission");
    glassFolder.addColor(glassSettings.color, "value").name("Color");
    glassFolder.add(glassSettings.ior, "value", 1, 2.333, 0.01).name("IOR");
    glassFolder.add(glassSettings.metalness, "value", 0, 1, 0.01).name("Metalness");
    glassFolder.add(glassSettings.thickness, "value", 0, 5, 0.1).name("Thickness");
    glassFolder.add(glassSettings.roughness, "value", 0, 1, 0.01).name("Roughness");
    glassFolder.add(glassSettings.envMapIntensity, "value", 0, 3, 0.1).name("Env Map Intensity");
    glassFolder.add(glassSettings.clearcoat, "value", 0, 1, 0.01).name("Clearcoat");
    glassFolder
        .add(glassSettings.clearcoatRoughness, "value", 0, 1, 0.01)
        .name("Clearcoat Roughness");
    glassFolder.add(glassSettings.normalScale, "value", 0, 5, 0.01).name("Normal Scale");
    glassFolder
        .add(glassSettings.clearcoatNormalScale, "value", 0, 5, 0.01)
        .name("Clearcoat Normal Scale");
    glassFolder
        .add({ normalRepeat: 1 }, "normalRepeat", 1, 4, 1)
        .name("Normal Repeat")
        .onChange(val => assets.configTextures.normalMap.repeat.set(val, val));

    if (!ON_MOBILE) {
        const dofFolder = gui.addFolder("DOF");
        dofFolder.close();
        dofFolder.add(postProcessingParams.minDistance, "value", 0, 10).name("Min Distance");
        dofFolder.add(postProcessingParams.maxDistance, "value", 0, 10).name("Max Distance");
        dofFolder.add(postProcessingParams.blurSize, "value", 1, 10, 1).name("Blur Size");
        dofFolder.add(postProcessingParams.blurSpread, "value", 1, 10, 1).name("Blur Spread");

        if (bloomNode) {
            const bloomFolder = gui.addFolder("Bloom");
            bloomFolder.close();
            bloomFolder.add(bloomNode.strength, "value", 0, 2).name("Strength");
            bloomFolder.add(bloomNode.radius, "value", 0, 2).name("Radius");
            bloomFolder.add(bloomNode.threshold, "value", 0, 2).name("Threshold");
        }
    }
}

init();
