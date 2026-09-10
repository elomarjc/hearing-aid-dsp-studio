/**
 * 6-Band Wide Dynamic Range Compression (WDRC) Filterbank
 * Aligned with NAL-NL2 audiological fitting prescriptions.
 */
export class WDRCCompressor {
    constructor(sampleRate = 44100) {
        this.sampleRate = sampleRate;
        this.centerFreqs = [250, 500, 1000, 2000, 4000, 8000];
        this.numBands = this.centerFreqs.length;

        // Audiogram thresholds (dB HL)
        this.hearingLoss = [10, 15, 25, 45, 60, 70]; // Default: moderate high-frequency loss

        // Per-band WDRC parameters
        // ET: Expansion Threshold (dB SPL)
        // CK: Compression Knee Point (dB SPL)
        // CR: Compression Ratio
        // Gain: Insertion gain at linear region (dB)
        // MPO: Maximum Power Output / Limiter Knee (dB SPL)
        this.bands = this.centerFreqs.map((fc, i) => ({
            fc: fc,
            et: 35.0,
            ck: 50.0,
            cr: 2.0,
            gain: 15.0,
            mpo: 98.0,
            attackCoeff: Math.exp(-1.0 / (0.005 * sampleRate)), // 5 ms attack
            releaseCoeff: Math.exp(-1.0 / (0.060 * sampleRate)), // 60 ms release
            envelope: 1e-4,
            currentGainDb: 15.0,
            // 2nd-order IIR bandpass filter state
            b0: 0, b1: 0, b2: 0, a1: 0, a2: 0,
            x1: 0, x2: 0, y1: 0, y2: 0
        }));

        this.initBandpassFilters();
        this.applyAudiogramFitting();
    }

    initBandpassFilters() {
        for (let i = 0; i < this.numBands; i++) {
            let fc = this.bands[i].fc;
            let q = 1.414; // Q-factor for 1-octave spacing
            let w0 = 2 * Math.PI * fc / this.sampleRate;
            let alpha = Math.sin(w0) / (2 * q);

            let b0 = alpha;
            let b1 = 0;
            let b2 = -alpha;
            let a0 = 1 + alpha;
            let a1 = -2 * Math.cos(w0);
            let a2 = 1 - alpha;

            this.bands[i].b0 = b0 / a0;
            this.bands[i].b1 = b1 / a0;
            this.bands[i].b2 = b2 / a0;
            this.bands[i].a1 = a1 / a0;
            this.bands[i].a2 = a2 / a0;
        }
    }

    /**
     * Compute prescribed NAL-NL2 gains and compression ratios based on hearing loss profile
     */
    applyAudiogramFitting() {
        for (let i = 0; i < this.numBands; i++) {
            let hl = this.hearingLoss[i];
            // Simplified NAL-NL2 formula for moderate speech input (65 dB SPL):
            // G_target = 0.46 * HL + 3 dB (high frequency boost)
            let targetGain = Math.max(0, 0.45 * hl + (i >= 3 ? 4.0 : 0.0));
            // Compression ratio increases with hearing loss
            let cr = Math.max(1.0, Math.min(3.5, 1.0 + hl / 35.0));

            this.bands[i].gain = targetGain;
            this.bands[i].cr = cr;
            this.bands[i].ck = 50.0;
            this.bands[i].mpo = 95.0 + Math.min(15.0, hl * 0.2);
        }
    }

    setHearingLoss(bandIndex, hlDb) {
        if (bandIndex >= 0 && bandIndex < this.numBands) {
            this.hearingLoss[bandIndex] = Math.max(0, Math.min(110, hlDb));
            this.applyAudiogramFitting();
        }
    }

    setPreset(presetName) {
        if (presetName === 'normal') {
            this.hearingLoss = [10, 10, 10, 15, 15, 20];
        } else if (presetName === 'mild_sloping') {
            this.hearingLoss = [15, 20, 30, 45, 55, 65];
        } else if (presetName === 'steep_high_frequency') {
            this.hearingLoss = [15, 15, 25, 60, 75, 85];
        } else if (presetName === 'flat_moderate') {
            this.hearingLoss = [40, 45, 45, 50, 50, 55];
        }
        this.applyAudiogramFitting();
    }

    /**
     * Compute static I/O compression curve for a given input level in dB SPL
     */
    computeStaticOutputDb(bandIndex, inputSplDb) {
        let b = this.bands[bandIndex];
        let linGain = b.gain;
        let et = b.et;
        let ck = b.ck;
        let cr = b.cr;
        let mpo = b.mpo;

        if (inputSplDb <= et) {
            // Expansion region: 1.5:1 expansion below expansion knee
            let delta = et - inputSplDb;
            return (et + linGain) - delta * 1.5;
        } else if (inputSplDb <= ck) {
            // Linear amplification region
            return inputSplDb + linGain;
        } else {
            // Compression region: Output = CK + Gain + (Input - CK) / CR
            let compressed = (ck + linGain) + (inputSplDb - ck) / cr;
            // Limiter region at MPO
            if (compressed > mpo) {
                compressed = mpo + (compressed - mpo) / 10.0;
            }
            return compressed;
        }
    }

    /**
     * Process a single audio sample through the 6-band WDRC pipeline
     */
    process(inputSample) {
        let totalOutput = 0.0;
        // Reference 0 dBFS ~= 90 dB SPL
        const DBFS_TO_DBSPL = 90.0;

        for (let i = 0; i < this.numBands; i++) {
            let b = this.bands[i];

            // 1. Bandpass filter sample (Direct Form I)
            let filtered = b.b0 * inputSample + b.b1 * b.x1 + b.b2 * b.x2 - b.a1 * b.y1 - b.a2 * b.y2;
            b.x2 = b.x1;
            b.x1 = inputSample;
            b.y2 = b.y1;
            b.y1 = filtered;

            // 2. Dual attack/release envelope detector
            let rect = Math.abs(filtered);
            if (rect > b.envelope) {
                b.envelope = b.attackCoeff * b.envelope + (1.0 - b.attackCoeff) * rect;
            } else {
                b.envelope = b.releaseCoeff * b.envelope + (1.0 - b.releaseCoeff) * rect;
            }

            // 3. Convert envelope to dB SPL
            let envDb = 20.0 * Math.log10(Math.max(1e-5, b.envelope)) + DBFS_TO_DBSPL;

            // 4. Calculate instantaneous gain according to WDRC curve
            let outDb = this.computeStaticOutputDb(i, envDb);
            let targetGainDb = outDb - envDb;
            b.currentGainDb = targetGainDb;

            // 5. Apply linear gain
            let linearGain = Math.pow(10.0, targetGainDb / 20.0);
            totalOutput += filtered * linearGain;
        }

        // Soft saturation limiter to prevent digital clipping
        return Math.tanh(totalOutput * 0.8) * 1.2;
    }
}
