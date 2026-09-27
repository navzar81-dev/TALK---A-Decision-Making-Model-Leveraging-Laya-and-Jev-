export class AudioEngine {
  private ctx: AudioContext | null = null;
  private micAnalyser: AnalyserNode | null = null;
  private playbackAnalyser: AnalyserNode | null = null;
  private micStream: MediaStream | null = null;
  private micSource: MediaStreamAudioSourceNode | null = null;
  private micDataArray: Uint8Array | null = null;
  private playbackDataArray: Uint8Array | null = null;
  private activeAudio: HTMLAudioElement | null = null;
  private playbackSourceNode: MediaElementAudioSourceNode | null = null;

  private getAudioContext(): AudioContext {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  async initMic(): Promise<boolean> {
    try {
      // First ensure any previous stream or audio playback is cleaned up
      this.cancelSpeech();
      this.stopMic();

      const ctx = this.getAudioContext();

      // Dedicated mic analyser - NEVER connected to ctx.destination (avoids audio echo loopback)
      this.micAnalyser = ctx.createAnalyser();
      this.micAnalyser.fftSize = 256;
      this.micAnalyser.smoothingTimeConstant = 0.8;
      this.micDataArray = new Uint8Array(this.micAnalyser.frequencyBinCount);

      // Request microphone with hardware/browser echo cancellation & noise suppression
      this.micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      this.micSource = ctx.createMediaStreamSource(this.micStream);
      // ONLY connect micSource to micAnalyser, NOT to ctx.destination!
      this.micSource.connect(this.micAnalyser);

      return true;
    } catch (e) {
      console.warn('Microphone access denied or unavailable:', e);
      this.stopMic();
      return false;
    }
  }

  getAudioLevel(): number {
    const activeAnalyser = (this.micStream && this.micAnalyser)
      ? this.micAnalyser
      : (this.activeAudio && !this.activeAudio.paused && this.playbackAnalyser)
        ? this.playbackAnalyser
        : null;

    if (!activeAnalyser) return 0;

    const data = activeAnalyser === this.micAnalyser ? this.micDataArray : this.playbackDataArray;
    if (!data) return 0;

    activeAnalyser.getByteFrequencyData(data as any);
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      sum += data[i];
    }
    const avg = sum / data.length;
    return Math.min(1.0, avg / 128.0);
  }

  getAudioBands(): { low: number; mid: number; high: number; all: number } {
    const activeAnalyser = (this.micStream && this.micAnalyser)
      ? this.micAnalyser
      : (this.activeAudio && !this.activeAudio.paused && this.playbackAnalyser)
        ? this.playbackAnalyser
        : null;

    if (!activeAnalyser) {
      return { low: 0, mid: 0, high: 0, all: 0 };
    }

    const data = activeAnalyser === this.micAnalyser ? this.micDataArray : this.playbackDataArray;
    if (!data) {
      return { low: 0, mid: 0, high: 0, all: 0 };
    }

    activeAnalyser.getByteFrequencyData(data as any);
    const count = data.length;

    let lowSum = 0;
    for (let i = 0; i < 4; i++) lowSum += data[i];
    const low = Math.min(1.0, (lowSum / 4) / 140.0);

    let midSum = 0;
    for (let i = 4; i < 20; i++) midSum += data[i];
    const mid = Math.min(1.0, (midSum / 16) / 130.0);

    let highSum = 0;
    for (let i = 20; i < 60; i++) highSum += data[i];
    const high = Math.min(1.0, (highSum / 40) / 110.0);

    let allSum = 0;
    for (let i = 0; i < count; i++) allSum += data[i];
    const all = Math.min(1.0, (allSum / count) / 128.0);

    return { low, mid, high, all };
  }

  stopMic() {
    if (this.micSource) {
      try {
        this.micSource.disconnect();
      } catch (e) {}
      this.micSource = null;
    }
    if (this.micStream) {
      this.micStream.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch (e) {}
      });
      this.micStream = null;
    }
    this.micAnalyser = null;
    this.micDataArray = null;
  }

  speakWithOrbReactivity(
    text: string,
    onStart?: () => void,
    onEnd?: () => void,
    onAudioLevel?: (level: number) => void
  ) {
    this.stopMic(); // Ensure mic is inactive while speaking to avoid acoustic feedback
    this.cancelSpeech();

    if (!('speechSynthesis' in window)) {
      if (onEnd) onEnd();
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.05;
    utterance.pitch = 1.0;

    let simInterval: number | null = null;

    utterance.onstart = () => {
      if (onStart) onStart();
      simInterval = window.setInterval(() => {
        const level = 0.3 + Math.random() * 0.55;
        if (onAudioLevel) onAudioLevel(level);
      }, 70);
    };

    const cleanup = () => {
      if (simInterval) clearInterval(simInterval);
      if (onAudioLevel) onAudioLevel(0);
      if (onEnd) onEnd();
    };

    utterance.onend = cleanup;
    utterance.onerror = cleanup;

    window.speechSynthesis.speak(utterance);
  }

  async playNeuralAudioStream(
    audioUrl: string,
    onStart?: () => void,
    onEnd?: () => void,
    onAudioLevel?: (level: number) => void
  ): Promise<boolean> {
    this.stopMic(); // Ensure mic is inactive during assistant speech
    this.cancelSpeech();

    try {
      const ctx = this.getAudioContext();

      const audio = new Audio(audioUrl);
      this.activeAudio = audio;

      // Dedicated playback analyser
      this.playbackAnalyser = ctx.createAnalyser();
      this.playbackAnalyser.fftSize = 256;
      this.playbackAnalyser.smoothingTimeConstant = 0.8;
      this.playbackDataArray = new Uint8Array(this.playbackAnalyser.frequencyBinCount);

      try {
        this.playbackSourceNode = ctx.createMediaElementSource(audio);
        this.playbackSourceNode.connect(this.playbackAnalyser);
        this.playbackAnalyser.connect(ctx.destination);
      } catch (err) {
        console.warn('Playback media element connect warning:', err);
      }

      let animLoop: number | null = null;
      const pollLevel = () => {
        if (this.playbackAnalyser && this.playbackDataArray && onAudioLevel) {
          this.playbackAnalyser.getByteFrequencyData(this.playbackDataArray as any);
          let sum = 0;
          for (let i = 0; i < this.playbackDataArray.length; i++) sum += this.playbackDataArray[i];
          const avg = sum / this.playbackDataArray.length;
          onAudioLevel(Math.min(1.0, avg / 110.0));
        }
        animLoop = requestAnimationFrame(pollLevel);
      };

      audio.onplay = () => {
        if (onStart) onStart();
        pollLevel();
      };

      const cleanup = () => {
        if (animLoop) cancelAnimationFrame(animLoop);
        if (onAudioLevel) onAudioLevel(0);
        if (onEnd) onEnd();
        this.cleanupPlaybackNodes();
      };

      audio.onended = cleanup;
      audio.onerror = cleanup;

      await audio.play();
      return true;
    } catch (e) {
      console.warn('Neural audio playback failed, will fallback to browser TTS:', e);
      this.cleanupPlaybackNodes();
      if (onEnd) onEnd();
      return false;
    }
  }

  private cleanupPlaybackNodes() {
    if (this.playbackSourceNode) {
      try {
        this.playbackSourceNode.disconnect();
      } catch (e) {}
      this.playbackSourceNode = null;
    }
    if (this.playbackAnalyser) {
      try {
        this.playbackAnalyser.disconnect();
      } catch (e) {}
      this.playbackAnalyser = null;
    }
    this.playbackDataArray = null;
    if (this.activeAudio) {
      try {
        this.activeAudio.pause();
        this.activeAudio.currentTime = 0;
      } catch (e) {}
      this.activeAudio = null;
    }
  }

  cancelSpeech() {
    this.cleanupPlaybackNodes();
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }
}

