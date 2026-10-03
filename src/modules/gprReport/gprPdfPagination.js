// A little white space is preferable to a split photograph or evidence card.
// 38% still avoids nearly-empty pages while allowing tall figures to move as
// a whole to the following page.
const DEFAULT_MIN_FILL_RATIO = 0.38;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

/**
 * Plan canvas slices without cutting through keep-together report blocks.
 * Coordinates are pixels in the captured canvas.
 */
export function planGprPdfSlices({
  contentHeight,
  pageHeight,
  keepTogether = [],
  forcedBreaks = [],
  repeatingHeaders = [],
  minFillRatio = DEFAULT_MIN_FILL_RATIO,
  boundarySafety = 0,
}) {
  const height = Math.max(0, Number(contentHeight) || 0);
  const page = Math.max(1, Number(pageHeight) || 1);
  if (!height) return [];

  const blocks = keepTogether
    .map(({ top, bottom }) => ({
      top: clamp(Number(top) || 0, 0, height),
      bottom: clamp(Number(bottom) || 0, 0, height),
    }))
    .filter((block) => block.bottom > block.top)
    .sort((a, b) => a.top - b.top || a.bottom - b.bottom);
  const forced = [...new Set(forcedBreaks.map((value) => clamp(Number(value) || 0, 0, height)))]
    .filter((value) => value > 0 && value < height)
    .sort((a, b) => a - b);
  const headers = repeatingHeaders
    .map(({ tableTop, tableBottom, headerTop, headerBottom }) => ({
      tableTop: clamp(Number(tableTop) || 0, 0, height),
      tableBottom: clamp(Number(tableBottom) || 0, 0, height),
      headerTop: clamp(Number(headerTop) || 0, 0, height),
      headerBottom: clamp(Number(headerBottom) || 0, 0, height),
    }))
    .filter(
      (header) =>
        header.tableBottom > header.tableTop &&
        header.headerBottom > header.headerTop &&
        header.headerTop >= header.tableTop - 1 &&
        header.headerBottom <= header.tableBottom + 1
    );

  const slices = [];
  let start = 0;
  let guard = 0;
  while (start < height - 0.5 && guard < 1000) {
    guard += 1;
    const repeatHeader = headers.find(
      (header) => start > header.headerBottom + 1 && start < header.tableBottom - 1
    );
    const headerHeight = repeatHeader ? repeatHeader.headerBottom - repeatHeader.headerTop : 0;
    const availablePage = Math.max(page * 0.55, page - headerHeight);
    const rawIdealEnd = Math.min(height, start + availablePage);
    if (rawIdealEnd >= height - 0.5) {
      slices.push({ start, end: height, repeatHeader: repeatHeader || null });
      break;
    }

    const safeGap = clamp(Number(boundarySafety) || 0, 0, availablePage * 0.08);
    const idealEnd = Math.max(start + 1, rawIdealEnd - safeGap);

    const forcedEnd = forced.find((value) => value > start + 1 && value <= rawIdealEnd + 1);
    let end = forcedEnd || idealEnd;

    if (!forcedEnd) {
      const minEnd = start + availablePage * clamp(minFillRatio, 0.2, 0.9);
      const crossing = blocks
        .filter(
          (block) =>
            block.top < end - 1 &&
            block.bottom > end + 1 &&
            block.bottom - block.top < page * 0.94 &&
            block.top >= minEnd
        )
        // Prefer the outer keep-together block. For example, a scan panel can
        // contain a paragraph that also crosses the boundary; cutting at the
        // paragraph would orphan the panel heading and its table header.
        .sort((a, b) => a.top - b.top)[0];
      if (crossing) end = crossing.top;
    }

    // Always make progress, even with malformed layout hints.
    if (end <= start + 1) end = Math.min(height, start + availablePage);
    slices.push({ start, end, repeatHeader: repeatHeader || null });
    start = end;
  }

  return slices;
}
