import React, { useState, useRef } from 'react';
import { X, Swords, Zap, Upload, Trash2, CheckCircle2, Loader2, Sparkles } from 'lucide-react';
import type { ParsedDocument } from '../types';

interface VersusModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmitDuel: (query: string, documentData?: ParsedDocument | null) => void;
}

const BACKEND_URL = 'http://127.0.0.1:8001';

const PRESETS = [
  { label: '☕ Coffee vs Matcha', a: 'Coffee', b: 'Matcha', ctx: 'for clean morning focus' },
  { label: '⚛️ Next.js vs Remix', a: 'Next.js', b: 'Remix', ctx: 'for a new web project' },
  { label: '🏡 Buy vs Rent', a: 'Buying a home', b: 'Renting', ctx: 'in the current market' },
  { label: '🏋️ Cardio vs Weights', a: 'Cardio', b: 'Weightlifting', ctx: 'for overall longevity' },
  { label: '🐱 Cats vs Dogs', a: 'Cats', b: 'Dogs', ctx: 'as apartment pets' },
  { label: '✈️ Tokyo vs Rome', a: 'Tokyo', b: 'Rome', ctx: 'for a 10-day vacation' },
];

const SAMPLE_DOCS = [
  {
    label: '📊 Load Sample Excel Sheet (Offer_Comparison.xlsx)',
    filename: 'offer_compensation_matrix.xlsx',
    file_type: 'xlsx',
    char_count: 360,
    word_count: 52,
    extracted_text: '### Sheet: Compensation & Benefits\n| Metric | Fintech Corp (Offer A) | HealthTech Scaleup (Offer B) |\n| --- | --- | --- |\n| Base Salary | $185,000 | $170,000 |\n| Annual Equity | $40,000 RSU | $75,000 ISO (High Upside) |\n| Work Model | Hybrid 3 days office | 100% Fully Remote |\n| 401(k) Match | 4% dollar-for-dollar | None |\n| Weekly On-Call | Every 4 weeks | None (Dedicated SRE) |',
    summary_snippets: [
      'Base Salary: $185,000 (Offer A) vs $170,000 (Offer B)',
      'Work Model: Hybrid 3 days office (Offer A) vs 100% Fully Remote (Offer B)',
      'Equity: $40,000 RSU vs $75,000 ISO high-growth potential'
    ],
    a: 'Fintech Corp (Offer A)',
    b: 'HealthTech Scaleup (Offer B)',
    ctx: 'for a Staff Engineer valuing remote flexibility and long-term equity'
  },
  {
    label: '📄 Load Cloud RFP Spec (AWS RDS vs Cloud SQL)',
    filename: 'cloud_architecture_rfp.txt',
    file_type: 'txt',
    char_count: 320,
    word_count: 45,
    extracted_text: 'Cloud Database Architecture Evaluation:\nAWS RDS Multi-AZ offers 99.99% SLA with automated failover at $450/month.\nGoogle Cloud SQL provides automated storage expansion and high IOPS at $380/month.\nFor early-stage startups with lean DevOps, Cloud SQL reduces operational complexity.',
    summary_snippets: [
      'AWS RDS Multi-AZ offers 99.99% SLA with automated failover at $450/month.',
      'Google Cloud SQL provides automated storage expansion and high IOPS at $380/month.',
      'For early-stage startups with lean DevOps, Cloud SQL reduces operational complexity.'
    ],
    a: 'Google Cloud SQL',
    b: 'AWS RDS',
    ctx: 'for our seed-stage startup with 2 engineers'
  }
];

export const VersusModal: React.FC<VersusModalProps> = ({
  isOpen,
  onClose,
  onSubmitDuel,
}) => {
  const [optionA, setOptionA] = useState('');
  const [optionB, setOptionB] = useState('');
  const [context, setContext] = useState('');
  const [attachedDoc, setAttachedDoc] = useState<ParsedDocument | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!optionA.trim() || !optionB.trim()) return;

    let query = `${optionA.trim()} vs ${optionB.trim()}`;
    if (context.trim()) {
      query += ` for ${context.trim()}`;
    }

    onSubmitDuel(query, attachedDoc);
    onClose();
  };

  const handleApplyPreset = (preset: typeof PRESETS[0]) => {
    setOptionA(preset.a);
    setOptionB(preset.b);
    setContext(preset.ctx);
  };

  const handleApplySampleDoc = (sample: typeof SAMPLE_DOCS[0]) => {
    setOptionA(sample.a);
    setOptionB(sample.b);
    setContext(sample.ctx);
    setAttachedDoc({
      filename: sample.filename,
      file_type: sample.file_type,
      char_count: sample.char_count,
      word_count: sample.word_count,
      extracted_text: sample.extracted_text,
      summary_snippets: sample.summary_snippets,
    });
    setParseError(null);
  };

  const handleFileProcess = async (file: File) => {
    try {
      setIsParsing(true);
      setParseError(null);

      const formData = new FormData();
      formData.append('file', file);
      if (optionA.trim()) formData.append('option_a', optionA.trim());
      if (optionB.trim()) formData.append('option_b', optionB.trim());

      const res = await fetch(`${BACKEND_URL}/api/documents/parse`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        throw new Error(`Server returned ${res.status}: ${res.statusText}`);
      }

      const data: ParsedDocument = await res.json();
      setAttachedDoc(data);
    } catch (err: any) {
      console.error('Document parse failed:', err);
      setParseError(err.message || 'Failed to parse document. Please check the file.');
    } finally {
      setIsParsing(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileProcess(e.target.files[0]);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileProcess(e.dataTransfer.files[0]);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="versus-modal-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div className="modal-title-group">
            <Swords className="modal-icon-swords" size={20} />
            <h2 className="modal-title">Versus Duel Builder</h2>
            <span className="modal-tag">LAYA + DOC GROUNDING</span>
          </div>
          <button
            className="modal-close-btn"
            onClick={onClose}
            title="Close"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="versus-form">
          <p className="versus-subtitle">
            Pit any two options against each other. Attach a document (PDF, DOCX, TXT, CSV) to ground Laya's decision in your specific data and constraints.
          </p>

          <div className="versus-duel-row">
            <div className="versus-input-box">
              <label className="versus-label">OPTION A</label>
              <input
                id="versus-option-a"
                type="text"
                className="versus-input"
                placeholder="e.g. Google Cloud SQL"
                value={optionA}
                onChange={(e) => setOptionA(e.target.value)}
                autoFocus
              />
            </div>

            <div className="versus-badge-divider">
              <span>VS</span>
            </div>

            <div className="versus-input-box">
              <label className="versus-label">OPTION B</label>
              <input
                id="versus-option-b"
                type="text"
                className="versus-input"
                placeholder="e.g. AWS RDS"
                value={optionB}
                onChange={(e) => setOptionB(e.target.value)}
              />
            </div>
          </div>

          <div className="versus-context-box">
            <label className="versus-label">DECISION CONTEXT (OPTIONAL)</label>
            <input
              id="versus-context"
              type="text"
              className="versus-input context-input"
              placeholder="e.g. for a seed-stage startup with 2 engineers and tight budget"
              value={context}
              onChange={(e) => setContext(e.target.value)}
            />
          </div>

          {/* Document Attachment & Parser Section */}
          <div className="doc-attach-section">
            <div className="doc-section-header">
              <span className="versus-label">ATTACH GROUNDING SPREADSHEET / DOCUMENT (OPTIONAL)</span>
              <span className="doc-supported-tags">EXCEL (.xlsx, .csv) • PDF • DOCX • TXT • JSON</span>
            </div>

            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".xlsx,.xls,.xlsm,.csv,.tsv,.pdf,.docx,.doc,.txt,.md,.markdown,.json,.log"
              style={{ display: 'none' }}
              id="versus-file-input"
            />

            {isParsing ? (
              <div className="doc-parsing-box">
                <Loader2 size={18} className="spinning" />
                <span>Parsing spreadsheet / document with openpyxl & pdfplumber...</span>
              </div>
            ) : attachedDoc ? (
              <div className="doc-attached-card">
                <div className="doc-card-info">
                  <div className="doc-card-top">
                    <CheckCircle2 size={16} className="doc-icon-success" />
                    <span className="doc-filename">{attachedDoc.filename}</span>
                    <span className="doc-type-pill">{attachedDoc.file_type.toUpperCase()}</span>
                    <span className="doc-words-pill">{attachedDoc.word_count} words</span>
                  </div>
                  {attachedDoc.summary_snippets && attachedDoc.summary_snippets.length > 0 && (
                    <div className="doc-snippet-preview">
                      <span className="doc-snippet-label">Sample Extracted Context:</span>
                      <p className="doc-snippet-text">"{attachedDoc.summary_snippets[0]}"</p>
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  className="doc-remove-btn"
                  onClick={() => setAttachedDoc(null)}
                  title="Remove attached document"
                >
                  <Trash2 size={14} />
                  <span>Remove</span>
                </button>
              </div>
            ) : (
              <div
                className={`doc-dropzone ${isDragOver ? 'drag-over' : ''}`}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragOver(true);
                }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={handleDrop}
              >
                <Upload size={20} className="dropzone-icon" />
                <div className="dropzone-text">
                  <strong>Click to upload</strong> or drag and drop spreadsheet (Excel, CSV) or document (PDF, Word, TXT)
                </div>
                <div className="dropzone-sub">
                  Supports Excel spreadsheets (.xlsx, .csv), compensation tables, RFP proposals, technical specs, or contracts
                </div>
              </div>
            )}

            {parseError && <div className="doc-error-banner">{parseError}</div>}
          </div>

          {/* Quick Presets & Sample Document */}
          <div className="versus-presets-section">
            <div className="presets-top-row" style={{ flexWrap: 'wrap', gap: '6px' }}>
              <span className="presets-label">QUICK PRESETS:</span>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  id="sample-excel-preset-btn"
                  className="sample-doc-preset-btn"
                  onClick={() => handleApplySampleDoc(SAMPLE_DOCS[0])}
                  title="Auto-fill options and load sample Excel compensation spreadsheet"
                >
                  <Sparkles size={12} style={{ marginRight: 4 }} />
                  <span>📊 Load Sample Excel Sheet</span>
                </button>
                <button
                  type="button"
                  id="sample-rfp-preset-btn"
                  className="sample-doc-preset-btn"
                  onClick={() => handleApplySampleDoc(SAMPLE_DOCS[1])}
                  title="Auto-fill options and load sample RFP text document"
                >
                  <Sparkles size={12} style={{ marginRight: 4 }} />
                  <span>📄 Load Cloud RFP Spec</span>
                </button>
              </div>
            </div>
            <div className="presets-grid">
              {PRESETS.map((p, idx) => (
                <button
                  type="button"
                  key={idx}
                  className="preset-chip"
                  onClick={() => handleApplyPreset(p)}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="btn-cancel"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              id="submit-versus-duel-btn"
              type="submit"
              className="btn-duel-submit"
              disabled={!optionA.trim() || !optionB.trim() || isParsing}
            >
              <Zap size={15} style={{ marginRight: 6 }} />
              <span>{attachedDoc ? 'Decide with Document Grounding' : 'Decide Duel (Laya Fast Path)'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
