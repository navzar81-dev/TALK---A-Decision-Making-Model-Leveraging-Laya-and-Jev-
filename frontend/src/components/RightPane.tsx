import React, { useState } from 'react';
import type { VisualPayload, LayaDecisionResult, LayaFramedQuestion, Stage2Telemetry } from '../types';
import {
  ChevronRight,
  ShieldAlert,
  CheckCircle2,
  ExternalLink,
  Filter,
  Activity,
  Check,
  Copy,
  Download,
  Sparkles,
  Zap
} from 'lucide-react';
import { downloadDecisionCard } from '../utils/cardExporter';

interface RightPaneProps {
  isOpen: boolean;
  onClose: () => void;
  payload: VisualPayload | null;
  layaResult?: LayaDecisionResult | null;
  framedQuestion?: LayaFramedQuestion | null;
  telemetry?: Stage2Telemetry | null;
  totalLatencyMs?: number;
}

export const RightPane: React.FC<RightPaneProps> = ({
  isOpen,
  onClose,
  payload,
  layaResult,
  framedQuestion,
  telemetry,
  totalLatencyMs,
}) => {
  const [copied, setCopied] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  if (!isOpen || !payload) return null;

  const isHedged = layaResult ? layaResult.hedged : payload.confidence < 0.85;
  const confPercent = Math.round((layaResult?.confidence || payload.confidence) * 100);
  const flavor = payload.verdict_flavor || layaResult?.verdict_flavor || (confPercent >= 90 ? 'Absolute No-Brainer' : confPercent >= 75 ? 'Decisive Winner' : 'Close Call');
  const pillars = payload.reasoning_pillars || layaResult?.reasoning_pillars || [];
  const isFastPath = telemetry?.decision_path === 'laya_fast_path';

  const handleCopyCard = () => {
    const textLines = [
      `⚡ TALK DECISION: ${payload.decision_badge} (${confPercent}% Calibrated - ${flavor})`,
      `Question: ${payload.title}`,
      `Verdict: ${payload.summary}`,
    ];
    if (pillars.length > 0) {
      textLines.push('\nWhy Laya Decided This:');
      pillars.forEach((p) => textLines.push(`• ${p}`));
    }
    navigator.clipboard.writeText(textLines.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleExportImage = async () => {
    try {
      setIsExporting(true);
      await downloadDecisionCard(payload, layaResult);
    } catch (e) {
      console.error('Failed to export decision badge:', e);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <aside id="right-decision-pane" className="right-pane-container">
      <div className="right-pane-header">
        <div className="header-badge-group">
          <span className={`badge-category ${isFastPath ? 'badge-fast-path' : ''}`}>
            {isFastPath ? <Zap size={11} style={{ marginRight: 4, display: 'inline' }} /> : null}
            {isFastPath ? '⚡ LAYA SYSTEM 1 (<50ms)' : '🌐 CLOUD RESEARCH (SYSTEM 2)'}
          </span>
          <span className={`badge-status ${isHedged ? 'hedged' : 'calibrated'}`}>
            {isHedged ? <ShieldAlert size={13} /> : <CheckCircle2 size={13} />}
            {flavor.toUpperCase()} ({confPercent}%)
          </span>
        </div>
        <button id="close-right-pane-btn" className="close-btn" onClick={onClose} title="Dismiss visual pane">
          <ChevronRight size={18} />
        </button>
      </div>

      <div className="right-pane-content">
        {/* Title and Framed Context */}
        <div className="decision-title-block">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
            <h2 className="decision-title">{payload.title}</h2>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <button
                id="copy-decision-card-btn"
                onClick={handleCopyCard}
                className="copy-card-btn"
                title="Copy formatted decision card"
              >
                {copied ? <Check size={13} /> : <Copy size={13} />}
                <span>{copied ? 'Copied!' : 'Share Text'}</span>
              </button>
              <button
                id="export-decision-badge-btn"
                onClick={handleExportImage}
                className="copy-card-btn export-badge-btn"
                title="Download high-resolution decision badge PNG"
                disabled={isExporting}
              >
                <Download size={13} />
                <span>{isExporting ? 'Exporting...' : 'Export Badge'}</span>
              </button>
            </div>
          </div>
          {payload.subtitle && <p className="decision-subtitle">{payload.subtitle}</p>}
        </div>

        {/* Shortlist Alert Banner if High-Cardinality Filter Applied */}
        {framedQuestion?.shortlist_applied && (
          <div className="shortlist-banner">
            <Filter size={15} className="shortlist-icon" />
            <div className="shortlist-text">
              <strong>High-Cardinality Filter:</strong> Coarse-ranked from{' '}
              {framedQuestion.initial_options_count || '20+'} candidates down to top{' '}
              {framedQuestion.options?.length || 5} for calibrated fine-scoring.
            </div>
          </div>
        )}

        {/* Highlight Winner Banner - Clean, Simple, Majestic (No Crown) */}
        <div className={`decision-banner ${isHedged ? 'banner-hedged' : 'banner-confident'}`}>
          <div className="banner-header-row">
            <span className="verdict-tag-label">{isHedged ? 'PROBABILISTIC ARBITRATION' : 'CALIBRATED VERDICT'}</span>
            <span className="banner-flavor-pill">{flavor}</span>
          </div>

          {payload.basis_name && (
            <div className="banner-basis-pill" title={`Arbitrated under '${payload.basis_name}' basis`}>
              <span className="basis-icon">⚖️</span>
              <span className="basis-label">ARBITRATION BASIS:</span>
              <span className="basis-value">{payload.basis_name}</span>
            </div>
          )}

          <h3 className="banner-winner-title">{payload.decision_badge}</h3>

          <div className="banner-certainty-badge">
            <span className="certainty-num">{confPercent}%</span>
            <span className="certainty-dot">•</span>
            <span className="certainty-label">{isHedged ? 'Calibrated Lead' : 'Statistical Majority'}</span>
          </div>

          <p className="banner-explanation">{payload.summary}</p>

          {/* Precision Arcometer Calibration Bar */}
          <div className="arcometer-container">
            <div className="arcometer-header">
              <span>CALIBRATED PROBABILITY</span>
              <span className="arcometer-val">{(confPercent / 100).toFixed(3)} / 1.000</span>
            </div>
            <div className="arcometer-bar-wrapper">
              <div className="arcometer-fill" style={{ width: `${confPercent}%` }} />
            </div>
            <div className="arcometer-ticks">
              <span>0%</span>
              <span>25%</span>
              <span>50%</span>
              <span>75%</span>
              <span className="arcometer-active-tick">{confPercent}%</span>
              <span>100%</span>
            </div>
          </div>
        </div>

        {/* "Why Laya Picked This" (xyz Reasoning Pillars) */}
        {pillars.length > 0 && (
          <div className="reasoning-pillars-card">
            <div className="pillars-header">
              <Sparkles size={14} className="pillars-icon" />
              <span>WHY LAYA DECIDED THIS (ARBITRATION PILLARS)</span>
            </div>
            <ul className="pillars-list">
              {pillars.map((pillar, pIdx) => {
                const parts = pillar.split(':');
                const title = parts.length > 1 ? parts[0] : `Point ${pIdx + 1}`;
                const detail = parts.length > 1 ? parts.slice(1).join(':') : pillar;
                const romanNumerals = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
                const num = romanNumerals[pIdx] || `${pIdx + 1}`;
                return (
                  <li key={pIdx} className="pillar-item">
                    <span className="pillar-num">{num}</span>
                    <div className="pillar-text-group">
                      <strong className="pillar-lead">{title}:</strong> {detail}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {/* Dynamic Candidates Matrix */}
        {payload.items && payload.items.length > 0 && (
          <div className="matrix-section">
            <h3 className="section-heading">
              {payload.type === 'multi_criteria_matrix' ? 'MULTI-CRITERIA EVALUATION' : 'CALIBRATED CANDIDATES'}
            </h3>
            <div className="matrix-grid">
              {payload.items.map((item, idx) => {
                const itemConf = item.is_winner
                  ? confPercent
                  : (item.confidence !== undefined ? Math.round(item.confidence * 100) : null);
                const criteria = item.criteria_scores;

                return (
                  <div key={idx} className={`matrix-card ${item.is_winner ? 'winner-card' : ''}`}>
                    <div className="card-top">
                      <div className="item-label-group">
                        <span className="item-label">{item.label}</span>
                        {item.is_winner && (
                          <span className="winner-tag">
                            <Check size={11} style={{ marginRight: 3 }} />
                            TOP CHOICE
                          </span>
                        )}
                      </div>
                      {itemConf !== null && (
                        <span className={`item-score ${item.is_winner ? 'score-winner' : ''}`}>
                          {itemConf}%
                        </span>
                      )}
                    </div>

                    {/* Overall Confidence Bar */}
                    {itemConf !== null && (
                      <div className="item-bar-track">
                        <div
                          className={`item-bar-fill ${item.is_winner ? 'fill-winner' : ''}`}
                          style={{ width: `${itemConf}%` }}
                        />
                      </div>
                    )}

                    {/* Multi-Criteria Sub-Scores Breakdown */}
                    {criteria && Object.keys(criteria).length > 0 && (
                      <div className="criteria-subgrid">
                        {Object.entries(criteria).map(([critName, score], cIdx) => (
                          <div key={cIdx} className="crit-row">
                            <span className="crit-name">{critName}</span>
                            <div className="crit-bar-track">
                              <div
                                className="crit-bar-fill"
                                style={{ width: `${Math.round(score * 100)}%` }}
                              />
                            </div>
                            <span className="crit-val">{Math.round(score * 100)}%</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Pros / Cons list if available */}
                    {item.pros && item.pros.length > 0 && (
                      <div className="pros-cons">
                        {item.pros.map((p, pIdx) => (
                          <div key={pIdx} className="pro-tag">
                            + {p}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Stage 2 Diagnostics & Telemetry Waterfall */}
        <div className="diagnostics-section">
          <h3 className="section-heading">
            <Activity size={14} style={{ marginRight: 6 }} />
            STAGE 2 TELEMETRY & SPECS
          </h3>
          <div className="diagnostics-box">
            {framedQuestion && (
              <div className="diag-row">
                <span className="diag-key">Framed Type:</span>
                <span className="diag-val uppercase badge-type-pill">{framedQuestion.question_type}</span>
              </div>
            )}
            {telemetry && (
              <>
                <div className="diag-row">
                  <span className="diag-key">LLM Framer:</span>
                  <span className="diag-val">{telemetry.llm_provider}</span>
                </div>
                <div className="diag-row">
                  <span className="diag-key">Framing Latency:</span>
                  <span className="diag-val">{telemetry.framing_latency_ms} ms</span>
                </div>
                <div className="diag-row">
                  <span className="diag-key">Laya Decision Engine:</span>
                  <span className="diag-val highlight-green">
                    {telemetry.laya_latency_ms} ms (Target &lt;100ms)
                  </span>
                </div>
                <div className="diag-row">
                  <span className="diag-key">Synthesis Latency:</span>
                  <span className="diag-val">{telemetry.synthesis_latency_ms} ms</span>
                </div>
              </>
            )}
            {!telemetry && layaResult && (
              <div className="diag-row">
                <span className="diag-key">Laya Latency:</span>
                <span className="diag-val highlight-green">{layaResult.latency_ms} ms</span>
              </div>
            )}
            {totalLatencyMs && (
              <div className="diag-row border-top-subtle">
                <span className="diag-key">Total Voice-to-Voice:</span>
                <span className="diag-val font-bold">{totalLatencyMs} ms</span>
              </div>
            )}
            {framedQuestion && (
              <div className="diag-row diag-col">
                <span className="diag-key">Framed Context State:</span>
                <p className="diag-state-text">{framedQuestion.state}</p>
              </div>
            )}
          </div>
        </div>

        {/* Citations & Sources */}
        {payload.citations && payload.citations.length > 0 && (
          <div className="citations-section">
            <h3 className="section-heading">GROUNDING & CITATIONS</h3>
            <div className="citations-list">
              {payload.citations.map((cite, cIdx) => (
                <div key={cIdx} className="citation-item">
                  <div className="citation-title">
                    {cite.url ? (
                      <a href={cite.url} target="_blank" rel="noopener noreferrer" className="citation-link">
                        {cite.title}
                        <ExternalLink size={12} style={{ marginLeft: 6 }} />
                      </a>
                    ) : (
                      <span>{cite.title}</span>
                    )}
                  </div>
                  <div className="citation-source">{cite.source}</div>
                  {cite.snippet && <div className="citation-snippet">"{cite.snippet}"</div>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};

