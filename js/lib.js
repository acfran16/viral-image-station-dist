export const icons = {
  image: `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>`,
  sliders: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h10M18 7h2M4 17h2M10 17h10M14 5v4M8 15v4"/></svg>`,
  arrowRight: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>`,
  arrowLeft: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>`,
  upload: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 16V4M7 9l5-5 5 5"/><path d="M5 15v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4"/></svg>`,
  close: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>`,
  check: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>`,
  copy: `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg>`,
  grid: `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>`,
  search: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>`,
  expand: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5"/></svg>`,
  plus: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>`,
  trash: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13"/></svg>`,
  spark: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8"/></svg>`,
  folder: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7a2 2 0 0 1 2-2h4l2 3h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>`,
  duplicate: `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/></svg>`,
};

export function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function escapeAttribute(value) {
  return escapeHtml(value).replaceAll("`", "&#096;");
}

export function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function slugify(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9 -]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function formatDate(value) {
  if (!value) return "";
  const date = value.includes("T") ? new Date(value) : new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(date);
}

export async function api(path, options = {}) {
  const response = await fetch(path, options);
  let body = null;
  try {
    body = await response.json();
  } catch {
    // Non-JSON error body.
  }
  if (!response.ok) {
    throw new Error(body?.error || `Request failed (${response.status}).`);
  }
  return body;
}

/**
 * Minimal markdown renderer for locally generated briefs and run logs.
 * Supports headings, fenced code, lists, bold, and inline code. Everything
 * is HTML-escaped first, so no raw markup passes through.
 */
export function renderMarkdown(text) {
  const lines = String(text ?? "").split(/\r?\n/);
  const html = [];
  let inCode = false;
  let inList = false;
  let inTable = false;

  const closeList = () => {
    if (inList) {
      html.push("</ul>");
      inList = false;
    }
  };
  const closeTable = () => {
    if (inTable) {
      html.push("</tbody></table>");
      inTable = false;
    }
  };

  for (const raw of lines) {
    if (raw.trim().startsWith("```")) {
      closeList();
      closeTable();
      html.push(inCode ? "</code></pre>" : `<pre class="md-code"><code>`);
      inCode = !inCode;
      continue;
    }
    if (inCode) {
      html.push(`${escapeHtml(raw)}\n`);
      continue;
    }
    const heading = raw.match(/^(#{1,4})\s+(.*)$/);
    if (heading) {
      closeList();
      closeTable();
      const level = Math.min(heading[1].length + 2, 5);
      html.push(`<h${level}>${inline(heading[2])}</h${level}>`);
      continue;
    }
    const tableCells = parseTableRow(raw);
    if (tableCells) {
      closeList();
      if (isTableDivider(tableCells)) continue;
      if (!inTable) {
        html.push("<table><tbody>");
        inTable = true;
      }
      const tag = html.at(-1) === "<table><tbody>" ? "th" : "td";
      html.push(`<tr>${tableCells.map((cell) => `<${tag}>${inline(cell.trim())}</${tag}>`).join("")}</tr>`);
      continue;
    }
    const listItem = raw.match(/^\s*[-*]\s+(.*)$/);
    if (listItem) {
      closeTable();
      if (!inList) {
        html.push("<ul>");
        inList = true;
      }
      html.push(`<li>${inline(listItem[1])}</li>`);
      continue;
    }
    closeList();
    closeTable();
    if (raw.trim()) {
      html.push(`<p>${inline(raw)}</p>`);
    }
  }
  if (inCode) html.push("</code></pre>");
  closeList();
  closeTable();
  return html.join("");

  function parseTableRow(value) {
    const trimmed = value.trim();
    if (!trimmed.startsWith("|") || !trimmed.endsWith("|")) return null;
    return trimmed.slice(1, -1).split("|");
  }

  function isTableDivider(cells) {
    return cells.every((cell) => /^:?-{3,}:?$/.test(cell.trim()));
  }

  function inline(value) {
    return escapeHtml(value)
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/`([^`]+)`/g, "<code>$1</code>");
  }
}

export function renderTopbar(active) {
  const hosted = window.__stationMode === "hosted";
  return `
    <header class="topbar">
      <a class="brand" href="#/">
        <span class="brand-mark">${icons.image}</span>
        <span class="brand-copy"><strong>Viral Image Station</strong><small>Campaign studio</small></span>
      </a>
      <nav class="topnav" aria-label="Main navigation">
        <a class="topnav-link ${active === "gallery" ? "active" : ""}" href="#/">Campaigns</a>
        <a class="topnav-link ${active === "catalog" ? "active" : ""}" href="#/catalog">Catalog</a>
        <a class="topnav-link ${active === "wizard" ? "active" : ""}" href="#/new">New campaign</a>
      </nav>
      <div class="status ${hosted ? "hosted" : ""}"><span class="status-dot"></span>${hosted ? "Hosted planner" : "Local production"}</div>
    </header>
  `;
}

export function bindCopyButton(button, text, doneLabel = "Copied") {
  if (!button) return;
  button.addEventListener("click", async () => {
    await navigator.clipboard.writeText(text);
    button.dataset.label = button.textContent;
    button.textContent = doneLabel;
    setTimeout(() => {
      if (button.isConnected) button.innerHTML = `${icons.copy} ${button.dataset.label.trim()}`;
    }, 1600);
  });
}
