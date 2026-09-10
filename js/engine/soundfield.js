/**
 * 2D Spatial Acoustic Soundfield Engine
 * Models acoustic propagation, geometric attenuation, and head shadow (ILD/ITD)
 * between spatial sound sources and hearing instrument microphone pairs.
 */
export class SoundfieldEngine {
    constructor() {
        this.speedOfSound = 343.0; // m/s
        this.headRadius = 0.09; // 9 cm (18 cm interaural ear distance)
        this.micSpacing = 0.012; // 12 mm between front and rear mic

        // Listener position and head orientation (radians, 0 = facing +Y)
        this.listener = { x: 0.0, y: 0.0, orientation: 0.0 };

        // Sources: target speech (green) and noise interferer (red)
        this.targetSource = { x: 0.0, y: 2.0, levelDb: 65.0, label: "Target Speech (0°)" };
        this.noiseSource = { x: 2.2, y: 0.8, levelDb: 68.0, label: "Babble Noise (110°)" };

        // Acoustic simulation state
        this.snrIn = 0.0;
        this.snrOut = 0.0;
    }

    setTargetPosition(x, y) {
        this.targetSource.x = x;
        this.targetSource.y = y;
    }

    setNoisePosition(x, y) {
        this.noiseSource.x = x;
        this.noiseSource.y = y;
    }

    /**
     * Compute relative angle and distance from listener to source
     */
    getSourceGeometry(source) {
        let dx = source.x - this.listener.x;
        let dy = source.y - this.listener.y;
        let distance = Math.max(0.3, Math.sqrt(dx * dx + dy * dy));
        // Angle relative to head orientation: 0 rad = straight ahead (+Y)
        let worldAngle = Math.atan2(dx, dy);
        let relAngle = worldAngle - this.listener.orientation;
        while (relAngle > Math.PI) relAngle -= 2 * Math.PI;
        while (relAngle < -Math.PI) relAngle += 2 * Math.PI;

        return { distance, angle: relAngle };
    }

    /**
     * Approximate Head-Related Transfer Function (HRTF) level attenuation (dB)
     * based on spherical head diffraction model for a given frequency
     */
    computeHeadShadowDb(angle, ear = 'right', frequency = 2000) {
        // ear is 'right' (+X) or 'left' (-X)
        let earAngle = (ear === 'right') ? Math.PI / 2 : -Math.PI / 2;
        let incidentDiff = Math.abs(angle - earAngle);
        while (incidentDiff > Math.PI) incidentDiff = 2 * Math.PI - incidentDiff;

        // On contralateral side (opposite ear), high frequencies are shadowed
        if (incidentDiff > Math.PI / 2) {
            let shadowFactor = (incidentDiff - Math.PI / 2) / (Math.PI / 2);
            let maxShadowDb = Math.min(18.0, 4.0 * Math.log2(frequency / 400.0));
            return -shadowFactor * Math.max(0.0, maxShadowDb);
        }
        // Ipsilateral pinna boost
        return +1.5;
    }

    /**
     * Generate synthetic front and rear microphone signals for the right hearing aid
     */
    synthesizeMicPair(speechSignal, noiseSignal) {
        let targetGeom = this.getSourceGeometry(this.targetSource);
        let noiseGeom = this.getSourceGeometry(this.noiseSource);

        // Geometric 1/r path attenuation
        let targetAtten = 1.0 / targetGeom.distance;
        let noiseAtten = 1.0 / noiseGeom.distance;

        // Front vs Rear mic acoustic path difference (delay tau)
        // Array axis is aligned with head orientation
        let tauTarget = (this.micSpacing / this.speedOfSound) * Math.cos(targetGeom.angle);
        let tauNoise = (this.micSpacing / this.speedOfSound) * Math.cos(noiseGeom.angle);

        // Microphone signals (superposition of target + noise)
        let frontMic = speechSignal * targetAtten + noiseSignal * noiseAtten;
        
        // Approximate rear mic phase shift for test synthesis
        let rearSpeech = speechSignal * targetAtten * Math.cos(2 * Math.PI * 1000 * tauTarget);
        let rearNoise = noiseSignal * noiseAtten * Math.cos(2 * Math.PI * 1000 * tauNoise);
        let rearMic = rearSpeech + rearNoise;

        // Compute input SNR
        let pSpeech = (speechSignal * targetAtten) ** 2;
        let pNoise = (noiseSignal * noiseAtten) ** 2;
        this.snrIn = 10.0 * Math.log10(Math.max(1e-4, pSpeech) / Math.max(1e-4, pNoise));

        return { frontMic, rearMic, targetGeom, noiseGeom };
    }
}
