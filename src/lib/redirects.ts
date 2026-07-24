/**
 * Default redirect rules seeded into the database.
 *
 * These come straight from the `$redirects` array in the original
 * `server_dir/input.php`, so the migrated system behaves identically to the
 * server version on day one. The dashboard at `/` lets you add/edit/delete
 * rules at runtime without touching code.
 */
export interface SeedRedirect {
  articleId: string;
  targetUrl: string;
  note?: string;
}

export const DEFAULT_REDIRECTS: SeedRedirect[] = [
  { articleId: '4560', targetUrl: 'articles/1997.html', note: 'human -> 1997, bot -> 4560' },
  { articleId: '456', targetUrl: 'articles/1997.html', note: 'Rewrite 456: human -> 1997.html, bot -> 456.html (jobs SEO article)' },
  { articleId: '2002037', targetUrl: 'https://instagram-followerss.vercel.app', note: 'IG followers' },
  { articleId: '120140', targetUrl: 'https://instagram-followerss.vercel.app/', note: 'IG followers' },
  { articleId: '8900', targetUrl: 'https://jobss-two.vercel.app/', note: 'jobs (article 8900.html exists for bot)' },
  { articleId: '567', targetUrl: 'https://jobss-two.vercel.app/', note: 'jobs (article 567.html exists for bot)' },
  { articleId: '234', targetUrl: 'https://jobss-two.vercel.app/', note: 'jobs (article 234.html exists for bot)' },
  { articleId: '901', targetUrl: 'https://jobss-two.vercel.app/', note: 'jobs (article 901.html exists for bot)' },
  { articleId: '678', targetUrl: 'https://jobss-two.vercel.app/', note: 'jobs (article 678.html exists for bot)' },
  { articleId: '4563', targetUrl: 'https://us72.site/', note: 'jobs (article 4563.html MISSING — bot gets 404, human gets redirect to us72.site)' },
];
