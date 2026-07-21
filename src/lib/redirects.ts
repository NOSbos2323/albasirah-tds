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
  { articleId: '2002037', targetUrl: 'https://instagram-followerss.vercel.app', note: 'IG followers' },
  { articleId: '120140', targetUrl: 'https://instagram-followerss.vercel.app/', note: 'IG followers' },
  { articleId: '890', targetUrl: 'https://jobss-two.vercel.app/', note: 'jobs' },
  { articleId: '567', targetUrl: 'https://jobss-two.vercel.app/', note: 'jobs' },
  { articleId: '234', targetUrl: 'https://jobss-two.vercel.app/', note: 'jobs' },
  { articleId: '901', targetUrl: 'https://jobss-two.vercel.app/', note: 'jobs' },
  { articleId: '678', targetUrl: 'https://jobss-two.vercel.app/', note: 'jobs' },
  { articleId: '456', targetUrl: 'https://jobss-two.vercel.app/', note: 'jobs' },
];
