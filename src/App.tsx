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
      className={
        screen === "builder"
          ? "studio-shell"
          : "min-h-[100dvh] w-full bg-[#FFF7E8] px-3 pb-12 pt-3 text-[#3D2B1F] sm:px-4"
      }
      style={{
        fontFamily: screen === "builder" ? "system-ui, sans-serif" : "Nunito, ui-rounded, system-ui, sans-serif",
        // Статус-бар/вырез телефона (viewport-fit=cover): шапка не заезжает под него.
        paddingTop:
          screen === "builder" ? "env(safe-area-inset-top, 0px)" : "calc(env(safe-area-inset-top, 0px) + 0.75rem)"
      }}
    >
      <div className={screen === "builder" ? "studio-frame" : "mx-auto w-full max-w-[1520px]"}>
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
          <ShowcaseScreen locale={locale} t={t} onLoad={studio.loadProject} />
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
          <>
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
          </>
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
