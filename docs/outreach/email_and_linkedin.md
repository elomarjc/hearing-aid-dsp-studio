# Technical Outreach Package: Demant / Oticon & Hearing Aid Audio DSP

## 1. Target Executive & Engineering Contacts
* **Primary Organization:** Demant / Oticon / Eriksholm Research Centre
* **Locations:** Smørum (HQ & Platform R&D), Aalborg (Audio DSP & Software Hub)
* **Target Roles:**
  * Senior Vice President of R&D: Kim Brusgaard Haldne
  * Director of Audiological Solutions: Anders Højsgaard Thomsen
  * Lead Audio DSP Specialists & Platform Firmware Engineers
* **LinkedIn Boolean Search Query:**  
  `("Demant" OR "Oticon") AND ("Aalborg" OR "Smørum" OR "Capital Region of Denmark") AND ("DSP" OR "Signal Processing" OR "Audiology" OR "Embedded Audio") AND ("Director" OR "Head" OR "Lead" OR "Manager")`

---

## 2. Reverse-Engineered Cold Outreach Email

**Subject:** Interactive DSP Twin: Dual-Mic Beamforming & Adaptive Feedback Cancellation

> Dear [First Name / Anders / Kim],
>
> When designing open-fit hearing instruments like the Oticon Intent series, balancing high target insertion gain against acoustic feedback leakage while preserving natural spatial cues is one of the most demanding problems in embedded audio DSP.
>
> To explore this challenge hands-on, I developed an interactive in-browser **Audiological DSP Studio** that models the full signal chain in real time:
>
> 🔗 **Live Simulator:** https://elomarjc.github.io/hearing-aid-dsp-studio/  
> 🔗 **Source Code & Mathematical Derivations:** https://github.com/elomarjc/hearing-aid-dsp-studio
>
> **Under the hood of the simulator:**
> * **Spatial Beamformer:** Delay-and-sum differential microphone array ($d = 12\text{ mm}$) with real-time polar directivity plots and steerable nulls.
> * **Adaptive Feedback Cancellation:** 64-tap Normalized LMS (NLMS) filter with entrainment detection modeling acoustic leakage path $H_{\text{fb}}(z)$ (toggleable live audio demonstrating instantaneous howling suppression).
> * **Audiogram & 6-Band WDRC:** Multi-band compression with NAL-NL2 target fitting, dual attack/release envelope tracking, and non-linear kneepoints.
>
> Having completed my Bachelor's Project in Electronic Engineering at Aalborg University focusing on digital signal processing, control systems, and real-time architectures, I have long admired Demant's leadership in cognitive hearing science.
>
> I would love to hear your feedback on the acoustic model if you have 5 minutes for a quick technical exchange.
>
> Best regards,  
> **Jacob El-Omar**  
> Aalborg, Denmark | +45 XX XX XX XX | [LinkedIn Profile URL]

---

## 3. High-Engagement Technical LinkedIn Post

```markdown
👂 Solving Acoustic Feedback & The Cocktail Party Problem in Real-Time DSP 🎧

In open-vent hearing instruments, high insertion gain creates an acoustic feedback loop: sound from the receiver leaks back into the microphones, causing unstable oscillation (howling). At the same time, separating speech from multi-talker babble using sub-centimeter microphone spacing is a severe spatial filtering challenge.

To visualize and benchmark these trade-offs, I built an interactive **Audiological DSP Studio** running entirely in the browser:

🚀 Live Demo: https://elomarjc.github.io/hearing-aid-dsp-studio/
💻 GitHub Repo: https://github.com/elomarjc/hearing-aid-dsp-studio

Key Engineering Implementations:
1️⃣ Dual-Microphone Differential Beamforming (d = 12 mm): Computes real-time delay-and-sum cardioid, supercardioid, and adaptive MVDR beam patterns with 60 FPS polar directivity visualization.
2️⃣ Adaptive Feedback Cancellation (AFC): 64-tap Normalized LMS (NLMS) filter with variable step size and decorrelation to suppress howling without canceling tonal speech formants. (Turn on audio to hear the screech extinguish in real time!)
3️⃣ 6-Band WDRC Filterbank: Octave-band audiological fitting (250 Hz - 8 kHz) with adjustable kneepoints, compression ratios, and dual-time-constant envelope detectors aligned with NAL-NL2 targets.

Built with modern ES6, Web Audio API, and HTML5 Canvas.

I would love to hear thoughts from the audio DSP and hearing healthcare engineering community in Denmark!

#AudioDSP #SignalProcessing #HearingAids #Demant #Oticon #WSAudiology #MedTech #EmbeddedAudio #WebAudio #AalborgUniversity
```
