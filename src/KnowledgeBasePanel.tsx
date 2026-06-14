import { useRef } from 'react';
import { BookOpen, Loader2, Upload } from 'lucide-react';
import type { CorpusDocument } from './api/corpus';

interface KnowledgeBasePanelProps {
  documents: CorpusDocument[];
  isUploading: boolean;
  uploadError: string | null;
  onUpload: (files: FileList) => void;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function KnowledgeBasePanel({
  documents,
  isUploading,
  uploadError,
  onUpload,
}: KnowledgeBasePanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFilePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files;
    if (!selected?.length) return;
    onUpload(selected);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="knowledge-base-panel">
      <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">
        <BookOpen size={14} />
        Knowledge Base
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden-file-input"
        accept=".pdf,.txt,.md,.docx"
        onChange={handleFilePick}
      />

      <button
        type="button"
        className="kb-upload-btn"
        onClick={() => fileInputRef.current?.click()}
        disabled={isUploading}
      >
        {isUploading ? (
          <Loader2 size={16} className="animate-spin" />
        ) : (
          <Upload size={16} />
        )}
        {isUploading ? 'Indexing…' : 'Upload documents'}
      </button>

      <p className="kb-upload-hint">PDF, TXT, MD, DOCX — indexed for Q&amp;A</p>

      {uploadError ? <p className="kb-upload-error">{uploadError}</p> : null}

      {documents.length > 0 ? (
        <ul className="kb-doc-list">
          {documents.map((doc) => (
            <li
              key={doc.id}
              className={`kb-doc-item kb-doc-${doc.status}`}
              title={doc.error ?? doc.displayName}
            >
              <span className="kb-doc-name">{doc.displayName}</span>
              <span className="kb-doc-meta">
                <span className={`kb-doc-status kb-doc-status-${doc.status}`}>
                  {doc.status}
                </span>
                <span className="kb-doc-size">{formatSize(doc.sizeBytes)}</span>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="kb-empty">No documents indexed yet</p>
      )}
    </div>
  );
}
