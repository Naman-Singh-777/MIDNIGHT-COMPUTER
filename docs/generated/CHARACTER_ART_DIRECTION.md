# MIDNIGHT character art direction: analysis and decision

Written before any code changed in this pass. The reference is the "MIDNIGHT character design sheet" image you supplied: six full figures, two face close-ups, details (eye, hand, cloth, shoe), a turnaround and an expression strip.

## 1. How the current characters are built (inspected)

| Part | Current construction | File |
|---|---|---|
| Skull | One `SphereGeometry` (r 0.14) pushed by 12 Gaussian bumps (sockets, brow, cheeks, chin, temples), jaw underside flattened | `faces.ts` `sculptHead` |
| Face | A second sphere slice slightly larger than the skull, mapped with a 512 px painted canvas (lips, brows, creases, pores) | `faces.ts` `drawFace` |
| Eyes | Separate eyeball spheres with a painted iris, half-sphere lids. Good and reusable | `patientView.ts` |
| Nose, ears | Cylinder bridge, three spheres; ears are squashed spheres | `patientView.ts` |
| Hair | Sphere caps tilted back, plus spheres for buns and curls | `patientView.ts` |
| Body | Lathe torso, ellipsoid pelvis, lathe limbs hung from pivots, sphere joints, a lathe coat skirt | `humanoid.ts` |
| Hands | Ellipsoid palm, lathe fingers in two segments | `humanoid.ts` |
| Clothing | Material colour on the body parts, plus boxes for lapels and tori for collars | `humanoid.ts` |
| Animation | Forward kinematics on pivot groups: walk, poses, breathing, gaze | `patientView.ts` |
| Behaviour | Gaze rules, stare, glass press, breach, lurk, reveal | `patientView.ts` (keep all of this) |

## 2. What the reference image demonstrates

What makes those six read as people, region by region:

* **Silhouette and proportion.**
  * Heads are small: about one eighth of the body for Walter, Penhale and Ivor.
  * Shoulders are the widest point on the men and slope; necks are short and partly hidden by collars.
  * Each figure is recognisable from its outline alone: Walter's long shapeless coat and bag, Rosa's apron above the knee, Hester bent nearly double over a cane, Penhale's long vertical black column with the stole, Dolly's wide fur with a narrow dress below, Ivor's barrel chest and short legs.
* **Skull and face planes.**
  * Faces are long ovals, not circles. The forehead is a flat-ish plane that turns sharply at the temples.
  * The brow ridge throws a shadow band across the eyes. Cheekbones make a visible change of plane under the outer eye.
  * The mandible makes a hard line from ear to chin, with the jaw angle under the ear.
  * Penhale's face is narrow and long, with hollow temples and cheeks; that hollowness is most of his menace.
* **Eyes.**
  * Set deep, half in shadow from the brow. The upper lid covers the top of the iris and casts a line of shadow on the eyeball; the lower lid is a thinner shelf.
  * The eye whites are never pure white: pinkish at the corners, darker under the lid. Wet highlights.
  * Penhale's irises are too pale. That alone makes him wrong.
* **Nose.** A bridge that starts between the eyes, a dorsum, a rounded tip, alar wings with nostrils underneath. It projects well forward of the cheeks and casts a shadow on the upper lip.
* **Mouth.** Lips are volumes with a dark line between them. The upper lip has a cupid's bow and philtrum above it. Nasolabial folds frame the mouth on the older faces.
* **Ears.** Proper helix and lobe, angled back, set level with the eyes and nose.
* **Age is in the geometry.**
  * Hester: sunken cheeks, deep eye bags, a thin mouth, a hunched spine.
  * Walter: heavy lids and lined forehead.
  * Rosa: smooth, full cheeks.
* **Asymmetry.** Every face is slightly uneven: brow heights, mouth corners, one eye more open.
* **Hands.** Long bony fingers with knuckles, tendons on the back of the hand, nails. Fingers taper and curl naturally.
* **Clothing is worn, not painted.**
  * Coats hang from the shoulders and fold at the elbow and waist. Collars stand off the neck.
  * Fabrics read differently: wool is matte with soft folds, fur is lumpy, the cassock is a smooth heavy black, the nurse dress is stiff cotton with a crisp apron, and leather has highlights on creases.
  * Everything is worn and dirty at the hems.
* **Hair** has a hairline, sideburns, flyaway strands and real volume: Rosa's loose bun, Hester's thin wisps, Walter's untidy short hair.
* **Materials and light.**
  * Warm practical lights from the side, a rim of light on shoulders and hair, and deep shadow everywhere else.
  * Skin has a slightly translucent warm falloff, with redness at the nose, ears and cheeks.
* **Fakes.** Penhale reads as human first; the wrongness is in the pale eyes, the held stare and the too-calm face. There is no monster face.

## 3. Why the current characters still look primitive

1. **The head is a sphere.** No amount of bump-pushing gives a sphere the planes in section 2: flat forehead, temple turn, cheekbone plane, mandible line, a nose that grows out of the face. The silhouette from the side is still round.
2. **The face is painted on.** Lips, nostrils, creases and lids are paint, so they do not catch light or cast shadow. In the reference the shadows *are* the face (brow shadow over the eyes, nose shadow on the lip).
3. **The ears, nose and lids are separate blobs**, not continuous with the skin, so seams show up close.
4. **Bodies are joined tubes.** Each joint is a sphere where two lathes meet, so shoulders, elbows and knees show the joins. Clothing is the same tube painted another colour, so coats do not hang.
5. **Hair is a helmet**: one sphere cap with no hairline, sideburns or volume.
6. **Proportions.** The head was scaled up as a caricature and sits on a long cylinder neck. The reference keeps caricature in the features, not the head size.

## 4. Can the procedural system reach the reference?

**No.** Points 1 to 4 are structural: a sphere and lathe kit has no topology for a jaw line, lips, nostrils, eyelids or a knuckle ridge. More bumps and more primitives would only add detail on top of the same egg. The reference is a photographic concept render, and no real-time browser character on Iris Xe will match it pixel for pixel. The realistic target is that reference's *design*: anatomy, planes, silhouette, materials and asymmetry. That needs an authored mesh.

## 5. The minimum transition

Use an **authored human base mesh** instead of primitives, keeping every behaviour system.

* **Source: MakeHuman 1.x system assets** (github.com/makehumancommunity/makehuman, `makehuman/data`). Released **CC0**, so it is free for a commercial game with no credit required (credit given anyway). It contains:
  * `base.obj`: an artist-modelled human with about 13,400 body faces. It has real eyelids, lips, nostrils, ears, knuckles, nails and toes, plus helper meshes that mark the eyeball positions.
  * 1,554 shape targets: gender, age, weight, muscle, height, ethnicity, and dozens per region (nose, mouth, lips, philtrum, chin, jaw, cheeks, eyes, brows, ears, head shape). These provide per-character identity and asymmetry from real sculpted shapes.
  * `default.mhskel` and `default_weights.mhw`: a 163-bone skeleton with fingers and painted skin weights.
* **Why not model in Blender from scratch now:** a production-quality base head and body takes weeks of sculpting and retopology by hand. MakeHuman's mesh was made in exactly that way, is free, and is the standard base for this kind of work. Blender (your PC has the Blender MCP) stays the tool for the next step: authored clothing and hair fitted to this base. The clothes and hair asset pack is not reachable from this session.
* **Pipeline:**
  1. `tools/mh-bake.mjs` (offline, node) reads `base.obj`, the rig, the weights and the targets.
  2. For each named character it applies the macro shape (gender, age, weight, muscle, height, ethnicity) and the face targets.
  3. It writes one compact binary file (`public/characters/humans.bin`): shared topology, UVs and skin weights, plus a quantised position set and joint positions per character.
  4. At runtime `src/render/human.ts` builds a `THREE.SkinnedMesh` per visitor. Clothing and hair are shells generated from the body's own surface, so they follow anatomy and skinning; coat skirts and props stay as they are. Eyes reuse the existing eyeball system placed at the mesh's eye helpers.
  5. `PatientView` keeps its API and behaviour. It drives bones instead of pivot groups. If the file fails to load, the old procedural body is the fallback.
* **What stays:** gaze, stare, glass press, breach, lurk, walking states, the fake rules, voices, dialogue, sim, fear director, the creature, desk and map.

## 6. Acceptance checks (compare against the reference)

Front, side, three-quarter, back, rear three-quarter, close face, full body, walking, under booth light and corridor light. For each:

* Is the skull long, not round?
* Do the brow and nose cast shadows?
* Are the eyes inside lids?
* Is there a jaw line?
* Does the neck sit in the shoulders?
* Do hands have knuckles?
* Do coats hang?
* Does hair have a hairline?
* Can you tell Walter, Rosa, Hester, Penhale, Dolly and Ivor apart in silhouette?
