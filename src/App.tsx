import { useEffect, useMemo, useReducer, useState } from 'react'
import { dayOf } from './core/dates'
import { reduce, type Action } from './core/game'
import { assessHouse, dayProgress, HOUSE_HP } from './core/house'
import { activityOn, assess, buildPlan, streak } from './core/plan'
import { loadState, saveState } from './core/storage'
import { AddBar } from './ui/AddBar'
import { Briefing } from './ui/Briefing'
import { formatClock, formatLongDay } from './ui/format'
import { Lawn } from './ui/Lawn'
import { PlanPanel } from './ui/PlanPanel'
import { SettingsDialog } from './ui/SettingsDialog'
import { playSound, type SoundName } from './ui/sound'
import { Heart, SpriteDefs, Sun } from './ui/sprites'
import { TaskDialog } from './ui/TaskDialog'

const APP_TITLE = '任务大战僵尸'
const TOAST_MS = 5000
const SOUNDS: Partial<Record<Action['type'], SoundName>> = { addTask: 'plant', startFocus: 'fire', killTask: 'kill' }

/** The current time, refreshed on an interval and whenever the tab becomes visible again. */
function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const tick = () => setNow(Date.now())
    const timer = setInterval(tick, intervalMs)
    document.addEventListener('visibilitychange', tick)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [intervalMs])
  return now
}

export default function App() {
  const [state, rawDispatch] = useReducer(reduce, undefined, loadState)
  const { tasks, graves, settings, focus, briefing } = state
  const now = useNow(focus ? 1000 : 20_000)
  const today = dayOf(new Date(now))

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [hotId, setHotId] = useState<string | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  function dispatch(action: Action) {
    const sound = SOUNDS[action.type]
    if (sound && settings.sound) playSound(sound)
    rawDispatch(action)
  }

  useEffect(() => saveState(state), [state])
  useEffect(() => rawDispatch({ type: 'startDay', now: Date.now() }), [today])

  const focusTask = focus ? tasks.find((task) => task.id === focus.taskId) : undefined
  const focusTitle = focusTask?.title
  const focusLeftMs = focus ? Math.min(focus.durationMin * 60_000, focus.startedAt + focus.durationMin * 60_000 - now) : 0

  // The session ends itself, also when the page was reloaded or asleep past its end.
  useEffect(() => {
    if (!focus) return
    const timer = setTimeout(
      () => {
        rawDispatch({ type: 'stopFocus', now: Date.now() })
        if (settings.sound) playSound('bell')
        setToast(`${focus.durationMin} 分钟火力打完：${focusTitle ?? ''}。休息一下，再看计划里的下一只。`)
      },
      Math.max(0, focus.startedAt + focus.durationMin * 60_000 - Date.now()),
    )
    return () => clearTimeout(timer)
  }, [focus, focusTitle, settings.sound])

  useEffect(() => {
    document.title = focus ? `${formatClock(focusLeftMs)} ${focusTitle ?? ''}` : APP_TITLE
  }, [focus, focusLeftMs, focusTitle])

  useEffect(() => {
    if (toast === null) return
    const timer = setTimeout(() => setToast(null), TOAST_MS)
    return () => clearTimeout(timer)
  }, [toast])

  const plan = useMemo(() => buildPlan(tasks, settings, today), [tasks, settings, today])
  const selected = tasks.find((task) => task.id === selectedId)
  const kills = activityOn(tasks, today).kills
  const streakDays = streak(tasks, today, settings.workdays)
  const sunLeftMin = Math.max(0, plan.sunTotalMin - plan.sunUsedMin)
  const house = useMemo(() => assessHouse(tasks, today, settings.workdays), [tasks, today, settings.workdays])

  return (
    <div className="app">
      <SpriteDefs />
      <header className="topbar">
        <h1>{APP_TITLE}</h1>
        <span className="topbar-day">{formatLongDay(today)}</span>
        <div className="counter" title="今天还剩的阳光（专注分钟数）">
          <Sun />
          <b>{sunLeftMin}</b>
          <span>/ {plan.sunTotalMin} 分钟阳光</span>
        </div>
        <div
          className={house.hp <= 30 ? 'counter is-low' : 'counter'}
          title={`本周被啃 ${house.bites.length} 口。逾期的僵尸每个工作日啃一口，周一修好。`}
        >
          <Heart />
          <b>{house.hp}</b>
          <span>/ {HOUSE_HP} 房子生命</span>
        </div>
        <span className="stat">
          今日击杀 <b>{kills}</b>
        </span>
        <span className="stat">
          连续出勤 <b>{streakDays}</b> 天
        </span>
        <span className="spacer" />
        <button className="btn btn-wood" onClick={() => setSettingsOpen(true)}>
          设置
        </button>
      </header>

      <AddBar settings={settings} today={today} dispatch={dispatch} />

      <main className="main">
        <div className="field-wrap">
          {house.hp === 0 && (
            <div className="alert" role="alert">
              <strong>房子失守：</strong>这周的生命值被啃光了。先打掉门口的逾期僵尸，或者给它们改一个做得到的截止日期；周一房子会修好。
            </div>
          )}
          <Lawn
            plan={plan}
            settings={settings}
            graves={graves}
            focus={focus}
            today={today}
            dayProgress={dayProgress(now, settings)}
            hotId={hotId}
            onHot={setHotId}
            onSelect={setSelectedId}
          />
          {focus && focusTask && (
            <div className="focusbar" role="timer" aria-label="专注计时">
              <span className="focusbar-clock">{formatClock(focusLeftMs)}</span>
              <span className="focusbar-title">正在攻击：{focusTask.title}</span>
              <span className="meter">
                <i style={{ width: `${100 - (focusLeftMs / (focus.durationMin * 60_000)) * 100}%` }} />
              </span>
              <button className="btn" onClick={() => dispatch({ type: 'stopFocus', now: Date.now() })}>
                停火
              </button>
              <button className="btn btn-kill" onClick={() => dispatch({ type: 'killTask', now: Date.now(), id: focusTask.id })}>
                击杀
              </button>
            </div>
          )}
          {toast !== null && (
            <div className="toast" role="status">
              {toast}
            </div>
          )}
        </div>

        <PlanPanel
          plan={plan}
          settings={settings}
          focus={focus}
          today={today}
          hotId={hotId}
          onHot={setHotId}
          onSelect={setSelectedId}
          dispatch={dispatch}
        />
      </main>

      {briefing && (
        <Briefing briefing={briefing} tasks={tasks} plan={plan} house={house} settings={settings} today={today} dispatch={dispatch} />
      )}
      {selected && (
        <TaskDialog
          key={selected.id}
          threat={assess(selected, today, settings)}
          settings={settings}
          focus={focus}
          today={today}
          dispatch={dispatch}
          onClose={() => setSelectedId(null)}
        />
      )}
      {settingsOpen && (
        <SettingsDialog settings={settings} graves={graves} dispatch={dispatch} onClose={() => setSettingsOpen(false)} />
      )}
    </div>
  )
}
