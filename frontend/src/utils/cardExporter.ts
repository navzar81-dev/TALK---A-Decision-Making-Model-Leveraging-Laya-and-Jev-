import type { VisualPayload, LayaDecisionResult } from '../types';

export async function generateDecisionCardBlob(
  payload: VisualPayload,
  layaResult?: LayaDecisionResult | null
): Promise<Blob> {
  const width = 840;
  const pillars = payload.reasoning_pillars || layaResult?.reasoning_pillars || [];
  const items = payload.items || [];
  
  // Compute dynamic height based on content
  const baseHeight = 520;
  const pillarsHeight = pillars.length * 36;
  const itemsHeight = Math.min(items.length, 3) * 38;
  const height = baseHeight + pillarsHeight + itemsHeight;

  const canvas = document.createElement('canvas');
  canvas.width = width * 2; // 2x retina
  canvas.height = height * 2;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get canvas context');

  ctx.scale(2, 2);

  // Background Gradient
  const bgGrad = ctx.createLinearGradient(0, 0, width, height);
  bgGrad.addColorStop(0, '#090d16');
  bgGrad.addColorStop(0.5, '#0f172a');
  bgGrad.addColorStop(1, '#050811');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // Outer Border Glow
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.25)';
  ctx.lineWidth = 2;
  ctx.strokeRect(12, 12, width - 24, height - 24);

  // Subtle Cyan Ambient Corner Glow
  const glow = ctx.createRadialGradient(80, 80, 10, 80, 80, 250);
  glow.addColorStop(0, 'rgba(56, 189, 248, 0.15)');
  glow.addColorStop(1, 'transparent');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, 400, 300);

  // Header Brand
  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 15px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('⚡ TALK DECISION OS', 40, 52);

  // Engine Badge Right-aligned
  ctx.fillStyle = '#94a3b8';
  ctx.font = '500 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('POWERED BY LAYA SYSTEM 1 ENGINE', width - 40, 52);
  ctx.textAlign = 'left';

  // Divider
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.beginPath();
  ctx.moveTo(40, 72);
  ctx.lineTo(width - 40, 72);
  ctx.stroke();

  // Question Title
  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 22px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  const displayTitle = payload.title.length > 55 ? payload.title.slice(0, 52) + '...' : payload.title;
  ctx.fillText(displayTitle, 40, 114);

  if (payload.subtitle) {
    ctx.fillStyle = '#94a3b8';
    ctx.font = '13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    const sub = payload.subtitle.length > 70 ? payload.subtitle.slice(0, 67) + '...' : payload.subtitle;
    ctx.fillText(sub, 40, 140);
  }

  // Winner Card Container
  const winnerY = payload.subtitle ? 165 : 145;
  const winnerCardHeight = 135;
  
  // Gradient fill for winner box
  const winGrad = ctx.createLinearGradient(40, winnerY, width - 40, winnerY + winnerCardHeight);
  winGrad.addColorStop(0, 'rgba(56, 189, 248, 0.12)');
  winGrad.addColorStop(1, 'rgba(16, 185, 129, 0.08)');
  ctx.fillStyle = winGrad;
  ctx.beginPath();
  ctx.roundRect(40, winnerY, width - 80, winnerCardHeight, 14);
  ctx.fill();
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.35)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // "OFFICIAL VERDICT" Tag
  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('🏆 OFFICIAL VERDICT', 62, winnerY + 30);

  // Flavor Pill
  const confPercent = Math.round((layaResult?.confidence || payload.confidence) * 100);
  const flavor = payload.verdict_flavor || layaResult?.verdict_flavor || `${confPercent}% Confident`;
  ctx.fillStyle = 'rgba(16, 185, 129, 0.2)';
  ctx.beginPath();
  ctx.roundRect(width - 230, winnerY + 16, 170, 24, 12);
  ctx.fill();
  ctx.fillStyle = '#34d399';
  ctx.font = 'bold 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(flavor.toUpperCase(), width - 145, winnerY + 32);
  ctx.textAlign = 'left';

  // Winner Choice Text
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 26px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(payload.decision_badge, 62, winnerY + 70);

  // Verdict Summary
  ctx.fillStyle = '#cbd5e1';
  ctx.font = '13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  const summaryText = payload.summary.length > 85 ? payload.summary.slice(0, 82) + '...' : payload.summary;
  ctx.fillText(summaryText, 62, winnerY + 102);

  let currentY = winnerY + winnerCardHeight + 35;

  // XYZ Reasoning Pillars Section
  if (pillars.length > 0) {
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText('✨ WHY LAYA DECIDED THIS (XYZ REASONING):', 40, currentY);
    currentY += 24;

    pillars.forEach((pillar) => {
      // Bullet dot
      ctx.fillStyle = '#0ea5e9';
      ctx.beginPath();
      ctx.arc(48, currentY - 4, 3.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#e2e8f0';
      ctx.font = '13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      const cleanPillar = pillar.length > 85 ? pillar.slice(0, 82) + '...' : pillar;
      ctx.fillText(cleanPillar, 62, currentY);
      currentY += 34;
    });
    currentY += 10;
  }

  // Candidates Distribution Section
  if (items.length > 0) {
    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText('CALIBRATED CANDIDATE PROBABILITIES:', 40, currentY);
    currentY += 22;

    items.slice(0, 3).forEach((item) => {
      const itemConf = item.is_winner
        ? confPercent
        : (item.confidence !== undefined ? Math.round(item.confidence * 100) : 50);

      // Label
      ctx.fillStyle = item.is_winner ? '#38bdf8' : '#94a3b8';
      ctx.font = item.is_winner ? 'bold 13px -apple-system, BlinkMacSystemFont, sans-serif' : '13px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.fillText(item.label, 40, currentY);

      // Percentage
      ctx.textAlign = 'right';
      ctx.fillText(`${itemConf}%`, width - 40, currentY);
      ctx.textAlign = 'left';

      // Bar Track
      const barY = currentY + 6;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.beginPath();
      ctx.roundRect(40, barY, width - 80, 6, 3);
      ctx.fill();

      // Bar Fill
      const fillWidth = Math.max(8, ((width - 80) * itemConf) / 100);
      ctx.fillStyle = item.is_winner ? '#38bdf8' : 'rgba(148, 163, 184, 0.5)';
      ctx.beginPath();
      ctx.roundRect(40, barY, fillWidth, 6, 3);
      ctx.fill();

      currentY += 38;
    });
  }

  // Footer Watermark
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
  ctx.beginPath();
  ctx.moveTo(40, height - 44);
  ctx.lineTo(width - 40, height - 44);
  ctx.stroke();

  ctx.fillStyle = '#64748b';
  ctx.font = '11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('TALK // Voice-First Decision Assistant • Calibrated Statistical Inference', 40, height - 20);

  const timestamp = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  ctx.textAlign = 'right';
  ctx.fillText(timestamp, width - 40, height - 20);
  ctx.textAlign = 'left';

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Failed to create canvas blob'));
    }, 'image/png');
  });
}

export async function downloadDecisionCard(
  payload: VisualPayload,
  layaResult?: LayaDecisionResult | null
) {
  const blob = await generateDecisionCardBlob(payload, layaResult);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const safeName = (payload.decision_badge || 'verdict').replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
  link.download = `talk-decision-${safeName}.png`;
  link.href = url;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
