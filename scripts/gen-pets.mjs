// 用 TokenHub 生图接口批量生成 16 种性格的形象图
//
// 用法（PowerShell）:
//   $env:TOKENHUB_KEY="sk-xxx"; npm run gen:pets              # 生成全部缺失的
//   $env:TOKENHUB_KEY="sk-xxx"; npm run gen:pets -- INFP ENFP # 只生成指定类型
//   $env:TOKENHUB_KEY="sk-xxx"; npm run gen:pets -- --force   # 强制重生成
//
// 也可以把 Key 写进 scripts/.tokenhub-key（已 gitignore），免得每次设置环境变量。
//
// 产物:
//   assets/pets/raw/{MBTI}.png  原图（1024，留着以后重新处理）
//   public/pets/{MBTI}.png      处理后的成品（抠背景 + 裁切对齐 + 缩到 256）

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { PNG } from "pngjs";
import { ART, buildPrompt, MBTI_LIST } from "./pet-art.mjs";

const ROOT = new URL("../", import.meta.url);
const RAW_DIR = new URL("assets/pets/raw/", ROOT);
const OUT_DIR = new URL("public/pets/", ROOT);

const BASE = process.env.TOKENHUB_BASE || "https://tokenhub.tencentmaas.com";
const MODEL = process.env.TOKENHUB_IMAGE_MODEL || "hy-image-v3.5-preview";

const argv = process.argv.slice(2);
const FORCE = argv.includes("--force");
const SIZE = (argv.find(a => a.startsWith("--size=")) || "--size=1024x1024").split("=")[1];
const MODEL_ARG = (argv.find(a => a.startsWith("--model=")) || "").split("=")[1];
const model = MODEL_ARG || MODEL;
const targets = argv.filter(a => !a.startsWith("--"));
const list = targets.length ? targets : MBTI_LIST;

function loadKey() {
  if (process.env.TOKENHUB_KEY) return process.env.TOKENHUB_KEY.trim();
  const f = new URL(".tokenhub-key", import.meta.url);
  if (existsSync(f)) return readFileSync(f, "utf8").trim();
  console.error("[X] 缺少 API Key。");
  console.error("    请设置环境变量 TOKENHUB_KEY，或把 Key 写进 scripts/.tokenhub-key");
  process.exit(1);
}

// ---------------- 调用生图接口 ----------------
async function generate(key, prompt) {
  const res = await fetch(BASE + "/v1/images/generations", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + key },
    body: JSON.stringify({ model, prompt, n: 1, size: SIZE, response_format: "b64_json" }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error("HTTP " + res.status + " " + text.slice(0, 300));

  let json;
  try { json = JSON.parse(text); }
  catch { throw new Error("返回不是 JSON: " + text.slice(0, 200)); }

  const item = (json.data && json.data[0]) || (json.images && json.images[0]) ||
               (json.result && json.result.images && json.result.images[0]);
  if (!item) throw new Error("无法解析返回结构: " + JSON.stringify(json).slice(0, 400));

  if (item.b64_json) return Buffer.from(item.b64_json, "base64");
  if (item.url) {
    const r = await fetch(item.url);
    if (!r.ok) throw new Error("下载图片失败 HTTP " + r.status);
    return Buffer.from(await r.arrayBuffer());
  }
  throw new Error("item 里既没有 b64_json 也没有 url: " + JSON.stringify(item).slice(0, 300));
}

// ---------------- 抠背景 ----------------
// 从四条边做洪水填充：只清除与画布边缘连通的背景色区域。
// 这样角色内部的白色（眼白、高光）会被保留，不会被一起抠掉。
function removeBackground(png, tolerance) {
  tolerance = tolerance || 46;
  const w = png.width, h = png.height, d = png.data;

  // 取四角平均作为背景色基准
  const corners = [[0, 0], [w - 1, 0], [0, h - 1], [w - 1, h - 1]];
  let br = 0, bg = 0, bb = 0;
  for (const c of corners) {
    const i = (c[1] * w + c[0]) * 4;
    br += d[i]; bg += d[i + 1]; bb += d[i + 2];
  }
  br /= 4; bg /= 4; bb /= 4;

  const dist = (i) => {
    const dr = d[i] - br, dg = d[i + 1] - bg, db = d[i + 2] - bb;
    return Math.sqrt(dr * dr + dg * dg + db * db);
  };

  const isBg = new Uint8Array(w * h);
  const seen = new Uint8Array(w * h);
  const stack = [];
  for (let x = 0; x < w; x++) { stack.push(x, 0); stack.push(x, h - 1); }
  for (let y = 0; y < h; y++) { stack.push(0, y); stack.push(w - 1, y); }

  while (stack.length) {
    const y = stack.pop(), x = stack.pop();
    if (x < 0 || y < 0 || x >= w || y >= h) continue;
    const p = y * w + x;
    if (seen[p]) continue;
    seen[p] = 1;
    if (dist(p * 4) > tolerance) continue;
    isBg[p] = 1;
    stack.push(x + 1, y, x - 1, y, x, y + 1, x, y - 1);
  }

  // 应用：背景全透明；紧邻背景的像素按"离背景色多远"给半透明，消除锯齿
  for (let p = 0; p < w * h; p++) {
    const i = p * 4;
    if (isBg[p]) { d[i + 3] = 0; continue; }

    const x = p % w, y = (p / w) | 0;
    const nearBg =
      (x > 0 && isBg[p - 1]) || (x < w - 1 && isBg[p + 1]) ||
      (y > 0 && isBg[p - w]) || (y < h - 1 && isBg[p + w]);

    if (nearBg) {
      const t = (dist(i) - tolerance * 0.35) / (tolerance * 0.65);
      const a = Math.max(0, Math.min(1, t));
      d[i + 3] = Math.round(d[i + 3] * a);
    }
  }
  return png;
}

// ---------------- 裁切对齐 ----------------
// 按不透明区域的外接框裁掉多余留白再补成正方形。
// 这一步保证 16 张图里角色在画面中的占比和位置完全一致——
// 否则有的顶天立地有的小小一只，摆在一起会很乱。
function fitSquare(png, padRatio) {
  padRatio = padRatio === undefined ? 0.07 : padRatio;
  const w = png.width, h = png.height, d = png.data;

  let minX = w, minY = h, maxX = -1, maxY = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (d[(y * w + x) * 4 + 3] > 12) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return png;

  const cw = maxX - minX + 1, ch = maxY - minY + 1;
  const side = Math.round(Math.max(cw, ch) * (1 + padRatio * 2));
  const out = new PNG({ width: side, height: side });
  const ox = Math.round((side - cw) / 2), oy = Math.round((side - ch) / 2);

  for (let y = 0; y < ch; y++) {
    for (let x = 0; x < cw; x++) {
      const si = ((minY + y) * w + (minX + x)) * 4;
      const di = ((oy + y) * side + (ox + x)) * 4;
      out.data[di] = d[si];
      out.data[di + 1] = d[si + 1];
      out.data[di + 2] = d[si + 2];
      out.data[di + 3] = d[si + 3];
    }
  }
  return out;
}

// ---------------- 缩放（预乘 alpha，避免透明边缘发白） ----------------
function downscale(png, size) {
  const w = png.width, h = png.height, d = png.data;
  const out = new PNG({ width: size, height: size });
  const sx = w / size, sy = h / size;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const x0 = Math.floor(x * sx), x1 = Math.max(x0 + 1, Math.floor((x + 1) * sx));
      const y0 = Math.floor(y * sy), y1 = Math.max(y0 + 1, Math.floor((y + 1) * sy));
      let r = 0, g = 0, b = 0, a = 0, n = 0;

      for (let yy = y0; yy < y1 && yy < h; yy++) {
        for (let xx = x0; xx < x1 && xx < w; xx++) {
          const i = (yy * w + xx) * 4;
          const al = d[i + 3] / 255;
          r += d[i] * al; g += d[i + 1] * al; b += d[i + 2] * al;
          a += d[i + 3];
          n++;
        }
      }
      const o = (y * size + x) * 4;
      const aw = a / 255;
      out.data[o] = aw > 0 ? Math.min(255, Math.round(r / aw)) : 0;
      out.data[o + 1] = aw > 0 ? Math.min(255, Math.round(g / aw)) : 0;
      out.data[o + 2] = aw > 0 ? Math.min(255, Math.round(b / aw)) : 0;
      out.data[o + 3] = Math.round(a / n);
    }
  }
  return out;
}

// ---------------- 主流程 ----------------
async function main() {
  const key = loadKey();
  mkdirSync(RAW_DIR, { recursive: true });
  mkdirSync(OUT_DIR, { recursive: true });

  console.log("模型: " + model);
  console.log("尺寸: " + SIZE);
  console.log("待生成: " + list.length + " 张\n");

  let ok = 0, skip = 0, fail = 0;

  for (const mbti of list) {
    if (!ART[mbti]) { console.log("[?] 跳过未知类型 " + mbti); continue; }

    const rawPath = new URL(mbti + ".png", RAW_DIR);
    const outPath = new URL(mbti + ".png", OUT_DIR);

    if (!FORCE && existsSync(outPath)) {
      console.log("[=] " + mbti + " 已存在，跳过");
      skip++;
      continue;
    }

    process.stdout.write("[>] " + mbti + " 生成中…");
    try {
      const prompt = buildPrompt(mbti);
      let buf;
      if (existsSync(rawPath) && !FORCE) {
        buf = readFileSync(rawPath);
        process.stdout.write(" 复用原图");
      } else {
        buf = await generate(key, prompt);
        writeFileSync(rawPath, buf);
      }

      let png = PNG.sync.read(buf);
      png = removeBackground(png);
      png = fitSquare(png);
      png = downscale(png, 256);
      writeFileSync(outPath, PNG.sync.write(png));

      console.log("  OK -> public/pets/" + mbti + ".png");
      ok++;
    } catch (e) {
      console.log("  失败: " + e.message);
      fail++;
    }
    // 稍微间隔一下，避免触发限流
    await new Promise(r => setTimeout(r, 600));
  }

  console.log("\n完成: 成功 " + ok + " / 跳过 " + skip + " / 失败 " + fail);
  if (fail) process.exitCode = 1;
}

main();
