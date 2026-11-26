import { useEffect, useRef } from 'react'
import type { Day } from '../core/dates'
import { BITE_DAMAGE } from '../core/house'
import { spentMin, type Plan, type Threat } from '../core/plan'
import { LANE_COUNT, type Focus, type Grave, type Settings } from '../core/types'
import { deadlineLabel, formatMinutes, formatWeekdays, ZOMBIE_NAMES } from './format'
import { COLUMNS, mountLawn, type LawnSpec, type LawnView, type Mood } from './scene/LawnScene'

const COLUMN_LABELS = ['今天', '1 天后', '2 天后', '3 天后', '4 天后', '5 天后', '6 天后', '7 天后', '8 天以上']
/** Zombies sharing a column queue up this many deep before a second queue starts beside them. */
const QUEUE_DEPTH = 4
/** The column of zombies that outlived their deadline and are biting the house. */
const DOOR = -1

interface Walker {
  threat: Threat
  /** Position in today's attack order, or null when it is not planned today. */
  order: number | null
  frozen: boolean
}

function clampLane(lane: number): number {
  return Math.min(LANE_COUNT - 1, Math.max(0, lane))
}

/** How close the zombie is to the house: the working days left before work on it must start. */
function columnOf({ left, slack }: Threat): number {
  if (left !== null && left < 0) return DOOR
  return Math.min(COLUMNS - 1, Math.max(0, slack))
}

/**
 * Where the zombie stands inside its column: 1 is its right side, 0 its left. It crosses the
 * column while the working day passes, so overnight it only has to step into the next one.
 */
function strideOf({ slack }: Threat, dayProgress: number): number {
  if (slack < 0) return 0
  // The last column collects everything further out, so nothing in it is on the move yet.
  if (slack >= COLUMNS - 1) return 0.5
  return 1 - dayProgress
}

/** The zombie's distance from the door in columns. A biting one stands on the doorstep. */
function alongOf(column: number, stride: number, stackIndex: number): number {
  const queue = 0.12 * (stackIndex % QUEUE_DEPTH) + 0.4 * Math.floor(stackIndex / QUEUE_DEPTH)
  return (column === DOOR ? -0.4 : column + 0.25 + 0.5 * stride) + queue
}

function sizeOf(effortMin: number): number {
  return effortMin <= 30 ? 0.84 : effortMin > 120 ? 1.2 : 1
}

interface LawnProps {
  plan: Plan
  settings: Settings
  graves: Grave[]
  focus: Focus | null
  today: Day
  /** How much of the working day has passed, from 0 to 1. */
  dayProgress: number
  hotId: string | null
  onHot: (id: string | null) => void
  onSelect: (id: string) => void
}

export function Lawn({ plan, settings, graves, focus, today, dayProgress, hotId, onHot, onSelect }: LawnProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<LawnView | null>(null)
  // The elements the scene keeps on top of its models, by the key of what each belongs to.
  const anchorsRef = useRef(new Map<string, HTMLElement>())
  const anchor = (key: string) => (element: HTMLElement | null) => {
    if (element) anchorsRef.current.set(key, element)
    else anchorsRef.current.delete(key)
  }

  const walkers: Walker[] = [
    ...plan.entries.filter((entry) => !entry.done).map((threat, index) => ({ threat, order: index + 1, frozen: false })),
    ...plan.later.map((threat) => ({ threat, order: null, frozen: false })),
    ...plan.frozen.map((threat) => ({ threat, order: null, frozen: true })),
  ]

  const lanes = settings.lanes.map((name, lane) => {
    const queues = new Map<number, number>()
    const zombies = walkers
      .filter((walker) => clampLane(walker.threat.task.lane) === lane)
      .sort((a, b) => b.threat.score - a.threat.score)
      .map((walker) => {
        const column = columnOf(walker.threat)
        const stackIndex = queues.get(column) ?? 0
        queues.set(column, stackIndex + 1)
        const along = alongOf(column, strideOf(walker.threat, dayProgress), stackIndex)
        return { ...walker, column, stackIndex, along, id: walker.threat.task.id }
      })
    return {
      name,
      zombies,
      armed: zombies.some((zombie) => zombie.order !== null),
      biters: zombies.filter((zombie) => zombie.column === DOOR).length,
      target: zombies.find((zombie) => zombie.id === focus?.taskId),
      graves: graves.filter((grave) => clampLane(grave.lane) === lane),
    }
  })

  const spec: LawnSpec = {
    zombies: lanes.flatMap((lane, laneIndex) =>
      lane.zombies.map((zombie) => {
        const mood: Mood = zombie.frozen ? 'frozen' : zombie.column === DOOR ? 'biting' : zombie.threat.mustToday ? 'urgent' : 'calm'
        return {
          id: zombie.id,
          lane: laneIndex,
          along: zombie.along,
          row: zombie.stackIndex % QUEUE_DEPTH,
          importance: zombie.threat.task.importance,
          size: sizeOf(zombie.threat.task.effortMin),
          mood,
          hot: hotId === zombie.id,
          targeted: lane.target === zombie,
        }
      }),
    ),
    lanes: lanes.map((lane) => ({ armed: lane.armed, bitten: lane.biters > 0, firingAt: lane.target?.along ?? null })),
    graves: lanes.flatMap((lane, laneIndex) => lane.graves.map((grave, slot) => ({ id: grave.id, lane: laneIndex, slot }))),
  }

  useEffect(() => {
    const view = mountLawn(hostRef.current!, anchorsRef.current)
    viewRef.current = view
    return () => {
      viewRef.current = null
      view.dispose()
    }
  }, [])
  useEffect(() => viewRef.current?.update(spec))

  return (
    <section className="lawn" aria-label="草坪">
      <div className="lawn-canvas" ref={hostRef} />
      <div className="lawn-overlay">
        <span className="column-label is-house" ref={anchor('column:door')}>
          最晚开工 ▸
        </span>
        {COLUMN_LABELS.map((label, column) => (
          <span key={label} className={column === 0 ? 'column-label is-today' : 'column-label'} ref={anchor(`column:${column}`)}>
            {label}
          </span>
        ))}

        {lanes.map((lane, laneIndex) => (
          <div key={laneIndex} className={lane.biters > 0 ? 'lane-sign is-bitten' : 'lane-sign'} ref={anchor(`lane:${laneIndex}`)}>
            <span className="lane-name">{lane.name}</span>
            <span className="lane-count">
              {lane.biters > 0 ? `${lane.biters} 只在啃` : lane.zombies.length > 0 ? `${lane.zombies.length} 只` : '清净'}
            </span>
          </div>
        ))}

        {graves.map((grave) => (
          <span
            key={grave.id}
            className="grave-tip"
            ref={anchor(`grave:${grave.id}`)}
            title={`墓碑：${grave.title}（${formatWeekdays(grave.weekdays)}复活）`}
          />
        ))}

        {lanes.flatMap((lane, laneIndex) =>
          lane.zombies.map((zombie) => {
            const { threat, order, frozen, stackIndex, id } = zombie
            const { task } = threat
            const isTarget = lane.target === zombie
            const isHot = hotId === id
            const biting = zombie.column === DOOR
            const health = Math.min(1, Math.max(0.06, (task.effortMin - spentMin(task)) / task.effortMin))
            const classes = ['zombie', isTarget && 'is-target', isHot && 'is-hot']
            return (
              <button
                key={id}
                ref={anchor(`zombie:${id}`)}
                className={classes.filter(Boolean).join(' ')}
                // Nearer lanes and the front of each queue go on top.
                style={{ zIndex: laneIndex * 100 + (isHot || isTarget ? 60 : 30 - stackIndex) }}
                onClick={() => onSelect(id)}
                onMouseEnter={() => onHot(id)}
                onMouseLeave={() => onHot(null)}
                onFocus={() => onHot(id)}
                onBlur={() => onHot(null)}
                aria-label={`${task.title}，${ZOMBIE_NAMES[task.importance]}，${deadlineLabel(threat, today)}，剩余 ${formatMinutes(threat.remainingMin)}`}
              >
                <span className="zombie-health">
                  <i style={{ width: `${health * 100}%` }} />
                </span>
                {biting && <span className="zombie-bite">−{BITE_DAMAGE[task.importance]}</span>}
                {order !== null && <span className="zombie-order">{order}</span>}
                {frozen && <span className="zombie-order is-frozen">冻</span>}
                {(stackIndex === 0 || isHot || isTarget) && <span className="zombie-label">{task.title}</span>}
              </button>
            )
          }),
        )}
      </div>
    </section>
  )
}
