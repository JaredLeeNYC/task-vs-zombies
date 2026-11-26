import { describe, expect, it } from 'vitest'
import { parseQuickAdd } from './parse'
import { DEFAULT_SETTINGS } from './types'

const MONDAY = '2026-11-23'
const THURSDAY = '2026-11-26'

function parse(input: string, today = MONDAY) {
  return parseQuickAdd(input, today, DEFAULT_SETTINGS)
}

describe('parseQuickAdd', () => {
  it('reads importance, effort, deadline, and lane markers around the title', () => {
    expect(parse('写周报 !3 45m 周五 #会议')).toEqual({
      title: '写周报',
      importance: 3,
      effortMin: 45,
      due: '2026-11-27',
      lane: 1,
    })
    expect(parse('!! 修复 登录 bug 1.5h #5 明天')).toEqual({
      title: '修复 登录 bug',
      importance: 2,
      effortMin: 90,
      due: '2026-11-24',
      lane: 4,
    })
  })

  it('leaves marker-like text inside a title alone', () => {
    expect(parse('准备周五的演示')).toEqual({ title: '准备周五的演示' })
    expect(parse('升级到 3.5 #不存在的车道')).toEqual({ title: '升级到 3.5 #不存在的车道' })
  })

  it('resolves weekdays to the next occurrence, counting today', () => {
    expect(parse('a 周四', THURSDAY).due).toBe('2026-11-26')
    expect(parse('a 周三', THURSDAY).due).toBe('2026-12-02')
    expect(parse('a 下周一', THURSDAY).due).toBe('2026-11-30')
    expect(parse('a 下周日', MONDAY).due).toBe('2026-12-06')
  })

  it('reads dates, rolling a passed one into next year and rejecting impossible ones', () => {
    expect(parse('a 12-01').due).toBe('2026-12-01')
    expect(parse('a 1/5').due).toBe('2027-01-05')
    expect(parse('a 2027-03-08').due).toBe('2027-03-08')
    expect(parse('a 2-30')).toEqual({ title: 'a 2-30' })
  })

  it('reads recurrence', () => {
    expect(parse('站会 每个工作日 15m')).toEqual({ title: '站会', weekdays: [1, 2, 3, 4, 5], effortMin: 15 })
    expect(parse('周会 每周五一').weekdays).toEqual([1, 5])
  })
})
