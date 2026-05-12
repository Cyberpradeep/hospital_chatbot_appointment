import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';

const canvas = document.getElementById('vrm-canvas');
const shadowEl = document.getElementById('model-shadow');

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
    44,
    window.innerWidth / window.innerHeight,
    0.1, 20
);
camera.position.set(0, 1.1, 3.8);
camera.lookAt(0, 0.8, 0);

const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

scene.add(new THREE.AmbientLight(0xffffff, 1.6));
const key = new THREE.DirectionalLight(0xffffff, 1.2);
key.position.set(0.5, 2, 2);
scene.add(key);
const fill = new THREE.DirectionalLight(0xffffff, 0.4);
fill.position.set(-1, 0.5, 1);
scene.add(fill);

let vrm = null;
let vrmVisible = false;
let pendingShow = false;
let animState = 'idle';

const loader = new GLTFLoader();
loader.register(parser => new VRMLoaderPlugin(parser));
loader.load(
    '/static/model.vrm',
    (gltf) => {
        vrm = gltf.userData.vrm;
        VRMUtils.rotateVRM0(vrm);
        VRMUtils.removeUnnecessaryJoints(vrm.scene);
        vrm.scene.traverse((child) => {
            if (child.isSkinnedMesh) child.frustumCulled = false;
        });
        setIdlePose(vrm);
        vrm.scene.visible = false;
        scene.add(vrm.scene);
        console.log('[vrm] loaded');
        if (pendingShow) {
            pendingShow = false;
            _show();
        }
    },
    (p) => console.log('[vrm] loading', ((p.loaded / p.total) * 100 | 0) + '%'),
    (e) => console.warn('[vrm] load error — place your VRM at /static/model.vrm\n', e.message)
);

let prevTime = performance.now();
let elapsedTime = 0;
let lipPhase = 0;
let blinkTimer = 0;

const getBone = name => vrm?.humanoid?.getNormalizedBoneNode(name) ?? null;
const setExpr = (name, v) => vrm?.expressionManager?.setValue(name, v);

function setIdlePose(v) {
    const h = v.humanoid;
    const nb = n => h.getNormalizedBoneNode(n);
    if (nb('leftUpperArm')) nb('leftUpperArm').rotation.z = Math.PI / 3;
    if (nb('rightUpperArm')) nb('rightUpperArm').rotation.z = -Math.PI / 3;
    if (nb('leftLowerArm')) nb('leftLowerArm').rotation.z = 0.2;
    if (nb('rightLowerArm')) nb('rightLowerArm').rotation.z = -0.2;
    if (nb('leftHand')) nb('leftHand').rotation.z = 0.1;
    if (nb('rightHand')) nb('rightHand').rotation.z = -0.1;
    if (nb('spine')) nb('spine').rotation.x = 0.05;
    if (nb('chest')) nb('chest').rotation.x = -0.03;
    if (nb('head')) nb('head').rotation.x = 0.05;
}

function doIdle(dt, t) {
    const spine = getBone('spine');
    if (spine) {
        spine.rotation.z = Math.sin(t * 1.1) * 0.007;
        spine.rotation.x = 0.05 + Math.sin(t * 0.85) * 0.005;
    }
    const neck = getBone('neck');
    if (neck) {
        neck.rotation.y = Math.sin(t * 0.38) * 0.022;
        neck.rotation.z = Math.sin(t * 0.30) * 0.012;
    }
    blinkTimer += dt;
    const c = blinkTimer % 3.5;
    if (c < 0.06)
        setExpr('blink', c / 0.06);
    else if (c < 0.13)
        setExpr('blink', (0.13 - c) / 0.07);
    else
        setExpr('blink', 0);
}

function doBot(dt, t) {
    doIdle(dt, t);
    lipPhase += dt * 11;
    setExpr('aa', Math.max(0, Math.sin(lipPhase) * 0.5 + 0.3) * 0.85);
    const head = getBone('head');
    if (head)
        head.rotation.x = 0.05 + Math.sin(t * 4.8) * 0.03;
}

function doUser(dt, t) {
    doIdle(dt, t);
    setExpr('aa', 0);
    const spine = getBone('spine');
    if (spine) spine.rotation.x = 0.01 + Math.sin(t * 0.85) * 0.005;
}

(function animate() {
    requestAnimationFrame(animate);
    const now = performance.now();
    const dt = Math.min((now - prevTime) / 1000, 0.05);
    prevTime = now;
    elapsedTime += dt;
    const t = elapsedTime;

    if (vrm && vrmVisible) {
        if (animState === 'bot')
            doBot(dt, t);
        else if (animState === 'user')
            doUser(dt, t);
        else doIdle(dt, t);
        vrm.expressionManager?.update();
        vrm.update(dt);
    }
    renderer.render(scene, camera);
})();

function _show() {
    vrmVisible = true;
    vrm.scene.visible = true;
    shadowEl?.classList.remove('hidden');
}

window.vrmShow = () => {
    if (!vrm) {
        pendingShow = true;
        return;
    }
    _show();
};

window.vrmHide = () => {
    pendingShow = false;
    if (!vrm) return;
    vrmVisible = false;
    vrm.scene.visible = false;
    shadowEl?.classList.add('hidden');
};

window.vrmSetState = (state) => {
    animState = state;
    if (state !== 'bot')
        setExpr('aa', 0);
};
