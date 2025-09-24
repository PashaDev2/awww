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
    cos,
    sin,
    time,
    float,
    color,
    mx_worley_noise_float,
} from "three/tsl";

import { transition } from "three/addons/tsl/display/TransitionNode.js";
import { boxBlur } from "three/addons/tsl/display/boxBlur.js";
import { fxaa } from "three/addons/tsl/display/FXAANode.js";
import { bloom } from "three/addons/tsl/display/BloomNode.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { AwwordStand } from "./Stand/AwwordStand.js";
import { Environment } from "./Environments/Environment.js";
import { Stand1Environment } from "./Environments/Stand1Environment.js";
import { Stand2Environment } from "./Environments/Stand2Environment.js";
import { Stand3Environment } from "./Environments/Stand3Environment.js";
import { HDRLoader } from "three/addons/loaders/HDRLoader.js";
import { GUI } from "three/addons/libs/lil-gui.module.min.js";
import TWEEN, { Tween } from "three/addons/libs/tween.module.js";
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

document.addEventListener("DOMContentLoaded", () => {
    function isMobile() {
        // You can use a more robust library, but this is a good start
        return (
            /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
                navigator.userAgent
            ) || window.innerWidth < 768
        );
    }

    const ON_MOBILE = isMobile();

    // --- Global Variables ---
    let renderer: THREE.WebGPURenderer,
        postprocessing: THREE.PostProcessing,
        bloomNode: any,
        transitionEffect: any;

    let sky, sun;

    // This object will hold all our loaded assets
    const assets = {
        hdrMap: null,
        gltfModel: null,
        transitionTextures: [],
        configTextures: {
            normalMap: null,
            waterNormalMap: null,
            caustic: null,
            diffuse: null,
            env: null,
            env2: null,
            skyTexture: null,
            heroVideo: null,
        },
    };

    const scenes: {
        scene: THREE.Scene;
        camera: THREE.PerspectiveCamera;
        stands: AwwordStand[];
        controls: OrbitControls;
        raycaster: THREE.Raycaster;
        environment: Environment | Stand1Environment | Stand2Environment | Stand3Environment;
        initialCameraQuaternion?: THREE.Quaternion; // Added to store initial rotation
        initialCameraPosition?: THREE.Vector3;
    }[] = [];

    const clock = new THREE.Clock();
    const stats = new Stats();
    let transitionActive = false;
    let lastHoveredStandId = null;
    const focusPointInViewSpace = new THREE.Vector3();
    // --- State Management ---
    let activeSceneIndex = 0;
    let targetSceneIndex = 0;
    let scenesInitialized = false;
    let currentTransitionTween: any = null;
    let scenePasses: any[] = [];
    let isClicked = false;
    let clickPos = new THREE.Vector2();
    let lastClickedTime = 0;

    const controlsConfig = {
        useOrbitControls: false, // Start with new controls disabled
    };

    const targetPosition = new THREE.Vector3();

    const standConfigurations = [
        {
            id: 1,
            texturePath: "/textures/texture1.png",
            position: new THREE.Vector3(3, 0, -1),
        },
        {
            id: 2,
            texturePath: "/textures/cssAwwords.png",
            position: new THREE.Vector3(-3, 0, -1),
        },
        {
            id: 3,
            texturePath: "/textures/awwords.png",
            position: new THREE.Vector3(0, 0, 1.5),
        },
    ];

    const transitionController = {
        transition: 1, // 1 = fully visible, 0 = fully transitioned
        _transition: uniform(1),
        useTexture: true,
        _useTexture: uniform(1),
        texture: 0,
        threshold: uniform(0.3),
        scene: 0,
    };

    init();

    function init() {
        // --- Setup basic scene elements ---
        renderer = new THREE.WebGPURenderer({ antialias: true });
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setAnimationLoop(render);

        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 0.5;

        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        document.body.appendChild(renderer.domElement);
        document.body.appendChild(stats.dom);

        renderer.domElement.addEventListener("pointermove", onPointerMove);
        renderer.domElement.addEventListener("mousedown", onMouseDown);
        renderer.domElement.addEventListener("mouseup", onMouseUp);

        window.addEventListener("resize", onWindowResize);

        // --- Start the loading process ---
        loadAssets();
    }

    function loadAssets() {
        // --- Use a LoadingManager to track all loads ---
        const loadingManager = new THREE.LoadingManager();

        loadingManager.onStart = (url, itemsLoaded, itemsTotal) => {
            uiManager.showMessage({
                id: "loading-screen",
                content: "Loading... 0%",
                persistent: true,
            });
        };

        loadingManager.onProgress = (url, itemsLoaded, itemsTotal) => {
            const progress = Math.round((itemsLoaded / itemsTotal) * 100);
            uiManager.showMessage({
                id: "loading-screen",
                content: `Loading... ${progress}%`,
                persistent: true,
            });
        };

        loadingManager.onLoad = () => {
            // --- All assets are loaded, now we can initialize the scene ---
            // Post-process loaded assets
            assets.hdrMap.mapping = THREE.EquirectangularReflectionMapping;

            // Update config settings with loaded textures where necessary
            glassSettings.envMap = assets.configTextures.env;

            // Initialize scenes, post-processing, and GUI
            setupScenes();
            setupPostProcessing();
            setupGUI();
            scenesInitialized = true;
            uiManager.hideMessage("loading-screen");
        };

        loadingManager.onError = url => {
            console.error("There was an error loading " + url);
            uiManager.showMessage({
                id: "loading-screen",
                content: `Error loading assets. Please refresh.`,
                persistent: true,
            });
        };

        // --- Initialize Loaders with the manager ---
        const dracoLoader = new DRACOLoader(loadingManager);
        dracoLoader.setDecoderPath("https://www.gstatic.com/draco/v1/decoders/");
        const gltfLoader = new GLTFLoader(loadingManager);
        gltfLoader.setDRACOLoader(dracoLoader);
        const textureLoader = new THREE.TextureLoader(loadingManager);
        const hdrLoader = new HDRLoader(loadingManager);

        // --- Start Loading All Assets ---
        // GLB Model
        gltfLoader.load("/models/env2.glb", gltf => {
            assets.gltfModel = gltf.scene;
        });

        // HDR Environment
        hdrLoader.load(hdrPath, texture => {
            assets.hdrMap = texture;
        });

        // Transition Textures
        transitionTexturePaths.forEach(path => {
            textureLoader.load(path, texture => {
                assets.transitionTextures.push(texture);
            });
        });

        // Config Textures
        assets.configTextures.normalMap = textureLoader.load("/textures/normal.jpg", tex => {
            tex.wrapS = THREE.RepeatWrapping;
            tex.wrapT = THREE.RepeatWrapping;
        });
        assets.configTextures.waterNormalMap = textureLoader.load(
            "/textures/normalWater.jpg",
            tex => {
                tex.wrapS = THREE.RepeatWrapping;
                tex.wrapT = THREE.RepeatWrapping;
            }
        );
        assets.configTextures.skyTexture = textureLoader.load(
            "/textures/sky_06_2k/sky_06_2k.png",
            tex => {
                tex.mapping = THREE.EquirectangularReflectionMapping;
            }
        );
        assets.configTextures.skyTexture2 = textureLoader.load(
            "/textures/sky_04_2k/sky_04_2k.png",
            tex => {
                tex.mapping = THREE.EquirectangularReflectionMapping;
            }
        );

        assets.configTextures.skyTexture3 = textureLoader.load(
            "/textures/sky_17_2k/sky_17_2k.png",
            tex => {
                tex.mapping = THREE.EquirectangularReflectionMapping;
            }
        );

        assets.configTextures.metalPlateNormal = textureLoader.load(
            "/textures/metal_plate/metal_plate_02_nor_gl_1k.png",
            tex => {
                tex.wrapS = THREE.RepeatWrapping;
                tex.wrapT = THREE.RepeatWrapping;
            }
        );

        assets.configTextures.metalPlateMetal = textureLoader.load(
            "/textures/metal_plate/metal_plate_02_metal_1k.png",
            tex => {
                tex.wrapS = THREE.RepeatWrapping;
                tex.wrapT = THREE.RepeatWrapping;
            }
        );

        assets.configTextures.metalPlate = textureLoader.load(
            "/textures/metal_plate/metal_plate_02_diff_1k.jpg",
            tex => {
                tex.wrapS = THREE.RepeatWrapping;
                tex.wrapT = THREE.RepeatWrapping;
            }
        );

        assets.configTextures.particleTexture = textureLoader.load("/textures/T_basic1_vfx.PNG");
        assets.configTextures.env = textureLoader.load("/textures/env3.jpg", tex => {
            tex.mapping = THREE.EquirectangularReflectionMapping;
        });
        assets.configTextures.env2 = textureLoader.load("/textures/alien-panels_preview.jpg");
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
        // --- Set a nice initial position for the new camera movement ---
        camera.position.set(0, 3, 7);
        // camera.lookAt(0, 0.5, 0);
        const initialCameraQuaternion = camera.quaternion.clone();
        const initialCameraPosition = camera.position.clone();

        const controls = new OrbitControls(camera, renderer.domElement);
        controls.target.set(0, 1, 0);
        controls.update(); // Important to sync controls with camera's new state
        controls.enabled = controlsConfig.useOrbitControls; // Set initial state based on config

        const raycaster = new THREE.Raycaster();

        audioManager.initialize(camera);
        audioManager.load2DSound("energy", "/sounds/energy-hum.mp3", { loop: true, volume: 0.5 });
        audioManager.load2DSound("transition", "/sounds/whoosh-fire-movement-243099.mp3", {
            loop: false,
            volume: 0.15,
            rate: 0.75,
        });

        const environment = new Environment(
            assets.configTextures.normalMap,
            assets.configTextures.normalMap,
            assets.configTextures.heroVideo
        );
        scene.add(environment.mesh);

        const stands: AwwordStand[] = [];
        standConfigurations.forEach((config, idx) => {
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
            stands.push(stand);
        });

        return {
            scene,
            camera,
            controls,
            stands,
            environment,
            raycaster,
            initialCameraQuaternion,
            initialCameraPosition,
        };
    }

    function createStandScene(standId: number) {
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(
            60,
            window.innerWidth / window.innerHeight,
            0.1,
            1000
        );
        camera.position.set(0, 2, 8);
        const initialCameraQuaternion = camera.quaternion.clone();
        const initialCameraPosition = camera.position.clone();

        const controls = new OrbitControls(camera, renderer.domElement);
        controls.target.set(0, 1, 0);
        controls.update();
        controls.enabled = controlsConfig.useOrbitControls;

        const raycaster = new THREE.Raycaster();
        scene.add(new THREE.AmbientLight(0xffffff, 0.3));

        const config = standConfigurations.find(c => c.id === standId);
        if (!config) {
            console.error(`No configuration found for standId: ${standId}`);
            return;
        }

        let environment, skyText;
        switch (standId) {
            case 1:
                environment = new Stand1Environment(
                    assets.configTextures.waterNormalMap,
                    assets.configTextures.waterNormalMap,
                    assets.gltfModel,
                    assets.configTextures.particleTexture
                );
                skyText = assets.configTextures.skyTexture;
                break;
            case 2:
                environment = new Stand2Environment(
                    assets.configTextures.waterNormalMap,
                    assets.configTextures.waterNormalMap,
                    assets.gltfModel,
                    assets.configTextures.particleTexture
                );
                skyText = assets.configTextures.skyTexture2;

                break;

            case 3:
                environment = new Stand3Environment(
                    assets.configTextures.waterNormalMap,
                    assets.configTextures.waterNormalMap,
                    assets.gltfModel,
                    assets.configTextures.particleTexture
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

        var skyboxNode = Fn(() => {
            // Rotate the texture horizontally (U axis) over time
            const angle = time.mul(0.002);
            const u = uv();
            // Shift U coordinate by angle, wrap around [0,1]
            const rotatedU = u.x.add(angle).mod(1.0);
            return texture(skyText, vec3(rotatedU, u.y, 0));
        })();

        scene.backgroundNode = skyboxNode;
        scene.environment = skyText;

        if (environment) {
            scene.add(environment.mesh);
        }

        return {
            scene,
            camera,
            controls,
            stands: [stand],
            raycaster,
            environment,
            initialCameraQuaternion,
            initialCameraPosition,
        };
    }

    function setupScenes() {
        scenes.push(createMainScene()); // Scene 0

        standConfigurations.forEach(config => {
            const id: number = config.id;
            const standScene = createStandScene(config.id);
            if (standScene) {
                scenes[id] = standScene;
            }
        });

        // Lights
        const causticEffect = Fn(([projectorUV]) => {
            const waterLayer0 = mx_worley_noise_float(projectorUV.mul(10).add(time));

            const caustic = waterLayer0.mul(color("#975599")).mul(2);

            return caustic;
        });

        const ambient = new THREE.HemisphereLight(0xffffff, 0x8d8d8d, 1.15);
        scenes[0].scene.add(ambient);

        let projectorLight = new THREE.ProjectorLight(0xffffff, 100);
        projectorLight.colorNode = causticEffect;
        projectorLight.position.set(2.5, 8, 2.5);
        projectorLight.angle = Math.PI / 4;
        projectorLight.penumbra = 1;
        projectorLight.decay = 2;
        projectorLight.distance = 0;

        projectorLight.castShadow = true;
        projectorLight.shadow.mapSize.width = 1024;
        projectorLight.shadow.mapSize.height = 1024;
        projectorLight.shadow.camera.near = 1;
        projectorLight.shadow.camera.far = 10;
        projectorLight.shadow.focus = 1;
        projectorLight.shadow.bias = -0.003;
        scenes[0].scene.add(projectorLight);

        // let lightHelper = new THREE.SpotLightHelper(projectorLight);
        // scenes[0].scene.add(lightHelper);
    }

    function prepareScenePass(scene: THREE.Scene, camera: THREE.Camera, isFirstScene = false) {
        const scenePass = pass(scene, camera);
        if (ON_MOBILE) {
            return fxaa(scenePass.getTextureNode());
        }

        scenePass.setMRT(
            mrt({
                output,
                velocity,
            })
        );
        const sceneColor = scenePass.getTextureNode();
        const sceneViewZ = scenePass.getViewZNode();
        const scenePassBlurred = boxBlur(sceneColor, {
            size: postProcessingParams.blurSize,
            separation: postProcessingParams.blurSpread,
        });
        const blur = smoothstep(
            postProcessingParams.minDistance,
            postProcessingParams.maxDistance,
            sceneViewZ.sub(dofParams.focusDistance).abs()
        );
        const dofPass = mix(sceneColor, scenePassBlurred, blur);
        const localBloomNode = bloom(
            dofPass,
            postProcessingParams.bloomStrength.value,
            postProcessingParams.bloomRadius.value,
            postProcessingParams.bloomThreshold.value
        );
        let dofAndBloom;
        if (isFirstScene) {
            bloomNode = localBloomNode;
            dofAndBloom = dofPass.add(localBloomNode);
        } else {
            dofAndBloom = sceneColor.add(localBloomNode);
        }
        const finalPass = fxaa(dofAndBloom);
        return finalPass;
    }

    function setupPostProcessing() {
        postprocessing = new THREE.PostProcessing(renderer);
        if (ON_MOBILE) {
            const pixelRatio = renderer.getPixelRatio();
            // Render post-processing at half or quarter resolution
            postprocessing.renderer.setSize(
                window.innerWidth * 0.5 * pixelRatio,
                window.innerHeight * 0.5 * pixelRatio
            );
        }
        scenes.forEach((sceneData, index) => {
            const isFirst = index === 0;
            const sPass = prepareScenePass(sceneData.scene, sceneData.camera, isFirst);
            scenePasses.push(sPass);
        });
        postprocessing.outputNode = scenePasses[0];
    }

    function startTransition(target) {
        const fromSceneIndex = activeSceneIndex;
        targetSceneIndex = target;
        if (targetSceneIndex === fromSceneIndex || transitionActive) return;

        // if (targetSceneIndex !== 0) {
        audioManager.play2DSound("transition");
        // }

        const sceneWeAreLeaving = scenes[fromSceneIndex];
        if (sceneWeAreLeaving && sceneWeAreLeaving.stands) {
            sceneWeAreLeaving.stands.forEach(stand => {
                if (stand.waveSound && stand.waveSound.isPlaying) {
                    stand.waveSound.stop();
                }
                stand.isSelected = false;
            });
        }

        uiManager.hideMessage("scene-context-message");
        uiManager.hideMessage("hover-info");

        if (targetSceneIndex === 0) {
            uiManager.showMessage({
                id: "transition-info",
                content: "Returning to Main Scene",
                side: "left",
                duration: 1500,
            });
        } else {
            uiManager.showMessage({
                id: "scene-context-message",
                content: `Viewing Stand ${targetSceneIndex}`,
                side: "left",
                persistent: true,
                showCloseButton: true,
                onClose: () => {
                    startTransition(0);
                },
            });
        }

        transitionActive = true;

        if (currentTransitionTween) {
            currentTransitionTween.stop();
        }

        activeSceneIndex = targetSceneIndex;

        const toScene = scenes[fromSceneIndex];
        const fromScene = scenes[activeSceneIndex];

        let oldPostprocessing = postprocessing;
        postprocessing = null;
        postprocessing = new THREE.PostProcessing(renderer);

        const toPass = prepareScenePass(toScene.scene, toScene.camera);
        const fromPass = prepareScenePass(fromScene.scene, fromScene.camera);

        const transitionEffect = transition(
            toPass,
            fromPass,
            texture(assets.transitionTextures[transitionController.texture]),
            transitionController._transition,
            transitionController.threshold,
            transitionController._useTexture
        );
        postprocessing.outputNode = transitionEffect;

        transitionController.transition = 1;
        transitionController._transition.value = 1;

        currentTransitionTween = new TWEEN.Tween(transitionController)
            .to({ transition: 0 }, 1200)
            .onUpdate(() => {
                transitionController._transition.value = transitionController.transition;
            })
            .onComplete(() => {
                oldPostprocessing.dispose();
                oldPostprocessing = null;
                currentTransitionTween = null;
                transitionActive = false;
                postprocessing.outputNode = toPass;
                uiManager.hideMessage("transition-info");
            })
            .start();
    }

    // --- New function to handle toggling OrbitControls ---
    function toggleOrbitControls(useOrbit) {
        scenes.forEach(sceneData => {
            if (sceneData.controls) {
                sceneData.controls.enabled = useOrbit;
            }
        });

        if (!useOrbit) {
            const activeSceneData = scenes[activeSceneIndex];
            if (activeSceneData.initialCameraQuaternion) {
                activeSceneData.camera.quaternion.copy(activeSceneData.initialCameraQuaternion);
            }
            if (activeSceneData.initialCameraPosition) {
                activeSceneData.camera.position.copy(activeSceneData.initialCameraPosition);
            }
        }
    }

    function setupGUI() {
        const gui = new GUI();
        gui.close();

        // --- New Controls Folder ---
        const controlsFolder = gui.addFolder("Controls");
        controlsFolder
            .add(controlsConfig, "useOrbitControls")
            .name("Enable Orbit Controls")
            .onChange(toggleOrbitControls);
        controlsFolder.open();

        const sceneFolder = gui.addFolder("Scene Control");
        sceneFolder
            .add(transitionController, "scene", {
                "Main Scene": 0,
                "Stand 1": 1,
                "Stand 2": 2,
                "Stand 3": 3,
            })
            .name("Active Scene")
            .onChange(value => startTransition(value));

        sceneFolder
            .add(transitionController, "texture", { 1: 0, 2: 1, 3: 2, 4: 3, 5: 4, 6: 5 })
            .name("Transition Texture");
        sceneFolder.open();

        const glassFolder = gui.addFolder("Glass");
        glassFolder.add(glassSettings.transmission, "value", 0, 1, 0.01).name("Transmission");
        glassFolder.addColor(glassSettings.color, "value").name("Color");
        glassFolder.add(glassSettings.ior, "value", 1, 2.333, 0.01).name("IOR");
        glassFolder.add(glassSettings.metalness, "value", 0, 1, 0.01).name("Metalness");
        glassFolder.add(glassSettings.thickness, "value", 0, 5, 0.1).name("Thickness");
        glassFolder.add(glassSettings.roughness, "value", 0, 1, 0.01).name("Roughness");
        glassFolder
            .add(glassSettings.envMapIntensity, "value", 0, 3, 0.1)
            .name("Env Map Intensity");
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
            .onChange(val => {
                assets.configTextures.normalMap.repeat.set(val, val);
            });

        const dofFolder = gui.addFolder("DOF");
        dofFolder.add(postProcessingParams.minDistance, "value", 0, 10).name("Min Distance");
        dofFolder.add(postProcessingParams.maxDistance, "value", 0, 10).name("Max Distance");
        dofFolder.add(postProcessingParams.blurSize, "value", 1, 10, 1).name("Blur Size");
        dofFolder.add(postProcessingParams.blurSpread, "value", 1, 10, 1).name("Blur Spread");

        if (bloomNode) {
            const bloomFolder = gui.addFolder("Bloom");
            bloomFolder.add(bloomNode.strength, "value", 0, 2).name("Strength");
            bloomFolder.add(bloomNode.radius, "value", 0, 2).name("Radius");
            bloomFolder.add(bloomNode.threshold, "value", 0, 2).name("Threshold");
        }
    }

    function onWindowResize() {
        scenes.forEach(sceneData => {
            sceneData.camera.aspect = window.innerWidth / window.innerHeight;
            sceneData.camera.updateProjectionMatrix();
        });
        renderer.setSize(window.innerWidth, window.innerHeight);
    }

    function onPointerMove(event: PointerEvent) {
        dofParams.pointerCoords.x = (event.clientX / window.innerWidth) * 2 - 1;
        dofParams.pointerCoords.y = -(event.clientY / window.innerHeight) * 2 + 1;
    }

    function onMouseDown(event: PointerEvent) {
        lastClickedTime = Date.now();
        clickPos.x = (event.clientX / window.innerWidth) * 2 - 1;
        clickPos.y = (event.clientY / window.innerHeight) * 2 - 1;
    }

    let timerId: number | null = null;
    function onMouseUp(event: MouseEvent) {
        if (Date.now() - lastClickedTime < 300 && !timerId) {
            isClicked = true;
            timerId = setTimeout(() => {
                isClicked = false;
                timerId = null;
            }, 300);
        }
    }

    async function render() {
        TWEEN.update();
        const deltaTime = clock.getDelta();
        stats.update();

        if (!scenesInitialized) return;

        const activeSceneData = scenes[activeSceneIndex];

        // --- Camera Control Logic ---
        if (controlsConfig.useOrbitControls) {
            if (!activeSceneData.controls.enabled) {
                activeSceneData.controls.enabled = true;
            }
            activeSceneData.controls.update(deltaTime);
        } else {
            if (activeSceneData.controls.enabled) {
                activeSceneData.controls.enabled = false;
            }

            // --- 1. ROTATION LOGIC ---
            // Calculates a target rotation as an offset from the initial orientation
            const targetQuaternion = new THREE.Quaternion();
            const euler = new THREE.Euler(0, 0, 0, "YXZ");
            const maxAngle = THREE.MathUtils.degToRad(20);

            const targetPitch = -dofParams.pointerCoords.y * maxAngle;
            const targetYaw = dofParams.pointerCoords.x * maxAngle;

            euler.set(targetPitch, targetYaw, 0);
            targetQuaternion.setFromEuler(euler);

            const finalQuaternion = activeSceneData.initialCameraQuaternion
                .clone()
                .multiply(targetQuaternion);
            activeSceneData.camera.quaternion.slerp(finalQuaternion, deltaTime * 5.0);

            // --- 2. POSITION LOGIC ---
            // Calculates a target position along an arc based on the initial camera position
            if (activeSceneData.initialCameraPosition) {
                const initialPos = activeSceneData.initialCameraPosition;
                const horizontalRadius = Math.sqrt(initialPos.x ** 2 + initialPos.z ** 2);
                const verticalMovementRange = 1;
                const maxOrbitAngle = THREE.MathUtils.degToRad(20);

                const targetOrbitYaw = dofParams.pointerCoords.x * maxOrbitAngle;

                // Calculate the new position on the circle (arc)
                targetPosition.set(
                    horizontalRadius * Math.sin(targetOrbitYaw),
                    initialPos.y + dofParams.pointerCoords.y * verticalMovementRange,
                    horizontalRadius * Math.cos(targetOrbitYaw)
                );

                // Smoothly interpolate the camera's current position to the target
                activeSceneData.camera.position.lerp(targetPosition, deltaTime * 5.0);
            }
        }

        if (activeSceneData.raycaster) {
            activeSceneData.raycaster.setFromCamera(
                dofParams.pointerCoords,
                activeSceneData.camera
            );
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

                        const isCanBeClicked =
                            isClicked &&
                            (transitionController.transition === 0 ||
                                transitionController.transition === 1);
                        if (isCanBeClicked) {
                            const currentScene = scenes[hoveredStand.mesh.userData.sceneIndex];
                            const nextScene = scenes[activeSceneIndex];
                            if (nextScene !== currentScene) {
                                startTransition(hoveredStand.mesh.userData.sceneIndex);
                            }
                        }
                        break;
                    }
                    intersectedObject = intersectedObject.parent;
                }
            }

            activeSceneData.stands.forEach(stand => {
                stand.isSelected = stand === hoveredStand;
            });

            if (hoveredStand) {
                dofParams.targetFocusPoint.copy(intersects[0].point);
            } else {
                dofParams.targetFocusPoint.copy(activeSceneData.controls.target);
            }

            dofParams.focusPoint.lerp(dofParams.targetFocusPoint, deltaTime * 5);
            focusPointInViewSpace.copy(dofParams.focusPoint);
            activeSceneData.camera.worldToLocal(focusPointInViewSpace);
            dofParams.focusDistance.value = focusPointInViewSpace.z;
        }

        if (activeSceneData.stands) {
            activeSceneData.stands.forEach(stand =>
                stand.update(deltaTime, activeSceneData.camera)
            );
        }

        if (activeSceneData.environment) activeSceneData.environment.update(deltaTime);

        if (postprocessing) {
            await postprocessing.renderAsync();
        }
    }
});
