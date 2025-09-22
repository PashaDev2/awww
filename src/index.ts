// import * as THREE from "three/webgpu";
// import { pass, uniform, mrt, velocity, output, mix, smoothstep, texture } from "three/tsl";
// import { transition } from "three/addons/tsl/display/TransitionNode.js";
// import { boxBlur } from "three/addons/tsl/display/boxBlur.js";
// import { fxaa } from "three/addons/tsl/display/FXAANode.js";
// import { bloom } from "three/addons/tsl/display/BloomNode.js";
// import { OrbitControls } from "three/addons/controls/OrbitControls.js";
// import { AwwordStand } from "./Stand/AwwordStand.js";
// import { Environment } from "./Environments/Environment.js";
// import { Stand1Environment } from "./Environments/Stand1Environment.js";
// import { Stand2Environment } from "./Environments/Stand2Environment.js";
// import { Stand3Environment } from "./Environments/Stand3Environment.js";
// import { HDRLoader } from "three/addons/loaders/HDRLoader.js";
// import { GUI } from "three/addons/libs/lil-gui.module.min.js";
// import TWEEN, { Tween } from "three/addons/libs/tween.module.js";
// import {
//     dofParams,
//     glassSettings,
//     hdrPath,
//     normalMapTexture,
//     postProcessingParams,
//     transitionTexturePaths,
// } from "./config.js";
// import Stats from "three/addons/libs/stats.module.js";
// import { audioManager } from "./Audio/Audio.js";
// import { uiManager } from "./UI/UIManager.js";

// // --- Global Variables ---
// let renderer: THREE.WebGPURenderer,
//     postprocessing: THREE.PostProcessing,
//     bloomNode: any,
//     transitionEffect: any;

// let hdrMap: THREE.Texture;
// const scenes: {
//     scene: THREE.Scene;
//     camera: THREE.PerspectiveCamera;
//     stands: AwwordStand[];
//     controls: OrbitControls;
//     raycaster: THREE.Raycaster;
//     environment: Environment | Stand1Environment | Stand2Environment | Stand3Environment;
// }[] = [];

// const transitionTextures: THREE.Texture[] = [];
// const clock = new THREE.Clock();
// const stats = new Stats();
// let transitionActive = false;
// let lastHoveredStandId = null;
// const focusPointInViewSpace = new THREE.Vector3();
// // --- State Management ---
// let activeSceneIndex = 0;
// let targetSceneIndex = 0;
// let scenesInitialized = false;
// // let sceneControllerGUI;
// let currentTransitionTween: Tween | null = null; // This will hold the active tween object
// let scenePasses: any[] = [];
// let isClicked = false;
// let clickPos = new THREE.Vector2();
// let lastClickedTime = 0;

// const standConfigurations = [
//     {
//         id: 1,
//         texturePath: "/textures/texture1.png",
//         position: new THREE.Vector3(3, 0, -1),
//     },
//     {
//         id: 2,
//         texturePath: "/textures/cssAwwords.png",
//         position: new THREE.Vector3(-3, 0, -1),
//     },
//     {
//         id: 3,
//         texturePath: "/textures/awwords.png",
//         position: new THREE.Vector3(0, 0, 1.5),
//     },
// ];

// const transitionController = {
//     transition: 1, // 1 = fully visible, 0 = fully transitioned
//     _transition: uniform(1),
//     useTexture: true,
//     _useTexture: uniform(1),
//     texture: 1,
//     threshold: uniform(0.3),
//     scene: 0,
// };

// init();

// function init() {
//     renderer = new THREE.WebGPURenderer({ antialias: true });
//     renderer.setPixelRatio(window.devicePixelRatio);
//     renderer.setSize(window.innerWidth, window.innerHeight);
//     renderer.setAnimationLoop(render);
//     document.body.appendChild(renderer.domElement);
//     document.body.appendChild(stats.dom);

//     renderer.domElement.addEventListener("pointermove", onPointerMove);
//     renderer.domElement.addEventListener("mousedown", onMouseDown);
//     renderer.domElement.addEventListener("mouseup", onMouseUp);

//     const loader = new THREE.TextureLoader();
//     transitionTexturePaths.forEach(path => transitionTextures.push(loader.load(path)));

//     new HDRLoader().load(hdrPath, texture => {
//         texture.mapping = THREE.EquirectangularReflectionMapping;
//         hdrMap = texture;
//         setupScenes();
//         setupPostProcessing();
//         setupGUI();
//         scenesInitialized = true;
//     });
//     window.addEventListener("resize", onWindowResize);
// }

// // --- Scene Creation (No changes here) ---
// function createMainScene() {
//     const scene = new THREE.Scene();
//     scene.environment = glassSettings.envMap;
//     const camera = new THREE.PerspectiveCamera(
//         75,
//         window.innerWidth / window.innerHeight,
//         0.1,
//         1000
//     );
//     camera.position.set(5, 4, 5);
//     // camera.add(listener);
//     const controls = new OrbitControls(camera, renderer.domElement);
//     controls.target.set(0, 1, 0);
//     const raycaster = new THREE.Raycaster();

//     // Initialize the AudioManager
//     audioManager.initialize(camera);

//     // Load 2D sounds
//     audioManager.load2DSound("energy", "/sounds/energy-hum.mp3", {
//         loop: true,
//         volume: 0.5,
//     });

//     scene.add(new THREE.AmbientLight(0xffffff, 0.3));
//     const environment = new Environment(normalMapTexture, normalMapTexture);
//     scene.add(environment.mesh);

//     // Clear the global stands array and repopulate it from the config
//     const stands: AwwordStand[] = [];
//     standConfigurations.forEach(config => {
//         // The 'id' from the config is now correctly used as the sceneIndex
//         const stand = new AwwordStand(config.position, config.texturePath, hdrMap, config.id);
//         scene.add(stand.mesh);
//         stands.push(stand);
//     });

//     return { scene, camera, controls, stands, environment, raycaster };
// }

// function createStandScene(standId: number) {
//     const scene = new THREE.Scene();
//     const camera = new THREE.PerspectiveCamera(
//         60,
//         window.innerWidth / window.innerHeight,
//         0.1,
//         100
//     );
//     camera.position.set(0, 2, 4);
//     const controls = new OrbitControls(camera, renderer.domElement);
//     controls.target.set(0, 1, 0);
//     const raycaster = new THREE.Raycaster();
//     scene.add(new THREE.AmbientLight(0xffffff, 0.3));

//     // Find the configuration for the requested stand ID
//     const config = standConfigurations.find(c => c.id === standId);
//     if (!config) {
//         console.error(`No configuration found for standId: ${standId}`);
//         return;
//     }

//     const stand = new AwwordStand(new THREE.Vector3(0, 0, 0), config.texturePath, hdrMap, standId);
//     scene.add(stand.mesh);

//     let environment;
//     switch (standId) {
//         case 1:
//             environment = new Stand1Environment(normalMapTexture, normalMapTexture);
//             break;
//         case 2:
//             environment = new Stand2Environment(normalMapTexture, normalMapTexture);
//             break;
//         case 3:
//             environment = new Stand3Environment(normalMapTexture, normalMapTexture);
//             break;
//         default:
//             // Optional: fallback for any other case
//             console.warn(`No specific environment for standId: ${standId}`);
//             break;
//     }

//     if (environment) {
//         scene.add(environment.mesh);
//     }

//     // Return the environment so its update loop can be called
//     return { scene, camera, controls, stands: [stand], raycaster, environment };
// }

// function setupScenes() {
//     scenes.push(createMainScene()); // Scene 0

//     // Create detail scenes based on the configuration array
//     standConfigurations.forEach(config => {
//         // Ensure scenes are added in the correct order to match their ID
//         // This line assumes your stand IDs are 1, 2, 3...
//         const id: number = config.id;
//         const standScene = createStandScene(config.id);
//         if (standScene) {
//             scenes[id] = standScene;
//         }
//     });
// }

// function prepareScenePass(scene: THREE.Scene, camera: THREE.Camera, isFirstScene = false) {
//     const scenePass = pass(scene, camera);
//     scenePass.setMRT(
//         mrt({
//             output,
//             velocity,
//         })
//     );
//     const sceneColor = scenePass.getTextureNode();
//     const sceneViewZ = scenePass.getViewZNode();
//     const scenePassBlurred = boxBlur(sceneColor, {
//         size: postProcessingParams.blurSize,
//         separation: postProcessingParams.blurSpread,
//     });
//     const blur = smoothstep(
//         postProcessingParams.minDistance,
//         postProcessingParams.maxDistance,
//         sceneViewZ.sub(dofParams.focusDistance).abs()
//     );
//     const dofPass = mix(sceneColor, scenePassBlurred, blur);
//     const localBloomNode = bloom(
//         dofPass,
//         postProcessingParams.bloomStrength,
//         postProcessingParams.bloomRadius,
//         postProcessingParams.bloomThreshold
//     );
//     if (isFirstScene) {
//         bloomNode = localBloomNode;
//     }
//     const dofAndBloom = dofPass.add(localBloomNode);
//     const finalPass = fxaa(dofAndBloom);
//     return finalPass;
// }

// function setupPostProcessing() {
//     postprocessing = new THREE.PostProcessing(renderer);
//     scenes.forEach((sceneData, index) => {
//         const isFirst = index === 0;
//         const sPass = prepareScenePass(sceneData.scene, sceneData.camera, isFirst);
//         scenePasses.push(sPass);
//     });

//     // transitionEffect = transition(
//     //     null, // We'll set these inputs dynamically
//     //     null,
//     //     texture(transitionTextures[transitionController.texture]),
//     //     transitionController._transition,
//     //     transitionController.threshold,
//     //     transitionController._useTexture
//     // );

//     postprocessing.outputNode = scenePasses[0];
// }

// function startTransition(target) {
//     const fromSceneIndex = activeSceneIndex; // Correctly capture the outgoing scene index
//     targetSceneIndex = target;
//     if (targetSceneIndex === fromSceneIndex || transitionActive) return;

//     transitionController.texture = target + 1;

//     uiManager.hideMessage("scene-context-message"); // Hide any previous context message
//     uiManager.hideMessage("hover-info");

//     if (targetSceneIndex === 0) {
//         uiManager.showMessage({
//             id: "transition-info",
//             content: "Returning to Main Scene",
//             side: "left",
//             duration: 1500,
//         });
//     } else {
//         // This is a persistent message with a close button
//         uiManager.showMessage({
//             id: "scene-context-message",
//             content: `Viewing Stand ${targetSceneIndex}`,
//             side: "left",
//             persistent: true,
//             showCloseButton: true,
//             onClose: () => {
//                 // The callback triggers a transition back to the main scene
//                 startTransition(0);
//             },
//         });
//     }

//     transitionActive = true;

//     if (currentTransitionTween) {
//         currentTransitionTween.stop();
//     }

//     // --- Stop sounds from the outgoing scene ---
//     const sceneWeAreLeaving = scenes[fromSceneIndex]; // Use fromSceneIndex here
//     if (sceneWeAreLeaving && sceneWeAreLeaving.stands) {
//         sceneWeAreLeaving.stands.forEach(stand => {
//             // It's good practice to also reset the visual state
//             stand.isSelected = false;
//             if (stand.waveSound && stand.waveSound.isPlaying) {
//                 stand.waveSound.stop();
//             }
//         });
//     }

//     // Immediately update the application's true state.
//     activeSceneIndex = targetSceneIndex;

//     const toScene = scenes[fromSceneIndex]; // The new scene is the target
//     const fromScene = scenes[activeSceneIndex]; // The old scene is the source

//     let oldPostprocessing = postprocessing;

//     postprocessing = null;

//     postprocessing = new THREE.PostProcessing(renderer);

//     const toPass = prepareScenePass(toScene.scene, toScene.camera); // Pass for the scene we are going TO
//     const fromPass = prepareScenePass(fromScene.scene, fromScene.camera); // Pass for the scene we are coming FROM

//     const transitionEffect = transition(
//         toPass, // 'A' is the scene we are transitioning TO
//         fromPass, // 'B' is the scene we are transitioning FROM
//         texture(transitionTextures[transitionController.texture]),
//         transitionController._transition,
//         transitionController.threshold,
//         transitionController._useTexture
//     );
//     postprocessing.outputNode = transitionEffect;

//     // Reset the transition value to start from a fully visible state.
//     transitionController.transition = 1;
//     transitionController._transition.value = 1;

//     currentTransitionTween = new TWEEN.Tween(transitionController)
//         .to({ transition: 0 }, 1200)
//         .onUpdate(() => {
//             transitionController._transition.value = transitionController.transition;
//         })
//         .onComplete(() => {
//             oldPostprocessing.dispose();
//             oldPostprocessing = null;
//             currentTransitionTween = null;
//             transitionActive = false;
//             // Once the transition is complete, set the post-processing
//             // output directly to the new active scene's pass. This
//             // simplifies the render loop and removes the inactive transition effect.
//             postprocessing.outputNode = toPass;

//             uiManager.hideMessage("transition-info");
//         })
//         .start();
// }

// function setupGUI() {
//     const gui = new GUI();
//     const sceneFolder = gui.addFolder("Scene Control");
//     sceneFolder
//         .add(transitionController, "scene", {
//             "Main Scene": 0,
//             "Stand 1": 1,
//             "Stand 2": 2,
//             "Stand 3": 3,
//         })
//         .name("Active Scene")
//         .onChange(value => startTransition(value));

//     sceneFolder
//         .add(transitionController, "texture", {
//             1: 0,
//             2: 1,
//             3: 2,
//             4: 3,
//             5: 4,
//             6: 5,
//         })
//         .name("Transition Texture");

//     sceneFolder.open();

//     const glassFolder = gui.addFolder("Glass");
//     glassFolder.add(glassSettings.transmission, "value", 0, 1, 0.01).name("Transmission");
//     glassFolder.addColor(glassSettings.color, "value").name("Color");
//     glassFolder.add(glassSettings.ior, "value", 1, 2.333, 0.01).name("IOR");
//     glassFolder.add(glassSettings.metalness, "value", 0, 1, 0.01).name("Metalness");
//     glassFolder.add(glassSettings.thickness, "value", 0, 5, 0.1).name("Thickness");
//     glassFolder.add(glassSettings.roughness, "value", 0, 1, 0.01).name("Roughness");
//     glassFolder.add(glassSettings.envMapIntensity, "value", 0, 3, 0.1).name("Env Map Intensity");
//     glassFolder.add(glassSettings.clearcoat, "value", 0, 1, 0.01).name("Clearcoat");
//     glassFolder
//         .add(glassSettings.clearcoatRoughness, "value", 0, 1, 0.01)
//         .name("Clearcoat Roughness");
//     glassFolder.add(glassSettings.normalScale, "value", 0, 5, 0.01).name("Normal Scale");
//     glassFolder
//         .add(glassSettings.clearcoatNormalScale, "value", 0, 5, 0.01)
//         .name("Clearcoat Normal Scale");
//     glassFolder
//         .add({ normalRepeat: 1 }, "normalRepeat", 1, 4, 1)
//         .name("Normal Repeat")
//         .onChange(val => {
//             normalMapTexture.repeat.set(val, val);
//         });
//     const dofFolder = gui.addFolder("DOF");
//     // You can now control the focus falloff with these GUI elements
//     dofFolder.add(postProcessingParams.minDistance, "value", 0, 10).name("Min Distance");
//     dofFolder.add(postProcessingParams.maxDistance, "value", 0, 10).name("Max Distance");
//     dofFolder.add(postProcessingParams.blurSize, "value", 1, 10, 1).name("Blur Size");
//     dofFolder.add(postProcessingParams.blurSpread, "value", 1, 10, 1).name("Blur Spread");
//     if (bloomNode) {
//         const bloomFolder = gui.addFolder("Bloom");
//         bloomFolder.add(bloomNode.strength, "value", 0, 2).name("Strength");
//         bloomFolder.add(bloomNode.radius, "value", 0, 2).name("Radius");
//         bloomFolder.add(bloomNode.threshold, "value", 0, 2).name("Threshold");
//     }
// }

// function onWindowResize() {
//     // const activeSceneData = scenes[targetSceneIndex];
//     // activeSceneData.camera.aspect = window.innerWidth / window.innerHeight;
//     // activeSceneData.camera.updateProjectionMatrix();
//     scenes.forEach(sceneData => {
//         sceneData.camera.aspect = window.innerWidth / window.innerHeight;
//         sceneData.camera.updateProjectionMatrix();
//     });
//     renderer.setSize(window.innerWidth, window.innerHeight);
// }

// function onPointerMove(event: PointerEvent) {
//     dofParams.pointerCoords.x = (event.clientX / window.innerWidth) * 2 - 1;
//     dofParams.pointerCoords.y = -(event.clientY / window.innerHeight) * 2 + 1;
// }

// function onMouseDown(event: PointerEvent) {
//     lastClickedTime = Date.now();
//     clickPos.x = (event.clientX / window.innerWidth) * 2 - 1;
//     clickPos.y = (event.clientY / window.innerHeight) * 2 - 1;
// }
// let timerId: number | null = null;
// function onMouseUp(event: MouseEvent) {
//     if (Date.now() - lastClickedTime < 300 && !timerId) {
//         isClicked = true;
//         timerId = setTimeout(() => {
//             isClicked = false;
//             timerId = null;
//         }, 300);
//     }
// }

// async function render() {
//     TWEEN.update();
//     const deltaTime = clock.getDelta();
//     stats.update();

//     if (!scenesInitialized) return;

//     const activeSceneData = scenes[activeSceneIndex];
//     // if (activeSceneData.controls) activeSceneData.controls.update();
//     // We update the stands AFTER we determine which one is selected.

//     if (activeSceneData.raycaster) {
//         activeSceneData.raycaster.setFromCamera(dofParams.pointerCoords, activeSceneData.camera);

//         const intersects = activeSceneData.raycaster.intersectObjects(
//             activeSceneData.scene.children,
//             true
//         );

//         let hoveredStand = null;

//         if (intersects.length > 0) {
//             // Find the top-level stand group that was intersected
//             let intersectedObject = intersects[0].object;
//             while (intersectedObject) {
//                 if (intersectedObject.userData.isStand) {
//                     hoveredStand = intersectedObject.userData.parentStand;
//                     const isCanBeClicked =
//                         isClicked &&
//                         (transitionController.transition === 0 ||
//                             transitionController.transition === 1);
//                     if (isCanBeClicked) {
//                         const currentScene = scenes[hoveredStand.mesh.userData.sceneIndex];
//                         const nextScene = scenes[activeSceneIndex];
//                         if (nextScene !== currentScene) {
//                             startTransition(hoveredStand.mesh.userData.sceneIndex);
//                         }
//                     }
//                     break;
//                 }
//                 intersectedObject = intersectedObject.parent;
//             }
//         }

//         // Update the isSelected state for ALL stands in the scene
//         activeSceneData.stands.forEach(stand => {
//             stand.isSelected = stand === hoveredStand;
//         });

//         // --- DOF Logic (can be combined with hover detection) ---
//         if (hoveredStand) {
//             // If hovering a stand, focus on the intersection point
//             dofParams.targetFocusPoint.copy(intersects[0].point);
//         } else {
//             // Otherwise, focus on the camera's target
//             dofParams.targetFocusPoint.copy(activeSceneData.controls.target);
//         }

//         // if (activeSceneIndex === 0) {
//         //     if (hoveredStand) {
//         //         uiManager.showMessage({
//         //             id: "hover-info",
//         //             content: `Click to view Stand ${hoveredStand.id}`,
//         //             side: "right",
//         //             persistent: true, // Keep it visible while hovering
//         //         });
//         //     } else {
//         //         // If not hovering over anything, hide the message
//         //         uiManager.hideMessage("hover-info");
//         //     }
//         // }

//         dofParams.focusPoint.lerp(dofParams.targetFocusPoint, deltaTime * 5);

//         focusPointInViewSpace.copy(dofParams.focusPoint);
//         activeSceneData.camera.worldToLocal(focusPointInViewSpace);
//         dofParams.focusDistance.value = focusPointInViewSpace.z;
//     }

//     // Now update all stands. The correct one will show its selected state.
//     if (activeSceneData.stands) {
//         activeSceneData.stands.forEach(stand => stand.update(deltaTime, activeSceneData.camera));
//     }

//     if (activeSceneData.environment) activeSceneData.environment.update(deltaTime);

//     // Render the scene with post-processing
//     if (postprocessing) {
//         await postprocessing.renderAsync();
//     }
// }

import * as THREE from "three/webgpu";
import { pass, uniform, mrt, velocity, output, mix, smoothstep, texture } from "three/tsl";
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
    normalMapTexture,
    postProcessingParams,
    transitionTexturePaths,
} from "./config.js";
import Stats from "three/addons/libs/stats.module.js";
import { audioManager } from "./Audio/Audio.js";
import { uiManager } from "./UI/UIManager.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";

// --- Global Variables ---
let renderer: THREE.WebGPURenderer,
    postprocessing: THREE.PostProcessing,
    bloomNode: any,
    transitionEffect: any;

let hdrMap: THREE.Texture;
let gltfModel: THREE.Group;
const scenes: {
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    stands: AwwordStand[];
    controls: OrbitControls;
    raycaster: THREE.Raycaster;
    environment: Environment | Stand1Environment | Stand2Environment | Stand3Environment;
}[] = [];

const transitionTextures: THREE.Texture[] = [];
const clock = new THREE.Clock();
const stats = new Stats();
let transitionActive = false;
let lastHoveredStandId = null;
const focusPointInViewSpace = new THREE.Vector3();
// --- State Management ---
let activeSceneIndex = 0;
let targetSceneIndex = 0;
let scenesInitialized = false;
// let sceneControllerGUI;
let currentTransitionTween: Tween | null = null; // This will hold the active tween object
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
    texture: 1,
    threshold: uniform(0.3),
    scene: 0,
};

init();

function init() {
    uiManager.showMessage({
        id: "loading-screen",
        content: "Loading...",
        persistent: true,
    });

    renderer = new THREE.WebGPURenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setAnimationLoop(render);
    document.body.appendChild(renderer.domElement);
    document.body.appendChild(stats.dom);

    renderer.domElement.addEventListener("pointermove", onPointerMove);
    renderer.domElement.addEventListener("mousedown", onMouseDown);
    renderer.domElement.addEventListener("mouseup", onMouseUp);

    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath("https://www.gstatic.com/draco/v1/decoders/");
    const gltfLoader = new GLTFLoader();
    gltfLoader.setDRACOLoader(dracoLoader);

    gltfLoader.load("/models/env.glb", gltf => {
        gltfModel = gltf.scene;
        const loader = new THREE.TextureLoader();
        transitionTexturePaths.forEach(path => transitionTextures.push(loader.load(path)));

        new HDRLoader().load(hdrPath, texture => {
            texture.mapping = THREE.EquirectangularReflectionMapping;
            hdrMap = texture;
            setupScenes();
            setupPostProcessing();
            setupGUI();
            scenesInitialized = true;
            uiManager.hideMessage("loading-screen");
        });
    });

    window.addEventListener("resize", onWindowResize);
}

// --- Scene Creation (No changes here) ---
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
    // camera.add(listener);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 1, 0);
    const raycaster = new THREE.Raycaster();

    // Initialize the AudioManager
    audioManager.initialize(camera);

    // Load 2D sounds
    audioManager.load2DSound("energy", "/sounds/energy-hum.mp3", {
        loop: true,
        volume: 0.5,
    });

    scene.add(new THREE.AmbientLight(0xffffff, 0.3));
    const environment = new Environment(normalMapTexture, normalMapTexture);
    scene.add(environment.mesh);

    // Clear the global stands array and repopulate it from the config
    const stands: AwwordStand[] = [];
    standConfigurations.forEach(config => {
        // The 'id' from the config is now correctly used as the sceneIndex
        const stand = new AwwordStand(config.position, config.texturePath, hdrMap, config.id);
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

    // Find the configuration for the requested stand ID
    const config = standConfigurations.find(c => c.id === standId);
    if (!config) {
        console.error(`No configuration found for standId: ${standId}`);
        return;
    }

    const stand = new AwwordStand(new THREE.Vector3(0, 0, 0), config.texturePath, hdrMap, standId);
    scene.add(stand.mesh);

    let environment;
    switch (standId) {
        case 1:
            environment = new Stand1Environment(normalMapTexture, normalMapTexture, gltfModel);
            break;
        case 2:
            environment = new Stand2Environment(normalMapTexture, normalMapTexture, gltfModel);
            break;
        case 3:
            environment = new Stand3Environment(normalMapTexture, normalMapTexture, gltfModel);
            break;
        default:
            // Optional: fallback for any other case
            console.warn(`No specific environment for standId: ${standId}`);
            break;
    }

    if (environment) {
        scene.add(environment.mesh);
    }

    // Return the environment so its update loop can be called
    return { scene, camera, controls, stands: [stand], raycaster, environment };
}

function setupScenes() {
    scenes.push(createMainScene()); // Scene 0

    // Create detail scenes based on the configuration array
    standConfigurations.forEach(config => {
        // Ensure scenes are added in the correct order to match their ID
        // This line assumes your stand IDs are 1, 2, 3...
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
        postProcessingParams.bloomStrength,
        postProcessingParams.bloomRadius,
        postProcessingParams.bloomThreshold
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

    // transitionEffect = transition(
    //     null, // We'll set these inputs dynamically
    //     null,
    //     texture(transitionTextures[transitionController.texture]),
    //     transitionController._transition,
    //     transitionController.threshold,
    //     transitionController._useTexture
    // );

    postprocessing.outputNode = scenePasses[0];
}

function startTransition(target) {
    const fromSceneIndex = activeSceneIndex; // Correctly capture the outgoing scene index
    targetSceneIndex = target;
    if (targetSceneIndex === fromSceneIndex || transitionActive) return;

    transitionController.texture = target + 1;

    uiManager.hideMessage("scene-context-message"); // Hide any previous context message
    uiManager.hideMessage("hover-info");

    if (targetSceneIndex === 0) {
        uiManager.showMessage({
            id: "transition-info",
            content: "Returning to Main Scene",
            side: "left",
            duration: 1500,
        });
    } else {
        // This is a persistent message with a close button
        uiManager.showMessage({
            id: "scene-context-message",
            content: `Viewing Stand ${targetSceneIndex}`,
            side: "left",
            persistent: true,
            showCloseButton: true,
            onClose: () => {
                // The callback triggers a transition back to the main scene
                startTransition(0);
            },
        });
    }

    transitionActive = true;

    if (currentTransitionTween) {
        currentTransitionTween.stop();
    }

    // --- Stop sounds from the outgoing scene ---
    const sceneWeAreLeaving = scenes[fromSceneIndex]; // Use fromSceneIndex here
    if (sceneWeAreLeaving && sceneWeAreLeaving.stands) {
        sceneWeAreLeaving.stands.forEach(stand => {
            // It's good practice to also reset the visual state
            stand.isSelected = false;
            if (stand.waveSound && stand.waveSound.isPlaying) {
                stand.waveSound.stop();
            }
        });
    }

    // Immediately update the application's true state.
    activeSceneIndex = targetSceneIndex;

    const toScene = scenes[fromSceneIndex]; // The new scene is the target
    const fromScene = scenes[activeSceneIndex]; // The old scene is the source

    let oldPostprocessing = postprocessing;

    postprocessing = null;

    postprocessing = new THREE.PostProcessing(renderer);

    const toPass = prepareScenePass(toScene.scene, toScene.camera); // Pass for the scene we are going TO
    const fromPass = prepareScenePass(fromScene.scene, fromScene.camera); // Pass for the scene we are coming FROM

    const transitionEffect = transition(
        toPass, // 'A' is the scene we are transitioning TO
        fromPass, // 'B' is the scene we are transitioning FROM
        texture(transitionTextures[transitionController.texture]),
        transitionController._transition,
        transitionController.threshold,
        transitionController._useTexture
    );
    postprocessing.outputNode = transitionEffect;

    // Reset the transition value to start from a fully visible state.
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
            // Once the transition is complete, set the post-processing
            // output directly to the new active scene's pass. This
            // simplifies the render loop and removes the inactive transition effect.
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
        .add(transitionController, "texture", {
            1: 0,
            2: 1,
            3: 2,
            4: 3,
            5: 4,
            6: 5,
        })
        .name("Transition Texture");

    sceneFolder.open();

    const glassFolder = gui.addFolder("Glass");
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
        .onChange(val => {
            normalMapTexture.repeat.set(val, val);
        });
    const dofFolder = gui.addFolder("DOF");
    // You can now control the focus falloff with these GUI elements
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
    // const activeSceneData = scenes[targetSceneIndex];
    // activeSceneData.camera.aspect = window.innerWidth / window.innerHeight;
    // activeSceneData.camera.updateProjectionMatrix();
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
    // if (activeSceneData.controls) activeSceneData.controls.update();
    // We update the stands AFTER we determine which one is selected.

    if (activeSceneData.raycaster) {
        activeSceneData.raycaster.setFromCamera(dofParams.pointerCoords, activeSceneData.camera);

        const intersects = activeSceneData.raycaster.intersectObjects(
            activeSceneData.scene.children,
            true
        );

        let hoveredStand = null;

        if (intersects.length > 0) {
            // Find the top-level stand group that was intersected
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

        // Update the isSelected state for ALL stands in the scene
        activeSceneData.stands.forEach(stand => {
            stand.isSelected = stand === hoveredStand;
        });

        // --- DOF Logic (can be combined with hover detection) ---
        if (hoveredStand) {
            // If hovering a stand, focus on the intersection point
            dofParams.targetFocusPoint.copy(intersects[0].point);
        } else {
            // Otherwise, focus on the camera's target
            dofParams.targetFocusPoint.copy(activeSceneData.controls.target);
        }

        // if (activeSceneIndex === 0) {
        //     if (hoveredStand) {
        //         uiManager.showMessage({
        //             id: "hover-info",
        //             content: `Click to view Stand ${hoveredStand.id}`,
        //             side: "right",
        //             persistent: true, // Keep it visible while hovering
        //         });
        //     } else {
        //         // If not hovering over anything, hide the message
        //         uiManager.hideMessage("hover-info");
        //     }
        // }

        dofParams.focusPoint.lerp(dofParams.targetFocusPoint, deltaTime * 5);

        focusPointInViewSpace.copy(dofParams.focusPoint);
        activeSceneData.camera.worldToLocal(focusPointInViewSpace);
        dofParams.focusDistance.value = focusPointInViewSpace.z;
    }

    // Now update all stands. The correct one will show its selected state.
    if (activeSceneData.stands) {
        activeSceneData.stands.forEach(stand => stand.update(deltaTime, activeSceneData.camera));
    }

    if (activeSceneData.environment) activeSceneData.environment.update(deltaTime);

    // Render the scene with post-processing
    if (postprocessing) {
        await postprocessing.renderAsync();
    }
}
