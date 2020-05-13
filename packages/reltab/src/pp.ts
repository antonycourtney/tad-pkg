import { SQLDialect } from "./dialect";
import { asString, constVal } from "./defs";
import { StringBuffer, colExtendExpToSqlStr } from "./internals";
import {
  SQLValExp,
  SQLSelectListItem,
  SQLSortColExp,
  SQLSelectAST,
  SQLQueryAST,
} from "./SQLQuery";

/*
 * not-so-pretty print a SQL query
 */
const ppOut = (dst: StringBuffer, depth: number, str: string): void => {
  const indentStr = "  ".repeat(depth);
  dst.push(indentStr);
  dst.push(str);
};

type PPAggFn = (dialect: SQLDialect, aggStr: string, qcid: string) => string;
const ppAggUniq = (dialect: SQLDialect, aggStr: string, qcid: string) =>
  `case when min(${qcid})=max(${qcid}) then min(${qcid}) else null end`;
const ppAggNull = (dialect: SQLDialect, aggStr: string, qcid: string) => "null";
const ppAggNullStr = (dialect: SQLDialect, aggStr: string, qcid: string) =>
  ppValExp(dialect, asString(constVal(null)));
const ppAggDefault = (dialect: SQLDialect, aggStr: string, qcid: string) =>
  aggStr + "(" + qcid + ")";

const ppAggMap: { [aggStr: string]: PPAggFn } = {
  uniq: ppAggUniq,
  null: ppAggNull,
  nullstr: ppAggNullStr,
};

const getPPAggFn = (fnm: string): PPAggFn => {
  const ppfn = ppAggMap[fnm];
  return ppfn != null ? ppfn : ppAggDefault;
};

const ppValExp = (dialect: SQLDialect, vexp: SQLValExp): string => {
  let ret: string;
  switch (vexp.expType) {
    case "agg":
      const aggStr = vexp.aggFn;
      const ppAggFn = getPPAggFn(aggStr);
      ret = ppAggFn(dialect, aggStr, colExtendExpToSqlStr(dialect, vexp.exp));
      break;
    default:
      ret = colExtendExpToSqlStr(dialect, vexp);
  }
  return ret;
};

const ppSelListItem = (
  dialect: SQLDialect,
  item: SQLSelectListItem
): string => {
  let ret: string;
  if (item.colExp == null) {
    throw new Error("ppSelListItem fail: " + item.toString());
  }
  ret = ppValExp(dialect, item.colExp);
  if (item.as != null) {
    ret += ` as ${dialect.quoteCol(item.as)}`;
  }
  return ret;
};

const ppSortColExp = (dialect: SQLDialect, exp: SQLSortColExp): string => {
  const optDescStr = exp.asc ? "" : " desc";
  return `${dialect.quoteCol(exp.col)}${optDescStr}`;
};

const ppSQLSelect = (
  dialect: SQLDialect,
  dst: StringBuffer,
  depth: number,
  ss: SQLSelectAST
) => {
  const selColStr = ss.selectCols
    .map((exp) => ppSelListItem(dialect, exp))
    .join(", ");
  ppOut(dst, depth, `SELECT ${selColStr}\n`);
  ppOut(dst, depth, "FROM ");
  const fromVal = ss.from;

  if (typeof fromVal === "string") {
    dst.push(dialect.quoteCol(fromVal) + "\n");
  } else if (fromVal.expType === "join") {
    // join condition:
    const { lhs, rhs } = fromVal;
    dst.push("(\n");
    auxPPSQLQuery(dialect, dst, depth + 1, lhs);
    dst.push(") LEFT OUTER JOIN (\n");
    auxPPSQLQuery(dialect, dst, depth + 1, rhs);
    dst.push(")\n");

    if (ss.on) {
      const qcols = ss.on.map(dialect.quoteCol);
      dst.push("USING (" + qcols.join(", ") + ")\n");
    }
  } else {
    dst.push("(\n");
    auxPPSQLQuery(dialect, dst, depth + 1, fromVal.query);
    ppOut(dst, depth, ")\n");
  }

  if (ss.where) {
    const sqlWhereStr = ss.where.toSqlWhere(dialect);
    if (sqlWhereStr.length > 0) {
      ppOut(dst, depth, `WHERE ${sqlWhereStr}\n`);
    }
  }

  if (ss.groupBy.length > 0) {
    const gbStr = ss.groupBy.map(dialect.quoteCol).join(", ");
    ppOut(dst, depth, `GROUP BY ${gbStr}\n`);
  }

  if (ss.orderBy.length > 0) {
    const obStr = ss.orderBy
      .map((exp) => ppSortColExp(dialect, exp))
      .join(", ");
    ppOut(dst, depth, `ORDER BY ${obStr}\n`);
  }
}; // internal, recursive function:

const auxPPSQLQuery = (
  dialect: SQLDialect,
  dst: StringBuffer,
  depth: number,
  query: SQLQueryAST
) => {
  query.selectStmts.forEach((selStmt, idx) => {
    ppSQLSelect(dialect, dst, depth, selStmt);

    if (idx < query.selectStmts.length - 1) {
      ppOut(dst, depth, "UNION ALL\n");
    }
  });
}; // external (top-level) function:

export const ppSQLQuery = (
  dialect: SQLDialect,
  query: SQLQueryAST,
  offset: number,
  limit: number
): string => {
  try {
    let strBuf: StringBuffer = [];
    auxPPSQLQuery(dialect, strBuf, 0, query);

    if (offset !== -1) {
      ppOut(strBuf, 0, "LIMIT ");
      ppOut(strBuf, 0, limit.toString());
      ppOut(strBuf, 0, " OFFSET ");
      ppOut(strBuf, 0, offset.toString());
      ppOut(strBuf, 0, "\n");
    }

    const retStr = strBuf.join("");
    return retStr;
  } catch (err) {
    console.error(
      "ppSQLQuery: Caught exception pretty printing SQLQuery: ",
      JSON.stringify(query, undefined, 2)
    );
    throw err;
  }
};