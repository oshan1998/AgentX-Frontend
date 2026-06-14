export interface UploadedFile {
  path: string;
  sizeBytes: number;
  originalName: string;
}

export async function uploadSessionFile(
  sessionId: string,
  file: File,
): Promise<UploadedFile> {
  const form = new FormData();
  form.append("file", file);

  const res = await fetch(`/api/session/${encodeURIComponent(sessionId)}/files`, {
    method: "POST",
    body: form,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Upload failed (${res.status})`);
  }

  return data.file as UploadedFile;
}

export async function listSessionUploads(
  sessionId: string,
): Promise<Array<{ path: string; name: string; sizeBytes: number }>> {
  const res = await fetch(`/api/session/${encodeURIComponent(sessionId)}/files`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `List failed (${res.status})`);
  }
  return data.files ?? [];
}
