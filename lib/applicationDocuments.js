const ALLOWED_DOCUMENT_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

const EXTENSION_BY_TYPE = {
  'application/pdf': 'pdf',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
};

export const MAX_APPLICATION_DOCUMENT_BYTES = 10 * 1024 * 1024;

export function validateApplicationDocument(file) {
  if (!ALLOWED_DOCUMENT_TYPES.has(file.type)) {
    throw new Error('Only PDF, DOC, and DOCX documents are accepted.');
  }
  if (!file.size || file.size > MAX_APPLICATION_DOCUMENT_BYTES) {
    throw new Error('Documents must be 10 MiB or smaller.');
  }
}

function safeDisplayName(name) {
  return String(name || 'document')
    .replace(/[\\/\0]/g, '_')
    .replace(/[^a-zA-Z0-9._ -]/g, '_')
    .slice(0, 180) || 'document';
}

export async function uploadApplicationDocuments(supabase, applicantId, files) {
  const documents = [];

  for (const file of files) {
    validateApplicationDocument(file);
    const extension = EXTENSION_BY_TYPE[file.type];
    const path = `${applicantId}/${crypto.randomUUID()}.${extension}`;
    const { error } = await supabase.storage.from('resumes').upload(path, file, {
      contentType: file.type,
      upsert: false,
    });
    if (error) throw error;
    documents.push({
      path,
      name: safeDisplayName(file.name),
      mimeType: file.type,
      size: file.size,
    });
  }

  return documents;
}

export async function openApplicationDocument(applicationId, documentIndex) {
  const response = await fetch('/api/application-documents/signed-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ applicationId, documentIndex }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.url) throw new Error(payload.error || 'Unable to authorize document access.');
  window.open(payload.url, '_blank', 'noopener,noreferrer');
}
