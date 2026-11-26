import { describe, expect, it } from 'vitest'
import { assess, buildPlan, streak } from './plan'
import { makeTestTask as task } from './testing'
import { DEFAULT_SETTINGS } from './types'

// A Monday; the default settings give 300 minutes of sun on Monday to Friday.
const TODAY = '2026-11-23'
const settings = DEFAULT_SETTINGS

function ids(items: { task: { id: string } }[]): string[] {
  return items.map((item) => item.task.id)
}

describe('buildPlan', () => {
  it('puts a minor task due today ahead of an important one due later', () => {
    const plan = buildPlan(
      [task({ id: 'important-wednesday', importance: 3, due: '2026-11-25' }), task({ id: 'minor-today', importance: 1, due: TODAY })],
      settings,
      TODAY,
    )
    expect(ids(plan.entries)).toEqual(['minor-today', 'important-wednesday'])
  })

  it('fills the sun in threat order, shrinks the last slot, and defers the rest', () => {
    const plan = buildPlan(
      [
        task({ id: 'someday', importance: 1, effortMin: 120 }),
        task({ id: 'tomorrow', importance: 3, effortMin: 60, due: '2026-11-24' }),
        task({ id: 'big-today', importance: 2, effortMin: 200, due: TODAY }),
        task({ id: 'key-today', importance: 3, effortMin: 80, due: TODAY }),
      ],
      settings,
      TODAY,
    )
    expect(plan.entries.map((entry) => [entry.task.id, entry.plannedMin])).toEqual([
      ['key-today', 80],
      ['big-today', 200],
      ['tomorrow', 20],
    ])
    expect(ids(plan.later)).toEqual(['someday'])
    expect(plan.sunPlannedMin).toBe(300)
    expect(plan.breached).toEqual([])
  })

  it('makes a job bigger than one day start before its deadline and splits it evenly', () => {
    const dueTomorrow = assess(task({ id: 'a', effortMin: 500, due: '2026-11-24' }), TODAY, settings)
    expect(dueTomorrow).toMatchObject({ slack: 0, mustToday: true, shareMin: 250 })

    const dueWednesday = assess(task({ id: 'b', effortMin: 500, due: '2026-11-25' }), TODAY, settings)
    expect(dueWednesday).toMatchObject({ slack: 1, mustToday: false, shareMin: 170 })
  })

  it('charges a kill its planned share, or the timed minutes when the timer ran', () => {
    const plan = buildPlan(
      [
        task({ id: 'untimed', effortMin: 60, due: TODAY, doneOn: TODAY }),
        task({ id: 'timed', effortMin: 60, due: TODAY, doneOn: TODAY, focus: { [TODAY]: 20 } }),
      ],
      settings,
      TODAY,
    )
    expect(plan.sunUsedMin).toBe(80)
  })

  it('plans what was left this morning, and a short overtime slot once the estimate is used up', () => {
    const share = (effortMin: number, focus: Record<string, number>) =>
      assess(task({ id: 'a', effortMin, due: TODAY, focus }), TODAY, settings).shareMin
    expect(share(100, { '2026-11-20': 70, [TODAY]: 10 })).toBe(30)
    expect(share(10, {})).toBe(10)
    expect(share(60, { '2026-11-20': 80 })).toBe(15)
  })

  it('plans a pinned task without sun for it and reports must-do work that lost out', () => {
    const plan = buildPlan(
      [
        task({ id: 'due-today', effortMin: 60, due: TODAY }),
        task({ id: 'pinned', effortMin: 30, pinnedOn: TODAY }),
        task({ id: 'frozen', effortMin: 15, due: TODAY, skippedOn: TODAY }),
        task({ id: 'pinned-last-week', effortMin: 30, pinnedOn: '2026-11-16' }),
      ],
      { ...settings, focusMin: 60 },
      TODAY,
    )
    expect(plan.entries.map((entry) => [entry.task.id, entry.plannedMin])).toEqual([
      ['due-today', 30],
      ['pinned', 30],
    ])
    expect(ids(plan.frozen)).toEqual(['frozen'])
    expect(ids(plan.later)).toEqual(['pinned-last-week'])
    expect(ids(plan.breached)).toEqual(['due-today', 'frozen'])
  })
})

describe('streak', () => {
  const thursday = task({ id: 'thu', doneOn: '2026-11-19' })
  const friday = task({ id: 'fri', focus: { '2026-11-20': 25 } })

  it('bridges the weekend and a today that has not started', () => {
    expect(streak([thursday, friday], TODAY, settings.workdays)).toBe(2)
    expect(streak([thursday, friday, task({ id: 'mon', doneOn: TODAY })], TODAY, settings.workdays)).toBe(3)
  })

  it('breaks on a missed working day', () => {
    expect(streak([thursday], TODAY, settings.workdays)).toBe(0)
    expect(streak([task({ id: 'tue', doneOn: '2026-11-17' }), thursday, friday], TODAY, settings.workdays)).toBe(2)
  })
})
