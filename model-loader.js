// Teachable Machine Model Loader & Webcam Controller
class TMModelLoader {
    constructor() {
        this.model = null;
        this.webcam = null;
        this.maxPredictions = 0;
        this.isModelLoaded = false;
        this.isWebcamActive = false;
        this.classNames = [];
        this.activePrediction = null; // Current winning prediction above threshold
        
        // Callbacks
        this.onModelLoadedCallback = null;
        this.onPredictionCallback = null;
        
        this.loopActive = false;
    }

    // Load from public cloud URL
    async loadFromURL(url) {
        if (!url) throw new Error("URL cannot be empty");
        
        // Ensure trailing slash
        if (!url.endsWith('/')) {
            url += '/';
        }

        const modelURL = url + "model.json";
        const metadataURL = url + "metadata.json";

        try {
            console.log(`Loading Teachable Machine model from ${url}...`);
            this.model = await tmImage.load(modelURL, metadataURL);
            this.maxPredictions = this.model.getTotalClasses();
            this.classNames = this.model.getClassLabels();
            this.isModelLoaded = true;
            
            console.log("Model loaded successfully. Classes:", this.classNames);
            
            if (this.onModelLoadedCallback) {
                this.onModelLoadedCallback(this.classNames);
            }
            
            return this.classNames;
        } catch (e) {
            console.error("Failed to load model from URL: ", e);
            throw new Error("Invalid model URL or network error. Please verify the link.");
        }
    }

    // Load from local file uploads
    async loadFromFiles(modelJson, weightsBin, metadataJson) {
        if (!modelJson || !weightsBin || !metadataJson) {
            throw new Error("Please select all three required model files (model.json, weights.bin, metadata.json).");
        }

        try {
            console.log("Loading model from local files...");
            this.model = await tmImage.loadFromFiles(modelJson, weightsBin, metadataJson);
            this.maxPredictions = this.model.getTotalClasses();
            this.classNames = this.model.getClassLabels();
            this.isModelLoaded = true;
            
            console.log("Local model loaded successfully. Classes:", this.classNames);
            
            if (this.onModelLoadedCallback) {
                this.onModelLoadedCallback(this.classNames);
            }
            
            return this.classNames;
        } catch (e) {
            console.error("Failed to load model from files: ", e);
            throw new Error("Failed to load local model files. Make sure they are unmodified Teachable Machine exports.");
        }
    }

    // Setup and enable the webcam
    async setupWebcam(containerId) {
        if (this.isWebcamActive) return;

        const container = document.getElementById(containerId);
        if (!container) throw new Error(`Webcam container #${containerId} not found`);

        try {
            console.log("Requesting camera access...");
            const flip = true; // mirror mode
            this.webcam = new tmImage.Webcam(200, 200, flip);
            
            await this.webcam.setup(); // Throws if camera blocked
            await this.webcam.play();
            
            // Clear placeholder and append webcam canvas
            container.innerHTML = '';
            container.appendChild(this.webcam.canvas);
            
            this.isWebcamActive = true;
            console.log("Webcam activated and playing.");
            
            // Start processing loop if not already running
            if (!this.loopActive) {
                this.loopActive = true;
                window.requestAnimationFrame(() => this.loop());
            }
        } catch (e) {
            console.error("Camera access failed: ", e);
            this.isWebcamActive = false;
            throw new Error("Webcam access denied. Please allow camera permissions in your browser settings.");
        }
    }

    // Continuous webcam update & prediction loop
    async loop() {
        if (!this.loopActive) return;

        try {
            if (this.isWebcamActive && this.webcam) {
                this.webcam.update(); // Update webcam frame
                
                if (this.isModelLoaded && this.model) {
                    await this.predict();
                }
            }
        } catch (e) {
            console.error("Error in webcam loop: ", e);
        }

        window.requestAnimationFrame(() => this.loop());
    }

    // Run webcam canvas through TM model
    async predict() {
        if (!this.model || !this.webcam) return;

        const prediction = await this.model.predict(this.webcam.canvas);
        
        // Find highest scoring class
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
    }

    stop() {
        this.loopActive = false;
        if (this.webcam) {
            this.webcam.stop();
        }
        this.isWebcamActive = false;
    }
}

// Global single instance export
const tmLoader = new TMModelLoader();
window.tmLoader = tmLoader;
