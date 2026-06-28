/* 调试面板 · HTML 框展示当前页卡片真实渲染的 HTML（从卡片根节点起，含外框）；
   CSS 框改为「关键信息摘要」：按标签显示 盒模型 / 配色 / 排版 三类实际渲染值（getComputedStyle）。
   三栏联动：点击「展示 / HTML / CSS」任一处，另两处对应部分高亮（再点一下取消）。
   随 #card 自动刷新，与 app.js 解耦。所有对 #card 的标记/高亮写入都在 observer 断开期间进行，避免反馈循环。 */
(function () {
  var card = document.getElementById('card');
  var codeHtml = document.getElementById('codeHtml');
  var codeCss = document.getElementById('codeCss');
  if (!card || !codeHtml || !codeCss) return;
  var q = String.fromCharCode(34);
  var VOID = { img: 1, br: 1, hr: 1, input: 1, meta: 1, link: 1, source: 1 };
  var INLINE = { strong: 1, em: 1, mark: 1, a: 1, code: 1, span: 1, sub: 1, sup: 1, i: 1, b: 1, u: 1, s: 1, del: 1, br: 1, img: 1 };
  var activeIdx = null;

  /* ---------- HTML 面板：输出真实渲染的 HTML，每个独立节点包 span（data-idx）并记入 acc/卡片元素 ---------- */
  function elAttrs(node) {
    var attrs = '';
    Array.prototype.forEach.call(node.attributes, function (a) {
      if (a.name === 'data-insp-idx') return;
      attrs += ' ' + a.name + '=' + q + a.value + q;
    });
    return attrs;
  }
  function collapse(s) { return s.replace(/\s+/g, ' '); }
  function escapeHtml(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function tagSpan(idx, text) { return '<span class=' + q + 'insp-h' + q + ' data-idx=' + q + idx + q + '>' + escapeHtml(text) + '</span>'; }

  function prettyNode(node, depth, acc) {
    var pad = '  '.repeat(depth);
    if (node.nodeType === 3) {
      var txt = collapse(node.textContent).trim();
      return txt ? pad + escapeHtml(txt) + '\n' : '';
    }
    if (node.nodeType !== 1) return '';
    var idx = acc.length;
    acc.push(node);
    var tag = node.tagName.toLowerCase();
    var open = '<' + tag + elAttrs(node) + '>';
    node.setAttribute('data-insp-idx', idx);
    if (VOID[tag]) return pad + tagSpan(idx, open) + '\n';
    var elKids = Array.prototype.filter.call(node.childNodes, function (n) { return n.nodeType === 1; });
    var allInline = elKids.every(function (k) { return INLINE[k.tagName.toLowerCase()]; });
    if (allInline) {
      var inner = collapse(node.innerHTML).trim();
      return pad + tagSpan(idx, open + inner + '</' + tag + '>') + '\n';
    }
    var kids = Array.prototype.filter.call(node.childNodes, function (n) {
      return n.nodeType === 1 || (n.nodeType === 3 && n.textContent.trim());
    });
    var out = pad + tagSpan(idx, open) + '\n';
    kids.forEach(function (k) { out += prettyNode(k, depth + 1, acc); });
    return out + pad + tagSpan(idx, '</' + tag + '>') + '\n';
  }

  /* ---------- CSS 面板：关键信息摘要（实际渲染值） ---------- */
  function elLabel(el) {
    var t = el.tagName.toLowerCase();
    var cls = (el.getAttribute('class') || '').replace(/\binsp-active\b/g, '').trim();
    return t + (cls ? '.' + cls.split(/\s+/).join('.') : '');
  }
  function px(v) { var n = parseFloat(v); return isNaN(n) ? v : Math.round(n) + 'px'; }
  // 四边简写：全等→一个；上下/左右相等→两个；否则→四个（上 右 下 左）
  function boxShort(t, r, b, l) {
    t = px(t); r = px(r); b = px(b); l = px(l);
    if (t === r && r === b && b === l) return t;
    if (t === b && l === r) return t + ' ' + l;
    return t + ' ' + r + ' ' + b + ' ' + l;
  }
  // 颜色文本：rgb/rgba → #hex（带透明判断）
  function colorText(v) {
    v = String(v || '').trim();
    var m = v.match(/^rgba?\(([^)]+)\)/);
    if (m) {
      var p = m[1].split(',').map(function (x) { return parseFloat(x); });
      if (p.length >= 4 && p[3] === 0) return '透明';
      var hex = '#' + [p[0], p[1], p[2]].map(function (x) { return ('0' + Math.round(x).toString(16)).slice(-2); }).join('');
      return (p.length >= 4 && p[3] < 1) ? hex + ' /' + p[3] : hex;
    }
    return v;
  }
  function swatch(color) { return '<i class=' + q + 'insp-sw' + q + ' style=' + q + 'background:' + color + q + '></i>'; }
  function colorField(label, color) { return escapeHtml(label) + ' ' + swatch(color) + escapeHtml(colorText(color)); }
  function kv(label, html) { return '  <span class=' + q + 'insp-k' + q + '>' + escapeHtml(label) + '</span>  ' + html; }

  function summarize(el, idx) {
    var cs = getComputedStyle(el);
    var lines = [];

    /* 盒模型：尺寸 / 位置 / 内距 / 边框 */
    var size = Math.round(el.offsetWidth) + '×' + Math.round(el.offsetHeight);
    var posStr = cs.position;
    if (cs.position !== 'static') {
      ['top', 'right', 'bottom', 'left'].forEach(function (side) {
        var v = cs[side];
        if (v && v !== 'auto') posStr += ' ' + side.charAt(0) + ':' + px(v);
      });
    }
    var pad = boxShort(cs.paddingTop, cs.paddingRight, cs.paddingBottom, cs.paddingLeft);
    var hasBorder = parseFloat(cs.borderTopWidth) > 0 || parseFloat(cs.borderLeftWidth) > 0
      || parseFloat(cs.borderRightWidth) > 0 || parseFloat(cs.borderBottomWidth) > 0;
    var borderHtml;
    if (hasBorder) {
      var bw = boxShort(cs.borderTopWidth, cs.borderRightWidth, cs.borderBottomWidth, cs.borderLeftWidth);
      borderHtml = escapeHtml(bw + ' ' + cs.borderTopStyle + ' ') + swatch(cs.borderTopColor) + escapeHtml(colorText(cs.borderTopColor));
    } else {
      borderHtml = escapeHtml('无');
    }
    lines.push(kv('盒模型', escapeHtml(size + '  ·  ' + posStr + '  ·  内距 ' + pad + '  ·  边框 ') + borderHtml));

    /* 配色：背景 / 文字 / 强调色 */
    var accent = (cs.getPropertyValue('--card-accent') || '').trim();
    var colorHtml = colorField('背景', cs.backgroundColor) + '   ' + colorField('文字', cs.color);
    if (accent) colorHtml += '   ' + colorField('强调', accent);
    lines.push(kv('配色', colorHtml));

    /* 排版：字体 / 字号 / 行高 / 对齐 */
    var fam = cs.fontFamily.split(',')[0].replace(/["']/g, '').trim();
    var lh = cs.lineHeight === 'normal' ? 'normal' : px(cs.lineHeight);
    lines.push(kv('排版', escapeHtml(fam + '  ·  ' + cs.fontSize + '  ·  行高 ' + lh + '  ·  ' + cs.textAlign)));

    return '<span class=' + q + 'insp-c' + q + ' data-idx=' + q + idx + q + '><b class=' + q + 'insp-tag' + q + '>' + escapeHtml(elLabel(el)) + '</b>\n' + lines.join('\n') + '</span>';
  }

  function update() {
    observer.disconnect();
    /* 清掉上一轮的标记与高亮（含卡片根节点自身），保证重建状态干净 */
    card.removeAttribute('data-insp-idx');
    card.classList.remove('insp-active');
    Array.prototype.forEach.call(card.querySelectorAll('[data-insp-idx]'), function (n) {
      n.removeAttribute('data-insp-idx');
      n.classList.remove('insp-active');
    });
    activeIdx = null;

    /* 1) 从卡片根节点（含 24px 外框）开始递归输出真实 HTML；同时收集展示出的元素 */
    var displayed = [];
    try {
      var html = prettyNode(card, 0, displayed);
      codeHtml.innerHTML = html || '（空）';
    } catch (e) { codeHtml.textContent = card.outerHTML; }

    /* 2) 对每个展示出的标签输出关键信息摘要（同 idx 与 HTML 联动） */
    var groups = displayed.map(function (el, idx) { return summarize(el, idx); });
    codeCss.innerHTML = groups.length ? groups.join('\n') : '（空）';

    connectObs();
  }

  /* ---------- 联动高亮 ---------- */
  var raf = 0;
  function schedule() {
    if (raf) return;
    raf = requestAnimationFrame(function () { raf = 0; update(); });
  }
  var observer = new MutationObserver(schedule);
  function connectObs() {
    observer.observe(card, { childList: true, subtree: true, attributes: true, characterData: true });
  }
  function mutateCard(fn) {
    observer.disconnect();
    try { fn(); } finally { connectObs(); }
  }
  function addClass(list, cls) {
    Array.prototype.forEach.call(list, function (n) { n.classList.add(cls); });
  }
  function clearActive() {
    Array.prototype.forEach.call(codeHtml.querySelectorAll('.insp-active'), function (n) { n.classList.remove('insp-active'); });
    Array.prototype.forEach.call(codeCss.querySelectorAll('.insp-active'), function (n) { n.classList.remove('insp-active'); });
    var ca = card.querySelectorAll('.insp-active');
    var cardActive = card.classList.contains('insp-active');
    if (ca.length || cardActive) mutateCard(function () {
      Array.prototype.forEach.call(ca, function (n) { n.classList.remove('insp-active'); });
      if (cardActive) card.classList.remove('insp-active');
    });
  }
  function setActive(idx) {
    if (idx != null && idx === activeIdx) { clearActive(); activeIdx = null; return; }
    clearActive();
    activeIdx = idx;
    if (idx == null) return;
    var hs = codeHtml.querySelectorAll('[data-idx=' + q + idx + q + ']');
    addClass(hs, 'insp-active');
    var cs = codeCss.querySelectorAll('[data-idx=' + q + idx + q + ']');
    addClass(cs, 'insp-active');
    var el = card.getAttribute('data-insp-idx') === idx ? card : card.querySelector('[data-insp-idx=' + q + idx + q + ']');
    if (el) mutateCard(function () { el.classList.add('insp-active'); });
    if (hs[0]) hs[0].scrollIntoView({ block: 'nearest' });
    if (cs[0]) cs[0].scrollIntoView({ block: 'nearest' });
  }

  codeHtml.addEventListener('click', function (e) { var n = e.target.closest('.insp-h'); if (n) setActive(n.getAttribute('data-idx')); });
  codeCss.addEventListener('click', function (e) { var n = e.target.closest('.insp-c'); if (n) setActive(n.getAttribute('data-idx')); });
  card.addEventListener('click', function (e) { var n = e.target.closest('[data-insp-idx]'); if (n) setActive(n.getAttribute('data-insp-idx')); });

  connectObs();
  schedule();
})();
