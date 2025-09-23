import * as THREE from "three";
import { Howl } from "howler";

class AudioManager {
    constructor() {
        if (AudioManager.instance) {
            return AudioManager.instance;
        }

        this.listener = null;
        this.sounds2D = {};
        this.audioLoader = new THREE.AudioLoader();
        this.loadedBuffers = {};

        AudioManager.instance = this;
    }

    initialize(camera) {
        if (!this.listener) {
            this.listener = new THREE.AudioListener();
            camera.add(this.listener);
        }
    }

    load2DSound(name, path, options = {}) {
        this.sounds2D[name] = new Howl({
            src: [path],
            ...options,
        });
    }

    play2DSound(name) {
        if (this.sounds2D[name]) {
            if (this.sounds2D[name].playing()) {
                this.sounds2D[name].stop();
            }
            this.sounds2D[name].play();
        }
    }

    stop2DSound(name) {
        if (this.sounds2D[name] && this.sounds2D[name].playing()) {
            this.sounds2D[name].stop();
        }
    }

    loadPositionalSound(name, path, callback) {
        this.audioLoader.load(path, buffer => {
            this.loadedBuffers[name] = buffer;
            if (callback) {
                callback(buffer);
            }
        });
    }

    createPositionalSound() {
        if (!this.listener) {
            console.error("AudioManager not initialized. Call initialize(camera) first.");
            return null;
        }
        return new THREE.PositionalAudio(this.listener);
    }

    setBufferToSound(sound, bufferName) {
        const buffer = this.loadedBuffers[bufferName];
        if (buffer && sound) {
            sound.setBuffer(buffer);
        }
    }
}

export const audioManager = new AudioManager();
