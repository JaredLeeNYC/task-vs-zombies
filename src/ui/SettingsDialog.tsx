import { useState } from 'react'
import { dayOf } from '../core/dates'
import type { Action } from '../core/game'
import { parseState } from '../core/storage'
import { isSyncCode, newSyncCode } from '../core/sync'
import type { GameState } from '../core/types'
import { formatMinutes, formatWeekdays, WEEKDAY_NAMES, ZOMBIE_NAMES } from './format'
import { Modal } from './Modal'
import type { SyncStatus, useCloudSync } from './useCloudSync'

/** Monday first. */
const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0]

interface SettingsDialogProps {
  state: GameState
  cloud: ReturnType<typeof useCloudSync>
  dispatch: (action: Action) => void
  onClose: () => void
}

function describeSync(status: SyncStatus): string {
  switch (status.kind) {
    case 'off':
      return '未开启'
    case 'syncing':
      return '同步中…'
    case 'synced':
      return `已同步（${new Date(status.at).toLocaleTimeString()}）`
    case 'error':
      return `同步失败：${status.message}`
  }
}

function exportSave(state: GameState) {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = `任务大战僵尸-${dayOf(new Date())}.json`
  link.click()
  URL.revokeObjectURL(link.href)
}

function SaveSection({ state, cloud, dispatch }: Omit<SettingsDialogProps, 'onClose'>) {
  const [typedCode, setTypedCode] = useState('')
  const [message, setMessage] = useState<string | null>(null)

  async function importSave(file: File) {
    try {
      const imported = parseState(JSON.parse(await file.text()))
      if (imported === null) return setMessage('这个文件不是任务大战僵尸的存档。')
      if (!confirm(`用 ${file.name} 覆盖现在的全部任务和设置？`)) return
      dispatch({ type: 'loadState', state: imported })
      dispatch({ type: 'startDay', now: Date.now() })
      setMessage(`已导入 ${imported.tasks.length} 个任务。`)
    } catch {
      setMessage('读不了这个文件，它不是有效的 JSON。')
    }
  }

  return (
    <div className="field field-wide">
      <span>存档</span>
      {cloud.enabled &&
        (cloud.code === null ? (
          <div className="sync">
            <p className="muted">开启云同步后，在别的设备输入同一个同步码就能看到同一份任务。同步码就是钥匙，别发给别人。</p>
            <div className="sync-row">
              <button className="btn btn-fire" onClick={() => cloud.setCode(newSyncCode(), true)}>
                开启云同步
              </button>
              <input
                value={typedCode}
                placeholder="或输入已有的同步码"
                aria-label="已有的同步码"
                onChange={(event) => setTypedCode(event.target.value.trim())}
              />
              <button
                className="btn"
                disabled={!isSyncCode(typedCode)}
                onClick={() => {
                  if (confirm('用云端的存档替换这台设备上的任务？')) cloud.setCode(typedCode)
                }}
              >
                连接
              </button>
            </div>
          </div>
        ) : (
          <div className="sync">
            <p className={cloud.status.kind === 'error' ? 'sync-error' : 'muted'}>云同步：{describeSync(cloud.status)}</p>
            <div className="sync-row">
              <input readOnly value={cloud.code} aria-label="同步码" onFocus={(event) => event.target.select()} />
              <button
                className="btn"
                onClick={() => void navigator.clipboard.writeText(cloud.code ?? '').then(() => setMessage('同步码已复制。'))}
              >
                复制
              </button>
              <button className="btn" onClick={() => void cloud.syncNow()}>
                立即同步
              </button>
              <button
                className="btn btn-ghost"
                onClick={() => {
                  if (confirm('在这台设备上关闭云同步？任务会留在本机，云端存档也不会删除。')) cloud.setCode(null)
                }}
              >
                关闭
              </button>
            </div>
          </div>
        ))}
      <div className="sync-row">
        <button className="btn" onClick={() => exportSave(state)}>
          导出备份
        </button>
        <label className="btn">
          导入备份
          <input
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0]
              event.target.value = ''
              if (file) void importSave(file)
            }}
          />
        </label>
      </div>
      {message !== null && <p className="muted">{message}</p>}
    </div>
  )
}

export function SettingsDialog({ state, cloud, dispatch, onClose }: SettingsDialogProps) {
  const { settings, graves } = state
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

        <SaveSection state={state} cloud={cloud} dispatch={dispatch} />
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
