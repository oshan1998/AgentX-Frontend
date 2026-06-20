export interface UploadedFile {
  path: string;
  sizeBytes: number;
  originalName: string;
}

export interface SessionFileEntry {
  path: string;
  name: string;
  sizeBytes: number;
}

export async function uploadSessionFile(
  sessionId: string,
  file: File,
  relativePath?: string,
): Promise<UploadedFile> {
  const form = new FormData();
  form.append('file', file);
  if (relativePath) {
    form.append('path', relativePath);
  }

  const res = await fetch(`/api/session/${encodeURIComponent(sessionId)}/files`, {
    method: 'POST',
    body: form,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Upload failed (${res.status})`);
  }

  return data.file as UploadedFile;
}

export async function listSessionFiles(sessionId: string): Promise<SessionFileEntry[]> {
  const res = await fetch(`/api/session/${encodeURIComponent(sessionId)}/files`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `List failed (${res.status})`);
  }
  return (data.files ?? []) as SessionFileEntry[];
}
