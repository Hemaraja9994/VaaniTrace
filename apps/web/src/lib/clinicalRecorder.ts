import { downsampleToMono, encodeMono16BitWav, type EncodedWav } from "./wav";

type LevelListener = (samples: Float32Array) => void;

export class ClinicalAudioRecorder {
  private stream?: MediaStream;
  private audioContext?: AudioContext;
  private source?: MediaStreamAudioSourceNode;
  private processor?: ScriptProcessorNode;
  private muteGain?: GainNode;
  private mediaRecorder?: MediaRecorder;
  private chunks: Float32Array[] = [];
  private inputSampleRate = 16000;
  private startedAt = 0;

  constructor(private readonly onSamples?: LevelListener) {}

  async start(): Promise<void> {
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: { ideal: 1 },
        sampleRate: { ideal: 16000 },
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false
      }
    });

    this.audioContext = new AudioContext({ sampleRate: 16000 });
    this.inputSampleRate = this.audioContext.sampleRate;
    this.source = this.audioContext.createMediaStreamSource(this.stream);
    this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);
    this.chunks = [];

    this.processor.onaudioprocess = (event) => {
      const channel = event.inputBuffer.getChannelData(0);
      const copy = new Float32Array(channel);
      this.chunks.push(copy);
      this.onSamples?.(copy);
    };

    this.muteGain = this.audioContext.createGain();
    this.muteGain.gain.value = 0;
    this.source.connect(this.processor);
    this.processor.connect(this.muteGain);
    this.muteGain.connect(this.audioContext.destination);

    if (typeof MediaRecorder !== "undefined") {
      const options = MediaRecorder.isTypeSupported("audio/wav")
        ? { mimeType: "audio/wav" }
        : undefined;
      this.mediaRecorder = new MediaRecorder(this.stream, options);
      this.mediaRecorder.start(1000);
    }

    this.startedAt = performance.now();
  }

  async stop(): Promise<EncodedWav> {
    const durationMs = performance.now() - this.startedAt;
    this.mediaRecorder?.state === "recording" && this.mediaRecorder.stop();

    this.processor?.disconnect();
    this.muteGain?.disconnect();
    this.source?.disconnect();
    await this.audioContext?.close();
    this.stream?.getTracks().forEach((track) => track.stop());

    const totalLength = this.chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const merged = new Float32Array(totalLength);
    let offset = 0;
    for (const chunk of this.chunks) {
      merged.set(chunk, offset);
      offset += chunk.length;
    }

    const sampleRate = 16000;
    const mono16k = downsampleToMono(merged, this.inputSampleRate, sampleRate);
    return {
      blob: encodeMono16BitWav(mono16k, sampleRate),
      durationMs,
      sampleRate,
      channelCount: 1
    };
  }
}
