import { describe, expect, it } from 'vitest'
import { initialState, reduce, type Action } from './game'
import type { Draft, GameState } from './types'

function at(day: number, hour: number, minute = 0): number {
  return new Date(2026, 10, day, hour, minute).getTime()
}

function play(actions: Action[], state: GameState = initialState()): GameState {
  return actions.reduce(reduce, state)
}

const draft: Draft = { title: '写方案', importance: 2, effortMin: 60, due: null, lane: 0, weekdays: null }

describe('gravestones', () => {
  // Monday 2026-11-23; the grave is scheduled for Monday and Wednesday.
  const standup: Action = { type: 'addTask', now: at(23, 9), id: 'g', draft: { ...draft, title: '站会', weekdays: [1, 3] } }

  it('raise a zombie due that day on scheduled weekdays only', () => {
    const monday = play([{ type: 'startDay', now: at(23, 9) }, standup])
    expect(monday.tasks).toMatchObject([{ title: '站会', due: '2026-11-23', graveId: 'g' }])

    const killed = reduce(monday, { type: 'killTask', now: at(23, 10), id: monday.tasks[0].id })
    const tuesday = reduce(killed, { type: 'startDay', now: at(24, 9) })
    expect(tuesday.tasks).toHaveLength(1)
    expect(tuesday.briefing).toEqual({ previousDay: '2026-11-23', raisedIds: [] })

    const wednesday = reduce(tuesday, { type: 'startDay', now: at(25, 9) })
    expect(wednesday.tasks).toHaveLength(2)
    expect(wednesday.tasks[1]).toMatchObject({ due: '2026-11-25', doneOn: null })
    expect(wednesday.briefing?.raisedIds).toEqual([wednesday.tasks[1].id])
  })

  it('do not double up while the last zombie is still alive', () => {
    const wednesday = play([{ type: 'startDay', now: at(23, 9) }, standup, { type: 'startDay', now: at(25, 9) }])
    expect(wednesday.tasks).toHaveLength(1)
    expect(wednesday.tasks[0].due).toBe('2026-11-23')
  })
})

describe('focus sessions', () => {
  const started = play([
    { type: 'addTask', now: at(23, 9), id: 't', draft },
    { type: 'startFocus', now: at(23, 23, 50), taskId: 't', durationMin: 25 },
  ])

  it('credit whole elapsed minutes when stopped early', () => {
    const stopped = reduce(started, { type: 'stopFocus', now: at(23, 23, 50) + 10.9 * 60_000 })
    expect(stopped.tasks[0].focus).toEqual({ '2026-11-23': 10 })
    expect(stopped.focus).toBeNull()
  })

  it('credit at most the session length, to the day the session started', () => {
    const stopped = reduce(started, { type: 'stopFocus', now: at(24, 0, 30) })
    expect(stopped.tasks[0].focus).toEqual({ '2026-11-23': 25 })
  })

  it('are settled when their zombie is killed', () => {
    const killed = reduce(started, { type: 'killTask', now: at(23, 23, 57), id: 't' })
    expect(killed.tasks[0]).toMatchObject({ doneOn: '2026-11-23', focus: { '2026-11-23': 7 } })
    expect(killed.focus).toBeNull()
  })
})
