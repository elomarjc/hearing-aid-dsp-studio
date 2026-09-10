/**
 * Web Audio API Bridge
 * Provides physical real-time audio auditioning:
 * - Synthesizes vowel speech formants (F1, F2, F3)
 * - Synthesizes multitalker babble noise
 * - Generates acoustic howling feedback loop when loop gain exceeds unity
 * - Includes volume limiter and safe mute control
 */
export class AudioBridge {
    constructor(sampleRate = 44100) {
        this.sampleRate = sampleRate;
        this.ctx = null;
        this.isPlaying = false;
        this.isMuted = true;

        this.speechOsc = null;
        this.speechGain = null;
        this.noiseNode = null;
        this.feedbackOsc = null;
        this.feedbackGain = null;
        this.masterGain = null;

        this.feedbackLevel = 0.0;
    }

    init() {
        if (this.ctx) return;

        const AudioContext = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AudioContext({ sampleRate: this.sampleRate });

        // Master Limiter / Output Gain
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = 0.0; // Starts muted for ear safety
        this.masterGain.connect(this.ctx.destination);

        // 1. Speech Formant Synthesizer (Vowel /a/)
        this.speechOsc = this.ctx.createOscillator();
        this.speechOsc.type = 'sawtooth';
        this.speechOsc.frequency.value = 130.0; // Fundamental pitch (Hz)

        let f1 = this.ctx.createBiquadFilter();
        f1.type = 'bandpass';
        f1.frequency.value = 750;
        f1.Q.value = 4.0;

        let f2 = this.ctx.createBiquadFilter();
        f2.type = 'bandpass';
        f2.frequency.value = 1250;
        f2.Q.value = 5.0;

        this.speechGain = this.ctx.createGain();
        this.speechGain.gain.value = 0.18;

        this.speechOsc.connect(f1);
        this.speechOsc.connect(f2);
        f1.connect(this.speechGain);
        f2.connect(this.speechGain);
        this.speechGain.connect(this.masterGain);

        // 2. Babble / Ambient Noise Generator (Pink-filtered buffer)
        let bufferSize = this.ctx.sampleRate * 2;
        let noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        let output = noiseBuffer.getChannelData(0);
        let b0 = 0, b1 = 0, b2 = 0;
        for (let i = 0; i < bufferSize; i++) {
            let white = Math.random() * 2 - 1;
            b0 = 0.99886 * b0 + white * 0.0555179;
            b1 = 0.99332 * b1 + white * 0.0750759;
            b2 = 0.96900 * b2 + white * 0.1538520;
            output[i] = (b0 + b1 + b2) * 0.15;
        }

        this.noiseSource = this.ctx.createBufferSource();
        this.noiseSource.buffer = noiseBuffer;
        this.noiseSource.loop = true;

        this.noiseGain = this.ctx.createGain();
        this.noiseGain.gain.value = 0.08;

        this.noiseSource.connect(this.noiseGain);
        this.noiseGain.connect(this.masterGain);

        // 3. Acoustic Howling Feedback Generator (Oscillates at 3.1 kHz when loop gain is unstable)
        this.feedbackOsc = this.ctx.createOscillator();
        this.feedbackOsc.type = 'sine';
        this.feedbackOsc.frequency.value = 3120.0; // Characteristic hearing aid whistling resonance

        this.feedbackGain = this.ctx.createGain();
        this.feedbackGain.gain.value = 0.0;

        this.feedbackOsc.connect(this.feedbackGain);
        this.feedbackGain.connect(this.masterGain);

        // Start oscillators
        this.speechOsc.start();
        this.noiseSource.start();
        this.feedbackOsc.start();
        this.isPlaying = true;
    }

    toggleAudio(enable) {
        if (!this.ctx) this.init();
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }

        this.isMuted = !enable;
        if (this.masterGain) {
            let now = this.ctx.currentTime;
            this.masterGain.gain.cancelScheduledValues(now);
            this.masterGain.gain.linearRampToValueAtTime(this.isMuted ? 0.0 : 0.35, now + 0.05);
        }
        return !this.isMuted;
    }

    /**
     * Update acoustic feedback howl intensity based on physical loop gain and AFC status
     */
    updateFeedbackSqueal(afcEnabled, loopGainMarginDb) {
        if (!this.ctx || this.isMuted) return;

        let targetGain = 0.0;
        if (!afcEnabled && loopGainMarginDb > 0.0) {
            // Howling occurs: scale howl intensity with excess loop gain
            targetGain = Math.min(0.35, 0.05 + loopGainMarginDb * 0.02);
        } else if (afcEnabled) {
            // AFC extinguishes the feedback howl
            targetGain = 0.0;
        }

        let now = this.ctx.currentTime;
        this.feedbackGain.gain.cancelScheduledValues(now);
        this.feedbackGain.gain.linearRampToValueAtTime(targetGain, now + 0.08);
    }
}
