import { COLORS } from "../theme/colors";
import type { Locale, Translate } from "../i18n";
import type { GridSpec, PlacedBrick, ReadyProject } from "../domain/types";
import { brickSizeFor, gridFromParameters } from "../domain/geometry";
import { estimateMaterials } from "../domain/materials";
import { getToolColor } from "../domain/tools";
import { Pill, SectionTitle } from "./ui";

export function ProjectsScreen({
  locale,
  t,
  projects,
  onLoad
}: {
  locale: Locale;
  t: Translate;
  projects: ReadyProject[];
  onLoad: (project: ReadyProject) => void;
}) {
  const unit = t("unitCm");
  return (
    <main className="mt-4 space-y-3 xl:space-y-4">
      <SectionTitle title={t("projectsTitle")} subtitle={t("projectsSubtitle")} />
      <div className="space-y-3">
        {projects.map((project) => {
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
                <p className="rounded-[18px] bg-[#FFF7E8]/80 px-3 py-2 text-xs font-bold leading-4 text-[#3D2B1F]/65">{t("projectDemoNotice")}</p>
                <button onClick={() => onLoad(project)} className="min-h-13 w-full rounded-[20px] bg-[#C1440E] px-4 text-sm font-black text-[#F5E6C8] shadow-lg shadow-[#C1440E]/20">{t("loadProject")}</button>
              </div>
            </article>
          );
        })}
      </div>
    </main>
  );
}

function ProjectOrderPreview({ grid, rows, rowCount, t }: { grid: GridSpec; rows: Record<number, PlacedBrick[]>; rowCount: number; t: Translate }) {
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
      {bricks.map((brick) => {
        const size = brickSizeFor(brick.kind, brick.orientation);
        return <rect key={brick.id} x={pad + brick.x * cell + 1} y={pad + brick.y * cell + 1} width={size.w * cell - 2} height={size.h * cell - 2} rx="3" fill={getToolColor(brick.kind)} stroke={COLORS.charcoal} strokeWidth="0.8" />;
      })}
    </svg>
  );
}
