import type { Day } from '../core/dates'
import type { Action } from '../core/game'
import type { Plan, PlanEntry, Threat } from '../core/plan'
import type { Focus, Settings } from '../core/types'
import { BreachAlert } from './BreachAlert'
import { deadlineLabel, deadlineTone, formatMinutes } from './format'

interface PlanPanelProps {
  plan: Plan
  settings: Settings
  focus: Focus | null
  today: Day
  hotId: string | null
  onHot: (id: string | null) => void
  onSelect: (id: string) => void
  dispatch: (action: Action) => void
}

export function PlanPanel({ plan, settings, focus, today, hotId, onHot, onSelect, dispatch }: PlanPanelProps) {
  const openCount = plan.entries.filter((entry) => !entry.done).length
  const usedPercent = Math.min(100, (plan.sunUsedMin / plan.sunTotalMin) * 100)
  const plannedPercent = Math.min(100, (plan.sunPlannedMin / plan.sunTotalMin) * 100)

  function tags(threat: Threat) {
    return (
      <>
        <span className={`tag tag-${deadlineTone(threat)}`}>{deadlineLabel(threat, today)}</span>
        <span className="tag">{settings.lanes[threat.task.lane] ?? settings.lanes[0]}</span>
      </>
    )
  }

  // Open entries come first, so an open entry's position is its place in the attack order.
  function entryRow(entry: PlanEntry, order: number) {
    const { task } = entry
    const isTarget = focus?.taskId === task.id
    const classes = ['entry', entry.done && 'is-done', entry.cleared && 'is-cleared', isTarget && 'is-target', hotId === task.id && 'is-hot']
    const progress = entry.done ? 100 : Math.min(100, (entry.spentTodayMin / entry.plannedMin) * 100)
    return (
      <li
        key={task.id}
        className={classes.filter(Boolean).join(' ')}
        onMouseEnter={() => onHot(task.id)}
        onMouseLeave={() => onHot(null)}
      >
        <span className="entry-order">{entry.done ? '✓' : order}</span>
        <div className="entry-body">
          <button className="entry-title" onClick={() => onSelect(task.id)} title="查看和修改">
            {task.title}
          </button>
          <div className="entry-meta">
            {tags(entry)}
            <span className="entry-minutes">
              {entry.done ? '已击杀' : `${entry.spentTodayMin} / ${formatMinutes(entry.plannedMin)}`}
            </span>
          </div>
          <div className="meter">
            <i style={{ width: `${progress}%` }} />
          </div>
        </div>
        <div className="entry-actions">
          {entry.done ? (
            <button className="btn btn-ghost" onClick={() => dispatch({ type: 'reviveTask', id: task.id })}>
              撤销
            </button>
          ) : (
            <>
              {isTarget ? (
                <button className="btn" onClick={() => dispatch({ type: 'stopFocus', now: Date.now() })}>
                  停火
                </button>
              ) : (
                <button
                  className="btn btn-fire"
                  title={`专注 ${settings.pomodoroMin} 分钟`}
                  onClick={() => dispatch({ type: 'startFocus', now: Date.now(), taskId: task.id, durationMin: settings.pomodoroMin })}
                >
                  开火
                </button>
              )}
              <button
                className="btn btn-kill"
                title="完成了"
                onClick={() => dispatch({ type: 'killTask', now: Date.now(), id: task.id })}
              >
                击杀
              </button>
              <button
                className="btn btn-ghost"
                title="今天不打，明天再排"
                onClick={() => dispatch({ type: 'skipTask', now: Date.now(), id: task.id })}
              >
                推迟
              </button>
            </>
          )}
        </div>
      </li>
    )
  }

  function benchRow(threat: Threat, frozen: boolean) {
    const { task } = threat
    return (
      <li
        key={task.id}
        className={hotId === task.id ? 'bench-row is-hot' : 'bench-row'}
        onMouseEnter={() => onHot(task.id)}
        onMouseLeave={() => onHot(null)}
      >
        <div className="entry-body">
          <button className="entry-title" onClick={() => onSelect(task.id)} title="查看和修改">
            {task.title}
          </button>
          <div className="entry-meta">
            {frozen && <span className="tag tag-frozen">今天不打</span>}
            {tags(threat)}
            <span className="tag">剩 {formatMinutes(threat.remainingMin)}</span>
          </div>
        </div>
        <button
          className="btn btn-ghost"
          onClick={() => dispatch({ type: frozen ? 'skipTask' : 'pinTask', now: Date.now(), id: task.id })}
        >
          {frozen ? '恢复' : '今天打'}
        </button>
      </li>
    )
  }

  return (
    <aside className="panel" aria-label="今日作战计划">
      <header className="panel-head">
        <h2>今日作战计划</h2>
        <p>
          {openCount > 0 ? `还剩 ${openCount} 只，从上往下打` : plan.entries.length > 0 ? '今天的僵尸清空了' : '草坪上没有僵尸'}
        </p>
        <div className="sunbar" title="深色：已用掉的阳光；浅色：已排进计划的阳光">
          <i className="sunbar-planned" style={{ width: `${plannedPercent}%` }} />
          <i className="sunbar-used" style={{ width: `${usedPercent}%` }} />
        </div>
        <p className="sunbar-caption">
          已用 {plan.sunUsedMin} · 已排 {plan.sunPlannedMin} · 今日阳光 {plan.sunTotalMin} 分钟
        </p>
      </header>

      <BreachAlert breached={plan.breached} />

      <ol className="entries">{plan.entries.map((entry, index) => entryRow(entry, index + 1))}</ol>

      {plan.later.length + plan.frozen.length > 0 && (
        <details className="bench">
          <summary>没排进今天的僵尸（{plan.later.length + plan.frozen.length}）</summary>
          <ul>
            {plan.frozen.map((threat) => benchRow(threat, true))}
            {plan.later.map((threat) => benchRow(threat, false))}
          </ul>
        </details>
      )}
    </aside>
  )
}
