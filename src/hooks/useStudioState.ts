import { useMemo, useState } from "react";
import { COLORS } from "../theme/colors";
import { cloneRows } from "../domain/geometry";
import { READY_PROJECTS } from "../domain/projects";
import { uniqueId } from "../lib/id";
import { useI18n, type Locale } from "../i18n";
import {
  deleteSavedProject as deleteSavedProjectApi,
  publishProject as publishProjectApi,
  unpublishProject as unpublishProjectApi,
  updateSavedProject as updateSavedProjectApi,
  type PublishFields
} from "../api/client";
import type { ReadyProject, Screen } from "../domain/types";
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
  const { savedProjects, saveProject, replaceProject, removeProject } = useSavedProjects(session.session);
  /**
   * Какой СВОЙ сохранённый проект сейчас открыт в редакторе. Пока он задан,
   * «Сохранить проект» обновляет документ вместо создания дубля.
   * Живёт в studio-слое, а не в editor-редьюсере: ядро редактора про это не знает.
   */
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const autosaveState = useAutosaveDraft(
    session.session,
    { parameters: editor.parameters, rowCount: editor.rowCount, currentRow: editor.currentRow, lockedRows: editor.lockedRows, rows: editor.rows },
    editor.loadDraft
  );

  const allProjects = useMemo(() => [...READY_PROJECTS, ...savedProjects], [savedProjects]);

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
    const editingOwn = currentProjectId ? savedProjects.find((item) => item.id === currentProjectId) : undefined;
    const title = window.prompt(t("saveProjectPrompt"), editingOwn?.title.ru ?? "");
    if (!title?.trim()) return;
    if (!session.session) {
      window.alert(t("authLoginFirst"));
      return;
    }

    const project: ReadyProject = {
      id: editingOwn?.id ?? uniqueId("custom"),
      title: { ru: title.trim(), en: title.trim(), lt: title.trim() },
      subtitle: editingOwn?.subtitle ?? { ru: t("savedProjectSubtitle"), en: t("savedProjectSubtitle"), lt: t("savedProjectSubtitle") },
      parameters: editor.parameters,
      rowCount: editor.rowCount,
      lockedRows: editor.lockedRows,
      rows: cloneRows(editor.rows),
      accent: editingOwn?.accent ?? COLORS.brickOrange
    };

    try {
      if (editingOwn) {
        replaceProject(await updateSavedProjectApi(editingOwn.id, project, session.session.token));
      } else {
        const saved = await saveProject(project, session.session.token);
        setCurrentProjectId(saved.id);
      }
      setScreen("projects");
    } catch {
      window.alert(t("apiUnavailable"));
    }
  };

  const deleteProject = async (project: ReadyProject) => {
    if (!session.session) return;
    try {
      await deleteSavedProjectApi(project.id, session.session.token);
      removeProject(project.id);
      if (currentProjectId === project.id) setCurrentProjectId(null);
    } catch {
      window.alert(t("apiUnavailable"));
    }
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
    snapStep: editor.snapStep,
    setSnapStep: editor.setSnapStep,
    viewMode: editor.viewMode,
    setViewMode: editor.setViewMode,
    camera: editor.camera,
    materials: editor.materials,
    updateParameter: editor.updateParameter,
    placeAt: editor.placeAt,
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
