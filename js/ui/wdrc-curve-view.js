/**
 * WDRC Input/Output Curve & Audiogram Visualizer
 * Renders static non-linear compression curves and audiogram hearing thresholds.
 */
export class WDRCCurveView {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.selectedBand = 3; // 2 kHz band by default
    }

    setSelectedBand(bandIndex) {
        this.selectedBand = bandIndex;
    }

    render(compressor) {
        const width = this.canvas.width;
        const height = this.canvas.height;
        const ctx = this.ctx;

        ctx.clearRect(0, 0, width, height);

        // Dark background
        ctx.fillStyle = '#0a0e17';
        ctx.fillRect(0, 0, width, height);

        const padLeft = 45;
        const padBottom = 35;
        const padTop = 20;
        const padRight = 20;

        const plotW = width - padLeft - padRight;
        const plotH = height - padTop - padBottom;

        // Coordinates mapping (0 to 110 dB SPL)
        const mapX = (db) => padLeft + (db / 110.0) * plotW;
        const mapY = (db) => (padTop + plotH) - (db / 110.0) * plotH;

        // Grid lines (every 20 dB)
        ctx.strokeStyle = '#141d2e';
        ctx.lineWidth = 1;
        ctx.font = '10px Inter, monospace';
        ctx.fillStyle = '#4a5b78';

        for (let db = 0; db <= 110; db += 20) {
            let px = mapX(db);
            let py = mapY(db);

            // Vertical grid
            ctx.beginPath();
            ctx.moveTo(px, padTop);
            ctx.lineTo(px, padTop + plotH);
            ctx.stroke();

            // Horizontal grid
            ctx.beginPath();
            ctx.moveTo(padLeft, py);
            ctx.lineTo(padLeft + plotW, py);
            ctx.stroke();

            // Axis labels
            ctx.textAlign = 'right';
            ctx.fillText(`${db}`, padLeft - 6, py + 3);
            ctx.textAlign = 'center';
            ctx.fillText(`${db}`, px, padTop + plotH + 15);
        }

        // Axis Titles
        ctx.fillStyle = '#94a3b8';
        ctx.font = '11px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Input Sound Level (dB SPL)', padLeft + plotW / 2, height - 6);

        ctx.save();
        ctx.translate(14, padTop + plotH / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText('Output Level (dB SPL)', 0, 0);
        ctx.restore();

        // 45-degree Unity Reference Line (dashed)
        ctx.beginPath();
        ctx.setLineDash([4, 4]);
        ctx.moveTo(mapX(0), mapY(0));
        ctx.lineTo(mapX(110), mapY(110));
        ctx.strokeStyle = '#27354a';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.setLineDash([]);

        // Active Band WDRC Curve
        let band = compressor.bands[this.selectedBand];
        ctx.beginPath();
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = '#0ea5e9';

        for (let inDb = 0; inDb <= 110; inDb += 2) {
            let outDb = compressor.computeStaticOutputDb(this.selectedBand, inDb);
            let px = mapX(inDb);
            let py = mapY(outDb);
            if (inDb === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }
        ctx.stroke();

        // Highlight Knee Points
        let ckX = mapX(band.ck);
        let ckY = mapY(compressor.computeStaticOutputDb(this.selectedBand, band.ck));
        ctx.fillStyle = '#f59e0b';
        ctx.beginPath();
        ctx.arc(ckX, ckY, 4.5, 0, 2 * Math.PI);
        ctx.fill();

        // Label Info
        ctx.fillStyle = '#f8fafc';
        ctx.font = 'bold 12px Inter, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(`Band: ${band.fc} Hz | Gain: ${band.gain.toFixed(1)} dB | CR: ${band.cr.toFixed(1)}:1`, padLeft + 10, padTop + 16);

        ctx.font = '10px Inter, sans-serif';
        ctx.fillStyle = '#94a3b8';
        ctx.fillText(`Knee: ${band.ck} dB SPL | Limiter MPO: ${band.mpo.toFixed(0)} dB SPL`, padLeft + 10, padTop + 30);
    }
}
