const video = document.getElementById("webcam");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const cakeArea = document.getElementById("cakeArea");
const cakeImg = document.getElementById("cakeImg");
const match = document.getElementById("match");
const resetBtn = document.getElementById("resetBtn");

let isHandDetected = false;
let handPosition = { x: 0.5, y: 0.5 };


let isCakeLit = false;
let isCandlesBlownOut = false;

const LIGHT_DISTANCE = 60;
const BLOW_THRESHOLD = 40;

// Audio elements
const soundEffects = {
    // Using shorter, more direct audio links for better responsiveness
    light: new Audio('https://www.soundjay.com/buttons/sounds/button-30.mp3'), // Match/Light
    blow: new Audio('https://www.soundjay.com/nature/sounds/wind-01.mp3'),     // Blow/Wind
    celebrate: new Audio('https://www.soundjay.com/misc/sounds/bell-ringing-05.mp3') // Success
};

// Unlock audio on first touch/click
const unlockAudio = () => {
    Object.values(soundEffects).forEach(sound => {
        sound.play().then(() => {
            sound.pause();
            sound.currentTime = 0;
        }).catch(() => { });
    });
    document.removeEventListener('click', unlockAudio);
    document.removeEventListener('touchstart', unlockAudio);
};
document.addEventListener('click', unlockAudio);
document.addEventListener('touchstart', unlockAudio);

const hands = new Hands({

    locateFile: (file) =>
        `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
});

hands.setOptions({
    maxNumHands: 2,
    modelComplexity: 1,
    minDetectionConfidence: 0.7,
    minTrackingConfidence: 0.5,
});


hands.onResults(onHandsResults);

async function initCamera() {
    const camera = new Camera(video, {
        onFrame: async () => {
            if (canvas.width !== video.videoWidth) {
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
            }
            await hands.send({ image: video });
        },
        width: 640,
        height: 480,
        facingMode: 'user'
    });

    try {
        await camera.start();
    } catch (e) {
        console.error("Camera error:", e);
        alert("Kamera başlatılamadı: " + e.message);
    }
}

function onHandsResults(results) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        isHandDetected = true;

        const lm = results.multiHandLandmarks[0][8]; // index finger tip
        // Invert X because the webcam view feels like a mirror
        handPosition = { x: 1 - lm.x, y: lm.y };

        updateMatchPosition();
        checkCandleLighting();
    } else {
        isHandDetected = false;
    }
}

function updateMatchPosition() {
    if (!isHandDetected) return;

    const rect = cakeArea.getBoundingClientRect();
    const padding = 20;

    const x = padding + handPosition.x * (rect.width - padding * 2 - 40);
    const y = padding + handPosition.y * (rect.height - padding * 2 - 60);

    match.style.left = `${x}px`;
    match.style.top = `${y}px`;
}



function checkCandleLighting() {
    if (isCakeLit || isCandlesBlownOut) return;

    const matchRect = match.getBoundingClientRect();
    const cakeRect = cakeImg.getBoundingClientRect();

    const matchTipX = matchRect.left + matchRect.width / 2;
    const matchTipY = matchRect.top;

    const candleX = cakeRect.left + cakeRect.width / 2;
    const candleY = cakeRect.top + 10;

    const dx = matchTipX - candleX;
    const dy = matchTipY - candleY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < LIGHT_DISTANCE) {
        lightCake();
    }
}

function lightCake() {
    if (isCakeLit) return;
    isCakeLit = true;

    cakeImg.src = "assets/cake_lit.png";

    soundEffects.light.play().catch(e => console.log("Audio play blocked"));

    match.style.display = "none";
    initBlowDetection();
}



let audioContext;
let analyser;
let microphone;
let isBlowDetectionActive = false;

async function initBlowDetection() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioContext.createAnalyser();
        microphone = audioContext.createMediaStreamSource(stream);

        analyser.fftSize = 256;
        microphone.connect(analyser);

        isBlowDetectionActive = true;
        detectBlow();
    } catch (err) {
        console.error("Error accessing microphone:", err);
    }
}

function detectBlow() {
    if (!isBlowDetectionActive) return;

    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(dataArray);

    const volume =
        dataArray.reduce((a, b) => a + b, 0) / dataArray.length;

    if (volume > BLOW_THRESHOLD && isCakeLit && !isCandlesBlownOut) {
        blowOutCandles();
    }

    requestAnimationFrame(detectBlow);
}

function blowOutCandles() {
    if (!isCakeLit || isCandlesBlownOut) return;

    isCandlesBlownOut = true;
    cakeImg.src = "assets/cake_unlit.png";

    soundEffects.blow.currentTime = 0;
    soundEffects.blow.play().catch(e => console.log("Audio play blocked"));

    triggerConfetti();

    // Show reset button
    resetBtn.style.display = "block";
}


function triggerConfetti() {
    const duration = 3 * 1000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };

    function randomInRange(min, max) {
        return Math.random() * (max - min) + min;
    }

    const interval = setInterval(function () {
        const timeLeft = animationEnd - Date.now();

        if (timeLeft <= 0) {
            return clearInterval(interval);
        }

        const particleCount = 50 * (timeLeft / duration);
        confetti(Object.assign({}, defaults, { particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } }));
        confetti(Object.assign({}, defaults, { particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } }));
    }, 250);

    soundEffects.celebrate.play().catch(e => console.log("Audio play blocked"));
}


function resetApp() {
    isCakeLit = false;
    isCandlesBlownOut = false;

    cakeImg.src = "assets/cake_unlit.png";
    match.style.display = "block";
    resetBtn.style.display = "none";

    if (isHandDetected) {
        updateMatchPosition();
    }
}



resetBtn.addEventListener("click", resetApp);

initCamera();
