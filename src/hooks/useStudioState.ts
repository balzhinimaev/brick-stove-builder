import { useEffect, useMemo, useRef, useState } from "react";
import {
  type PublishFields,
  publishProject as publishProjectApi,
  unpublishProject as unpublishProjectApi
} from "../api/client";
import {
  inspectTeplushkaMode,
  type TeplushkaInspection,
  type TeplushkaMode,
  teplushkaModeOpenings
} from "../components/builder/teplushkaInspection";
import { calculatorText } from "../components/stoveCalculatorText";
import { cloneRows } from "../domain/geometry";
import { READY_PROJECTS } from "../domain/projects";
import { CALCULATOR_EXAMPLE } from "../domain/stoveCalculator";
import { TEPLUSHKA_DAMPERS } from "../domain/teplushkaControls";
import type { ReadyProject, Screen } from "../domain/types";
import { type Locale, useI18n } from "../i18n";
import { uniqueId } from "../lib/id";
import { isNativeApp } from "../lib/platform";
import { COLORS } from "../theme/colors";
import { useLocalWorkspace } from "./useLocalWorkspace";
import { projectSnapshot } from "../storage/projectFile";
import { initialEditorState } from "../domain/editor/state";
import { useEditor } from "./useEditor";
import { useSavedProjects } from "./useSavedProjects";
import { useSession } from "./useSession";

/**
 * Composition root for editor UI state. Each concern lives in its own hook —
 * this layer wires them together and owns only locale/screen navigation plus
 * the cross-cutting "save current project" flow.
 */
export function useStudioState() {
  const [locale, setLocale] = useState<Locale>("ru");
  // Deep link: /?screen=showcase opens the public showcase (used by the promo landing).
  const [screen, setScreen] = useState<Screen>(() => {
    const requested = new URLSearchParams(window.location.search).get("screen");
    if (requested === "showcase") return "showcase";
    if (requested === "parameters" || requested === "calculator") return "parameters";
    return "builder";
  });
  const [calculatorInput, setCalculatorInput] = useState({ ...CALCULATOR_EXAMPLE });
  const t = useI18n(locale);

  const editor = useEditor();
  // View-only identity: replacing even an identical document resets scene inspectors and gestures.
  const [sceneRevision, setSceneRevision] = useState(0);
  const [demoProjectId, setDemoProjectId] = useState<string | null>(null);
  const [teplushkaInspection, setTeplushkaInspection] = useState<TeplushkaInspection>({
    section: "whole",
    fraction: 0.4
  });
  const teplushkaState = useMemo(() => inspectTeplushkaMode(editor.rows, TEPLUSHKA_DAMPERS), [editor.rows]);
  // Recognise restored editable copies by their hardware IDs, not by a claim that their geometry is unchanged.
  const showTeplushkaGuide = demoProjectId === "russian-stove-hob" || Object.values(teplushkaState.gates).some(Boolean);
  const session = useSession(t);
  /**
   * Какой СВОЙ сохранённый проект сейчас открыт в редакторе. Пока он задан,
   * «Сохранить проект» обновляет документ вместо создания дубля.
   * Живёт в studio-слое, а не в editor-редьюсере: ядро редактора про это не знает.
   */
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const { savedProjects, pendingCount, saveProject, updateProject, replaceProject, removeProject } = useSavedProjects(
    session.session,
    // офлайн-созданный проект после синка получает серверный id
    (idMap) => {
      setCurrentProjectId((current) => (current && idMap[current] ? idMap[current] : current));
      for (const item of localWorkspace.projects ?? [])
        if (item.remoteId && idMap[item.remoteId])
          void localWorkspace.linkRemote(item.id, idMap[item.remoteId]).catch(() => {});
    },
    session.invalidateSession
  );
  const localWorkspace = useLocalWorkspace(
    session.userLogin,
    {
      parameters: editor.parameters,
      rowCount: editor.rowCount,
      currentRow: editor.currentRow,
      lockedRows: editor.lockedRows,
      rows: editor.rows
    },
    (draft, navigate) => {
      editor.loadDraft(draft);
      setSceneRevision((revision) => revision + 1);
      setDemoProjectId(null);
      setCurrentProjectId(null);
      setTeplushkaInspection({ section: "whole", fraction: 0.4 });
      if (navigate) setScreen("builder");
    }
  );
  const autosaveState: "idle" | "saving" | "saved" | "error" =
    localWorkspace.state === "loading" ? "idle" : localWorkspace.state;

  const allProjects = useMemo(() => [...READY_PROJECTS, ...savedProjects], [savedProjects]);

  // Экран входа нужен только гостю: после успешного логина возвращаемся к кладке.
  const userLogin = session.userLogin;
  useEffect(() => {
    if (userLogin) setScreen((current) => (current === "auth" ? "builder" : current));
  }, [userLogin]);

  // Android: системная кнопка «назад» возвращает к кладке, а с кладки сворачивает
  // приложение (иначе Capacitor закрывает activity и теряется несохранённое).
  const screenRef = useRef(screen);
  screenRef.current = screen;
  useEffect(() => {
    if (!isNativeApp()) return;
    let removed = false;
    let remove: (() => void) | undefined;
    void import("@capacitor/app")
      .then(({ App: CapApp }) => {
        const handle = CapApp.addListener("backButton", () => {
          if (screenRef.current !== "builder") setScreen("builder");
          else void CapApp.minimizeApp();
        });
        void handle
          .then((subscription) => {
            if (removed) void subscription.remove();
            else remove = () => void subscription.remove();
          })
          .catch(() => {});
      })
      // плагин недоступен (нестандартная оболочка) — редактор важнее кнопки «назад»
      .catch(() => {});
    return () => {
      removed = true;
      remove?.();
    };
  }, []);

  const reset = async () => {
    await localWorkspace.create("Новая печь", initialEditorState());
  };

  const loadProject = async (project: ReadyProject) => {
    const row = project.id.startsWith("russian-house-6x9")
      ? Math.min(29, project.rowCount)
      : ["russian-stove-hob", "classic-russian-stove-hob", "shkolnik-pov-3500"].includes(project.id)
        ? project.rowCount
        : 1;
    if (
      await localWorkspace.create(
        project.title[locale],
        projectSnapshot(project, row),
        project.id,
        project.ownerLogin === session.userLogin ? project.id : undefined
      )
    ) {
      setDemoProjectId(project.ownerLogin ? null : project.id);
      setScreen("builder");
    }
  };

  const saveCurrentProject = localWorkspace.save;
  const saveCurrentToServer = async () => {
    // Гостю сохранять некуда (проекты живут на аккаунте) — ведём на вход;
    // его кладка при этом не теряется: анонимный черновик автосейвится.
    if (!session.session) {
      window.alert(t("authLoginFirst"));
      setScreen("auth");
      return;
    }
    let local: Awaited<ReturnType<typeof localWorkspace.flush>>;
    try {
      local = await localWorkspace.flush();
    } catch {
      return;
    }
    const localId = local.id,
      remoteId = local.remoteId;
    const editingOwn = savedProjects.find((item) => item.id === remoteId);
    const title = local.title;
    if (!title?.trim()) return;

    const project: ReadyProject = {
      id: remoteId ?? uniqueId("custom"),
      title: { ru: title.trim(), en: title.trim(), lt: title.trim() },
      subtitle: editingOwn?.subtitle ?? {
        ru: t("savedProjectSubtitle"),
        en: t("savedProjectSubtitle"),
        lt: t("savedProjectSubtitle")
      },
      parameters: editor.parameters,
      rowCount: editor.rowCount,
      lockedRows: editor.lockedRows,
      rows: cloneRows(editor.rows),
      accent: editingOwn?.accent ?? COLORS.brickOrange,
      // локальная копия сразу «своя» — офлайн-сохранение попадает в «Мои проекты»
      ownerLogin: session.session.login
    };

    // офлайн не мешает: без сети операция встаёт в очередь и синкнется сама;
    // null — постоянный отказ сервера (или разлогин), сохранение не удалось
    if (remoteId) {
      const saved = await updateProject(remoteId, project, session.session.token);
      if (!saved) {
        window.alert(t("apiUnavailable"));
        return;
      }
    } else {
      const saved = await saveProject(project, session.session.token);
      if (!saved) {
        window.alert(t("apiUnavailable"));
        return;
      }
      setCurrentProjectId(saved.id);
      await localWorkspace.linkRemote(localId, saved.id);
    }
  };

  const deleteProject = async (project: ReadyProject) => {
    if (!session.session) return;
    await removeProject(project.id, session.session.token);
    if (currentProjectId === project.id) setCurrentProjectId(null);
  };

  const publishSavedProject = async (project: ReadyProject, fields: PublishFields) => {
    if (!session.session) {
      window.alert(t("authLoginFirst"));
      return;
    }
    try {
      replaceProject(await publishProjectApi(project.id, fields, session.session.token));
    } catch {
      window.alert(t("apiUnavailable"));
    }
  };

  const unpublishSavedProject = async (project: ReadyProject) => {
    if (!session.session) return;
    try {
      replaceProject(await unpublishProjectApi(project.id, session.session.token));
    } catch {
      window.alert(t("apiUnavailable"));
    }
  };

  return {
    calculatorInput,
    setCalculatorInput,
    openCalculatorReference: async (project: ReadyProject) => {
      if (Object.values(editor.rows).some((row) => row.length) && !window.confirm(calculatorText(locale)("replace")))
        return;
      await loadProject(project);
    },
    sceneRevision,
    demoProjectId,
    showTeplushkaGuide,
    teplushkaInspection,
    teplushkaControls: {
      ...teplushkaState,
      onMode: (mode: TeplushkaMode) => {
        if (teplushkaState.complete) editor.setDamperOpenings(teplushkaModeOpenings(mode, TEPLUSHKA_DAMPERS));
      },
      inspection: teplushkaInspection,
      onInspection: (value: TeplushkaInspection) => setTeplushkaInspection({ ...value, courseOnly: false }),
      currentRow: editor.currentRow,
      onCourse: (row: number) => {
        editor.setCurrentRow(Math.min(row, editor.rowCount));
        setTeplushkaInspection({ section: "whole", fraction: 0.4, courseOnly: true });
      }
    },
    exitTeplushkaSection: () => setTeplushkaInspection({ section: "whole", fraction: 0.4, courseOnly: true }),
    // navigation + i18n
    locale,
    setLocale,
    screen,
    setScreen,
    t,
    // editor document + selections
    parameters: editor.parameters,
    grid: editor.grid,
    rowCount: editor.rowCount,
    currentRow: editor.currentRow,
    setCurrentRow: editor.setCurrentRow,
    lockedRows: editor.lockedRows,
    rows: editor.rows,
    activeTool: editor.activeTool,
    setActiveTool: editor.setActiveTool,
    orientation: editor.orientation,
    setOrientation: editor.setOrientation,
    notchCorner: editor.notchCorner,
    setNotchCorner: editor.setNotchCorner,
    rebateDepthMm: editor.rebateDepthMm,
    setRebateDepth: editor.setRebateDepth,
    snapStep: editor.snapStep,
    setSnapStep: editor.setSnapStep,
    customBrick: editor.customBrick,
    pickCustomBrick: editor.pickCustomBrick,
    plateSpec: editor.plateSpec,
    setPlateSize: editor.setPlateSize,
    doorSpec: editor.doorSpec,
    setDoorSize: editor.setDoorSize,
    damperSpec: editor.damperSpec,
    setDamperSize: editor.setDamperSize,
    setDamperOpenings: editor.setDamperOpenings,
    toggleDamper: editor.toggleDamper,
    grateSpec: editor.grateSpec,
    setGrateSize: editor.setGrateSize,
    materials: editor.materials,
    updateParameter: editor.updateParameter,
    placeAt: editor.placeAt,
    editPart: editor.editPart,
    removePart: editor.removePart,
    previewAt: editor.previewAt,
    addRow: editor.addRow,
    deleteCurrentRow: editor.deleteCurrentRow,
    copyPreviousRow: editor.copyPreviousRow,
    fillCurrentRow: editor.fillCurrentRow,
    clearCurrentRow: editor.clearCurrentRow,
    lockRow: editor.lockRow,
    unlockRow: editor.unlockRow,
    canUndo: editor.canUndo,
    canRedo: editor.canRedo,
    undo: editor.undo,
    redo: editor.redo,
    reset,
    loadProject,
    // session
    userLogin: session.userLogin,
    authMode: session.authMode,
    setAuthMode: session.setAuthMode,
    authLogin: session.authLogin,
    setAuthLogin: session.setAuthLogin,
    authPassword: session.authPassword,
    setAuthPassword: session.setAuthPassword,
    submitAuth: session.submitAuth,
    switchAccount: async () => {
      try {
        await localWorkspace.flush();
      } catch {
        return;
      }
      session.switchAccount();
      setCurrentProjectId(null);
    },
    // projects
    savedProjects,
    pendingCount,
    allProjects,
    currentProjectId,
    saveCurrentProject,
    saveCurrentToServer,
    localWorkspace,
    deleteProject,
    publishSavedProject,
    unpublishSavedProject,
    autosaveState
  };
}

export type StudioState = ReturnType<typeof useStudioState>;
