/**
 * getSvgRectangleRenderer is a higher-order function that returns a function to render groupedRects.
 * The returned function expects groupedRects to be in a format created by SvgRectangles.precalculate
 * Stroke lines are not defined within the SVG. You should define them using CSS on the SVG element.
 * @param {HTMLElement} svg
 */
export function getSvgRectangleRenderer(svg) {
  svg.setAttribute('shape-rendering', 'optimizeSpeed');

  let lastTotalWidth;
  let lastTotalHeight;

  const brushes = new Map();

  // TODO instead of totalWidth, etc, I could use cutx2 - cutx1, etc
  // or maximum x2, y2 in groupedRects
  // on the other hand, totalWidth, totalHeight should not change that often
  return (totalWidth, totalHeight, groupedRects, cutx1, cuty1, cutx2, cuty2) => {
    if (totalWidth !== lastTotalWidth) {
      svg.style.width = `${totalWidth}px`;
      lastTotalWidth = totalWidth;
    }
    if (totalHeight !== lastTotalHeight) {
      svg.style.height = `${totalHeight}px`;
      lastTotalHeight = totalHeight;
    }

    brushes.forEach((brush) => {
      brush.instruction = '';
    });

    // TODO use binary search to find start value for gg and rr

    for (let gg = 0; gg < groupedRects.length; gg++) {
      const rects = groupedRects[gg];
      for (let rr = 0; rr < rects.length; rr++) {
        const { x1, x2, y1, y2 } = rects[rr];
        if (x1 > cutx2 || x2 < cutx1 || y1 > cuty2 || y2 < cuty1) {
          if (y1 > cuty2) {
            return; // if rects are sorted by y1, I can break after reaching cuty2. This allows to gain 20ms on 1000x1000 cells with borders
          }
          if (x1 > cutx2) {
            break; // if rects are sorted by x1, I can break after reaching cutx2. This allows to gain 20ms on 1000x1000 cells with borders
          }
        } else {
          const { top, left, bottom, right } = rects[rr];
          if (top) {
            const brush = getBrushForStyle(brushes, top.stroke, svg);
            lineH(brush, x1, y1, x2);
          }
          if (right) {
            const brush = getBrushForStyle(brushes, right.stroke, svg);
            lineV(brush, x2, y1, y2);
          }
          if (bottom) {
            const brush = getBrushForStyle(brushes, bottom.stroke, svg);
            lineH(brush, x2, y2, x1);
          }
          if (left) {
            const brush = getBrushForStyle(brushes, left.stroke, svg);
            lineV(brush, x1, y2, y1);
          }
        }
      }

      brushes.forEach((brush) => {
        if (brush.renderedInstruction !== brush.instruction) {
          brush.elem.setAttribute('d', brush.instruction);
          brush.renderedInstruction = brush.instruction;
        }
      });
    }
  };
}

/**
 * Rects are grouped by x1. Groups are sorted by x1 ascending. Within groups,
 * rects are sorted by y1 ascending.
 */
export function precalculateRectangles(rects) {
  const sorted = [...rects];
  sorted.sort((a, b) => a.y1 - b.y1);

  const groupedRects = [];
  let y1 = -1;
  let row;
  for (let i = 0; i < sorted.length; i++) {
    if (!row || y1 !== sorted[i].y1) {
      row = [];
      groupedRects.push(row);
      y1 = sorted[i].y1;
    }
    row.push(sorted[i]);
  }

  for (let i = 0; i < groupedRects.length; i++) {
    groupedRects[i].sort((a, b) => a.x1 - b.x1);
  }

  // TODO group by style
  // TODO simplify paths within style

  return groupedRects;
}

function getBrushForStyle(brushes, style, parent) {
  let brush = brushes.get(style);
  if (!brush) {
    const elem = parent.ownerDocument.createElementNS('http://www.w3.org/2000/svg', 'path');
    elem.setAttribute('fill', 'none');
    const [width, color] = (style || '1px black').split(' ');
    elem.setAttribute('stroke', color);
    elem.setAttribute('stroke-width', width);
    brush = {};
    brush.elem = elem;
    brush.instruction = '';
    brush.renderedInstruction = '';
    brush.x = -1;
    brush.y = -1;
    parent.appendChild(elem);
    brushes.set(style, brush);
  }
  return brush;
}

function lineH(brush, x1, y1, x2) {
  if (brush.x !== x1 || brush.y !== y1) {
    brush.instruction += `M ${x1} ${y1} `;
    brush.y = y1;
  }
  brush.instruction += `H ${x2} `;
  brush.x = x2;
}

function lineV(brush, x1, y1, y2) {
  if (brush.x !== x1 || brush.y !== y1) {
    brush.instruction += `M ${x1} ${y1} `;
    brush.x = x1;
  }
  brush.instruction += `V ${y2} `;
  brush.y = y2;
}
