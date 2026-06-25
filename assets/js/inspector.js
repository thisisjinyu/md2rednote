/* 调试面板 · HTML 框展示当前页卡片内部真实渲染的 HTML（含文字与内联标签）；
   CSS 框展示这些标签命中的规则（按标签分组）。封面/正文/尾页切换时随 #card 自动刷新，与 app.js 解耦。 */
(function () {
  var card = document.getElementById('card');
  var codeHtml = document.getElementById('codeHtml');
  var codeCss = document.getElementById('codeCss');
  if (!card || !codeHtml || !codeCss) return;
  var q = String.fromCharCode(34);
  var VOID = { img: 1, br: 1, hr: 1, input: 1, meta: 1, link: 1, source: 1 };
  var INLINE = { strong: 1, em: 1, mark: 1, a: 1, code: 1, span: 1, sub: 1, sup: 1, i: 1, b: 1, u: 1, s: 1, del: 1, br: 1, img: 1 };

  /* ---------- HTML 面板：输出卡片内部真实渲染的 HTML（含文字、内联标签），按层缩进 ---------- */
  function elAttrs(node) {
    var attrs = '';
    Array.prototype.forEach.call(node.attributes, function (a) {
      attrs += ' ' + a.name + '=' + q + a.value + q;
    });
    return attrs;
  }
  function collapse(s) { return s.replace(/\s+/g, ' '); }
  function prettyNode(node, depth) {
    var pad = '  '.repeat(depth);
    if (node.nodeType === 3) {
      var txt = collapse(node.textContent).trim();
      return txt ? pad + txt + '\n' : '';
    }
    if (node.nodeType !== 1) return '';
    var tag = node.tagName.toLowerCase();
    var open = '<' + tag + elAttrs(node) + '>';
    if (VOID[tag]) return pad + open + '\n';
    var elKids = Array.prototype.filter.call(node.childNodes, function (n) { return n.nodeType === 1; });
    var allInline = elKids.every(function (k) { return INLINE[k.tagName.toLowerCase()]; });
    if (allInline) {
      var inner = collapse(node.innerHTML).trim();
      return pad + open + inner + '</' + tag + '>\n';
    }
    var kids = Array.prototype.filter.call(node.childNodes, function (n) {
      return n.nodeType === 1 || (n.nodeType === 3 && n.textContent.trim());
    });
    var out = pad + open + '\n';
    kids.forEach(function (k) { out += prettyNode(k, depth + 1); });
    return out + pad + '</' + tag + '>\n';
  }

  /* ---------- CSS 面板：收集全部规则（含 @media/@supports 嵌套），再按展示的标签逐个匹配并去重 ---------- */
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
    var cls = (el.getAttribute('class') || '').trim();
    return t + (cls ? '.' + cls.split(/\s+/).join('.') : '');
  }

  function update() {
    /* 1) 卡片内部的直接子元素作为顶层，递归输出真实 HTML */
    var rootKids = Array.prototype.filter.call(card.childNodes, function (n) { return n.nodeType === 1; });
    try {
      var html = '';
      rootKids.forEach(function (k) { html += prettyNode(k, 0); });
      codeHtml.textContent = html || '（空）';
    } catch (e) { codeHtml.textContent = card.innerHTML; }

    /* 2) 只针对 HTML 框里展示的那些标签（卡片内部元素，不含 .card 包裹层）按顺序分组输出 CSS */
    var els = Array.prototype.slice.call(card.querySelectorAll('*'));
    var allRules = [];
    Array.prototype.forEach.call(document.styleSheets, function (sheet) {
      var rules = null;
      try { rules = sheet.cssRules; } catch (e) { return; }
      if (rules) flattenRules(rules, '', allRules);
    });
    var used = {};
    var groups = [];
    els.forEach(function (el) {
      var matched = [];
      for (var i = 0; i < allRules.length; i++) {
        if (used[i]) continue;
        if (selectorHits(allRules[i].sel, el)) { used[i] = 1; matched.push(allRules[i]); }
      }
      if (matched.length) {
        var body = matched.map(function (r) {
          return r.cond ? r.cond + ' {\n  ' + r.css + '\n}' : r.css;
        }).join('\n');
        groups.push('/* ' + elLabel(el) + ' */\n' + body);
      }
    });
    codeCss.textContent = groups.length ? groups.join('\n\n') : '（未匹配到样式规则）';
  }

  var raf = 0;
  function schedule() {
    if (raf) return;
    raf = requestAnimationFrame(function () { raf = 0; update(); });
  }
  new MutationObserver(schedule).observe(card, { childList: true, subtree: true, attributes: true, characterData: true });
  schedule();
})();
