(function () {
  const CARD = { w: 1080, h: 1440 }; // 固定 3:4 竖版

  // 各风格专属的封面方案（id 唯一，base = 底层构图骨架）
  // 底层构图：top / bottom / split / frame / module / bg
  // 注：本仓库（md2rednote）为 kinfolk 精简版，仅保留 kinfolk。
  // 如需从 md2red 复制回某风格，把该风格的键加回下面两个对象即可。
  const COVER_VARIANTS = {
    kinfolk: [
      { id: "airy", label: "极简留白", base: "top" },
      { id: "square", label: "居中方图", base: "frame" },
      { id: "half", label: "左右半幅", base: "split" },
    ],
  };

  // 各风格页码进度的视觉类型：dots/dashes/bars/numbers/arrows
  const PROGRESS_KIND = {
    kinfolk: "dots",
  };

  // 示例：首页=封面（标题/副标题/描述 + 末尾图片），中间=正文，末页=尾页
  const SAMPLE = `# 少吃一口糖，身体会谢谢你\n## 21 天温和减糖计划\n不靠硬扑，而是重新认识食物。三个不费力的小改变，从今天开始。\n\n![](https://images.pexels.com/photos/6617496/pexels-photo-6617496.jpeg?auto=compress&cs=tinysrgb&w=1200)\n\n---\n\n## 三个温柔的开始\n\n- 把含糖饮料换成**气泡水 + 柠檬**\n- 主食里掺一半**糙米与豆类**\n- 嘴馋时先喝一杯水，==等十分钟==\n\n![](https://images.pexels.com/photos/27850094/pexels-photo-27850094.jpeg?auto=compress&cs=tinysrgb&w=1200)\n\n---\n\n## 为什么有效\n\n血糖平稳了，*情绪和精力*也会跟着稳。\n\n1. 减少胰岛素的剧烈波动\n2. 延长饱腹感，自然少吃\n3. 让味觉慢慢变得敏锐\n\n> 改变不必剧烈，坚持才会发光。\n\n![](https://images.pexels.com/photos/4909324/pexels-photo-4909324.jpeg?auto=compress&cs=tinysrgb&w=1200)\n\n---\n\n# 从今天开始\n## 给身体多一点温柔\n少吃一口糖，不是剥夺，而是更懂得照顾自己。\n\n如果这份计划帮到你，点亮**收藏**，明天接着看。\n\n> 关注 · 一起慢慢变好`;

  const $ = (id) => document.getElementById(id);
  const input = $("input");
  const card = $("card");
  const frame = $("frame");
  const stage = $("stage");
  const counter = $("counter");

  let pages = [];
  let index = 0;

  // 图片取色缓存：url -> 631 调色板 | null(失败)
  const colorCache = {};

  // 预览缩放比例（屏幕像素 → 卡片像素换算用）
  let fitScale = 1;
  // 图片的缩放/位移状态：页索引 -> { scale, x, y }（每页独立，封面与正文各自）
  const imgXform = {};
  // 当前拖拽会话
  let drag = null;

  function splitPages(md) {
    const parts = md.split(/^\s*---\s*$/m).map((s) => s.trim()).filter(Boolean);
    return parts.length ? parts : [""];
  }

  function setSize() {
    card.style.setProperty("--card-w", CARD.w + "px");
    card.style.setProperty("--card-h", CARD.h + "px");
  }

  function fit() {
    const pad = 48;
    const availW = stage.clientWidth - pad;
    const availH = stage.clientHeight - pad;
    const scale = Math.min(availW / CARD.w, availH / CARD.h, 1);
    fitScale = scale;
    card.style.transform = `scale(${scale})`;
    frame.style.width = CARD.w * scale + "px";
    frame.style.height = CARD.h * scale + "px";
  }

  function escapeAttr(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;");
  }

  /* ---------- 图片：固定图框 + 框内拖拽缩放（封面 / 正文末尾图复用同一套） ---------- */
  // 抽出末尾的图片（最后一个含 img 的 figure），余下作为文字
  function splitTrailingFigure(md) {
    const tmp = document.createElement("div");
    tmp.innerHTML = md;
    const figs = tmp.querySelectorAll("figure");
    let fig = null;
    for (let i = figs.length - 1; i >= 0; i--) {
      if (figs[i].querySelector("img")) { fig = figs[i]; break; }
    }
    if (!fig) return { textHtml: md, imgHtml: "" };
    const img = fig.querySelector("img");
    const imgHtml = img ? img.outerHTML : "";
    fig.remove();
    return { textHtml: tmp.innerHTML, imgHtml };
  }

  // 应用缩放/位移，并限制边界（缩放=1 不可平移；放大后平移不露白）
  function applyXform(box, img, st) {
    const bw = box.clientWidth, bh = box.clientHeight;
    const maxX = bw * (st.scale - 1) / 2;
    const maxY = bh * (st.scale - 1) / 2;
    st.x = Math.max(-maxX, Math.min(maxX, st.x));
    st.y = Math.max(-maxY, Math.min(maxY, st.y));
    img.style.transform = `translate(${st.x}px, ${st.y}px) scale(${st.scale})`;
  }

  // 给指定图框绑定拖拽平移 + 滚轮缩放（状态按页独立）
  function bindPanZoom(box, idx) {
    if (!box) return;
    const img = box.querySelector("img");
    if (!img) return;
    const st = imgXform[idx] || (imgXform[idx] = { scale: 1, x: 0, y: 0 });
    const reapply = () => applyXform(box, img, st);
    reapply();
    if (!img.complete) img.addEventListener("load", reapply, { once: true });
    box.addEventListener("mousedown", (e) => {
      drag = { st, box, img, sx: e.clientX, sy: e.clientY, ox: st.x, oy: st.y };
      e.preventDefault();
    });
    box.addEventListener("wheel", (e) => {
      e.preventDefault();
      const f = e.deltaY < 0 ? 1.06 : 1 / 1.06;
      st.scale = Math.max(1, Math.min(5, st.scale * f));
      applyXform(box, img, st);
    }, { passive: false });
  }
  // 正文末尾固定图框
  function setupBodyFigure(idx) { bindPanZoom(card.querySelector(".body-figure"), idx); }
  // 封面图（Kinfolk 统一有图）
  function setupCoverImage(idx) { bindPanZoom(card.querySelector(".card-media"), idx); }

  /* ---------- 下拉：按风格填充专属封面方案 ---------- */
  function variantsFor(theme) { return COVER_VARIANTS[theme] || []; }
  function populateLayoutOptions(theme) {
    const sel = $("imageLayout");
    const prev = sel.value;
    const list = variantsFor(theme);
    sel.innerHTML = "";
    list.forEach((v) => {
      const o = document.createElement("option");
      o.value = v.id; o.textContent = v.label;
      sel.appendChild(o);
    });
    const hasPrev = Array.prototype.some.call(sel.options, (o) => o.value === prev);
    sel.value = hasPrev ? prev : (list.length ? list[0].id : "");
  }

  // 页眉右上角页码进度：当前页用突出色，其他页弱化
  function buildProgress(theme, cur, tot) {
    if (tot < 1) return "";
    const kind = PROGRESS_KIND[theme] || "dots";
    let marks = "";
    for (let i = 1; i <= tot; i++) {
      const on = i === cur ? " active" : "";
      let glyph = "";
      if (kind === "numbers") glyph = String(i).padStart(2, "0");
      else if (kind === "arrows") glyph = i === cur ? "▶" : "›";
      marks += `<span class="pg${on}">${glyph}</span>`;
    }
    return `<div class="card-progress kind-${kind}">${marks}</div>`;
  }

  /* ---------- 颜色工具 ---------- */
  function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0; const l = (max + min) / 2;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h /= 6;
    }
    return [h, s, l];
  }
  function clamp(x, lo, hi) { return Math.min(hi, Math.max(lo, x)); }
  function hslToHex(h, s, l) {
    h = ((h % 1) + 1) % 1;
    let r, g, b;
    if (s === 0) { r = g = b = l; }
    else {
      const hue2rgb = (p, q, t) => {
        if (t < 0) t += 1; if (t > 1) t -= 1;
        if (t < 1 / 6) return p + (q - p) * 6 * t;
        if (t < 1 / 2) return q;
        if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
        return p;
      };
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, h + 1 / 3); g = hue2rgb(p, q, h); b = hue2rgb(p, q, h - 1 / 3);
    }
    const to = (x) => Math.round(x * 255).toString(16).padStart(2, "0");
    return "#" + to(r) + to(g) + to(b);
  }

  // 从图片提取主色调 → 生成 6:3:1 调色板
  function extractPalette(img) {
    const w = 64, h = 64;
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const ctx = c.getContext("2d");
    ctx.drawImage(img, 0, 0, w, h);
    const data = ctx.getImageData(0, 0, w, h).data;
    const buckets = {};
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
      if (a < 125) continue;
      const key = (r >> 4) + "-" + (g >> 4) + "-" + (b >> 4);
      let bk = buckets[key];
      if (!bk) bk = buckets[key] = { r: 0, g: 0, b: 0, n: 0 };
      bk.r += r; bk.g += g; bk.b += b; bk.n++;
    }
    const arr = Object.values(buckets).map((b) => ({
      r: b.r / b.n, g: b.g / b.n, b: b.b / b.n, n: b.n,
    }));
    if (!arr.length) return null;
    arr.sort((a, b) => b.n - a.n);
    let base = null, best = -1;
    for (const c2 of arr) {
      const hsl = rgbToHsl(c2.r, c2.g, c2.b);
      if (hsl[2] < 0.12 || hsl[2] > 0.9) continue;
      const score = hsl[1] * Math.log(c2.n + 1);
      if (score > best) { best = score; base = c2; }
    }
    if (!base) base = arr[0];
    const [bh, bs0] = rgbToHsl(base.r, base.g, base.b);
    const bs = clamp(bs0, 0.35, 0.8);
    const bg  = hslToHex(bh, Math.min(bs * 0.42, 0.22), 0.94);
    const bg2 = hslToHex(bh, Math.min(bs * 0.38, 0.18), 0.965);
    const ink = hslToHex(bh, Math.min(bs * 0.75, 0.5), 0.20);
    const dim = hslToHex(bh, Math.min(bs * 0.5, 0.35), 0.46);
    const rule = hslToHex(bh, Math.min(bs * 0.42, 0.3), 0.72);
    const ch = bh + 0.5;
    const cs = clamp(bs0 * 1.3, 0.6, 0.92);
    const accent = hslToHex(ch, cs, 0.46);
    return { bg, bg2, ink, dim, rule, accent };
  }

  function ensureColors(url) {
    if (!url) return Promise.resolve(null);
    if (url in colorCache) return Promise.resolve(colorCache[url]);
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        try { colorCache[url] = extractPalette(img); }
        catch (e) { colorCache[url] = null; }
        resolve(colorCache[url]);
      };
      img.onerror = () => { colorCache[url] = null; resolve(null); };
      img.src = url;
    });
  }

  // 取封面图链接（首页 markdown 末尾的图片），整套配色由它驱动
  function coverImgSrc() {
    const tmp = document.createElement("div");
    tmp.innerHTML = window.mdToHtml(pages[0] || "");
    const figs = tmp.querySelectorAll("figure");
    for (let j = figs.length - 1; j >= 0; j--) {
      const img = figs[j].querySelector("img");
      if (img) return img.getAttribute("src") || "";
    }
    return "";
  }

  const PAL_VARS = ["--card-bg", "--card-bg-2", "--card-ink", "--card-dim", "--card-rule", "--card-accent"];
  function applyColorsToCard() {
    const on = $("autoColor").checked;
    const url = coverImgSrc();
    const pal = on && url ? colorCache[url] : null;
    if (pal) {
      card.style.setProperty("--card-bg", pal.bg);
      card.style.setProperty("--card-bg-2", pal.bg2);
      card.style.setProperty("--card-ink", pal.ink);
      card.style.setProperty("--card-dim", pal.dim);
      card.style.setProperty("--card-rule", pal.rule);
      card.style.setProperty("--card-accent", pal.accent);
    } else {
      PAL_VARS.forEach((v) => card.style.removeProperty(v));
    }
  }

  function renderPage(i) {
    const total = pages.length;
    index = Math.max(0, Math.min(i, total - 1));
    setSize();

    const theme = $("theme").value;
    const isCover = index === 0;
    const isEnd = total > 1 && index === total - 1;
    const isBody = !isCover && !isEnd;
    const noImg = $("noImage").checked;

    const list = variantsFor(theme);
    const variantId = $("imageLayout").value;
    const variant = list.find((v) => v.id === variantId);
    // Kinfolk 统一有图：封面/正文/尾页始终走有图版式，忽略“无图”开关
    const isKin = theme === "kinfolk";
    const base = variant ? ((isKin || !noImg) ? variant.base : "none") : "none";

    // 三部分都从各自 markdown 末尾抽取图片：封页→封面图框，正文/尾页→正文图框
    const md = window.mdToHtml(pages[index]);
    const figRole = isKin ? true : isBody;
    const fig = figRole ? splitTrailingFigure(md) : null;
    const hasFig = !!(fig && fig.imgHtml);
    const textHtml = fig ? fig.textHtml : md;
    // 封面用 card-media 图框；正文/尾页用 body-figure 图框
    const useImg = base !== "none" && isCover && (isKin || hasFig);
    const useBox = isKin ? (isBody || isEnd) : (isBody && hasFig);

    // 同步控件可用状态：无图时禁用方案（Kinfolk 统一有图，保持可用）
    $("imageLayout").disabled = (noImg && !isKin) || list.length === 0;

    const cls = ["card"];
    if (isCover) cls.push("role-cover");
    else if (isEnd) cls.push("role-body", "role-end");
    else cls.push("role-body");
    if (useImg) { cls.push("has-img", "layout-" + base, "cv-" + theme + "-" + variantId); }
    if (useBox) cls.push("bf");
    card.className = cls.join(" ");
    card.setAttribute("data-theme", theme);

    const eyebrow = $("eyebrow").value.trim();
    const brand = $("brand").value.trim();
    const no = String(index + 1).padStart(2, "0");
    const tot = String(total).padStart(2, "0");

    // 正文页码按顺序编排（不含首页封面与末页尾页）
    const bodyTotal = Math.max(0, total - 2);
    const bodyNo = isBody ? index : 0;

    const eyebrowHtml = eyebrow ? `<div class="card-eyebrow">${escapeAttr(eyebrow)}</div>` : "";
    const progressHtml = isBody ? buildProgress(theme, bodyNo, bodyTotal) : "";
    const headHtml = isBody
      ? `<div class="card-head">${eyebrowHtml}${progressHtml}</div>`
      : eyebrowHtml;
    const bodyInner = useBox
      ? `<div class="body-text">${textHtml}</div><div class="body-figure${hasFig ? "" : " is-empty"}">${hasFig ? fig.imgHtml : ""}</div>`
      : textHtml;
    const bodyHtml = `<div class="card-body">${bodyInner}</div>`;
    const footHtml = `<div class="card-foot"><span class="card-brand">${escapeAttr(brand)}</span></div>`;
    // 无图正文页（非 Kinfolk）：底部大序号锁点，消费下方留白
    const anchorHtml = (isBody && !useBox)
      ? `<div class="card-anchor">${String(bodyNo).padStart(2, "0")}</div>`
      : "";

    // 封面图框：取自本页 markdown 末尾图片；无图显示占位框
    const media = useImg
      ? `<div class="card-media${hasFig ? "" : " is-empty"}">${hasFig ? fig.imgHtml : ""}</div>`
      : "";

    let inner;
    if (!useImg) {
      inner = headHtml + bodyHtml + footHtml;
    } else if (base === "module") {
      inner = headHtml + `<div class="card-body">${media}${textHtml}</div>` + footHtml;
    } else if (base === "frame") {
      inner = media + headHtml + bodyHtml + footHtml;
    } else if (base === "bg") {
      inner = media + `<div class="li-content"><div class="li-panel">${headHtml}${bodyHtml}</div>${footHtml}</div>`;
    } else if (base === "bottom") {
      inner = `<div class="li-content">${headHtml}${bodyHtml}${footHtml}</div>` + media;
    } else {
      inner = media + `<div class="li-content">${headHtml}${bodyHtml}${footHtml}</div>`;
    }
    card.innerHTML = inner + anchorHtml;
    applyColorsToCard();
    if (useBox) setupBodyFigure(index);
    // 封面图可拖拽缩放（Kinfolk 统一有图，有真实图片时）
    if (isCover && useImg && isKin && hasFig) setupCoverImage(index);

    counter.textContent = `${no} / ${tot}`;
    fit();
  }

  function refresh() {
    const on = $("autoColor").checked;
    const url = coverImgSrc();
    if (on && url && !(url in colorCache)) {
      ensureColors(url).then(() => renderPage(index));
    } else {
      renderPage(index);
    }
  }

  function rebuild(keepIndex) {
    pages = splitPages(input.value);
    const target = keepIndex ? index : 0;
    const on = $("autoColor").checked;
    const url = coverImgSrc();
    if (on && url && !(url in colorCache)) {
      ensureColors(url).then(() => renderPage(target));
    } else {
      renderPage(target);
    }
  }

  function onThemeChange() {
    populateLayoutOptions($("theme").value);
    renderPage(index);
  }

  /* ---------- 导出 PDF（浏览器原生打印，矢量输出，不再用 html2canvas 光栅化） ---------- */
  // 把指定页渲染成全尺寸卡片克隆，放进打印容器；每张卡片占一页
  function buildPrintRoot(indices) {
    const old = document.getElementById("print-root");
    if (old) old.remove();
    const root = document.createElement("div");
    root.id = "print-root";
    const cur = index;
    indices.forEach((i) => {
      renderPage(i);
      const clone = card.cloneNode(true);
      clone.removeAttribute("id");
      clone.style.transform = "none";    // 全尺寸输出，去掉预览缩放
      const page = document.createElement("div");
      page.className = "print-page";
      page.appendChild(clone);
      root.appendChild(page);
    });
    document.body.appendChild(root);
    renderPage(cur); // 还原预览
    return root;
  }

  async function exportPdf(indices) {
    if (document.fonts) { try { await document.fonts.ready; } catch (e) {} }
    if ($("autoColor").checked) { await ensureColors(coverImgSrc()); }
    const root = buildPrintRoot(indices);
    const cleanup = () => {
      root.remove();
      window.removeEventListener("afterprint", cleanup);
    };
    window.addEventListener("afterprint", cleanup);
    // 留一帧让打印布局生效再唤起打印对话框（在对话框中选“另存为 PDF”）
    setTimeout(() => window.print(), 80);
  }

  function exportOne() { return exportPdf([index]); }
  function exportAll() { return exportPdf(pages.map((_, i) => i)); }

  input.addEventListener("input", () => rebuild(true));
  $("theme").addEventListener("change", onThemeChange);
  $("imageLayout").addEventListener("change", () => renderPage(index));
  $("noImage").addEventListener("change", () => renderPage(index));
  $("autoColor").addEventListener("change", () => refresh());
  $("eyebrow").addEventListener("input", () => renderPage(index));
  $("brand").addEventListener("input", () => renderPage(index));
  $("prev").addEventListener("click", () => renderPage(index - 1));
  $("next").addEventListener("click", () => renderPage(index + 1));
  $("exportOne").addEventListener("click", exportOne);
  $("exportAll").addEventListener("click", exportAll);
  $("loadSample").addEventListener("click", () => { input.value = SAMPLE; rebuild(false); });
  window.addEventListener("resize", fit);

  // 图框内拖拽平移：全局监听一次，避免重复绑定
  document.addEventListener("mousemove", (e) => {
    if (!drag) return;
    const k = fitScale || 1;
    drag.st.x = drag.ox + (e.clientX - drag.sx) / k;
    drag.st.y = drag.oy + (e.clientY - drag.sy) / k;
    applyXform(drag.box, drag.img, drag.st);
  });
  document.addEventListener("mouseup", () => { drag = null; });

  populateLayoutOptions($("theme").value);
  input.value = SAMPLE;
  rebuild(false);
})();
