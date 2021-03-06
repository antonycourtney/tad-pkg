/*
 * main module for render process
 */
import * as React from "react";
import * as ReactDOM from "react-dom";
import OneRef, { mkRef, refContainer } from "oneref";
import { AppPane, AppPaneBaseProps } from "tadviewer";
import { PivotRequester } from "tadviewer";
import { AppState } from "tadviewer";
import { ViewParams } from "tadviewer";
import { initAppState } from "tadviewer";
import * as reltab from "reltab";
import log from "loglevel";
import { WebTransportClient } from "./reltabWebClient";
import { DbConnectionKey, RemoteReltabConnection } from "reltab";

const testBaseUrl = "http://localhost:9000";
// const TEST_FILE = "movie_metadata.csv";

// const TEST_TABLE = "bigquery-public-data.covid19_jhu_csse.summary";
// const TEST_TABLE = "bigquery-public-data.github_repos.commits";
// const TEST_TABLE = "bigquery-public-data.iowa_liquor_sales.sales";
const TEST_TABLE = "movie_metadata";

/*
const openParams = {
  fileType: "csv",
  targetPath: testTable + ".csv",
  fileContents: null,
  srcFile: null,
};
*/

// TODO: figure out how to initialize based on saved views or different file / table names
const init = async () => {
  console.log("hello, Tad!");
  log.setLevel(log.levels.DEBUG);
  let targetPath: string = "";
  let srcFile = null;
  let viewParams: ViewParams | null = null;

  const appState = new AppState({
    targetPath,
  });
  const stateRef = mkRef(appState);
  const [App, listenerId] = refContainer<AppState, AppPaneBaseProps>(
    stateRef,
    AppPane
  );

  // const tableName = TEST_TABLE;
  // const rtc = new WebReltabConnection(testBaseUrl);

  // const tableName = await rtc.importFile(TEST_FILE);

  const wtc = new WebTransportClient(testBaseUrl);

  const rtc = new RemoteReltabConnection(wtc);

  console.log("before initAppState");

  var pivotRequester: PivotRequester | undefined | null = null;

  await initAppState(rtc, stateRef);

  ReactDOM.render(<App />, document.getElementById("app"));

  console.log("before creating pivotRequester");
  pivotRequester = new PivotRequester(stateRef);

  /*
          ipcRenderer.on("request-serialize-app-state", (event, req) => {
            console.log("got request-serialize-app-state: ", req);
            const { requestId } = req;
            const curState = stateRef.getValue();
            const viewParamsJS = curState.viewState.viewParams.toJS();
            const serState = {
              targetPath,
              viewParams: viewParamsJS,
            };
            console.log("current viewParams: ", viewParamsJS);
            ipcRenderer.send("response-serialize-app-state", {
              requestId,
              contents: serState,
            });
          });
          ipcRenderer.on("set-show-hidden-cols", (event, val) => {
            actions.setShowHiddenCols(val, updater);
          });
          ipcRenderer.on("request-serialize-filter-query", (event, req) => {
            console.log("got request-serialize-filter-query: ", req);
            const { requestId } = req;
            const curState = stateRef.getValue();
            const baseQuery = curState.baseQuery;
            const viewParams = curState.viewState.viewParams;
            const filterRowCount = curState.viewState.queryView.filterRowCount;
            const queryObj = {
              query: baseQuery.filter(viewParams.filterExp),
              filterRowCount,
            };
            const contents = JSON.stringify(queryObj, null, 2);
            ipcRenderer.send("response-serialize-filter-query", {
              requestId,
              contents,
            });
          });
          ipcRenderer.on("open-export-dialog", (event, req) => {
            const { openState, saveFilename } = req;
            actions.setExportDialogOpen(openState, saveFilename, updater);
          });
          ipcRenderer.on("export-progress", (event, req) => {
            const { percentComplete } = req;
            actions.setExportProgress(percentComplete, updater);
          });
        });
    })
    .catch((err) => {
      console.error(
        "renderMain: caught error during initialization: ",
        err.message,
        err.stack
      );
      remoteErrorDialog("Error initializing Tad", err.message, true);
    });
  */
};

init();
