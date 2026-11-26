export type SoundName = 'plant' | 'fire' | 'kill' | 'bell'

const TUNES: Record<SoundName, [frequency: number, seconds: number][]> = {
  plant: [
    [330, 0.08],
    [440, 0.1],
  ],
  fire: [
    [520, 0.06],
    [390, 0.08],
  ],
  kill: [
    [220, 0.1],
    [165, 0.12],
    [110, 0.2],
  ],
  bell: [
    [660, 0.15],
    [880, 0.15],
    [1320, 0.3],
  ],
}

let context: AudioContext | undefined

export function playSound(name: SoundName): void {
  try {
    context ??= new AudioContext()
    let start = context.currentTime
    for (const [frequency, seconds] of TUNES[name]) {
      const oscillator = context.createOscillator()
      const gain = context.createGain()
      oscillator.type = 'triangle'
      oscillator.frequency.value = frequency
      gain.gain.setValueAtTime(0.12, start)
      gain.gain.exponentialRampToValueAtTime(0.001, start + seconds)
      oscillator.connect(gain).connect(context.destination)
      oscillator.start(start)
      oscillator.stop(start + seconds)
      start += seconds
    }
  } catch {
    // No audio device or the browser blocked it: stay silent.
  }
}
