// https://stackoverflow.com/a/30469297
const isError = (e) => e instanceof Error;

// https://stackoverflow.com/a/33369954
const isJSON = (item) => {
  item = typeof item !== "string" ? JSON.stringify(item) : item;
  try {
    item = JSON.parse(item);
  } catch (e) {
    return false;
  }
  if (typeof item === "object" && item !== null) return true;
  return false;
};

const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

const round2 = (v) => (Math.round(v * 100) / 100).toFixed(2);

const humanReadableFunds = (v, currency = "USD") =>
  v < 0.01 ? `< 0.01 ${currency}` : `${round2(v)} ${currency}`;

const humanReadableData = (v) =>
  v > 1000
    ? v > 1000000
      ? v > 1000000000
        ? `${round2(v / 1000000000)} GB`
        : `${round2(v / 1000000)} MB`
      : `${round2(v / 1000)} KB`
    : `${round2(v)}`;

const noAutoSync = ["ANALYZE", "DESCRIBE", "EXPLAIN", "SELECT", "SHOW"];

const testAutoSync = (sql) => {
  const r = new RegExp("^(" + noAutoSync.join("|") + ")", "i");
  return !r.test(sql.trim());
};

module.exports = {
  isError,
  isJSON,
  sleep,
  round2,
  humanReadableFunds,
  humanReadableData,
  testAutoSync,
};
