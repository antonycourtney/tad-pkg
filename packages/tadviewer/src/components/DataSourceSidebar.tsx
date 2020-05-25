import * as React from "react";
import { Sidebar } from "./Sidebar";
import { StateRef, mutableGet } from "oneref";
import { AppState } from "../AppState";

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
import { DataSourceKind, DataSourceNode, DataSourceNodeId } from "reltab";
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
const placeholderTreeNode = (nodeId: DataSourceNodeId): ITreeNode => {
  const ret: ITreeNode = {
    icon: dataKindIcon(nodeId.kind),
    id: JSON.stringify(nodeId),
    label: nodeId.displayName,
    nodeData: nodeId,
    hasCaret: nodeId.kind !== "Table",
  };
  return ret;
};

const dataSourceTreeNode = (dsNode: DataSourceNode): ITreeNode => {
  const ret: ITreeNode = {
    icon: dataKindIcon(dsNode.nodeId.kind),
    id: JSON.stringify(dsNode.nodeId),
    label: dsNode.nodeId.displayName,
    nodeData: dsNode.nodeId,
    hasCaret: dsNode.children.length > 0,
    childNodes: dsNode.children.map(placeholderTreeNode),
  };
  return ret;
};

export const DataSourceSidebar: React.FC<DataSourceSidebarProps> = ({
  expanded,
  stateRef,
}) => {
  const [initialized, setInitialized] = useState(false);
  const [treeState, setTreeState] = useState<ITreeNode[]>([]);
  const [, forceUpdate] = useReducer((x) => x + 1, 0);
  React.useEffect(() => {
    async function fetchSourceInfo() {
      const appState = mutableGet(stateRef);
      const rtc = appState.rtc;
      const rootSourceInfo = await rtc.getSourceInfo([]);
      console.log("DataSourceSidebar: rootSourceInfo: ", rootSourceInfo);
      const rootNode = dataSourceTreeNode(rootSourceInfo);
      setTreeState([rootNode]);
    }
    if (!initialized) {
      fetchSourceInfo();
      setInitialized(true);
    }
  }, [initialized]);

  async function expandDataset(treeNode: ITreeNode) {
    const dsNodeId: DataSourceNodeId = treeNode.nodeData as DataSourceNodeId;
    const appState = mutableGet(stateRef);
    const rtc = appState.rtc;
    const dsInfo = await rtc.getSourceInfo([dsNodeId]);
    console.log("DataSourceSidebar: expandDataset: ", dsInfo);
    treeNode.childNodes = dsInfo.children.map(placeholderTreeNode);
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
  }

  const handleNodeCollapse = (treeNode: ITreeNode) => {
    console.log("handleNodeCollapse: ", treeNode);
    treeNode.isExpanded = false;
    forceUpdate();
  };
  const handleNodeExpand = (treeNode: ITreeNode) => {
    console.log("handleNodeExpand: ", treeNode);
    const dsNodeId: DataSourceNodeId = treeNode.nodeData as DataSourceNodeId;
    if (dsNodeId.kind === "Dataset") {
      expandDataset(treeNode);
    } else {
      treeNode.isExpanded = true;
      forceUpdate();
    }
  };
  const handleNodeClick = (
    treeNode: ITreeNode,
    _nodePath: any[],
    e: React.MouseEvent<HTMLElement>
  ) => {
    console.log("handleNodeClick: ", treeNode);
    const originallySelected = treeNode.isSelected;
    const dsNodeId: DataSourceNodeId = treeNode.nodeData as DataSourceNodeId;
    if (dsNodeId.kind === "Table") {
      actions.openTable(dsNodeId.id, stateRef);
    }
    // treeNode.isSelected = true;
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