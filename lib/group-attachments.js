export const GROUP_ATTACHMENT_BUCKET = 'group-message-attachments';
export const MAX_ATTACHMENTS = 5;
export const TUS_THRESHOLD = 6 * 1024 * 1024;
export const IMAGE_LIMIT = 10 * 1024 * 1024;
export const DOCUMENT_LIMIT = 25 * 1024 * 1024;

export const ALLOWED_FILE_TYPES = new Map([
  ['image/jpeg', 'image'], ['image/png', 'image'], ['image/webp', 'image'],
  ['application/pdf', 'document'],
  ['application/msword', 'document'],
  ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'document'],
  ['application/vnd.ms-excel', 'document'],
  ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'document'],
  ['application/vnd.ms-powerpoint', 'document'],
  ['application/vnd.openxmlformats-officedocument.presentationml.presentation', 'document'],
  ['text/plain', 'document'],
]);

const FILE_EXTENSION_RULES = new Map([
  ['image/jpeg', /\.jpe?g$/i], ['image/png', /\.png$/i], ['image/webp', /\.webp$/i],
  ['application/pdf', /\.pdf$/i], ['application/msword', /\.doc$/i],
  ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', /\.docx$/i],
  ['application/vnd.ms-excel', /\.xls$/i],
  ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', /\.xlsx$/i],
  ['application/vnd.ms-powerpoint', /\.ppt$/i],
  ['application/vnd.openxmlformats-officedocument.presentationml.presentation', /\.pptx$/i],
  ['text/plain', /\.txt$/i],
]);

export function formatBytes(value) {
  if (!Number.isFinite(value)) return 'Unknown size';
  if (value < 1024) return `${value} B`;
  if (value < 1024 ** 2) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 ** 2).toFixed(1)} MB`;
}

export function normalizeExternalUrl(value) {
  let parsed;
  try {
    parsed = new URL(value.trim());
  } catch {
    throw new Error('Enter a valid YouTube or Vimeo link.');
  }
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password) throw new Error('Enter a valid YouTube or Vimeo link.');
  parsed.hash = '';
  const host = parsed.hostname.toLowerCase();
  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)?.slice(1).map(Number);
  const privateIpv4 = ipv4 && ipv4.every(part => part <= 255) && (
    ipv4[0] === 0 || ipv4[0] === 10 || ipv4[0] === 127 ||
    (ipv4[0] === 169 && ipv4[1] === 254) ||
    (ipv4[0] === 172 && ipv4[1] >= 16 && ipv4[1] <= 31) ||
    (ipv4[0] === 192 && ipv4[1] === 168)
  );
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') ||
      privateIpv4 || host === '[::1]' || host.startsWith('[fc') || host.startsWith('[fd') || host.startsWith('[fe80:')) {
    throw new Error('Enter a valid YouTube or Vimeo link.');
  }
  let attachmentType;
  if (host === 'youtu.be' || host === 'youtube.com' || host.endsWith('.youtube.com')) attachmentType = 'youtube';
  if (host === 'vimeo.com' || host.endsWith('.vimeo.com')) attachmentType = 'vimeo';
  if (!attachmentType) throw new Error('Enter a valid YouTube or Vimeo link.');
  const canonical = parsed.toString();
  if (canonical.length > 2048) throw new Error('Enter a valid YouTube or Vimeo link.');
  return { attachmentType, canonical, title: host.slice(0, 300) };
}

export function validateFile(file) {
  const attachmentType = ALLOWED_FILE_TYPES.get(file.type);
  if (!attachmentType) throw new Error(`${file.name}: unsupported file type.`);
  if (!file.name || file.name.length > 255) throw new Error('Filename must be between 1 and 255 characters.');
  const extensionAllowed = FILE_EXTENSION_RULES.get(file.type)?.test(file.name);
  if (!extensionAllowed) throw new Error(`${file.name}: filename extension does not match its approved type.`);
  const limit = attachmentType === 'image' ? IMAGE_LIMIT : DOCUMENT_LIMIT;
  if (!file.size || file.size > limit) throw new Error(`${file.name}: maximum size is ${formatBytes(limit)}.`);
  return attachmentType;
}

export function mergeMessage(current, incoming) {
  if (!incoming || incoming.delivery_status && incoming.delivery_status !== 'published') return current;
  const index = current.findIndex(message => message.id === incoming.id);
  if (index < 0) return [...current, incoming].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  const next = [...current];
  next[index] = { ...next[index], ...incoming };
  return next;
}

export function youtubeEmbedUrl(value) {
  try {
    const url = new URL(value);
    let id = url.hostname === 'youtu.be' ? url.pathname.slice(1) : url.searchParams.get('v');
    if (!id && url.pathname.startsWith('/shorts/')) id = url.pathname.split('/')[2];
    return /^[\w-]{6,20}$/.test(id || '') ? `https://www.youtube-nocookie.com/embed/${id}` : null;
  } catch { return null; }
}

export function vimeoEmbedUrl(value) {
  try {
    const id = new URL(value).pathname.split('/').filter(Boolean).findLast(part => /^\d+$/.test(part));
    return id ? `https://player.vimeo.com/video/${id}` : null;
  } catch { return null; }
}
