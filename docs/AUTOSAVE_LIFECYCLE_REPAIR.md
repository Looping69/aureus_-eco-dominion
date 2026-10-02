# Autosave lifecycle repair

The final review identified two save risks: cancellation cleanup could save a newly constructed world over an existing colony, and anonymous beforeunload callbacks survived disposal.

`game/world/ColonyAutosave.ts` now separates initialization from an explicitly chosen colony session. The controller remains inactive through construction, initialization, and the home screen. New Game, Demo, successful Continue, or explicit Save activates it. The standalone bootstrap activates only after runtime startup. Normal interval, hidden-document, unload, and shutdown autosaves remain available for active colonies.

Disposal first becomes terminal, clears its timer, and removes both stable browser listener references. It then performs one final save only for an active colony. Repeated disposal, queued/retained callbacks, and disposed-world public Save/Load calls cannot write. Generic teardown no longer unconditionally saves. Standalone bootstrap cleanup now unloads its world before releasing rendering resources.

## Verification

- TypeScript, 293 configured tests, Vite build, and five boundary/RNG checks pass. Engine external imports remain zero.
- Broader tests remain 161 total / 145 pass / 16 existing failures, with exactly the same failing titles as the fog checkpoint.
- Five regressions cover cancellation before and after initialization, byte preservation, active shutdown, repeated disposal, old-world callbacks versus a successor, cleanup if the save callback throws, and activation wiring.
- Chromium created a real colony and purchased Advanced Drilling. A later startup was cancelled after the actual factory returned a constructed world, before restoration. The stored save remained byte-for-byte identical. A fully initialized home-screen world was also cancelled without changing it.
- Chromium observed one active colony unload listener and zero after disposal. Explicit calls on disposed worlds, browser unload dispatch, and retained removed callbacks left the stored bytes untouched. Continue restored the research; active unload saved tick 80, equal to the live tick. Final disposed listener count was zero.

Evidence in the task directory: lifecycle-browser.json/.log/.png, lifecycle-smoke.cjs, lifecycle-build.log, lifecycle-boundary.log, lifecycle-affected-final.log. Browser requests for external fonts/CDN/analytics were blocked and produced fetch errors. The development server has its own unload listener; verification counts only actual ColonyAutosave registrations.

The two reviewed blockers are resolved. Save keys and serialized schemas are unchanged. No push, merge, or deployment is included.
