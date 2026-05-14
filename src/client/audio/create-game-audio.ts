import { loadAudioPreferences, saveAudioPreferences, type AudioPreferences } from "./audio-preferences"

type AudioConstructorWindow = Window & typeof globalThis & {
  webkitAudioContext?: typeof AudioContext
}

type Tone = {
  type: OscillatorType
  fromFrequency: number
  toFrequency: number
  gain: number
  durationSeconds: number
}

type AudioNodes = {
  context: AudioContext
  masterGain: GainNode
}

export type GameAudio = {
  getPreferences: () => AudioPreferences
  playAsteroidDestroyed: () => void
  playFire: () => void
  playPlayerExplosion: () => void
  setMuted: (isMuted: boolean) => void
  setThrusting: (isThrusting: boolean) => void
  setVolume: (volume: number) => void
  unlock: () => void
  destroy: () => void
}

const rampGain = (gain: AudioParam, value: number, time: number) => {
  gain.cancelScheduledValues(time)
  gain.setTargetAtTime(value, time, 0.025)
}

const playTone = (nodes: AudioNodes, tone: Tone) => {
  const now = nodes.context.currentTime
  const oscillator = nodes.context.createOscillator()
  const gain = nodes.context.createGain()
  const stopAt = now + tone.durationSeconds

  oscillator.type = tone.type
  oscillator.frequency.setValueAtTime(tone.fromFrequency, now)
  oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, tone.toFrequency), stopAt)
  gain.gain.setValueAtTime(0.0001, now)
  gain.gain.exponentialRampToValueAtTime(tone.gain, now + 0.012)
  gain.gain.exponentialRampToValueAtTime(0.0001, stopAt)
  oscillator.connect(gain)
  gain.connect(nodes.masterGain)
  oscillator.start(now)
  oscillator.stop(stopAt + 0.02)
}

export const createGameAudio = (): GameAudio => {
  let preferences = loadAudioPreferences()
  let nodes: AudioNodes | undefined
  let thrustOscillator: OscillatorNode | undefined
  let thrustGain: GainNode | undefined
  let isUnlocked = false

  const ensureNodes = () => {
    if (nodes) {
      return nodes
    }

    const audioWindow = window as AudioConstructorWindow
    const AudioContextConstructor = audioWindow.AudioContext ?? audioWindow.webkitAudioContext

    if (!AudioContextConstructor) {
      return undefined
    }

    const context = new AudioContextConstructor()
    const masterGain = context.createGain()

    masterGain.gain.value = preferences.isMuted ? 0 : preferences.volume
    masterGain.connect(context.destination)
    nodes = {
      context,
      masterGain
    }

    return nodes
  }

  const resume = (context: AudioContext) => {
    if (context.state === "suspended") {
      void context.resume()
    }
  }

  const syncMasterGain = () => {
    if (!nodes) {
      return
    }

    rampGain(nodes.masterGain.gain, preferences.isMuted ? 0 : preferences.volume, nodes.context.currentTime)
  }

  const save = () => {
    saveAudioPreferences(preferences)
    syncMasterGain()
  }

  const unlock = () => {
    if (isUnlocked) {
      return
    }

    const nextNodes = ensureNodes()

    if (!nextNodes) {
      return
    }

    isUnlocked = true
    resume(nextNodes.context)
  }

  const ensureThrust = (nextNodes: AudioNodes) => {
    if (thrustOscillator && thrustGain) {
      return
    }

    thrustOscillator = nextNodes.context.createOscillator()
    thrustGain = nextNodes.context.createGain()
    thrustOscillator.type = "sawtooth"
    thrustOscillator.frequency.value = 58
    thrustGain.gain.value = 0.0001
    thrustOscillator.connect(thrustGain)
    thrustGain.connect(nextNodes.masterGain)
    thrustOscillator.start()
  }

  const play = (tone: Tone) => {
    if (preferences.isMuted) {
      return
    }

    const nextNodes = ensureNodes()

    if (!nextNodes) {
      return
    }

    resume(nextNodes.context)
    playTone(nextNodes, tone)
  }

  const onUnlock = () => unlock()

  window.addEventListener("keydown", onUnlock, { once: true })
  window.addEventListener("pointerdown", onUnlock, { once: true })

  return {
    getPreferences: () => preferences,
    playAsteroidDestroyed: () => {
      play({
        type: "sawtooth",
        fromFrequency: 96,
        toFrequency: 34,
        gain: 0.2,
        durationSeconds: 0.22
      })
      play({
        type: "triangle",
        fromFrequency: 390,
        toFrequency: 82,
        gain: 0.08,
        durationSeconds: 0.18
      })
    },
    playFire: () => {
      play({
        type: "square",
        fromFrequency: 620,
        toFrequency: 180,
        gain: 0.12,
        durationSeconds: 0.1
      })
    },
    playPlayerExplosion: () => {
      play({
        type: "sawtooth",
        fromFrequency: 120,
        toFrequency: 24,
        gain: 0.28,
        durationSeconds: 0.45
      })
      play({
        type: "triangle",
        fromFrequency: 720,
        toFrequency: 48,
        gain: 0.1,
        durationSeconds: 0.34
      })
    },
    setMuted: (isMuted: boolean) => {
      preferences = {
        ...preferences,
        isMuted
      }
      save()
    },
    setThrusting: (isThrusting: boolean) => {
      if (!isThrusting && !nodes) {
        return
      }

      const nextNodes = ensureNodes()

      if (!nextNodes) {
        return
      }

      resume(nextNodes.context)
      ensureThrust(nextNodes)
      rampGain(
        thrustGain?.gain ?? nextNodes.masterGain.gain,
        isThrusting && !preferences.isMuted ? 0.08 : 0.0001,
        nextNodes.context.currentTime
      )
    },
    setVolume: (volume: number) => {
      const nextVolume = Math.min(1, Math.max(0, volume))

      preferences = {
        ...preferences,
        isMuted: nextVolume <= 0,
        volume: nextVolume
      }
      save()
    },
    unlock,
    destroy: () => {
      window.removeEventListener("keydown", onUnlock)
      window.removeEventListener("pointerdown", onUnlock)
      if (thrustGain && nodes) {
        rampGain(thrustGain.gain, 0.0001, nodes.context.currentTime)
      }

      thrustOscillator?.stop()
      thrustOscillator = undefined
      thrustGain = undefined
      void nodes?.context.close()
      nodes = undefined
    }
  }
}
