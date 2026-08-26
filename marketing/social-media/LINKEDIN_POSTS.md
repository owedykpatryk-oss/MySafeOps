# LinkedIn Posts

10 ready-to-publish posts. Each is separated by `---` so you can copy the block straight out.

**House rules applied throughout:** no emojis, no engagement bait, no invented statistics, no corporate language. Every post is useful to someone who never buys.

---
---

# POST 1 — The permit your software should refuse to issue

**Persona:** H&S manager, contractor owner · **Goal:** awareness + credibility

### Hook
> Most permit software will happily let you kill someone.

### Post

Most permit software will happily let you kill someone.

Not through malice. Through indifference. It stores documents. It doesn't read them.

So you can raise a hot work permit for the mezzanine, and someone else can raise a confined space entry for the tank directly below it, and the system will file both without a murmur. Two valid permits. One very bad afternoon.

The paper version of this problem was solved decades ago by a bloke with a whiteboard who knew what was happening on his site. Then we digitised the paperwork and quietly lost the bloke.

So we built the rules in.

Hot work and confined space entry at the same location: blocked. Not flagged, not warned. Blocked.
Hot work and line break: blocked.
Hot work and lock-out/tag-out: warned, because that one needs coordination rather than prohibition.
Lifting and work at height: warned, needs sequencing.
Excavation and ground disturbance: warned.

I expected people to push back on the blocking ones. A system that says no is more annoying than a system that says yes. But every supervisor I've shown it to has said some version of the same thing: good, because someone always tries.

The point isn't the software. The point is that "we store your permits" and "we understand your permits" are completely different products, and the industry has been sold the first one while being told it's the second.

If your permit system has never once stopped you doing something, it isn't checking anything.

### CTA
What conflicts would you add to that list? I'm fairly sure five isn't enough.

### Hashtags
#permittowork #constructionsafety #healthandsafety #SIMOPS

### Visual
**Screenshot.** The block message itself, in the app, showing the attempted hot work permit and the reason it was refused. Crop tight — the refusal text is the whole post. Do not use a stock hard-hat photo.

---
---

# POST 2 — The survey found the cable. The permit didn't know.

**Persona:** survey owner, contractor owner · **Goal:** awareness + leads · **This is the flagship post**

### Hook
> The cable was on the survey. It was on the drawing. It still got hit.

### Post

The cable was on the survey. It was on the drawing. It still got hit.

I've heard versions of this story often enough that it stopped sounding like bad luck and started sounding like a design flaw.

Here's the chain it usually travels down.

A surveyor finds a service. He records it properly — position, depth, confidence, quality level. That goes into a report. The report becomes a PDF. The PDF goes to a client. The client forwards it to a contractor. Someone in an office opens it, reads it, and re-types the important bits into a permit to dig. That permit gets printed. It goes in a folder. The folder goes in a van.

Count the handoffs. Five. Count the times the information is re-keyed by someone who wasn't on site. At least two.

And at the end of it, the man holding the breaker is working from a photocopy of somebody's interpretation of somebody else's report, written three weeks earlier by a surveyor he's never met and can't ring.

Every step in that chain is somebody being careful. That's what makes it hard to fix. Nobody is being lazy. The loss is structural — it's in the handoffs themselves, not in the people making them.

So the thing I've been building treats it as one record instead of five documents. The survey finding and the permit to dig are the same object. The dig guidance on the permit comes from the survey, not from someone's reading of the survey. When the survey is revised, the permit knows.

It doesn't make anyone more careful. It just removes the places where care leaks out.

I'd genuinely like to know if anyone has solved this a different way, because I've been assuming the handoff chain is the problem and I might be wrong about that.

### CTA
How does the survey information actually reach your dig team? I'm curious whether anyone has a shorter chain than the one above.

### Hashtags
#utilitysurvey #PAS128 #permittodig #constructionsafety #undergroundutilities

### Visual
**Diagram.** The five-step handoff chain across the top, each arrow labelled with what gets lost. Below it, the same thing as a single record. Plain, almost ugly — hand-drawn energy beats a polished graphic here. Avoid corporate blue gradients.

---
---

# POST 3 — A site photo that comes back as a CAD file

**Persona:** survey owner, surveyor · **Goal:** product demo + leads

### Hook
> Take the photo. The DXF is already done.

### Post

Take the photo. The DXF is already done.

That's the bit I wanted to get right, and it took much longer than I expected.

When a surveyor photographs a chamber, the phone already knows most of what matters. It knows where it is. It knows which way it's pointing. It knows roughly how accurate that fix is. All of that sits in the image metadata and then gets thrown away, because the photo ends up in a folder called Site Photos and the position gets typed into a spreadsheet by hand.

So now the photo carries it through. GPS comes out of the EXIF. Coordinates convert to British National Grid, because that's what UK deliverables are in and nobody wants to hand a client a list of decimal degrees. Camera bearing is recorded, so in six months you can still tell which way you were facing. Ground coverage gets measured. Then it exports as DXF, KML, KMZ, GPX or GeoJSON, or as a CAD bundle.

One honest caveat, because I'd rather say it than have someone find it out.

The National Grid conversion uses a Helmert transformation. That's accurate to roughly five metres. It's right for locating field evidence — this chamber, that pole, this trial pit — and it is emphatically not a substitute for OSTN15 on precision work. If you're setting out from it, don't. I've put the same warning in the code comments so nobody inherits a wrong assumption from me later.

The other thing worth mentioning: phones lie about accuracy. They'll cheerfully report a fix that's forty metres out with no indication anything is wrong. So the app now warns when the fix is coarse rather than silently recording a position that looks authoritative and isn't.

That warning was more work than the CAD export. It's also the part I'm most pleased with.

### CTA
What do you currently do with site photos once the job's finished? I suspect most of them never become anything.

### Hashtags
#utilitysurvey #geospatial #surveying #CAD #britishnationalgrid

### Visual
**Screen recording, 20–30 seconds.** Photo taken on a phone at a chamber, then cut to the DXF opening in CAD with the point in the right place. No music, no captions beyond a single line. The cut from photo to CAD is the whole message.

---
---

# POST 4 — Stop asking a survey control mark which buried service it is

**Persona:** surveyor, survey owner · **Goal:** credibility + followers

### Hook
> This was an actual commit message this week: "Stop asking a survey control mark which buried service it is."

### Post

This was an actual commit message this week: "Stop asking a survey control mark which buried service it is."

It reads like a joke. It was a genuine complaint.

Field capture forms almost always start life generic. One form, one set of fields, works for everything. It's the sensible way to begin and it's fine right up until someone actually uses it in the rain.

Because then a surveyor photographs a control mark and the form asks him which utility it is. He photographs a trial pit and gets asked about pipe diameter. He photographs a piezometer install and gets the same eleven fields he got for a manhole. So he leaves them blank, or worse, puts something in to make the form go away. Now you've got data that looks complete and isn't.

So the capture types each ask their own questions now. Eighteen of them: trial pit, borehole cap, piezometer install, window sampling, hand auger point, DCP probe, manhole or chamber, utility locator, buried services warning, traffic management, sample custody, site entrance, orientation wide shot, before, after, hazard, general site condition, borehole location.

A trial pit gets trial pit fields. A control mark gets asked where it is and nothing else.

The lesson I keep relearning: the difference between software people use and software people work around is almost never a big feature. It's whether it asks stupid questions. Every irrelevant field is a small insult, and enough small insults and your data quality is gone — not because anyone rebelled, but because they got tired.

Nobody ever writes a case study about removing fields.

### CTA
What's the most pointless field you're made to fill in on site?

### Hashtags
#surveying #utilitysurvey #geotechnical #fielddata #buildinpublic

### Visual
**Carousel, 3–4 slides.** Slide 1: the commit message on its own, big. Slide 2: the generic form with irrelevant fields circled. Slide 3: the typed form beside it. Slide 4: the list of 18 types.

---
---

# POST 5 — The ticket expired on Tuesday

**Persona:** contractor owner, H&S manager · **Goal:** engagement + leads

### Hook
> His ticket expired on Tuesday. Nobody noticed until the client asked on Friday.

### Post

His ticket expired on Tuesday. Nobody noticed until the client asked on Friday.

He'd been on site all week. Same job he'd done for six years, same standard of work, nothing about him had changed. The only thing that changed was a date on a card in his wallet that nobody had looked at.

This is the quiet compliance failure and it's far more common than the dramatic ones. Not somebody doing something reckless. Somebody doing exactly what they always do, on a certificate that ran out while everyone was busy.

Everything in this industry expires. Competency cards. Medicals. First aid certificates. Statutory inspections on lifting equipment. PAT testing. Ladder checks. Insurance. Every one of them is a date that was correct when it was filed and is silently wrong now.

The usual answer is a spreadsheet with conditional formatting, which works until the person who maintains it is on holiday, or leaves, or is busy — which is precisely when you need it most. A spreadsheet is a record. It isn't a system. It has no opinion about Tuesday.

What you actually want is boring: something that tells you a month out, not a month late. Not a dashboard you have to remember to look at. A prompt that arrives whether you were thinking about it or not.

That's the whole feature. It isn't clever. It just has to happen without anyone deciding to make it happen — because "someone will check" is not a control, it's a hope.

### CTA
Anyone else still running theirs on a spreadsheet? I'm curious what actually triggers the check in your business.

### Hashtags
#healthandsafety #compliance #construction #competency

### Visual
**Text only.** This post is a story and a screenshot would weaken it. If you must have an image, use a photograph of an actual competency card face-down on a desk — never a stock image of a person in a hard hat looking at a clipboard.

---
---

# POST 6 — Why your GPR report gets questioned every time

**Persona:** survey owner · **Goal:** credibility + leads · **Pure education**

### Hook
> Most arguments about GPR surveys are actually arguments about what quality level was bought.

### Post

Most arguments about GPR surveys are actually arguments about what quality level was bought.

The client believes they commissioned a map of everything under the ground. The surveyor delivered exactly what was scoped. Both are being honest and they are describing different things, so the meeting goes badly.

PAS 128 exists to prevent this, and it works — but only if both sides know what the methods actually evidence. Briefly, and in plain terms:

**M1 — desktop utility records search.** No site work. You're collating statutory undertaker records. It tells you what the utility companies believe they have, which is not the same as what is there. Records are frequently incomplete, and abandoned services rarely appear at all.

**M2 — EML and GPR, interpreted in real time on site.** Detection with electromagnetic location and ground penetrating radar, read as it's acquired. Good coverage, quick turnaround, no post-processing. What it gives up is the ability to go back over the data.

**M2P — the same detection on a 2 metre grid, post-processed off site.** Denser acquisition, and the radargrams get worked properly afterwards rather than judged on a screen in the rain. Better confidence, longer delivery, higher cost.

Two things worth being blunt about with clients, before the job rather than after.

GPR does not see everything. Plastic pipes with no tracer wire are frequently invisible to it — plastic sections and repairs interrupt the transmitted signal. And GPR will sometimes show you the trench rather than the individual services inside it, which is genuinely useful information but is not the same as locating each asset.

None of this is a failing of the survey. It's the physics. But if the first time a client hears it is in the meeting where you're explaining why something got struck, it will sound like an excuse instead of a specification.

Put the limitations in the report. Put them in the quote, ideally. The surveyors who do this get fewer arguments, not more.

### CTA
For the survey people: how much of your quoting conversation is spent managing expectations about what GPR can and can't see?

### Hashtags
#PAS128 #GPR #utilitysurvey #undergroundutilities #surveying

### Visual
**Carousel, 5 slides.** One slide per method (M1, M2, M2P) with what it evidences and what it doesn't. Slide 4: the two GPR limitations. Slide 5: a one-line summary. Clean typography, no photography.

---
---

# POST 7 — Permit types nobody else builds

**Persona:** rail, marine, aerial contractors · **Goal:** leads (small audience, very high intent)

### Hook
> If your permit system has a field for the coxswain's name, you didn't buy it off the shelf.

### Post

If your permit system has a field for the coxswain's name, you didn't buy it off the shelf.

Most permit software ships with the same six types. Hot work, confined space, work at height, electrical isolation, excavation, lifting. That covers a lot of construction and it covers none of the awkward edges, so everyone working on an edge does the same thing: takes the generic permit and writes the real information in the notes box.

Which means the field that actually matters — the one a court would ask about — is free text at the bottom of a form.

So these are native types, with their own fields:

**Rail corridor access.** Possession or access reference. PTS numbers for the lead and the team. COSS and lookout name.

**Marine and hydrographic works.** Vessel or craft name. Coxswain or master. The approved tide and weather window, as a field, because that window is the control.

**Aerial survey coordination.** Aircraft or UAV type. CAA operator ID and pilot licence. NOTAM and airspace clearance reference.

Also radiography, line break, valve isolation, roof access, night and out-of-hours, and line clearance with product isolation for anyone working in live food production.

None of these are big markets. That's rather the point. If you spend your working life in one of them, you've spent years bending a form designed for a housing site into something that describes a possession, and you have never once been the customer anyone was designing for.

The generic form is fine until the thing that keeps you alive doesn't have a field.

### CTA
Rail, marine and UAV people: what's the field your current system doesn't have?

### Hashtags
#permittowork #railsafety #marinesafety #UAV #healthandsafety

### Visual
**Carousel, 4 slides.** One slide per specialist permit type showing the actual fields as they appear in the app. The specificity is the entire argument — screenshot the real forms, don't mock them up.

---
---

# POST 8 — The bug that ate people's photos

**Persona:** all, especially technical · **Goal:** credibility + followers · **Build in public**

### Hook
> A sync loop in my code deleted photos that surveyors had already taken. Here's what happened.

### Post

A sync loop in my code deleted photos that surveyors had already taken. Here's what happened.

Geo-photos sync between the device and the server. Standard stuff: capture offline, upload when there's signal, reconcile. The reconciliation had a flaw that only showed up under a specific combination — poor connectivity, a partly completed upload, and the screen being open at the time.

What the user saw was the screen flickering. What was actually happening was the list rebuilding itself repeatedly, and in one path, a photo that existed locally but hadn't finished uploading got treated as deleted.

Photos taken on site. Not recoverable by going back, because the chamber's been closed and backfilled and the surveyor's forty miles away.

There is no good way to be relaxed about that one. Field data is not like other data. You cannot re-run it. The whole value of a site photo is that somebody stood in a specific place at a specific moment when the hole was open, and that moment does not come back.

What I changed, beyond the immediate fix: local media is now preserved through sync rather than trusting the reconciliation to be right. Duplicate detection stops the same capture being written twice. The sync banner tells you what state you're actually in instead of quietly doing things.

The broader lesson, which I already knew and clearly hadn't internalised: **destructive operations should be the hardest path in the code, not the default.** Deleting should require more certainty than keeping. My reconciliation logic assumed absence meant deleted, when absence usually just means not yet.

Everything soft-deletes to a recycle bin now. Sync uses tombstones instead of removal. It costs storage and it has already saved data twice.

Not a fun post to write. But if you're building anything that touches field capture, I'd rather you inherit the lesson than the bug.

### CTA
For anyone building offline-first: what's your rule for when a missing record means deleted rather than not-yet-synced?

### Hashtags
#buildinpublic #softwaredevelopment #offlinefirst #fieldwork

### Visual
**Text only.** Any image undermines the seriousness. If you want one, a screenshot of the actual commit message.

---
---

# POST 9 — Generic safety apps have never heard of an allergen changeover

**Persona:** food/pharma ops manager · **Goal:** leads (narrow, high conversion)

### Hook
> Construction safety software has never heard of an allergen changeover, and it shows.

### Post

Construction safety software has never heard of an allergen changeover, and it shows.

If you do mechanical or electrical work inside food factories, you already know your job isn't really a construction job. It's a hygiene job that happens to involve spanners.

The controls that decide whether you work are not the ones in a generic safety app. They're:

Line clearance and product isolation before you touch anything. CIP sign-off before the line goes back. Glass and hard plastic control, which every single factory runs slightly differently and all of them take extremely seriously. High care access, with its own rules about who crosses which line and what they're wearing. GMP deviations, recorded properly, because the client's quality team will ask. Allergen changeover, where getting it wrong isn't a safety incident, it's a product recall.

None of that is in the standard toolkit. So contractors end up running two systems: a safety app for the things the safety app understands, and a pile of spreadsheets the client made them use for everything that actually governs whether the line runs.

And the second pile is the one that stops the job.

I built registers for all of it — allergen changeover, CIP sign-off, GMP deviation, glass and hard plastic, high care access, water hygiene — because the contractors I know working in food plants were the ones with the most paperwork and the least software built for them.

There's a permit type for line clearance and product isolation too, with the production line, the isolation reference and the production manager's sign-off as actual fields rather than notes.

Small niche. Almost no competition for it. That's usually a sign nobody's bothered rather than a sign nobody needs it.

### CTA
If you work in food manufacturing engineering: what does your client make you track that no software supports?

### Hashtags
#foodmanufacturing #foodsafety #BRCGS #contractors #healthandsafety

### Visual
**Carousel, 3 slides.** Slide 1: the hook line. Slide 2: the six registers as they appear in the app. Slide 3: the line clearance permit fields. Screenshots, not illustrations.

---
---

# POST 10 — Deleted isn't gone

**Persona:** H&S manager · **Goal:** credibility

### Hook
> If someone can delete a permit and the record disappears, you don't have an audit trail. You have a filing system with a bin.

### Post

If someone can delete a permit and the record disappears, you don't have an audit trail. You have a filing system with a bin.

This distinction gets glossed over constantly, and it only matters on the one day it really matters.

An audit trail isn't a list of documents. It's the answer to a specific question asked by someone who is not on your side: what did this document say at the moment work started, and who changed it after that?

If the answer involves anyone's memory, you don't have one.

Three things that have to be true, and most systems get one or two:

**Deletion has to be recoverable.** Soft delete to a recycle bin. When it syncs, the record leaves a tombstone rather than vanishing, so a deletion on one device doesn't silently resurrect the record from another — or worse, propagate as a real removal.

**Every document has to know who touched it.** Created by, last edited by, on the record itself. Not in a separate log that can drift out of step with the thing it describes.

**The log has to be written by the system, not the user.** If logging an action is a thing someone chooses to do, it will be done inconsistently, and inconsistent logs are arguably worse than none — they create an appearance of completeness that isn't there.

None of this is exciting. Nobody has ever bought software because of a recycle bin. But it's the difference between being able to demonstrate what happened and being able to assert it, and under scrutiny those are not remotely the same position to be in.

Worth checking on whatever you currently use: delete something in a test project, then try to prove it existed.

### CTA
Have you ever had to reconstruct a document history after the fact? I'd like to know how that went.

### Hashtags
#healthandsafety #compliance #auditing #construction

### Visual
**Screenshot.** The audit log viewer with a delete and a restore visible in sequence, plus created-by and edited-by on a document. Redact any real names.

---
---

## Posting notes

**Order for the first month:** 1, 2, 5, 3, 6, 8, 4, 9, 7, 10.
Starts with the two highest-ceiling posts, alternates problem/education with build-in-public, keeps the narrow-niche posts (7, 9) for when the audience has grown enough for them to find their people.

**Timing:** Tuesday to Thursday, 07:00–09:00 UK. This audience reads LinkedIn before site or over the first brew.

**Comments:** reply to every one within the first two hours. LinkedIn weights early comment velocity heavily, and this audience will genuinely argue with you about permit conflicts — which is the best thing that can happen to reach.

**Do not** post the same content to Instagram unchanged. See `INSTAGRAM_POSTS.md`.
