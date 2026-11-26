import type { Threat } from '../core/plan'

/** Warns that work which has to be touched today gets less sun than it needs. */
export function BreachAlert({ breached }: { breached: Threat[] }) {
  if (breached.length === 0) return null
  return (
    <div className="alert" role="alert">
      <strong>防线告急：</strong>
      {breached.map((threat) => threat.task.title).join('、')}
      今天必须处理，但没排够时间。把它拉回今天、砍掉别的、改截止日期，或者加班。
    </div>
  )
}
