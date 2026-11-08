import { LocalProjectsPanel } from "./components/LocalProjectsPanel";
import { RussianStoveGuide } from "./components/RussianStoveGuide";
import { useStudioState } from "./hooks/useStudioState";
import { Header } from "./components/Header";
import { MobileTabs } from "./components/MobileTabs";
import { AuthScreen } from "./components/AuthScreen";
import { ParametersScreen } from "./components/ParametersScreen";
import { ProjectsScreen } from "./components/ProjectsScreen";
import { ShowcaseScreen } from "./components/ShowcaseScreen";
import { BuilderScreen } from "./components/BuilderScreen";

export default function App() {
  const studio = useStudioState();
  const { t, locale, screen, userLogin } = studio;

  return (
    <div
      lang={locale}
      className={`studio-shell ${screen === "builder" ? "" : "site-shell"}`}
      style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
    >
      <div className={screen === "builder" ? "studio-frame" : "site-frame"}>
        <Header
          compact={screen === "builder"}
          locale={locale}
          setLocale={studio.setLocale}
          t={t}
          reset={studio.reset}
          placedCount={studio.materials.total}
          lockedCount={studio.lockedRows.length}
          userLogin={userLogin}
          onSwitchAccount={studio.switchAccount}
          onSignIn={() => studio.setScreen("auth")}
          autosaveState={studio.autosaveState}
          pendingCount={studio.pendingCount}
          syncIssue={studio.syncIssue}
          syncFailureStatus={studio.syncFailureStatus}
          sessionNotice={screen !== "auth" ? studio.authError : undefined}
        />
        {screen === "builder" && studio.showTeplushkaGuide ? (
          <details className="studio-top-guide">
            <summary>Режимы и описание «Теплушки»</summary>
            <RussianStoveGuide locale={locale} controls={studio.teplushkaControls} />
          </details>
        ) : null}
        <MobileTabs screen={screen} setScreen={studio.setScreen} t={t} />
        {!studio.localWorkspace.ready ? (
          <main className="studio-fallback">Восстанавливаю рабочую библиотеку…</main>
        ) : screen === "showcase" ? (
          // Витрина публичная: заказчики смотрят печи без регистрации.
          <ShowcaseScreen
            locale={locale}
            t={t}
            onLoad={studio.loadProject}
            onContinue={() => studio.setScreen("builder")}
          />
        ) : screen === "auth" ? (
          // Редактор гостевой (печь строится и без сети, и без аккаунта);
          // вход нужен только для синка между устройствами и витрины.
          <AuthScreen
            mode={studio.authMode}
            setMode={studio.setAuthMode}
            login={studio.authLogin}
            setLogin={studio.setAuthLogin}
            password={studio.authPassword}
            setPassword={studio.setAuthPassword}
            onSubmit={studio.submitAuth}
            busy={studio.authBusy}
            error={studio.authError || studio.localWorkspace.error || ""}
            remember={studio.rememberSession}
            setRemember={studio.setRememberSession}
            onContinue={() => studio.setScreen("builder")}
            t={t}
          />
        ) : screen === "parameters" ? (
          <ParametersScreen
            locale={locale}
            calculatorInput={studio.calculatorInput}
            onCalculatorChange={studio.setCalculatorInput}
            onOpenReference={studio.openCalculatorReference}
            parameters={studio.parameters}
            updateParameter={studio.updateParameter}
            t={t}
            onContinue={() => studio.setScreen("builder")}
            lockedRows={studio.lockedRows}
          />
        ) : screen === "projects" ? (
          <main className="site-page">
            <div className="page-heading">
              <p className="eyebrow">{t("workspaceLabel")}</p>
              <h1>{t("libraryTitle")}</h1>
              <p>{t("libraryIntro")}</p>
            </div>
            {!userLogin && (
              <div className="account-callout">
                <div>
                  <strong>{t("accountBenefit")}</strong>
                  <p>{t("accountStorageHint")}</p>
                </div>
                <button type="button" onClick={() => studio.setScreen("auth")}>
                  {t("authLogin")}
                </button>
              </div>
            )}
            <LocalProjectsPanel workspace={studio.localWorkspace} onContinue={() => studio.setScreen("builder")} />
            <ProjectsScreen
              locale={locale}
              t={t}
              projects={studio.allProjects}
              onLoad={studio.loadProject}
              userLogin={userLogin}
              onPublish={studio.publishSavedProject}
              onUnpublish={studio.unpublishSavedProject}
              onDelete={studio.deleteProject}
            />
          </main>
        ) : (
          <BuilderScreen
            key={studio.sceneRevision}
            workspace={studio.localWorkspace}
            onServerSave={studio.saveCurrentToServer}
            sceneRevision={studio.sceneRevision}
            inspection={studio.showTeplushkaGuide ? studio.teplushkaInspection : undefined}
            onExitSection={studio.exitTeplushkaSection}
            t={t}
            grid={studio.grid}
            rows={studio.rows}
            rowCount={studio.rowCount}
            currentRow={studio.currentRow}
            setCurrentRow={studio.setCurrentRow}
            lockedRows={studio.lockedRows}
            activeTool={studio.activeTool}
            setActiveTool={studio.setActiveTool}
            orientation={studio.orientation}
            setOrientation={studio.setOrientation}
            notchCorner={studio.notchCorner}
            setNotchCorner={studio.setNotchCorner}
            rebateDepthMm={studio.rebateDepthMm}
            setRebateDepth={studio.setRebateDepth}
            snapStep={studio.snapStep}
            setSnapStep={studio.setSnapStep}
            customBrick={studio.customBrick}
            pickCustomBrick={studio.pickCustomBrick}
            plateSpec={studio.plateSpec}
            setPlateSize={studio.setPlateSize}
            doorSpec={studio.doorSpec}
            setDoorSize={studio.setDoorSize}
            damperSpec={studio.damperSpec}
            setDamperSize={studio.setDamperSize}
            setDamperOpenings={studio.setDamperOpenings}
            grateSpec={studio.grateSpec}
            setGrateSize={studio.setGrateSize}
            userLogin={userLogin}
            editPart={studio.editPart}
            removePart={studio.removePart}
            placeAt={studio.placeAt}
            previewAt={studio.previewAt}
            addRow={studio.addRow}
            deleteCurrentRow={studio.deleteCurrentRow}
            copyPreviousRow={studio.copyPreviousRow}
            fillCurrentRow={studio.fillCurrentRow}
            clearCurrentRow={studio.clearCurrentRow}
            lockRow={studio.lockRow}
            unlockRow={studio.unlockRow}
            canUndo={studio.canUndo}
            canRedo={studio.canRedo}
            undo={studio.undo}
            redo={studio.redo}
            parameters={studio.parameters}
            materials={studio.materials}
            saveCurrentProject={studio.saveCurrentProject}
          />
        )}
      </div>
    </div>
  );
}
