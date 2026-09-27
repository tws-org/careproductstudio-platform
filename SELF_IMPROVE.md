Self-Improvement Step
IMPORTANT: You MUST complete this step before stopping.

Look back at your work in building this project, including any challenges you encountered, bugs you hit and feedback you received.
Identify the strengths and weaknesses.
Self-improvement: Update PROCESS.md to factor in your learnings so that your process is improved in the future.
Recursive self-improvement: Update this file SELF_IMPROVE.md so that you are more effective at self-improvement in the future.
IMPORTANT: You MUST include step 4, recursive self-improvement. Every time you run, this document should be taken to the next level based on your learnings.

## Self-Improvement Log

### 2026-09-26 — Engagement Platform Build

**Strengths:**
- Successfully scaffolded and deployed a complete Next.js + Supabase application
- Implemented RLS policies correctly from the start, including the waiver gate
- Built a de-identified view in the initial migration (not retrofitted)
- Implemented forced password change flow for security
- Applied brand identity consistently across all screens

**Weaknesses:**
- Provided SQL without checking CHECK constraint values first, causing failures
- Did not include LIMIT 1 in subqueries, causing "more than one row" errors when duplicates existed
- Provided SQL as a large batch instead of one query at a time, making debugging harder
- Did not anticipate that users would run INSERT statements multiple times after failures, creating duplicates
- Should have provided cleanup/fix SQL alongside the original INSERTs

**Learnings for next time:**
- Always verify CHECK constraints and allowed enum values before writing INSERT statements
- Always use LIMIT 1 in subqueries within INSERT statements
- Provide SQL one query at a time, not as a single batch
- Always include duplicate cleanup SQL when providing INSERT statements
- Test SQL locally (or in a staging environment) before giving it to users
- When a user reports an error, provide the exact fix SQL immediately rather than asking them to debug

**Process improvements made:**
- Updated PROCESS.md with detailed build phases and progress tracking
- Added self-improvement log to PROCESS.md
- Created this recursive self-improvement log
