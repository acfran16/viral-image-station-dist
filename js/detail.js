import {
  api,
  bindCopyButton,
  escapeAttribute,
  escapeHtml,
  formatDate,
  icons,
  renderMarkdown,
  renderTopbar,
} from "./lib.js";

export async function mountDetail(app, ctx, slug) {
  app.innerHTML = `
    <div class="app-shell">
      ${renderTopbar("gallery")}
      <main class="detail"><div class="boot-state"><strong>Loading campaign…</strong></div></main>
    </div>
  `;

  let detail;
  try {
    detail = await api(`/api/campaigns/${encodeURIComponent(slug)}`);
  } catch (error) {
    app.querySelector(".detail").innerHTML = `
      <div class="boot-state">
        <strong>Campaign unavailable</strong>
        <span>${escapeHtml(error.message)}</span>
        <a class="button" href="#/">${icons.arrowLeft} Back to campaigns</a>
      </div>
    `;
    return;
  }

  const manifest = detail.manifest ?? {};
  const command = manifest.generation_command || "";
  const done = detail.done ?? 0;
  const planned = detail.variants.length;
  const catalogRefs = detail.references.filter((item) => item.catalog);
  const uploadedRefs = detail.references.filter((item) => !item.catalog);
  const roleByPath = new Map((manifest.references ?? []).map((item) => [item.relativePath, item.roleLabel || item.role]));
  const qa = detail.qa ?? { approved: [], rejected: [], needsRerun: [], exported: [], docs: [] };
  const promptRules = manifest.prompt_rules ?? [];

  app.querySelector(".detail").innerHTML = `
    <div class="detail-head">
      <a class="back-link" href="#/">${icons.arrowLeft} Campaigns</a>
      <div class="detail-title">
        <div class="card-kicker">
          <span class="type-chip">${escapeHtml(manifest.campaign_type_label || "Campaign")}</span>
          ${manifest.trend ? `<span class="trend-chip">${icons.spark} ${escapeHtml(manifest.trend.name)}</span>` : ""}
          ${manifest.created_at ? `<span class="date-chip">${formatDate(manifest.created_at)}</span>` : ""}
        </div>
        <h1>${escapeHtml(manifest.display_name || detail.slug)}</h1>
        <p class="detail-path">campaigns/${escapeHtml(detail.slug)} · ${done}/${planned} variants generated</p>
      </div>
      <div class="detail-actions">
        ${command ? `<button class="button primary" id="copy-command" type="button">${icons.copy} Copy generation command</button>` : ""}
        <button class="button" id="export-approved" type="button" ${qa.approved.length ? "" : "disabled"}>${icons.folder} Export approved</button>
        <button class="button" id="duplicate-campaign" type="button">${icons.duplicate} Duplicate</button>
        <button class="button danger" id="delete-campaign" type="button">${icons.trash} Delete</button>
      </div>
    </div>

    ${command ? `<div class="command-preview">${escapeHtml(command)}</div>` : ""}

    <section class="detail-section">
      <div class="metric-row">
        ${renderMetric("Generated", `${done}/${planned}`)}
        ${renderMetric("Approved", qa.approved.length)}
        ${renderMetric("Rejected", qa.rejected.length)}
        ${renderMetric("Needs rerun", qa.needsRerun.length)}
        ${renderMetric("Exported", qa.exported.length)}
      </div>
    </section>

    ${promptRules.length ? `
      <section class="detail-section prompt-rule-summary">
        <h2>Prompt rules <span class="count-pill">${promptRules.length}</span></h2>
        <div class="prompt-rule-chip-list">
          ${promptRules.map((rule) => `<span class="prompt-rule-chip"><strong>${escapeHtml(rule.name)}</strong><small>${escapeHtml(rule.prompt)}</small></span>`).join("")}
        </div>
      </section>
    ` : ""}

    <section class="detail-section">
      <h2>Outputs <span class="count-pill">${done}/${planned}</span></h2>
      <div class="variant-board">
        ${detail.variants.map((variant) => renderVariantTile(variant, detail)).join("")}
      </div>
    </section>

    ${renderQaSection(qa)}

    <section class="detail-section">
      <h2>References <span class="count-pill">${detail.references.length}</span></h2>
      <div class="reference-strip">
        ${uploadedRefs.map((item) => renderRefTile(item, roleByPath.get(relPath(item, detail.slug)) || "Uploaded")).join("")}
        ${catalogRefs.map((item) => renderRefTile(item, "Catalog direction")).join("")}
        ${detail.references.length ? "" : `<p class="hint">No reference files stored in this campaign.</p>`}
      </div>
    </section>

    <div class="detail-columns">
      ${detail.brief ? `
        <section class="detail-section doc-panel">
          <h2>Brief</h2>
          <div class="markdown">${renderMarkdown(detail.brief)}</div>
        </section>
      ` : ""}
      <div class="doc-stack">
        ${detail.runLog ? `
          <section class="detail-section doc-panel">
            <h2>Run log</h2>
            <div class="markdown">${renderMarkdown(detail.runLog)}</div>
          </section>
        ` : ""}
        ${detail.captions ? `
          <section class="detail-section doc-panel">
            <h2>Captions</h2>
            <div class="markdown">${renderMarkdown(detail.captions)}</div>
          </section>
        ` : ""}
      </div>
    </div>
    <div id="lightbox-root"></div>
  `;

  bindCopyButton(app.querySelector("#copy-command"), command, "Command copied");
  bindLightbox(app, detail);

  app.querySelector("#export-approved").addEventListener("click", async (event) => {
    const button = event.currentTarget;
    button.disabled = true;
    button.innerHTML = `${icons.folder} Exporting...`;
    try {
      await api(`/api/campaigns/${encodeURIComponent(detail.slug)}/export-approved`, { method: "POST" });
      ctx.navigate(`#/c/${detail.slug}`);
    } catch (error) {
      button.disabled = false;
      button.innerHTML = `${icons.folder} ${escapeHtml(error.message)}`;
    }
  });

  app.querySelector("#duplicate-campaign").addEventListener("click", async (event) => {
    const button = event.currentTarget;
    button.disabled = true;
    button.innerHTML = `${icons.duplicate} Duplicating…`;
    try {
      const result = await api(`/api/campaigns/${encodeURIComponent(detail.slug)}/duplicate`, { method: "POST" });
      await ctx.refreshCampaigns();
      ctx.navigate(`#/c/${result.slug}`);
    } catch (error) {
      button.disabled = false;
      button.innerHTML = `${icons.duplicate} ${escapeHtml(error.message)}`;
    }
  });

  app.querySelector("#delete-campaign").addEventListener("click", async (event) => {
    const button = event.currentTarget;
    if (button.dataset.armed !== "true") {
      button.dataset.armed = "true";
      button.innerHTML = `${icons.trash} Click again to confirm`;
      setTimeout(() => {
        if (button.isConnected) {
          button.dataset.armed = "false";
          button.innerHTML = `${icons.trash} Delete`;
        }
      }, 4000);
      return;
    }
    button.disabled = true;
    try {
      await api(`/api/campaigns/${encodeURIComponent(detail.slug)}`, { method: "DELETE" });
      ctx.config.campaigns = ctx.config.campaigns.filter((item) => item.slug !== detail.slug);
      ctx.navigate("#/");
    } catch (error) {
      button.disabled = false;
      button.innerHTML = `${icons.trash} ${escapeHtml(error.message)}`;
    }
  });
}

function renderMetric(label, value) {
  return `
    <div class="metric">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </div>
  `;
}

function relPath(item, slug) {
  return item.path.replace(`campaigns/${slug}/`, "");
}

function renderVariantTile(variant, detail) {
  const generated = variant.status === "generated";
  const output = detail.outputs.find((file) => file.name === variant.filename);
  return `
    <article class="variant-tile ${generated ? "generated" : "pending"}">
      ${generated && output
        ? `<button class="tile-media" type="button" data-lightbox="${escapeAttribute(output.path)}" title="View ${escapeAttribute(variant.filename)}">
             <img src="/${escapeAttribute(output.path)}" alt="${escapeAttribute(variant.name)}">
             <span class="preview-icon">${icons.expand}</span>
           </button>`
        : `<div class="tile-media empty"><span class="ratio-ghost">${escapeHtml(variant.aspect_ratio)}</span></div>`}
      <div class="tile-copy">
        <span class="variant-number">${variant.number}</span>
        <strong>${escapeHtml(variant.name)}</strong>
        <small>${escapeHtml(variant.platform)}</small>
        <span class="tile-status">${generated ? `${icons.check} Generated` : "Not started"}</span>
      </div>
    </article>
  `;
}

function renderRefTile(item, label) {
  return `
    <figure class="ref-tile">
      <button class="tile-media" type="button" data-lightbox="${escapeAttribute(item.path)}" title="View ${escapeAttribute(item.name)}">
        <img src="/${escapeAttribute(item.path)}" alt="${escapeAttribute(item.name)}">
      </button>
      <figcaption><strong>${escapeHtml(label)}</strong><small>${escapeHtml(item.name)}</small></figcaption>
    </figure>
  `;
}

function renderQaSection(qa) {
  const hasAssets = qa.approved.length || qa.rejected.length || qa.needsRerun.length || qa.exported.length || qa.docs.length;
  return `
    <section class="detail-section qa-section">
      <h2>QA and handoff <span class="count-pill">${qa.approved.length} approved</span></h2>
      ${hasAssets ? `
        ${renderAssetGroup("Approved", qa.approved, "approved")}
        ${renderAssetGroup("Needs rerun", qa.needsRerun, "needs-rerun")}
        ${renderAssetGroup("Rejected", qa.rejected, "rejected")}
        ${renderAssetGroup("Exports", qa.exported, "exported")}
        ${qa.docs.length ? `
          <div class="qa-docs">
            ${qa.docs.map((doc) => `
              <details class="qa-doc">
                <summary>${escapeHtml(doc.relativePath)}</summary>
                <div class="markdown">${renderMarkdown(doc.content)}</div>
              </details>
            `).join("")}
          </div>
        ` : ""}
      ` : `
        <div class="empty-qa">
          <strong>No QA assets yet</strong>
          <p>After generation, copy usable files into <code>approved/</code>, failed files into <code>rejected/</code>, and fixable files into <code>needs-rerun/</code>.</p>
        </div>
      `}
    </section>
  `;
}

function renderAssetGroup(title, items, kind) {
  if (!items.length) return "";
  return `
    <div class="qa-group ${kind}">
      <div class="qa-group-head">
        <h3>${escapeHtml(title)}</h3>
        <span>${items.length} file${items.length === 1 ? "" : "s"}</span>
      </div>
      <div class="qa-strip">
        ${items.map((item) => `
          <figure class="qa-asset">
            <button class="tile-media" type="button" data-lightbox="${escapeAttribute(item.path)}" title="View ${escapeAttribute(item.name)}">
              <img src="/${escapeAttribute(item.path)}" alt="${escapeAttribute(item.name)}">
            </button>
            <figcaption>${escapeHtml(item.name)}</figcaption>
          </figure>
        `).join("")}
      </div>
    </div>
  `;
}

function bindLightbox(app, detail) {
  const root = app.querySelector("#lightbox-root");
  const paths = [
    ...detail.outputs.map((item) => item.path),
    ...((detail.qa?.approved ?? []).map((item) => item.path)),
    ...((detail.qa?.needsRerun ?? []).map((item) => item.path)),
    ...((detail.qa?.rejected ?? []).map((item) => item.path)),
    ...((detail.qa?.exported ?? []).map((item) => item.path)),
    ...detail.references.map((item) => item.path),
  ];
  let index = -1;

  const close = () => {
    root.innerHTML = "";
    index = -1;
    document.removeEventListener("keydown", onKey);
  };
  const show = (i) => {
    index = (i + paths.length) % paths.length;
    root.innerHTML = `
      <div class="modal-backdrop lightbox" data-close>
        <button class="modal-close" type="button" data-close title="Close">${icons.close}</button>
        <button class="lightbox-nav prev" type="button" data-nav="-1" title="Previous">${icons.arrowLeft}</button>
        <img src="/${escapeAttribute(paths[index])}" alt="">
        <button class="lightbox-nav next" type="button" data-nav="1" title="Next">${icons.arrowRight}</button>
        <span class="lightbox-caption">${escapeHtml(paths[index].split("/").at(-1))} · ${index + 1}/${paths.length}</span>
      </div>
    `;
    root.querySelectorAll("[data-close]").forEach((el) =>
      el.addEventListener("click", (event) => {
        if (event.target === el) close();
      }),
    );
    root.querySelectorAll("[data-nav]").forEach((el) =>
      el.addEventListener("click", (event) => {
        event.stopPropagation();
        show(index + Number(el.dataset.nav));
      }),
    );
  };
  const onKey = (event) => {
    if (index < 0) return;
    if (event.key === "Escape") close();
    if (event.key === "ArrowLeft") show(index - 1);
    if (event.key === "ArrowRight") show(index + 1);
  };

  app.querySelectorAll("[data-lightbox]").forEach((button) => {
    button.addEventListener("click", () => {
      document.addEventListener("keydown", onKey);
      show(paths.indexOf(button.dataset.lightbox));
    });
  });
}
