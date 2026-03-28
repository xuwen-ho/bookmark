import type { OCRBlock } from "../hooks/useOCR";
import {
  PARAGRAPH_GAP_MULTIPLIER,
  HEADER_FOOTER_MARGIN,
  TWO_COLUMN_SPLIT_RATIO,
  INDENT_THRESHOLD_PX,
} from "./constants";

export interface Paragraph {
  text: string;
  isBlockQuote: boolean;
}

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const m = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[m - 1] + sorted[m]) / 2 : sorted[m];
}

function getBounds(blocks: OCRBlock[]): { width: number; height: number } {
  return {
    width: Math.max(1000, ...blocks.map((b) => b.boundingBox.right)),
    height: Math.max(1000, ...blocks.map((b) => b.boundingBox.bottom)),
  };
}

function filterHeaderFooter(blocks: OCRBlock[], h: number): OCRBlock[] {
  return blocks.filter(
    (b) => b.boundingBox.top >= h * HEADER_FOOTER_MARGIN &&
           b.boundingBox.bottom <= h * (1 - HEADER_FOOTER_MARGIN)
  );
}

function isTwoColumn(blocks: OCRBlock[], w: number): boolean {
  if (blocks.length < 6) return false;
  const cx = w / 2;
  const mids = blocks.map((b) => (b.boundingBox.left + b.boundingBox.right) / 2);
  const lc = mids.filter((x) => x < cx).length;
  const rc = mids.filter((x) => x >= cx).length;
  return Math.min(lc, rc) / Math.max(lc, rc) > TWO_COLUMN_SPLIT_RATIO;
}

function groupBlocks(sorted: OCRBlock[], gapThreshold: number): Paragraph[] {
  if (!sorted.length) return [];
  const out: Paragraph[] = [];
  let grp = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    const gap = sorted[i].boundingBox.top - sorted[i - 1].boundingBox.bottom;
    if (gap > gapThreshold) {
      out.push({ text: grp.map((l) => l.text).join(" "), isBlockQuote: grp[0].boundingBox.left > INDENT_THRESHOLD_PX });
      grp = [sorted[i]];
    } else {
      grp.push(sorted[i]);
    }
  }
  out.push({ text: grp.map((l) => l.text).join(" "), isBlockQuote: grp[0].boundingBox.left > INDENT_THRESHOLD_PX });
  return out;
}

export function mergeLinesToParagraphs(blocks: OCRBlock[]): Paragraph[] {
  if (!blocks.length) return [];
  const { width, height } = getBounds(blocks);
  const filtered = filterHeaderFooter(blocks, height);
  if (!filtered.length) return [];
  const gapThreshold = median(filtered.map((b) => b.boundingBox.height)) * PARAGRAPH_GAP_MULTIPLIER;
  const sorted = [...filtered].sort((a, b) => a.boundingBox.top - b.boundingBox.top);
  if (!isTwoColumn(sorted, width)) return groupBlocks(sorted, gapThreshold);
  const cx = width / 2;
  const left = sorted.filter((b) => (b.boundingBox.left + b.boundingBox.right) / 2 < cx);
  const right = sorted.filter((b) => (b.boundingBox.left + b.boundingBox.right) / 2 >= cx);
  return [...groupBlocks(left, gapThreshold), ...groupBlocks(right, gapThreshold)];
}
