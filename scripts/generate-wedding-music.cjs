// Original instrumental for this invitation. No external recording or samples.
// Run: node scripts/generate-wedding-music.cjs
const fs = require('node:fs')
const path = require('node:path')

const sampleRate = 22050
const beat = 0.75 // 80 BPM
const duration = 48
const samples = new Float64Array(sampleRate * duration)
const frequency = midi => 440 * 2 ** ((midi - 69) / 12)

function piano(midi, start, length, gain) {
  const hz = frequency(midi)
  const offset = Math.floor(start * sampleRate)
  const count = Math.min(Math.floor(length * sampleRate), samples.length - offset)
  for (let i = 0; i < count; i++) {
    const t = i / sampleRate
    const attack = Math.min(1, t / 0.018)
    const release = Math.min(1, (length - t) / 0.3)
    const fundamental = Math.sin(2 * Math.PI * hz * t) * Math.exp(-1.3 * t)
    const overtones = 0.25 * Math.sin(2 * Math.PI * hz * 2 * t) * Math.exp(-2.8 * t)
      + 0.07 * Math.sin(2 * Math.PI * hz * 3 * t) * Math.exp(-4 * t)
    const tone = (fundamental + overtones) * attack * release * gain
    samples[offset + i] += tone
    // Quiet room reflections soften the notes without adding dependencies.
    for (const [delay, amount] of [[0.13, 0.12], [0.27, 0.07], [0.43, 0.04]]) {
      const reflected = offset + i + Math.floor(delay * sampleRate)
      if (reflected < samples.length) samples[reflected] += tone * amount
    }
  }
}

const chords = [[48, 55, 60, 64], [43, 55, 59, 62], [45, 57, 60, 64], [41, 53, 57, 60]]
const melodies = [
  [72, 76, 74, 71], [67, 71, 74, 76], [76, 72, 71, 69], [69, 72, 74, 72],
  [76, 79, 76, 74], [74, 71, 67, 71], [72, 76, 74, 72], [69, 67, 64, 67],
]
for (let bar = 0; bar < 16; bar++) {
  const start = bar * beat * 4
  const chord = chords[bar % chords.length]
  piano(chord[0], start, 3.8, 0.12)
  for (let step = 0; step < 8; step++) {
    piano(chord[[1, 2, 3, 2, 1, 2, 3, 2][step]], start + step * beat / 2, 2.2, 0.08)
  }
  melodies[bar % melodies.length].forEach((note, step) => {
    piano(note, start + step * beat, 2.6, 0.1)
  })
}

const peak = samples.reduce((max, value) => Math.max(max, Math.abs(value)), 0)
const pcm = Buffer.alloc(samples.length * 2)
for (let i = 0; i < samples.length; i++) {
  const t = i / sampleRate
  const fade = Math.min(1, t / 1.5, (duration - t) / 2)
  // Master quietly too, since some mobile browsers use device volume only.
  pcm.writeInt16LE(Math.round(samples[i] / peak * fade * 0.22 * 32767), i * 2)
}
const header = Buffer.alloc(44)
header.write('RIFF', 0)
header.writeUInt32LE(36 + pcm.length, 4)
header.write('WAVEfmt ', 8)
header.writeUInt32LE(16, 16)
header.writeUInt16LE(1, 20)
header.writeUInt16LE(1, 22)
header.writeUInt32LE(sampleRate, 24)
header.writeUInt32LE(sampleRate * 2, 28)
header.writeUInt16LE(2, 32)
header.writeUInt16LE(16, 34)
header.write('data', 36)
header.writeUInt32LE(pcm.length, 40)
const target = path.join(__dirname, '../public/audio/wedding-piano.wav')
fs.mkdirSync(path.dirname(target), { recursive: true })
fs.writeFileSync(target, Buffer.concat([header, pcm]))
console.log(`Created original ${duration}s piano loop (${(pcm.length / 1024 / 1024).toFixed(1)} MB).`)
