/**
 * Dual-Microphone Differential Beamformer
 * 
 * Simulates a hearing instrument dual-mic endfire array:
 * - Front microphone at x = +d/2
 * - Rear microphone at x = -d/2
 * - Microphone spacing d = 12 mm
 * - Speed of sound c = 343 m/s
 * - Max acoustic travel delay tau_0 = d / c ~= 34.98 microseconds
 */
export class SpatialBeamformer {
    constructor(sampleRate = 44100, micSpacing = 0.012) {
        this.sampleRate = sampleRate;
        this.c = 343.0; // speed of sound in m/s
        this.d = micSpacing; // 12 mm
        this.tau0 = this.d / this.c; // seconds
        this.maxDelaySamples = Math.ceil(this.tau0 * this.sampleRate) + 2;

        // Circular buffer for rear microphone delay
        this.rearBuffer = new Float32Array(this.maxDelaySamples * 4);
        this.bufIndex = 0;

        // Modes: 'omni', 'cardioid', 'supercardioid', 'hypercardioid', 'adaptive'
        this.mode = 'cardioid';
        
        // Adaptive MVDR null steering parameter (beta)
        this.adaptiveBeta = 1.0;
        this.correlationSmoother = 0.95;
        this.rFrontRear = 0.0;
        this.rRearRear = 1e-4;

        // Internal delays for patterns
        this.internalDelays = {
            omni: 0.0,
            cardioid: this.tau0,
            supercardioid: this.tau0 * 3.0,
            hypercardioid: this.tau0 / 3.0,
            adaptive: this.tau0
        };
    }

    setMode(newMode) {
        if (['omni', 'cardioid', 'supercardioid', 'hypercardioid', 'adaptive'].includes(newMode)) {
            this.mode = newMode;
        }
    }

    process(frontSample, rearSample) {
        if (this.mode === 'omni') {
            return frontSample;
        }

        this.rearBuffer[this.bufIndex] = rearSample;

        let delaySec = this.internalDelays[this.mode] || this.tau0;
        let delaySamples = delaySec * this.sampleRate;

        let readPtr = this.bufIndex - delaySamples;
        while (readPtr < 0) readPtr += this.rearBuffer.length;
        
        let i0 = Math.floor(readPtr);
        let i1 = (i0 + 1) % this.rearBuffer.length;
        let frac = readPtr - i0;
        let delayedRear = this.rearBuffer[i0] * (1.0 - frac) + this.rearBuffer[i1] * frac;

        let output = 0.0;

        if (this.mode === 'cardioid') {
            output = frontSample - delayedRear;
        } else if (this.mode === 'supercardioid') {
            output = frontSample - 0.577 * delayedRear;
        } else if (this.mode === 'hypercardioid') {
            output = frontSample - 0.707 * delayedRear;
        } else if (this.mode === 'adaptive') {
            this.rFrontRear = this.correlationSmoother * this.rFrontRear + (1 - this.correlationSmoother) * (frontSample * delayedRear);
            this.rRearRear = this.correlationSmoother * this.rRearRear + (1 - this.correlationSmoother) * (delayedRear * delayedRear);
            
            let optimalBeta = this.rFrontRear / (this.rRearRear + 1e-6);
            this.adaptiveBeta = Math.max(0.1, Math.min(1.2, optimalBeta));

            output = frontSample - this.adaptiveBeta * delayedRear;
        }

        this.bufIndex = (this.bufIndex + 1) % this.rearBuffer.length;
        return output * 1.414;
    }

    getPolarResponse(theta, frequency = 1000) {
        if (this.mode === 'omni') return 1.0;

        let omega = 2 * Math.PI * frequency;
        let tauAcoustic = (this.d / this.c) * Math.cos(theta);
        let tauInternal = this.internalDelays[this.mode] || this.tau0;
        
        if (this.mode === 'adaptive') {
            tauInternal = this.tau0;
        }

        let beta = (this.mode === 'supercardioid') ? 0.577 : 
                   (this.mode === 'hypercardioid') ? 0.707 : 
                   (this.mode === 'adaptive') ? this.adaptiveBeta : 1.0;

        let phase = omega * (tauAcoustic + tauInternal);
        let real = 1.0 - beta * Math.cos(phase);
        let imag = beta * Math.sin(phase);
        let magnitude = Math.sqrt(real * real + imag * imag);

        let phase0 = omega * ((this.d / this.c) + tauInternal);
        let real0 = 1.0 - beta * Math.cos(phase0);
        let imag0 = beta * Math.sin(phase0);
        let norm = Math.max(0.01, Math.sqrt(real0 * real0 + imag0 * imag0));

        return magnitude / norm;
    }

    getDirectivityIndex(frequency = 1000) {
        if (this.mode === 'omni') return 0.0;

        let steps = 180;
        let sum = 0.0;
        let dTheta = Math.PI / steps;

        for (let i = 0; i < steps; i++) {
            let theta = (i + 0.5) * dTheta;
            let gain = this.getPolarResponse(theta, frequency);
            sum += (gain * gain) * Math.sin(theta) * dTheta;
        }

        let powerRatio = 2.0 / Math.max(1e-4, sum);
        return 10.0 * Math.log10(Math.max(1.0, powerRatio));
    }
}
