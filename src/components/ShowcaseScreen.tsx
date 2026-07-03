import { useEffect, useState } from "react";
import type { Locale, Translate } from "../i18n";
import type { ReadyProject } from "../domain/types";
import { fetchShowcaseProjects, submitLead } from "../api/client";
import { gridFromParameters } from "../domain/geometry";
import { estimateMaterials } from "../domain/materials";
import { Pill, SectionTitle } from "./ui";
import { ProjectOrderPreview } from "./ProjectsScreen";

export function ShowcaseScreen({ locale, t }: { locale: Locale; t: Translate }) {
  const [projects, setProjects] = useState<ReadyProject[] | null>(null);

  useEffect(() => {
    let active = true;
    fetchShowcaseProjects()
      .then((items) => { if (active) setProjects(items); })
      .catch(() => { if (active) setProjects([]); });
    return () => { active = false; };
  }, []);

  return (
    <main className="mt-4 space-y-3 xl:space-y-4">
      <SectionTitle title={t("showcaseTitle")} subtitle={t("showcaseSubtitle")} />
      {projects === null ? (
        <p className="rounded-[20px] bg-[#F5E6C8] px-4 py-6 text-center text-sm font-bold text-[#3D2B1F]/70">{t("showcaseLoading")}</p>
      ) : projects.length === 0 ? (
        <p className="rounded-[20px] bg-[#F5E6C8] px-4 py-6 text-center text-sm font-bold text-[#3D2B1F]/70">{t("showcaseEmpty")}</p>
      ) : (
        <div className="space-y-3 md:grid md:grid-cols-2 md:gap-4 md:space-y-0 xl:grid-cols-3">
          {projects.map((project) => <ShowcaseCard key={project.id} project={project} locale={locale} t={t} />)}
        </div>
      )}
    </main>
  );
}

function ShowcaseCard({ project, locale, t }: { project: ReadyProject; locale: Locale; t: Translate }) {
  const grid = gridFromParameters(project.parameters);
  const materials = estimateMaterials(Object.values(project.rows).flat(), project.parameters);
  const showcase = project.showcase;

  return (
    <article className="flex flex-col overflow-hidden rounded-[26px] border-2 border-[#3D2B1F]/10 bg-[#F5E6C8] shadow-md shadow-[#3D2B1F]/10">
      <div className="p-3">
        <div className="mb-2 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-xl font-black leading-6">{project.title[locale]}</h3>
            {showcase?.description ? (
              <p className="mt-1 text-sm font-bold leading-5 text-[#3D2B1F]/70">{showcase.description}</p>
            ) : null}
          </div>
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-[18px] border-2 border-[#3D2B1F]/10 text-xl font-black text-[#F5E6C8]" style={{ backgroundColor: project.accent }} aria-hidden="true">炉</div>
        </div>
        <div className="flex flex-wrap gap-2">
          {project.ownerLogin ? <Pill>{t("showcaseBy")}: {project.ownerLogin}</Pill> : null}
          {showcase?.region ? <Pill>{t("showcaseRegion")}: {showcase.region}</Pill> : null}
          <Pill>{t("projectFootprint")}: {project.parameters.foundationWidth}×{project.parameters.foundationLength} {t("unitCm")}</Pill>
          <Pill>{project.rowCount} {t("projectRows")}</Pill>
          <Pill>{t("totalPlaced")}: {materials.total}</Pill>
        </div>
      </div>
      <ProjectOrderPreview grid={grid} rows={project.rows} rowCount={project.rowCount} t={t} />
      <div className="mt-auto space-y-2 p-3">
        {typeof showcase?.price === "number" ? (
          <p className="text-lg font-black text-[#C1440E]">{t("showcasePrice")}: {showcase.price.toLocaleString("ru-RU")} ₽</p>
        ) : null}
        <LeadForm project={project} locale={locale} t={t} />
      </div>
    </article>
  );
}

function LeadForm({ project, locale, t }: { project: ReadyProject; locale: Locale; t: Translate }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">("idle");

  if (status === "done") {
    return <p className="rounded-[20px] bg-[#5F7E4D]/15 px-4 py-3 text-center text-sm font-black text-[#5F7E4D]">{t("leadDone")}</p>;
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="min-h-13 w-full rounded-[20px] bg-[#C1440E] px-4 text-sm font-black text-[#F5E6C8] shadow-lg shadow-[#C1440E]/20">
        {t("showcaseWant")}
      </button>
    );
  }

  const send = async () => {
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
    <div className="space-y-2 rounded-[20px] bg-[#FFF7E8]/80 p-3">
      <p className="text-xs font-bold leading-4 text-[#3D2B1F]/65">{t("showcaseLeadHint")}</p>
      <input
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder={t("leadName")}
        autoComplete="name"
        className="min-h-12 w-full rounded-[16px] border-2 border-[#3D2B1F]/10 bg-white px-3 text-sm font-bold outline-none focus:border-[#C1440E]/60"
      />
      <input
        value={phone}
        onChange={(event) => setPhone(event.target.value)}
        placeholder={t("leadPhone")}
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        className="min-h-12 w-full rounded-[16px] border-2 border-[#3D2B1F]/10 bg-white px-3 text-sm font-bold outline-none focus:border-[#C1440E]/60"
      />
      {status === "error" ? <p className="text-xs font-black text-[#C1440E]">{t("leadError")}</p> : null}
      <div className="flex gap-2">
        <button
          onClick={send}
          disabled={status === "sending"}
          className="min-h-12 flex-1 rounded-[18px] bg-[#C1440E] px-4 text-sm font-black text-[#F5E6C8] disabled:opacity-60"
        >
          {status === "sending" ? t("leadSending") : t("leadSend")}
        </button>
        <button onClick={() => setOpen(false)} className="min-h-12 rounded-[18px] bg-[#3D2B1F]/10 px-4 text-sm font-black">
          {t("cancel")}
        </button>
      </div>
    </div>
  );
}
