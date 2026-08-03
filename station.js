import { api, escapeHtml } from "./js/lib.js";
import { mountGallery, refreshCampaigns } from "./js/gallery.js";
import { mountWizard } from "./js/wizard.js";
import { mountDetail } from "./js/detail.js";
import { mountCatalog } from "./js/catalog.js";
import { promptRulePresets } from "./js/station-config.js";

const app = document.querySelector("#app");

const ctx = {
  config: null,
  mode: "local",
  wizardPrefill: null,
  navigate(hash) {
    if (window.location.hash === hash) route();
    else window.location.hash = hash;
  },
  refreshCampaigns: () => ctx.mode === "local" ? refreshCampaigns(ctx) : Promise.resolve(),
};

async function boot() {
  try {
    try {
      ctx.config = await api("/api/config");
      ctx.mode = "local";
    } catch {
      const [libraryResponse, trendsResponse, variantsResponse] = await Promise.all([
        fetch("/references/library.json"),
        fetch("/trends/trend-library.json"),
        fetch("/campaigns/_template/variants.json"),
      ]);
      if (![libraryResponse, trendsResponse, variantsResponse].every((response) => response.ok)) {
        throw new Error("The hosted catalog data could not be loaded.");
      }
      const [library, trends, variants] = await Promise.all([
        libraryResponse.json(),
        trendsResponse.json(),
        variantsResponse.json(),
      ]);
      ctx.config = { library, trends, variants: variants.outputs, promptRules: promptRulePresets, campaigns: [] };
      ctx.mode = "hosted";
    }
    window.__stationMode = ctx.mode;
    window.addEventListener("hashchange", route);
    route();
  } catch (error) {
    app.innerHTML = `<div class="boot-state"><strong>Station unavailable</strong><span>${escapeHtml(error.message)}</span></div>`;
  }
}

async function route() {
  const hash = window.location.hash || "#/";
  const [routePath, queryString = ""] = hash.split("?");
  window.scrollTo(0, 0);
  const detailMatch = routePath.match(/^#\/c\/([a-z0-9-]+)$/);
  if (detailMatch) {
    if (ctx.mode !== "local") {
      ctx.navigate("#/new");
      return;
    }
    await mountDetail(app, ctx, detailMatch[1]);
    return;
  }
  if (routePath === "#/catalog") {
    mountCatalog(app, ctx);
    return;
  }
  if (routePath === "#/new") {
    const params = new URLSearchParams(queryString);
    ctx.wizardPrefill = { trendId: params.get("trend"), referenceId: params.get("ref") };
    mountWizard(app, ctx);
    ctx.wizardPrefill = null;
    return;
  }
  try {
    await ctx.refreshCampaigns();
  } catch {
    // Keep the cached list if the refresh fails.
  }
  mountGallery(app, ctx);
}

boot();
