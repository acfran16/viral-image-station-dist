import { slugify } from "./lib.js";

function allReferences(config) {
  return config.library.groups.flatMap((group) =>
    group.references.map((reference) => ({ ...reference, group })),
  );
}

function selectedReferences(meta, config) {
  const selected = new Set(meta.referenceIds ?? []);
  return allReferences(config).filter((item) => selected.has(item.id));
}

function selectedTrend(meta, config) {
  for (const category of config.trends.categories ?? []) {
    const trend = category.trends.find((item) => item.id === meta.trendId);
    if (trend) return { ...trend, category: category.name };
  }
  return null;
}

function selectedRules(meta, config) {
  const selected = new Set(meta.promptRuleIds ?? []);
  return (config.promptRules ?? []).filter((item) => selected.has(item.id));
}

function selectedVariants(meta, config) {
  const selected = new Set(meta.variants ?? []);
  return (config.variants ?? []).filter((item) => selected.has(item.number));
}

export function buildGenerationCommand(meta, config) {
  const slug = slugify(meta.name);
  const trend = selectedTrend(meta, config);
  const references = selectedReferences(meta, config).map((item) => item.id).join(", ");
  const variants = selectedVariants(meta, config).map((item) => item.number).join(", ");
  const rules = selectedRules(meta, config);
  const uploads = meta.uploadedRoles?.length
    ? " Use the uploaded references according to their assigned roles."
    : "";
  const trendLine = trend ? ` Follow the "${trend.name}" trend prompt frame recorded in brief.md.` : "";
  const ruleLine = rules.length ? ` Apply prompt rule presets: ${rules.map((rule) => rule.name).join(", ")}.` : "";
  return `Run campaign campaigns/${slug}.${trendLine} Use library references ${references} as the visual direction.${uploads}${ruleLine} Generate variants ${variants}. Save every result in the campaign outputs folder and update run-log.md.`;
}

async function writeEntry(directory, name, content) {
  const handle = await directory.getFileHandle(name, { create: true });
  const writable = await handle.createWritable();
  await writable.write(content);
  await writable.close();
}

async function getDirectory(directory, path) {
  let current = directory;
  for (const part of path.split("/").filter(Boolean)) {
    current = await current.getDirectoryHandle(part, { create: true });
  }
  return current;
}

function safeFileName(value, fallback = "reference") {
  const source = String(value ?? "");
  const dot = source.lastIndexOf(".");
  const extension = dot >= 0 ? source.slice(dot).toLowerCase().replace(/[^.a-z0-9]/g, "") : "";
  const stem = (dot >= 0 ? source.slice(0, dot) : source)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60) || fallback;
  return `${stem}${extension}`;
}

function renderBrief(meta, config, uploaded, references) {
  const trend = selectedTrend(meta, config);
  const rules = selectedRules(meta, config);
  const variants = selectedVariants(meta, config);
  const fashionGuidance = {
    refined: "Elegant tailoring, controlled silhouettes, quiet luxury, and composed editorial posing.",
    bold: "Preserve the adult subject's original confidence, silhouette, styling intent, and level of edge. Use assertive editorial styling that fits the campaign concept.",
    "avant-garde": "Use experimental adult runway styling with sculptural shapes, unexpected layering, dramatic proportion, strong accessories, and expressive editorial posing.",
  };
  const referenceLines = [
    ...uploaded.map((item) => `- \`${item.relativePath}\` - ${item.roleLabel}`),
    ...references.map((item) => `- \`${item.relativePath}\` - ${item.id} ${item.name} visual direction`),
  ];
  return `# Campaign Brief

## Campaign

Name: ${meta.name}

Goal: ${meta.goal || "To be completed before generation."}

Audience: ${meta.audience || "General social audience"}

Campaign type: ${meta.typeLabel}

Fashion energy: ${meta.type === "fashion" ? meta.fashionEnergy || "bold" : "Not applicable"}

## References

${referenceLines.join("\n") || "No reference files were added during setup."}

## Hard Rules

- Keep all generated outputs inside this campaign folder.
- Use assigned reference roles as the source of truth.
- Preserve product, subject, identity, and brand details where applicable.
- For adult fashion subjects, preserve the reference's confidence, styling intent, silhouette, and level of edge.
- Do not add modesty, coverage, conservative styling, or desexualizing modifiers unless explicitly requested.
- Keep results non-explicit, anatomically coherent, and suitable for the requested channel.
- Record every generated file in \`run-log.md\`.

${rules.length ? `## Prompt Rule Presets\n\n${rules.map((rule) => `- **${rule.name}**: ${rule.prompt}`).join("\n")}\n` : ""}
## Visual Direction

Trend: ${trend ? `${trend.name} (${trend.category})` : "None selected"}

${trend?.prompt_frame ? `Trend prompt frame:\n\n\`\`\`text\n${trend.prompt_frame}\n\`\`\`\n` : ""}
Catalog references: ${references.map((item) => `${item.id} ${item.name}`).join(", ") || "None selected"}

Mood: ${meta.mood || "To be determined from references"}

Fashion styling guidance: ${meta.type === "fashion" ? fashionGuidance[meta.fashionEnergy] || fashionGuidance.bold : "Not applicable"}

Exact text: ${meta.exactText || "None supplied"}

Avoid: ${meta.avoid || "Watermarks, accidental logos, distorted anatomy, and unreadable text"}

## Output Plan

Selected variants: ${variants.map((item) => item.number).join(", ")}

Generation mode: Built-in Codex image generation; no separate API key required.

## QA and Handoff

- Review outputs for anatomy, product accuracy, lighting consistency, reflection problems, and platform readiness.
- Copy usable files into \`approved/\`, failed files into \`rejected/\`, and fixable files into \`needs-rerun/\`.
- Use \`exports/\` for approved handoff packages.
`;
}

function renderVariantBrief(output) {
  return `# ${output.number} - ${output.name}

## Use

${output.platform}; ${output.purpose}; ${output.aspect_ratio} crop.

## Prompt Brief

\`\`\`text
Use this campaign's assigned subject and visual references as the source of truth. Create a ${output.aspect_ratio} ${output.purpose.toLowerCase()} for ${output.platform}. Preserve the campaign subject, mood, required text, and avoid rules. Keep the composition immediately readable at social-media size.
\`\`\`

## Output

\`\`\`text
outputs/${output.filename}
\`\`\`
`;
}

function qaTemplate(name) {
  return `# ${name} QA filter

## Approved

| File | Use | Notes |
| --- | --- | --- |
|  |  |  |

## Needs rerun

| File | Issue | Rerun guidance |
| --- | --- | --- |
|  |  |  |

## Rejected

| File | Reason |
| --- | --- |
|  |  |
`;
}

function downloadLaunchFile(meta, config) {
  const slug = slugify(meta.name);
  const command = buildGenerationCommand(meta, config);
  const content = `# ${meta.name} launch brief\n\n${command}\n\nUse the selected catalog references and attach any private subject or product references in Codex before generation.\n`;
  const url = URL.createObjectURL(new Blob([content], { type: "text/markdown" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `${slug}-launch.md`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return { slug, path: `${slug}-launch.md`, command, mode: "download" };
}

export async function createHostedCampaign(meta, filesByRole, roles, config) {
  if (!("showDirectoryPicker" in window)) {
    return downloadLaunchFile(meta, config);
  }

  const slug = slugify(meta.name);
  const campaignsDirectory = await window.showDirectoryPicker({
    id: "viral-image-station-campaigns",
    mode: "readwrite",
    startIn: "documents",
  });

  try {
    await campaignsDirectory.getDirectoryHandle(slug);
    throw new Error(`A campaign folder named ${slug} already exists in the selected folder.`);
  } catch (error) {
    if (error.name !== "NotFoundError") throw error;
  }

  const campaignDirectory = await campaignsDirectory.getDirectoryHandle(slug, { create: true });
  const referencesDirectory = await getDirectory(campaignDirectory, "references");
  const catalogDirectory = await getDirectory(campaignDirectory, "references/library-selected");
  const briefsDirectory = await getDirectory(campaignDirectory, "briefs");
  for (const name of ["outputs", "approved", "rejected", "needs-rerun", "exports"]) {
    await getDirectory(campaignDirectory, name);
  }

  const references = [];
  for (const item of selectedReferences(meta, config)) {
    const response = await fetch(`/references/${item.file}`);
    if (!response.ok) throw new Error(`Could not copy catalog reference ${item.id}.`);
    const outputName = `${item.id}-${safeFileName(item.file.split("/").at(-1)).replace(/^r\d+-/i, "")}`;
    await writeEntry(catalogDirectory, outputName, await response.blob());
    references.push({
      id: item.id,
      name: item.trend_name || item.name,
      source_url: item.source_url,
      relativePath: `references/library-selected/${outputName}`,
    });
  }

  const uploaded = [];
  let uploadIndex = 1;
  for (const role of roles) {
    const selected = filesByRole[role.id];
    if (!selected?.file) continue;
    const outputName = `${String(uploadIndex).padStart(2, "0")}-${role.id}-${safeFileName(selected.file.name)}`;
    await writeEntry(referencesDirectory, outputName, selected.file);
    uploaded.push({ relativePath: `references/${outputName}`, role: role.id, roleLabel: role.label });
    uploadIndex += 1;
  }

  const variants = selectedVariants(meta, config);
  const trend = selectedTrend(meta, config);
  const rules = selectedRules(meta, config);
  const command = buildGenerationCommand({ ...meta, uploadedRoles: uploaded.map((item) => item.role) }, config);
  const manifest = {
    campaign: slug,
    display_name: meta.name,
    campaign_type: meta.type,
    campaign_type_label: meta.typeLabel,
    fashion_energy: meta.type === "fashion" ? meta.fashionEnergy || "bold" : null,
    created_at: new Date().toISOString(),
    created_with: "Viral Image Station hosted workspace mode",
    trend: trend ? { id: trend.id, name: trend.name, category: trend.category } : null,
    catalog_references: references,
    catalog_reference_role: meta.catalogAsSubject ? "required subject" : "visual direction",
    references: uploaded,
    prompt_rules: rules,
    selected_variants: variants.map((item) => item.number),
    generation_command: command,
  };

  await writeEntry(campaignDirectory, "campaign.json", `${JSON.stringify(manifest, null, 2)}\n`);
  await writeEntry(campaignDirectory, "variants.json", `${JSON.stringify({
    campaign: slug,
    reference_policy: "Use files according to the roles recorded in campaign.json and brief.md.",
    outputs: variants,
  }, null, 2)}\n`);
  await writeEntry(campaignDirectory, "brief.md", renderBrief(meta, config, uploaded, references));
  await writeEntry(campaignDirectory, "run-log.md", `# Run Log\n\n- Campaign folder created ${new Date().toISOString()} from hosted workspace mode.\n`);
  await writeEntry(campaignDirectory, "captions.md", "# Captions\n\nAdd hooks, captions, and hashtags after selecting final outputs.\n");
  await writeEntry(campaignDirectory, "qa-filter.md", qaTemplate(meta.name));
  await writeEntry(campaignDirectory, "handoff.md", `# ${meta.name} handoff\n\nCopy approved assets into \`approved/\`, then package final files under \`exports/\`.\n`);
  await writeEntry(campaignDirectory, "generation-command.txt", `${command}\n`);
  for (const output of variants) {
    await writeEntry(briefsDirectory, output.filename.replace(/\.[^.]+$/, ".md"), renderVariantBrief(output));
  }

  return {
    slug,
    path: `${campaignsDirectory.name}/${slug}`,
    command,
    uploaded: uploaded.length,
    variants: variants.length,
    mode: "hosted-workspace",
  };
}
