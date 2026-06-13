class MediaPipeController {
    constructor() {
        this.model = null;
        this.video = null;
        this.camera = null;
        this.hands = null;
        this.isWebcamActive = false;
        this.isModelLoaded = false;
        this.classNames = [];
        this.maxPredictions = 0;
        this.predictionPending = false;
        this.lastPredictionTime = 0;
        this.predictionInterval = 120; // ms
        this.onModelLoadedCallback = null;
        this.onPredictionCallback = null;

        this.indexFinger = {
            x: 0.5,
            y: 0.5
        };
    }

    async setupWebcam(containerId) {
        const container = document.getElementById(containerId);

        this.video = document.createElement("video");
        this.video.autoplay = true;
        this.video.playsInline = true;
        this.video.muted = true;
        this.video.style.width = "200px";
        this.video.style.transform = "scaleX(-1)";

        container.innerHTML = "";
        container.appendChild(this.video);

        const stream = await navigator.mediaDevices.getUserMedia({
            video: true
        });

        this.video.srcObject = stream;

        this.hands = new Hands({
            locateFile: file =>
                `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
        });

        this.hands.setOptions({
            maxNumHands: 1,
            modelComplexity: 1,
            minDetectionConfidence: 0.7,
            minTrackingConfidence: 0.7,
            selfieMode: true
        });

        this.hands.onResults(results => {
            if (
                results.multiHandLandmarks &&
                results.multiHandLandmarks.length > 0
            ) {
                const hand = results.multiHandLandmarks[0];
                this.indexFinger.x = hand[8].x;
                this.indexFinger.y = hand[8].y;
            }
        });

        this.camera = new Camera(this.video, {
            onFrame: async () => {
                await this.hands.send({
                    image: this.video
                });

                const now = performance.now();
                if (
                    this.isModelLoaded &&
                    this.model &&
                    this.onPredictionCallback &&
                    now - this.lastPredictionTime >= this.predictionInterval
                ) {
                    this.lastPredictionTime = now;
                    await this.predict();
                }
            },
            width: 320,
            height: 240
        });

        await this.camera.start();
        this.isWebcamActive = true;
    }

    async loadFromURL(url) {
        if (!url) throw new Error("URL cannot be empty");
        if (!url.endsWith('/')) url += '/';

        const modelURL = url + "model.json";
        const metadataURL = url + "metadata.json";

        this.model = await tmImage.load(modelURL, metadataURL);
        this.maxPredictions = this.model.getTotalClasses();
        this.classNames = this.model.getClassLabels();
        this.isModelLoaded = true;

        if (this.onModelLoadedCallback) {
            this.onModelLoadedCallback(this.classNames);
        }

        return this.classNames;
    }

    async loadFromFiles(modelJson, weightsBin, metadataJson) {
        if (!modelJson || !weightsBin || !metadataJson) {
            throw new Error("Please select all three required model files (model.json, weights.bin, metadata.json). ");
        }

        this.model = await tmImage.loadFromFiles(modelJson, weightsBin, metadataJson);
        this.maxPredictions = this.model.getTotalClasses();
        this.classNames = this.model.getClassLabels();
        this.isModelLoaded = true;

        if (this.onModelLoadedCallback) {
            this.onModelLoadedCallback(this.classNames);
        }

        return this.classNames;
    }

    async predict() {
        if (!this.model || !this.video || this.predictionPending) return;

        this.predictionPending = true;
        try {
            const prediction = await this.model.predict(this.video);
            let highestIndex = 0;
            let highestProb = 0;

            for (let i = 0; i < this.maxPredictions; i++) {
                if (prediction[i].probability > highestProb) {
                    highestProb = prediction[i].probability;
                    highestIndex = i;
                }
            }

            const topPrediction = {
                className: prediction[highestIndex].className,
                probability: highestProb,
                index: highestIndex
            };

            if (this.onPredictionCallback) {
                this.onPredictionCallback(prediction, topPrediction);
            }

            return { prediction, topPrediction };
        } finally {
            this.predictionPending = false;
        }
    }

    stop() {
        if (this.camera) {
            try {
                this.camera.stop();
            } catch (e) {
                console.warn('Unable to stop MediaPipe camera:', e);
            }
        }

        if (this.video) {
            if (this.video.srcObject) {
                this.video.srcObject.getTracks().forEach(track => track.stop());
            }
            if (this.video.parentNode) {
                this.video.parentNode.removeChild(this.video);
            }
            this.video = null;
        }

        this.isWebcamActive = false;
        this.isModelLoaded = false;
        this.handDetected = false;
    }
}

window.tmLoader = new MediaPipeController();
