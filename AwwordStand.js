import * as THREE from "three/webgpu";
import { float, vec3, texture, normalMap, color, Fn, viewportSharedTexture, hue, blendOverlay, posterize, grayscale, saturation, viewportSafeUV, screenUV, checker, uv, time, oscSine, output } from 'three/tsl';
import { glassSettings, normalMapTexture } from "./GlassSettings.js";

export class AwwordStand {
    constructor(position, texturePath, envMap) {
        this.standHeight = 2;
        this.radius = 1.3;
        this.texturePath = texturePath;
        this.envMap = envMap;
        this.mesh = this.createStand();
        this.mesh.position.copy(position);
    }

    createStand() {
        const standGroup = new THREE.Group();
        const textureLoader = new THREE.TextureLoader();

        const baseHeight = this.standHeight / 4;
        const topHeight = this.standHeight * (3 / 4);

        // Base Material
        const baseMaterial = new THREE.MeshPhysicalNodeMaterial({
            metalness: 0.7,
            roughness: 0,

        });
        baseMaterial.colorNode = vec3(0,0,0);

        // --- Realistic Glass Material ---
        const topMaterial = new THREE.MeshPhysicalNodeMaterial({
            colorNode: glassSettings.color,
            metalnessNode: glassSettings.metalness,
            roughnessNode: glassSettings.roughness,
            iorNode: glassSettings.ior,
            dispersion: glassSettings.dispersion.value,
            thicknessNode: glassSettings.thickness,
            clearcoatNode: glassSettings.clearcoat,
            envMap: texture(glassSettings.envMap),
            envMapIntensity: glassSettings.envMapIntensity.value,
            transmissionNode: glassSettings.transmission,
            specularIntensity: glassSettings.specularIntensity.value,
            specularColor: glassSettings.specularColor.value,
            opacityNode: glassSettings.opacity,
            side: THREE.DoubleSide,
            transparent: false,
            // clearcoatNormalNode: normalMap(
            //     texture(normalMapTexture),
            //     glassSettings.clearcoatNormalScale
            // ),
            backdropNode: blendOverlay( viewportSharedTexture().rgb, checker( uv().mul( 10 ) ) )
            // backdropAlphaNode:
        });

    //     topMaterial.castShadowPositionNode = Fn( () => {

				// 	// optional: add some distortion to the geometry shadow position if needed

				// 	return positionLocal;

				// } )();

				// topMaterial.castShadowNode = Fn( () => {

				// 	const refractionVector = refract( positionViewDirection.negate(), normalView, div( 1.0, topMaterial.ior ) ).normalize();
				// 	const viewZ = normalView.z.pow( causticOcclusion );

				// 	const textureUV = refractionVector.xy.mul( .6 );

				// 	const causticColor = uniform( topMaterial.color );
				// 	const chromaticAberrationOffset = normalView.z.pow( - .9 ).mul( .004 );

				// 	const causticProjection = vec3(
				// 		texture( causticMap, textureUV.add( vec2( chromaticAberrationOffset.x.negate(), 0 ) ) ).r,
				// 		texture( causticMap, textureUV.add( vec2( 0, chromaticAberrationOffset.y.negate() ) ) ).g,
				// 		texture( causticMap, textureUV.add( vec2( chromaticAberrationOffset.x, chromaticAberrationOffset.y ) ) ).b
				// 	);

				// 	return causticProjection.mul( viewZ.mul( 25 ) ).add( viewZ ).mul( causticColor );

				// } )();

        // const topMaterial = new THREE.MeshPhysicalNodeMaterial();
				// topMaterial.side = THREE.DoubleSide;
				// topMaterial.transparent = true;
				// topMaterial.color = new THREE.Color( 0xFFD700 );
				// topMaterial.transmission = 1;
				// topMaterial.thickness = .25;
				// topMaterial.ior = 1.5;
				// topMaterial.metalness = 0;
				// topMaterial.roughness = .1;

        // Base Geometry
        const baseGeometry = new THREE.BoxGeometry(this.radius, baseHeight, this.radius);
        const baseMesh = new THREE.Mesh(baseGeometry, baseMaterial);
        baseMesh.position.y = baseHeight / 2.1;

        // Top Geometry (using the new glass material)
        const topGeometry = new THREE.BoxGeometry(this.radius, topHeight, this.radius);
        const topMesh = new THREE.Mesh(topGeometry, topMaterial);
        topMesh.position.y = baseHeight + topHeight / 2;

        // --- Textured Plane ---
        const imageTexture = textureLoader.load(this.texturePath);
        imageTexture.flipY = true;

        const planeMaterial = new THREE.MeshStandardNodeMaterial({
          side: THREE.DoubleSide,
          colorNode: texture(imageTexture),
          roughness: 0.5,
        });
        // planeMaterial.emissionNode = Fn(() => {
        //     return vec3(1.0);
        // })();
        // planeMaterial.emissionIntensity = 0.5;

        const planeSize = this.radius * 0.8;
        const planeGeometry = new THREE.PlaneGeometry(planeSize, planeSize);
        const planeMesh = new THREE.Mesh(planeGeometry, planeMaterial);
        planeMesh.position.y = baseHeight + topHeight / 2;

        // Store a reference to the plane for the update loop
        this.planeMesh = planeMesh;

        standGroup.add(baseMesh);
        standGroup.add(topMesh);
        standGroup.add(planeMesh);

        return standGroup;
    }

    update(deltaTime, camera) {
        if (!this.planeMesh || !camera) return;

        // Calculate target rotation
        const targetQuaternion = new THREE.Quaternion();
        const targetPosition = new THREE.Vector3();
        // The billboard should look at the camera's world position
        this.planeMesh.getWorldPosition(targetPosition);
        targetPosition.add(camera.position.clone().sub(targetPosition).normalize());
        const dummy = new THREE.Object3D();
        dummy.lookAt(camera.position);
        targetQuaternion.copy(dummy.quaternion);

        // Interpolate towards the target rotation
        this.planeMesh.quaternion.slerp(targetQuaternion, deltaTime * 5);
    }
}
