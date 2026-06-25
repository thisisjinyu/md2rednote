/* 调试面板 · HTML 框展示当前页卡片真实渲染的 HTML；CSS 框按命中标签合并为单行精简声明；
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
  function escapeHtml(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
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

  /* ---------- CSS 面板：收集全部规则，按展示标签合并声明 ---------- */
  function baseSelector(sel) {
    return sel.replace(/::[a-zA-Z-]+(\([^)]*\))?/g, '').trim();
  }
  function selectorHits(selectorText, el) {
    var parts = selectorText.split(',');
    for (var i = 0; i < parts.length; i++) {
      var base = baseSelector(parts[i]);
      if (!base) continue;
      try { if (el.matches(base)) return true; } catch (e) {}
    }
    return false;
  }
  function declsOf(cssText) {
    var i = cssText.indexOf('{'), j = cssText.lastIndexOf('}');
    if (i < 0 || j < 0) return [];
    return cssText.slice(i + 1, j).split(';').map(function (s) { return s.trim(); }).filter(Boolean);
  }
  function flattenRules(ruleList, cond, acc) {
    Array.prototype.forEach.call(ruleList, function (rule) {
      if (rule.type === 1) {
        acc.push({ sel: rule.selectorText, css: rule.cssText, cond: cond });
      } else if (rule.type === 4) {
        flattenRules(rule.cssRules, '@media ' + rule.conditionText, acc);
      } else if (rule.type === 12) {
        flattenRules(rule.cssRules, '@supports ' + (rule.conditionText || ''), acc);
      }
    });
  }
  function elLabel(el) {
    var t = el.tagName.toLowerCase();
    var cls = (el.getAttribute('class') || '').replace(/\binsp-active\b/g, '').trim();
    return t + (cls ? '.' + cls.split(/\s+/).join('.') : '');
  }

  function update() {
    observer.disconnect();
    /* 清掉上一轮的标记与高亮，保证重建状态干净 */
    Array.prototype.forEach.call(card.querySelectorAll('[data-insp-idx]'), function (n) {
      n.removeAttribute('data-insp-idx');
      n.classList.remove('insp-active');
    });
    activeIdx = null;

    /* 1) 卡片内部直接子元素作为顶层，递归输出真实 HTML；同时收集展示出的元素 */
    var rootKids = Array.prototype.filter.call(card.childNodes, function (n) { return n.nodeType === 1; });
    var displayed = [];
    try {
      var html = '';
      rootKids.forEach(function (k) { html += prettyNode(k, 0, displayed); });
      codeHtml.innerHTML = html || '（空）';
    } catch (e) { codeHtml.textContent = card.innerHTML; }

    /* 2) 只针对展示出的标签，把命中规则合并为一个单行声明块（同 idx 与 HTML 联动） */
    var els = displayed;
    var allRules = [];
    Array.prototype.forEach.call(document.styleSheets, function (sheet) {
      var rules = null;
      try { rules = sheet.cssRules; } catch (e) { return; }
      if (rules) flattenRules(rules, '', allRules);
    });
    var groups = [];
    els.forEach(function (el, idx) {
      var map = {}, order = [];
      for (var i = 0; i < allRules.length; i++) {
        if (!selectorHits(allRules[i].sel, el)) continue;
        declsOf(allRules[i].css).forEach(function (d) {
          var ci = d.indexOf(':');
          if (ci < 0) return;
          var name = d.slice(0, ci).trim();
          var value = d.slice(ci + 1).trim();
          var prev = map[name];
          if (prev && /!important/.test(prev) && !/!important/.test(value)) return;
          if (!(name in map)) order.push(name);
          map[name] = value;
        });
      }
      if (!order.length) return;
      var decls = order.map(function (n) { return n + ': ' + map[n] + ';'; }).join(' ');
      groups.push('<span class=' + q + 'insp-c' + q + ' data-idx=' + q + idx + q + '>' + escapeHtml(elLabel(el) + ' { ' + decls + ' }') + '</span>');
    });
    codeCss.innerHTML = groups.length ? groups.join('\n') : '（未匹配到样式规则）';

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
    if (ca.length) mutateCard(function () { Array.prototype.forEach.call(ca, function (n) { n.classList.remove('insp-active'); }); });
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
    var el = card.querySelector('[data-insp-idx=' + q + idx + q + ']');
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
