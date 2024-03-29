import * as reltab from "reltab";

export const columnSum = (
  tableData: reltab.TableRep,
  columnId: string
): number => {
  var sum: number;

  if (tableData.rowData.length > 0) {
    sum = tableData.rowData[0][columnId] as number;
  } else {
    sum = 0;
  }

  for (var i = 1; i < tableData.rowData.length; i++) {
    sum += tableData.rowData[i][columnId] as number;
  }
  return sum;
};

type Handler = (err: any) => void;

export const mkAsyncErrHandler = (t: any, msg: string): Handler => {
  return (err) => {
    console.error("caught async promise exception: ", err.stack);
    t.fail(msg + ": " + err);
  };
};

interface LogTableOptions {
  maxRows?: number;
}

export const logTable = (
  table: reltab.TableRep,
  options: LogTableOptions | null = null
): void => {
  // Node's console-table package has slightly different synopsis
  // than browser version; accepts column names as first arg:
  const ctf: any = console.table;

  const rowData =
    options && options.maxRows
      ? table.rowData.slice(0, options.maxRows)
      : table.rowData;

  ctf(rowData);
};
