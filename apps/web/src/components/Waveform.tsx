interface WaveformProps {
  levels: number[];
  isRecording: boolean;
}

export function Waveform({ levels, isRecording }: WaveformProps) {
  const bars = levels.length ? levels : Array.from({ length: 96 }, () => 0.04);

  return (
    <div className="waveform" aria-label="Real-time waveform level display">
      {bars.map((level, index) => (
        <span
          className={isRecording ? "wave-bar active" : "wave-bar"}
          key={`${index}-${level.toFixed(3)}`}
          style={{ height: `${Math.max(6, level * 100)}%` }}
        />
      ))}
    </div>
  );
}
