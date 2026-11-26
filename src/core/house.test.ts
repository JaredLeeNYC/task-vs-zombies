import { describe, expect, it } from 'vitest'
import { assessHouse, dayProgress } from './house'
import { makeTestTask as task } from './testing'
import { DEFAULT_SETTINGS, type Task } from './types'

function hp(tasks: Task[], today: string): number {
  return assessHouse(tasks, today, DEFAULT_SETTINGS.workdays).hp
}

describe('assessHouse', () => {
  it('leaves the house alone until a deadline has passed', () => {
    expect(hp([task({ id: 'due-today', due: '2026-11-25' }), task({ id: 'no-deadline' })], '2026-11-25')).toBe(100)
  })

  it('takes one bite per working day past the deadline, harder for important work', () => {
    // Both due on Monday 2026-11-23.
    const minor = task({ id: 'minor', importance: 1, due: '2026-11-23' })
    const key = task({ id: 'key', importance: 3, due: '2026-11-23' })
    expect(hp([minor], '2026-11-24')).toBe(95)
    expect(hp([key], '2026-11-24')).toBe(85)
    expect(hp([minor, key], '2026-11-26')).toBe(40)
  })

  it('stops biting once the zombie is killed, and never bites one killed on time', () => {
    const late = task({ id: 'late', due: '2026-11-23', doneOn: '2026-11-25' })
    const onTime = task({ id: 'on-time', due: '2026-11-23', doneOn: '2026-11-23' })
    const { bites } = assessHouse([late, onTime], '2026-11-27', DEFAULT_SETTINGS.workdays)
    expect(bites.map((bite) => [bite.task.id, bite.day])).toEqual([
      ['late', '2026-11-24'],
      ['late', '2026-11-25'],
    ])
  })

  it('skips days off and repairs the house on Monday', () => {
    // Due on Wednesday 2026-11-18 and still alive.
    const stale = task({ id: 'stale', importance: 2, due: '2026-11-18', createdOn: '2026-11-16' })
    expect(hp([stale], '2026-11-22')).toBe(80)
    expect(hp([stale], '2026-11-23')).toBe(90)
    expect(hp([stale], '2026-11-24')).toBe(80)
  })

  it('never drops below zero', () => {
    const horde = Array.from({ length: 8 }, (_, index) => task({ id: `z${index}`, importance: 3, due: '2026-11-23' }))
    expect(hp(horde, '2026-11-24')).toBe(0)
  })
})

describe('dayProgress', () => {
  // The default working day runs from 9:00 to 18:00; 2026-11-23 is a Monday.
  const at = (day: number, hour: number, minute = 0) => new Date(2026, 10, day, hour, minute).getTime()

  it('runs from 0 to 1 over the working hours', () => {
    expect(dayProgress(at(23, 8), DEFAULT_SETTINGS)).toBe(0)
    expect(dayProgress(at(23, 13, 30), DEFAULT_SETTINGS)).toBe(0.5)
    expect(dayProgress(at(23, 20), DEFAULT_SETTINGS)).toBe(1)
  })

  it('counts a day off as over', () => {
    expect(dayProgress(at(28, 12), DEFAULT_SETTINGS)).toBe(1)
  })
})
