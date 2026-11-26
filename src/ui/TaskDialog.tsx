import { useState } from 'react'
import { isDay, type Day } from '../core/dates'
import type { Action } from '../core/game'
import { spentMin, type Threat } from '../core/plan'
import type { Focus, Importance, Settings } from '../core/types'
import { deadlineLabel, deadlineTone, formatMinutes, IMPORTANCE_NAMES, ZOMBIE_NAMES } from './format'
import { Modal } from './Modal'
import { Zombie } from './sprites'

const IMPORTANCES: Importance[] = [1, 2, 3]
const EFFORT_CHIPS = [15, 25, 45, 60, 90, 120, 240]

interface TaskDialogProps {
  threat: Threat
  settings: Settings
  focus: Focus | null
  today: Day
  dispatch: (action: Action) => void
  onClose: () => void
}

export function TaskDialog({ threat, settings, focus, today, dispatch, onClose }: TaskDialogProps) {
  const { task } = threat
  // Text fields are edited locally and saved on blur, so half-typed values are never clamped.
  const [title, setTitle] = useState(task.title)
  const [effort, setEffort] = useState(String(task.effortMin))

  const done = task.doneOn !== null
  const isTarget = focus?.taskId === task.id
  const spent = spentMin(task)

  function act(action: Action) {
    dispatch(action)
    onClose()
  }

  return (
    <Modal title={ZOMBIE_NAMES[task.importance]} onClose={onClose}>
      <div className="task-dialog">
        <div className="task-portrait">
          <Zombie importance={task.importance} />
        </div>

        <div className="fields">
          <label className="field field-wide">
            <span>任务</span>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              onBlur={() => dispatch({ type: 'editTask', id: task.id, patch: { title } })}
            />
          </label>

          <div className="field field-wide">
            <span>重要度</span>
            <div className="segmented">
              {IMPORTANCES.map((importance) => (
                <button
                  key={importance}
                  className={task.importance === importance ? 'is-on' : ''}
                  aria-pressed={task.importance === importance}
                  onClick={() => dispatch({ type: 'editTask', id: task.id, patch: { importance } })}
                >
                  {IMPORTANCE_NAMES[importance]} · {ZOMBIE_NAMES[importance]}
                </button>
              ))}
            </div>
          </div>

          <label className="field">
            <span>预计耗时（分钟）</span>
            <input
              type="number"
              min={5}
              step={5}
              value={effort}
              onChange={(event) => setEffort(event.target.value)}
              onBlur={() => dispatch({ type: 'editTask', id: task.id, patch: { effortMin: Number(effort) } })}
            />
          </label>

          <label className="field">
            <span>截止日期</span>
            <input
              type="date"
              value={task.due ?? ''}
              onChange={(event) =>
                dispatch({ type: 'editTask', id: task.id, patch: { due: isDay(event.target.value) ? event.target.value : null } })
              }
            />
          </label>

          <div className="field field-wide">
            <div className="chips">
              {EFFORT_CHIPS.map((minutes) => (
                <button
                  key={minutes}
                  className={task.effortMin === minutes ? 'chip is-on' : 'chip'}
                  onClick={() => {
                    setEffort(String(minutes))
                    dispatch({ type: 'editTask', id: task.id, patch: { effortMin: minutes } })
                  }}
                >
                  {formatMinutes(minutes)}
                </button>
              ))}
            </div>
          </div>

          <label className="field field-wide">
            <span>车道</span>
            <select
              value={task.lane}
              onChange={(event) => dispatch({ type: 'editTask', id: task.id, patch: { lane: Number(event.target.value) } })}
            >
              {settings.lanes.map((lane, index) => (
                <option key={index} value={index}>
                  {lane}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <p className="task-status">
        <span className={`tag tag-${done ? 'calm' : deadlineTone(threat)}`}>{done ? '已击杀' : deadlineLabel(threat, today)}</span>
        已投入 {formatMinutes(spent)}，预计共 {formatMinutes(task.effortMin)}
        {task.graveId !== null && ' · 来自墓碑的循环任务'}
      </p>

      <footer className="modal-actions">
        <button className="btn btn-danger" onClick={() => act({ type: 'deleteTask', id: task.id })}>
          删除
        </button>
        <span className="spacer" />
        {done ? (
          <button className="btn" onClick={() => act({ type: 'reviveTask', id: task.id })}>
            复活（撤销击杀）
          </button>
        ) : (
          <>
            <button className="btn btn-ghost" onClick={() => act({ type: 'skipTask', now: Date.now(), id: task.id })}>
              {task.skippedOn === today ? '恢复，今天可以打' : '今天不打'}
            </button>
            <button className="btn btn-ghost" onClick={() => act({ type: 'pinTask', now: Date.now(), id: task.id })}>
              {task.pinnedOn === today ? '取消指定' : '指定今天打'}
            </button>
            <button className="btn btn-kill" onClick={() => act({ type: 'killTask', now: Date.now(), id: task.id })}>
              击杀
            </button>
            {isTarget ? (
              <button className="btn" onClick={() => act({ type: 'stopFocus', now: Date.now() })}>
                停火
              </button>
            ) : (
              <button
                className="btn btn-fire"
                onClick={() => act({ type: 'startFocus', now: Date.now(), taskId: task.id, durationMin: settings.pomodoroMin })}
              >
                开火 {settings.pomodoroMin} 分钟
              </button>
            )}
          </>
        )}
      </footer>
    </Modal>
  )
}
