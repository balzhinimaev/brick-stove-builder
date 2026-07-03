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
      className="min-h-[100dvh] w-full bg-[#FFF7E8] px-3 pb-28 pt-3 text-[#3D2B1F] sm:px-4 xl:pb-12"
      style={{
        fontFamily: "Nunito, ui-rounded, system-ui, sans-serif",
        // Статус-бар/вырез телефона (viewport-fit=cover): шапка не заезжает под него.
        paddingTop: "calc(env(safe-area-inset-top, 0px) + 0.75rem)"
      }}
    >
      <div className="mx-auto w-full max-w-[1280px] xl:max-w-[1520px] 2xl:max-w-[min(100%,1800px)]">
        <Header
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
        <MobileTabs screen={screen} setScreen={studio.setScreen} t={t} />
        {screen === "showcase" ? (
          // Витрина публичная: заказчики смотрят печи без регистрации.
          <ShowcaseScreen locale={locale} t={t} />
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
            parameters={studio.parameters}
            updateParameter={studio.updateParameter}
            t={t}
            onContinue={() => studio.setScreen("builder")}
            lockedRows={studio.lockedRows}
          />
        ) : screen === "projects" ? (
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
        ) : (
          <BuilderScreen
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
            snapStep={studio.snapStep}
            setSnapStep={studio.setSnapStep}
            customBrick={studio.customBrick}
            pickCustomBrick={studio.pickCustomBrick}
            plateSpec={studio.plateSpec}
            setPlateSize={studio.setPlateSize}
            doorSpec={studio.doorSpec}
            setDoorSize={studio.setDoorSize}
            userLogin={userLogin}
            viewMode={studio.viewMode}
            setViewMode={studio.setViewMode}
            placeAt={studio.placeAt}
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
            camera={studio.camera}
            cameraZoom={studio.cameraZoom}
            cameraRotate={studio.cameraRotate}
            cameraPan={studio.cameraPan}
            cameraReset={studio.cameraReset}
            saveCurrentProject={studio.saveCurrentProject}
          />
        )}
      </div>
    </div>
  );
}
