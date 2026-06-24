/* 调试面板 · 实时显示当前展示页的 HTML 与命中的 CSS 规则；监听 #card 自动刷新，与 app.js 解耦 */
(function () {
  var card = document.getElementById("card");
  var codeHtml = document.getElementById("codeHtml");
  var codeCss = document.getElementById("codeCss");
  if (!card || !codeHtml || !codeCss) return;
  var q = String.fromCharCode(34);
  var VOID = { img: 1, br: 1, hr: 1, input: 1, meta: 1, link: 1, source: 1 };

  function prettyNode(node, depth) {
    var pad = "  ".repeat(depth);
    if (node.nodeType === 3) {
      var t = node.textContent.replace(/\s+/g, " ").trim();
      return t ? pad + t + "\n" : "";
    }
    if (node.nodeType !== 1) return "";
    var tag = node.tagName.toLowerCase();
    var attrs = "";
    Array.prototype.forEach.call(node.attributes, function (a) {
      attrs += " " + a.name + "=" + q + a.value + q;
    });
    if (VOID[tag]) return pad + "<" + tag + attrs + ">\n";
    var kids = Array.prototype.filter.call(node.childNodes, function (n) {
      return !(n.nodeType === 3 && !n.textContent.trim());
    });
    if (kids.length === 0) return pad + "<" + tag + attrs + "></" + tag + ">\n";
    if (kids.length === 1 && kids[0].nodeType === 3) {
      return pad + "<" + tag + attrs + ">" + kids[0].textContent.trim() + "</" + tag + ">\n";
    }
    var out = pad + "<" + tag + attrs + ">\n";
    kids.forEach(function (k) { out += prettyNode(k, depth + 1); });
    return out + pad + "</" + tag + ">\n";
  }

  function baseSelector(sel) {
    return sel.replace(/::[a-zA-Z-]+(\([^)]*\))?/g, "").trim();
  }
  function selectorHits(selectorText, els) {
    var parts = selectorText.split(",");
    for (var i = 0; i < parts.length; i++) {
      var base = baseSelector(parts[i]);
      if (!base) continue;
      for (var j = 0; j < els.length; j++) {
        try { if (els[j].matches(base)) return true; } catch (e) {}
      }
    }
    return false;
  }
  function collectCss(els, ruleList, out) {
    Array.prototype.forEach.call(ruleList, function (rule) {
      if (rule.type === 1) {
        if (selectorHits(rule.selectorText, els)) out.push(rule.cssText);
      } else if (rule.type === 4) {
        var inner = [];
        collectCss(els, rule.cssRules, inner);
        if (inner.length) out.push("@media " + rule.conditionText + " {\n  " + inner.join("\n  ") + "\n}");
      } else if (rule.type === 12) {
        var inner2 = [];
        collectCss(els, rule.cssRules, inner2);
        if (inner2.length) out.push("@supports " + (rule.conditionText || "") + " {\n  " + inner2.join("\n  ") + "\n}");
      }
    });
  }

  function update() {
    try { codeHtml.textContent = prettyNode(card, 0); }
    catch (e) { codeHtml.textContent = card.outerHTML; }
    var els = [card].concat(Array.prototype.slice.call(card.querySelectorAll("*")));
    var out = [];
    Array.prototype.forEach.call(document.styleSheets, function (sheet) {
      var rules = null;
      try { rules = sheet.cssRules; } catch (e) { return; }
      if (!rules) return;
      collectCss(els, rules, out);
    });
    codeCss.textContent = out.length ? out.join("\n\n") : "（未匹配到样式规则）";
  }

  var raf = 0;
  function schedule() {
    if (raf) return;
    raf = requestAnimationFrame(function () { raf = 0; update(); });
  }
  new MutationObserver(schedule).observe(card, { childList: true, subtree: true, attributes: true, characterData: true });
  schedule();
})();
