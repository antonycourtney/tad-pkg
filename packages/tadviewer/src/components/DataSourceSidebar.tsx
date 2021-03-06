import * as React from "react";
import { Sidebar } from "./Sidebar";
import { StateRef, mutableGet } from "oneref";
import { AppState } from "../AppState";
import * as reltab from "reltab";
import * as log from "loglevel";

import {
  Classes,
  Icon,
  Intent,
  ITreeNode,
  Position,
  Tooltip,
  Tree,
  IconName,
} from "@blueprintjs/core";
import { useState, useReducer } from "react";
import {
  DataSourceKind,
  DataSourceNodeId,
  DataSourcePath,
  DbConnectionKey,
} from "reltab";
import { actions } from "../tadviewer";

export interface DataSourceSidebarProps {
  expanded: boolean;
  stateRef: StateRef<AppState>;
}

const dataKindIcon = (dsKind: DataSourceKind): IconName => {
  switch (dsKind) {
    case "Database":
      return "database";
    case "Dataset":
      return "folder-open";
    case "Table":
      return "th";
    default:
      throw new Error("dataKindIcon: unknown kind '" + dsKind + "'");
  }
};
const dsPathTreeNode = (
  prefix: DataSourcePath,
  nodeId: DataSourceNodeId
): ITreeNode => {
  const path = prefix.concat([nodeId]);
  const ret: ITreeNode = {
    icon: dataKindIcon(nodeId.kind),
    id: JSON.stringify(nodeId),
    label: nodeId.displayName,
    nodeData: path,
    hasCaret: nodeId.kind !== "Table",
  };
  return ret;
};

export const DataSourceSidebar: React.FC<DataSourceSidebarProps> = ({
  expanded,
  stateRef,
}) => {
  const [initialized, setInitialized] = useState(false);
  const [treeState, setTreeState] = useState<ITreeNode[]>([]);
  const [selectedNode, setSelectedNode] = useState<ITreeNode | null>(null);
  const [, forceUpdate] = useReducer((x) => x + 1, 0);
  React.useEffect(() => {
    async function fetchSourceInfo() {
      const appState = mutableGet(stateRef);
      const rtc = appState.rtc;
      try {
        const rootSources = await rtc.getDataSources();
        log.debug("DataSourceSideBar: rootSources: ", rootSources);
        const rootNodes = rootSources.map((src) => dsPathTreeNode([], src));
        setTreeState(rootNodes);
      } catch (err) {
        console.error("Caught error getting data sources: ", err);
      }
    }
    if (!initialized) {
      fetchSourceInfo();
      setInitialized(true);
    }
  }, [initialized]);

  const handleNodeCollapse = (treeNode: ITreeNode) => {
    treeNode.isExpanded = false;
    forceUpdate();
  };
  const handleNodeExpand = async (treeNode: ITreeNode) => {
    const dsPath: DataSourcePath = treeNode.nodeData as DataSourcePath;
    const dbConnKey: DbConnectionKey = dsPath[0].id as DbConnectionKey;
    const appState = mutableGet(stateRef);
    const rtc = appState.rtc;
    const dsInfo = await rtc.getSourceInfo(dsPath);
    treeNode.childNodes = dsInfo.children.map((item) =>
      dsPathTreeNode(dsPath, item)
    );
    treeNode.isExpanded = true;
    if (dsInfo.description) {
      treeNode.secondaryLabel = (
        <Tooltip
          usePortal={true}
          boundary="window"
          content={dsInfo.description}
        >
          <Icon icon="eye-open" />
        </Tooltip>
      );
    }
    forceUpdate();
  };

  const handleNodeClick = (
    treeNode: ITreeNode,
    _nodePath: any[],
    e: React.MouseEvent<HTMLElement>
  ) => {
    const dsPath = treeNode.nodeData as DataSourcePath;
    const dsNodeId = dsPath[dsPath.length - 1];
    if (dsNodeId.kind === "Table") {
      actions.openDataSourcePath(dsPath, stateRef);
      // actions.openTable(dsNodeId.id, stateRef);
    }
    if (selectedNode != null) {
      selectedNode.isSelected = false;
    }
    treeNode.isSelected = true;
    setSelectedNode(treeNode);
    forceUpdate();
  };

  return (
    <Sidebar expanded={expanded}>
      <Tree
        contents={treeState}
        onNodeCollapse={handleNodeCollapse}
        onNodeExpand={handleNodeExpand}
        onNodeClick={handleNodeClick}
      />
    </Sidebar>
  );
};

const INITIAL_STATE: ITreeNode[] = [
  {
    id: 0,
    hasCaret: true,
    icon: "folder-close",
    label: "Folder 0",
  },
  {
    id: 1,
    icon: "folder-close",
    isExpanded: true,
    label: (
      <Tooltip content="I'm a folder <3" position={Position.RIGHT}>
        Folder 1
      </Tooltip>
    ),
    childNodes: [
      {
        id: 2,
        icon: "document",
        label: "Item 0",
        secondaryLabel: (
          <Tooltip content="An eye!">
            <Icon icon="eye-open" />
          </Tooltip>
        ),
      },
      {
        id: 3,
        icon: (
          <Icon
            icon="tag"
            intent={Intent.PRIMARY}
            className={Classes.TREE_NODE_ICON}
          />
        ),
        label:
          "Organic meditation gluten-free, sriracha VHS drinking vinegar beard man.",
      },
      {
        id: 4,
        hasCaret: true,
        icon: "folder-close",
        label: (
          <Tooltip content="foo" position={Position.RIGHT}>
            Folder 2
          </Tooltip>
        ),
        childNodes: [
          { id: 5, label: "No-Icon Item" },
          { id: 6, icon: "tag", label: "Item 1" },
          {
            id: 7,
            hasCaret: true,
            icon: "folder-close",
            label: "Folder 3",
            childNodes: [
              { id: 8, icon: "document", label: "Item 0" },
              { id: 9, icon: "tag", label: "Item 1" },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 2,
    hasCaret: true,
    icon: "folder-close",
    label: "Super secret files",
    disabled: true,
  },
];
