/**
 * 2D Interactive Soundfield Canvas View
 * Allows dragging the target speech source and interfering noise source
 * in real-time around the listener's head.
 */
export class SoundfieldView {
    constructor(canvasId, soundfieldEngine, onUpdateCallback) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.engine = soundfieldEngine;
        this.onUpdate = onUpdateCallback;

        this.draggingTarget = false;
        this.draggingNoise = false;
        this.scale = 55; // pixels per meter
        this.time = 0;

        this.setupEvents();
    }

    setupEvents() {
        const getPos = (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;
            let px = clientX - rect.left;
            let py = clientY - rect.top;
            let cx = this.canvas.width / 2;
            let cy = this.canvas.height / 2;
            let x = (px - cx) / this.scale;
            let y = -(py - cy) / this.scale;
            return { x, y, px, py };
        };

        const onDown = (e) => {
            let { x, y } = getPos(e);
            let dTarget = Math.hypot(x - this.engine.targetSource.x, y - this.engine.targetSource.y);
            let dNoise = Math.hypot(x - this.engine.noiseSource.x, y - this.engine.noiseSource.y);

            if (dTarget < 0.4) {
                this.draggingTarget = true;
                e.preventDefault();
            } else if (dNoise < 0.4) {
                this.draggingNoise = true;
                e.preventDefault();
            }
        };

        const onMove = (e) => {
            if (!this.draggingTarget && !this.draggingNoise) return;
            e.preventDefault();
            let { x, y } = getPos(e);
            // Clamp to room bounds
            x = Math.max(-2.5, Math.min(2.5, x));
            y = Math.max(-2.5, Math.min(2.5, y));

            if (this.draggingTarget) {
                this.engine.setTargetPosition(x, y);
            } else if (this.draggingNoise) {
                this.engine.setNoisePosition(x, y);
            }

            if (this.onUpdate) this.onUpdate();
        };

        const onUp = () => {
            this.draggingTarget = false;
            this.draggingNoise = false;
        };

        this.canvas.addEventListener('mousedown', onDown);
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);

        this.canvas.addEventListener('touchstart', onDown, { passive: false });
        window.addEventListener('touchmove', onMove, { passive: false });
        window.addEventListener('touchend', onUp);
    }

    render() {
        const width = this.canvas.width;
        const height = this.canvas.height;
        const ctx = this.ctx;
        this.time += 0.04;

        ctx.clearRect(0, 0, width, height);

        const cx = width / 2;
        const cy = height / 2;

        // Dark background
        ctx.fillStyle = '#0a0e17';
        ctx.fillRect(0, 0, width, height);

        // Grid lines (1 meter spacing)
        ctx.strokeStyle = '#121a29';
        ctx.lineWidth = 1;
        for (let x = -3; x <= 3; x++) {
            let px = cx + x * this.scale;
            ctx.beginPath();
            ctx.moveTo(px, 0);
            ctx.lineTo(px, height);
            ctx.stroke();
        }
        for (let y = -3; y <= 3; y++) {
            let py = cy - y * this.scale;
            ctx.beginPath();
            ctx.moveTo(0, py);
            ctx.lineTo(width, py);
            ctx.stroke();
        }

        // Acoustic Wavefront Rings (Target)
        let tx = cx + this.engine.targetSource.x * this.scale;
        let ty = cy - this.engine.targetSource.y * this.scale;
        ctx.strokeStyle = 'rgba(16, 185, 129, 0.25)';
        for (let r = 1; r <= 3; r++) {
            let waveR = ((this.time * 25 + r * 30) % 90);
            ctx.beginPath();
            ctx.arc(tx, ty, waveR, 0, 2 * Math.PI);
            ctx.stroke();
        }

        // Acoustic Wavefront Rings (Noise)
        let nx = cx + this.engine.noiseSource.x * this.scale;
        let ny = cy - this.engine.noiseSource.y * this.scale;
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.22)';
        for (let r = 1; r <= 3; r++) {
            let waveR = ((this.time * 25 + r * 30) % 90);
            ctx.beginPath();
            ctx.arc(nx, ny, waveR, 0, 2 * Math.PI);
            ctx.stroke();
        }

        // Listener Head (Center)
        ctx.fillStyle = '#1e293b';
        ctx.beginPath();
        ctx.arc(cx, cy, 18, 0, 2 * Math.PI);
        ctx.fill();
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Nose (orientation pointer straight up +Y)
        ctx.beginPath();
        ctx.moveTo(cx - 5, cy - 18);
        ctx.lineTo(cx, cy - 25);
        ctx.lineTo(cx + 5, cy - 18);
        ctx.fillStyle = '#38bdf8';
        ctx.fill();

        // Left and Right Hearing Aid Ears
        ctx.fillStyle = '#f59e0b';
        // Right ear (+X)
        ctx.beginPath();
        ctx.arc(cx + 19, cy, 5, 0, 2 * Math.PI);
        ctx.fill();
        // Left ear (-X)
        ctx.beginPath();
        ctx.arc(cx - 19, cy, 5, 0, 2 * Math.PI);
        ctx.fill();

        // Target Source (Green Draggable Node)
        ctx.fillStyle = '#10b981';
        ctx.beginPath();
        ctx.arc(tx, ty, 10, 0, 2 * Math.PI);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = '#10b981';
        ctx.font = 'bold 11px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Target Speech', tx, ty - 14);

        // Noise Source (Red Draggable Node)
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(nx, ny, 10, 0, 2 * Math.PI);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = '#ef4444';
        ctx.font = 'bold 11px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Interfering Babble', nx, ny - 14);

        // Room Instructions
        ctx.fillStyle = '#64748b';
        ctx.font = '10px Inter, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('Drag sound sources to test beam directivity & SNR', 10, height - 12);
    }
}
