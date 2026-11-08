import { useEffect, useState } from "react";
import { fetchShowcaseProjects, submitLead } from "../api/client";
import { CLASSIC_RUSSIAN_STOVE } from "../domain/classicRussianStove";
import { gridFromParameters } from "../domain/geometry";
import { estimateMaterials } from "../domain/materials";
import { RUSSIAN_STOVE } from "../domain/russianStove";
import { BUILTIN_SHOWCASE_PROJECTS } from "../domain/showcaseProjects";
import type { ReadyProject } from "../domain/types";
import type { Locale, Translate } from "../i18n";
import { ClassicRussianStoveGuide } from "./ClassicRussianStoveGuide";
import { HouseRussianGuide } from "./HouseRussianGuide";
import { ProjectOrderPreview } from "./ProjectsScreen";
import { RussianStoveGuide } from "./RussianStoveGuide";
import { Pill, SectionTitle } from "./ui";

export function ShowcaseScreen({
  locale,
  t,
  onLoad,
  onContinue
}: {
  locale: Locale;
  t: Translate;
  onLoad: (project: ReadyProject) => void;
  onContinue?: () => void;
}) {
  const [unavailable, setUnavailable] = useState(false);
  const [projects, setProjects] = useState<ReadyProject[] | null>(null);

  useEffect(() => {
    let active = true;
    fetchShowcaseProjects()
      .then((items) => {
        if (active) setProjects(items);
      })
      .catch(() => {
        if (active) {
          setProjects([]);
          setUnavailable(true);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <main className="site-page showcase-page">
      <section className="showcase-hero">
        <div>
          <p className="eyebrow">{t("workspaceLabel")}</p>
          <h1>{t("showcaseHeroTitle")}</h1>
          <p>{t("showcaseHeroText")}</p>
          {onContinue && (
            <button type="button" className="studio-primary" onClick={onContinue}>
              {t("continueEditing")} <span aria-hidden="true">↗</span>
            </button>
          )}
          <small>{t("showcaseHeroNote")}</small>
        </div>
        <img
          src={`${import.meta.env.BASE_URL}russian-stove-demo.webp`}
          alt={t("showcaseTitle")}
          width="640"
          height="480"
        />
      </section>
      <SectionTitle title={t("showcaseTitle")} subtitle={t("showcaseSubtitle")} />
      <div className="project-grid">
        {BUILTIN_SHOWCASE_PROJECTS.map((project) => (
          <ShowcaseCard key={project.id} project={project} locale={locale} t={t} onLoad={onLoad} />
        ))}
      </div>
      {projects === null ? (
        <p className="rounded-lg bg-[#ffffff] px-4 py-6 text-center text-sm font-bold text-[#283732]/70">
          {t("showcaseLoading")}
        </p>
      ) : projects.length === 0 ? (
        <p className="rounded-lg bg-[#ffffff] px-4 py-6 text-center text-sm font-bold text-[#283732]/70">
          {unavailable
            ? locale === "ru"
              ? "Работы пользователей временно недоступны. Встроенные проекты выше доступны без входа."
              : locale === "en"
                ? "Community projects are temporarily unavailable. The built-in projects above need no account."
                : "Naudotojų projektai laikinai nepasiekiami. Demo veikia be paskyros."
            : t("showcaseEmpty")}
        </p>
      ) : (
        <div className="space-y-3 md:grid md:grid-cols-2 md:gap-4 md:space-y-0 xl:grid-cols-3">
          {projects.map((project) => (
            <ShowcaseCard key={project.id} project={project} locale={locale} t={t} />
          ))}
        </div>
      )}
    </main>
  );
}

function ShowcaseCard({
  project,
  locale,
  t,
  onLoad
}: {
  project: ReadyProject;
  locale: Locale;
  t: Translate;
  onLoad?: (project: ReadyProject) => void;
}) {
  const grid = gridFromParameters(project.parameters);
  const materials = estimateMaterials(Object.values(project.rows).flat(), project.parameters);
  const showcase = project.showcase;

  return (
    <article id={project.id} className="project-card">
      <div className="p-3">
        <div className="mb-2 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-xl font-semibold leading-6">{project.title[locale]}</h3>
            {onLoad ? <p className="mt-2 text-sm">{project.subtitle[locale]}</p> : null}
            {showcase?.description ? (
              <p className="mt-1 text-sm font-bold leading-5 text-[#283732]/70">{showcase.description}</p>
            ) : null}
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
          {project.ownerLogin ? (
            <Pill>
              {t("showcaseBy")}: {project.ownerLogin}
            </Pill>
          ) : null}
          {showcase?.region ? (
            <Pill>
              {t("showcaseRegion")}: {showcase.region}
            </Pill>
          ) : null}
          <Pill>
            {t("projectFootprint")}: {project.parameters.foundationWidth}×{project.parameters.foundationLength}{" "}
            {t("unitCm")}
          </Pill>
          <Pill>
            {project.rowCount} {t("projectRows")}
          </Pill>
          <Pill>
            {t("totalPlaced")}: {materials.total}
          </Pill>
        </div>
      </div>

      <ProjectOrderPreview grid={grid} rows={project.rows} rowCount={project.rowCount} t={t} />
      <div className="mt-auto space-y-2 p-3">
        {typeof showcase?.price === "number" ? (
          <p className="text-lg font-semibold text-[#326856]">
            {t("showcasePrice")}: {showcase.price.toLocaleString("ru-RU")} ₽
          </p>
        ) : null}
        {onLoad ? (
          <>
            <details className="project-details">
              <summary>{t("projectDetails")}</summary>
              {project.id.startsWith("russian-house-6x9") && <HouseRussianGuide project={project} />}
              {project.id === RUSSIAN_STOVE.id ? (
                <RussianStoveGuide locale={locale} />
              ) : project.id === CLASSIC_RUSSIAN_STOVE.id ? (
                <ClassicRussianStoveGuide locale={locale} />
              ) : null}
            </details>
            <button
              type="button"
              aria-label={`${t("loadProject")}: ${project.title[locale]}`}
              onClick={() => onLoad?.(project)}
              className="studio-primary w-full"
            >
              {t("loadProject")}
            </button>
          </>
        ) : (
          <LeadForm project={project} locale={locale} t={t} />
        )}
      </div>
    </article>
  );
}

export function LeadForm({ project, locale, t }: { project: ReadyProject; locale: Locale; t: Translate }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">("idle");

  if (status === "done") {
    return (
      <p className="rounded-lg bg-[#326856]/15 px-4 py-3 text-center text-sm font-semibold text-[#326856]">
        {t("leadDone")}
      </p>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="min-h-13 w-full rounded-lg bg-[#326856] px-4 text-sm font-semibold text-[#ffffff] "
      >
        {t("showcaseWant")}
      </button>
    );
  }

  const send = async () => {
    if (status === "sending") return;
    if (phone.replace(/\D/g, "").length < 10) {
      setStatus("error");
      return;
    }
    setStatus("sending");
    const details = [project.ownerLogin && `${t("showcaseBy")}: ${project.ownerLogin}`, project.showcase?.region]
      .filter(Boolean)
      .join(", ");
    const ok = await submitLead({
      name,
      phone,
      comment: `${t("showcaseWant")}: «${project.title[locale]}»${details ? ` (${details})` : ""}`,
      source: `showcase:${project.id}`
    }).catch(() => false);
    setStatus(ok ? "done" : "error");
  };

  return (
    <form
      className="space-y-2 rounded-lg bg-[#f4f5f1]/80 p-3"
      onSubmit={(event) => {
        event.preventDefault();
        void send();
      }}
    >
      <p className="text-xs font-bold leading-4 text-[#283732]/65">{t("showcaseLeadHint")}</p>
      <input
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder={t("leadName")}
        autoComplete="name"
        className="min-h-12 w-full rounded-[16px] border border-[#283732]/10 bg-white px-3 text-sm font-bold outline-none focus:border-[#326856]/60"
      />
      <input
        value={phone}
        onChange={(event) => setPhone(event.target.value)}
        placeholder={t("leadPhone")}
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        className="min-h-12 w-full rounded-[16px] border border-[#283732]/10 bg-white px-3 text-sm font-bold outline-none focus:border-[#326856]/60"
      />
      {status === "error" ? <p className="text-xs font-semibold text-[#326856]">{t("leadError")}</p> : null}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={status === "sending"}
          className="min-h-12 flex-1 rounded-lg bg-[#326856] px-4 text-sm font-semibold text-[#ffffff] disabled:opacity-60"
        >
          {status === "sending" ? t("leadSending") : t("leadSend")}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="min-h-12 rounded-lg bg-[#283732]/10 px-4 text-sm font-semibold"
        >
          {t("cancel")}
        </button>
      </div>
    </form>
  );
}
