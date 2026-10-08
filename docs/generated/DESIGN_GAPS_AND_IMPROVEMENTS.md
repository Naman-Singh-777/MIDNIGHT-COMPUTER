# Design gaps and improvements

1. The hall is plain. More props and a few lit doors would give the patient a place.
2. The patient coat is dark and sits low against the hall wall. A rim light or a lighter coat for some archetypes would help readability.
3. The paperwork cards on the left still cover the 3D CRT in desk view. The HTML ledger card shows the same text, but the physical monitor is hidden. Move the cards or enlarge the monitor.
4. Phone layout works for reading but the game is keyboard first. Touch controls are not planned for the first demo.
5. Subtitle text from the last patient stays on screen while the player walks the corridor.
6. Only one shift. Shift 01 should reuse the sim with new scripts and a harsher Understudy.
7. Bundle is 4.9 MB. Split Rapier loading behind the title screen.
8. No settings menu yet (volume, mouse sensitivity, reduced flicker, subtitles size).
9. Accessibility: flashing lightning and flicker need a reduce option before any public demo.

10. Characters are procedural and stylised. They need hand-modelled GLB versions.
11. Speech is a blip synth. It needs real voices.
12. The wall calendar in the booth still uses Georgia. It is part of the locked map, so it was left alone.
13. The breath fog sprite is large when the camera is close. Fine at the booth distance, odd in close-ups.

## Logged in round 3 (left alone because of the map lock)

1. The Ward B slot view is a flat 2D drawing. It reads, but the beds are crude. A 3D room behind the door would be better and needs map approval.
2. The hall behind the glass is still one box with one light. The new textures help, but the lighting rig is locked.
3. "Work another night" only closes the end sheet. There is no reset to a fresh shift yet.
4. System voices differ a lot between Windows, Mac and Chrome. Recorded lines would be more consistent.
5. The mother's copy uses the fluent mimic body with a look override. She deserves her own animation (bare feet, hand flat on the glass).

## Logged in the character pass (left alone because of the map lock)

14. Item 10 above is partly done: visitors now use the MakeHuman body (see `CHARACTER_REDESIGN_REPORT.md`). Hair cards, shoes and collars still want Blender meshes.
15. The visitor at the glass is lit mostly by the orange under light and the blue hall light. The reference has a warm side key light. Adding one is a lighting change, so it needs your approval.
16. `tools/smoke.mjs` starts `vite preview` and kills only the npx wrapper, so a preview server stays running after each smoke run. It does not affect results, but repeated runs pile up servers. The review tools now kill their own server; smoke was left as it is.
17. The breath puffs (item 13) now cover the mouth in face close-ups of the new heads as well.
18. The booth glass tint is strong enough that the visitor's face colour reads yellow-green from the chair.

## Logged in the horror pass (left alone: outside scope)

19. The hall rim light on the visitor (PatientView) lights the back of the neck very pale. It is a character light, but changing its strength changes the whole look at the glass, so it was left.
20. The booth scene now has more triangles from the telephone. If Iris Xe struggles, the coiled cord and the dial are the first things to simplify.
21. Visitors still have shell hair. Strand cards like the tall one's would suit them, at a cost per visitor.
22. Upper teeth are hidden by the upper lip even when a mouth is open; a small upper-lip lift on reveal would show them.
