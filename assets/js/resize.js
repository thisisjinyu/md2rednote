/* 三栏可拖动调整列宽：拖动 .col-resizer 改变 .workspace 的列宽 */
(function () {
  var ws = document.querySelector(".workspace");
  if (!ws) return;
  var resizers = ws.querySelectorAll(".col-resizer");
  var panes = ws.querySelectorAll(".preview-pane, .code-pane, .editor-pane");
  if (resizers.length < 2 || panes.length < 3) return;
  var MIN = 220;
  var drag = null;

  function setCols(a, b, c) {
    ws.style.gridTemplateColumns = a + "px 7px " + b + "px 7px " + c + "px";
  }
  function widths() {
    return [
      panes[0].getBoundingClientRect().width,
      panes[1].getBoundingClientRect().width,
      panes[2].getBoundingClientRect().width,
    ];
  }
  Array.prototype.forEach.call(resizers, function (r, idx) {
    r.addEventListener("mousedown", function (e) {
      e.preventDefault();
      var w = widths();
      drag = { idx: idx, x: e.clientX, w1: w[0], w2: w[1], w3: w[2] };
      r.classList.add("active");
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    });
  });
  document.addEventListener("mousemove", function (e) {
    if (!drag) return;
    var dx = e.clientX - drag.x;
    if (drag.idx === 0) {
      var a = drag.w1 + dx, b = drag.w2 - dx;
      if (a < MIN) { b -= MIN - a; a = MIN; }
      if (b < MIN) { a -= MIN - b; b = MIN; }
      setCols(a, b, drag.w3);
    } else {
      var bb = drag.w2 + dx, cc = drag.w3 - dx;
      if (bb < MIN) { cc -= MIN - bb; bb = MIN; }
      if (cc < MIN) { bb -= MIN - cc; cc = MIN; }
      setCols(drag.w1, bb, cc);
    }
  });
  document.addEventListener("mouseup", function () {
    if (!drag) return;
    drag = null;
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
    Array.prototype.forEach.call(resizers, function (r) { r.classList.remove("active"); });
  });
  window.addEventListener("resize", function () { ws.style.gridTemplateColumns = ""; });
})();
