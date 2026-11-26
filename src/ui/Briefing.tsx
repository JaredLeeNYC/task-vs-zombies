import { addDays, type Day } from '../core/dates'
import type { Action } from '../core/game'
import { HOUSE_HP, type House } from '../core/house'
import { activityOn, type Plan } from '../core/plan'
import type { Briefing as BriefingData, Draft, Settings, Task } from '../core/types'
import { addTaskAction } from './actions'
import { BreachAlert } from './BreachAlert'
import { deadlineLabel, deadlineTone, formatDay, formatLongDay, formatMinutes } from './format'
import { Modal } from './Modal'

/** How many targets the briefing spells out before summarising the rest. */
const LISTED = 6

function sampleDrafts(today: Day): Draft[] {
  const draft = (title: string, importance: Draft['importance'], effortMin: number, dueIn: number | null, lane: number): Draft => ({
    title,
    importance,
    effortMin,
    due: dueIn === null ? null : addDays(today, dueIn),
    lane,
    weekdays: null,
  })
  return [
    draft('修复登录超时 bug', 3, 120, 0, 0),
    draft('季度规划文档', 3, 480, 3, 0),
    draft('准备周会汇报材料', 3, 90, 1, 1),
    { ...draft('站会', 2, 15, null, 1), weekdays: [1, 2, 3, 4, 5] },
    draft('代码评审：支付模块', 2, 45, 0, 2),
    draft('回复客户邮件', 2, 20, 0, 2),
    draft('读《系统设计》第 3 章', 1, 60, null, 3),
    draft('报销上个月差旅', 1, 15, 4, 4),
    draft('整理下载目录', 1, 20, null, 4),
  ]
}

interface BriefingProps {
  briefing: BriefingData
  tasks: Task[]
  plan: Plan
  house: House
  settings: Settings
  today: Day
  dispatch: (action: Action) => void
}

export function Briefing({ briefing, tasks, plan, house, settings, today, dispatch }: BriefingProps) {
  const targets = plan.entries.filter((entry) => !entry.done)
  const first = targets[0]
  const raised = tasks.filter((task) => briefing.raisedIds.includes(task.id))
  const previous = briefing.previousDay === null ? null : activityOn(tasks, briefing.previousDay)
  const bitesToday = house.bites.filter((bite) => bite.day === today)
  const waitingCount = plan.later.filter((threat) => !threat.mustToday).length
  const close = () => dispatch({ type: 'dismissBriefing' })

  return (
    <Modal title={`${formatLongDay(today)} · 今日战报`} onClose={close}>
      <div className="briefing">
        {briefing.previousDay === null ? (
          <ul className="rules">
            <li>
              <b>任务就是僵尸。</b>越重要头盔越硬，耗时越长血越厚；离房子越近，越快到必须动手的那天。
            </li>
            <li>
              <b>专注时间就是阳光。</b>每天 {formatMinutes(settings.focusMin)}，游戏按威胁度把它分给最该打的僵尸，排成今天的作战计划。
            </li>
            <li>
              <b>照着计划从上往下打。</b>“开火”是一个 {settings.pomodoroMin} 分钟的专注计时，“击杀”就是完成。
            </li>
            <li>
              <b>别让僵尸进屋。</b>僵尸在工作时间里一路走向房子，过了截止日期还活着就开始啃：每个工作日一口，房子有 {HOUSE_HP}{' '}
              点生命，每周一修好。
            </li>
          </ul>
        ) : (
          previous && (
            <p>
              上次出勤（{formatDay(briefing.previousDay, today)}）：击杀 <b>{previous.kills}</b> 只，专注{' '}
              <b>{formatMinutes(previous.focusMin)}</b>。
            </p>
          )
        )}

        {bitesToday.length > 0 && (
          <p>
            <b>{bitesToday.length}</b> 只逾期僵尸今天在啃房子（{bitesToday.map((bite) => bite.task.title).join('、')}），扣掉{' '}
            <b>{bitesToday.reduce((sum, bite) => sum + bite.damage, 0)}</b> 点生命，房子还剩 <b>{house.hp}</b> / {HOUSE_HP}。先把它们打掉。
          </p>
        )}

        {raised.length > 0 && (
          <p>
            今天从墓碑里爬出 <b>{raised.length}</b> 只：{raised.map((task) => task.title).join('、')}。
          </p>
        )}

        {targets.length === 0 ? (
          <p>草坪上还没有今天要打的僵尸。在顶部输入框里写下任务，或者先放几只示例僵尸看看玩法。</p>
        ) : (
          <>
            <p>
              今日阳光 <b>{formatMinutes(plan.sunTotalMin)}</b>，已经排好 <b>{targets.length}</b> 只、共{' '}
              <b>{formatMinutes(plan.sunPlannedMin)}</b>，按这个顺序打：
            </p>
            <ol className="briefing-list">
              {targets.slice(0, LISTED).map((entry) => (
                <li key={entry.task.id}>
                  <div className="briefing-row">
                    <span className="briefing-title">{entry.task.title}</span>
                    <span className={`tag tag-${deadlineTone(entry)}`}>{deadlineLabel(entry, today)}</span>
                    <span className="briefing-minutes">{formatMinutes(entry.plannedMin)}</span>
                  </div>
                </li>
              ))}
            </ol>
            <p className="muted">
              {targets.length > LISTED && `另外还有 ${targets.length - LISTED} 只在计划里。`}
              {waitingCount > 0 && `还有 ${waitingCount} 只今天不用管，它们留在草坪远处。`}
            </p>
          </>
        )}

        <BreachAlert breached={plan.breached} />
      </div>

      <footer className="modal-actions">
        {tasks.length === 0 && (
          <button
            className="btn btn-ghost"
            onClick={() => {
              for (const draft of sampleDrafts(today)) dispatch(addTaskAction(draft))
            }}
          >
            放几只示例僵尸
          </button>
        )}
        <span className="spacer" />
        <button className="btn" onClick={close}>
          {first ? '我先看看草坪' : '开始'}
        </button>
        {first && (
          <button
            className="btn btn-fire"
            onClick={() => {
              close()
              dispatch({ type: 'startFocus', now: Date.now(), taskId: first.task.id, durationMin: settings.pomodoroMin })
            }}
          >
            开打第一只：{first.task.title}
          </button>
        )}
      </footer>
    </Modal>
  )
}
