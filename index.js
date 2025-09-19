import * as THREE from "three/webgpu";
import { vec3, pass, uniform, mix, smoothstep, mrt, velocity, output, screenUV } from "three/tsl";
import { boxBlur } from "three/addons/tsl/display/boxBlur.js";
import { fxaa } from "three/addons/tsl/display/FXAANode.js";
import { bloom } from "three/addons/tsl/display/BloomNode.js";
import { motionBlur } from "three/addons/tsl/display/MotionBlur.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { AwwordStand } from "./AwwordStand.js";
import { Environment } from "./Environment.js";
import { HDRLoader } from "three/addons/loaders/HDRLoader.js";
import { GUI } from "three/addons/libs/lil-gui.module.min.js";
import { glassSettings, normalMapTexture } from "./GlassSettings.js";
import Stats from "three/addons/libs/stats.module.js";

const textures = [
    "assets/textures/awwords.png",
    "assets/textures/cssAwwords.png",
    "assets/textures/texture1.png",
];
const hdrPath = "https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/venice_sunset_1k.hdr";

let camera, scene, renderer, postprocessing, controls, raycaster, environment, bloomNode;
let bulbLight, bulbMat, hemiLight;
let previousShadowMap = false;

const stands = [];
const clock = new THREE.Clock();
const stats = new Stats();

// --- Lighting Constants  ---
// ref for lumens: http://www.power-sure.com/lumens.htm
const bulbLuminousPowers = {
    "110000 lm (1000W)": 110000,
    "3500 lm (300W)": 3500,
    "1700 lm (100W)": 1700,
    "800 lm (60W)": 800,
    "400 lm (40W)": 400,
    "180 lm (25W)": 180,
    "20 lm (4W)": 20,
    Off: 0,
};

// ref for solar irradiances: https://en.wikipedia.org/wiki/Lux
const hemiLuminousIrradiances = {
    "0.0001 lx (Moonless Night)": 0.0001,
    "0.002 lx (Night Airglow)": 0.002,
    "0.5 lx (Full Moon)": 0.5,
    "3.4 lx (City Twilight)": 3.4,
    "50 lx (Living Room)": 50,
    "100 lx (Very Overcast)": 100,
    "350 lx (Office Room)": 350,
    "400 lx (Sunrise/Sunset)": 400,
    "1000 lx (Overcast)": 1000,
    "18000 lx (Daylight)": 18000,
    "50000 lx (Direct Sun)": 50000,
};

const lightParams = {
    shadows: false,
    exposure: 0.95,
    bulbPower: Object.keys(bulbLuminousPowers)[6],
    hemiIrradiance: Object.keys(hemiLuminousIrradiances)[3],
    color: new THREE.Color("#fafafa"),
};

// Post-Processing Uniforms
const blurAmount = uniform(1);
const blurSize = uniform(2);
const blurSpread = uniform(4);
const minDistance = uniform(1);
const maxDistance = uniform(3);
const bloomStrength = uniform(0.1);
const bloomRadius = uniform(0.23);
const bloomThreshold = uniform(0.373);

// DOF settings
const pointerCoords = new THREE.Vector2();
const focusPoint = new THREE.Vector3(0, 1, 0); // World-space focus point
const targetFocusPoint = new THREE.Vector3(0, 1, 0);
const focusPointView = uniform(new THREE.Vector3()); // View-space focus point (for shader)

init();

function init() {
    // Scene
    scene = new THREE.Scene();

    // Camera
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(5, 4, 5);
    camera.lookAt(0, 1, 0);

    // Renderer
    renderer = new THREE.WebGPURenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setAnimationLoop(render);

    // --- Renderer settings from lighting example ---
    renderer.shadowMap.enabled = true;
    renderer.toneMapping = THREE.ReinhardToneMapping;

    document.body.appendChild(renderer.domElement);
    document.body.appendChild(stats.dom);

    // Raycaster
    raycaster = new THREE.Raycaster();

    // --- Physical Lights (from example) ---
    const bulbGeometry = new THREE.SphereGeometry(0.05, 16, 8); // Made bulb a bit bigger
    bulbLight = new THREE.PointLight(new THREE.Color(lightParams.color), 1, 100, 2);

    bulbMat = new THREE.MeshStandardMaterial({
        emissive: new THREE.Color(lightParams.color),
        emissiveIntensity: 1,
        color: new THREE.Color(lightParams.color),
    });
    // bulbLight.add(new THREE.Mesh(bulbGeometry, bulbMat));
    bulbLight.position.set(0, 3, 0); // Position light above scene
    bulbLight.castShadow = true;
    // scene.add(bulbLight);

    hemiLight = new THREE.HemisphereLight(
        new THREE.Color(lightParams.color),
        new THREE.Color(lightParams.color),
        0.02
    );
    scene.add(hemiLight);

    // --- Post-processing setup ---
    postprocessing = new THREE.PostProcessing(renderer);

    const scenePass = pass(scene, camera);
    scenePass.setMRT(
        mrt({
            output,
            velocity,
        })
    );

    const sceneColor = scenePass.getTextureNode();
    const sceneVelocity = scenePass.getTextureNode("velocity").mul(blurAmount);
    const sceneViewZ = scenePass.getViewZNode();

    const scenePassBlurred = boxBlur(sceneColor, { size: blurSize, separation: blurSpread });
    const blur = smoothstep(minDistance, maxDistance, sceneViewZ.sub(focusPointView.z).abs());
    const dofPass = mix(sceneColor, scenePassBlurred, blur);

    bloomNode = bloom(dofPass, bloomStrength, bloomRadius, bloomThreshold);
    const dofAndBloom = dofPass.add(bloomNode);
    const finalPass = fxaa(dofAndBloom);

    postprocessing.outputNode = finalPass;

    // Controls
    controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 1, 0);

    // Add camera to scene
    scene.add(camera);

    // Load environment map and then build the scene
    new HDRLoader().load(hdrPath, texture => {
        texture.mapping = THREE.EquirectangularReflectionMapping;
        // scene.environment = glassSettings.envMap
        setupSceneTSL(texture);
        setupGUI();
    });

    window.addEventListener("resize", onWindowResize);
    renderer.domElement.addEventListener("pointermove", onPointerMove);
}

const setupGUI = () => {
    const gui = new GUI();

    // --- Lighting GUI (from example) ---
    const lightFolder = gui.addFolder("Lighting");
    lightFolder.add(lightParams, "hemiIrradiance", Object.keys(hemiLuminousIrradiances));
    lightFolder.add(lightParams, "bulbPower", Object.keys(bulbLuminousPowers));
    lightFolder.add(lightParams, "exposure", 0, 1);
    lightFolder.add(lightParams, "shadows");
    lightFolder.addColor(lightParams, "color").onChange(() => {
        bulbMat.color = lightParams.color;
        hemiLight.color = lightParams.color;
    });
    lightFolder.open();

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
    dofFolder.add(minDistance, "value", 0, 10).name("Min Distance");
    dofFolder.add(maxDistance, "value", 0, 10).name("Max Distance");
    dofFolder.add(blurSize, "value", 1, 10, 1).name("Blur Size");
    dofFolder.add(blurSpread, "value", 1, 10, 1).name("Blur Spread");

    const bloomFolder = gui.addFolder("Bloom");
    bloomFolder.add(bloomNode.strength, "value", 0, 1).name("Bloom strength");
    bloomFolder.add(bloomNode.radius, "value", 0, 1).name("Bloom radius");
    bloomFolder.add(bloomNode.threshold, "value", 0.1, 1).name("Bloom threshold");

    if (environment && environment.floorReflection) {
        const reflectionFolder = gui.addFolder("Floor Reflection");
        reflectionFolder
            .add(environment.floorReflection.roughness, "value", 0, 1)
            .name("Roughness");
        reflectionFolder.add(environment.floorReflection.normalScale, "value", 0, 1).name("Scale");
        reflectionFolder
            .add(environment.floorReflection.reflector, "resolutionScale", 0.25, 1)
            .name("Resolution Scale");
    }
};

function onPointerMove(event) {
    pointerCoords.x = (event.clientX / window.innerWidth) * 2 - 1;
    pointerCoords.y = -(event.clientY / window.innerHeight) * 2 + 1;
}

function setupSceneTSL(envMap) {
    // Environment
    environment = new Environment(normalMapTexture, normalMapTexture);
    environment.mesh.receiveShadow = true; // <-- Enable shadows
    scene.add(environment.mesh);

    // Stand Positions
    const locations = [
        { position: new THREE.Vector3(0, 0, 1.5) },
        { position: new THREE.Vector3(-3, 0, -1) },
        { position: new THREE.Vector3(3, 0, -1) },
    ];

    locations.forEach((loc, index) => {
        const stand = new AwwordStand(loc.position, textures[index], envMap);

        // --- Enable shadows on stands and their children ---
        stand.mesh.traverse(function (child) {
            if (child.isMesh) {
                child.castShadow = true;
            }
        });

        scene.add(stand.mesh);
        stands.push(stand);
    });
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

async function render() {
    const deltaTime = clock.getDelta();
    const elapsedTime = clock.getElapsedTime();

    // --- Update Logic from Lighting Example ---
    renderer.toneMappingExposure = Math.pow(lightParams.exposure, 5.0); // to allow for very bright scenes.
    renderer.shadowMap.enabled = lightParams.shadows;
    bulbLight.castShadow = lightParams.shadows;

    if (lightParams.shadows !== previousShadowMap) {
        // This is a good place to update materials if needed, but often not necessary with WebGPU
        previousShadowMap = lightParams.shadows;
    }

    bulbLight.power = bulbLuminousPowers[lightParams.bulbPower];
    bulbMat.emissiveIntensity = bulbLight.intensity / Math.pow(0.05, 2.0); // convert from intensity to irradiance at bulb surface

    hemiLight.intensity = hemiLuminousIrradiances[lightParams.hemiIrradiance];

    bulbLight.position.y = Math.cos(elapsedTime) * 0.75 + 3.0; // Adjusted height for this scene

    // --- Original Render Logic ---
    if (controls) {
        controls.update();
    }

    raycaster.setFromCamera(pointerCoords, camera);
    const intersects = raycaster.intersectObjects(
        stands.map(s => s.mesh),
        true
    );

    if (intersects.length > 0) {
        targetFocusPoint.copy(intersects[0].point);
    } else {
        targetFocusPoint.set(0, 1, 0);
    }

    focusPoint.lerp(targetFocusPoint, deltaTime * 5);

    camera.updateMatrixWorld();
    focusPointView.value.copy(focusPoint).applyMatrix4(camera.matrixWorldInverse);

    stands.forEach(stand => stand.update(deltaTime, camera));
    if (environment) environment.update(deltaTime);

    if (stats) stats.update();

    if (postprocessing) await postprocessing.renderAsync();
}
