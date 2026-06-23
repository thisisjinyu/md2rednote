/* Minimal zero-dependency Markdown parser tuned for card layouts. */
(function (global) {
  function escapeHtml(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function inline(s) {
    s = escapeHtml(s);
    s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, '<img src="$2" alt="$1" crossorigin="anonymous">');
    s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2">$1</a>');
    s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    s = s.replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>");
    s = s.replace(/`([^`]+)`/g, "<code>$1</code>");
    s = s.replace(/==([^=]+)==/g, "<mark>$1</mark>");
    return s;
  }

  function mdToHtml(md) {
    const lines = String(md || "").replace(/\r\n/g, "\n").split("\n");
    let html = "";
    let listType = null;

    function closeList() {
      if (listType) { html += listType === "ul" ? "</ul>" : "</ol>"; listType = null; }
    }

    for (const raw of lines) {
      const line = raw.replace(/\s+$/, "");
      let m;
      if (line.trim() === "") { closeList(); continue; }

      if ((m = line.match(/^(#{1,4})\s+(.*)$/))) {
        closeList();
        const lv = m[1].length;
        html += `<h${lv}>${inline(m[2])}</h${lv}>`;
      } else if ((m = line.match(/^!\[([^\]]*)\]\(([^)\s]+)\)\s*$/))) {
        closeList();
        const alt = m[1].trim();
        const band = /^(通栏|band|full|fullbleed)$/i.test(alt);
        html += `<figure class="card-fig${band ? " fig-band" : ""}"><img src="${m[2]}" alt="${escapeHtml(m[1])}" crossorigin="anonymous"></figure>`;
      } else if ((m = line.match(/^>\s?(.*)$/))) {
        closeList();
        html += `<blockquote>${inline(m[1])}</blockquote>`;
      } else if ((m = line.match(/^[-*]\s+(.*)$/))) {
        if (listType !== "ul") { closeList(); html += "<ul>"; listType = "ul"; }
        html += `<li>${inline(m[1])}</li>`;
      } else if ((m = line.match(/^\d+\.\s+(.*)$/))) {
        if (listType !== "ol") { closeList(); html += "<ol>"; listType = "ol"; }
        html += `<li>${inline(m[1])}</li>`;
      } else {
        closeList();
        html += `<p>${inline(line)}</p>`;
      }
    }
    closeList();
    return html;
  }

  global.mdToHtml = mdToHtml;
})(window);
