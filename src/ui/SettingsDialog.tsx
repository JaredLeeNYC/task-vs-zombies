import { useState } from 'react'
import type { Action } from '../core/game'
import type { Grave, Settings } from '../core/types'
import { formatMinutes, formatWeekdays, WEEKDAY_NAMES, ZOMBIE_NAMES } from './format'
import { Modal } from './Modal'

/** Monday first. */
const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0]

interface SettingsDialogProps {
  settings: Settings
  graves: Grave[]
  dispatch: (action: Action) => void
  onClose: () => void
}

export function SettingsDialog({ settings, graves, dispatch, onClose }: SettingsDialogProps) {
  // Edited as text and saved in one go, so half-typed numbers are never clamped.
  const [focusMin, setFocusMin] = useState(String(settings.focusMin))
  const [pomodoroMin, setPomodoroMin] = useState(String(settings.pomodoroMin))
  const [dayStartHour, setDayStartHour] = useState(String(settings.dayStartHour))
  const [dayEndHour, setDayEndHour] = useState(String(settings.dayEndHour))
  const [lanes, setLanes] = useState(settings.lanes)
  const [workdays, setWorkdays] = useState(settings.workdays)
  const [sound, setSound] = useState(settings.sound)

  function save() {
    dispatch({
      type: 'updateSettings',
      patch: {
        focusMin: Number(focusMin),
        pomodoroMin: Number(pomodoroMin),
        dayStartHour: Number(dayStartHour),
        dayEndHour: Number(dayEndHour),
        lanes,
        workdays,
        sound,
      },
    })
    onClose()
  }

  return (
    <Modal title="设置" onClose={onClose}>
      <div className="fields">
        <label className="field">
          <span>每天的阳光（可专注分钟数）</span>
          <input type="number" min={30} max={900} step={15} value={focusMin} onChange={(event) => setFocusMin(event.target.value)} />
        </label>
        <label className="field">
          <span>一次开火（专注）分钟数</span>
          <input
            type="number"
            min={5}
            max={120}
            step={5}
            value={pomodoroMin}
            onChange={(event) => setPomodoroMin(event.target.value)}
          />
        </label>

        <div className="field field-wide">
          <span>工作时间（僵尸在这段时间里走向房子）</span>
          <div className="hours">
            <input
              type="number"
              min={0}
              max={23}
              value={dayStartHour}
              aria-label="上班时间（点）"
              onChange={(event) => setDayStartHour(event.target.value)}
            />
            <span>点 到</span>
            <input
              type="number"
              min={1}
              max={24}
              value={dayEndHour}
              aria-label="下班时间（点）"
              onChange={(event) => setDayEndHour(event.target.value)}
            />
            <span>点</span>
          </div>
        </div>

        <div className="field field-wide">
          <span>工作日</span>
          <div className="segmented">
            {WEEKDAY_ORDER.map((day) => {
              const on = workdays.includes(day)
              return (
                <button
                  key={day}
                  className={on ? 'is-on' : ''}
                  aria-pressed={on}
                  onClick={() => setWorkdays(on ? workdays.filter((other) => other !== day) : [...workdays, day])}
                >
                  {WEEKDAY_NAMES[day]}
                </button>
              )
            })}
          </div>
        </div>

        <div className="field field-wide">
          <span>五条车道（工作分类）</span>
          <div className="lane-inputs">
            {lanes.map((lane, index) => (
              <input
                key={index}
                value={lane}
                maxLength={8}
                aria-label={`车道 ${index + 1}`}
                onChange={(event) => setLanes(lanes.map((other, at) => (at === index ? event.target.value : other)))}
              />
            ))}
          </div>
        </div>

        <label className="field field-wide field-check">
          <input type="checkbox" checked={sound} onChange={(event) => setSound(event.target.checked)} />
          <span>音效</span>
        </label>

        <div className="field field-wide">
          <span>墓碑（循环任务）</span>
          {graves.length === 0 ? (
            <p className="muted">还没有。新建任务时写上“每天”“每个工作日”或“每周一三五”就会立一块。</p>
          ) : (
            <ul className="grave-list">
              {graves.map((grave) => (
                <li key={grave.id}>
                  <span>
                    {grave.title}
                    <small>
                      {formatWeekdays(grave.weekdays)} · {ZOMBIE_NAMES[grave.importance]} · {formatMinutes(grave.effortMin)} ·{' '}
                      {settings.lanes[grave.lane]}
                    </small>
                  </span>
                  <button className="btn btn-ghost" onClick={() => dispatch({ type: 'deleteGrave', id: grave.id })}>
                    拆掉
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <footer className="modal-actions">
        <span className="spacer" />
        <button className="btn btn-ghost" onClick={onClose}>
          取消
        </button>
        <button className="btn btn-fire" onClick={save}>
          保存
        </button>
      </footer>
    </Modal>
  )
}
