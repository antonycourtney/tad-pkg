import {
  deserializeTableRepJson,
  deserializeTableRepStr,
  QueryExp,
} from "../QueryExp";
import { TableRep, TableInfo } from "../TableRep";
import { SQLDialect } from "../dialect";
import {
  DataSourceNode,
  DataSourcePath,
  DataSourceNodeId,
} from "../DataSource";
import { TransportClient } from "./Transport";
import * as log from "loglevel";
import { Result } from "./result";
import { deserializeError } from "serialize-error";

// Static registry of globally unique DbProvider names:
export type DbProviderName = "aws-athena" | "bigquery" | "sqlite" | "snowflake";
export interface DbConnectionKey {
  providerName: DbProviderName;
  connectionInfo: any;
}

export interface EvalQueryOptions {
  showQueries?: boolean;
}
export const defaultEvalQueryOptions: EvalQueryOptions = {
  showQueries: false,
};

export interface DbConnEvalQueryRequest {
  queryStr: string; // JSON-encoded QueryExp
  offset: number | null;
  limit: number | null;
  options: EvalQueryOptions;
}

export interface DbConnRowCountRequest {
  queryStr: string; // JSON-encoded QueryExp
  options: EvalQueryOptions;
}

export interface DbConnGetTableInfoRequest {
  tableName: string;
}

export interface DbConnGetSourceInfoRequest {
  path: DataSourcePath;
}

/**
 * A local or remote connection to a specific database instance.
 */
export interface DbConnection {
  readonly connectionKey: DbConnectionKey;

  evalQuery(
    query: QueryExp,
    offset?: number,
    limit?: number,
    options?: EvalQueryOptions
  ): Promise<TableRep>;
  rowCount(query: QueryExp, options?: EvalQueryOptions): Promise<number>;

  getTableInfo(tableName: string): Promise<TableInfo>;
  getSourceInfo(path: DataSourcePath): Promise<DataSourceNode>;

  getDisplayName(): Promise<string>;
}

export type EngineReq<T> = { engine: DbConnectionKey; req: T };

// remote invoke a DbConnection member function, using DbConnectionKey to
// identify the engine:
async function invokeDbFunction<T>(
  tconn: TransportClient,
  engine: DbConnectionKey,
  methodName: string,
  req: T
): Promise<Result<any>> {
  const ereq: EngineReq<T> = { engine, req };
  const retStr = await tconn.invoke(
    "DbConnection." + methodName,
    JSON.stringify(ereq)
  );
  // We could be more precise and try to only pass results from evalQuery through
  // this, but should be harmless to use this for everything:
  const ret = deserializeTableRepStr(retStr);
  return ret;
}

class RemoteDbConnection implements DbConnection {
  private tconn: TransportClient;
  readonly connectionKey: DbConnectionKey;
  private displayName: string;

  constructor(
    tconn: TransportClient,
    connectionKey: DbConnectionKey,
    displayName: string
  ) {
    this.tconn = tconn;
    this.connectionKey = connectionKey;
    this.displayName = displayName;
  }

  async getDisplayName(): Promise<string> {
    return this.displayName;
  }

  async evalQuery(
    query: QueryExp,
    offset?: number,
    limit?: number,
    options?: EvalQueryOptions
  ): Promise<TableRep> {
    const req: DbConnEvalQueryRequest = {
      queryStr: JSON.stringify(query),
      offset: offset ? offset : null,
      limit: limit ? limit : null,
      options: options ? options : defaultEvalQueryOptions,
    };
    const ret = await invokeDbFunction(
      this.tconn,
      this.connectionKey,
      "evalQuery",
      req
    ).then(decodeResult);
    return ret;
  }

  async rowCount(query: QueryExp, options?: EvalQueryOptions): Promise<number> {
    const req: DbConnRowCountRequest = {
      queryStr: JSON.stringify(query),
      options: options ? options : defaultEvalQueryOptions,
    };
    return invokeDbFunction(
      this.tconn,
      this.connectionKey,
      "rowCount",
      req
    ).then(decodeResult);
  }

  async getTableInfo(tableName: string): Promise<TableInfo> {
    const req: DbConnGetTableInfoRequest = { tableName };
    return invokeDbFunction(
      this.tconn,
      this.connectionKey,
      "getTableInfo",
      req
    ).then(decodeResult);
  }

  async getSourceInfo(path: DataSourcePath): Promise<DataSourceNode> {
    const req: DbConnGetSourceInfoRequest = { path };
    return invokeDbFunction(
      this.tconn,
      this.connectionKey,
      "getSourceInfo",
      req
    ).then(decodeResult);
  }
}

/**
 * The ReltabConnection interface is the entry point for client-side access to
 * reltab via some client-specific transport mechanism.
 * The interface provides access to a set of data sources and the ability
 * to obtain a (proxy) DbConnection to those data sources.
 */
export interface ReltabConnection {
  connect(
    connectionKey: DbConnectionKey,
    displayName: string
  ): Promise<DbConnection>;

  getDataSources(): Promise<DataSourceNodeId[]>;

  /**
   * Expand an absolute DataSourcePath, rooted in an available Database.
   * @param path Absolute path to data source.
   */
  getSourceInfo(path: DataSourcePath): Promise<DataSourceNode>;
}

async function jsonInvoke(
  tconn: TransportClient,
  functionName: string,
  req: any
): Promise<any> {
  const reqStr = JSON.stringify(req);
  const retStr = await tconn.invoke(functionName, reqStr);
  const ret = JSON.parse(retStr);
  return ret;
}

function decodeResult<T>(res: Result<T>): T {
  switch (res.status) {
    case "Ok":
      return res.value;
    case "Err":
      console.log("decodeResult: got error result: ", res);
      const errVal = deserializeError(res.errVal);
      throw errVal;
  }
}

/**
 * Implementation of ReltabConnection interface using lower level
 * TransportClient remote invocation
 */
export class RemoteReltabConnection implements ReltabConnection {
  private tconn: TransportClient;

  constructor(tconn: TransportClient) {
    this.tconn = tconn;
  }

  async connect(
    connectionKey: DbConnectionKey,
    displayName: string
  ): Promise<DbConnection> {
    const conn = new RemoteDbConnection(this.tconn, connectionKey, displayName);
    return conn;
  }

  async getDataSources(): Promise<DataSourceNodeId[]> {
    const ret = (await jsonInvoke(this.tconn, "getDataSources", {}).then(
      decodeResult
    )) as any;
    return ret["nodeIds"];
  }

  /**
   * Expand an absolute DataSourcePath, rooted in an available Database.
   * @param path Absolute path to data source.
   */
  async getSourceInfo(path: DataSourcePath): Promise<DataSourceNode> {
    const ret = (await jsonInvoke(this.tconn, "getSourceInfo", { path }).then(
      decodeResult
    )) as any;
    return ret["sourceInfo"];
  }
}
