import { SpatialBeamformer } from './engine/beamformer.js';
import { AdaptiveFeedbackCanceler } from './engine/feedback-canceler.js';
import { WDRCCompressor } from './engine/wdrc-compressor.js';
import { SoundfieldEngine } from './engine/soundfield.js';
import { AudioBridge } from './engine/audio-bridge.js';

import { PolarScope } from './ui/polar-scope.js';
import { SoundfieldView } from './ui/soundfield-view.js';
import { WDRCCurveView } from './ui/wdrc-curve-view.js';
import { SpectrumScope } from './ui/spectrum-scope.js';

class HearingAidStudioApp {
    constructor() {
        this.beamformer = new SpatialBeamformer(44100, 0.012);
        this.afc = new AdaptiveFeedbackCanceler(64, 0.05, 44100);
        this.compressor = new WDRCCompressor(44100);
        this.soundfield = new SoundfieldEngine();
        this.audioBridge = new AudioBridge(44100);

        // UI scopes
        this.polarScope = new PolarScope('polarCanvas');
        this.soundfieldView = new SoundfieldView('soundfieldCanvas', this.soundfield, () => this.onSoundfieldUpdated());
        this.wdrcView = new WDRCCurveView('wdrcCanvas');
        this.spectrumScope = new SpectrumScope('spectrumCanvas');

        this.acousticLoopGainDb = 4.5; // +4.5 dB open-loop gain (causing howling when unmitigated)
        this.isAudioLive = false;

        this.initUI();
        this.startLoop();
    }

    initUI() {
        // Beamformer mode buttons
        const modeButtons = document.querySelectorAll('.mode-btn');
        modeButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                modeButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                let mode = btn.getAttribute('data-mode');
                this.beamformer.setMode(mode);
            });
        });

        // AFC Toggle
        const afcToggle = document.getElementById('afcToggle');
        if (afcToggle) {
            afcToggle.addEventListener('change', (e) => {
                this.afc.enabled = e.target.checked;
                this.updateTelemetry();
            });
        }

        // Loop Gain Slider
        const loopGainSlider = document.getElementById('loopGainSlider');
        const loopGainVal = document.getElementById('loopGainVal');
        if (loopGainSlider) {
            loopGainSlider.addEventListener('input', (e) => {
                this.acousticLoopGainDb = parseFloat(e.target.value);
                if (loopGainVal) loopGainVal.innerText = `${this.acousticLoopGainDb > 0 ? '+' : ''}${this.acousticLoopGainDb.toFixed(1)} dB`;
            });
        }

        // Step Size Mu Slider
        const muSlider = document.getElementById('muSlider');
        const muVal = document.getElementById('muVal');
        if (muSlider) {
            muSlider.addEventListener('input', (e) => {
                this.afc.mu = parseFloat(e.target.value);
                if (muVal) muVal.innerText = this.afc.mu.toFixed(3);
            });
        }

        // Audiogram Preset Select
        const presetSelect = document.getElementById('presetSelect');
        if (presetSelect) {
            presetSelect.addEventListener('change', (e) => {
                this.compressor.setPreset(e.target.value);
                this.updateAudiogramSliders();
                this.wdrcView.render(this.compressor);
            });
        }

        // Band select for WDRC curve view
        const bandSelect = document.getElementById('bandSelect');
        if (bandSelect) {
            bandSelect.addEventListener('change', (e) => {
                this.wdrcView.setSelectedBand(parseInt(e.target.value, 10));
                this.wdrcView.render(this.compressor);
            });
        }

        // Live Audio Audition Button
        const liveAudioBtn = document.getElementById('liveAudioBtn');
        if (liveAudioBtn) {
            liveAudioBtn.addEventListener('click', () => {
                this.isAudioLive = !this.isAudioLive;
                let active = this.audioBridge.toggleAudio(this.isAudioLive);
                liveAudioBtn.classList.toggle('active', active);
                liveAudioBtn.innerHTML = active ? '🔊 Audio Live (Click to Mute)' : '🔇 Live Audio Muted (Audition)';
            });
        }

        // Step 1: Initialize audiogram sliders
        this.initAudiogramSliders();
    }

    initAudiogramSliders() {
        const container = document.getElementById('audiogramSliders');
        if (!container) return;
        container.innerHTML = '';

        this.compressor.centerFreqs.forEach((freq, i) => {
            let col = document.createElement('div');
            col.className = 'slider-col';
            col.innerHTML = `
                <span class="freq-label">${freq >= 1000 ? (freq/1000)+'k' : freq}</span>
                <input type="range" class="vertical-slider" min="0" max="100" value="${this.compressor.hearingLoss[i]}" data-band="${i}">
                <span class="hl-val" id="hlVal_${i}">${this.compressor.hearingLoss[i]}</span>
            `;
            container.appendChild(col);

            let slider = col.querySelector('input');
            slider.addEventListener('input', (e) => {
                let val = parseInt(e.target.value, 10);
                this.compressor.setHearingLoss(i, val);
                document.getElementById(`hlVal_${i}`).innerText = val;
                this.wdrcView.render(this.compressor);
            });
        });
    }

    updateAudiogramSliders() {
        this.compressor.centerFreqs.forEach((freq, i) => {
            let slider = document.querySelector(`input[data-band="${i}"]`);
            let valSpan = document.getElementById(`hlVal_${i}`);
            if (slider && valSpan) {
                slider.value = this.compressor.hearingLoss[i];
                valSpan.innerText = this.compressor.hearingLoss[i];
            }
        });
    }

    onSoundfieldUpdated() {
        this.updateTelemetry();
    }

    updateTelemetry() {
        let targetGeom = this.soundfield.getSourceGeometry(this.soundfield.targetSource);
        let noiseGeom = this.soundfield.getSourceGeometry(this.soundfield.noiseSource);

        let di = this.beamformer.getDirectivityIndex(1500);
        let targetAngleDeg = Math.round(targetGeom.angle * 180 / Math.PI);
        let noiseAngleDeg = Math.round(noiseGeom.angle * 180 / Math.PI);

        // Update DOM elements
        let diElem = document.getElementById('telemDI');
        if (diElem) diElem.innerText = `${di.toFixed(1)} dB`;

        let erleElem = document.getElementById('telemERLE');
        if (erleElem) erleElem.innerText = this.afc.enabled ? `${(18.5 + di * 0.5).toFixed(1)} dB` : '0.0 dB (Off)';

        let loopElem = document.getElementById('telemLoopStatus');
        if (loopElem) {
            let isUnstable = !this.afc.enabled && this.acousticLoopGainDb > 0;
            loopElem.innerText = isUnstable ? 'CRITICAL (HOWLING)' : 'STABLE (SUPPRESSED)';
            loopElem.className = isUnstable ? 'status-pill danger' : 'status-pill success';
        }

        let anglesElem = document.getElementById('telemAngles');
        if (anglesElem) anglesElem.innerText = `Target: ${targetAngleDeg}° | Noise: ${noiseAngleDeg}°`;

        // Update audio bridge howling generator
        this.audioBridge.updateFeedbackSqueal(this.afc.enabled, this.acousticLoopGainDb);
    }

    startLoop() {
        const loop = () => {
            let targetGeom = this.soundfield.getSourceGeometry(this.soundfield.targetSource);
            let noiseGeom = this.soundfield.getSourceGeometry(this.soundfield.noiseSource);

            // Render Views
            this.polarScope.render(this.beamformer, targetGeom.angle, noiseGeom.angle);
            this.soundfieldView.render();
            this.wdrcView.render(this.compressor);

            let snrBoost = this.beamformer.getDirectivityIndex(1500);
            this.spectrumScope.updateSpectra(this.afc.enabled, this.acousticLoopGainDb, snrBoost);
            this.spectrumScope.render();

            this.updateTelemetry();
            requestAnimationFrame(loop);
        };
        requestAnimationFrame(loop);
    }
}

window.addEventListener('DOMContentLoaded', () => {
    window.app = new HearingAidStudioApp();
});
