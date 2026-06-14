export type DocumentIndexStatus = "pending" | "ready" | "failed";

export interface CorpusDocument {
  id: string;
  displayName: string;
  originalName: string;
  gcsUri: string;
  status: DocumentIndexStatus;
  indexedAt: string;
  sizeBytes: number;
  error?: string;
}

export async function uploadCorpusDocument(
  file: File,
  displayName?: string,
): Promise<CorpusDocument> {
  const form = new FormData();
  form.append("file", file);
  if (displayName) form.append("displayName", displayName);

  const res = await fetch("/api/corpus/documents", {
    method: "POST",
    body: form,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Upload failed (${res.status})`);
  }

  return data.document as CorpusDocument;
}

export async function listCorpusDocuments(): Promise<CorpusDocument[]> {
  const res = await fetch("/api/corpus/documents");
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `List failed (${res.status})`);
  }
  return data.documents ?? [];
}
