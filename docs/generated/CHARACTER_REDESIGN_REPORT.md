# MIDNIGHT character redesign: report

Scope: characters only. No map geometry, lights, desk, doors, AI, dialogue, fear director or story changed. The analysis that came before any code is in `CHARACTER_ART_DIRECTION.md`. Images are in `docs/generated/images/character_pass/`.

How everything here was checked: headless Chromium with software WebGL (SwiftShader) in the cloud session. Nothing was run on your laptop or on Iris Xe hardware. Frame times below are software rendering and only useful as a comparison between old and new, not as real speeds.

Git checkpoint before any code: tag `checkpoint/pre-character-pass` on commit `690c1eb` (local tag; tag pushes were refused by the proxy last round, so it may only exist here and in the commit history).

---

## 1. What was wrong with the old characters

* The skull was a sphere pushed by twelve bumps. Seen from the side it was still round. No flat forehead, no temple turn, no cheekbone plane, no jaw line.
* The face was a 512 px painting on a second sphere. Lips, nostrils, creases and lids were paint, so they never cast or caught a shadow. The reference is lit almost entirely by those shadows.
* Nose, ears and lids were separate blobs stuck on, with visible seams.
* Bodies were lathe tubes joined by spheres. Every joint showed. Clothes were the same tubes in another colour, so nothing hung.
* Hair was a sphere cap with no hairline.
* The head was scaled up as a caricature and sat on a long cylinder neck. Heads were about one sixth of the body. The reference keeps heads near one eighth and puts the caricature in the features.

`before_after_face.jpg`, top row, shows all of this.

## 2. What the reference image demonstrates

Small heads on sloped shoulders. Outlines you can recognise in black (Walter's long coat, Rosa's apron, Hester bent over, Penhale's black column, Dolly's wide fur, Ivor's barrel chest). Long oval faces with real planes. Deep-set eyes under lids and brow shadow. A nose that projects and shadows the lip. Lips with volume and a dark line. A hard jaw line. Real ears. Age carried by the bone and skin (Hester's sunken cheeks, Walter's heavy lids). Slight asymmetry everywhere. Knuckled hands. Clothes that hang from the shoulders and fold. Hair with a hairline. Warm side light. Fakes that look human first and are wrong only in the eyes and the stillness. The full breakdown is in `CHARACTER_ART_DIRECTION.md` section 2.

## 3. What was changed

The visitors now wear an authored human body instead of primitives.

* **Source mesh:** the MakeHuman 1.x system assets, released CC0. `base.obj` (13,380 body vertices), its 163-bone skeleton and painted skin weights, and its library of 1,554 sculpted shape targets.
* **Offline bake** (`tools/mh-bake.mjs`, run with node): for each of the 16 named people plus 4 stock bodies it applies MakeHuman's own macro weighting (sex, age, muscle, weight, height, ancestry) and a hand-picked list of face shapes per person, merges the 163 bones into 27, keeps the best four skin weights per vertex, measures the joints and eye positions, and writes one file: `public/characters/humans.bin` (2.06 MB) with `humans.json` and a `LICENSE.txt` crediting MakeHuman.
* **Runtime** (`src/render/human.ts`): builds a `THREE.SkinnedMesh` per visitor, settles the arms from MakeHuman's A pose to hanging at the sides, grows the clothes and hair as shells from the body's own surface, paints the skin per vertex, places the existing eyeballs, fits hats and glasses to the measured skull, and returns a rig shaped like the old one so `PatientView` animates it with the same code.
* **PatientView** chooses the new body when the file has loaded and falls back to the old procedural body if it has not (or if the page is opened with `?procedural`).

## 4. Which geometry was replaced

For visitors: the sphere skull and painted face patch, the cylinder and sphere nose, the sphere ears, the hemisphere eyelids, the sphere-cap hair, the lathe torso, limbs, sphere joints and ellipsoid hands, the lathe and torus clothing details, the box lapels and the torus collars.

## 5. Which geometry was preserved

* The eyeballs and their behaviour (gaze, saccades, fake right-eye lag, frozen stare). Same sphere and texture, now sitting in the sculpted sockets.
* Props in the hands (umbrella, goose, red cap, folder, slippers, handbag, bible, cigarette, lamp), unchanged and now held by the hand bones.
* Coat tails, dresses and cassocks still hang from the hips as a separate swinging piece, rebuilt to fit the new body.
* The breath puffs, the character rim and under lights, every phase (approach, present, leave, lurk, breach, contain).
* The tall one in the corridor (`creature.ts`) is untouched and still procedural.
* The whole procedural path in `humanoid.ts` and `faces.ts` stays as the fallback.

## 6. Head redesign

The head is MakeHuman's sculpted head, then shaped per person with region targets: head shape (oval, square, round, rectangular), forehead and temples, brow ridge, eye depth and fold, cheekbones and cheek volume, nose length, width, hump and tip, lip volume and cupid's bow, chin height and projection, ears. Penhale gets hollow temples and cheeks and a long narrow skull. Hester gets fully sunken cheeks, heavy bags and a thin mouth. Ivor and Gus get a forward brow and wide jaw. Left and right sides get different amounts, which is where the asymmetry comes from. The heads are now about one eighth of body height because the body is a real adult body, not a caricature kit.

## 7. Body redesign

Real adult anatomy from the base mesh: sloped trapezius, collarbones, ribcage, waist, pelvis, knees and calves. Build comes from MakeHuman's weight and muscle macros (Bernard heavy, Tobias thin, Ivor and Hollis muscular). Age changes posture: shoulders drop with age, and the hunch now bends the lower back as well as the chest, while the neck lifts the head so old people still look at you. A fake at stage 3 gets arms 10 percent longer, baked into the rest pose.

## 8. Hands

MakeHuman's hands have knuckles, tendons, nails and a separate thumb. The rig keeps a hand bone, one bone for the four finger bases, one for the finger ends, and a thumb. The finger bones get a rest frame worked out from the knuckles and the thumb, so the game's existing curl values fold the fingers into the palm on both hands (checked from front and side on both hands). Poses for the new body were retuned: folded arms bend to 90 degrees and turn the forearms across the body instead of reaching for the opposite shoulder.

## 9. Clothing

Garments are shells grown from the body surface: offset along the normals, smoothed so they hide anatomy, kept outside the skin, and skinned to the same bones so they can never come apart from the body. Open edges (cuffs, hems, collar) are pinned while smoothing so garments do not shrink away from each other. Skin under clothing is removed, which saves triangles and makes poke-through impossible.

* Coats, jackets and cardigans: torso and sleeves, with soft vertical folds hanging from the chest and creases at the elbow, darker wear at hems and noise in the cloth colour.
* Coats, suits and work jackets open in a V cut out by alpha (so the edge is straight), with a darker lapel band and a separate shirt underneath, some with a tie.
* Trousers on men, stockings on women, a white collar for the cassock, habit and uniform.
* Coat tails and dresses: rings that are measured against the body at every height and angle so the cloth hangs over the seat and thighs instead of cutting into them, with folds that grow toward the hem. Men's coats part at the front; women's are buttoned over a dress.
* Uniform apron panel, the cassock stole, buttons placed on the garment surface.
* Shoes: the foot is blurred until the toes merge, then grown back out, and the foot inside is removed.

## 10. Hair

Hair is a shell over the scalp with a hairline defined around the head (forehead, temples, sideburns, above the ears, nape), feathered to nothing at the edge so it falls between vertices, fuller on the crown, darker at the roots, with strand texture and an alpha that breaks the edge into wisps. Men's temples recede with age. Styles: short, slick (with a sheen), bun (with a bun), curls (lumpy and thicker), long (with a fall of hair behind), bald (a fringe round the back and sides). The scalp under the hair is tinted darker so gaps read as hair. Mae's scarf and the sister's habit are solid cloth shells round the face. Moustaches are their own shell under the nose, following the nostrils and drooping past the mouth corners.

## 11. Eyes

The eyeballs are placed at the centres of MakeHuman's eye helpers, sized from them, and sit inside real lids. Blinking and widening are MakeHuman expression shapes (lid closure, lid open-up) driven by the same values the old lid meshes used. Fakes keep a slightly wider stare and their right lid lags the left. Penhale now has pale grey-blue irises, as in the reference.

## 12. Skin and materials

* Skin is a physically based material with a softer highlight than plastic, a warm sheen at the edges to suggest light passing through skin, and a fine pore bump map.
* Per-vertex colour, from masks baked out of the shape targets (how far each region shape moves a vertex): darker, redder lips; flushed cheeks, nose and ears (more with age); bruised colour under the eyes and on the lids; brows painted as an arched band above each eye from the eye positions; stubble on the lower face for men who have not shaved; age blotches; coal dust for Ivor; darkened soles for the barefoot mother.
* Creases are darkened by measuring how concave the surface is at each vertex (beside the nose, eye corners, the lip line, the ears).
* Lipstick for Dolly, June and Edie. Teeth from MakeHuman, yellowed with age. A dark shape inside the mouth so an open mouth is not see-through.

## 13. How individual characters were differentiated

Each named person has their own baked body (sex, age, build, height, ancestry, face shapes, asymmetry), plus the clothing, hair, colours, hat, glasses, props and pose from `looks.ts`. See `whole_cast_front.jpg` and `whole_cast_face.jpg`. Strangers without a name use a stock body for their age, blended a quarter to a half of the way toward a named person of the same sex, so each gets a face of their own without another file.

## 14. How fakes differ from real characters

At rest a fake looks like the person (`fakes_and_reveal.jpg`, left). The differences: paler sclera and tiny pupils from the existing fake eye texture, lids held a little too open, the right lid lagging, no breathing or weight shift, slightly greyer skin with less blood in the cheeks, and the mouth corners turned up a fraction when it stares. The reveal, which used to swap in a painted face, now happens on the face itself: the mouth opens past what a jaw allows, the eyes go black and glossy, the skin greys, the teeth disappear and the head stretches upward on the existing scale rule.

## 15. Performance implications

All numbers from the software renderer; treat them as relative.

| | Old procedural | New authored |
|---|---|---|
| Meshes per visitor | 91 | 12 |
| Triangles per visitor | about 21,800 | about 31,700 |
| Draw calls, whole booth scene with a visitor | 305 to 333 | 218 to 232 |
| Whole scene frame, software GL | 1.17 to 1.32 s | 1.29 to 1.47 s |
| Building one visitor (CPU) | 190 to 320 ms (3.2 s for the first, canvas painting) | 170 to 480 ms |
| Extra download | none | 2.06 MB (1.7 MB gzipped) |

Fewer draw calls, about 45 percent more triangles per visitor, frame time about 10 percent higher in software rendering. Only one visitor is on screen at a time, so on Iris Xe this should be small, but it has not been measured there. Building a visitor takes a few hundred milliseconds of main thread time when they appear at the far door, the same order as before.

## 16. Polygon, mesh and material implications

* Body: 26,756 triangles in the file. Per visitor the body draws about 18,000 after removing covered skin; clothes and hair add about 13,000. 14,653 vertices.
* 27 bones per visitor (was a hierarchy of about 60 groups).
* Materials per visitor: skin, teeth, one per garment layer, hair, eyes, hats and glasses. Fabric textures are clones of the existing canvas cloth textures.
* 10 expression shapes (blinks, wide eyes, mouth open, smile, frown, sad brows, brow down, pucker) shared by the body, hair and moustache.

## 17. Animation implications

* The new rig exposes the same handles as the old one (pelvis, chest, head mount, arms with shoulder, elbow, hand and fingers, legs with hip and knee, coat tail), so walking, poses, breathing, the glass press, the breach crouch, lurking, leaving and the trapdoor drop all run on the existing code.
* New: the jaw bone opens when people speak, the lips part with the mouth shape, sad brows and a frown for the grieving (Mae, Hester and the tragic visitors), a lowered brow when a real person stares back.
* Not new: no motion capture, no idle variety per person beyond what existed, no foot planting (feet can slide a little at the end of a walk, as before).

## 18. Remaining weaknesses (honest)

* **It is not the reference.** The reference is a photographic concept render with real hair cards, cloth simulation, subsurface skin and studio light. This is a real-time game mesh. The faces now have anatomy, but up close they still read as CG: smooth, a little waxy, uniform in colour.
* **Hair is a shell, not strands.** It has a hairline and volume, but from the side it reads as a cap with a texture, and the edge at the crown shows spiky strands against the light. Curls (Dolly, June) look like a ragged red or grey mop rather than curls.
* **Shoes are still foot-shaped.** The toes are softened but the outline is a foot, not a shoe.
* **Clothes are tight.** Trousers and sleeves follow the body more closely than real cloth. There is no real collar or lapel geometry, only colour and a cut. The fur coat does not read as fur.
* **Fingers move as one.** All four fingers share one curl, and MakeHuman's rest spread stays.
* **The reveal mouth** shows a pale flap of inner lip when the mouth opens past its range. It reads as horrible, which may be fine for a one-frame flash, but it is not designed.
* **Teeth** are MakeHuman's low detail helper teeth.
* **Lighting at the glass** comes mostly from the orange under light and the blue hall light, so faces look flat and cold in the actual game view. The warm side key light in the reference does not exist in the booth. That is a lighting decision outside this pass.
* **Breath puffs** sit over the mouth in close shots.
* **Strangers** look related to each other and to the named cast, by construction.
* **Download size** grew by 2 MB.

## 19. Recommended next improvements (in order)

1. Hair cards: a few dozen alpha planes per style made in Blender on top of the shell. Biggest single visual gain.
2. Authored shoes and a proper coat collar and lapels as small Blender meshes, attached to the foot and chest bones.
3. A skin albedo texture painted in MakeHuman's UV layout (pores, freckles, veins, redness), replacing per-vertex colour for the face.
4. Split the finger bones back out (one per finger) so hands can hold things properly.
5. A warm key light on the visitor's side in the hall, if you approve changing the lighting.
6. Delta-encode the baked positions against a shared base to cut the file to well under 1 MB.
7. Build the visitor during the door-open sound to hide the build time.

## 20. Exact files changed

New:
* `src/render/human.ts`: loads the baked file, builds the skinned body, clothing, hair, skin colour, eyes, hats and glasses, returns the rig.
* `tools/mh-bake.mjs`: offline bake from the MakeHuman assets, with the per-person shape lists.
* `public/characters/humans.bin`, `humans.json`, `LICENSE.txt`: the baked bodies and the CC0 credit.
* `tools/look-cast.mjs`: review renders from many angles (front, side, back, three-quarter, face, back of head, hand, the player's view, fakes and reveals, `?procedural` for before images).
* `tests/humans.test.ts`, `tests/node-fs.d.ts`: checks on the baked file.
* `docs/generated/CHARACTER_ART_DIRECTION.md` (the analysis, committed first), this report, and `docs/generated/images/character_pass/`.

Changed:
* `src/render/patientView.ts`: uses the new body when loaded; expressions, lid shapes, jaw, hunch and neck, retuned poses, mouth position for breath.
* `src/render/humanoid.ts`: rig types widened from Group to Object3D so bones fit. No change to the old builder.
* `src/render/looks.ts`: Rosa's iris lighter, Penhale's iris pale grey-blue.
* `tools/look.mjs`: waits for the bodies to load and stops its preview server properly.
* `.gitignore`: `.cache` for the MakeHuman download.

## 21. Tests performed

* `npm run typecheck`: clean.
* `npm test`: 40 passed (the 35 game tests plus 5 new checks that every named visitor has a body, skin weights add up, no body overflows the 16 bit store, triangles are in range, the expression shapes exist).
* `npm run build`: clean.
* `node tools/smoke.mjs`: passed, no console errors (headless).
* Two bugs were found by testing and fixed: two vertices with skin weights that wrapped past 255 (which threw a spike out of the coat), and the tallest bodies (Hollis, Penhale) overflowing 16 bits so the top of the head flipped below the floor. The new tests cover both.

## 22. Visual QA performed

Headless renders in the game's own hall lighting, compared against the reference by eye at every round:

* Front, side, three-quarter and back full body; front and three-quarter face; back of head; hand; the seated player's view through the glass. For Walter, Rosa, Hester, Penhale, Dolly and Ivor (`turnaround_*.jpg`).
* All 16 named people, front and face (`whole_cast_*.jpg`). Six strangers.
* A fake at rest, and the reveal on Penhale and June (`fakes_and_reveal.jpg`).
* Walking from the side and the front; finger curl on both hands from two angles; the hair edge with debug colours; head measurements printed and checked.
* Not done: real hardware, real play through a night, motion over time beyond single frames.

Against the reference checklist from the art direction: long skulls yes; brow and nose shadows yes; eyes inside lids yes; jaw line yes; neck sitting in the shoulders yes; knuckled hands yes; coats hanging yes for coats, partly for trousers; hairlines yes, but shell hair; the six told apart in silhouette yes (see `before_after_front.jpg`).

## 23. Before and after

* `before_after_face.jpg`: egg heads with painted faces become sculpted faces with lids, noses, lips and ears.
* `before_after_front.jpg` and `before_after_side.jpg`: tube bodies with big heads become adult proportions with coats that hang and distinct outlines.
* `before_after_player.jpg`: the view from the chair through the glass.

To see the old characters in the game, open it with `?procedural` in the address.
