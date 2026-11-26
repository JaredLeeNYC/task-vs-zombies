import { useState } from 'react'
import { isDay, type Day } from '../core/dates'
import type { Action } from '../core/game'
import { parseQuickAdd } from '../core/parse'
import type { Draft, Importance, Settings } from '../core/types'
import { addTaskAction } from './actions'
import { formatMinutes, formatWeekdays, ZOMBIE_NAMES } from './format'

const EFFORT_CHOICES = [15, 25, 30, 45, 60, 90, 120, 180, 240, 480]
const IMPORTANCES: Importance[] = [1, 2, 3]

type FormValues = Omit<Draft, 'title' | 'weekdays'>

const DEFAULTS: FormValues = { importance: 2, effortMin: 30, due: null, lane: 0 }

interface AddBarProps {
  settings: Settings
  today: Day
  dispatch: (action: Action) => void
}

/**
 * One line adds a zombie. Markers typed into the line win over the controls
 * next to it, which show what the line resolved to.
 */
export function AddBar({ settings, today, dispatch }: AddBarProps) {
  const [text, setText] = useState('')
  const [form, setForm] = useState<FormValues>(DEFAULTS)

  const typed = parseQuickAdd(text, today, settings)
  const draft: Draft = { ...form, weekdays: null, ...typed }
  const efforts = EFFORT_CHOICES.includes(draft.effortMin) ? EFFORT_CHOICES : [...EFFORT_CHOICES, draft.effortMin].sort((a, b) => a - b)

  function add() {
    dispatch(addTaskAction(draft))
    setText('')
    setForm({ ...DEFAULTS, lane: form.lane })
  }

  return (
    <form
      className="addbar"
      onSubmit={(event) => {
        event.preventDefault()
        if (draft.title !== '') add()
      }}
    >
      <div className="addbar-input">
        <input
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="新僵尸：写周报 !3 45m 周五 #会议   （回车放进草坪）"
          aria-label="新任务"
        />
        <p className="addbar-hint">
          可在标题旁用空格隔开写标记：<b>!1 !2 !3</b> 重要度 · <b>45m / 1.5h</b> 耗时 · <b>今天 / 周五 / 下周一 / 12-01</b> 截止 ·{' '}
          <b>#车道名</b> · <b>每天 / 每个工作日 / 每周一三五</b> 立一块墓碑定期复活
        </p>
      </div>

      <select
        value={draft.importance}
        disabled={typed.importance !== undefined}
        onChange={(event) => setForm({ ...form, importance: Number(event.target.value) as Importance })}
        aria-label="重要度"
      >
        {IMPORTANCES.map((importance) => (
          <option key={importance} value={importance}>
            {ZOMBIE_NAMES[importance]}
          </option>
        ))}
      </select>

      <select
        value={draft.effortMin}
        disabled={typed.effortMin !== undefined}
        onChange={(event) => setForm({ ...form, effortMin: Number(event.target.value) })}
        aria-label="预计耗时"
      >
        {efforts.map((minutes) => (
          <option key={minutes} value={minutes}>
            {formatMinutes(minutes)}
          </option>
        ))}
      </select>

      {draft.weekdays ? (
        <span className="addbar-grave">墓碑：{formatWeekdays(draft.weekdays)}</span>
      ) : (
        <input
          type="date"
          value={draft.due ?? ''}
          disabled={typed.due !== undefined}
          onChange={(event) => setForm({ ...form, due: isDay(event.target.value) ? event.target.value : null })}
          aria-label="截止日期"
        />
      )}

      <select
        value={draft.lane}
        disabled={typed.lane !== undefined}
        onChange={(event) => setForm({ ...form, lane: Number(event.target.value) })}
        aria-label="车道"
      >
        {settings.lanes.map((lane, index) => (
          <option key={index} value={index}>
            {lane}
          </option>
        ))}
      </select>

      <button className="btn btn-fire" type="submit" disabled={draft.title === ''}>
        放进草坪
      </button>
    </form>
  )
}
