#!/usr/bin/env node

const { program, Option } = require("commander");

const KwilDBCLI = require("./src/kwildb-cli.js");
const pkg = require("./package.json");

// prettier-ignore
program
  .name(pkg.name)
  .description(pkg.description)
  .usage("[options]... [moat]")
  .argument("[moat]", "KwilDB moat to connect to")
  .option("-c, --config-dir <directory>", "the directory for configuration files", "./config")
  .option("-i, --input-file <file>",      "read SQL statements from a file")
  .option("-f, --error-file <file>",      "write failed statements to a file")
  .option("-o, --output-file <file>",     "write query results to a file")
  .option("    --limit <count>",          "limit number of executed statements")
  .option("    --offset <offset>",        "execute statements from the given offset", 0)
  .option("-n, --dry-run",                "perform a trial run without statement execution", false)
  .option("-e, --exit-on-error",          "exit if an error is encountered sending SQL", false)
  .option("    --sync",                   "sync queries", false)
  .option("    --no-sync",                "do not sync queries")
  .option("    --auto-sync",              "sync write statements and do not sync reads", false)
  .version(pkg.version, "-V, --version")
  .option("-d, --debug",                  "turn on debug output", false)
  .addOption(new Option('--debug-options').default(false).hideHelp())
  .parse(process.argv);

// these program options are essentially global and passed all around, sometimes with local overrides
// so if you see "options", this is where it originated
const options = program.opts();
options["moat"] = program.args[0];

if (options.debugOptions) {
  console.log("options", options);
  console.log("program.args", program.args);
  process.exit(0);
}

(async () => {
  const app = new KwilDBCLI(options, pkg);
  await app.init();
})();
