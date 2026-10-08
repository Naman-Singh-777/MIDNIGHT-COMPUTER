# MIDNIGHT horror pass: characters, the tall one, desk, telephone, corridor

Scope was the visitors, the tall one, the desk and its telephone, the booth glass and the east corridor's surfaces. Following your note, nothing was placed in front of the desk: the tall one stays in the corridor, as before.

How it was checked: headless Chromium with software WebGL (SwiftShader) in the cloud session. Nothing was run on your laptop or on Iris Xe. Frame times are software rendering and only good for comparing old against new.

Checkpoint before any change: tag `checkpoint/pre-character-creature-environment-horror-pass` on `b28863b`. Images: `docs/generated/images/horror_pass/`.

## 1. Files changed

* `src/render/human.ts`: mouth fix, teeth and gums, mouth cavity, glasses, hats, garment coverage, per-finger frames, bone stretch, hooks for the tall one.
* `src/render/patientView.ts`: four reveals with timing, breath start point.
* `src/render/creature.ts`: the tall one rebuilt (the old figure stays as the fallback while the body file loads).
* `src/render/desk.ts`: the telephone rebuilt; oak roughness; blotter wear.
* `src/render/environment.ts`: smudges on the booth glass; the corridor boxes use worn copies of their own materials. No box moved.
* `src/render/corridorDress.ts` (new): the corridor's worn materials and decals.
* `src/game.ts`: one line. The death frame puts the tall one's face level with yours, using its new height instead of a fixed 2.2 m.
* `tools/mh-bake.mjs`, `public/characters/humans.bin`, `humans.json`: one bone per finger (39 bones), and a starved base body for the tall one.
* `tests/humans.test.ts`: one more check (the tall one's body and the finger bones).
* `tools/look-cast.mjs` (debug switches), `tools/look-creature.mjs` and `tools/look-env.mjs` (new review renders).
* Docs: this report, `DESIGN_GAPS_AND_IMPROVEMENTS.md`, `WORK_LOG_ALL_ROUNDS.md`, `CLAUDE.md` (the repo is now MIDNIGHT777).

## 2. Intentionally untouched

The map: every wall, door, window, room, the desk's position, the glass position and the far door. All lights and their positions. The sim (`src/sim`), AI, the stalker's rules, the fear director, dialogue, story, UI, audio, cameras, the player and the hall. The hall, booth and yard keep their original materials.

## 3. Human character fixes

* The red marks under the mouth are gone (section 4).
* Real teeth, gums, a tongue and a dark mouth cavity.
* Glasses rebuilt as one piece with arms to the ears (section 5).
* Hats fitted to the measured skull and hair (section 6).
* Bare skin no longer shows at the shoulders. A vertex on top of the shoulder is half torso and half arm, so it counted as neither and stayed uncovered; coverage now adds the weights together. The coat neckline no longer leaves a ring of skin, and the collar is wider so it hides the stepped edge.
* The shirt exists only in the V of a coat or jacket. Elsewhere it used to poke through the coat at the shoulders.
* One bone per finger, so each finger curls on its own.
* Lip colour is held to the lips; Edie's lipstick no longer spreads below the lip.
* The breath puff now starts in front of the lips. It used to start behind them, so it showed inside an open mouth as a pale crescent.

## 4. The mouth fix and its root cause

I tested this by switching each colour rule off in turn and rendering the same faces (Walter and Rosa).

* **Red marks.** The cause was my own inside-of-the-mouth rule from the last pass. It painted any vertex near the mouth whose normal faced away from the viewer a dark wet red. The fold under the lower lip faces down and slightly in, so it passed that test, giving two symmetrical red dents.
  * Now only the lip tissue itself (its own shape mask), or anything already behind the lip line, can count as inside. The floor and roof of the mouth are found by the direction their surface faces. The fold under the lip stays skin.
* **The pale "flap" in the reveal.** There were three causes, and each was isolated.
  * **No mouth cavity.** MakeHuman's head has nothing behind the lips, so an open mouth showed the room through the back of the head. Two dark half-shells now close it: the roof rides the skull, the floor rides the jaw, and they overlap, so no gap opens however far the jaw drops.
  * **Light inside the mouth.** The hall lights cast no shadows here, so they lit the mouth floor. The skin shader now takes a cavity value per vertex and kills light inside the mouth. A mask painted in the body's UV layout also removes shine there.
  * **The breath puff.** It started inside the lips (see section 3).
* **Teeth.** MakeHuman's 68-vertex helper teeth now only give the size and place of each arch.
  * The arch itself is built: incisors (thin blades), canines, premolars and molars along a curve, slightly uneven, yellowed with age and darker toward the back.
  * A gum line runs along each arch. The upper teeth ride the skull, the lower teeth and tongue ride the jaw.

## 5. The glasses fix

One group on the head bone, measured from each person's own head:

* **Lenses and frames:** two lens frames and lenses, set just clear of the brow, cheek and eyeball.
* **Bridge:** it arches over and rests on the nose.
* **Hinges:** a hinge block on the outer edge of each frame.
* **Temple arms:** each arm follows the side of the head and hair (it is kept 3 mm clear of whichever is wider), passes over the top of that ear (found from the ear's own shape) and curls down behind it.

Checked front, side, three-quarter and back on Walter, Bernard, Penhale and a stranger. They also turn with the head, since they are on its bone. See `before_after_side.jpg`.

## 6. Hats and accessories

Each hat measures a cross-section of skin and hair at its band height and builds its band to that shape, 2 mm out. A hat now rests on the hair instead of floating or sinking.

* **Trilby:** tapered crown with a pinched front and dented top, a curled brim, and a ribbon.
* **Flat cap:** low band, a crown that slides forward, and a stiff peak.
* **Cloche:** follows the skull down to the brows, with a narrow turned brim.
* **Nurse's cap:** pinned on the crown.

All are single groups on the head bone. Props were already on the hand bones and are unchanged.

## 7. The creepy reveal

Each fake shows itself one of four ways, chosen from its seed. The wrongness builds over a third of a second and then keeps creeping, rather than snapping to a pose:

* **unhinge:** the jaw drops past where a jaw stops and skews to one side; black eyes.
* **grin:** the corners pull back far beyond a smile, teeth showing, the eyes held wide, the head laid over on its side.
* **rolled:** the eyes turn up into the head, one lid sinks half closed, the mouth hangs open.
* **hollow:** nothing moves at all; black eyes, grey skin, the head grows longer.

The existing rules stay: no breathing, a fixed gaze that locks on early, a lagging right lid, and blinks that stop at later stages. See `reveals.jpg`.

## 8. The tall one: redesign

Built on the same authored body as the visitors (a starved, very old man from the MakeHuman shapes), then stretched per bone. Each bone is stretched along its own axis, so diagonal limbs never shear:

* **Height and proportions:** 2.72 m, under a 2.9 m ceiling, so its head is up among the pipes. The neck is about twice too long, the ribcage narrow and deep.
* **Limbs:** the shoulders are uneven (the left wider). The upper arms are half again too long and the forearms nearly double. The hands are long, with fingers about twice their length, each a little different. The thin legs end in big flat feet.
* **Surface:** ribs cut in as grooves, a sucked-in belly, collarbones that stand out, knuckles, and eight torn wounds.
* **Paint, in layers:**
  * sallow dry skin with greenish rot and dark veins
  * brown-black crusts of dried blood
  * fresh wet blood running down from the mouth, every wound and the hands
  * bone showing at the deeper wounds and on the shins
  * black split nails
* **Wet and dry:** a wetness value per vertex makes fresh blood and damp skin glossy while dry skin stays matte.
* **Hair:** about 80 long wet clumps of strand cards. They part down the middle, so a strip of an almost-human face shows through: hollow cheeks, deep eyes and a mouth hanging open.
* **Eyes:** one milky with a pinprick pupil, one black and wet.
* **Tissue:** strips of torn tissue hang from the forearms, ribs and a thigh, and sway.

See `before_after_creature.jpg` and `creature_states.jpg`.

## 9. The tall one: animation states

Everything is driven by seeded, filtered noise and timed events, never by per-frame randomness.

* **dormant:** chin down, almost still, slow breathing.
* **watching:** the body stays put and the head turns to you first; it also happens briefly while walking.
* **wrong:** the head swings past you on an underdamped spring, corrects, then stops dead and holds.
* **search:** the head sweeps slowly; the body follows late.
* **locked:** head and gaze snap onto you and the breathing stops.
* **burst:** a sudden lurch of the body, arms and jaw in a quarter of a second, then stillness.
* **withdraw:** walking away, the head stays turned to you.

Layers on top of the states:

* Whole-body freezes of 0.35 to 1.25 s every 6 to 15 s. The fingers keep twitching through them.
* Each finger twitches on its own timer.
* Head and shoulder tremor, and slow sway and weight shifts.

Walking:

* The stride is tied to the distance actually covered, so planted feet stay planted, and the stance foot stays flat on the floor.
* One leg steps shorter and later, and the knee bends late in the swing.
* The torso leans into the walk late, the arms barely swing, and the right arm follows a beat after the left.

The sim's stalker modes pick the states (listen, search, hunt, door, leave, roam). The sim itself is unchanged.

## 10. The telephone

It sits in the same spot, with the same footprint and the same ring lamp the game blinks.

* **Case:** a squared Bakelite case on a plinth, its front pressed into a slope.
* **Dial:**
  * a finger wheel with ten real holes, over a printed number and letter card
  * a centre label
  * a chrome finger stop
* **Cradle:** a raised bridge with two forks and two hook plungers.
* **Handset:** a contoured handle swept along a curve, thick at the ends and slim at the grip. It has round cups with a perforated earpiece and a grille mouthpiece, and lies in the dips of the forks.
* **Cords:** a coiled cord running from the handset to the side of the case, and a line cord off the back of the desk.
* **Material:** worn Bakelite. It is rubbed glossy where hands go, dulled and scratched elsewhere, with dust in the lower half.

See `before_after_desk_phone.jpg`.

## 11. The corridor and desk surfaces

Corridor (same boxes, same lights), using worn copies of its own materials:

* rust-brown water streaks running down from the pipes, with tide lines
* mould along the top of the walls, and grime at shoulder height
* paint lifting from the green dado in damp patches, with trolley scuffs and dirt along the skirting
* old leak rings on the ceiling
* black grout, and a wet film on the floor that catches the tube lights
* three puddles, one dark drag mark, and soot over the far door

Desk:

* darker, redder oak, with a roughness map that keeps the polish along the front edge and dulls it in scratches, dents and old cup rings
* the blotter is faded at the edges and creased

Booth glass: faint hand and face prints from the hall side, a wiped arc and dust. It stays clear.

See `before_after_corridor.jpg`.

## 12. Tests run

| Check | Result |
|---|---|
| `npm run typecheck` | clean |
| `npm test` | 41 passed |
| `npm run build` | clean |
| `node tools/smoke.mjs` | passed, no console errors (headless) |

Performance, measured with the same tool before and after (software GL):

| | Before this pass | After |
|---|---|---|
| Triangles per visitor | about 31,700 | about 36,300 (teeth, gums, hats, glasses) |
| Draw calls, whole booth scene with a visitor | 218 to 232 | 242 to 260 |

The booth scene draws more triangles because of the phone, counted again in the lamp's shadow pass. The tall one is about 15,000 body triangles plus hair cards, built once.

## 13. Visual QA performed

All renders were headless, in the game's own lighting, at the real spots.

* **Mouths:** every colour rule switched off in turn; open mouth front and three-quarter; closed mouths on Walter, Rosa and Penhale.
* **Glasses and hats:** front, three-quarter, side, back of head and head-on, on five people.
* **Clothing:** chest and back of neck on four people, with each garment layer hidden in turn to find the bare-skin source.
* **Reveals:** all four kinds on Penhale, plus Rosa and Walter.
* **The whole cast:** front and face.
* **The tall one**, in the actual corridor:
  * far, middle and close
  * under the ceiling and by a door
  * face, portrait and hands
  * walking, walking away, search, hunt, and the wrong state after about 4.6 s
* **Desk:** the whole desk; the phone from the front, side, top and the chair.
* **Glass:** the booth glass.
* **Corridor:** full, wall, floor and far end.
* **Before images:** rendered from the checkpoint build with the same tools.

Not done: real hardware; a full night played through; motion judged as video. Every check was a still frame, so the timing of the creature's movement is untested by eye.

## 14. Git commit hash

See the commit titled "Improve character horror, corridor creature, and local environment" on `main`. Its hash is reported in the session reply, because a commit cannot contain its own hash.

## 15. Push result

Reported in the session reply after `git push` and a check that origin/main equals HEAD.

## 16. Remaining visual defects (honest)

* **The unhinge reveal** opens less than intended. The MakeHuman jaw weights move the chin less than the rotation suggests, so it reads as a round gape rather than a dislocated jaw.
* **Teeth:** the lower arch is clearly visible but the upper teeth mostly hide behind the upper lip, even when open. The arch is built from boxes and reads as teeth only at game distance.
* **Hair** is still a shell for the visitors. Only the tall one has strand cards.
* **The nape:** the back of the neck catches the blue rim light and reads very pale from behind.
* **Glasses arms** ride over the hair at the temples, so on full hair they sit a little out from the head.
* **The tall one's** torso is still smoother than the reference. Its hands read as long and bloody but not yet as individually crooked joints at a distance. Its decay is vertex paint, so close up it is soft-edged.
* **The phone handset** looks slightly oversized against the case from the front.
* **Fake at rest:** stage 3 fakes glimpse their reveal on a timer, so a still image can catch one mid-reveal.
* **Speed:** everything was judged in software rendering only.
