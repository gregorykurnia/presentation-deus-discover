// Vercel Blob client uploads: the browser asks POST /api/upload for a token, then sends
// the file straight to Blob. The token only allows the kind's types and size, under
// UPLOAD_PREFIX, with a random suffix. ctx.blob = { handleUpload } (tests pass a fake).
import { handleUpload } from '@vercel/blob/client';
import { HttpError, requireRole } from './access.js';

export const UPLOAD_PREFIX = 'decks/deus-pitch/uploads/';
const MB = 1024 * 1024;

const RULES = {
  photo: { allowedContentTypes: ['image/jpeg', 'image/png', 'image/webp'], maximumSizeInBytes: 10 * MB },
  video: { allowedContentTypes: ['video/mp4'], maximumSizeInBytes: 200 * MB },
};

/** kind: 'photo' | 'video' -> { allowedContentTypes, maximumSizeInBytes }. Else 400. */
export function uploadRules(kind) {
  const rules = RULES[kind];
  if (!rules) throw new HttpError(400, 'Please use a JPG, PNG or WebP image (or an MP4 video).');
  return { allowedContentTypes: [...rules.allowedContentTypes], maximumSizeInBytes: rules.maximumSizeInBytes };
}

function checkPathname(pathname) {
  const name = typeof pathname === 'string' ? pathname.slice(UPLOAD_PREFIX.length) : '';
  if (!pathname?.startsWith?.(UPLOAD_PREFIX) || !name || name.includes('/') || name.includes('..')) {
    throw new HttpError(400, `Uploads go under ${UPLOAD_PREFIX}.`);
  }
}

/**
 * The token handshake, for editors and the owner only. request = { headers, body }, the
 * body being handleUpload's JSON event. The kind ('photo' | 'video') is the clientPayload.
 * No upload-completed callback is used, so only token requests are accepted.
 */
export async function handleBlobUpload(ctx, who, request) {
  await requireRole(ctx, who);
  const body = request?.body;
  if (body?.type !== 'blob.generate-client-token') throw new HttpError(400, 'Expected a client token request.');
  const blob = ctx.blob ?? { handleUpload };
  return blob.handleUpload({
    body,
    request,
    token: ctx.env.BLOB_READ_WRITE_TOKEN,
    onBeforeGenerateToken: async (pathname, clientPayload) => {
      checkPathname(pathname);
      return { ...uploadRules(clientPayload), addRandomSuffix: true };
    },
  });
}
