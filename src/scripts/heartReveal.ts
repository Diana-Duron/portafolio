// src/scripts/heartReveal.ts
// Transición del cambio de tema: una ola de corazones nace en el botón y,
// al crecer y juntarse, revela el tema nuevo.
//
// Anima el clip-path de ::view-transition-new(root) con un único path() que
// contiene todos los corazones. Los fotogramas se precalculan para que cada
// corazón tenga su propio retraso y su "boing"; el navegador interpola entre ellos.

const DURATION = 1300;
const STEPS = 30;

// Contorno de un corazón de ancho 1 centrado en el origen (y hacia abajo, como en pantalla):
// punto inicial + 4 curvas cúbicas
const HEART = [
    [0, 0.55],
    [-0.1, 0.42], [-0.6, 0.12], [-0.6, -0.15],
    [-0.6, -0.45], [-0.2, -0.6], [0, -0.32],
    [0.2, -0.6], [0.6, -0.45], [0.6, -0.15],
    [0.6, 0.12], [0.1, 0.42], [0, 0.55],
].map(([x, y]) => [x / 1.2, (y - 0.045) / 1.2]);

interface Heart {
    x: number;
    y: number;
    size: number;
    angle: number;
    delay: number;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const rand = (min: number, max: number) => min + Math.random() * (max - min);

// Llega, se pasa un poquito y regresa
function easeOutBack(t: number) {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;
}

function heartPath({ x, y, angle }: Heart, size: number) {
    const cos = Math.cos(angle) * size;
    const sin = Math.sin(angle) * size;
    const [start, ...curves] = HEART.map(
        ([px, py]) => `${(x + px * cos - py * sin).toFixed(1)} ${(y + px * sin + py * cos).toFixed(1)}`,
    );
    let d = `M${start}`;
    for (let i = 0; i < curves.length; i += 3) d += `C${curves[i]} ${curves[i + 1]} ${curves[i + 2]}`;
    return `${d}Z`;
}

/** Revela el estado nuevo de la view transition activa con corazones que salen de (originX, originY) */
export function revealWithHearts(originX: number, originY: number) {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const spacing = clamp(Math.min(width, height) / 5, 90, 170);
    const rowHeight = spacing * 0.86;

    // Rejilla al tresbolillo con un poco de desorden, desbordando la pantalla
    const hearts: Heart[] = [];
    for (let row = -1; row * rowHeight < height + spacing; row++) {
        for (let col = -1; col * spacing < width + spacing; col++) {
            const x = (col + (row % 2 ? 0.5 : 0) + rand(-0.12, 0.12)) * spacing;
            const y = (row + rand(-0.12, 0.12)) * rowHeight;
            hearts.push({
                x,
                y,
                size: spacing * rand(0.85, 1.05),
                angle: rand(-0.3, 0.3),
                delay: Math.hypot(x - originX, y - originY),
            });
        }
    }

    // La ola sale del botón: los corazones más lejanos empiezan después
    const farthest = Math.max(...hearts.map((heart) => heart.delay));
    for (const heart of hearts) heart.delay = (heart.delay / farthest) * 0.4 + rand(0, 0.04);

    const keyframes: Keyframe[] = [];
    for (let i = 0; i <= STEPS; i++) {
        const t = i / STEPS;
        const d = hearts
            .map((heart) => {
                // Aparece con rebote...
                const pop = easeOutBack(clamp((t - heart.delay) / 0.3, 0, 1));
                // ...y después se hincha hasta tapar todo
                const swell = clamp((t - heart.delay - 0.35) / 0.2, 0, 1) ** 2;
                return heartPath(heart, heart.size * pop + spacing * 2.6 * swell);
            })
            .join('');
        keyframes.push({ clipPath: `path('${d}')` });
    }

    return document.documentElement.animate(keyframes, {
        duration: DURATION,
        easing: 'linear',
        pseudoElement: '::view-transition-new(root)',
    });
}
