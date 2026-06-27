/* 网格参考叠层 · 与 app.js 解耦
   职责：固定 8 列 × 10 行，格子为「正方形」（边长由宽度决定），上下边距重算居中。
   生成带 Excel 式编号（列字母+行号）的格子。
   该叠层挂在 .card-frame 上（不在 #card 内），不会进入导出。顶栏「网格」勾选框控制显隐。
   最外圈格子加标记类（et/eb/el/er），由 CSS 去掉服向外的那条边，改由外边框充当，避免双线。 */
(function () {
  var overlay = document.querySelector('.grid-overlay');
  if (!overlay) return;

  var W = 1080, H = 1440;  // 画布固定 3:4
  var N = 8;               // 固定 8 列
  var ROWS = 10;           // 固定 10 行

  // 列序号 -> 字母（0->A, 1->B, ... 26->AA）
  function colLabel(n) {
    var s = '';
    n += 1;
    while (n > 0) {
      var r = (n - 1) % 26;
      s = String.fromCharCode(65 + r) + s;
      n = Math.floor((n - 1) / 26);
    }
    return s;
  }

  // 固定 8×10、保持正方形的布局算法：输出 { cols, rows, s, gutter, mx, my }
  // 原理：左右边距固定→由宽度定出正方形边长→按固定 10 行算出总高→上下边距重算居中，格子恒为正方形
  function computeLayout(N, M) {
    var g = Math.round(120 / N);             // 间距（N=8 -> 15）
    var mx = 92;                              // 左右页边距固定
    var s = (W - 2 * mx - (N - 1) * g) / N;   // 正方形边长（由宽度决定）
    var usedH = M * s + (M - 1) * g;          // 10 行所需高度
    var my = (H - usedH) / 2;                 // 上下边距居中
    return { cols: N, rows: M, s: s, gutter: g, mx: mx, my: my };
  }

  function build(N, M) {
    var L = computeLayout(N, M);
    // 容器插入用百分比（随预览缩放自适应）
    overlay.style.left = overlay.style.right = (L.mx / W * 100) + '%';
    overlay.style.top = overlay.style.bottom = (L.my / H * 100) + '%';
    overlay.style.gridTemplateColumns = 'repeat(' + L.cols + ', 1fr)';
    overlay.style.gridTemplateRows = 'repeat(' + L.rows + ', 1fr)';
    overlay.style.columnGap = (L.gutter / (W - 2 * L.mx) * 100) + '%';
    overlay.style.rowGap = (L.gutter / (H - 2 * L.my) * 100) + '%';
    // 生成格子 + Excel 式编号（列字母 + 行号，如 C4）；最外圈加 et/eb/el/er 去掉服向外的边
    var html = '';
    for (var r = 0; r < L.rows; r++) {
      for (var c = 0; c < L.cols; c++) {
        var cl = [];
        if (r === 0) cl.push('et');
        if (r === L.rows - 1) cl.push('eb');
        if (c === 0) cl.push('el');
        if (c === L.cols - 1) cl.push('er');
        var attr = cl.length ? ' class="' + cl.join(' ') + '"' : '';
        html += '<i' + attr + '><b>' + colLabel(c) + (r + 1) + '</b></i>';
      }
    }
    overlay.innerHTML = html;
  }

  build(N, ROWS);
})();
