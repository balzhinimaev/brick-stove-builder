import { useEffect, useMemo, useRef, useState } from "react";
import { COLORS } from "../theme/colors";
import { cloneRows } from "../domain/geometry";
import { READY_PROJECTS } from "../domain/projects";
import { uniqueId } from "../lib/id";
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
  const [screen, setScreen] = useState<Screen>(() =>
    new URLSearchParams(window.location.search).get("screen") === "showcase" ? "showcase" : "builder"
  );
  const t = useI18n(locale);

  const editor = useEditor();
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
    { parameters: editor.parameters, rowCount: editor.rowCount, currentRow: editor.currentRow, lockedRows: editor.lockedRows, rows: editor.rows },
    // Черновик молча заменяет только нетронутый редактор: если пользователь
    // уже что-то строил (например, час работал анонимно и вошёл, чтобы
    // сохранить), — спрашиваем. Отказ безопасен: текущая работа получит
    // свежую метку автосейва и станет черновиком сама.
    (draft) => {
      if (editor.canUndo && !window.confirm(t("draftReplaceConfirm"))) return false;
      editor.loadDraft(draft);
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
    setCurrentProjectId(null);
    setScreen("builder");
  };

  const loadProject = (project: ReadyProject) => {
    editor.loadProject(project);
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
      subtitle: editingOwn?.subtitle ?? { ru: t("savedProjectSubtitle"), en: t("savedProjectSubtitle"), lt: t("savedProjectSubtitle") },
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
    // navigation + i18n
    locale, setLocale,
    screen, setScreen,
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
    toggleDamper: editor.toggleDamper,
    viewMode: editor.viewMode,
    setViewMode: editor.setViewMode,
    camera: editor.camera,
    materials: editor.materials,
    updateParameter: editor.updateParameter,
    placeAt: editor.placeAt,
    canPlaceAt: editor.canPlaceAt,
    rejectedIds: editor.rejectedIds,
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
    cameraZoom: editor.cameraZoom,
    cameraRotate: editor.cameraRotate,
    cameraPan: editor.cameraPan,
    cameraReset: editor.cameraReset,
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
