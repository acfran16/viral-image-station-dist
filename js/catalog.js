import { escapeAttribute, escapeHtml, icons, renderTopbar } from "./lib.js";

let app;
let ctx;
let query = "";

function allReferences() {
  return ctx.config.library.groups.flatMap((group) =>
    group.references.map((reference) => ({ ...reference, group })),
  );
}

function trendForReference(referenceId) {
  for (const category of ctx.config.trends.categories ?? []) {
    const trend = category.trends.find((item) => item.reference_id === referenceId);
    if (trend) return trend;
  }
  return null;
}

function renderCard(item) {
  const trend = trendForReference(item.id);
  const campaignLink = trend
    ? `#/new?trend=${encodeURIComponent(trend.id)}&ref=${encodeURIComponent(item.id)}`
    : `#/new?ref=${encodeURIComponent(item.id)}`;
  return `
    <article class="catalog-page-card">
      <div class="catalog-page-image">
        <img src="/references/${escapeAttribute(item.file)}" alt="${escapeAttribute(item.trend_name || item.name)}" loading="lazy">
        ${item.current_rank ? `<span class="current-rank">${String(item.current_rank).padStart(2, "0")}</span>` : ""}
        <span class="reference-id">${escapeHtml(item.id)}</span>
      </div>
      <div class="catalog-page-copy">
        <div class="catalog-page-kicker">${escapeHtml(item.group.number)} · ${escapeHtml(item.group.name)}</div>
        <h2>${escapeHtml(item.trend_name || item.name)}</h2>
        <p>${escapeHtml(item.use_for)}</p>
        ${item.prompt_frame ? `<details><summary>Refined prompt</summary><p class="catalog-prompt">${escapeHtml(item.prompt_frame)}</p></details>` : ""}
        <div class="catalog-page-actions">
          <a class="button primary compact" href="${campaignLink}">${icons.plus} Use in campaign</a>
          ${item.prompt_frame ? `<button class="button compact" type="button" data-copy-prompt="${escapeAttribute(item.id)}">${icons.copy} Copy prompt</button>` : ""}
        </div>
      </div>
    </article>
  `;
}

function render() {
  const needle = query.trim().toLowerCase();
  const references = allReferences();
  const current = references.filter((item) => item.current_rank).sort((a, b) => a.current_rank - b.current_rank);
  const archive = references.filter((item) => !item.current_rank && (!needle || `${item.id} ${item.name} ${item.trend_name || ""} ${item.use_for} ${item.group.name}`.toLowerCase().includes(needle)));
  const currentFiltered = current.filter((item) => !needle || `${item.id} ${item.name} ${item.trend_name || ""} ${item.use_for}`.toLowerCase().includes(needle));

  app.innerHTML = `
    <div class="app-shell">
      ${renderTopbar("catalog")}
      <main class="catalog-page">
        <header class="catalog-page-header">
          <div>
            <p class="hero-kicker">Prompt and reference library</p>
            <h1>Find the look. Start the campaign.</h1>
            <p>${references.length} visual references with reusable prompts, role guidance, and local campaign handoff.</p>
          </div>
          <label class="catalog-page-search">
            <span class="icon">${icons.search}</span>
            <input type="search" id="catalog-page-search" value="${escapeAttribute(query)}" placeholder="Search prompts, uses, or reference IDs">
          </label>
        </header>

        <section class="catalog-page-section current-collection" aria-labelledby="current-collection-title">
          <div class="catalog-section-heading">
            <div>
              <span class="section-index">CURRENT 10 · JUL 16, 2026</span>
              <h2 id="current-collection-title">Social AI formats moving now</h2>
            </div>
            <p>Researched from current TikTok, Instagram, and broader social-photo reporting; prompts refined for identity, product, anatomy, lighting, and batch consistency.</p>
          </div>
          <div class="catalog-page-grid current-grid">
            ${currentFiltered.map(renderCard).join("") || `<div class="catalog-empty">No current trends match this search.</div>`}
          </div>
        </section>

        <section class="catalog-page-section" aria-labelledby="catalog-archive-title">
          <div class="catalog-section-heading compact-heading">
            <div>
              <span class="section-index">REFERENCE ARCHIVE</span>
              <h2 id="catalog-archive-title">Established campaign directions</h2>
            </div>
          </div>
          <div class="catalog-page-grid archive-grid">
            ${archive.map(renderCard).join("") || `<div class="catalog-empty">No archived references match this search.</div>`}
          </div>
        </section>
      </main>
    </div>
  `;
  bindEvents();
}

function bindEvents() {
  app.querySelector("#catalog-page-search")?.addEventListener("input", (event) => {
    query = event.target.value;
    render();
    const input = app.querySelector("#catalog-page-search");
    input.focus();
    input.setSelectionRange(query.length, query.length);
  });
  app.querySelectorAll("[data-copy-prompt]").forEach((button) => {
    button.addEventListener("click", async () => {
      const item = allReferences().find((reference) => reference.id === button.dataset.copyPrompt);
      if (!item?.prompt_frame) return;
      await navigator.clipboard.writeText(item.prompt_frame);
      button.innerHTML = `${icons.check} Prompt copied`;
    });
  });
}

export function mountCatalog(mountPoint, context) {
  app = mountPoint;
  ctx = context;
  query = "";
  render();
}
