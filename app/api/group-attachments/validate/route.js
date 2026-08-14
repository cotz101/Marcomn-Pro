import { isIP } from 'node:net';
import { lookup } from 'node:dns/promises';
import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase-server';

const blockedIp = (address) => {
  if (isIP(address) === 4) {
    const [a, b] = address.split('.').map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
  }
  return address === '::1' || address === '::' || address.toLowerCase().startsWith('fc') || address.toLowerCase().startsWith('fd') || address.toLowerCase().startsWith('fe80:');
};

const OPEN_XML_TYPES = new Map([
  ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'word/document.xml'],
  ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'xl/workbook.xml'],
  ['application/vnd.openxmlformats-officedocument.presentationml.presentation', 'ppt/presentation.xml'],
]);
const OLE_TYPES = new Map([
  ['application/msword', { category: 'word', marker: 'WordDocument' }],
  ['application/vnd.ms-excel', { category: 'excel', marker: 'Workbook' }],
  ['application/vnd.ms-powerpoint', { category: 'powerpoint', marker: 'PowerPoint Document' }],
]);

function zipEntryNames(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const decoder = new TextDecoder('utf-8', { fatal: true });
  const names = [];
  for (let offset = 0; offset + 46 <= bytes.length;) {
    if (view.getUint32(offset, true) !== 0x02014b50) { offset += 1; continue; }
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const end = offset + 46 + nameLength + extraLength + commentLength;
    if (!nameLength || end > bytes.length || names.length >= 1000) throw new Error('Office ZIP directory is malformed.');
    names.push(decoder.decode(bytes.slice(offset + 46, offset + 46 + nameLength)));
    offset = end;
  }
  return names;
}

function inspectBytes(bytes, declaredMime) {
  const starts = (...values) => values.every((value, index) => bytes[index] === value);
  let detected = null;
  const evidence = {};
  if (starts(0xff, 0xd8, 0xff)) detected = 'image/jpeg';
  else if (starts(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) detected = 'image/png';
  else if (starts(0x52, 0x49, 0x46, 0x46) && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP') detected = 'image/webp';
  else if (String.fromCharCode(...bytes.slice(0, 5)) === '%PDF-') detected = 'application/pdf';
  else if (OPEN_XML_TYPES.has(declaredMime) && starts(0x50, 0x4b, 0x03, 0x04)) {
    const names = zipEntryNames(bytes);
    const expected = OPEN_XML_TYPES.get(declaredMime);
    const hasMacros = names.some(name => /(^|\/)(vbaProject\.bin|_VBA_PROJECT|Macros)(\/|$)/i.test(name));
    if (names.includes('[Content_Types].xml') && names.includes(expected) && !hasMacros) {
      detected = declaredMime; evidence.office_container_valid = true;
    }
  } else if (OLE_TYPES.has(declaredMime) && starts(0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1)) {
    const headerValid = bytes.length >= 512 && bytes[0x1c] === 0xfe && bytes[0x1d] === 0xff
      && ((bytes[0x1e] === 9 && bytes[0x1f] === 0) || (bytes[0x1e] === 12 && bytes[0x1f] === 0));
    const compoundText = new TextDecoder('utf-16le').decode(bytes);
    const expected = OLE_TYPES.get(declaredMime);
    const markerValid = compoundText.includes(expected.marker)
      || (expected.category === 'excel' && compoundText.includes('Book'));
    const hasMacros = /VBA|_VBA_PROJECT|Macros/i.test(compoundText);
    if (headerValid && markerValid && !hasMacros) {
      detected = declaredMime; evidence.ole_compound_valid = true; evidence.detected_document_category = expected.category;
    }
  } else if (declaredMime === 'text/plain') {
    const noNulls = !bytes.includes(0);
    const controlsSafe = bytes.every(value => value >= 0x20 || value === 0x09 || value === 0x0a || value === 0x0d);
    try {
      new TextDecoder('utf-8', { fatal: true }).decode(bytes);
      if (noNulls && controlsSafe) { detected = 'text/plain'; evidence.plain_text_valid = true; }
    } catch { detected = null; }
  }
  return { detected, magicBytesValid: detected === declaredMime, ...evidence };
}

export async function POST(request) {
  try {
    const { attachmentId } = await request.json();
    if (!attachmentId) return NextResponse.json({ error: 'Attachment id is required.' }, { status: 400 });
    const userClient = await createClient();
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    const service = createServiceClient();
    const { data: candidate, error } = await service
      .rpc('get_group_attachment_validation_candidate', {
        p_attachment_id: attachmentId,
        p_requesting_user_id: user.id,
      })
      .maybeSingle();
    if (error || !candidate) return NextResponse.json({ error: 'Attachment unavailable.' }, { status: 404 });
    let actualMime = null, actualSize = null, sha256 = null, inspection;
    if (candidate.attachment_type === 'image' || candidate.attachment_type === 'document') {
      const { data: object, error: downloadError } = await service.storage.from(candidate.storage_bucket).download(candidate.storage_path);
      if (downloadError || !object) throw new Error('Uploaded object could not be inspected.');
      const bytes = new Uint8Array(await object.arrayBuffer());
      const evidence = inspectBytes(bytes, candidate.declared_mime_type);
      if (!evidence.magicBytesValid) throw new Error('File content does not match its approved type.');
      actualMime = candidate.declared_mime_type; actualSize = bytes.byteLength;
      sha256 = createHash('sha256').update(bytes).digest('hex');
      inspection = { safe: true, magic_bytes_valid: true, ...evidence };
    } else {
      const url = new URL(candidate.external_url);
      if (url.protocol !== 'https:' || url.username || url.password || url.hostname === 'localhost') throw new Error('External URL is not safe.');
      const host = url.hostname.toLowerCase();
      const approvedHost = candidate.attachment_type === 'youtube'
        ? host === 'youtu.be' || host === 'youtube.com' || host.endsWith('.youtube.com')
        : candidate.attachment_type === 'vimeo' && (host === 'vimeo.com' || host.endsWith('.vimeo.com'));
      if (!approvedHost) throw new Error('Only YouTube and Vimeo links are supported.');
      const addresses = await lookup(url.hostname, { all: true, verbatim: true });
      if (!addresses.length || addresses.some(({ address }) => blockedIp(address))) throw new Error('External URL resolves to a prohibited network.');
      inspection = { safe: true, canonical_url: url.toString(), ssrf_safe: true };
    }
    const { error: readyError } = await service.rpc('mark_group_message_attachment_ready', {
      p_attachment_id: candidate.attachment_id, p_actual_mime_type: actualMime, p_actual_byte_size: actualSize,
      p_content_sha256: sha256, p_inspection_metadata: inspection, p_inspector: 'phase-1.3c-server-validator-v1'
    });
    if (readyError) throw readyError;
    return NextResponse.json({ ready: true });
  } catch (error) {
    return NextResponse.json({ error: error.message || 'Attachment validation failed.' }, { status: 422 });
  }
}
