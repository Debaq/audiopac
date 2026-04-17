import type { TestConfig, Ear, Phase } from '@/types'
import { playSequence } from './engine'

export interface RunnerItem {
  index: number
  phase: Phase
  pattern: string
  presentedAt?: number
  answeredAt?: number
  given?: string
  correct?: boolean
}

export interface RunnerState {
  phase: Phase
  items: RunnerItem[]
  currentIndex: number
  isPlaying: boolean
  finished: boolean
}

export class TestRunner {
  private config: TestConfig
  private ear: Ear
  state: RunnerState
  private listeners = new Set<(s: RunnerState) => void>()

  constructor(config: TestConfig, ear: Ear = 'binaural', startPhase: Phase = 'practice') {
    this.config = config
    this.ear = ear
    const practice = config.practice_sequences.map<RunnerItem>((p, i) => ({ index: i, phase: 'practice', pattern: p }))
    const test = config.test_sequences.map<RunnerItem>((p, i) => ({ index: i, phase: 'test', pattern: p }))
    const items = startPhase === 'practice' ? practice.concat(test) : test
    this.state = { phase: startPhase, items, currentIndex: 0, isPlaying: false, finished: false }
  }

  subscribe(fn: (s: RunnerState) => void) {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  private emit() {
    for (const l of this.listeners) l({ ...this.state })
  }

  get currentItem(): RunnerItem | null {
    return this.state.items[this.state.currentIndex] ?? null
  }

  async play() {
    const item = this.currentItem
    if (!item || this.state.isPlaying) return
    this.state.isPlaying = true
    this.emit()
    item.presentedAt = Date.now()
    await playSequence(item.pattern, this.config, { ear: this.ear })
    this.state.isPlaying = false
    this.emit()
  }

  answer(given: string) {
    const item = this.currentItem
    if (!item) return
    item.given = given
    item.answeredAt = Date.now()
    item.correct = given.toUpperCase() === item.pattern.toUpperCase()
    this.emit()
  }

  next() {
    if (this.state.currentIndex < this.state.items.length - 1) {
      this.state.currentIndex++
      const curr = this.state.items[this.state.currentIndex]
      this.state.phase = curr.phase
      this.emit()
    } else {
      this.state.finished = true
      this.emit()
    }
  }

  goto(index: number) {
    if (index < 0 || index >= this.state.items.length) return
    this.state.currentIndex = index
    this.state.phase = this.state.items[index].phase
    this.state.finished = false
    this.emit()
  }

  skipPracticeToTest() {
    const firstTest = this.state.items.findIndex(i => i.phase === 'test')
    if (firstTest >= 0) this.goto(firstTest)
  }

  getScores() {
    const practice = this.state.items.filter(i => i.phase === 'practice' && i.correct !== undefined)
    const test = this.state.items.filter(i => i.phase === 'test' && i.correct !== undefined)
    const score = (arr: RunnerItem[]) => arr.length ? arr.filter(i => i.correct).length / arr.length : 0
    return {
      practice: { total: practice.length, correct: practice.filter(i => i.correct).length, score: score(practice) },
      test: { total: test.length, correct: test.filter(i => i.correct).length, score: score(test) },
    }
  }
}
