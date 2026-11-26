import { describe, expect, it } from 'vitest'
import { workdaysLeft } from './dates'

const WEEKDAYS = [1, 2, 3, 4, 5]

describe('workdaysLeft', () => {
  it('skips the weekend between a Friday and the following Monday', () => {
    expect(workdaysLeft('2026-11-27', '2026-11-30', WEEKDAYS)).toBe(1)
    expect(workdaysLeft('2026-11-23', '2026-11-27', WEEKDAYS)).toBe(4)
  })

  it('treats a weekend deadline as the Friday before it', () => {
    expect(workdaysLeft('2026-11-27', '2026-11-28', WEEKDAYS)).toBe(0)
    expect(workdaysLeft('2026-11-26', '2026-11-29', WEEKDAYS)).toBe(1)
  })

  it('counts overdue time in working days', () => {
    expect(workdaysLeft('2026-11-23', '2026-11-20', WEEKDAYS)).toBe(-1)
    expect(workdaysLeft('2026-11-23', '2026-11-22', WEEKDAYS)).toBe(-1)
    expect(workdaysLeft('2026-11-25', '2026-11-20', WEEKDAYS)).toBe(-3)
  })
})
