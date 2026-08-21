/**
 * Renders admin-authored body copy from `pages.content` / `blog_posts.content`.
 *
 * Deliberately plain text split into paragraphs on blank lines, NOT
 * `dangerouslySetInnerHTML`. Piping stored content straight into the DOM
 * would make the admin content editor a stored-XSS vector, and no
 * markdown renderer is a dependency of this project yet. Adding one (and
 * a sanitizer with it) is a real decision that belongs to its own module,
 * not a side effect of the SEO pass.
 */
export function RichText({ content }: { content: string | null }) {
  if (!content?.trim()) return null;

  const paragraphs = content
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean);

  return (
    <div className="flex flex-col gap-4 leading-relaxed text-muted-foreground">
      {paragraphs.map((paragraph, index) => (
        <p key={index} className="whitespace-pre-line">
          {paragraph}
        </p>
      ))}
    </div>
  );
}
