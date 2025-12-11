import React, { useRef, useState, useEffect } from "react";

// Advanced GoKart Racing Line Finder (CRA single-file App component)
// Paste this into src/App.js

export default function App() {
  const canvasRef = useRef(null);
  const imgRef = useRef(null);
  const [leftPoints, setLeftPoints] = useState([]);
  const [rightPoints, setRightPoints] = useState([]);
  const [centerline, setCenterline] = useState([]);
  const [racingLine, setRacingLine] = useState([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [mode, setMode] = useState("left");
  const [pxToMeter, setPxToMeter] = useState(0.2); // default scale
  const [calibrationPoints, setCalibrationPoints] = useState([]);
  const [kartMass, setKartMass] = useState(160); // kg
  const [enginePower, setEnginePower] = useState(8500); // W
  const [maxBrakeAccel, setMaxBrakeAccel] = useState(7.5); // m/s^2
  const [tyreMu, setTyreMu] = useState(1.6);
  const [vTop, setVTop] = useState(22);
  const [optimizing, setOptimizing] = useState(false);
  const [optProgress, setOptProgress] = useState(0);
  const [optIterations, setOptIterations] = useState(300);
  const [lapTime, setLapTime] = useState(null);
  const [imageURL, setImageURL] = useState(null);
  const width = 1100;
  const height = 650;

  useEffect(() => drawAll(), [leftPoints, rightPoints, centerline, racingLine, imageURL, optimizing]);

  // ---------- Canvas drawing & mouse handling ----------
  function toCanvasCoords(e) {
    const rect = canvasRef.current.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }
  function handleMouseDown(e) {
    const p = toCanvasCoords(e);
    setIsDrawing(true);
    if (mode === "left") setLeftPoints(prev => [...prev, p]);
    else setRightPoints(prev => [...prev, p]);
  }
  function handleMouseMove(e) {
    if (!isDrawing) return;
    const p = toCanvasCoords(e);
    if (mode === "left") setLeftPoints(prev => [...prev, p]);
    else setRightPoints(prev => [...prev, p]);
  }
  function handleMouseUp() {
    setIsDrawing(false);
  }

  function drawAll() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // background
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    // image
    if (imageURL) {
      const img = imgRef.current;
      if (img && img.complete) ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    }

    // grid
    ctx.strokeStyle = "#eee";
    ctx.lineWidth = 1;
    for (let x = 0; x < canvas.width; x += 50) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }

    // edges
    drawPath(ctx, leftPoints, "#d9534f", 3);
    drawPath(ctx, rightPoints, "#0275d8", 3);

    // center & racing
    drawPath(ctx, centerline, "#333", 2, [6, 6]);
    drawPath(ctx, racingLine, "#2ca02c", 3);

    // points
    drawPoints(ctx, leftPoints, "#d9534f");
    drawPoints(ctx, rightPoints, "#0275d8");

    // progress overlay
    if (optimizing) {
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#fff";
      ctx.font = "18px sans-serif";
      ctx.fillText(`Optimizing... ${Math.round(optProgress * 100)}%`, 20, 40);
    }
  }

  function drawPath(ctx, pts, color, width = 2, dash = null) {
    if (!pts || pts.length < 2) return;
    ctx.beginPath();
    ctx.lineWidth = width;
    ctx.strokeStyle = color;
    if (dash) ctx.setLineDash(dash);
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  function drawPoints(ctx, pts, color) {
    for (let p of pts) {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ---------- Image upload & basic auto-trace ----------
  function onImageUpload(e) {
    const f = e.target.files[0];
    if (!f) return;
    const url = URL.createObjectURL(f);
    setImageURL(url);
  }

  function autoTraceEdges() {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const img = imgRef.current;
    if (!img) return alert("Load an image first");
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const im = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const { data, width: w, height: h } = im;
    const gray = new Float32Array(w * h);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        gray[y * w + x] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      }
    const mag = new Float32Array(w * h);
    const gxKernel = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
    const gyKernel = [-1, -2, -1, 0, 0, 0, 1, 2, 1];
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        let gx = 0,
          gy = 0,
          k = 0;
        for (let ky = -1; ky <= 1; ky++)
          for (let kx = -1; kx <= 1; kx++) {
            const val = gray[(y + ky) * w + (x + kx)];
            gx += val * gxKernel[k++];
          }
        k = 0;
        for (let ky = -1; ky <= 1; ky++)
          for (let kx = -1; kx <= 1; kx++) {
            const val = gray[(y + ky) * w + (x + kx)];
            gy += val * gyKernel[k++];
          }
        mag[y * w + x] = Math.hypot(gx, gy);
      }
    }
    const copy = Array.from(mag).filter(v => v > 0).sort((a, b) => a - b);
    const thr = copy[Math.floor(copy.length * 0.85)] || 30;
    const left = [],
      right = [];
    for (let y = 0; y < h; y++) {
      let lx = -1,
        rx = -1;
      for (let x = 0; x < w; x++) {
        if (mag[y * w + x] > thr) {
          lx = x;
          break;
        }
      }
      for (let x = w - 1; x >= 0; x--) {
        if (mag[y * w + x] > thr) {
          rx = x;
          break;
        }
      }
      if (lx >= 0 && rx >= 0 && rx - lx > 20) {
        left.push({ x: lx, y });
        right.push({ x: rx, y });
      }
    }
    const sample = 2;
    const l2 = [],
      r2 = [];
    for (let i = 0; i < left.length; i += sample) {
      l2.push(left[i]);
      r2.push(right[i]);
    }
    setLeftPoints(l2);
    setRightPoints(r2);
    alert("Auto-trace completed. You can refine by drawing manually.");
  }

  // ---------- Geometry helpers ----------
  function distance(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }
  function resamplePath(pts, spacing) {
    if (!pts || pts.length < 2) return (pts || []).slice();
    const d = [0];
    for (let i = 1; i < pts.length; i++) d.push(d[i - 1] + distance(pts[i], pts[i - 1]));
    const total = d[d.length - 1];
    const n = Math.max(2, Math.round(total / spacing));
    const out = [];
    for (let i = 0; i <= n; i++) {
      const t = (i / n) * total;
      let j = 0;
      while (j < d.length - 1 && d[j + 1] < t) j++;
      const tt = (t - d[j]) / (d[j + 1] - d[j] || 1);
      const x = pts[j].x + (pts[j + 1].x - pts[j].x) * tt;
      const y = pts[j].y + (pts[j + 1].y - pts[j].y) * tt;
      out.push({ x, y });
    }
    return out;
  }
  function smoothPath(pts, iters = 3) {
    if (!pts || pts.length < 3) return (pts || []).slice();
    let cur = pts.slice();
    for (let k = 0; k < iters; k++) {
      const nxt = [cur[0]];
      for (let i = 0; i < cur.length - 1; i++) {
        const p0 = cur[i],
          p1 = cur[i + 1];
        const q = { x: 0.75 * p0.x + 0.25 * p1.x, y: 0.75 * p0.y + 0.25 * p1.y };
        const r = { x: 0.25 * p0.x + 0.75 * p1.x, y: 0.25 * p0.y + 0.75 * p1.y };
        nxt.push(q);
        nxt.push(r);
      }
      nxt.push(cur[cur.length - 1]);
      cur = nxt;
    }
    return cur;
  }

  function computeCenterlineFromEdges() {
    if (leftPoints.length < 5 || rightPoints.length < 5) return alert("Draw both edges first");
    const left = resamplePath(leftPoints, 3);
    const right = resamplePath(rightPoints, 3);
    const n = Math.min(left.length, right.length);
    const center = [];
    for (let i = 0; i < n; i++) center.push({ x: (left[i].x + right[i].x) / 2, y: (left[i].y + right[i].y) / 2 });
    const sm = smoothPath(center, 4);
    setCenterline(sm);
    setRacingLine(sm.slice());
    setLapTime(null);
  }

  // ---------- Curvature & kappa ----------
  function computeCurvature(pts) {
    const n = pts.length;
    const out = [];
    for (let i = 0; i < n; i++) {
      const p0 = pts[(i - 1 + n) % n];
      const p1 = pts[i];
      const p2 = pts[(i + 1) % n];
      const dx1 = p1.x - p0.x,
        dy1 = p1.y - p0.y;
      const dx2 = p2.x - p1.x,
        dy2 = p2.y - p1.y;
      const cross = dx1 * dy2 - dy1 * dx2;
      const len1 = Math.hypot(dx1, dy1);
      const len2 = Math.hypot(dx2, dy2);
      const denom = (len1 * len2 * (len1 + len2)) || 1;
      const k = cross / denom; // signed curvature in px^{-1}
      const tx = (dx1 + dx2) / 2,
        ty = (dy1 + dy2) / 2;
      const tlen = Math.hypot(tx, ty) || 1;
      out.push({ kappa: k, tx: tx / tlen, ty: ty / tlen });
    }
    return out;
  }

  // ---------- Vehicle dynamics simulation (forward-backward) ----------
  function simulateLap(path, options = { pxToMeter, tyreMu, maxBrakeAccel, enginePower, vTop }) {
    if (!path || path.length < 2) return null;
    const g = 9.81;
    const px2m = pxToMeter;
    const n = path.length;
    const dist = new Array(n).fill(0);
    for (let i = 0; i < n - 1; i++) dist[i] = Math.hypot(path[i + 1].x - path[i].x, path[i + 1].y - path[i].y) * px2m;
    dist[n - 1] = Math.hypot(path[0].x - path[n - 1].x, path[0].y - path[n - 1].y) * px2m;
    const curv = computeCurvature(path).map(c => Math.abs(c.kappa) / px2m); // 1/m
    const speedLimit = curv.map(k => (k > 1e-8 ? Math.sqrt(Math.max(0.5, tyreMu * g / k)) : options.vTop));
    for (let i = 0; i < n; i++) speedLimit[i] = Math.min(speedLimit[i], options.vTop);
    const v = new Array(n).fill(0);
    v[0] = Math.min(speedLimit[0], options.vTop);
    for (let i = 1; i < n; i++) {
      const a_forward = Math.min(options.enginePower / Math.max(1, options.enginePower / 1e3), 3.5);
      const vmax = Math.sqrt(v[i - 1] * v[i - 1] + 2 * a_forward * dist[i - 1]);
      v[i] = Math.min(speedLimit[i], vmax, options.vTop);
    }
    for (let iter = 0; iter < 3; iter++) {
      for (let i = n - 2; i >= 0; i--) {
        const brake = options.maxBrakeAccel;
        const d = dist[i];
        const v_allow = Math.sqrt(v[i + 1] * v[i + 1] + 2 * brake * d);
        if (v[i] > v_allow) v[i] = Math.max(0, v_allow);
      }
    }
    let totalT = 0;
    const segV = [];
    for (let i = 0; i < n; i++) {
      const vi = v[i];
      const d = dist[i];
      const ti = d / Math.max(0.1, vi);
      totalT += ti;
      segV.push(vi);
    }
    return { time: totalT, speedProfile: segV, dist, speedLimit };
  }

  // ---------- Racing-line optimizer (hill-climb shifting along normals) ----------
  async function optimizeRacingLine(iterations = 200) {
    if (centerline.length < 5) return alert("Compute centerline first");
    setOptimizing(true);
    setOptProgress(0);
    const left = resamplePath(leftPoints, 3),
      right = resamplePath(rightPoints, 3);
    const n = Math.min(left.length, right.length);
    const center = [];
    for (let i = 0; i < n; i++)
      center.push({ x: (left[i].x + right[i].x) / 2, y: (left[i].y + right[i].y) / 2, left: left[i], right: right[i] });
    const path = smoothPath(center.map(p => ({ x: p.x, y: p.y })), 3);
    let candidate = path.map(p => ({ x: p.x, y: p.y }));
    const normals = [];
    for (let i = 0; i < candidate.length; i++) {
      const p1 = candidate[(i + 1) % candidate.length];
      const p0 = candidate[(i - 1 + candidate.length) % candidate.length];
      const tx = p1.x - p0.x,
        ty = p1.y - p0.y;
      const len = Math.hypot(tx, ty) || 1;
      const nx = -ty / len,
        ny = tx / len;
      normals.push({ nx, ny });
    }
    const allowed = new Array(candidate.length).fill(0).map(() => ({ min: -100, max: 100 }));
    for (let i = 0; i < candidate.length; i++) {
      const c = candidate[i];
      const { nx, ny } = normals[i];
      const lp = left[Math.round((i * left.length) / candidate.length)];
      const rp = right[Math.round((i * right.length) / candidate.length)];
      const dl = (lp.x - c.x) * nx + (lp.y - c.y) * ny;
      const dr = (rp.x - c.x) * nx + (rp.y - c.y) * ny;
      allowed[i] = { min: Math.min(dl, dr), max: Math.max(dl, dr) };
    }

    let bestSim = simulateLap(candidate, { pxToMeter, tyreMu, maxBrakeAccel, enginePower, vTop });
    if (!bestSim) {
      setOptimizing(false);
      return;
    }
    let bestTime = bestSim.time;
    setRacingLine(candidate);
    setLapTime(bestTime);

    for (let it = 0; it < iterations; it++) {
      const tries = 30;
      let improved = false;
      for (let t = 0; t < tries; t++) {
        const i = Math.floor(Math.random() * candidate.length);
        const range = Math.min(allowed[i].max - allowed[i].min, 60);
        const step = (Math.random() * 2 - 1) * range * (0.08 + 0.92 * (1 - it / iterations));
        const newCandidate = candidate.map((p, idx) =>
          idx === i ? { x: p.x + normals[idx].nx * step, y: p.y + normals[idx].ny * step } : { x: p.x, y: p.y }
        );
        const sm = smoothPath(newCandidate, 2);
        const sim = simulateLap(sm, { pxToMeter, tyreMu, maxBrakeAccel, enginePower, vTop });
        if (sim && sim.time < bestTime) {
          candidate = sm;
          bestTime = sim.time;
          bestSim = sim;
          improved = true;
          setRacingLine(candidate);
          setLapTime(bestTime);
        }
      }
      setOptProgress((it + 1) / iterations);
      if (!improved && it > 30) break;
      await new Promise(r => setTimeout(r, 20));
    }

    setOptimizing(false);
    setOptProgress(1);
    setCenterline(path);
    setRacingLine(candidate);
    setLapTime(bestTime);
  }

  // ---------- Export functions ----------
  function exportCSV() {
    if (!racingLine || racingLine.length === 0) return alert("No racing line");
    const sim = simulateLap(racingLine, { pxToMeter, tyreMu, maxBrakeAccel, enginePower, vTop });
    let csv = "index,x_px,y_px,speed_mps\n";
    for (let i = 0; i < racingLine.length; i++) {
      csv += `${i},${racingLine[i].x.toFixed(3)},${racingLine[i].y.toFixed(3)},${(sim ? sim.speedProfile[i].toFixed(3) : "")}\n`;
    }
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "racing_line_telemetry.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportSVG() {
    if (!racingLine || racingLine.length === 0) return alert("No racing line");
    const svgParts = [];
    svgParts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">`);
    if (imageURL) svgParts.push(`<image href="${imageURL}" x="0" y="0" width="${width}" height="${height}" />`);
    svgParts.push(`<polyline points="${leftPoints.map(p => `${p.x},${p.y}`).join(" ")}" stroke="#d9534f" fill="none" stroke-width="3" />`);
    svgParts.push(`<polyline points="${rightPoints.map(p => `${p.x},${p.y}`).join(" ")}" stroke="#0275d8" fill="none" stroke-width="3" />`);
    svgParts.push(`<polyline points="${racingLine.map(p => `${p.x},${p.y}`).join(" ")}" stroke="#2ca02c" fill="none" stroke-width="3" />`);
    svgParts.push(`</svg>`);
    const blob = new Blob([svgParts.join("\n")], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "racing_line.svg";
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportGPX() {
    if (!racingLine || racingLine.length === 0) return alert("No racing line");
    const gpxParts = ['<?xml version="1.0" encoding="UTF-8"?>', '<gpx version="1.1" creator="GoKartLineFinder">', '<trk><name>Racing Line</name><trkseg>'];
    for (let p of racingLine) {
      const lat = (p.y * pxToMeter) / 111320;
      const lon = (p.x * pxToMeter) / (40075000 * Math.cos(0) / 360);
      gpxParts.push(`<trkpt lat="${lat}" lon="${lon}"></trkpt>`);
    }
    gpxParts.push("</trkseg></trk>", "</gpx>");
    const blob = new Blob([gpxParts.join("\n")], { type: "application/gpx+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "racing_line.gpx";
    a.click();
    URL.revokeObjectURL(url);
  }

  // ---------- UI actions ----------
  function clearAll() {
    setLeftPoints([]);
    setRightPoints([]);
    setCenterline([]);
    setRacingLine([]);
    setLapTime(null);
    setImageURL(null);
  }

  function calibrateAddPoint(e) {
    const p = toCanvasCoords(e);
    if (calibrationPoints.length < 1) {
      setCalibrationPoints(prev => [...prev, p]);
      return;
    }
    if (calibrationPoints.length === 1) {
      const px = distance(calibrationPoints[0], p);
      const known = prompt("Enter real-world distance between these two calibration points in meters (e.g. 10):");
      if (known) {
        const val = parseFloat(known);
        if (!isNaN(val) && val > 0) {
          setPxToMeter(val / px);
          alert("Calibration set: 1 px = " + (val / px).toFixed(4) + " m");
          setCalibrationPoints([]);
        }
      }
    }
  }

  return (
    <div style={{ padding: 12, fontFamily: "sans-serif" }}>
      <h1 style={{ fontSize: 22, marginBottom: 8 }}>Advanced GoKart Racing Line Finder</h1>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <div>
          <canvas
            ref={canvasRef}
            width={width}
            height={height}
            style={{ border: "1px solid #ccc", width: "100%", maxWidth: width }}
            onMouseDown={e => {
              if (e.shiftKey) calibrateAddPoint(e);
              else handleMouseDown(e);
            }}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={() => setIsDrawing(false)}
          />
          <img ref={imgRef} src={imageURL || ""} alt="track" style={{ display: "none" }} onLoad={() => drawAll()} />
        </div>

        <div style={{ minWidth: 320 }}>
          <div style={{ marginBottom: 8 }}>
            <input type="file" accept="image/*" onChange={onImageUpload} />
            <button style={{ marginLeft: 8 }} onClick={autoTraceEdges}>Auto-trace Edges</button>
          </div>

          <div style={{ marginBottom: 8 }}>
            <div style={{ fontWeight: 600 }}>Drawing mode</div>
            <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
              <button onClick={() => setMode("left")} style={{ padding: 8, background: mode === "left" ? "#f8d7da" : "#eee" }}>Draw Left Edge</button>
              <button onClick={() => setMode("right")} style={{ padding: 8, background: mode === "right" ? "#d6e9ff" : "#eee" }}>Draw Right Edge</button>
              <button onClick={computeCenterlineFromEdges} style={{ padding: 8, background: "#fffae6" }}>Compute Centerline</button>
            </div>
            <div style={{ fontSize: 12, color: "#666", marginTop: 6 }}>
              Hold <b>Shift</b> and click two points on the canvas to calibrate scale (then enter real-world distance).
            </div>
          </div>

          <div style={{ padding: 8, background: "#fafafa", borderRadius: 6, marginBottom: 8 }}>
            <div style={{ fontWeight: 700 }}>Kart / Simulation</div>
            <div style={{ marginTop: 6 }}>
              <label>Mass (kg)</label><br />
              <input type="number" value={kartMass} onChange={e => setKartMass(parseFloat(e.target.value) || kartMass)} />
            </div>
            <div>
              <label>Engine power (W)</label><br />
              <input type="number" value={enginePower} onChange={e => setEnginePower(parseFloat(e.target.value) || enginePower)} />
            </div>
            <div>
              <label>Top speed (m/s)</label><br />
              <input type="number" value={vTop} onChange={e => setVTop(parseFloat(e.target.value) || vTop)} />
            </div>
            <div>
              <label>Brake decel (m/s²)</label><br />
              <input type="number" value={maxBrakeAccel} onChange={e => setMaxBrakeAccel(parseFloat(e.target.value) || maxBrakeAccel)} />
            </div>
            <div>
              <label>Tire μ (lateral)</label><br />
              <input type="number" value={tyreMu} step="0.1" onChange={e => setTyreMu(parseFloat(e.target.value) || tyreMu)} />
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            <button onClick={() => optimizeRacingLine(optIterations)} style={{ padding: 8, background: "#d4f8d4" }} disabled={optimizing}>Optimize Line</button>
            <button onClick={() => { const sim = simulateLap(racingLine, { pxToMeter, tyreMu, maxBrakeAccel, enginePower, vTop }); if (sim) setLapTime(sim.time); else alert("No racing line"); }} style={{ padding: 8, background: "#dbeafe" }}>Simulate Lap</button>
            <button onClick={clearAll} style={{ padding: 8, background: "#eee" }}>Clear</button>
          </div>

          <div style={{ padding: 8, border: "1px solid #eee", borderRadius: 6 }}>
            <div>
              Estimated lap time: <strong>{lapTime ? (lapTime.toFixed(2) + " s") : "—"}</strong>
            </div>
            <div style={{ fontSize: 12, color: "#666" }}>Scale: 1 px = {pxToMeter.toFixed(4)} m</div>
            <div style={{ marginTop: 8 }}>
              <button onClick={exportCSV} style={{ marginRight: 6 }}>Export CSV</button>
              <button onClick={exportSVG} style={{ marginRight: 6 }}>Export SVG</button>
              <button onClick={exportGPX}>Export GPX</button>
            </div>
            <div style={{ fontSize: 12, color: "#666", marginTop: 8 }}>
              Optimizer iterations: <input type="number" value={optIterations} onChange={e => setOptIterations(parseInt(e.target.value) || optIterations)} style={{ width: 80 }} /> — Progress: {Math.round(optProgress * 100)}%
            </div>
          </div>

          <div style={{ marginTop: 12, fontSize: 13, color: "#444" }}>
            <div style={{ fontWeight: 700 }}>Notes & tips</div>
            <ul>
              <li>Auto-trace is a heuristic: refine edges manually for best results.</li>
              <li>Calibrate scale for realistic lap-time estimates (Shift+click two points).</li>
              <li>Optimizer is a hill-climb — increase iterations for better results.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

