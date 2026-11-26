import {
  BoxGeometry,
  CircleGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  ExtrudeGeometry,
  Group,
  InstancedMesh,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  Object3D,
  Shape,
  SphereGeometry,
  type BufferGeometry,
} from 'three'
import type { Importance } from '../../core/types'

export type Triple = [x: number, y: number, z: number]

/** How far the paved doorstep reaches from the house wall to the lawn's first column. */
export const DOORSTEP = 2.2

const FROST = new Color('#cfeaff')
const QUARTER_TURN = Math.PI / 2

/** The shapes and paints every model is assembled from. */
export class Kit {
  readonly box = new BoxGeometry(1, 1, 1)
  readonly ball = new SphereGeometry(0.5, 24, 16)
  readonly tube = new CylinderGeometry(0.5, 0.5, 1, 24)
  readonly cone = new ConeGeometry(0.5, 1, 24)
  /** The white band of a traffic cone, in the proportions of `cone`. */
  readonly band = new CylinderGeometry(0.225, 0.345, 0.24, 24)
  readonly bucket = new CylinderGeometry(0.42, 0.5, 1, 24)
  readonly disc = new CircleGeometry(0.5, 32)
  private paints = new Map<string, MeshLambertMaterial>()

  paint(color: string, frosted = false): MeshLambertMaterial {
    const key = frosted ? `${color}*` : color
    let paint = this.paints.get(key)
    if (!paint) {
      const tone = new Color(color)
      paint = new MeshLambertMaterial({ color: frosted ? tone.lerp(FROST, 0.6) : tone })
      this.paints.set(key, paint)
    }
    return paint
  }

  /** One shaped and painted piece of a model. */
  part(shape: BufferGeometry, paint: MeshLambertMaterial, size: Triple, at: Triple, turn: Triple = [0, 0, 0]): Mesh {
    const mesh = new Mesh(shape, paint)
    mesh.scale.set(...size)
    mesh.position.set(...at)
    mesh.rotation.set(...turn)
    mesh.castShadow = true
    return mesh
  }
}

export interface ZombieRig {
  root: Group
  /** Everything above the ground; it pivots at the feet. */
  body: Group
  /** Pivots at the neck. */
  head: Group
  legs: [Group, Group]
  arms: [Group, Group]
  /** The glowing disc under its feet. */
  ring: Mesh
  glow: MeshBasicMaterial
  /** From the ground to the top of the headgear, before scaling. */
  height: number
}

const ZOMBIE_HEIGHT: Record<Importance, number> = { 1: 1.45, 2: 1.84, 3: 1.66 }
/** Zombies walk towards the house on the left, turned a little towards the camera. */
const ZOMBIE_FACING = -QUARTER_TURN + 0.5

/** Built facing +Z, then turned. Importance picks the headgear: bare, traffic cone, or bucket. */
export function buildZombie(kit: Kit, importance: Importance, frozen: boolean): ZombieRig {
  const paint = (color: string) => kit.paint(color, frozen)
  const skin = paint('#b7c9ae')
  const coat = paint('#7b5b3c')
  const white = paint('#ffffff')
  const pupil = paint('#1d1d1d')

  const leg = (side: number) => {
    const hip = new Group()
    hip.position.set(0.11 * side, 0.46, 0)
    hip.add(
      kit.part(kit.box, paint('#39456b'), [0.15, 0.4, 0.17], [0, -0.2, 0]),
      kit.part(kit.box, paint('#2e211b'), [0.17, 0.09, 0.3], [0, -0.415, 0.05]),
    )
    return hip
  }
  const arm = (side: number) => {
    const shoulder = new Group()
    shoulder.position.set(0.28 * side, 0.82, 0.02)
    shoulder.add(kit.part(kit.box, coat, [0.14, 0.14, 0.26], [0, 0, 0.1]), kit.part(kit.box, skin, [0.1, 0.1, 0.3], [0, 0, 0.36]))
    return shoulder
  }

  const head = new Group()
  head.position.set(0, 0.94, 0)
  head.add(
    kit.part(kit.ball, skin, [0.48, 0.5, 0.46], [0, 0.22, 0]),
    kit.part(kit.ball, white, [0.17, 0.17, 0.1], [-0.1, 0.27, 0.19]),
    kit.part(kit.ball, white, [0.13, 0.13, 0.1], [0.11, 0.28, 0.2]),
    kit.part(kit.ball, pupil, [0.06, 0.06, 0.04], [-0.1, 0.27, 0.235]),
    kit.part(kit.ball, pupil, [0.05, 0.05, 0.04], [0.11, 0.28, 0.245]),
    kit.part(kit.box, paint('#4a2b2b'), [0.2, 0.06, 0.04], [0, 0.1, 0.2]),
    kit.part(kit.box, paint('#f5f0dc'), [0.045, 0.04, 0.02], [-0.04, 0.115, 0.222]),
    kit.part(kit.box, paint('#f5f0dc'), [0.045, 0.04, 0.02], [0.05, 0.115, 0.222]),
  )
  if (importance === 1) {
    const hair = paint('#3d4a39')
    head.add(kit.part(kit.box, hair, [0.03, 0.12, 0.03], [-0.04, 0.5, 0], [0, 0, 0.4]), kit.part(kit.box, hair, [0.03, 0.12, 0.03], [0.05, 0.5, 0.02], [0, 0, -0.5]))
  } else if (importance === 2) {
    const orange = paint('#f08a24')
    head.add(
      kit.part(kit.tube, orange, [0.5, 0.04, 0.5], [0, 0.42, 0]),
      kit.part(kit.cone, orange, [0.36, 0.44, 0.36], [0, 0.64, 0]),
      kit.part(kit.band, white, [0.36, 0.44, 0.36], [0, 0.618, 0]),
    )
  } else {
    head.add(
      kit.part(kit.bucket, paint('#b4bdc7'), [0.5, 0.34, 0.5], [0, 0.47, 0]),
      kit.part(kit.tube, paint('#7d8791'), [0.54, 0.04, 0.54], [0, 0.31, 0]),
    )
  }

  const legs: [Group, Group] = [leg(-1), leg(1)]
  const arms: [Group, Group] = [arm(-1), arm(1)]
  const body = new Group()
  body.add(
    ...legs,
    ...arms,
    head,
    kit.part(kit.box, coat, [0.44, 0.46, 0.27], [0, 0.69, 0]),
    kit.part(kit.box, paint('#f2efe6'), [0.16, 0.3, 0.02], [0, 0.74, 0.14]),
    kit.part(kit.box, paint('#c0392b'), [0.06, 0.25, 0.02], [0, 0.73, 0.155]),
  )

  const glow = new MeshBasicMaterial({ transparent: true, depthWrite: false })
  const ring = new Mesh(kit.disc, glow)
  ring.rotation.x = -QUARTER_TURN
  ring.position.y = 0.02
  ring.visible = false

  const root = new Group()
  root.rotation.y = ZOMBIE_FACING
  root.add(body, ring)
  return { root, body, head, legs, arms, ring, glow, height: ZOMBIE_HEIGHT[importance] }
}

export interface Peashooter {
  root: Group
  head: Group
}

/** Built facing +Z, then turned towards the lawn on the right. */
export function buildPeashooter(kit: Kit): Peashooter {
  const green = kit.paint('#6ecb3c')
  const dark = kit.paint('#3aa23a')
  const black = kit.paint('#151515')

  const head = new Group()
  head.position.set(0, 0.66, 0.02)
  head.add(
    kit.part(kit.ball, green, [0.44, 0.44, 0.44], [0, 0, 0]),
    kit.part(kit.tube, green, [0.24, 0.2, 0.24], [0, -0.02, 0.28], [QUARTER_TURN, 0, 0]),
    kit.part(kit.tube, kit.paint('#5cb630'), [0.29, 0.05, 0.29], [0, -0.02, 0.38], [QUARTER_TURN, 0, 0]),
    kit.part(kit.tube, kit.paint('#1f4d14'), [0.18, 0.02, 0.18], [0, -0.02, 0.405], [QUARTER_TURN, 0, 0]),
    kit.part(kit.ball, black, [0.09, 0.09, 0.09], [-0.12, 0.1, 0.17]),
    kit.part(kit.ball, black, [0.09, 0.09, 0.09], [0.12, 0.1, 0.17]),
    kit.part(kit.ball, kit.paint('#ffffff'), [0.03, 0.03, 0.03], [-0.11, 0.125, 0.208]),
    kit.part(kit.ball, kit.paint('#ffffff'), [0.03, 0.03, 0.03], [0.13, 0.125, 0.208]),
    kit.part(kit.ball, dark, [0.2, 0.06, 0.28], [0, 0.14, -0.24], [-0.5, 0, 0]),
  )

  const root = new Group()
  root.rotation.y = QUARTER_TURN - 0.35
  root.add(
    head,
    kit.part(kit.tube, kit.paint('#2f8f2f'), [0.07, 0.5, 0.07], [0, 0.27, 0]),
    kit.part(kit.ball, dark, [0.55, 0.07, 0.24], [0, 0.04, 0], [0, 0.6, 0]),
    kit.part(kit.ball, kit.paint('#2f8f2f'), [0.55, 0.07, 0.24], [0, 0.04, 0], [0, -0.7, 0]),
  )
  return { root, head }
}

export function buildGravestone(kit: Kit): Group {
  const stone = kit.paint('#a3abb0')
  const carving = kit.paint('#5f676c')
  const grave = new Group()
  grave.add(
    kit.part(kit.ball, kit.paint('#5b452f'), [0.62, 0.12, 0.42], [0, 0.02, 0]),
    kit.part(kit.box, stone, [0.38, 0.42, 0.13], [0, 0.23, 0]),
    kit.part(kit.tube, stone, [0.38, 0.13, 0.38], [0, 0.44, 0], [QUARTER_TURN, 0, 0]),
    kit.part(kit.box, carving, [0.2, 0.05, 0.02], [0, 0.4, 0.07]),
    kit.part(kit.box, carving, [0.05, 0.26, 0.02], [0, 0.35, 0.07]),
  )
  return grave
}

export interface Scenery {
  group: Group
  /** The paint of each lane's doorstep slab, so a bitten lane can flash. */
  steps: MeshLambertMaterial[]
}

export const STONE = new Color('#d3bd93')

/** The lawn, the doorstep, the house on the left, and the garden around them. The lawn's surface is y = 0. */
export function buildScenery(kit: Kit, lanes: number, columns: number, laneDepth: number): Scenery {
  const depth = lanes * laneDepth
  const group = new Group()
  const ground = (mesh: Mesh) => {
    mesh.castShadow = false
    mesh.receiveShadow = true
    return mesh
  }

  const grass = [new Color('#74c247'), new Color('#62b03a')]
  // The column next to the house: work that has to be touched today.
  const today = [new Color('#de9166'), new Color('#d17f55')]
  const tiles = new InstancedMesh(kit.box, new MeshLambertMaterial(), lanes * columns)
  const spot = new Object3D()
  for (let lane = 0; lane < lanes; lane++) {
    for (let column = 0; column < columns; column++) {
      const index = lane * columns + column
      spot.position.set(column + 0.5, -0.05, (lane + 0.5) * laneDepth)
      spot.scale.set(1, 0.1, laneDepth)
      spot.updateMatrix()
      tiles.setMatrixAt(index, spot.matrix)
      tiles.setColorAt(index, (column === 0 ? today : grass)[(lane + column) % 2])
    }
  }
  tiles.receiveShadow = true

  const steps = Array.from({ length: lanes }, (_, lane) => {
    const paint = new MeshLambertMaterial({ color: STONE })
    group.add(ground(kit.part(kit.box, paint, [DOORSTEP, 0.25, laneDepth - 0.03], [-DOORSTEP / 2, -0.125, (lane + 0.5) * laneDepth])))
    return paint
  })

  const houseX = -DOORSTEP - 1.8
  const roofShape = new Shape().moveTo(-2.25, 0).lineTo(2.25, 0).lineTo(0, 1.5).closePath()
  const roof = new Mesh(new ExtrudeGeometry(roofShape, { depth: depth + 1.8, bevelEnabled: false }), kit.paint('#b5533c'))
  roof.position.set(houseX, 2.65, -0.9)
  roof.castShadow = true
  const frame = kit.paint('#ffffff')
  const glass = kit.paint('#9fd6f2')
  const wallX = -DOORSTEP
  for (const z of [depth * 0.17, depth * 0.83]) {
    group.add(kit.part(kit.box, frame, [0.06, 0.9, 1], [wallX, 1.3, z]), kit.part(kit.box, glass, [0.08, 0.72, 0.82], [wallX, 1.3, z]))
  }

  const plankCount = Math.ceil((columns + 0.8 + DOORSTEP) / 0.27)
  const planks = new InstancedMesh(kit.box, kit.paint('#c9975c'), plankCount)
  for (let index = 0; index < plankCount; index++) {
    spot.position.set(-DOORSTEP + 0.13 + index * 0.27, 0.25, -0.55)
    spot.scale.set(0.23, 1, 0.05)
    spot.updateMatrix()
    planks.setMatrixAt(index, spot.matrix)
  }
  planks.castShadow = true

  for (let index = 0; index < 6; index++) {
    const bush = kit.paint(index % 2 === 0 ? '#3f8a2c' : '#357a26')
    group.add(kit.part(kit.ball, bush, [1.9, 1.5 + (index % 3) * 0.2, 1.4], [index * 2.1 - 0.6, 0.15, -1.6]))
  }

  group.add(
    ground(kit.part(kit.box, kit.paint('#4f8f30'), [80, 1, 80], [columns / 2, -0.75, depth / 2])),
    ground(kit.part(kit.box, kit.paint('#6f4a2a'), [columns + 0.06, 0.15, depth + 0.06], [columns / 2, -0.175, depth / 2])),
    // The dirt track the zombies arrive on.
    ground(kit.part(kit.box, kit.paint('#8a6a45'), [2.6, 0.02, depth + 3], [columns + 1.5, -0.24, depth / 2])),
    tiles,
    kit.part(kit.box, kit.paint('#f3e4c0'), [3.6, 2.9, depth + 1.2], [houseX, 1.2, depth / 2]),
    roof,
    kit.part(kit.box, kit.paint('#7a4d29'), [0.08, 1.5, 0.85], [wallX, 0.75, depth / 2]),
    kit.part(kit.ball, kit.paint('#ffd23f'), [0.09, 0.09, 0.09], [wallX + 0.05, 0.72, depth / 2 + 0.28]),
    planks,
    kit.part(kit.box, kit.paint('#a87440'), [columns + 0.8 + DOORSTEP, 0.08, 0.07], [(columns + 0.8 - DOORSTEP) / 2, 0.45, -0.6]),
  )
  return { group, steps }
}
