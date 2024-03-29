import * as React from "react";
import { ActivityBar } from "./ActivityBar";
import { PivotSidebar } from "./PivotSidebar";
import { DataSourceSidebar } from "./DataSourceSidebar";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import {
  FocusStyleManager,
  Button,
  Dialog,
  Classes,
  ProgressBar,
} from "@blueprintjs/core";
import { GridPane, OpenURLFn } from "./GridPane";
import { Footer } from "./Footer";
import { LoadingModal } from "./LoadingModal";
import * as actions from "../actions";
import { AppState } from "../AppState";
import * as oneref from "oneref";
import { useState } from "react";
import { Activity } from "./defs";
import { mutableGet, StateRef } from "oneref";
import { DataSourcePath, ReltabConnection, resolvePath } from "reltab";
import { useDeepCompareEffect } from "use-deep-compare";
import { Timer } from "../Timer";
import { SimpleClipboard } from "./SimpleClipboard";
/**
 * top level application pane
 */

export type NewWindowFn = (
  path: DataSourcePath,
  stateRef: StateRef<AppState>
) => void;

export interface AppPaneBaseProps {
  newWindow: NewWindowFn;
  openURL: OpenURLFn;
  clipboard: SimpleClipboard;
}

type AppPaneProps = AppPaneBaseProps & oneref.StateRefProps<AppState>;

const handleExportDialogClose = (stateRef: StateRef<AppState>) => {
  actions.setExportDialogOpen(false, "", stateRef);
};

const handleViewConfirmDialogReplace = async (stateRef: StateRef<AppState>) => {
  const appState = mutableGet(stateRef);
  actions.setViewConfirmDialogOpen(false, null, stateRef);
  actions.replaceCurrentView(appState.viewConfirmSourcePath!, stateRef);
};

const handleViewConfirmDialogNewWindow = (
  newWindow: NewWindowFn,
  stateRef: StateRef<AppState>
) => {
  const appState = mutableGet(stateRef);
  actions.setViewConfirmDialogOpen(false, null, stateRef);
  newWindow(appState.viewConfirmSourcePath!, stateRef);
};

const handleViewConfirmDialogClose = (stateRef: StateRef<AppState>) => {
  actions.setViewConfirmDialogOpen(false, null, stateRef);
};

type ExportDialogProps = oneref.StateRefProps<AppState>;

const ExportDialog: React.FunctionComponent<ExportDialogProps> = ({
  appState,
  stateRef,
}: ExportDialogProps) => {
  let filterCountStr = "";

  const { viewState } = appState;

  if (
    appState.initialized &&
    viewState !== null &&
    viewState.dataView !== null
  ) {
    const viewParams = viewState.viewParams;
    const queryView = appState.viewState.queryView;

    if (queryView) {
      const { filterRowCount } = queryView;
      filterCountStr = filterRowCount.toLocaleString(undefined, {
        useGrouping: true,
      });
    }
  }
  return (
    <Dialog
      title="Export Filtered CSV"
      onClose={() => handleExportDialogClose(stateRef)}
      isOpen={appState.exportDialogOpen}
    >
      <div className={Classes.DIALOG_BODY}>
        <p className="bp3-text-large">
          Exporting {filterCountStr} rows to {appState.exportFilename}
        </p>
        <ProgressBar stripes={false} value={appState.exportPercent} />
      </div>
      <div className={Classes.DIALOG_FOOTER}>
        <div className={Classes.DIALOG_FOOTER_ACTIONS}>
          <Button
            disabled={appState.exportPercent < 1}
            onClick={() => handleExportDialogClose(stateRef)}
          >
            OK
          </Button>
        </div>
      </div>
    </Dialog>
  );
};

interface ViewConfirmDialogBaseProps {
  newWindow: NewWindowFn;
}

type ViewConfirmDialogProps = ViewConfirmDialogBaseProps &
  oneref.StateRefProps<AppState>;

const ViewConfirmDialog: React.FunctionComponent<ViewConfirmDialogProps> = ({
  newWindow,
  appState,
  stateRef,
}: ViewConfirmDialogProps) => {
  return (
    <Dialog
      title="Open Table"
      onClose={() => handleViewConfirmDialogClose(stateRef)}
      isOpen={appState.viewConfirmDialogOpen}
    >
      <div className={Classes.DIALOG_BODY}>
        <p className="bp3-text-large">
          You have unsaved changes to the current view. <br />
          Do you want to:
        </p>
      </div>
      <div className={Classes.DIALOG_FOOTER}>
        <div className={Classes.DIALOG_FOOTER_ACTIONS}>
          <Button onClick={() => handleViewConfirmDialogReplace(stateRef)}>
            Replace Current View
          </Button>
          <Button
            onClick={() =>
              handleViewConfirmDialogNewWindow(newWindow, stateRef)
            }
          >
            Open in New Window
          </Button>
          <Button
            intent="primary"
            onClick={() => handleViewConfirmDialogClose(stateRef)}
          >
            Cancel
          </Button>
        </div>
      </div>
    </Dialog>
  );
};

async function setTitleFromDSPath(
  rtc: ReltabConnection,
  dsPath: DataSourcePath
) {
  const node = await resolvePath(rtc, dsPath);
  const title = "Tad - " + node.displayName;
  document.title = title;
}

function timerShowModal(timer: Timer): boolean {
  return timer.running && timer.elapsed > 500;
}

export const AppPane: React.FunctionComponent<AppPaneProps> = ({
  newWindow,
  appState,
  stateRef,
  clipboard,
  openURL,
}: AppPaneProps) => {
  const { activity } = appState;
  const dataSourceExpanded = activity === "DataSource";
  const pivotPropsExpanded = activity === "Pivot";
  const [grid, setGrid] = useState<any>(null);
  let mainContents: JSX.Element | null = null;

  // console.log("AppPane: ", appState.toJS());

  const { rtc, viewState } = appState;

  let dsPath = viewState?.dsPath;

  useDeepCompareEffect(() => {
    if (rtc && dsPath) {
      setTitleFromDSPath(rtc, dsPath);
    }
  }, [dsPath]);

  let centerPane: JSX.Element | null;

  // We should probably make pivot sidebar deal better with an empty table, but...
  let pivotSidebar: JSX.Element | null;

  if (
    appState.initialized &&
    viewState !== null &&
    viewState.dataView !== null
  ) {
    pivotSidebar = (
      <PivotSidebar
        expanded={pivotPropsExpanded}
        schema={viewState.baseSchema}
        viewParams={viewState.viewParams}
        delayedCalcMode={viewState.delayedCalcMode}
        stateRef={stateRef}
      />
    );
    const loadingModal =
      timerShowModal(appState.appLoadingTimer) ||
      timerShowModal(viewState.loadingTimer) ? (
        <LoadingModal />
      ) : null;
    centerPane = (
      <div className="center-app-pane">
        {loadingModal}
        <GridPane
          onSlickGridCreated={(grid) => setGrid(grid)}
          appState={appState}
          viewState={appState.viewState}
          stateRef={stateRef}
          clipboard={clipboard}
          openURL={openURL}
        />
        <Footer appState={appState} stateRef={stateRef} />
      </div>
    );
  } else {
    pivotSidebar = null;
    centerPane = timerShowModal(appState.appLoadingTimer) ? (
      <LoadingModal />
    ) : null;
  }
  mainContents = (
    <div className="container-fluid full-height main-container">
      <DndProvider backend={HTML5Backend}>
        <ActivityBar activity={activity} stateRef={stateRef} />
        <DataSourceSidebar expanded={dataSourceExpanded} stateRef={stateRef} />
        {pivotSidebar}
        {centerPane}
      </DndProvider>
      <ExportDialog appState={appState} stateRef={stateRef} />
      <ViewConfirmDialog
        newWindow={newWindow}
        appState={appState}
        stateRef={stateRef}
      />
    </div>
  );
  return mainContents;
};
