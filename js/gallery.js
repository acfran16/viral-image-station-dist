import { api, escapeAttribute, escapeHtml, formatDate, icons, renderTopbar } from "./lib.js";

export function mountGallery(app, ctx) {
  const campaigns = ctx.config.campaigns;
  const hosted = ctx.mode === "hosted";
  const current = ctx.config.library.groups
    .flatMap((group) => group.references)
    .filter((item) => item.current_rank)
    .sort((a, b) => a.current_rank - b.current_rank);
  app.innerHTML = `
    <div class="app-shell">
      ${renderTopbar("gallery")}
      <main class="gallery">
        <section class="gallery-hero">
          <p class="hero-kicker">${hosted ? "Hosted campaign planner" : "Local production station"}</p>
          <h1>${hosted ? "Choose a trend. Save it <em>to your workspace.</em>" : "Your content, <em>staged and ready.</em>"}</h1>
          <p class="hero-sub">${hosted
            ? "Browse the live catalog, assemble references and variants, then choose your local campaigns folder. Generation still runs in Codex until an API is connected."
            : `${campaigns.length} campaign${campaigns.length === 1 ? "" : "s"} on the light table. Briefs, references, outputs, QA, and exports live together.`}</p>
          <div class="hero-actions">
            <a class="button primary" href="#/new">${icons.plus} New campaign</a>
            <a class="button" href="#/catalog">${icons.grid} Browse Current 10</a>
          </div>
        </section>
        ${hosted ? `
          <section class="hosted-current" aria-labelledby="hosted-current-title">
            <div class="hosted-current-heading">
              <span>Current 10 · Jul 16, 2026</span>
              <h2 id="hosted-current-title">Ten formats ready to adapt</h2>
            </div>
            <div class="hosted-current-strip">
              ${current.map((item) => `
                <a href="#/catalog" class="hosted-current-item">
                  <img src="/references/${escapeAttribute(item.file)}" alt="${escapeAttribute(item.trend_name || item.name)}">
                  <span>${String(item.current_rank).padStart(2, "0")}</span>
                  <strong>${escapeHtml(item.trend_name || item.name)}</strong>
                </a>
              `).join("")}
            </div>
          </section>
        ` : campaigns.length ? `
          <section class="campaign-grid" aria-label="Campaigns">
            ${campaigns.map(renderCampaignCard).join("")}
          </section>
        ` : `
          <section class="gallery-empty">
            <span class="icon">${icons.folder}</span>
            <h2>No campaigns yet</h2>
            <p>Create your first campaign to see it here with live output previews.</p>
          </section>
        `}
      </main>
    </div>
  `;

  app.querySelectorAll("[data-open]").forEach((card) => {
    card.addEventListener("click", () => ctx.navigate(`#/c/${card.dataset.open}`));
    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        ctx.navigate(`#/c/${card.dataset.open}`);
      }
    });
  });
}

function renderCampaignCard(campaign) {
  const planned = campaign.planned || 0;
  const done = campaign.done || 0;
  const pct = planned ? Math.round((done / planned) * 100) : 0;
  const thumbs = campaign.thumbnails ?? [];
  return `
    <article class="campaign-card" data-open="${escapeAttribute(campaign.slug)}" tabindex="0" role="link" aria-label="Open campaign ${escapeAttribute(campaign.name || campaign.slug)}">
      <div class="card-media ${thumbs.length ? "" : "empty"}">
        ${thumbs.length
          ? thumbs.map((path, index) => `<img src="/${escapeAttribute(path)}" alt="" style="--i:${index}">`).join("")
          : `<span class="icon">${icons.image}</span><span class="media-note">No outputs yet</span>`}
      </div>
      <div class="card-body">
        <div class="card-kicker">
          <span class="type-chip">${escapeHtml(campaign.type || "Campaign")}</span>
          ${campaign.trend ? `<span class="trend-chip">${icons.spark} ${escapeHtml(campaign.trend)}</span>` : ""}
        </div>
        <h3>${escapeHtml(campaign.name || campaign.slug)}</h3>
        <div class="card-meta">
          <span>${campaign.created_at ? formatDate(campaign.created_at) : "Imported"}</span>
          <span>${campaign.references} reference file${campaign.references === 1 ? "" : "s"}</span>
        </div>
        ${renderQaBadges(campaign.qa)}
        <div class="card-progress" title="${done} of ${planned} variants generated">
          <span class="progress-track"><span class="progress-fill" style="width:${pct}%"></span></span>
          <span class="progress-label">${planned ? `${done}/${planned}` : `${campaign.outputs} file${campaign.outputs === 1 ? "" : "s"}`}</span>
        </div>
      </div>
    </article>
  `;
}

function renderQaBadges(qa = {}) {
  const total = (qa.approved || 0) + (qa.rejected || 0) + (qa.needs_rerun || 0) + (qa.exported || 0);
  if (!total) return "";
  return `
    <div class="qa-badges">
      ${qa.approved ? `<span class="qa-badge approved">${qa.approved} approved</span>` : ""}
      ${qa.needs_rerun ? `<span class="qa-badge needs">${qa.needs_rerun} rerun</span>` : ""}
      ${qa.rejected ? `<span class="qa-badge rejected">${qa.rejected} rejected</span>` : ""}
      ${qa.exported ? `<span class="qa-badge exported">${qa.exported} exported</span>` : ""}
    </div>
  `;
}

export async function refreshCampaigns(ctx) {
  const { campaigns } = await api("/api/campaigns");
  ctx.config.campaigns = campaigns;
}
