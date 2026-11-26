import {
  Color,
  DirectionalLight,
  Group,
  HemisphereLight,
  Mesh,
  PerspectiveCamera,
  Scene,
  Vector3,
  WebGLRenderer,
  type MeshLambertMaterial,
} from 'three'
import { LANE_COUNT, type Importance } from '../../core/types'
import {
  buildGravestone,
  buildPeashooter,
  buildScenery,
  buildZombie,
  DOORSTEP,
  Kit,
  STONE,
  type Peashooter,
  type Triple,
  type ZombieRig,
} from './models'

/** The lawn is this many columns wide, one unit each; the house door is at x = 0. */
export const COLUMNS = 9
const LANE_DEPTH = 1.85
const DEPTH = LANE_COUNT * LANE_DEPTH

export type Mood = 'calm' | 'urgent' | 'biting' | 'frozen'

export interface ZombieSpec {
  id: string
  lane: number
  /** Distance from the door in columns; negative is on the doorstep. */
  along: number
  /** How far back in its lane it queues, counted in zombies. */
  row: number
  importance: Importance
  /** 1 is an ordinary zombie. */
  size: number
  mood: Mood
  hot: boolean
  targeted: boolean
}

export interface LaneSpec {
  /** Whether the lane's peashooter is out. */
  armed: boolean
  bitten: boolean
  /** Where the peashooter is firing, as an `along`; null while it holds fire. */
  firingAt: number | null
}

export interface GraveSpec {
  id: string
  lane: number
  /** Its place among the lane's gravestones, counted from the lawn's far end. */
  slot: number
}

export interface LawnSpec {
  zombies: ZombieSpec[]
  lanes: LaneSpec[]
  graves: GraveSpec[]
}

export interface LawnView {
  update(spec: LawnSpec): void
  dispose(): void
}

/**
 * Draws the lawn into `host` and keeps it animated. Every frame it also moves the elements in
 * `anchors` onto what their key names: `zombie:<id>` and `grave:<id>` are boxed around the model,
 * `lane:<index>` is pinned to the lane's doorstep, `column:<index>` and `column:door` to the front edge.
 */
export function mountLawn(host: HTMLElement, anchors: ReadonlyMap<string, HTMLElement>): LawnView {
  try {
    return new LawnScene(host, anchors)
  } catch {
    // No WebGL: the host shows a notice instead, and the anchored elements stay hidden.
    host.dataset.webgl = 'off'
    return { update() {}, dispose: () => delete host.dataset.webgl }
  }
}

/** A long lens: a wide one makes everything near the picture's sides lean outwards. */
const FIELD_OF_VIEW = 14
/** From the middle of the lawn towards the camera: straight in front of it, 40 degrees up. */
const VIEW = new Vector3(0, 0.643, 0.766).normalize()
/** What the picture must contain: the bushes behind the fence, the heads in the back lane, and the column marks in front. */
const FRAME: Triple[] = [
  [-DOORSTEP - 0.2, 1, -1.6],
  [COLUMNS + 0.35, 1, -1.6],
  [-DOORSTEP - 0.2, 1.9, 1.45],
  [COLUMNS + 0.35, 1.9, 1.45],
  [-DOORSTEP - 0.2, -0.25, DEPTH + 0.8],
  [COLUMNS + 0.35, -0.25, DEPTH + 0.8],
]
const PLANT_X = -1
const PEA_HEIGHT = 0.66
const BLOOD = new Color('#d9412e')
const GLOW = { targeted: '#ffd23f', hot: '#fff36b', biting: '#ff2a12', urgent: '#ff6a3d', frozen: '#8fd0ff' }

function laneZ(lane: number): number {
  return lane * LANE_DEPTH
}

interface Actor {
  rig: ZombieRig
  spec: ZombieSpec
  /** What it was built as; a change rebuilds the model. */
  look: string
  /** Keeps the zombies from walking in step. */
  phase: number
}

class LawnScene implements LawnView {
  private host: HTMLElement
  private anchors: ReadonlyMap<string, HTMLElement>
  private renderer: WebGLRenderer
  private scene = new Scene()
  private camera = new PerspectiveCamera(FIELD_OF_VIEW, 1, 1, 400)
  private kit = new Kit()
  private actors = new Map<string, Actor>()
  /** Killed zombies, until they have finished falling over. */
  private fallen: { rig: ZombieRig; size: number; age: number }[] = []
  private graves = new Map<string, Group>()
  private plants: Peashooter[] = []
  private peas: Mesh[][] = []
  private steps: MeshLambertMaterial[]
  private lanes: LaneSpec[] = []
  private width = 1
  private height = 1
  /** False until the first update, whose zombies appear in place instead of walking in. */
  private populated = false
  private still = matchMedia('(prefers-reduced-motion: reduce)').matches
  private placed = new WeakMap<HTMLElement, string>()
  private observer: ResizeObserver
  private frameId = 0
  private lastFrame = performance.now()
  private scratch = [new Vector3(), new Vector3()]

  constructor(host: HTMLElement, anchors: ReadonlyMap<string, HTMLElement>) {
    this.host = host
    this.anchors = anchors
    this.renderer = new WebGLRenderer({ antialias: true })
    this.renderer.shadowMap.enabled = true
    this.scene.background = new Color('#4f8f30')

    const sun = new DirectionalLight('#fff3d6', 2.5)
    sun.position.set(COLUMNS / 2 + 5, 11, DEPTH / 2 + 6)
    sun.target.position.set(COLUMNS / 2 - 1, 0, DEPTH / 2)
    sun.castShadow = true
    sun.shadow.mapSize.set(2048, 2048)
    sun.shadow.bias = -0.0005
    sun.shadow.normalBias = 0.02
    Object.assign(sun.shadow.camera, { left: -10, right: 10, top: 9, bottom: -9, near: 1, far: 40 })
    this.scene.add(new HemisphereLight('#e6f6ff', '#6c9440', 1.9), sun, sun.target)

    const scenery = buildScenery(this.kit, LANE_COUNT, COLUMNS, LANE_DEPTH)
    this.steps = scenery.steps
    this.scene.add(scenery.group)
    const peaPaint = this.kit.paint('#a5e85c')
    for (let lane = 0; lane < LANE_COUNT; lane++) {
      const plant = buildPeashooter(this.kit)
      plant.root.position.set(PLANT_X, 0, laneZ(lane) + 1.35)
      plant.root.visible = false
      const peas = [0, 1, 2].map(() => this.kit.part(this.kit.ball, peaPaint, [0.13, 0.13, 0.13], [0, PEA_HEIGHT, 0]))
      for (const pea of peas) pea.visible = false
      this.plants.push(plant)
      this.peas.push(peas)
      this.scene.add(plant.root, ...peas)
    }

    host.append(this.renderer.domElement)
    this.observer = new ResizeObserver(() => this.resize())
    this.observer.observe(host)
    this.resize()
    this.frameId = requestAnimationFrame(this.tick)
  }

  update(spec: LawnSpec): void {
    this.lanes = spec.lanes

    const alive = new Set<string>()
    for (const zombie of spec.zombies) {
      alive.add(zombie.id)
      const look = `${zombie.importance}/${zombie.mood === 'frozen'}`
      const old = this.actors.get(zombie.id)
      if (old?.look === look) {
        old.spec = zombie
        continue
      }
      const rig = buildZombie(this.kit, zombie.importance, zombie.mood === 'frozen')
      if (old) {
        rig.root.position.copy(old.rig.root.position)
        this.discard(old.rig)
      } else {
        rig.root.position.copy(this.spotOf(zombie))
        // A zombie added later walks in from the far end of its lane.
        if (this.populated && !this.still) rig.root.position.x = COLUMNS + 1
      }
      rig.root.scale.setScalar(zombie.size)
      this.scene.add(rig.root)
      this.actors.set(zombie.id, { rig, spec: zombie, look, phase: old?.phase ?? Math.random() * Math.PI * 2 })
    }
    for (const [id, actor] of this.actors) {
      if (alive.has(id)) continue
      this.actors.delete(id)
      actor.rig.ring.visible = false
      this.fallen.push({ rig: actor.rig, size: actor.rig.root.scale.x, age: 0 })
    }
    this.populated = true

    const standing = new Set<string>()
    for (const grave of spec.graves) {
      standing.add(grave.id)
      let stone = this.graves.get(grave.id)
      if (!stone) {
        stone = buildGravestone(this.kit)
        this.graves.set(grave.id, stone)
        this.scene.add(stone)
      }
      stone.position.set(COLUMNS - 0.3 - 0.44 * grave.slot, 0, laneZ(grave.lane) + 0.5)
    }
    for (const [id, stone] of this.graves) {
      if (standing.has(id)) continue
      this.graves.delete(id)
      this.scene.remove(stone)
    }
  }

  dispose(): void {
    cancelAnimationFrame(this.frameId)
    this.observer.disconnect()
    this.scene.traverse((object) => {
      if (!(object instanceof Mesh)) return
      object.geometry.dispose()
      for (const material of [object.material].flat()) material.dispose()
    })
    this.renderer.dispose()
    this.renderer.forceContextLoss()
    this.renderer.domElement.remove()
  }

  private discard(rig: ZombieRig): void {
    this.scene.remove(rig.root)
    rig.glow.dispose()
  }

  /** Where a zombie is heading: zombies sharing a column queue up behind each other, deeper into the lane. */
  private spotOf(spec: ZombieSpec): Vector3 {
    return this.scratch[0].set(spec.along, 0, laneZ(spec.lane) + 1.45 - 0.36 * spec.row)
  }

  private tick = (now: number): void => {
    this.frameId = requestAnimationFrame(this.tick)
    const elapsed = Math.min(0.1, (now - this.lastFrame) / 1000)
    this.lastFrame = now
    this.animate(elapsed, this.still ? 0 : now / 1000)
    this.renderer.render(this.scene, this.camera)
    this.placeAnchors()
  }

  private animate(elapsed: number, time: number): void {
    const ease = this.still ? 1 : 1 - Math.exp(-elapsed * 3.5)

    for (const { rig, spec, phase } of this.actors.values()) {
      const { root, body, head, legs, arms, ring, glow } = rig
      const spot = this.spotOf(spec)
      // Hurries while it has ground to make up.
      const behind = Math.min(1, root.position.distanceTo(spot))
      root.position.lerp(spot, ease)
      const size = spec.size * (spec.hot ? 1.12 : 1)
      root.scale.setScalar(root.scale.x + (size - root.scale.x) * ease)

      const frozen = spec.mood === 'frozen'
      const biting = spec.mood === 'biting'
      const pace = frozen || this.still ? 0 : (spec.mood === 'urgent' ? 6 : 3) + 7 * behind
      const sway = pace === 0 ? 0 : Math.sin(time * pace + phase)
      const step = biting ? 0 : sway
      const chomp = biting && !this.still ? Math.max(0, Math.sin(time * 9 + phase)) : 0
      legs[0].rotation.x = step * 0.5
      legs[1].rotation.x = -step * 0.5
      arms[0].rotation.x = 0.12 + step * 0.1
      arms[1].rotation.x = 0.12 - step * 0.1
      body.rotation.set(biting ? 0.15 + chomp * 0.3 : 0, 0, step * 0.05)
      body.position.set(spec.targeted && !this.still ? Math.sin(time * 48) * 0.02 : 0, Math.abs(step) * 0.03, 0)
      head.rotation.set(chomp * 0.25, 0, sway * 0.08)

      const state = spec.targeted ? 'targeted' : spec.hot ? 'hot' : spec.mood
      ring.visible = state !== 'calm'
      if (state !== 'calm') {
        glow.color.set(GLOW[state])
        glow.opacity = 0.5 + 0.2 * Math.sin(time * 5 + phase)
      }
    }

    this.fallen = this.fallen.filter((corpse) => {
      corpse.age += elapsed
      const fall = this.still ? 1 : Math.min(1, corpse.age / 0.7)
      corpse.rig.body.rotation.x = -fall * 1.45
      corpse.rig.root.scale.setScalar(corpse.size * (1 - Math.max(0, (fall - 0.6) / 0.4)))
      if (fall < 1) return true
      this.discard(corpse.rig)
      return false
    })

    this.plants.forEach((plant, lane) => {
      const state = this.lanes[lane]
      const firingAt = state?.firingAt ?? null
      plant.root.visible = state?.armed ?? false
      plant.root.rotation.z = Math.sin(time * 1.6 + lane) * 0.04
      plant.head.scale.setScalar(firingAt === null ? 1 : 1 + 0.07 * Math.sin(time * 14))
      this.peas[lane].forEach((pea, index) => {
        pea.visible = firingAt !== null
        if (firingAt === null) return
        const flight = this.still ? (index + 1) / 4 : (time / 0.9 + index / 3) % 1
        const muzzle = PLANT_X + 0.45
        pea.position.set(muzzle + (firingAt - 0.2 - muzzle) * flight, PEA_HEIGHT, laneZ(lane) + 1.4)
      })
      const alarm = state?.bitten ? 0.35 + (this.still ? 0 : 0.25 * Math.sin(time * 6)) : 0
      this.steps[lane].color.copy(STONE).lerp(BLOOD, alarm)
    })
  }

  private resize(): void {
    this.width = Math.max(1, this.host.clientWidth)
    this.height = Math.max(1, this.host.clientHeight)
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
    this.renderer.setSize(this.width, this.height, false)
    this.camera.aspect = this.width / this.height
    this.camera.updateProjectionMatrix()
    this.aim()
  }

  /** Backs the camera off just far enough to see all of `FRAME`, centred, whatever shape the picture has. */
  private aim(): void {
    const { camera } = this
    const center = new Vector3(COLUMNS / 2 - 1, 0, DEPTH / 2)
    const reach = Math.tan((FIELD_OF_VIEW * Math.PI) / 360)
    for (let pass = 0; ; pass++) {
      let near = 3
      let far = 300
      for (let step = 0; step < 24; step++) {
        const distance = (near + far) / 2
        if (this.spread(center, distance).fits) far = distance
        else near = distance
      }
      const { midX, midY } = this.spread(center, far)
      if (pass === 5) return
      const right = this.scratch[0].setFromMatrixColumn(camera.matrixWorld, 0)
      const up = this.scratch[1].setFromMatrixColumn(camera.matrixWorld, 1)
      center.addScaledVector(right, midX * reach * camera.aspect * far).addScaledVector(up, midY * reach * far)
    }
  }

  /** Puts the camera `distance` away from `center` and reports where `FRAME` lands in the picture, from -1 to 1. */
  private spread(center: Vector3, distance: number): { fits: boolean; midX: number; midY: number } {
    const { camera } = this
    camera.position.copy(center).addScaledVector(VIEW, distance)
    camera.lookAt(center)
    camera.updateMatrixWorld()
    let [minX, maxX, minY, maxY] = [Infinity, -Infinity, Infinity, -Infinity]
    for (const corner of FRAME) {
      const point = this.scratch[0].set(...corner).project(camera)
      minX = Math.min(minX, point.x)
      maxX = Math.max(maxX, point.x)
      minY = Math.min(minY, point.y)
      maxY = Math.max(maxY, point.y)
    }
    return { fits: maxX - minX <= 1.96 && maxY - minY <= 1.96, midX: (minX + maxX) / 2, midY: (minY + maxY) / 2 }
  }

  private placeAnchors(): void {
    for (const [key, element] of this.anchors) {
      const cut = key.indexOf(':')
      const kind = key.slice(0, cut)
      const id = key.slice(cut + 1)
      if (kind === 'zombie') {
        const actor = this.actors.get(id)
        if (actor) this.box(element, actor.rig.root.position, actor.rig.height * actor.rig.root.scale.y)
      } else if (kind === 'grave') {
        const stone = this.graves.get(id)
        if (stone) this.box(element, stone.position, 0.6)
      } else if (kind === 'lane') {
        this.pin(element, -DOORSTEP + 0.5, 0.3, laneZ(Number(id)) + 0.8)
      } else if (kind === 'column') {
        this.pin(element, id === 'door' ? -DOORSTEP / 2 : Number(id) + 0.5, -0.25, DEPTH + 0.38)
      }
    }
  }

  /** Stretches `element` over something `height` tall standing at `base`. */
  private box(element: HTMLElement, base: Vector3, height: number): void {
    const foot = this.toScreen(this.scratch[0].copy(base))
    const top = this.toScreen(this.scratch[1].copy(base).setY(base.y + height))
    const tall = foot.y - top.y
    const wide = tall * 0.5
    this.move(element, `translate(${Math.round(foot.x - wide / 2)}px, ${Math.round(top.y)}px)`, Math.round(wide), Math.round(tall))
  }

  /** Centres `element` on a point. */
  private pin(element: HTMLElement, x: number, y: number, z: number): void {
    const point = this.toScreen(this.scratch[0].set(x, y, z))
    this.move(element, `translate(${Math.round(point.x)}px, ${Math.round(point.y)}px) translate(-50%, -50%)`)
  }

  private move(element: HTMLElement, transform: string, width?: number, height?: number): void {
    const placement = `${transform}/${width}/${height}`
    if (this.placed.get(element) === placement) return
    this.placed.set(element, placement)
    element.style.transform = transform
    if (width !== undefined) element.style.width = `${width}px`
    if (height !== undefined) element.style.height = `${height}px`
    element.style.visibility = 'visible'
  }

  private toScreen(point: Vector3): Vector3 {
    point.project(this.camera)
    point.x = (point.x * 0.5 + 0.5) * this.width
    point.y = (0.5 - point.y * 0.5) * this.height
    return point
  }
}
