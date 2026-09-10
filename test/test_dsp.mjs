import test from 'node:test';
import assert from 'node:assert/strict';

import { SpatialBeamformer } from '../js/engine/beamformer.js';
import { AdaptiveFeedbackCanceler } from '../js/engine/feedback-canceler.js';
import { WDRCCompressor } from '../js/engine/wdrc-compressor.js';
import { SoundfieldEngine } from '../js/engine/soundfield.js';

test('SpatialBeamformer: cardioid pattern front-to-back ratio and directivity index', () => {
    const bf = new SpatialBeamformer(44100, 0.012);
    bf.setMode('cardioid');

    // On-axis gain (0 deg) vs rear gain (180 deg)
    const frontGain = bf.getPolarResponse(0.0, 1500);
    const rearGain = bf.getPolarResponse(Math.PI, 1500);
    const fbrDb = 20 * Math.log10(frontGain / Math.max(1e-4, rearGain));

    assert.ok(fbrDb > 15.0, `Cardioid front-to-back ratio should exceed 15 dB, got ${fbrDb.toFixed(1)} dB`);

    // Directivity Index should be >= 4.0 dB for cardioid
    const di = bf.getDirectivityIndex(1500);
    assert.ok(di >= 4.0, `Cardioid DI should be >= 4.0 dB, got ${di.toFixed(2)} dB`);
});

test('AdaptiveFeedbackCanceler: NLMS convergence and ERLE attenuation', () => {
    const afc = new AdaptiveFeedbackCanceler(64, 0.08, 44100);
    
    // Train the adaptive filter with random noise excitation
    let erleFinal = 0.0;
    for (let n = 0; n < 3000; n++) {
        let receiverSig = (Math.random() * 2 - 1) * 0.5;
        let trueFeedback = afc.simulateAcousticLeakage(receiverSig);
        // Small desired speech signal added
        let speech = 0.05 * Math.sin(2 * Math.PI * 440 * (n / 44100));
        let micInput = speech + trueFeedback;

        let error = afc.process(micInput, receiverSig);
        erleFinal = afc.erle;
    }

    // After 3000 samples (~68 ms), filter should achieve significant feedback cancellation
    assert.ok(afc.misalignment < 0.5, `Misalignment should converge below 0.5, got ${afc.misalignment.toFixed(3)}`);
    assert.ok(erleFinal >= 10.0, `ERLE should exceed 10 dB after training, got ${erleFinal.toFixed(1)} dB`);
});

test('WDRCCompressor: NAL-NL2 prescription, filterbank stability and limiting', () => {
    const comp = new WDRCCompressor(44100);
    comp.setPreset('steep_high_frequency');

    // 8 kHz band (index 5) should have significantly higher gain than 250 Hz (index 0)
    const gainLow = comp.bands[0].gain;
    const gainHigh = comp.bands[5].gain;
    assert.ok(gainHigh > gainLow + 15.0, `High frequency gain (${gainHigh} dB) should be > low freq gain (${gainLow} dB) + 15 dB`);

    // Feed a burst of audio through the filterbank
    for (let i = 0; i < 500; i++) {
        let sample = Math.sin(2 * Math.PI * 1000 * (i / 44100)) * 0.8;
        let out = comp.process(sample);
        assert.ok(!Number.isNaN(out), 'Output sample should not be NaN');
        assert.ok(Math.abs(out) <= 1.25, `Limiter should bound output sample below 1.25, got ${out}`);
    }
});

test('SoundfieldEngine: geometry and head shadow attenuation', () => {
    const sf = new SoundfieldEngine();
    sf.setTargetPosition(0.0, 2.0); // 0 deg straight ahead
    sf.setNoisePosition(2.0, 0.0); // 90 deg on right side

    const targetGeom = sf.getSourceGeometry(sf.targetSource);
    const noiseGeom = sf.getSourceGeometry(sf.noiseSource);

    assert.ok(Math.abs(targetGeom.angle) < 0.01, 'Target angle should be ~0 rad');
    assert.ok(Math.abs(noiseGeom.angle - Math.PI / 2) < 0.01, 'Noise angle should be ~PI/2 rad (90 deg)');

    // Contralateral ear should experience head shadow attenuation
    const shadowLeft = sf.computeHeadShadowDb(Math.PI / 2, 'left', 4000);
    assert.ok(shadowLeft < -8.0, `Contralateral head shadow should be < -8 dB, got ${shadowLeft.toFixed(1)} dB`);
});
