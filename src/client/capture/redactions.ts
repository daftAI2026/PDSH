/**
 * [INPUT]: 依赖候选区域与用户确认的遮挡区域。
 * [OUTPUT]: 提供自动候选和手绘区域的选择合并。
 * [POS]: capture 的遮挡选择层；不更改截图原像素。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import type { CaptureCandidate, CaptureRegion } from "./model.ts";

export function resolveSelectedCaptureRegions(
  regions: CaptureRegion[],
  candidates: CaptureCandidate[],
): CaptureRegion[] {
  const currentCandidates = new Map(candidates.map((candidate) => [candidate.id, candidate]));
  const resolved: CaptureRegion[] = [];

  for (const region of regions) {
    if (region.source === "manual") {
      resolved.push(region);
      continue;
    }
    const candidate = currentCandidates.get(region.id);
    if (!candidate) continue;
    resolved.push({
      ...region,
      rect: {
        height: candidate.height,
        width: candidate.width,
        x: candidate.x,
        y: candidate.y,
      },
    });
  }

  return resolved;
}
