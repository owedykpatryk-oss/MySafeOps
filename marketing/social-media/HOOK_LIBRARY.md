# Hook Library

Five hooks per topic, one from each psychological angle. Swap them into any post — a post that underperforms usually has a hook problem, not a body problem.

**Angles used throughout:**
1. **Curiosity** — opens a loop the reader needs closed
2. **Pain/problem** — names something they're living with
3. **Surprising fact** — contradicts an assumption
4. **Personal story** — a specific moment, specific person
5. **Result/outcome** — the after state

**No invented statistics anywhere.** Where a number appears it is verifiable from the codebase (18 photo types, 5 conflict rules, ±5 m accuracy, 20+ permit types).

---

## Topic 1 — Permit conflict matrix

1. **Curiosity** — Your permit software has never once told you no. That's not a feature.
2. **Pain** — Two valid permits. Same location. Same afternoon. Nobody's job to notice.
3. **Surprising** — Most permit software will happily let you kill someone.
4. **Personal** — A supervisor showed me his whiteboard and asked what my software did instead. I didn't have a good answer, so I built one.
5. **Result** — Hot works and confined space entry can no longer be live in the same place at the same time. The system refuses.

---

## Topic 2 — Survey-to-dig handover

1. **Curiosity** — The cable was on the survey. It was on the drawing. It still got hit.
2. **Pain** — The man with the breaker is working from a photocopy of somebody's interpretation of a report he's never read.
3. **Surprising** — Between the survey finding a service and the digger arriving, the information is re-typed by hand at least twice.
4. **Personal** — I stopped believing struck services were bad luck when I counted the handoffs.
5. **Result** — The survey finding and the permit to dig are now the same record. Revise one, the other knows.

---

## Topic 3 — Geo-photos to CAD

1. **Curiosity** — Take the photo. The DXF is already done.
2. **Pain** — Your best surveyor spends his evenings typing coordinates into a spreadsheet.
3. **Surprising** — Your phone already knows where it is and which way it's pointing. That gets thrown away every time.
4. **Personal** — I built this because I got tired of watching good field data die in a folder called Site Photos.
5. **Result** — Same photo, opened in CAD, point in the right place. No typing.

---

## Topic 4 — Typed capture fields

1. **Curiosity** — This was an actual commit message: "Stop asking a survey control mark which buried service it is."
2. **Pain** — Every irrelevant field is a small insult, and enough of them and your data quality is gone.
3. **Surprising** — Nobody ever writes a case study about removing fields. It's usually the highest-value thing you can do.
4. **Personal** — A surveyor sent me a photo of my own form with three fields circled and the word "why".
5. **Result** — Eighteen capture types. A control mark now gets asked where it is and nothing else.

---

## Topic 5 — Expiring records

1. **Curiosity** — His ticket expired on Tuesday. Nobody noticed until Friday.
2. **Pain** — Everything in this industry expires, and all of it expires silently.
3. **Surprising** — The dangerous compliance failure isn't someone being reckless. It's someone doing exactly what they always do on a certificate that ran out.
4. **Personal** — He'd done that job for six years. The only thing that changed was a date in his wallet.
5. **Result** — A prompt a month before, that arrives whether anyone remembered to look or not.

---

## Topic 6 — PAS 128 quality levels

1. **Curiosity** — Most arguments about GPR surveys are actually arguments about what was bought.
2. **Pain** — The client thinks they commissioned a map of everything underground. You delivered exactly what was scoped. The meeting still goes badly.
3. **Surprising** — GPR often shows you the trench rather than the services inside it.
4. **Personal** — I've watched a surveyor explain quality levels three times to the same client and lose the argument anyway.
5. **Result** — Put the limitations in the quote and you stop having the meeting about the excuse.

---

## Topic 7 — Specialist permit types

1. **Curiosity** — If your permit system has a field for the coxswain's name, you didn't buy it off the shelf.
2. **Pain** — The thing that keeps you alive is free text at the bottom of a form designed for a housing site.
3. **Surprising** — Most permit software ships six types and expects the rest to go in the notes box.
4. **Personal** — A rail contractor showed me where he writes the COSS name. It was in "additional comments".
5. **Result** — Possession reference, PTS numbers and COSS name are fields now. Not notes.

---

## Topic 8 — Offline capture

1. **Curiosity** — Plant room. No signal. App still works.
2. **Pain** — Cloud-only tools fail in exactly the places this job happens.
3. **Surprising** — Software sold to people who work underground usually stops working underground.
4. **Personal** — The first field test was in a basement with no bars, because that's the only test that matters.
5. **Result** — Capture offline, sync when you're back at the van. Your photos don't wait for a bar.

---

## Topic 9 — Food and pharma hygiene

1. **Curiosity** — Construction safety software has never heard of an allergen changeover.
2. **Pain** — You run two systems: the safety app, and the spreadsheets the client made you use for everything that actually stops the line.
3. **Surprising** — In food manufacturing, getting the changeover wrong isn't a safety incident. It's a recall.
4. **Personal** — The contractors I knew working in food plants had the most paperwork and the least software built for them.
5. **Result** — Line clearance, CIP sign-off, glass and hard plastic, high care access. Registers, not spreadsheets.

---

## Topic 10 — Audit trail and soft delete

1. **Curiosity** — Delete something in your current system, then try to prove it existed.
2. **Pain** — If reconstructing a document history involves anyone's memory, you don't have an audit trail.
3. **Surprising** — An inconsistent audit log is worse than none. It looks complete.
4. **Personal** — I wrote reconciliation logic that assumed absence meant deleted. It ate people's photos.
5. **Result** — Nothing hard-deletes. Sync uses tombstones. Every document knows who touched it.

---

## Topic 11 — Build in public: the photo-eating bug

1. **Curiosity** — A bug in my code deleted photos that surveyors had already taken.
2. **Pain** — You cannot re-run field data. The chamber's backfilled and the surveyor's forty miles away.
3. **Surprising** — The bug wasn't in the delete path. It was in deciding what "missing" meant.
4. **Personal** — Not a fun post to write. But you should inherit the lesson rather than the bug.
5. **Result** — Deleting now needs more certainty than keeping. It has already saved data twice.

---

## Topic 12 — Camera bearing and coverage

1. **Curiosity** — A photo of a chamber is useless if nobody knows where you stood.
2. **Pain** — Six months on, someone opens the file. Brick chamber, three pipes, no idea which one.
3. **Surprising** — Phones will report a fix that's forty metres out with no indication anything's wrong.
4. **Personal** — I added the coarse-fix warning after trusting a position that turned out to be a street away.
5. **Result** — Bearing recorded, ground coverage measured, both plotted on the map.

---

## Hooks that consistently underperform — avoid

These read as marketing and get scrolled past:

- "Are you still doing X manually?" — accusatory, and everyone says no
- "Introducing…" / "We're excited to announce…" — nobody is excited
- "Did you know that…" — reads as a listicle
- Anything opening with a statistic you can't source
- "In today's fast-paced construction industry…" — instant scroll
- Questions the reader can answer "no" to in one word
- Anything with an emoji in the first line

## Hook construction rules

- **Under 12 words where possible.** LinkedIn truncates around 140 characters on mobile; Instagram sooner.
- **Concrete nouns beat abstractions.** "Coxswain" beats "specialist roles". "Tuesday" beats "recently".
- **Name a specific moment.** "His ticket expired on Tuesday" works because Tuesday is a real day.
- **Never explain in the hook.** The hook creates the need to read line two. That's all it does.
- **Say the uncomfortable thing.** "Most permit software will happily let you kill someone" travels because it's a real position, not a soft one.
