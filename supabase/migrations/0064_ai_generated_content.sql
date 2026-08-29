-- Module 40 — marking content an AI drafted.
--
-- Master Build Plan 12B.12 requires that "content that an AI drafted is
-- marked as AI-generated", that it "follows draft -> review -> approve ->
-- publish", and that it "is never presented as human-authored".
--
-- NOTHING IMPLEMENTED ANY OF IT. There was no marking column anywhere in
-- the schema, and `blog_posts` and `pages` carry two states — draft and
-- published — not four. The rule existed only as a sentence in the plan.
--
-- WHAT THIS MIGRATION DOES, and deliberately does not do. It adds the
-- MARKING, because that is the half with no honest workaround: without a
-- column, AI-drafted copy is indistinguishable from a person's, which is
-- exactly what 12B.12 forbids. It does NOT add `review` and `approved`
-- states. Those need a screen for a human to approve on, and inventing
-- two states that no interface can move a record out of would leave AI
-- drafts stranded in a status nobody can clear — worse than the gap.
--
-- The rule is enforced instead by the tool that writes: it can only ever
-- create a DRAFT, and no MCP tool can publish content. So "automatic
-- publication of AI-written copy is not permitted" holds, and the human
-- publish action in /admin/content IS the approval step. The missing
-- intermediate states are recorded as a limitation in 12B.14 rather than
-- faked here.

alter table public.blog_posts
  -- Not nullable, defaulting false: an unmarked row must mean "a person
  -- wrote this", not "nobody recorded who". A nullable column would make
  -- every pre-existing post an open question.
  add column ai_generated boolean not null default false,
  -- Kept separate from created_at, which is when the ROW appeared. These
  -- differ whenever a draft is written now and edited later, and "when
  -- was this drafted by an AI" is the question an audit asks.
  add column ai_generated_at timestamptz;

alter table public.pages
  add column ai_generated boolean not null default false,
  add column ai_generated_at timestamptz;

-- Readable by anyone who can already read the row. The marking is not a
-- secret — the point of 12B.12 is disclosure, and a flag only admins can
-- see cannot support "never presented as human-authored" on a public
-- page. No new policy is needed: both tables' existing SELECT policies
-- cover every column, and adding a column does not narrow them.

comment on column public.blog_posts.ai_generated is
  'Module 40: true when an AI drafted this post through MCP. 12B.12 requires the marking and forbids automatic publication; content_draft_blog_post can only create drafts.';

comment on column public.pages.ai_generated is
  'Module 40: true when an AI drafted this page through MCP. See blog_posts.ai_generated.';
