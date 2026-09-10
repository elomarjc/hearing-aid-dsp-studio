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


// ==========================================
// MOBILE FLOATING HUD & DRAWER CONTROLLER
// ==========================================
(function initMobileFloatingHUD() {
  const drawer = document.getElementById('telemetryDrawer');
  const backdrop = document.getElementById('telemetryBackdrop');
  const btnSettings = document.getElementById('btn-hud-settings');
  const btnTrigger = document.getElementById('btn-trigger-controls-drawer');
  const btnClose = document.getElementById('btn-close-telemetry');
  const btnFullscreen = document.getElementById('btn-hud-fullscreen');
  const btnMenu = document.getElementById('btn-hud-menu');

  function openDrawer() {
    if (drawer) drawer.classList.add('open');
    if (backdrop) backdrop.classList.add('active');
  }

  function closeDrawer() {
    if (drawer) drawer.classList.remove('open');
    if (backdrop) backdrop.classList.remove('active');
  }

  if (btnSettings) btnSettings.addEventListener('click', openDrawer);
  if (btnTrigger) btnTrigger.addEventListener('click', openDrawer);
  if (btnClose) btnClose.addEventListener('click', closeDrawer);
  if (backdrop) backdrop.addEventListener('click', closeDrawer);

  if (btnMenu) {
    btnMenu.addEventListener('click', () => {
      const guideBtn = document.getElementById('guideBtn') || document.getElementById('btnTourLauncher');
      if (guideBtn) guideBtn.click();
    });
  }

  // Cross-platform Universal Fullscreen
  if (btnFullscreen) {
    btnFullscreen.addEventListener('click', () => {
      if (!document.fullscreenElement && !document.webkitFullscreenElement) {
        if (document.documentElement.requestFullscreen) {
          document.documentElement.requestFullscreen().catch(() => {
            document.body.classList.toggle('immersive-fullscreen');
          });
        } else if (document.documentElement.webkitRequestFullscreen) {
          document.documentElement.webkitRequestFullscreen();
        } else {
          document.body.classList.toggle('immersive-fullscreen');
        }
      } else {
        if (document.exitFullscreen) {
          document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
          document.webkitExitFullscreen();
        }
        document.body.classList.remove('immersive-fullscreen');
      }
    });
  }

  // Left Rail: Loop Gain (-10 to 15 dB)
  const vGain = document.getElementById('slider-gain-vertical');
  const dGain = document.getElementById('loopGainSlider');
  const valGain = document.getElementById('hud-gain-val');
  const fillGain = document.getElementById('rail-fill-gain');

  function updateGainHUD(val) {
    const num = parseFloat(val);
    if (valGain) valGain.textContent = num.toFixed(1) + ' dB';
    if (fillGain) {
      // Range is -10 to 15 (span = 25)
      const pct = Math.max(0, Math.min(100, ((num - (-10)) / 25) * 100));
      fillGain.style.height = pct + '%';
    }
    if (vGain && Math.abs(parseFloat(vGain.value) - num) > 0.05) {
      vGain.value = num;
    }
  }

  if (vGain && dGain) {
    vGain.min = dGain.min || '-10';
    vGain.max = dGain.max || '15';
    vGain.step = dGain.step || '0.5';
    vGain.value = dGain.value;
    updateGainHUD(dGain.value);

    vGain.addEventListener('input', (e) => {
      dGain.value = e.target.value;
      dGain.dispatchEvent(new Event('input', { bubbles: true }));
      updateGainHUD(e.target.value);
    });

    dGain.addEventListener('input', (e) => {
      updateGainHUD(e.target.value);
    });
  }

  // Right Rail: LMS Adaptation Step Size Mu (0.005 to 0.2)
  const vMu = document.getElementById('slider-mu-vertical');
  const dMu = document.getElementById('muSlider');
  const valMu = document.getElementById('hud-mu-val');
  const fillMu = document.getElementById('rail-fill-mu');

  function updateMuHUD(val) {
    const num = parseFloat(val);
    if (valMu) valMu.textContent = num.toFixed(3);
    if (fillMu) {
      // Range is 0.005 to 0.2 (span = 0.195)
      const pct = Math.max(0, Math.min(100, ((num - 0.005) / 0.195) * 100));
      fillMu.style.height = pct + '%';
    }
    if (vMu && Math.abs(parseFloat(vMu.value) - num) > 0.001) {
      vMu.value = num;
    }
  }

  if (vMu && dMu) {
    vMu.min = dMu.min || '0.005';
    vMu.max = dMu.max || '0.2';
    vMu.step = dMu.step || '0.005';
    vMu.value = dMu.value;
    updateMuHUD(dMu.value);

    vMu.addEventListener('input', (e) => {
      dMu.value = e.target.value;
      dMu.dispatchEvent(new Event('input', { bubbles: true }));
      updateMuHUD(e.target.value);
    });

    dMu.addEventListener('input', (e) => {
      updateMuHUD(e.target.value);
    });
  }

  // Top-left Presets sync
  const pillPreset = document.getElementById('select-active-preset');
  const deskPreset = document.getElementById('presetSelect');
  if (pillPreset && deskPreset) {
    pillPreset.value = deskPreset.value;
    pillPreset.addEventListener('change', (e) => {
      deskPreset.value = e.target.value;
      deskPreset.dispatchEvent(new Event('change', { bubbles: true }));
    });
    deskPreset.addEventListener('change', (e) => {
      pillPreset.value = e.target.value;
    });
  }

  // Transport and Play/Pause
  let isSimPaused = false;
  const railPauseBtn = document.getElementById('btn-rail-pause');
  const transPauseBtn = document.getElementById('btn-transport-pause');
  const pauseIcon1 = document.getElementById('rail-pause-icon');
  const pauseIcon2 = document.getElementById('hud-pause-icon');
  const pauseText = document.getElementById('hud-pause-text');

  function toggleSimPause() {
    isSimPaused = !isSimPaused;
    const symbol = isSimPaused ? '▶' : '⏸';
    const text = isSimPaused ? 'RESUME' : 'PAUSE';
    if (pauseIcon1) pauseIcon1.textContent = symbol;
    if (pauseIcon2) pauseIcon2.textContent = symbol;
    if (pauseText) pauseText.textContent = text;
    if (transPauseBtn) transPauseBtn.classList.toggle('active', isSimPaused);
  }

  if (railPauseBtn) railPauseBtn.addEventListener('click', toggleSimPause);
  if (transPauseBtn) transPauseBtn.addEventListener('click', toggleSimPause);

  const stepBack = document.getElementById('btn-transport-step-back');
  const stepFwd = document.getElementById('btn-transport-step-fwd');
  if (stepBack && dGain) {
    stepBack.addEventListener('click', () => {
      let v = Math.max(-10, parseFloat(dGain.value) - 1.0);
      dGain.value = v;
      dGain.dispatchEvent(new Event('input', { bubbles: true }));
      updateGainHUD(v);
    });
  }
  if (stepFwd && dGain) {
    stepFwd.addEventListener('click', () => {
      let v = Math.min(15, parseFloat(dGain.value) + 1.0);
      dGain.value = v;
      dGain.dispatchEvent(new Event('input', { bubbles: true }));
      updateGainHUD(v);
    });
  }

  // Mode Cards
  const modeCardioid = document.getElementById('hud-mode-cardioid');
  const modeOmni = document.getElementById('hud-mode-omni');
  const modeAfc = document.getElementById('hud-mode-afc');
  const modeAudition = document.getElementById('hud-mode-audition');
  const afcToggle = document.getElementById('afcToggle');
  const liveAudioBtn = document.getElementById('liveAudioBtn');

  function updateAfcCardState() {
    if (afcToggle && modeAfc) {
      modeAfc.classList.toggle('active', afcToggle.checked);
    }
  }
  updateAfcCardState();

  if (afcToggle) {
    afcToggle.addEventListener('change', updateAfcCardState);
  }

  if (modeCardioid) {
    modeCardioid.addEventListener('click', () => {
      if (deskPreset) {
        deskPreset.value = 'steep_high_frequency';
        deskPreset.dispatchEvent(new Event('change', { bubbles: true }));
      }
      modeCardioid.classList.add('active');
      if (modeOmni) modeOmni.classList.remove('active');
    });
  }

  if (modeOmni) {
    modeOmni.addEventListener('click', () => {
      if (deskPreset) {
        deskPreset.value = 'normal';
        deskPreset.dispatchEvent(new Event('change', { bubbles: true }));
      }
      modeOmni.classList.add('active');
      if (modeCardioid) modeCardioid.classList.remove('active');
    });
  }

  if (modeAfc) {
    modeAfc.addEventListener('click', () => {
      if (afcToggle) {
        afcToggle.checked = !afcToggle.checked;
        afcToggle.dispatchEvent(new Event('change', { bubbles: true }));
        updateAfcCardState();
      }
    });
  }

  if (modeAudition) {
    modeAudition.addEventListener('click', () => {
      if (liveAudioBtn) {
        liveAudioBtn.click();
        const isActive = liveAudioBtn.classList.contains('active');
        modeAudition.classList.toggle('active', isActive);
      }
    });
  }

  // Direct pointer touch drag on vertical HUD rails
  function attachHearingRailDrag(container, onFracChange) {
    if (!container) return;
    container.style.touchAction = 'none';
    let dragging = false;
    const handleDrag = (e) => {
      const rect = container.getBoundingClientRect();
      const frac = Math.max(0, Math.min(1, (rect.bottom - e.clientY) / rect.height));
      onFracChange(frac);
    };
    container.addEventListener('pointerdown', (e) => {
      dragging = true;
      container.setPointerCapture?.(e.pointerId);
      handleDrag(e);
    });
    container.addEventListener('pointermove', (e) => {
      if (dragging) handleDrag(e);
    });
    const stopDrag = (e) => {
      if (dragging) {
        dragging = false;
        try { container.releasePointerCapture?.(e.pointerId); } catch (_) {}
      }
    };
    container.addEventListener('pointerup', stopDrag);
    container.addEventListener('pointercancel', stopDrag);
  }

  const gainRailTrack = document.querySelector('.hud-left-rail .hud-rail-track-container');
  attachHearingRailDrag(gainRailTrack, (frac) => {
    const val = (frac * 15).toFixed(1);
    if (dGain) {
      dGain.value = val;
      dGain.dispatchEvent(new Event('input', { bubbles: true }));
      updateGainHUD(val);
    }
  });

  const lmsRailTrack = document.querySelector('.hud-right-rail .hud-rail-track-container');
  attachHearingRailDrag(lmsRailTrack, (frac) => {
    const val = (0.001 + frac * 0.049).toFixed(3);
    if (dLms) {
      dLms.value = val;
      dLms.dispatchEvent(new Event('input', { bubbles: true }));
      updateLmsHUD(val);
    }
  });

})();
