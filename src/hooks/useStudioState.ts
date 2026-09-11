import { useEffect, useMemo, useRef, useState } from "react";
import { COLORS } from "../theme/colors";
import { cloneRows } from "../domain/geometry";
import { READY_PROJECTS } from "../domain/projects";
import { TEPLUSHKA_DAMPERS } from "../domain/teplushkaControls";
import {
  inspectTeplushkaMode,
  teplushkaModeOpenings,
  type TeplushkaInspection,
  type TeplushkaMode
} from "../components/builder/teplushkaInspection";
import { uniqueId } from "../lib/id";
import { CALCULATOR_EXAMPLE } from "../domain/stoveCalculator";
import { calculatorText } from "../components/stoveCalculatorText";
import { useI18n, type Locale } from "../i18n";
import {
  publishProject as publishProjectApi,
  unpublishProject as unpublishProjectApi,
  type PublishFields
} from "../api/client";
import type { ReadyProject, Screen } from "../domain/types";
import { isNativeApp } from "../lib/platform";
import { useEditor } from "./useEditor";
import { useSession } from "./useSession";
import { useSavedProjects } from "./useSavedProjects";
import { useAutosaveDraft } from "./useAutosaveDraft";

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
    (idMap) => setCurrentProjectId((current) => (current && idMap[current] ? idMap[current] : current)),
    session.invalidateSession
  );
  const autosaveState = useAutosaveDraft(
    session.session,
    {
      parameters: editor.parameters,
      rowCount: editor.rowCount,
      currentRow: editor.currentRow,
      lockedRows: editor.lockedRows,
      rows: editor.rows
    },
    // Черновик молча заменяет только нетронутый редактор: если пользователь
    // уже что-то строил (например, час работал анонимно и вошёл, чтобы
    // сохранить), — спрашиваем. Отказ безопасен: текущая работа получит
    // свежую метку автосейва и станет черновиком сама.
    (draft) => {
      if (editor.canUndo && !window.confirm(t("draftReplaceConfirm"))) return false;
      editor.loadDraft(draft);
      setSceneRevision((revision) => revision + 1);
      setDemoProjectId(null);
      setTeplushkaInspection({ section: "whole", fraction: 0.4 });
      return true;
    }
  );

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

  const reset = () => {
    editor.reset();
    setSceneRevision((revision) => revision + 1);
    setDemoProjectId(null);
    setTeplushkaInspection({ section: "whole", fraction: 0.4 });
    setCurrentProjectId(null);
    setScreen("builder");
  };

  const loadProject = (project: ReadyProject) => {
    editor.loadProject(project);
    setSceneRevision((revision) => revision + 1);
    setTeplushkaInspection({ section: "whole", fraction: 0.4 });
    if (
      project.id === "russian-stove-hob" ||
      project.id === "classic-russian-stove-hob" ||
      project.id === "shkolnik-pov-3500"
    )
      editor.setCurrentRow(project.rowCount);
    if (project.id === "russian-house-6x9") editor.setCurrentRow(29);
    setDemoProjectId(project.ownerLogin ? null : project.id);
    // Свой сохранённый проект открываем «на редактирование»; чужой/демо — как шаблон нового.
    setCurrentProjectId(project.ownerLogin && project.ownerLogin === session.userLogin ? project.id : null);
    setScreen("builder");
  };

  const saveCurrentProject = async () => {
    // Гостю сохранять некуда (проекты живут на аккаунте) — ведём на вход;
    // его кладка при этом не теряется: анонимный черновик автосейвится.
    if (!session.session) {
      window.alert(t("authLoginFirst"));
      setScreen("auth");
      return;
    }
    const editingOwn = currentProjectId ? savedProjects.find((item) => item.id === currentProjectId) : undefined;
    const title = window.prompt(t("saveProjectPrompt"), editingOwn?.title.ru ?? "");
    if (!title?.trim()) return;

    const project: ReadyProject = {
      id: editingOwn?.id ?? uniqueId("custom"),
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
    if (editingOwn) {
      const saved = await updateProject(editingOwn.id, project, session.session.token);
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
    }
    setScreen("projects");
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
    openCalculatorReference: (project: ReadyProject) => {
      if (Object.values(editor.rows).some((row) => row.length) && !window.confirm(calculatorText(locale)("replace")))
        return;
      loadProject(project);
      editor.setCurrentRow(project.rowCount);
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
    switchAccount: () => {
      session.switchAccount();
      setCurrentProjectId(null);
    },
    // projects
    savedProjects,
    pendingCount,
    allProjects,
    currentProjectId,
    saveCurrentProject,
    deleteProject,
    publishSavedProject,
    unpublishSavedProject,
    autosaveState
  };
}

export type StudioState = ReturnType<typeof useStudioState>;
