/**
 * Real-Time Spectrum Analyzer Scope
 * Visualizes dual spectral FFT curves comparing raw microphone input
 * vs cleaned hearing aid output (feedback suppressed, beamformed, compressed).
 */
export class SpectrumScope {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.numBins = 64;

        // Spectral power buffers (smoothed)
        this.rawPower = new Float32Array(this.numBins);
        this.cleanedPower = new Float32Array(this.numBins);
        this.smoother = 0.85;
    }

    updateSpectra(afcEnabled, loopGainMarginDb, snrBoostDb) {
        // Synthesize dynamic spectrum with speech formants and howling spike
        for (let i = 0; i < this.numBins; i++) {
            let freq = (i / this.numBins) * 8000;
            
            // Baseline noise floor (~-65 dB)
            let rawDb = -65.0 + Math.random() * 4.0;
            
            // Speech formants at ~750 Hz (bin 6) and ~1500 Hz (bin 12)
            if (Math.abs(freq - 750) < 300) rawDb += 25.0 * Math.exp(-((freq - 750) ** 2) / 40000);
            if (Math.abs(freq - 1500) < 400) rawDb += 20.0 * Math.exp(-((freq - 1500) ** 2) / 60000);

            // Feedback howling peak at ~3120 Hz (bin 25)
            if (Math.abs(freq - 3120) < 150) {
                if (!afcEnabled && loopGainMarginDb > 0) {
                    rawDb += 35.0 + loopGainMarginDb * 1.5; // Unstable howl spike
                } else {
                    rawDb += 5.0; // Controlled acoustic reflection
                }
            }

            let cleanedDb = rawDb;
            // Beamforming improves SNR by suppressing off-axis noise floor
            cleanedDb -= Math.max(0, snrBoostDb * 0.7);

            // AFC knocks down the 3.1 kHz howling spike by 25 dB
            if (afcEnabled && Math.abs(freq - 3120) < 200) {
                cleanedDb = Math.min(cleanedDb, -45.0);
            }

            // Smooth spectral traces
            this.rawPower[i] = this.smoother * this.rawPower[i] + (1 - this.smoother) * rawDb;
            this.cleanedPower[i] = this.smoother * this.cleanedPower[i] + (1 - this.smoother) * cleanedDb;
        }
    }

    render() {
        const width = this.canvas.width;
        const height = this.canvas.height;
        const ctx = this.ctx;

        ctx.clearRect(0, 0, width, height);

        // Dark background
        ctx.fillStyle = '#0a0e17';
        ctx.fillRect(0, 0, width, height);

        const padLeft = 40;
        const padBottom = 25;
        const padTop = 15;
        const padRight = 15;
        const plotW = width - padLeft - padRight;
        const plotH = height - padTop - padBottom;

        // Coordinates mapping (-80 dB to 0 dB)
        const mapY = (db) => (padTop + plotH) - ((db + 80) / 80.0) * plotH;
        const mapX = (bin) => padLeft + (bin / (this.numBins - 1)) * plotW;

        // Grid lines (every 20 dB)
        ctx.strokeStyle = '#141d2e';
        ctx.lineWidth = 1;
        ctx.font = '10px Inter, monospace';
        ctx.fillStyle = '#4a5b78';
        ctx.textAlign = 'right';

        for (let db = -80; db <= 0; db += 20) {
            let py = mapY(db);
            ctx.beginPath();
            ctx.moveTo(padLeft, py);
            ctx.lineTo(padLeft + plotW, py);
            ctx.stroke();
            ctx.fillText(`${db}`, padLeft - 6, py + 3);
        }

        // Frequency Labels (1k, 2k, 4k, 8k)
        const fLabels = [
            { f: '1k', bin: Math.floor(this.numBins * (1000 / 8000)) },
            { f: '2k', bin: Math.floor(this.numBins * (2000 / 8000)) },
            { f: '4k', bin: Math.floor(this.numBins * (4000 / 8000)) },
            { f: '8k', bin: this.numBins - 1 }
        ];
        ctx.textAlign = 'center';
        fLabels.forEach(fl => {
            let px = mapX(fl.bin);
            ctx.beginPath();
            ctx.moveTo(px, padTop);
            ctx.lineTo(px, padTop + plotH);
            ctx.stroke();
            ctx.fillText(fl.f, px, padTop + plotH + 15);
        });

        // 1. Raw Microphone Spectrum (Red / Pink trace)
        ctx.beginPath();
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 1.6;
        for (let i = 0; i < this.numBins; i++) {
            let px = mapX(i);
            let py = mapY(Math.max(-80, Math.min(0, this.rawPower[i])));
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }
        ctx.stroke();

        // 2. Cleaned Output Spectrum (Emerald Green trace)
        ctx.beginPath();
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 2.0;
        for (let i = 0; i < this.numBins; i++) {
            let px = mapX(i);
            let py = mapY(Math.max(-80, Math.min(0, this.cleanedPower[i])));
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }
        ctx.stroke();

        // Legend
        ctx.font = 'bold 11px Inter, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillStyle = '#ef4444';
        ctx.fillText('— Raw Mic (with Feedback)', padLeft + 10, padTop + 14);
        ctx.fillStyle = '#10b981';
        ctx.fillText('— Processed DSP Output', padLeft + 190, padTop + 14);
    }
}
