import * as THREE from "three/webgpu";
import { pass, uniform, mrt, velocity, output, mix, smoothstep, texture, vec3 } from "three/tsl";
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
    // --- Global Variables ---
    let renderer: THREE.WebGPURenderer,
        postprocessing: THREE.PostProcessing,
        bloomNode: any,
        transitionEffect: any;

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
        gltfLoader.load("/models/env.glb", gltf => {
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
            "/textures/Texturelabs_Sky_169M.jpg",
            tex => {
                tex.mapping = THREE.EquirectangularReflectionMapping;
            }
        );

        // gifTexture = new GIFTexture("/videos/ambient.gif", undefined, map => {});

        const videoElem = document.createElement("video");
        videoElem.src = "/videos/ambient.mp4";
        videoElem.crossOrigin = "anonymous"; // Important for textures
        videoElem.loop = true;
        videoElem.playbackRate = 0.5;
        videoElem.muted = true; // Required for autoplay in most browsers
        videoElem.playsInline = true;
        videoElem.play().catch(e => console.error("Video autoplay failed:", e)); // Start playing

        assets.configTextures.heroVideo = new THREE.VideoTexture(videoElem);
        assets.configTextures.heroVideo.flipY = true;

        assets.configTextures.env = textureLoader.load("/textures/env1.jpg", tex => {
            tex.mapping = THREE.EquirectangularReflectionMapping;
        });
        assets.configTextures.env2 = textureLoader.load("/textures/alien-panels_preview.jpg");
    }

    // --- Scene Creation (Updated to use loaded assets) ---
    function createMainScene() {
        const scene = new THREE.Scene();
        scene.environment = glassSettings.envMap;
        const camera = new THREE.PerspectiveCamera(
            75,
            window.innerWidth / window.innerHeight,
            0.1,
            1000
        );
        camera.position.set(5, 4, 5);
        const controls = new OrbitControls(camera, renderer.domElement);
        controls.target.set(0, 1, 0);
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
        standConfigurations.forEach(config => {
            const stand = new AwwordStand(
                config.position,
                config.texturePath,
                assets.hdrMap,
                config.id
            );
            scene.add(stand.mesh);
            stands.push(stand);
        });

        return { scene, camera, controls, stands, environment, raycaster };
    }

    function createStandScene(standId: number) {
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(
            60,
            window.innerWidth / window.innerHeight,
            0.1,
            100
        );
        camera.position.set(0, 2, 4);
        const controls = new OrbitControls(camera, renderer.domElement);
        controls.target.set(0, 1, 0);
        const raycaster = new THREE.Raycaster();
        scene.add(new THREE.AmbientLight(0xffffff, 0.3));

        const config = standConfigurations.find(c => c.id === standId);
        if (!config) {
            console.error(`No configuration found for standId: ${standId}`);
            return;
        }

        const stand = new AwwordStand(
            new THREE.Vector3(0, 0, 0),
            config.texturePath,
            assets.hdrMap,
            standId
        );
        scene.add(stand.mesh);

        let environment;
        switch (standId) {
            case 1:
                environment = new Stand1Environment(
                    assets.configTextures.skyTexture,
                    // assets.configTextures.normalMap,
                    assets.configTextures.waterNormalMap,
                    assets.gltfModel
                );
                scene.background = new THREE.Color("#212224");
                // scene.background = assets.configTextures.skyTexture;
                scene.environment = assets.configTextures.skyTexture;
                scene.fog = new THREE.Fog("#212224", 15, 35);
                break;
            case 2:
                environment = new Stand2Environment(
                    assets.configTextures.normalMap,
                    assets.configTextures.normalMap,
                    assets.gltfModel
                );
                break;
            case 3:
                environment = new Stand3Environment(
                    assets.configTextures.normalMap,
                    assets.configTextures.normalMap,
                    assets.gltfModel
                );
                break;
            default:
                console.warn(`No specific environment for standId: ${standId}`);
                break;
        }

        if (environment) {
            scene.add(environment.mesh);
        }

        return { scene, camera, controls, stands: [stand], raycaster, environment };
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
    }

    function prepareScenePass(scene: THREE.Scene, camera: THREE.Camera, isFirstScene = false) {
        const scenePass = pass(scene, camera);
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
        if (isFirstScene) {
            bloomNode = localBloomNode;
        }
        const dofAndBloom = dofPass.add(localBloomNode);
        const finalPass = fxaa(dofAndBloom);
        return finalPass;
    }

    function setupPostProcessing() {
        postprocessing = new THREE.PostProcessing(renderer);
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

        if (targetSceneIndex !== 0) {
            audioManager.play2DSound("transition");
        }

        // --- Stop audio from the outgoing scene ---
        const sceneWeAreLeaving = scenes[fromSceneIndex];
        if (sceneWeAreLeaving && sceneWeAreLeaving.stands) {
            sceneWeAreLeaving.stands.forEach(stand => {
                // Stop the positional audio for each stand
                if (stand.waveSound && stand.waveSound.isPlaying) {
                    stand.waveSound.stop();
                }
                stand.isSelected = false; // Also ensure the selection state is reset
            });
        }

        // transitionController.texture = target + 1;

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

        // This part of your code was already correctly resetting the isSelected flag,
        // but the explicit audio stop is what's crucial.
        /* This block is now redundant due to the fix above, but it's good practice
    if (sceneWeAreLeaving && sceneWeAreLeaving.stands) {
        sceneWeAreLeaving.stands.forEach(stand => {
            stand.isSelected = false;
        });
    }
    */

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

    function setupGUI() {
        const gui = new GUI();
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
                // Use the asset loaded by the manager
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
