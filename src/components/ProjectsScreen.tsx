import { useState } from "react";
import type { PublishFields } from "../api/client";
import { gridFromParameters } from "../domain/geometry";
import { estimateMaterials } from "../domain/materials";
import type { GridSpec, PlacedBrick, ReadyProject } from "../domain/types";
import type { Locale, Translate } from "../i18n";
import { ClassicRussianStoveGuide } from "./ClassicRussianStoveGuide";
import { HouseRussianGuide } from "./HouseRussianGuide";
import { RowMap } from "./RowMap";
import { RussianStoveGuide } from "./RussianStoveGuide";
import { Pill, SectionTitle } from "./ui";

export function ProjectsScreen({
  locale,
  t,
  projects,
  onLoad,
  userLogin,
  onPublish,
  onUnpublish,
  onDelete
}: {
  locale: Locale;
  t: Translate;
  projects: ReadyProject[];
  onLoad: (project: ReadyProject) => void;
  userLogin: string | null;
  onPublish: (project: ReadyProject, fields: PublishFields) => Promise<void>;
  onUnpublish: (project: ReadyProject) => Promise<void>;
  onDelete: (project: ReadyProject) => Promise<void>;
}) {
  const [query, setQuery] = useState("");
  const searchQuery = query.trim().toLowerCase();
  const unit = t("unitCm");
  const mine = projects.filter((project) => userLogin && project.ownerLogin === userLogin);
  const templates = projects.filter(
    (project) =>
      !(userLogin && project.ownerLogin === userLogin) && project.title[locale].toLowerCase().includes(searchQuery)
  );

  const renderCard = (project: ReadyProject) => {
    const projectGrid = gridFromParameters(project.parameters);
    const projectMaterials = estimateMaterials(Object.values(project.rows).flat(), project.parameters);
    return (
      <article key={project.id} className="project-card">
        <div className="p-3">
          <div className="mb-2 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-xl font-semibold leading-6">{project.title[locale]}</h3>
              <p className="mt-1 text-sm font-bold leading-5 text-[#283732]/70">{project.subtitle[locale]}</p>
            </div>
            <div
              className="grid h-12 w-12 shrink-0 place-items-center rounded-lg border border-[#283732]/10 text-xl font-semibold text-[#ffffff]"
              style={{ backgroundColor: project.accent }}
              aria-hidden="true"
            >
              <span aria-hidden="true">▤</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Pill>
              {t("projectFootprint")}: {project.parameters.foundationWidth}×{project.parameters.foundationLength} {unit}
            </Pill>
            <Pill>
              {project.rowCount} {t("projectRows")}
            </Pill>
            <Pill>
              {t("totalPlaced")}: {projectMaterials.total}
            </Pill>
          </div>
        </div>
        {(project.id === "russian-stove-hob" ||
          project.id === "classic-russian-stove-hob" ||
          project.id.startsWith("russian-house-6x9")) && (
          <details className="project-details">
            <summary>{t("projectDetails")}</summary>
            {project.id === "russian-stove-hob" ? <RussianStoveGuide locale={locale} /> : null}

            {project.id === "classic-russian-stove-hob" ? <ClassicRussianStoveGuide locale={locale} /> : null}

            {project.id.startsWith("russian-house-6x9") && <HouseRussianGuide project={project} />}
          </details>
        )}
        <ProjectOrderPreview grid={projectGrid} rows={project.rows} rowCount={project.rowCount} t={t} />
        <div className="space-y-2 p-3 pt-0">
          {project.ownerLogin ? null : (
            <p className="rounded-lg bg-[#f4f5f1]/80 px-3 py-2 text-xs font-bold leading-4 text-[#283732]/65">
              {t("projectDemoNotice")}
            </p>
          )}
          <button
            type="button"
            aria-label={`${t("loadProject")}: ${project.title[locale]}`}
            onClick={() => onLoad(project)}
            className="studio-primary w-full"
          >
            {t("loadProject")}
          </button>
          {userLogin && project.ownerLogin === userLogin ? (
            <>
              <PublishControls
                project={project}
                title={project.title[locale]}
                t={t}
                onPublish={onPublish}
                onUnpublish={onUnpublish}
              />
              <button
                type="button"
                aria-label={`${t("deleteProject")}: ${project.title[locale]}`}
                onClick={() => {
                  if (window.confirm(`${t("deleteProjectConfirm")} «${project.title[locale]}»`)) void onDelete(project);
                }}
                className="w-full rounded-lg px-4 py-2 text-xs font-semibold text-[#9b2c2c]/80 underline"
              >
                {t("deleteProject")}
              </button>
            </>
          ) : null}
        </div>
      </article>
    );
  };

  return (
    <section className="project-catalog">
      {userLogin && (
        <>
          <SectionTitle title={t("accountProjectsTitle")} subtitle={t("myProjectsSubtitle")} />
          {mine.length ? (
            <div className="project-grid">{mine.map(renderCard)}</div>
          ) : (
            <p className="rounded-lg bg-[#ffffff] px-4 py-5 text-center text-sm font-bold text-[#283732]/70">
              {t("myProjectsEmpty")}
            </p>
          )}
        </>
      )}
      <div className="pt-4">
        <SectionTitle title={t("templatesTitle")} subtitle={t("projectsSubtitle")} />
      </div>
      <label className="catalog-search">
        {t("findTemplate")} <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} />
      </label>
      <div className="project-grid">{templates.map(renderCard)}</div>
      {!templates.length && <output className="empty-state">{t("noTemplates")}</output>}
    </section>
  );
}

function PublishControls({
  project,
  title,
  t,
  onPublish,
  onUnpublish
}: {
  project: ReadyProject;
  title: string;
  t: Translate;
  onPublish: (project: ReadyProject, fields: PublishFields) => Promise<void>;
  onUnpublish: (project: ReadyProject) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [description, setDescription] = useState(project.showcase?.description ?? "");
  const [price, setPrice] = useState(project.showcase?.price != null ? String(project.showcase.price) : "");
  const [region, setRegion] = useState(project.showcase?.region ?? "");

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    try {
      await action();
      setOpen(false);
    } finally {
      setBusy(false);
    }
  };

  if (project.showcase?.published) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-lg bg-[#326856]/15 px-3 py-2">
        <span className="text-xs font-semibold text-[#326856]">✓ {t("publishedBadge")}</span>
        <button
          type="button"
          aria-label={`${t("unpublishAction")}: ${title}`}
          onClick={() => run(() => onUnpublish(project))}
          disabled={busy}
          className="rounded-full px-3 py-1.5 text-xs font-semibold text-[#283732]/60 underline disabled:opacity-50"
        >
          {t("unpublishAction")}
        </button>
      </div>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        aria-label={`${t("publishAction")}: ${title}`}
        onClick={() => setOpen(true)}
        className="min-h-12 w-full rounded-lg border border-[#326856]/40 px-4 text-sm font-semibold text-[#326856]"
      >
        {t("publishAction")}
      </button>
    );
  }

  const inputClass =
    "min-h-12 w-full rounded-[16px] border border-[#283732]/10 bg-white px-3 text-sm font-bold outline-none focus:border-[#326856]/60";
  return (
    <div className="space-y-2 rounded-lg bg-[#f4f5f1]/80 p-3">
      <label className="block text-sm font-bold">
        <span className="mb-1 block">{t("publishDescriptionPlaceholder")}</span>
        <textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder={t("publishDescriptionPlaceholder")}
          rows={3}
          className={`${inputClass} resize-none py-2`}
        />
      </label>
      <label className="block text-sm font-bold">
        <span className="mb-1 block">{t("publishPricePlaceholder")}</span>
        <input
          value={price}
          onChange={(event) => setPrice(event.target.value.replace(/\D/g, ""))}
          placeholder={t("publishPricePlaceholder")}
          inputMode="numeric"
          className={inputClass}
        />
      </label>
      <label className="block text-sm font-bold">
        <span className="mb-1 block">{t("publishRegionPlaceholder")}</span>
        <input
          value={region}
          onChange={(event) => setRegion(event.target.value)}
          placeholder={t("publishRegionPlaceholder")}
          className={inputClass}
        />
      </label>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() =>
            run(() =>
              onPublish(project, {
                description: description.trim(),
                price: price ? Number(price) : null,
                region: region.trim()
              })
            )
          }
          disabled={busy}
          className="min-h-12 flex-1 rounded-lg bg-[#326856] px-4 text-sm font-semibold text-[#ffffff] disabled:opacity-60"
        >
          {t("publishSubmit")}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          disabled={busy}
          className="min-h-12 rounded-lg bg-[#283732]/10 px-4 text-sm font-semibold disabled:opacity-50"
        >
          {t("cancel")}
        </button>
      </div>
    </div>
  );
}

export function ProjectOrderPreview({
  grid,
  rows,
  rowCount,
  t
}: {
  grid: GridSpec;
  rows: Record<number, PlacedBrick[]>;
  rowCount: number;
  t: Translate;
}) {
  const [expanded, setExpanded] = useState(false);
  const [requestedPage, setPage] = useState(0);
  // A saved project can lose rows while its existing card stays mounted.
  const page = Math.min(requestedPage, Math.max(0, Math.ceil(rowCount / 6) - 1));
  return (
    <div className="border-y border-[#283732]/10 bg-[#f4f5f1] px-3 py-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="text-xs font-semibold uppercase tracking-wide text-[#283732]/55">{t("rowsRail")}</div>
        <div className="text-[11px] font-semibold text-[#326856]">
          {t("currentRow")} 1 → {rowCount}
        </div>
      </div>
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => setExpanded(!expanded)}
        className="min-h-11 rounded-lg border px-3"
      >
        {t(expanded ? "collapseOrderPreview" : "showOrderPreview")}
      </button>
      {expanded && (
        <>
          <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none]">
            {Array.from({ length: Math.min(6, rowCount - page * 6) }).map((_, index) => {
              const row = page * 6 + index + 1;
              return (
                <div key={row} className="w-[150px] shrink-0 rounded-lg border border-[#283732]/10 bg-[#ffffff] p-2">
                  <div className="mb-1 flex items-center justify-between text-[11px] font-semibold">
                    <span>
                      {t("currentRow")} {row}
                    </span>
                    <span className="text-[#326856]">{rows[row]?.length ?? 0}</span>
                  </div>
                  <RowMap grid={grid} bricks={rows[row] ?? []} variant="screen" />
                </div>
              );
            })}
          </div>
          <div className="part-actions">
            <button type="button" disabled={page === 0} onClick={() => setPage(page - 1)}>
              ← {t("rowsRail")}
            </button>
            <span>
              {page * 6 + 1}–{Math.min(rowCount, page * 6 + 6)} / {rowCount}
            </span>
            <button type="button" disabled={(page + 1) * 6 >= rowCount} onClick={() => setPage(page + 1)}>
              {t("rowsRail")} →
            </button>
          </div>
        </>
      )}
    </div>
  );
}
