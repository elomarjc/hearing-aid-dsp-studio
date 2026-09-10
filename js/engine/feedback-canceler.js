/**
 * Normalized Least Mean Squares (NLMS) Adaptive Feedback Canceler (AFC)
 * 
 * Mitigates acoustic feedback (howling whistling) caused by acoustic leakage
 * from the hearing aid receiver (speaker) back into the microphone ports.
 */
export class AdaptiveFeedbackCanceler {
    constructor(taps = 64, mu = 0.05, sampleRate = 44100) {
        this.taps = taps;
        this.mu = mu; // Step size
        this.sampleRate = sampleRate;
        this.eps = 1e-4; // Regularization factor
        this.leakage = 0.9998; // Leaky LMS to prevent coefficient drift

        this.enabled = true;

        // Adaptive filter weights w[n]
        this.weights = new Float32Array(this.taps);
        // Receiver reference signal buffer x[n]
        this.refBuffer = new Float32Array(this.taps);

        // Ground-truth acoustic leakage path H_fb (simulated physical ear canal acoustic path)
        this.trueLeakageImpulse = new Float32Array(this.taps);
        this.trueLeakageBuffer = new Float32Array(this.taps);
        this.initAcousticPath();

        // Telemetry metrics
        this.erle = 0.0; // Echo Return Loss Enhancement (dB)
        this.erleSmoother = 0.95;
        this.feedbackPower = 1e-6;
        this.residualPower = 1e-6;
        this.misalignment = 1.0;
    }

    /**
     * Initializes a realistic physical ear canal acoustic feedback path:
     * - Acoustic propagation delay (~1.0 ms)
     * - Pinna / canal resonances (~2.8 kHz and ~4.5 kHz)
     * - Exponential decay envelope
     */
    initAcousticPath() {
        let delaySamples = Math.floor(0.0008 * this.sampleRate); // ~0.8 ms delay
        for (let i = 0; i < this.taps; i++) {
            if (i < delaySamples) {
                this.trueLeakageImpulse[i] = 0.0;
            } else {
                let t = (i - delaySamples) / this.sampleRate;
                let decay = Math.exp(-t * 2200.0);
                let osc1 = Math.sin(2 * Math.PI * 2800.0 * t);
                let osc2 = 0.6 * Math.sin(2 * Math.PI * 4500.0 * t + 0.5);
                this.trueLeakageImpulse[i] = 0.45 * decay * (osc1 + osc2);
            }
        }
    }

    /**
     * Simulate physical acoustic feedback leakage from receiver back to mic
     */
    simulateAcousticLeakage(receiverOutput) {
        // Shift true leakage buffer
        for (let i = this.taps - 1; i > 0; i--) {
            this.trueLeakageBuffer[i] = this.trueLeakageBuffer[i - 1];
        }
        this.trueLeakageBuffer[0] = receiverOutput;

        // Convolve with physical leakage path
        let feedbackAcoustic = 0.0;
        for (let i = 0; i < this.taps; i++) {
            feedbackAcoustic += this.trueLeakageImpulse[i] * this.trueLeakageBuffer[i];
        }
        return feedbackAcoustic;
    }

    /**
     * Process microphone input and receiver output
     * @param {number} micSignal - Raw microphone input containing desired sound + acoustic feedback
     * @param {number} receiverOutput - Output sent to receiver/speaker
     * @returns {number} Cleaned error signal e[n]
     */
    process(micSignal, receiverOutput) {
        // Shift reference delay line
        for (let i = this.taps - 1; i > 0; i--) {
            this.refBuffer[i] = this.refBuffer[i - 1];
        }
        this.refBuffer[0] = receiverOutput;

        // 1. Synthesize estimated feedback: d_hat = w^T * x
        let estimatedFeedback = 0.0;
        let normX = 0.0;
        for (let i = 0; i < this.taps; i++) {
            let x = this.refBuffer[i];
            estimatedFeedback += this.weights[i] * x;
            normX += x * x;
        }

        // 2. Subtract feedback estimate to obtain error signal
        let error = this.enabled ? (micSignal - estimatedFeedback) : micSignal;

        // 3. Normalized LMS Weight Update (if enabled and reference signal is active)
        if (this.enabled && normX > 1e-6) {
            let normalizedStep = (this.mu / (this.eps + normX)) * error;
            for (let i = 0; i < this.taps; i++) {
                this.weights[i] = this.leakage * this.weights[i] + normalizedStep * this.refBuffer[i];
            }
        }

        // 4. Update Telemetry: ERLE = 10 * log10( E{d^2} / E{e^2} )
        let fbInst = estimatedFeedback * estimatedFeedback;
        let resInst = (estimatedFeedback - micSignal) * (estimatedFeedback - micSignal);
        this.feedbackPower = this.erleSmoother * this.feedbackPower + (1 - this.erleSmoother) * fbInst;
        this.residualPower = this.erleSmoother * this.residualPower + (1 - this.erleSmoother) * resInst;
        
        let erleDb = 10.0 * Math.log10(Math.max(1e-5, this.feedbackPower) / Math.max(1e-5, this.residualPower));
        this.erle = Math.max(0.0, Math.min(35.0, erleDb));

        // Weight misalignment: ||h - w||^2 / ||h||^2
        let numMis = 0.0;
        let denMis = 0.0;
        for (let i = 0; i < this.taps; i++) {
            let diff = this.trueLeakageImpulse[i] - this.weights[i];
            numMis += diff * diff;
            denMis += this.trueLeakageImpulse[i] * this.trueLeakageImpulse[i];
        }
        this.misalignment = Math.sqrt(numMis / Math.max(1e-6, denMis));

        return error;
    }

    reset() {
        this.weights.fill(0);
        this.refBuffer.fill(0);
        this.trueLeakageBuffer.fill(0);
        this.erle = 0.0;
    }
}
