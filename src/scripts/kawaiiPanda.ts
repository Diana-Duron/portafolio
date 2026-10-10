// src/scripts/kawaiiPanda.ts
// Panda kawaii en Three.js, compartido por el Hero y la sección de Experiencia.
// Parpadea, mueve las orejas, sigue el cursor con la mirada y ladea la cabeza.
// Si le haces clic (o lo "acaricias" frotando el cursor) se sonroja, cierra los
// ojitos ^^, da saltitos y suelta corazones.
import * as THREE from 'three';

export interface KawaiiPandaOptions {
    canvas: HTMLCanvasElement;
    /** Elemento que define el tamaño del canvas y recibe los clics */
    host: HTMLElement;
    cameraZ: number;
    /** Posición del panda en la escena (se recalcula al redimensionar) */
    placement?: () => [number, number, number];
    /** Si es true, el panda se arma pieza a pieza cada vez que aparece en pantalla */
    assemble?: boolean;
}

const COLORS = {
    pink: 0xffd1dc,
    purple: 0x3b1c4a,
    cream: 0xfff5f8,
    blush: 0xff8fab,
    heart: 0xff7aa2,
    white: 0xffffff,
};

// Semiejes de la cabeza: un poco más ancha que alta, como un mochi
const HEAD = new THREE.Vector3(2.1, 1.92, 2);
const Y_AXIS = new THREE.Vector3(0, 1, 0);
const Z_AXIS = new THREE.Vector3(0, 0, 1);
const NO_ROTATION = new THREE.Quaternion();
const PART_DURATION = 0.75;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const rand = (min: number, max: number) => min + Math.random() * (max - min);
// Acerca `current` a `target` con suavidad y sin depender de los FPS
const damp = (current: number, target: number, rate: number, dt: number) =>
    current + (target - current) * (1 - Math.exp(-rate * dt));
const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;

// Llega, se pasa un poquito y regresa: el "boing" de las piezas
function easeOutBack(t: number) {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;
}

// Resorte amortiguado: el toque gelatinoso de orejas, cuerpo y cabeza
class Spring {
    value = 0;
    velocity = 0;
    stiffness: number;
    damping: number;

    constructor(stiffness: number, damping: number) {
        this.stiffness = stiffness;
        this.damping = damping;
    }

    update(target: number, dt: number) {
        const accel = (target - this.value) * this.stiffness - this.velocity * this.damping;
        this.velocity += accel * dt;
        this.value += this.velocity * dt;
        return this.value;
    }
}

type Vec3 = [number, number, number];

function mesh(geometry: THREE.BufferGeometry, material: THREE.Material, scale: Vec3, position: Vec3 = [0, 0, 0]) {
    const result = new THREE.Mesh(geometry, material);
    result.scale.set(...scale);
    result.position.set(...position);
    return result;
}

// Coloca el punto (x, y) de la cara sobre la superficie de la cabeza y orienta
// el objeto según la normal, para que ojos, nariz y rubor queden "pegados"
function onFace(object: THREE.Object3D, x: number, y: number, lift: number) {
    const nx = x / HEAD.x;
    const ny = y / HEAD.y;
    const z = HEAD.z * Math.sqrt(Math.max(1 - nx * nx - ny * ny, 0));
    const normal = new THREE.Vector3(x / HEAD.x ** 2, y / HEAD.y ** 2, z / HEAD.z ** 2).normalize();
    object.quaternion.setFromUnitVectors(Z_AXIS, normal);
    return new THREE.Vector3(x, y, z).addScaledVector(normal, lift);
}

function createHeartGeometry() {
    const shape = new THREE.Shape();
    shape.moveTo(0, -0.55);
    shape.bezierCurveTo(-0.1, -0.42, -0.6, -0.12, -0.6, 0.15);
    shape.bezierCurveTo(-0.6, 0.45, -0.2, 0.6, 0, 0.32);
    shape.bezierCurveTo(0.2, 0.6, 0.6, 0.45, 0.6, 0.15);
    shape.bezierCurveTo(0.6, -0.12, 0.1, -0.42, 0, -0.55);
    const geometry = new THREE.ExtrudeGeometry(shape, {
        depth: 0.14,
        bevelEnabled: true,
        bevelThickness: 0.08,
        bevelSize: 0.07,
        bevelSegments: 2,
        curveSegments: 10,
    });
    geometry.center();
    return geometry;
}

interface Part {
    slot: THREE.Group;
    home: THREE.Vector3;
    scatter: THREE.Vector3;
    scatterRotation: THREE.Quaternion;
    delay: number;
}

function createPanda() {
    const materials = {
        pink: new THREE.MeshStandardMaterial({ color: COLORS.pink, flatShading: true, roughness: 0.7 }),
        purple: new THREE.MeshStandardMaterial({ color: COLORS.purple, flatShading: true, roughness: 0.8 }),
        eye: new THREE.MeshStandardMaterial({ color: COLORS.cream, roughness: 0.4 }),
        pupil: new THREE.MeshStandardMaterial({ color: COLORS.purple, roughness: 0.2 }),
        shine: new THREE.MeshBasicMaterial({ color: COLORS.white }),
        blush: new THREE.MeshBasicMaterial({ color: COLORS.blush, transparent: true, opacity: 0.5, depthWrite: false }),
        heart: new THREE.MeshStandardMaterial({
            color: COLORS.heart,
            emissive: COLORS.heart,
            emissiveIntensity: 0.25,
            flatShading: true,
            roughness: 0.5,
        }),
    };
    const geometries = {
        blob: new THREE.IcosahedronGeometry(1, 2),
        ear: new THREE.IcosahedronGeometry(1, 1),
        ball: new THREE.SphereGeometry(1, 24, 16),
        arc: new THREE.TorusGeometry(1, 0.26, 8, 24, Math.PI),
        disc: new THREE.CircleGeometry(1, 32),
        halfDisc: new THREE.CircleGeometry(1, 24, Math.PI, Math.PI),
        heart: createHeartGeometry(),
    };

    // Jerarquía: root (posición y saltos) > spin (giro al armarse)
    // > squash (estirar/aplastar desde la base) > head (mirada e inclinación)
    const root = new THREE.Group();
    const spin = new THREE.Group();
    const squash = new THREE.Group();
    const head = new THREE.Group();
    squash.position.y = -HEAD.y;
    head.position.y = HEAD.y;
    head.rotation.order = 'YXZ';
    root.add(spin);
    spin.add(squash);
    squash.add(head);

    // Cada pieza vive en un "slot" que mueve el armado; lo de adentro lo animan los gestos
    const parts: Part[] = [];
    const addPart = (content: THREE.Object3D, home: THREE.Vector3, delay: number) => {
        const slot = new THREE.Group();
        slot.position.copy(home);
        slot.add(content);
        head.add(slot);
        const i = parts.length;
        parts.push({
            slot,
            home,
            delay,
            scatter: new THREE.Vector3(Math.cos(i * 2.4) * 5.5, Math.sin(i * 2.4) * 4.5, Math.sin(i * 3.7) * 2),
            scatterRotation: new THREE.Quaternion().setFromEuler(new THREE.Euler(i, i * 2, i * 3)),
        });
    };

    // Cabeza
    addPart(mesh(geometries.blob, materials.pink, [HEAD.x, HEAD.y, HEAD.z]), new THREE.Vector3(), 0);

    // Orejas: giran desde la base para poder sacudirse
    const ears = ([-1, 1] as const).map((side, i) => {
        const direction = new THREE.Vector3(1.45 * side, 1.55, -0.3).normalize();
        const orient = new THREE.Group();
        orient.quaternion.setFromUnitVectors(Y_AXIS, direction);
        const wiggle = new THREE.Group();
        wiggle.add(mesh(geometries.ear, materials.purple, [0.62, 0.56, 0.4], [0, 0.5, 0]));
        orient.add(wiggle);
        const toSurface = 1 / Math.hypot(direction.x / HEAD.x, direction.y / HEAD.y, direction.z / HEAD.z);
        addPart(orient, direction.multiplyScalar(toSurface * 0.88), 0.35 + i * 0.08);
        return { wiggle, side };
    });

    // Manchas de los ojos, caídas hacia afuera como las de un panda de verdad
    ([-1, 1] as const).forEach((side, i) => {
        const orient = new THREE.Group();
        const patch = mesh(geometries.blob, materials.purple, [0.42, 0.56, 0.14]);
        patch.rotation.z = side * 0.42;
        orient.add(patch);
        addPart(orient, onFace(orient, side * 0.74, -0.14, -0.03), 0.6 + i * 0.08);
    });

    // Ojos grandes con brillitos, más la versión feliz ^^
    const eyes = ([-1, 1] as const).map((side, i) => {
        const orient = new THREE.Group();
        const open = new THREE.Group();
        const pupil = new THREE.Group();
        const shine = mesh(geometries.ball, materials.shine, [0.065, 0.065, 0.03], [0.07, 0.085, 0.09]);
        pupil.position.z = 0.1;
        pupil.add(
            mesh(geometries.ball, materials.pupil, [0.19, 0.22, 0.1]),
            shine,
            mesh(geometries.ball, materials.shine, [0.032, 0.032, 0.02], [-0.065, -0.08, 0.08]),
        );
        open.add(mesh(geometries.ball, materials.eye, [0.27, 0.3, 0.16]), pupil);
        const happy = mesh(geometries.arc, materials.eye, [0.2, 0.2, 0.2], [0, -0.08, 0.06]);
        happy.visible = false;
        orient.add(open, happy);
        addPart(orient, onFace(orient, side * 0.7, -0.1, 0.07), 0.85 + i * 0.07);
        return { open, pupil, shine, happy };
    });

    // Naricita
    const nose = new THREE.Group();
    nose.add(mesh(geometries.blob, materials.purple, [0.22, 0.15, 0.13]));
    addPart(nose, onFace(nose, 0, -0.44, 0.02), 1.05);

    // Boca "ω" que se abre en sonrisa cuando está feliz
    const mouth = new THREE.Group();
    const smile = new THREE.Group();
    ([-1, 1] as const).forEach((side) => {
        const arc = mesh(geometries.arc, materials.purple, [0.1, 0.1, 0.1], [side * 0.1, 0, 0]);
        arc.rotation.z = Math.PI;
        smile.add(arc);
    });
    const grin = new THREE.Group();
    grin.add(
        mesh(geometries.halfDisc, materials.purple, [0.17, 0.17, 1]),
        mesh(geometries.disc, materials.heart, [0.07, 0.07, 1], [0, -0.095, 0.004]),
    );
    grin.visible = false;
    mouth.add(smile, grin);
    addPart(mouth, onFace(mouth, 0, -0.64, 0.03), 1.15);

    // Rubor en los cachetes
    const blushes = ([-1, 1] as const).map((side, i) => {
        const orient = new THREE.Group();
        const blush = mesh(geometries.disc, materials.blush, [0.3, 0.17, 1]);
        orient.add(blush);
        addPart(orient, onFace(orient, side * 1.2, -0.76, 0.04), 1.25 + i * 0.06);
        return blush;
    });

    // Corazones reutilizables (viven en coordenadas de la escena, no del panda)
    const heartGroup = new THREE.Group();
    const hearts = Array.from({ length: 14 }, () => {
        const heartMesh = new THREE.Mesh(geometries.heart, materials.heart);
        heartMesh.visible = false;
        heartGroup.add(heartMesh);
        return { mesh: heartMesh, alive: false, age: 0, life: 1, size: 0.3, phase: 0, velocity: new THREE.Vector3() };
    });

    return {
        root,
        spin,
        squash,
        head,
        parts,
        ears,
        eyes,
        smile,
        grin,
        blushes,
        blushMaterial: materials.blush,
        heartGroup,
        hearts,
    };
}

export function mountKawaiiPanda({ canvas, host, cameraZ, placement, assemble = false }: KawaiiPandaOptions) {
    // Evita montar dos pandas sobre el mismo canvas
    if (canvas.dataset.panda) return;
    canvas.dataset.panda = 'on';

    const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const assembles = assemble && !calm;

    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    camera.position.z = cameraZ;

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 5, 5);
    // Relleno rosado suave: sombras pastel en vez de apagadas
    const fillLight = new THREE.HemisphereLight(COLORS.white, COLORS.pink, 0.35);
    // Contraluz: recorta orejas y silueta sobre el fondo oscuro
    const rimLight = new THREE.DirectionalLight(COLORS.pink, 3.5);
    rimLight.position.set(-3, 4, -6);
    scene.add(ambientLight, directionalLight, fillLight, rimLight);

    const panda = createPanda();
    scene.add(panda.root, panda.heartGroup);

    // --- Tamaño y posición ---
    const basePosition = new THREE.Vector3();
    const resize = () => {
        const width = Math.max(host.clientWidth, 1);
        const height = Math.max(host.clientHeight, 1);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height);
        if (placement) basePosition.set(...placement());
    };
    resize();

    // --- Estado de los gestos ---
    let clock = 0;
    const squash = new Spring(260, 11);
    const tilt = new Spring(90, 9);
    const happySpring = new Spring(240, 15);
    const earSprings = panda.ears.map(() => new Spring(170, 7));
    const look = { yaw: 0, pitch: 0 };
    const gaze = new THREE.Vector2();
    let blushAmount = 0;
    let blinkStart = -Infinity;
    let nextBlinkAt = rand(1, 3);
    let nextEarAt = rand(2, 4);
    let nextTiltAt = rand(4, 7);
    let nextHopAt = rand(10, 16);
    let tiltTarget = 0;
    let tiltUntil = 0;
    let happyUntil = 0;
    // El panda que se arma ya celebra al terminar; el otro saluda al cargar
    let greeted = assemble || calm;
    let hopY = 0;
    let hopVelocity = 0;
    let hopPower = 1;
    let hopsLeft = 0;
    let crouchUntil = -1;

    const assemblyTotal = Math.max(...panda.parts.map((part) => part.delay)) + PART_DURATION;
    let assembly = assembles ? 0 : assemblyTotal;
    let assembled = !assembles;

    // --- Cursor ---
    const pointer = new THREE.Vector2();
    const raycaster = new THREE.Raycaster();
    const headSphere = new THREE.Sphere(new THREE.Vector3(), 2.3);
    const lookPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    const lookPoint = new THREE.Vector3();
    const headWorld = new THREE.Vector3();
    const headScreen = new THREE.Vector3();
    // Última posición del cursor en la ventana; se convierte a coordenadas del
    // canvas en cada frame para que siga siendo válida al hacer scroll
    const client = { x: 0, y: 0 };
    let pointerSeenAt = -Infinity;
    let hovered = false;
    let petting = 0;
    let nextPetHeartAt = 0;

    const updatePointer = (rect: DOMRect) => {
        pointer.set(((client.x - rect.left) / rect.width) * 2 - 1, -((client.y - rect.top) / rect.height) * 2 + 1);
    };

    const isOverPanda = () => {
        panda.head.getWorldPosition(headSphere.center);
        raycaster.setFromCamera(pointer, camera);
        return raycaster.ray.intersectsSphere(headSphere);
    };

    // --- Acciones ---
    // Saltito con anticipación: se agacha, sale estirado y aterriza aplastado
    const hop = (times: number, power: number) => {
        if (calm || crouchUntil > 0 || hopY > 0) return;
        hopsLeft = times - 1;
        hopPower = power;
        crouchUntil = clock + 0.12;
    };

    const flickEar = (index: number) => {
        earSprings[index].velocity += rand(5, 8) * (Math.random() < 0.75 ? 1 : -1);
    };

    const spawnHeart = (delay = 0) => {
        const heart = panda.hearts.find((h) => !h.alive);
        if (!heart) return;
        panda.head.getWorldPosition(headWorld);
        heart.alive = true;
        heart.age = -delay;
        heart.life = rand(1.3, 1.8);
        heart.size = rand(0.28, 0.42);
        heart.phase = rand(0, Math.PI * 2);
        heart.mesh.position.set(rand(-1.4, 1.4), rand(1.5, 2.1), rand(1.2, 1.7)).add(headWorld);
        heart.velocity.set(rand(-0.8, 0.8), rand(1.6, 2.4), rand(0, 0.5));
    };

    const cheer = (heartCount = 6) => {
        happyUntil = clock + 1.8;
        hop(2, 1);
        for (let i = 0; i < heartCount; i++) spawnHeart(i * 0.06);
        earSprings.forEach((spring) => (spring.velocity += 6));
    };

    // --- Eventos ---
    const readPointer = (event: MouseEvent) => {
        client.x = event.clientX;
        client.y = event.clientY;
        pointerSeenAt = clock;
    };
    const onPointerMove = (event: PointerEvent) => {
        if (event.pointerType === 'touch') return;
        // Frotar el cursor sobre la cabeza cuenta como caricia
        const moved = Math.hypot(event.clientX - client.x, event.clientY - client.y);
        if (hovered) petting = Math.min(petting + Math.min(moved, 60) * 0.0025, 1.8);
        readPointer(event);
    };
    const onPointerLeave = () => {
        pointerSeenAt = -Infinity;
    };
    // `click` y no `pointerdown`: en móvil, empezar a hacer scroll encima no cuenta como toque
    const onClick = (event: MouseEvent) => {
        readPointer(event);
        updatePointer(canvas.getBoundingClientRect());
        if (isOverPanda()) cheer();
    };

    window.addEventListener('resize', resize);
    window.addEventListener('pointermove', onPointerMove);
    document.documentElement.addEventListener('pointerleave', onPointerLeave);
    host.addEventListener('click', onClick);

    // --- Bucle (solo corre mientras el canvas está en pantalla) ---
    let onScreen = false;
    let frameId = 0;
    let lastTime = 0;

    const animate = (now: number) => {
        if (!onScreen) {
            // Se pausa, y se desarma para volver a armarse al regresar
            frameId = 0;
            if (assembles) {
                assembly = 0;
                assembled = false;
            }
            return;
        }
        frameId = requestAnimationFrame(animate);
        const dt = Math.min((now - lastTime) * 0.001, 0.05);
        lastTime = now;
        clock += dt;

        // Ajustar la intensidad de la luz según el tema activo (más brillo en tema claro)
        const isDark = document.documentElement.classList.contains('dark');
        ambientLight.intensity = isDark ? 0.7 : 1.3;
        directionalLight.intensity = isDark ? 0.8 : 1.3;
        fillLight.intensity = isDark ? 0.35 : 0.6;
        rimLight.intensity = isDark ? 3.5 : 0.8;

        const rect = canvas.getBoundingClientRect();

        // 1. Armado: las piezas llegan en orden, con rebote, mientras el panda gira.
        //    Se arma cuando el propio panda (no solo su sección) está a la vista.
        if (assembles) {
            headScreen.copy(basePosition).project(camera);
            const pandaY = rect.top + (1 - headScreen.y) * 0.5 * rect.height;
            const inView = pandaY > window.innerHeight * 0.15 && pandaY < window.innerHeight * 0.85;
            assembly = clamp(assembly + (inView ? dt : -dt * 2), 0, assemblyTotal);
            for (const part of panda.parts) {
                const t = clamp((assembly - part.delay) / PART_DURATION, 0, 1);
                const eased = easeOutBack(t);
                part.slot.position.lerpVectors(part.scatter, part.home, eased);
                part.slot.position.y += Math.sin(t * Math.PI) * 1.2;
                part.slot.quaternion.slerpQuaternions(part.scatterRotation, NO_ROTATION, eased);
                part.slot.scale.setScalar(0.3 + 0.7 * eased);
            }
            panda.spin.rotation.y = -(1 - easeOutCubic(assembly / assemblyTotal)) * Math.PI * 2;
            if (assembly >= assemblyTotal && !assembled) {
                assembled = true;
                cheer();
            } else if (assembly <= 0) {
                assembled = false;
            }
        }

        // Saludo al cargar la página
        if (!greeted && clock > 0.8) {
            greeted = true;
            cheer(3);
        }

        // 2. ¿El cursor está encima? (para el clic, el rubor y las caricias)
        const pointerActive = clock - pointerSeenAt < 5;
        if (pointerActive) updatePointer(rect);
        const over = pointerActive && isOverPanda();
        if (over !== hovered) {
            hovered = over;
            host.style.cursor = over ? 'pointer' : '';
        }
        petting = Math.max(petting - dt * 0.6, 0);
        const isPetting = petting > 1;

        // 3. Mirada: los ojos van primero y la cabeza los sigue.
        //    Sin cursor te mira a ti (hacia la cámara) y curiosea alrededor.
        panda.head.getWorldPosition(headWorld);
        lookPoint.subVectors(camera.position, headWorld);
        let targetYaw = Math.atan2(lookPoint.x, lookPoint.z);
        let targetPitch = -Math.atan2(lookPoint.y, Math.hypot(lookPoint.x, lookPoint.z));
        if (!calm) {
            targetYaw += Math.sin(clock * 0.45) * 0.18 + Math.sin(clock * 1.3) * 0.04;
            targetPitch += Math.sin(clock * 0.6) * 0.06;
        }
        if (pointerActive) {
            raycaster.setFromCamera(pointer, camera);
            lookPlane.constant = -(headWorld.z + 6);
            if (raycaster.ray.intersectPlane(lookPlane, lookPoint)) {
                lookPoint.sub(headWorld);
                targetYaw = clamp(Math.atan2(lookPoint.x, lookPoint.z), -0.6, 0.6);
                targetPitch = clamp(-Math.atan2(lookPoint.y, Math.hypot(lookPoint.x, lookPoint.z)), -0.35, 0.35);
            }
        }
        // Las pupilas apuntan a lo que la cabeza aún no alcanza
        gaze.x = damp(gaze.x, clamp((targetYaw - look.yaw) * 0.25 + targetYaw * 0.03, -0.045, 0.045), 12, dt);
        gaze.y = damp(gaze.y, clamp(-(targetPitch - look.pitch) * 0.25 - targetPitch * 0.03, -0.04, 0.04), 12, dt);
        look.yaw = damp(look.yaw, targetYaw, 3.5, dt);
        look.pitch = damp(look.pitch, targetPitch, 3.5, dt);

        // 4. Parpadeo (a veces doble)
        if (clock >= nextBlinkAt) {
            blinkStart = clock;
            nextBlinkAt = clock + (Math.random() < 0.2 ? 0.3 : rand(2, 5));
        }
        const blinkT = (clock - blinkStart) / 0.16;
        const blink = blinkT < 1 ? 1 - Math.sin(blinkT * Math.PI) : 1;

        // 5. Felicidad: ojitos ^^, boca abierta y más rubor
        const happy = clamp(happySpring.update(clock < happyUntil || isPetting ? 1 : 0, dt), 0, 1.15);
        const eyeOpen = clamp(blink * (1 - happy * 1.5), 0, 1);
        const twinkle = calm ? 1 : 1 + Math.sin(clock * 4) * 0.15;
        for (const eye of panda.eyes) {
            eye.open.visible = eyeOpen > 0.02;
            eye.open.scale.y = Math.max(eyeOpen, 0.02);
            eye.pupil.position.x = gaze.x;
            eye.pupil.position.y = gaze.y;
            eye.shine.scale.set(0.065 * twinkle, 0.065 * twinkle, 0.03);
            eye.happy.visible = happy > 0.02;
            eye.happy.scale.setScalar(0.2 * Math.max(happy, 0.02));
        }
        panda.smile.visible = happy < 0.98;
        panda.smile.scale.setScalar(Math.max(1 - happy, 0.02));
        panda.grin.visible = happy > 0.02;
        panda.grin.scale.setScalar(Math.max(happy, 0.02));

        blushAmount = damp(blushAmount, Math.max(happy, hovered ? 0.7 : 0), 5, dt);
        panda.blushMaterial.opacity = 0.45 + 0.45 * blushAmount;
        const blushScale = 1 + 0.25 * blushAmount + (calm ? 0 : Math.sin(clock * 2) * 0.03);
        for (const blush of panda.blushes) blush.scale.set(0.3 * blushScale, 0.17 * blushScale, 1);

        // 6. Orejas: sacudidas al azar y rebote después de cada salto
        if (!calm && clock >= nextEarAt) {
            const pick = Math.random();
            if (pick < 0.4) flickEar(0);
            else if (pick < 0.8) flickEar(1);
            else earSprings.forEach((_, i) => flickEar(i));
            nextEarAt = clock + rand(2.5, 6);
        }
        panda.ears.forEach((ear, i) => {
            // Contento: orejas un poquito más paradas
            ear.wiggle.rotation.z = -ear.side * earSprings[i].update(-0.12 * happy, dt);
        });

        // 7. Ladeo de cabeza curioso, o hacia la mano que lo acaricia
        if (assembled && !calm && clock >= nextTiltAt) {
            tiltTarget = (Math.random() < 0.5 ? -1 : 1) * rand(0.14, 0.24);
            tiltUntil = clock + rand(1.2, 2.2);
            nextTiltAt = clock + rand(6, 11);
            flickEar(tiltTarget > 0 ? 1 : 0);
        }
        if (clock > tiltUntil) tiltTarget = 0;
        let roll = tiltTarget;
        if (isPetting) {
            headScreen.copy(headWorld).project(camera);
            roll = clamp(-(pointer.x - headScreen.x) * 3, -0.2, 0.2);
        }
        tilt.update(roll, dt);

        // 8. Saltitos
        if (assembled && clock >= nextHopAt) {
            hop(2, 0.5);
            nextHopAt = clock + rand(12, 20);
        }
        if (crouchUntil > 0 && clock >= crouchUntil) {
            crouchUntil = -1;
            hopVelocity = 7.2 * hopPower;
            squash.velocity += 3.5 * hopPower;
        }
        if (hopY > 0 || hopVelocity > 0) {
            hopVelocity -= 28 * dt;
            hopY += hopVelocity * dt;
            if (hopY <= 0) {
                const impact = Math.min(-hopVelocity / 7.2, 1);
                hopY = 0;
                hopVelocity = 0;
                squash.velocity -= 3.2 * impact;
                earSprings.forEach((spring) => (spring.velocity += 5 * impact));
                if (hopsLeft > 0) {
                    hopsLeft--;
                    crouchUntil = clock + 0.06;
                }
            }
        }
        squash.update(crouchUntil > 0 ? -0.16 : 0, dt);

        // 9. Aplicar: respiración + estirar/aplastar, flotación y rotación de cabeza
        const stretch = squash.value + (calm ? 0 : Math.sin(clock * 2.4) * 0.018);
        panda.squash.scale.set(1 - stretch * 0.5, 1 + stretch, 1 - stretch * 0.5);
        const float = calm ? 0 : Math.sin(clock * 1.6) * 0.14;
        panda.root.position.set(basePosition.x, basePosition.y + float + hopY, basePosition.z);
        panda.head.rotation.set(look.pitch, look.yaw, tilt.value);

        // 10. Corazones: aparecen con rebote, suben meciéndose y se encogen
        if (isPetting && clock >= nextPetHeartAt) {
            spawnHeart();
            nextPetHeartAt = clock + 0.45;
        }
        for (const heart of panda.hearts) {
            if (!heart.alive) continue;
            heart.age += dt;
            if (heart.age >= heart.life) heart.alive = false;
            heart.mesh.visible = heart.alive && heart.age >= 0;
            if (!heart.mesh.visible) continue;
            const t = heart.age / heart.life;
            heart.velocity.y *= 1 - dt * 0.8;
            heart.mesh.position.addScaledVector(heart.velocity, dt);
            heart.mesh.position.x += Math.sin(heart.age * 5 + heart.phase) * dt * 0.5;
            const grow = t < 0.15 ? easeOutBack(t / 0.15) : 1;
            const shrink = t > 0.7 ? 1 - easeOutCubic((t - 0.7) / 0.3) : 1;
            heart.mesh.scale.setScalar(Math.max(heart.size * grow * shrink, 0.001));
            heart.mesh.rotation.set(0, Math.sin(heart.age * 3 + heart.phase) * 0.5, Math.sin(heart.age * 4 + heart.phase) * 0.3);
        }

        renderer.render(scene, camera);
    };

    const observer = new IntersectionObserver((entries) => {
        for (const entry of entries) onScreen = entry.isIntersecting;
        if (onScreen && !frameId) {
            lastTime = performance.now();
            frameId = requestAnimationFrame(animate);
        }
    });
    observer.observe(host);

    // Limpieza al navegar con el ClientRouter: sin esto cada visita deja un bucle vivo
    const destroy = () => {
        cancelAnimationFrame(frameId);
        observer.disconnect();
        window.removeEventListener('resize', resize);
        window.removeEventListener('pointermove', onPointerMove);
        document.documentElement.removeEventListener('pointerleave', onPointerLeave);
        host.removeEventListener('click', onClick);
        host.style.cursor = '';
        const geometries = new Set<THREE.BufferGeometry>();
        const materials = new Set<THREE.Material>();
        scene.traverse((object) => {
            if (!(object instanceof THREE.Mesh)) return;
            geometries.add(object.geometry);
            (Array.isArray(object.material) ? object.material : [object.material]).forEach((m) => materials.add(m));
        });
        geometries.forEach((geometry) => geometry.dispose());
        materials.forEach((material) => material.dispose());
        renderer.dispose();
        delete canvas.dataset.panda;
    };
    document.addEventListener('astro:before-swap', destroy, { once: true });
}
