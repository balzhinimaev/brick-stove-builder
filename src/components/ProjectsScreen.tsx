import { useState } from "react";
import { COLORS } from "../theme/colors";
import type { Locale, Translate } from "../i18n";
import type { GridSpec, PlacedBrick, ReadyProject } from "../domain/types";
import type { PublishFields } from "../api/client";
import { brickBoxes, gridFromParameters } from "../domain/geometry";
import { estimateMaterials } from "../domain/materials";
import { getToolColor } from "../domain/tools";
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
  const unit = t("unitCm");
  const mine = projects.filter((project) => userLogin && project.ownerLogin === userLogin);
  const templates = projects.filter((project) => !(userLogin && project.ownerLogin === userLogin));

  const renderCard = (project: ReadyProject) => {
    const projectGrid = gridFromParameters(project.parameters);
    const projectMaterials = estimateMaterials(Object.values(project.rows).flat(), project.parameters);
    return (
            <article key={project.id} className="overflow-hidden rounded-[26px] border-2 border-[#3D2B1F]/10 bg-[#F5E6C8] shadow-md shadow-[#3D2B1F]/10">
              <div className="p-3">
                <div className="mb-2 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-xl font-black leading-6">{project.title[locale]}</h3>
                    <p className="mt-1 text-sm font-bold leading-5 text-[#3D2B1F]/70">{project.subtitle[locale]}</p>
                  </div>
                  <div className="grid h-12 w-12 shrink-0 place-items-center rounded-[18px] border-2 border-[#3D2B1F]/10 text-xl font-black text-[#F5E6C8]" style={{ backgroundColor: project.accent }} aria-hidden="true">炉</div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Pill>{t("projectFootprint")}: {project.parameters.foundationWidth}×{project.parameters.foundationLength} {unit}</Pill>
                  <Pill>{project.rowCount} {t("projectRows")}</Pill>
                  <Pill>{t("totalPlaced")}: {projectMaterials.total}</Pill>
                </div>
              </div>
              <ProjectOrderPreview grid={projectGrid} rows={project.rows} rowCount={project.rowCount} t={t} />
              <div className="space-y-2 p-3 pt-0">
                {project.ownerLogin ? null : (
                  <p className="rounded-[18px] bg-[#FFF7E8]/80 px-3 py-2 text-xs font-bold leading-4 text-[#3D2B1F]/65">{t("projectDemoNotice")}</p>
                )}
                <button onClick={() => onLoad(project)} className="min-h-13 w-full rounded-[20px] bg-[#C1440E] px-4 text-sm font-black text-[#F5E6C8] shadow-lg shadow-[#C1440E]/20">{t("loadProject")}</button>
                {userLogin && project.ownerLogin === userLogin ? (
                  <>
                    <PublishControls project={project} t={t} onPublish={onPublish} onUnpublish={onUnpublish} />
                    <button
                      onClick={() => {
                        if (window.confirm(`${t("deleteProjectConfirm")} «${project.title[locale]}»`)) void onDelete(project);
                      }}
                      className="w-full rounded-[18px] px-4 py-2 text-xs font-black text-[#9b2c2c]/80 underline"
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
    <main className="mt-4 space-y-3 xl:space-y-4">
      <SectionTitle title={t("myProjectsTitle")} subtitle={t("myProjectsSubtitle")} />
      {mine.length ? (
        <div className="space-y-3">{mine.map(renderCard)}</div>
      ) : (
        <p className="rounded-[20px] bg-[#F5E6C8] px-4 py-5 text-center text-sm font-bold text-[#3D2B1F]/70">{t("myProjectsEmpty")}</p>
      )}
      <div className="pt-4">
        <SectionTitle title={t("templatesTitle")} subtitle={t("projectsSubtitle")} />
      </div>
      <div className="space-y-3">{templates.map(renderCard)}</div>
    </main>
  );
}

function PublishControls({
  project,
  t,
  onPublish,
  onUnpublish
}: {
  project: ReadyProject;
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
      <div className="flex items-center justify-between gap-2 rounded-[18px] bg-[#5F7E4D]/15 px-3 py-2">
        <span className="text-xs font-black text-[#5F7E4D]">✓ {t("publishedBadge")}</span>
        <button onClick={() => run(() => onUnpublish(project))} disabled={busy} className="rounded-full px-3 py-1.5 text-xs font-black text-[#3D2B1F]/60 underline disabled:opacity-50">
          {t("unpublishAction")}
        </button>
      </div>
    );
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="min-h-12 w-full rounded-[20px] border-2 border-[#C1440E]/40 px-4 text-sm font-black text-[#C1440E]">
        {t("publishAction")}
      </button>
    );
  }

  const inputClass = "min-h-12 w-full rounded-[16px] border-2 border-[#3D2B1F]/10 bg-white px-3 text-sm font-bold outline-none focus:border-[#C1440E]/60";
  return (
    <div className="space-y-2 rounded-[20px] bg-[#FFF7E8]/80 p-3">
      <textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder={t("publishDescriptionPlaceholder")} rows={3} className={`${inputClass} resize-none py-2`} />
      <input value={price} onChange={(event) => setPrice(event.target.value.replace(/\D/g, ""))} placeholder={t("publishPricePlaceholder")} inputMode="numeric" className={inputClass} />
      <input value={region} onChange={(event) => setRegion(event.target.value)} placeholder={t("publishRegionPlaceholder")} className={inputClass} />
      <div className="flex gap-2">
        <button
          onClick={() => run(() => onPublish(project, { description: description.trim(), price: price ? Number(price) : null, region: region.trim() }))}
          disabled={busy}
          className="min-h-12 flex-1 rounded-[18px] bg-[#C1440E] px-4 text-sm font-black text-[#F5E6C8] disabled:opacity-60"
        >
          {t("publishSubmit")}
        </button>
        <button onClick={() => setOpen(false)} disabled={busy} className="min-h-12 rounded-[18px] bg-[#3D2B1F]/10 px-4 text-sm font-black disabled:opacity-50">
          {t("cancel")}
        </button>
      </div>
    </div>
  );
}

export function ProjectOrderPreview({ grid, rows, rowCount, t }: { grid: GridSpec; rows: Record<number, PlacedBrick[]>; rowCount: number; t: Translate }) {
  return (
    <div className="border-y border-[#3D2B1F]/10 bg-[#FFF7E8] px-3 py-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="text-xs font-black uppercase tracking-wide text-[#3D2B1F]/55">{t("rowsRail")}</div>
        <div className="text-[11px] font-black text-[#5F7E4D]">{t("currentRow")} 1 → {rowCount}</div>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none]">
        {Array.from({ length: rowCount }).map((_, index) => {
          const row = index + 1;
          return (
            <div key={row} className="w-[150px] shrink-0 rounded-[18px] border-2 border-[#3D2B1F]/10 bg-[#F5E6C8] p-2">
              <div className="mb-1 flex items-center justify-between text-[11px] font-black">
                <span>{t("currentRow")} {row}</span>
                <span className="text-[#5F7E4D]">{rows[row]?.length ?? 0}</span>
              </div>
              <ProjectRowMap grid={grid} bricks={rows[row] ?? []} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ProjectRowMap({ grid, bricks }: { grid: GridSpec; bricks: PlacedBrick[] }) {
  const cell = Math.min(10, 112 / Math.max(grid.cols, grid.rows));
  const pad = 9;
  const width = grid.cols * cell + pad * 2;
  const height = grid.rows * cell + pad * 2;
  return (
    <svg className="mx-auto block" width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <rect x="1" y="1" width={width - 2} height={height - 2} rx="12" fill={COLORS.cream} stroke={COLORS.charcoal} strokeWidth="1.5" opacity="0.26" />
      {Array.from({ length: grid.cols + 1 }).map((_, x) => <line key={`prx-${x}`} x1={pad + x * cell} y1={pad} x2={pad + x * cell} y2={pad + grid.rows * cell} stroke={COLORS.gridLine} strokeWidth="0.8" />)}
      {Array.from({ length: grid.rows + 1 }).map((_, y) => <line key={`pry-${y}`} x1={pad} y1={pad + y * cell} x2={pad + grid.cols * cell} y2={pad + y * cell} stroke={COLORS.gridLine} strokeWidth="0.8" />)}
      {bricks.flatMap((brick) =>
        brickBoxes(brick).map((box, index) => (
          <rect key={`${brick.id}-${index}`} x={pad + box.x1 * cell + 1} y={pad + box.y1 * cell + 1} width={(box.x2 - box.x1) * cell - 2} height={(box.y2 - box.y1) * cell - 2} rx="3" fill={getToolColor(brick.kind)} stroke={COLORS.charcoal} strokeWidth="0.8" />
        ))
      )}
    </svg>
  );
}
