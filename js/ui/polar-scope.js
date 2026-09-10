/**
 * Polar Directivity Scope
 * Renders 360-degree beamformer directivity response with dB grids,
 * angle markers, and directivity index readout.
 */
export class PolarScope {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
    }

    render(beamformer, targetAngle = 0, noiseAngle = Math.PI * 0.6) {
        const width = this.canvas.width;
        const height = this.canvas.height;
        const ctx = this.ctx;

        ctx.clearRect(0, 0, width, height);

        const cx = width / 2;
        const cy = height / 2;
        const maxRadius = Math.min(cx, cy) - 26;

        // Background
        ctx.fillStyle = '#0a0e17';
        ctx.fillRect(0, 0, width, height);

        // Concentric circles (dB attenuation: 0 dB, -6 dB, -12 dB, -18 dB, -24 dB)
        const dbLevels = [0, -6, -12, -18, -24];
        ctx.textAlign = 'left';
        ctx.font = '10px Inter, monospace';

        dbLevels.forEach((db, idx) => {
            let r = maxRadius * (1.0 - idx * 0.22);
            ctx.beginPath();
            ctx.arc(cx, cy, r, 0, 2 * Math.PI);
            ctx.strokeStyle = idx === 0 ? '#1f293d' : '#141d2e';
            ctx.lineWidth = 1;
            ctx.stroke();

            ctx.fillStyle = '#4a5b78';
            ctx.fillText(`${db} dB`, cx + 6, cy - r + 12);
        });

        // Radial angle lines (every 30 deg)
        for (let deg = 0; deg < 360; deg += 30) {
            let rad = (deg - 90) * Math.PI / 180;
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.lineTo(cx + maxRadius * Math.cos(rad), cy + maxRadius * Math.sin(rad));
            ctx.strokeStyle = (deg % 90 === 0) ? '#1f293d' : '#0e1624';
            ctx.stroke();

            // Degree labels
            if (deg % 90 === 0) {
                let label = deg === 0 ? '0° (Front)' : deg === 90 ? '90°' : deg === 180 ? '180° (Rear)' : '270°';
                let lx = cx + (maxRadius + 14) * Math.cos(rad);
                let ly = cy + (maxRadius + 14) * Math.sin(rad);
                ctx.fillStyle = '#64748b';
                ctx.textAlign = 'center';
                ctx.fillText(label, lx, ly + 3);
            }
        }

        // Draw Polar Response Curve
        const steps = 180;
        ctx.beginPath();
        for (let i = 0; i <= steps; i++) {
            let theta = (i / steps) * 2 * Math.PI;
            // Angle 0 is straight ahead (-Y on canvas)
            let gain = beamformer.getPolarResponse(theta, 1500);
            
            // Map linear gain to radius (clamped to -30 dB)
            let gainDb = 20 * Math.log10(Math.max(0.03, gain));
            let normRadius = Math.max(0, (gainDb + 24) / 24) * maxRadius;

            let canvasAngle = theta - Math.PI / 2;
            let px = cx + normRadius * Math.cos(canvasAngle);
            let py = cy + normRadius * Math.sin(canvasAngle);

            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fillStyle = 'rgba(14, 165, 233, 0.18)';
        ctx.fill();
        ctx.strokeStyle = '#0ea5e9';
        ctx.lineWidth = 2.2;
        ctx.stroke();

        // Draw Target Angle Vector (Green)
        let tRad = targetAngle - Math.PI / 2;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + maxRadius * Math.cos(tRad), cy + maxRadius * Math.sin(tRad));
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Draw Noise Angle Vector (Red)
        let nRad = noiseAngle - Math.PI / 2;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + maxRadius * Math.cos(nRad), cy + maxRadius * Math.sin(nRad));
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Overlay Legend / DI
        let di = beamformer.getDirectivityIndex(1500).toFixed(1);
        ctx.fillStyle = '#f8fafc';
        ctx.font = 'bold 12px Inter, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(`DI: ${di} dB`, 12, 22);

        ctx.font = '11px Inter, sans-serif';
        ctx.fillStyle = '#94a3b8';
        ctx.fillText(`Pattern: ${beamformer.mode.toUpperCase()}`, 12, 38);
    }
}
