import rough from "roughjs";
import getStroke from "perfect-freehand";

import {
  createIcons, MousePointer2, Square, Circle, Diamond, MoveUpRight,
  Minus, Pencil, Eraser, Undo2, Redo2, Download, Trash2,
} from "lucide";


createIcons({
  icons: { MousePointer2, Square, Circle, Diamond, MoveUpRight, Minus, Pencil, Eraser, Undo2, Redo2, Download, Trash2 },
  attrs: { width: 20, height: 20, "stroke-width": 1.8 },
});

const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const rc = rough.canvas(canvas);

let elements = JSON.parse(localStorage.getItem("scene") || "[]");
let history = [JSON.stringify(elements)];
let step = 0;
let tool = "rect";
let color = "#1e1e1e";
let drawing = null;
let dragging = null;
let erasing = false;
let erased = false;
let selectedId = null;

const TOOLS = ["select", "rect", "ellipse", "diamond", "arrow", "line", "pen", "eraser"];


function bounds(el) {
  if (el.type === "pen") {
    const xs = el.points.map((p) => p[0]), ys = el.points.map((p) => p[1]);
    return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
  }
  return {
    minX: Math.min(el.x1, el.x2), maxX: Math.max(el.x1, el.x2),
    minY: Math.min(el.y1, el.y2), maxY: Math.max(el.y1, el.y2),
  };
}

function distToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1, len = dx * dx + dy * dy;
  const t = len ? Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / len)) : 0;
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

function hit(el, x, y) {
  const T = 8;
  if (el.type === "pen") {
    return el.points.some((p, i) => {
      const n = el.points[i + 1] || p;
      return distToSegment(x, y, p[0], p[1], n[0], n[1]) < T;
    });
  }
  if (el.type === "line" || el.type === "arrow") {
    return distToSegment(x, y, el.x1, el.y1, el.x2, el.y2) < T;
  }
  const b = bounds(el);
  return x >= b.minX - T && x <= b.maxX + T && y >= b.minY - T && y <= b.maxY + T;
}

function move(el, dx, dy) {
  if (el.type === "pen") el.points = el.points.map(([x, y]) => [x + dx, y + dy]);
  else { el.x1 += dx; el.x2 += dx; el.y1 += dy; el.y2 += dy; }
}

const strokeToPath = (pts) => {
  if (pts.length < 4) return "";
  const d = pts.reduce(
    (acc, [x0, y0], i, arr) => {
      const [x1, y1] = arr[(i + 1) % arr.length];
      acc.push(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
      return acc;
    },
    ["M", ...pts[0], "Q"]
  );
  d.push("Z");
  return d.join(" ");
};

function drawElement(el) {
  const o = { stroke: el.color, strokeWidth: 2, roughness: 1.6, seed: el.seed };
  const { x1, y1, x2, y2 } = el;

  switch (el.type) {
    case "rect":
      rc.rectangle(x1, y1, x2 - x1, y2 - y1, o);
      break;
    case "ellipse":
      rc.ellipse((x1 + x2) / 2, (y1 + y2) / 2, Math.abs(x2 - x1), Math.abs(y2 - y1), o);
      break;
    case "diamond": {
      const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
      rc.polygon([[mx, y1], [x2, my], [mx, y2], [x1, my]], o);
      break;
    }
    case "line":
      rc.line(x1, y1, x2, y2, o);
      break;
    case "arrow": {
      rc.line(x1, y1, x2, y2, o);
      const a = Math.atan2(y2 - y1, x2 - x1), L = 16;
      for (const s of [-1, 1]) {
        rc.line(x2, y2, x2 - L * Math.cos(a + s * 0.5), y2 - L * Math.sin(a + s * 0.5), o);
      }
      break;
    }
    case "pen": {
      const outline = getStroke(el.points, { size: 5, thinning: 0.6, smoothing: 0.5, streamline: 0.5 });
      ctx.fillStyle = el.color;
      ctx.fill(new Path2D(strokeToPath(outline)));
      break;
    }
  }
}

function render() {
  const dpr = window.devicePixelRatio || 1;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, innerWidth, innerHeight);
  elements.forEach(drawElement);
  if (drawing) drawElement(drawing);

  const sel = elements.find((e) => e.id === selectedId);
  if (sel) {
    const b = bounds(sel);
    ctx.save();
    ctx.setLineDash([6, 4]);
    ctx.strokeStyle = "#6965db";
    ctx.strokeRect(b.minX - 6, b.minY - 6, b.maxX - b.minX + 12, b.maxY - b.minY + 12);
    ctx.restore();
  }
}

function resize() {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = innerWidth * dpr;
  canvas.height = innerHeight * dpr;
  canvas.style.width = innerWidth + "px";
  canvas.style.height = innerHeight + "px";
  render();
}


function commit() {
  history = history.slice(0, step + 1);
  history.push(JSON.stringify(elements));
  step++;
  localStorage.setItem("scene", history[step]);
}

function restore() {
  elements = JSON.parse(history[step]);
  selectedId = null;
  localStorage.setItem("scene", history[step]);
  render();
}

const undo = () => { if (step > 0) { step--; restore(); } };
const redo = () => { if (step < history.length - 1) { step++; restore(); } };


function erase(x, y) {
  const before = elements.length;
  elements = elements.filter((el) => !hit(el, x, y));
  if (elements.length !== before) erased = true;
}

canvas.addEventListener("pointerdown", (e) => {
  canvas.setPointerCapture(e.pointerId);
  const { clientX: x, clientY: y } = e;

  if (tool === "select") {
    const el = [...elements].reverse().find((el) => hit(el, x, y));
    selectedId = el ? el.id : null;
    dragging = el ? { x, y, moved: false } : null;
  } else if (tool === "eraser") {
    erasing = true;
    erase(x, y);
  } else {
    selectedId = null;
    drawing = {
      id: crypto.randomUUID(),
      type: tool,
      x1: x, y1: y, x2: x, y2: y,
      ...(tool === "pen" && { points: [[x, y]] }),
      color,
      seed: Math.floor(Math.random() * 2 ** 31),
    };
  }
  render();
});

canvas.addEventListener("pointermove", (e) => {
  const x = e.clientX, y = e.clientY;
  if (drawing) {
    if (drawing.type === "pen") drawing.points.push([x, y]);
    else { drawing.x2 = x; drawing.y2 = y; }
  } else if (dragging) {
    const el = elements.find((it) => it.id === selectedId);
    move(el, x - dragging.x, y - dragging.y);
    dragging.x = x; dragging.y = y; dragging.moved = true;
  } else if (erasing) {
    erase(x, y);
  } else return;
  render();
});

canvas.addEventListener("pointerup", () => {
  if (drawing) {
    const empty = drawing.type !== "pen" && drawing.x1 === drawing.x2 && drawing.y1 === drawing.y2;
    if (!empty) { elements.push(drawing); commit(); }
    drawing = null;
  } else if ((dragging && dragging.moved) || erased) {
    commit();
  }
  dragging = null; erasing = false; erased = false;
  render();
});


const toolButtons = document.querySelectorAll("[data-tool]");
function setTool(name) {
  tool = name;
  toolButtons.forEach((b) => b.classList.toggle("active", b.dataset.tool === name));
  if (name !== "select") { selectedId = null; render(); }
  canvas.style.cursor = name === "select" ? "default" : "crosshair";
}
toolButtons.forEach((b) => b.addEventListener("click", () => setTool(b.dataset.tool)));

const colorInput = document.getElementById("color");
colorInput.addEventListener("input", () => {
  color = colorInput.value;
  const sel = elements.find((e) => e.id === selectedId);
  if (sel) { sel.color = color; render(); }
});
colorInput.addEventListener("change", () => { if (selectedId) commit(); });

document.getElementById("undo").onclick = undo;
document.getElementById("redo").onclick = redo;
document.getElementById("clear").onclick = () => { elements = []; selectedId = null; commit(); render(); };

document.getElementById("export").onclick = () => {
  selectedId = null;
  render();
  const out = document.createElement("canvas");
  out.width = canvas.width;
  out.height = canvas.height;
  const c = out.getContext("2d");
  c.fillStyle = "#fff";
  c.fillRect(0, 0, out.width, out.height);
  c.drawImage(canvas, 0, 0);
  const a = document.createElement("a");
  a.download = "drawing.png";
  a.href = out.toDataURL("image/png");
  a.click();
};

window.addEventListener("keydown", (e) => {
  const mod = e.ctrlKey || e.metaKey;
  if (mod && e.key.toLowerCase() === "z") { e.preventDefault(); e.shiftKey ? redo() : undo(); }
  else if (mod && e.key.toLowerCase() === "y") { e.preventDefault(); redo(); }
  else if ((e.key === "Delete" || e.key === "Backspace") && selectedId) {
    elements = elements.filter((el) => el.id !== selectedId);
    selectedId = null; commit(); render();
  } else if (!mod && /^[1-8]$/.test(e.key)) setTool(TOOLS[e.key - 1]);
});

window.addEventListener("resize", resize);
setTool("rect");
resize();
