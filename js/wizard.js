import {
  bindCopyButton,
  capitalize,
  escapeAttribute,
  escapeHtml,
  formatDate,
  icons,
  renderTopbar,
  slugify,
} from "./lib.js";
import { createHostedCampaign } from "./hosted.js";

const steps = [
  { name: "Setup", detail: "Name, type and goal", mobile: "Setup" },
  { name: "Direction", detail: "Trend, references, mood", mobile: "Direction" },
  { name: "Outputs", detail: "Variants 001-008", mobile: "Outputs" },
  { name: "References", detail: "Role-aware uploads", mobile: "References" },
  { name: "Review", detail: "Review and create", mobile: "Review" },
];

function role(id, label, description, level) {
  return { id, label, description, level };
}

const campaignTypes = [
  {
    id: "product",
    name: "Product launch",
    defaultGroup: "product-commerce",
    roles: [
      role("primary", "Primary product / subject", "Define the main product or subject.", "required"),
      role("style", "Style / mood", "Guide the visual style, lighting, and finish.", "recommended"),
      role("brand", "Brand kit", "Align colors, logo, packaging, and identity.", "recommended"),
      role("composition", "Pose / composition", "Guide framing, angle, and layout.", "optional"),
    ],
  },
  {
    id: "fashion",
    name: "Fashion / editorial",
    defaultGroup: "editorial-poster",
    roles: [
      role("primary", "Garment / primary subject", "Preserve the garment, model, or collection.", "required"),
      role("style", "Editorial style", "Set the visual language and production finish.", "recommended"),
      role("composition", "Pose / composition", "Guide pose, crop, and layout.", "recommended"),
      role("brand", "Brand kit", "Supply logo, palette, and typography references.", "optional"),
    ],
  },
  {
    id: "character",
    name: "Character / mascot",
    defaultGroup: "character-story",
    roles: [
      role("identity", "Character identity", "Lock face, costume, proportions, and key features.", "required"),
      role("style", "Illustration style", "Define rendering style and line treatment.", "recommended"),
      role("composition", "Pose sheet", "Guide expressions, actions, and camera angles.", "optional"),
      role("environment", "Story world", "Define setting, props, and atmosphere.", "optional"),
    ],
  },
  {
    id: "creator",
    name: "Creator / lifestyle",
    defaultGroup: "photo-lifestyle",
    roles: [
      role("identity", "Creator / subject", "Preserve identity and recognizable appearance.", "required"),
      role("style", "Mood reference", "Guide camera feel, lighting, and authenticity.", "recommended"),
      role("environment", "Environment", "Guide location, room, street, or event context.", "optional"),
      role("brand", "Product / sponsor", "Supply the featured product or sponsor identity.", "optional"),
    ],
  },
  {
    id: "infographic",
    name: "Infographic / education",
    defaultGroup: "infographic-education",
    roles: [
      role("content", "Facts / source material", "Supply the visual facts, labels, or source diagram.", "required"),
      role("style", "Information style", "Guide hierarchy, illustration, and density.", "recommended"),
      role("brand", "Brand kit", "Supply palette, logo, and typography direction.", "optional"),
      role("composition", "Layout reference", "Guide chart, table, or process structure.", "optional"),
    ],
  },
  {
    id: "general",
    name: "General social pack",
    defaultGroup: "social-ui",
    roles: [
      role("primary", "Primary subject", "Define what the campaign should feature.", "required"),
      role("style", "Style / mood", "Guide the visual direction across formats.", "recommended"),
      role("brand", "Brand kit", "Supply colors, logo, and identity.", "optional"),
      role("composition", "Layout reference", "Guide framing and platform composition.", "optional"),
    ],
  },
];

const fashionEnergyOptions = [
  { id: "refined", name: "Refined", description: "Elegant tailoring, controlled silhouettes, quiet luxury." },
  { id: "bold", name: "Bold", description: "Body-confident silhouettes, strategic cutouts, assertive posing." },
  { id: "avant-garde", name: "Avant-garde", description: "Experimental layering, sculptural shapes, runway-level styling." },
];

let app;
let ctx;
const state = {
  step: 0,
  created: null,
  submitting: false,
  error: "",
  searchTimer: 0,
  form: freshForm(),
};

function freshForm() {
  return {
    name: "",
    type: "product",
    goal: "",
    audience: "",
    groupId: "product-commerce",
    referenceIds: new Set(["R001"]),
    trendId: null,
    trendSearch: "",
    catalogQuery: "",
    catalogFilter: "all",
    previewId: null,
    catalogAsSubject: true,
    fashionEnergy: "bold",
    promptRuleIds: new Set(["product-accuracy-priority", "integrated-lighting", "avoid-anatomy-risk"]),
    mood: "",
    exactText: "",
    avoid: "",
    variants: new Set(["001", "002", "003", "004", "005", "006", "007", "008"]),
    files: {},
  };
}

export function mountWizard(mountPoint, context) {
  app = mountPoint;
  ctx = context;
  state.step = 0;
  state.created = null;
  state.submitting = false;
  state.error = "";
  state.form = freshForm();
  const prefill = context.wizardPrefill;
  if (prefill?.referenceId) {
    const reference = allReferences().find((item) => item.id === prefill.referenceId);
    if (reference) {
      state.form.referenceIds = new Set([reference.id]);
      state.form.groupId = reference.group.id;
    }
  }
  if (prefill?.trendId && allTrends().some((item) => item.id === prefill.trendId)) {
    state.form.trendId = prefill.trendId;
  }
  render();
}

function config() {
  return ctx.config;
}

function currentType() {
  return campaignTypes.find((item) => item.id === state.form.type);
}

function currentGroup() {
  return config().library.groups.find((item) => item.id === state.form.groupId);
}

function allReferences() {
  return config().library.groups.flatMap((group) =>
    group.references.map((reference) => ({ ...reference, group })),
  );
}

function selectedReferences() {
  return allReferences().filter((item) => state.form.referenceIds.has(item.id));
}

function allTrends() {
  return (config().trends?.categories ?? []).flatMap((category) =>
    category.trends.map((trend) => ({ ...trend, category })),
  );
}

function selectedTrend() {
  return allTrends().find((trend) => trend.id === state.form.trendId) ?? null;
}

function trendPreviewPath(trend) {
  if (trend.preview_image) return `/trends/previews/${trend.preview_image}`;
  if (!trend.reference_id) return null;
  const reference = allReferences().find((item) => item.id === trend.reference_id);
  return reference ? `/references/${reference.file}` : null;
}

function selectedPromptRules() {
  return (config().promptRules ?? []).filter((rule) => state.form.promptRuleIds.has(rule.id));
}

function render() {
  if (state.created) {
    renderSuccess();
    return;
  }
  app.innerHTML = `
    <div class="app-shell">
      ${renderTopbar("wizard")}
      <div class="workspace">
        ${renderStepRail()}
        <main class="main-panel">
          ${renderMobileProgress()}
          <div class="form-content">
            ${state.error ? `<div class="error-banner" role="alert">${escapeHtml(state.error)}</div>` : ""}
            ${renderStep()}
          </div>
          ${renderActionBar()}
        </main>
        ${renderSummary()}
      </div>
    </div>
  `;
  bindEvents();
}

function renderStepRail() {
  return `
    <aside class="step-rail" aria-label="Campaign setup steps">
      <ol class="steps">
        ${steps.map((step, index) => `
          <li>
            <button class="step-button ${index === state.step ? "active" : ""} ${index < state.step ? "complete" : ""}" data-step="${index}" ${index > state.step ? "disabled" : ""}>
              <span class="step-number">${index < state.step ? "✓" : index + 1}</span>
              <span class="step-copy"><strong>${step.name}</strong><small>${step.detail}</small></span>
            </button>
          </li>
        `).join("")}
      </ol>
    </aside>
  `;
}

function renderMobileProgress() {
  return `
    <nav class="mobile-progress" aria-label="Campaign progress">
      ${steps.map((step, index) => `
        <span class="mobile-step ${index === state.step ? "active" : ""}">
          <span class="step-number">${index < state.step ? "✓" : index + 1}</span>
          <span>${step.mobile}</span>
        </span>
      `).join("")}
    </nav>
  `;
}

function renderStep() {
  const renderers = [renderSetup, renderDirection, renderOutputs, renderReferences, renderReview];
  return renderers[state.step]();
}

function heading(title) {
  return `<div class="page-heading"><span class="icon">${icons.sliders}</span><h1>${title}</h1></div>`;
}

function renderSetup() {
  const type = currentType();
  const previewImages = config().library.groups
    .flatMap((group) => group.references.slice(0, 1))
    .slice(0, 6);
  return `
    ${heading("Start a campaign")}
    <div class="field">
      <label for="campaign-name">Campaign name <span class="required-mark">*</span></label>
      <input id="campaign-name" type="text" maxlength="60" value="${escapeAttribute(state.form.name)}" placeholder="Example: Summer sneaker drop">
      <p class="hint">The folder name will be created automatically from this title.</p>
    </div>
    <div class="field">
      <span class="field-label">Campaign type <span class="required-mark">*</span></span>
      <div class="choice-grid">
        ${campaignTypes.map((item) => `
          <label class="choice ${item.id === type.id ? "selected" : ""}">
            <input type="radio" name="campaign-type" value="${item.id}" ${item.id === type.id ? "checked" : ""}>
            <span>${item.name}</span>
          </label>
        `).join("")}
      </div>
      <p class="hint">The campaign type determines which reference roles are required.</p>
      <div class="preview-strip" aria-label="Reference direction previews">
        ${previewImages.map((item) => `<img src="/references/${item.file}" alt="${escapeAttribute(item.name)}">`).join("")}
      </div>
    </div>
    ${state.form.type === "fashion" ? `
      <div class="field">
        <span class="field-label">Fashion energy</span>
        <div class="choice-grid">
          ${fashionEnergyOptions.map((option) => `
            <label class="choice stacked ${state.form.fashionEnergy === option.id ? "selected" : ""}">
              <input type="radio" name="fashion-energy" value="${option.id}" ${state.form.fashionEnergy === option.id ? "checked" : ""}>
              <span><strong>${option.name}</strong><small>${option.description}</small></span>
            </label>
          `).join("")}
        </div>
      </div>
    ` : ""}
    <div class="field">
      <label for="campaign-goal">Campaign goal <span class="required-mark">*</span></label>
      <textarea id="campaign-goal" maxlength="700" placeholder="Describe the objective, audience, message, and must-haves.">${escapeHtml(state.form.goal)}</textarea>
      <p class="hint">This becomes the starting brief for generation.</p>
    </div>
    <div class="field">
      <label for="campaign-audience">Audience</label>
      <input id="campaign-audience" type="text" maxlength="160" value="${escapeAttribute(state.form.audience)}" placeholder="Example: Streetwear shoppers, ages 18-34">
    </div>
  `;
}

function renderTrendPicker() {
  const trend = selectedTrend();
  const trendPreview = trend ? trendPreviewPath(trend) : null;
  const categories = config().trends?.categories ?? [];
  if (!categories.length) return "";

  const trendSearch = (state.form.trendSearch ?? "").toLowerCase().trim();
  const filteredCategories = trendSearch
    ? categories.map((cat) => ({
        ...cat,
        trends: cat.trends.filter((t) =>
          `${t.name} ${t.purpose} ${(t.tags ?? []).join(" ")} ${cat.name}`.toLowerCase().includes(trendSearch)
        ),
      })).filter((cat) => cat.trends.length)
    : categories;

  return `
    <div class="field trend-field">
      <span class="field-label">${icons.spark} Trend <small class="optional-tag">Optional</small></span>
      <p class="hint">Anchor the campaign to a viral image trend. Its prompt frame is written into the brief and generation command.</p>
      <label class="trend-search-label">
        <span class="icon">${icons.search}</span>
        <input id="trend-search" type="text" value="${escapeAttribute(state.form.trendSearch ?? "")}" placeholder="Search trends by name or tag…">
        ${(state.form.trendSearch ?? "") ? `<button type="button" class="clear-trend-search" title="Clear search">${icons.close}</button>` : ""}
      </label>
      <div class="trend-layout">
        <div class="trend-groups">
          ${filteredCategories.length ? filteredCategories.map((category) => `
            <div class="trend-group">
              <span class="trend-group-name">${escapeHtml(category.name)}</span>
              <div class="trend-chips">
                ${category.trends.map((item) => `
                  <button type="button" class="trend-pick ${state.form.trendId === item.id ? "selected" : ""}" data-trend="${item.id}">
                    ${state.form.trendId === item.id ? icons.check : ""}${escapeHtml(item.name)}
                  </button>
                `).join("")}
              </div>
            </div>
          `).join("") : `<div class="catalog-empty">No trends match "${escapeHtml(trendSearch)}"</div>`}
        </div>
        ${trend ? `
          <div class="trend-detail">
            <div class="trend-detail-head">
              <div class="trend-detail-name">
                <strong>${escapeHtml(trend.name)}</strong>
                <span class="trend-category-label">${escapeHtml(trend.category?.name ?? "")}</span>
              </div>
              <button type="button" class="trend-pick selected small" data-trend="${trend.id}" title="Deselect trend">${icons.close} Remove</button>
            </div>
            ${trend.preview_hint ? `
              <blockquote class="trend-preview-hint">${escapeHtml(trend.preview_hint)}</blockquote>
            ` : ""}
            ${trendPreview ? `
              <img class="trend-preview-image" src="${escapeAttribute(trendPreview)}" alt="Example: ${escapeAttribute(trend.name)}">
            ` : ""}
            <div class="trend-meta-row">
              ${trend.purpose ? `<span class="trend-purpose">${icons.folder} ${escapeHtml(trend.purpose)}</span>` : ""}
              ${(trend.formats ?? []).length ? `<span class="trend-formats">${trend.formats.map((f) => `<code>${escapeHtml(f)}</code>`).join(" ")}</span>` : ""}
            </div>
            ${(trend.tags ?? []).length ? `
              <div class="trend-tags">
                ${trend.tags.map((tag) => `<span class="trend-tag">${escapeHtml(tag)}</span>`).join("")}
              </div>
            ` : ""}
            ${(trend.reference_slots ?? []).length ? `
              <div class="trend-slots">
                <span class="slots-label">Reference slots</span>
                <div class="slots-list">
                  ${trend.reference_slots.map((slot) => `<span class="slot-pill">${escapeHtml(slot)}</span>`).join("")}
                </div>
                <p class="slots-hint">Upload these in Step 4 — References.</p>
              </div>
            ` : ""}
            ${trend.prompt_frame ? `
              <details class="trend-frame-details">
                <summary>Prompt frame</summary>
                <p class="trend-frame">${escapeHtml(trend.prompt_frame)}</p>
              </details>
            ` : ""}
          </div>
        ` : `
          <div class="trend-empty-panel">
            <span class="icon">${icons.spark}</span>
            <strong>No trend selected</strong>
            <p>Pick a trend from the list to see its visual description, reference slots, and prompt frame.</p>
          </div>
        `}
      </div>
    </div>
  `;
}

function renderDirection() {
  const query = state.form.catalogQuery.trim().toLowerCase();
  const references = allReferences().filter((item) => {
    const matchesFilter = state.form.catalogFilter === "all"
      || (state.form.catalogFilter === "featured" && item.featured_rank)
      || (state.form.catalogFilter === "current" && item.current_rank)
      || state.form.catalogFilter === item.group.id;
    const searchable = `${item.id} ${item.name} ${item.trend_name || ""} ${item.use_for} ${item.prompt_frame || ""} ${item.group.name}`.toLowerCase();
    return matchesFilter && (!query || searchable.includes(query));
  });
  const selected = selectedReferences();
  return `
    ${heading("Choose a visual direction")}
    <p class="section-intro">Pick a trend and exact references. Chosen images are copied into the campaign folder.</p>
    ${renderTrendPicker()}
    ${renderPromptRulePicker()}
    <div class="catalog-toolbar">
      <label class="catalog-search">
        <span class="icon">${icons.search}</span>
        <input id="catalog-search" type="text" value="${escapeAttribute(state.form.catalogQuery)}" placeholder="Search references, styles, or uses">
      </label>
      <div class="catalog-filters" aria-label="Catalog filters">
        ${[
          ["all", "All"],
          ["current", "Current 10"],
          ["featured", "Top 3"],
          ...config().library.groups.map((group) => [group.id, group.number]),
        ].map(([id, label]) => `
          <button type="button" class="filter-button ${state.form.catalogFilter === id ? "active" : ""}" data-filter="${id}">${label}</button>
        `).join("")}
      </div>
    </div>
    <div class="catalog-count">${references.length} references shown · ${selected.length} selected</div>
    <div class="catalog-grid">
      ${references.length ? references.map(renderReferenceCard).join("") : `<div class="catalog-empty">No references match this search.</div>`}
    </div>
    <div class="selection-tray ${selected.length ? "" : "empty"}">
      <div class="tray-copy">
        <span class="tray-thumbs">${selected.slice(0, 4).map((item) => `<img src="/references/${item.file}" alt="">`).join("")}</span>
        <div>
          <strong>${selected.length ? `${selected.length} reference${selected.length === 1 ? "" : "s"} selected` : "No references selected"}</strong>
          <span>${selected.length ? selected.map((item) => item.id).join(", ") : "Choose at least one card or a complete group."}</span>
        </div>
      </div>
      <div class="tray-actions">
        ${selected.length ? `<button class="text-button" id="clear-references" type="button">Clear</button>` : ""}
        <button class="button compact" id="select-filtered" type="button" ${references.length ? "" : "disabled"}>Select shown</button>
      </div>
    </div>
    <div class="field-row">
      <div class="field">
        <label for="campaign-mood">Mood and finish</label>
        <textarea id="campaign-mood" placeholder="Example: candid, energetic, direct flash, street-level realism">${escapeHtml(state.form.mood)}</textarea>
      </div>
      <div class="field">
        <label for="campaign-text">Exact words</label>
        <textarea id="campaign-text" placeholder="Enter only wording that must appear verbatim">${escapeHtml(state.form.exactText)}</textarea>
      </div>
    </div>
    <div class="field">
      <label for="campaign-avoid">Avoid</label>
      <input id="campaign-avoid" type="text" maxlength="300" value="${escapeAttribute(state.form.avoid)}" placeholder="Example: extra logos, altered product colors, glossy studio look">
    </div>
    ${state.form.previewId ? renderReferenceModal(state.form.previewId) : ""}
  `;
}

function renderPromptRulePicker() {
  const rules = config().promptRules ?? [];
  if (!rules.length) return "";
  const groups = rules.reduce((map, rule) => {
    const key = rule.category || "General";
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(rule);
    return map;
  }, new Map());
  return `
    <div class="field prompt-rules-field">
      <span class="field-label">${icons.sliders} Prompt rule presets</span>
      <p class="hint">Use these to keep generation aligned before QA. They are written into the brief and manifest.</p>
      <div class="prompt-rule-grid">
        ${[...groups.entries()].map(([category, items]) => `
          <section class="prompt-rule-group">
            <h3>${escapeHtml(category)}</h3>
            ${items.map((rule) => `
              <label class="prompt-rule ${state.form.promptRuleIds.has(rule.id) ? "selected" : ""}">
                <input type="checkbox" name="prompt-rule" value="${escapeAttribute(rule.id)}" ${state.form.promptRuleIds.has(rule.id) ? "checked" : ""}>
                <span><strong>${escapeHtml(rule.name)}</strong><small>${escapeHtml(rule.prompt)}</small></span>
              </label>
            `).join("")}
          </section>
        `).join("")}
      </div>
    </div>
  `;
}

function renderReferenceCard(item) {
  const selected = state.form.referenceIds.has(item.id);
  return `
    <article class="reference-card ${selected ? "selected" : ""}">
      <button class="reference-preview" type="button" data-preview="${item.id}" title="Preview ${escapeAttribute(item.name)}">
        <img src="/references/${item.file}" alt="${escapeAttribute(item.name)}" loading="lazy">
        <span class="preview-icon">${icons.expand}</span>
        ${item.current_rank ? `<span class="trend-rank current">Current ${item.current_rank}</span>` : item.featured_rank ? `<span class="trend-rank">Top ${item.featured_rank}</span>` : ""}
      </button>
      <div class="reference-body">
        <div class="reference-kicker"><span>${item.id}</span><span>${item.group.number}</span></div>
        <h3>${escapeHtml(item.trend_name || item.name)}</h3>
        <p>${escapeHtml(item.use_for)}</p>
        <div class="reference-meta">${item.published ? `Added ${formatDate(item.published)}` : item.group.name}</div>
        <button class="select-reference ${selected ? "selected" : ""}" type="button" data-reference="${item.id}" aria-pressed="${selected}">
          ${selected ? `${icons.check} Selected` : "Select reference"}
        </button>
      </div>
    </article>
  `;
}

function renderReferenceModal(id) {
  const item = allReferences().find((reference) => reference.id === id);
  if (!item) return "";
  const source = config().library.sources.find((entry) => entry.id === item.source);
  return `
    <div class="modal-backdrop" data-close-preview>
      <section class="reference-modal" role="dialog" aria-modal="true" aria-label="${escapeAttribute(item.name)}">
        <button class="modal-close" type="button" data-close-preview title="Close preview">${icons.close}</button>
        <img src="/references/${item.file}" alt="${escapeAttribute(item.name)}">
        <div class="modal-copy">
          <div class="reference-kicker"><span>${item.id}</span><span>${item.group.number} ${item.group.name}</span></div>
          <h2>${escapeHtml(item.trend_name || item.name)}</h2>
          <p>${escapeHtml(item.use_for)}</p>
          ${item.prompt_frame ? `
            <div class="prompt-frame">
              <strong>Reusable prompt</strong>
              <p>${escapeHtml(item.prompt_frame)}</p>
            </div>
          ` : ""}
          <dl>
            <div><dt>Source</dt><dd><a href="${escapeAttribute(item.source_url)}" target="_blank" rel="noreferrer">${escapeHtml(source?.name || item.source)}</a></dd></div>
            <div><dt>License</dt><dd>${escapeHtml(source?.license || "See source")}</dd></div>
            ${item.published ? `<div><dt>Added</dt><dd>${formatDate(item.published)}</dd></div>` : ""}
          </dl>
          <button class="button primary" type="button" data-reference="${item.id}">
            ${state.form.referenceIds.has(item.id) ? "Remove selection" : "Use this reference"}
          </button>
          ${item.prompt_frame ? `<button class="button" type="button" data-copy-prompt="${item.id}">${icons.copy} Copy prompt</button>` : ""}
        </div>
      </section>
    </div>
  `;
}

function renderOutputs() {
  return `
    ${heading("Select output variants")}
    <p class="section-intro">Choose one asset for a quick test or the complete eight-format social pack.</p>
    <div class="variant-toolbar">
      <span class="field-label">${state.form.variants.size} selected</span>
      <button class="text-button" id="toggle-all" type="button">${state.form.variants.size === config().variants.length ? "Clear all" : "Select all"}</button>
    </div>
    <div class="variant-list">
      ${config().variants.map((variant) => `
        <label class="variant-row ${state.form.variants.has(variant.number) ? "selected" : ""}">
          <input type="checkbox" name="variant" value="${variant.number}" ${state.form.variants.has(variant.number) ? "checked" : ""}>
          <span class="variant-number">${variant.number}</span>
          <span class="variant-copy"><strong>${variant.name}</strong><small>${variant.platform} · ${variant.purpose}</small></span>
          <span class="ratio">${variant.aspect_ratio}</span>
        </label>
      `).join("")}
    </div>
  `;
}

function renderReferences() {
  const type = currentType();
  const references = selectedReferences();
  const requiredRole = type.roles.find((item) => item.level === "required");
  return `
    ${heading("Add references")}
    <p class="section-intro">Use the selected catalog image for the required role, or replace it with your own upload. Recommended and optional references can be added later.</p>
    <label class="catalog-subject-option">
      <input id="catalog-as-subject" type="checkbox" ${state.form.catalogAsSubject ? "checked" : ""}>
      <span>
        <strong>Use ${references[0]?.id || "selected reference"} as ${requiredRole.label.toLowerCase()}</strong>
        <small>Use the first selected catalog image for the required role. Upload below to replace it with your own subject.</small>
      </span>
    </label>
    <div class="upload-list">
      ${type.roles.map((item) => renderUploadRole(item)).join("")}
    </div>
    <div class="selected-direction selected-reference-summary">
      <span class="icon">${icons.grid}</span>
      <div>
        <h3>${references.length} catalog reference${references.length === 1 ? "" : "s"}</h3>
        <p class="hint">${references.map((item) => `${item.id} ${item.trend_name || item.name}`).join(" · ")}</p>
      </div>
      <span class="selected-miniatures">${references.slice(0, 4).map((item) => `<img src="/references/${item.file}" alt="">`).join("")}</span>
    </div>
  `;
}

function renderUploadRole(item) {
  const file = state.form.files[item.id];
  return `
    <div class="upload-row">
      <label class="upload-box" title="Choose ${escapeAttribute(item.label)}">
        ${file ? `<img src="${file.preview}" alt="">` : `<span class="icon">${icons.upload}</span>`}
        <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" data-role="${item.id}">
      </label>
      <div class="upload-copy">
        <div class="role-title">
          <h3>${item.label}</h3>
          <span class="role-level ${item.level}">${capitalize(item.level)}</span>
        </div>
        <p class="role-description">${item.description}</p>
        ${file ? `
          <div class="file-line">
            <span class="file-name">${escapeHtml(file.file.name)}</span>
            <button class="remove-file" type="button" data-remove-role="${item.id}" title="Remove file">${icons.close}</button>
          </div>
        ` : `<button class="text-button choose-file" type="button" data-choose-role="${item.id}">Choose image</button>`}
      </div>
    </div>
  `;
}

function renderReview() {
  const type = currentType();
  const trend = selectedTrend();
  const selectedVariants = config().variants.filter((item) => state.form.variants.has(item.number));
  const files = type.roles.filter((item) => state.form.files[item.id]);
  return `
    ${heading("Review and create")}
    <p class="section-intro">${ctx.mode === "hosted"
      ? "Choose your local campaigns folder. The hosted planner will write the complete campaign package there, including selected catalog images and uploaded references."
      : "The dashboard will create the campaign folder, write the brief, save references by role, and prepare the exact Codex generation command."}</p>
    <dl class="review-list">
      <div class="review-row"><dt>Campaign</dt><dd>${escapeHtml(state.form.name)}</dd></div>
      <div class="review-row"><dt>Type</dt><dd>${type.name}</dd></div>
      <div class="review-row"><dt>Goal</dt><dd>${escapeHtml(state.form.goal)}</dd></div>
      <div class="review-row"><dt>Trend</dt><dd>${trend ? `${escapeHtml(trend.name)} · ${escapeHtml(trend.category.name)}` : "None"}</dd></div>
      <div class="review-row"><dt>Visual direction</dt><dd>${selectedReferences().map((item) => `${item.id} ${item.trend_name || item.name}`).join("<br>")}</dd></div>
      <div class="review-row"><dt>Prompt rules</dt><dd>${selectedPromptRules().length ? selectedPromptRules().map((item) => escapeHtml(item.name)).join("<br>") : "None"}</dd></div>
      <div class="review-row"><dt>Outputs</dt><dd>${selectedVariants.map((item) => `${item.number} ${item.name}`).join("<br>")}</dd></div>
      <div class="review-row"><dt>Uploaded references</dt><dd>${files.length ? files.map((item) => `${item.label}: ${escapeHtml(state.form.files[item.id].file.name)}`).join("<br>") : "None"}</dd></div>
    </dl>
    <div class="command-preview">${escapeHtml(buildCommandPreview())}</div>
  `;
}

function renderActionBar() {
  return `
    <div class="action-bar">
      <button class="button" id="back-button" type="button" ${state.step === 0 || state.submitting ? "disabled" : ""}>
        ${icons.arrowLeft} Back
      </button>
      <button class="button primary" id="next-button" type="button" ${state.submitting ? "disabled" : ""}>
        ${state.step === 4 ? (state.submitting ? "Creating..." : ctx.mode === "hosted" ? "Choose folder and create" : "Create campaign") : `Continue ${icons.arrowRight}`}
      </button>
    </div>
  `;
}

function renderSummary() {
  const type = currentType();
  const references = selectedReferences();
  const trend = selectedTrend();
  return `
    <aside class="summary-rail">
      <h2>Campaign summary</h2>
      <div class="summary-block">
        <div class="summary-label">Campaign name</div>
        <div class="summary-value ${state.form.name ? "" : "summary-empty"}">${escapeHtml(state.form.name || "Not named yet")}</div>
      </div>
      <div class="summary-block">
        <div class="summary-label">Campaign type</div>
        <div class="summary-value">${type.name}</div>
      </div>
      <div class="summary-block">
        <div class="summary-label">Trend</div>
        <div class="summary-value ${trend ? "" : "summary-empty"}">${trend ? escapeHtml(trend.name) : "None selected"}</div>
      </div>
      <div class="summary-block">
        <div class="summary-label">Reference requirements</div>
        <ul class="requirement-list">
          ${type.roles.map((item) => `
            <li><span class="dot"></span><span>${item.label}</span><small>${capitalize(item.level)}</small></li>
          `).join("")}
        </ul>
      </div>
      <div class="summary-block">
        <div class="summary-label">Visual direction</div>
        <div class="summary-value">${references.length ? references.map((item) => item.id).join(", ") : "Not selected"}</div>
      </div>
      <div class="summary-block">
        <div class="summary-label">Output variants</div>
        <div class="summary-value">${state.form.variants.size} selected</div>
      </div>
      <div class="summary-block">
        <div class="summary-label">Prompt rules</div>
        <div class="summary-value">${state.form.promptRuleIds.size} active</div>
      </div>
      <div class="summary-note">${ctx.mode === "hosted"
        ? "Hosted planner mode writes the campaign to a folder you choose. Image generation still starts after you send the prepared command to Codex."
        : "Local production mode keeps every file inside this project. Image generation starts after you send the prepared command to Codex."}</div>
    </aside>
  `;
}

function renderSuccess() {
  const hosted = ctx.mode === "hosted";
  app.innerHTML = `
    <div class="app-shell">
      ${renderTopbar("wizard")}
      <main class="success">
        <span class="success-mark icon">${icons.check}</span>
        <h1>${state.created.mode === "download" ? "Launch brief downloaded" : "Campaign created"}</h1>
        <p><strong>${escapeHtml(state.created.path)}</strong> ${state.created.mode === "download"
          ? "contains the generation handoff. Add private references when you run it in Codex."
          : "now contains the brief, selected variants, assigned references, catalog direction, QA folders, and output folder."}</p>
        <div class="command-preview" id="final-command">${escapeHtml(state.created.command)}</div>
        <div class="success-actions">
          <button class="button primary" id="copy-command" type="button">${icons.copy} Copy generation command</button>
          ${hosted ? `<a class="button" href="#/catalog">Back to catalog</a>` : `<a class="button" href="#/c/${escapeAttribute(state.created.slug)}">Open campaign</a>`}
          <button class="button" id="new-campaign" type="button">Create another</button>
        </div>
      </main>
    </div>
  `;
  bindCopyButton(app.querySelector("#copy-command"), state.created.command, "Command copied");
  app.querySelector("#new-campaign").addEventListener("click", () => {
    mountWizard(app, ctx);
  });
}

function bindEvents() {
  app.querySelectorAll("[data-step]").forEach((button) => {
    button.addEventListener("click", () => {
      state.step = Number(button.dataset.step);
      state.error = "";
      render();
    });
  });

  app.querySelector("#back-button").addEventListener("click", () => {
    state.step = Math.max(0, state.step - 1);
    state.error = "";
    render();
  });
  app.querySelector("#next-button").addEventListener("click", next);

  if (state.step === 0) bindSetup();
  if (state.step === 1) bindDirection();
  if (state.step === 2) bindOutputs();
  if (state.step === 3) bindReferences();
}

function bindSetup() {
  app.querySelector("#campaign-name").addEventListener("input", (event) => {
    state.form.name = event.target.value;
    updateSummary();
  });
  app.querySelector("#campaign-goal").addEventListener("input", (event) => {
    state.form.goal = event.target.value;
  });
  app.querySelector("#campaign-audience").addEventListener("input", (event) => {
    state.form.audience = event.target.value;
  });
  app.querySelectorAll('input[name="campaign-type"]').forEach((input) => {
    input.addEventListener("change", () => {
      state.form.type = input.value;
      state.form.groupId = currentType().defaultGroup;
      state.form.referenceIds = new Set([currentGroup().references[0].id]);
      state.form.files = {};
      render();
    });
  });
  app.querySelectorAll('input[name="fashion-energy"]').forEach((input) => {
    input.addEventListener("change", () => {
      state.form.fashionEnergy = input.value;
      render();
    });
  });
}

function bindDirection() {
  app.querySelector("#catalog-search").addEventListener("input", (event) => {
    state.form.catalogQuery = event.target.value;
    window.clearTimeout(state.searchTimer);
    state.searchTimer = window.setTimeout(render, 120);
  });

  const trendSearchInput = app.querySelector("#trend-search");
  if (trendSearchInput) {
    trendSearchInput.addEventListener("input", (event) => {
      state.form.trendSearch = event.target.value;
      window.clearTimeout(state.searchTimer);
      state.searchTimer = window.setTimeout(render, 120);
    });
  }
  const clearTrendSearch = app.querySelector(".clear-trend-search");
  if (clearTrendSearch) {
    clearTrendSearch.addEventListener("click", () => {
      state.form.trendSearch = "";
      render();
    });
  }

  app.querySelectorAll("[data-trend]").forEach((button) => {
    button.addEventListener("click", () => {
      state.form.trendId = state.form.trendId === button.dataset.trend ? null : button.dataset.trend;
      render();
    });
  });
  app.querySelectorAll('input[name="prompt-rule"]').forEach((input) => {
    input.addEventListener("change", () => {
      if (input.checked) state.form.promptRuleIds.add(input.value);
      else state.form.promptRuleIds.delete(input.value);
      render();
    });
  });
  app.querySelectorAll("[data-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      state.form.catalogFilter = button.dataset.filter;
      render();
    });
  });
  app.querySelectorAll("[data-reference]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      const id = button.dataset.reference;
      if (state.form.referenceIds.has(id)) state.form.referenceIds.delete(id);
      else state.form.referenceIds.add(id);
      const selected = allReferences().find((item) => item.id === id);
      if (selected) state.form.groupId = selected.group.id;
      render();
    });
  });
  app.querySelectorAll("[data-preview]").forEach((button) => {
    button.addEventListener("click", () => {
      state.form.previewId = button.dataset.preview;
      render();
    });
  });
  app.querySelectorAll("[data-close-preview]").forEach((button) => {
    button.addEventListener("click", (event) => {
      if (event.target === button || button.classList.contains("modal-close")) {
        state.form.previewId = null;
        render();
      }
    });
  });
  app.querySelectorAll("[data-copy-prompt]").forEach((button) => {
    button.addEventListener("click", async (event) => {
      event.stopPropagation();
      const item = allReferences().find((reference) => reference.id === button.dataset.copyPrompt);
      if (!item?.prompt_frame) return;
      await navigator.clipboard.writeText(item.prompt_frame);
      button.textContent = "Prompt copied";
    });
  });
  app.querySelector("#clear-references")?.addEventListener("click", () => {
    state.form.referenceIds.clear();
    render();
  });
  app.querySelector("#select-filtered").addEventListener("click", () => {
    const visibleIds = [...app.querySelectorAll(".reference-card [data-reference]")]
      .map((button) => button.dataset.reference);
    visibleIds.forEach((id) => state.form.referenceIds.add(id));
    const first = selectedReferences()[0];
    if (first) state.form.groupId = first.group.id;
    render();
  });
  bindValue("#campaign-mood", "mood");
  bindValue("#campaign-text", "exactText");
  bindValue("#campaign-avoid", "avoid");
}

function bindOutputs() {
  app.querySelector("#toggle-all").addEventListener("click", () => {
    state.form.variants = state.form.variants.size === config().variants.length
      ? new Set()
      : new Set(config().variants.map((item) => item.number));
    render();
  });
  app.querySelectorAll('input[name="variant"]').forEach((input) => {
    input.addEventListener("change", () => {
      if (input.checked) state.form.variants.add(input.value);
      else state.form.variants.delete(input.value);
      render();
    });
  });
}

function bindReferences() {
  app.querySelector("#catalog-as-subject").addEventListener("change", (event) => {
    state.form.catalogAsSubject = event.target.checked;
    render();
  });
  app.querySelectorAll('input[type="file"][data-role]').forEach((input) => {
    input.addEventListener("change", () => setFile(input.dataset.role, input.files[0]));
  });
  app.querySelectorAll("[data-choose-role]").forEach((button) => {
    button.addEventListener("click", () => {
      app.querySelector(`input[data-role="${button.dataset.chooseRole}"]`).click();
    });
  });
  app.querySelectorAll("[data-remove-role]").forEach((button) => {
    button.addEventListener("click", () => {
      const item = state.form.files[button.dataset.removeRole];
      if (item?.preview) URL.revokeObjectURL(item.preview);
      delete state.form.files[button.dataset.removeRole];
      render();
    });
  });
}

function bindValue(selector, property) {
  app.querySelector(selector).addEventListener("input", (event) => {
    state.form[property] = event.target.value;
  });
}

function setFile(roleId, file) {
  if (!file) return;
  if (!["image/png", "image/jpeg", "image/webp", "image/gif"].includes(file.type)) {
    state.error = "References must be PNG, JPEG, WebP, or GIF images.";
    render();
    return;
  }
  if (file.size > 15 * 1024 * 1024) {
    state.error = `${file.name} is larger than the 15 MB per-file limit.`;
    render();
    return;
  }
  const existing = state.form.files[roleId];
  if (existing?.preview) URL.revokeObjectURL(existing.preview);
  state.form.files[roleId] = { file, preview: URL.createObjectURL(file) };
  state.error = "";
  render();
}

async function next() {
  const error = validateStep();
  if (error) {
    state.error = error;
    render();
    return;
  }
  state.error = "";
  if (state.step < 4) {
    state.step += 1;
    render();
    window.scrollTo({ top: 0, behavior: "smooth" });
    return;
  }
  await submitCampaign();
}

function validateStep() {
  if (state.step === 0) {
    if (!state.form.name.trim()) return "Enter a campaign name.";
    if (!state.form.goal.trim()) return "Describe the campaign goal.";
  }
  if (state.step === 1 && state.form.referenceIds.size === 0) return "Select at least one visual reference.";
  if (state.step === 2 && state.form.variants.size === 0) return "Select at least one output variant.";
  if (state.step === 3) {
    const missing = currentType().roles.find((item) =>
      item.level === "required" && !state.form.files[item.id] && !state.form.catalogAsSubject,
    );
    if (missing) return `Add the required reference: ${missing.label}.`;
  }
  return "";
}

async function submitCampaign() {
  const missing = currentType().roles.find((item) =>
    item.level === "required" && !state.form.files[item.id] && !state.form.catalogAsSubject,
  );
  if (missing) {
    state.error = `Add the required reference: ${missing.label}.`;
    state.step = 3;
    render();
    return;
  }

  state.submitting = true;
  render();
  try {
    const meta = {
      name: state.form.name.trim(),
      type: state.form.type,
      typeLabel: currentType().name,
      fashionEnergy: state.form.type === "fashion" ? state.form.fashionEnergy : null,
      goal: state.form.goal.trim(),
      audience: state.form.audience.trim(),
      groupId: state.form.groupId,
      referenceIds: [...state.form.referenceIds],
      trendId: state.form.trendId,
      catalogAsSubject: state.form.catalogAsSubject,
      promptRuleIds: [...state.form.promptRuleIds],
      mood: state.form.mood.trim(),
      exactText: state.form.exactText.trim(),
      avoid: state.form.avoid.trim(),
      variants: [...state.form.variants].sort(),
      uploadedRoles: Object.keys(state.form.files),
    };

    if (ctx.mode === "hosted") {
      state.created = await createHostedCampaign(meta, state.form.files, currentType().roles, config());
      return;
    }

    const formData = new FormData();
    formData.set("meta", JSON.stringify(meta));
    for (const item of currentType().roles) {
      const selected = state.form.files[item.id];
      if (!selected) continue;
      // Field name carries role + label so the server can rebuild the upload
      // metadata without a second JSON round-trip through base64.
      formData.append(`ref__${item.id}__${encodeURIComponent(item.label)}`, selected.file, selected.file.name);
    }

    const response = await fetch("/api/campaigns", { method: "POST", body: formData });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Campaign creation failed.");
    await ctx.refreshCampaigns();
    state.created = result;
  } catch (error) {
    state.error = error.message;
  } finally {
    state.submitting = false;
    render();
  }
}

function buildCommandPreview() {
  const trend = selectedTrend();
  const references = selectedReferences().map((item) => item.id).join(", ");
  const variants = [...state.form.variants].sort().join(", ");
  const rules = selectedPromptRules();
  const uploads = Object.keys(state.form.files).length
    ? " Use uploaded references according to their assigned roles."
    : "";
  const trendLine = trend ? ` Follow the "${trend.name}" trend prompt frame recorded in brief.md.` : "";
  const ruleLine = rules.length ? ` Apply prompt rule presets: ${rules.map((rule) => rule.name).join(", ")}.` : "";
  return `Run campaign campaigns/${slugify(state.form.name)}.${trendLine} Use library references ${references} as the visual direction.${uploads}${ruleLine} Generate variants ${variants}. Save every result in the campaign outputs folder and update run-log.md.`;
}

function updateSummary() {
  const values = app.querySelectorAll(".summary-value");
  if (!values.length) return;
  values[0].textContent = state.form.name || "Not named yet";
  values[0].classList.toggle("summary-empty", !state.form.name);
}
