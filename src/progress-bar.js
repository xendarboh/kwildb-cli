const cliProgress = require("cli-progress");

const { humanReadableData, humanReadableFunds } = require("./utils.js");

// A wrapper around cli-progress for a set of application specific progress bars
class ProgressBar {
  constructor() {
    this.nullify();
  }

  nullify() {
    this.multibar = null;
    this.bar = {
      data: null,
      funds: null,
      sql: null,
    };
  }

  start(info, enable = { data: 1, funds: 1, sql: 1 }) {
    this.multibar = new cliProgress.MultiBar(
      {
        autopadding: true,
        clearOnComplete: false,
        hideCursor: true,
      },
      cliProgress.Presets.shades_classic
    );
    if (enable.data) this.addData(info.data);
    if (enable.funds) this.addFunds(info.funds);
    if (enable.sql) this.addSQL(info.sql);
  }

  stop() {
    this.multibar.stop();
    this.nullify();
  }

  addData(v) {
    this.bar.data = this.multibar.create(
      v.total,
      v.value ? v.value : 0,
      {},
      {
        format: "Moat Data Usage  [{bar}] {percentage}% | {value} / {total}",
        formatValue: fvData,
      }
    );
  }

  addFunds(v) {
    this.bar.funds = this.multibar.create(
      v.total,
      v.value ? v.value : 0,
      {},
      {
        format: "Moat Funds Usage [{bar}] {percentage}% | {value} / {total}",
        formatValue: fvFunds,
      }
    );
  }

  addSQL(v) {
    this.bar.sql = this.multibar.create(
      v.total,
      v.value ? v.value : 0,
      {},
      {
        format:
          "SQL Statements   [{bar}] {percentage}% | ETA: {eta_formatted} | {value} / {total}",
      }
    );
  }

  updateData(value) {
    this.bar.data.update(value);
  }

  updateFunds(value) {
    this.bar.funds.update(value);
  }

  updateSQL(value) {
    this.bar.sql.update(value);
  }
}

// the default value format function
// https://github.com/npkgz/cli-progress/blob/HEAD/lib/format-value.js
const formatValue = (v, options, type) => {
  // no autopadding ? passthrough
  if (options.autopadding !== true) {
    return v;
  }

  // padding
  function autopadding(value, length) {
    return (options.autopaddingChar + value).slice(-length);
  }

  switch (type) {
    case "percentage":
      return autopadding(v, 3);

    default:
      return v;
  }
};

// customized value format functions for human readable moat data/funds

const fvFunds = (v, options, type) => {
  switch (type) {
    case "total":
    case "value":
      return humanReadableFunds(v, "USD");

    default:
      return formatValue(v, options, type);
  }
};

const fvData = (v, options, type) => {
  switch (type) {
    case "total":
    case "value":
      return humanReadableData(v);

    default:
      return formatValue(v, options, type);
  }
};

module.exports = ProgressBar;
