const KwilDB = require("kwildb");
const fs = require("fs");
const inquirer = require("inquirer");
const nReadlines = require("n-readlines");

const ProgressBar = require("./progress-bar.js");
const KwilDBTerminal = require("./kwildb-terminal.js");
const { sleep, isError, isJSON, testAutoSync } = require("./utils");

inquirer.registerPrompt("search-list", require("inquirer-search-list"));

// while importing, refresh moat funds/data info after this many SQL statements
const refreshMoatInfoCycle = 100;

const strNEW = "<new>";

class KwilDBCLI {
  constructor(options, pkg) {
    this.options = options;
    this.pkg = pkg;
    this.errorFileStream = null;
    this.outputFileStream = null;
    this.kwilDB = null;
    this.progressBar = new ProgressBar();

    this.info = {
      engine: undefined, // kwildb database engine
      // moat funds usage
      funds: {
        total: undefined,
        value: undefined,
      },
      // moat data usage
      data: {
        total: undefined,
        value: undefined,
      },
      // sql statements
      sql: {
        total: undefined, // statements encountered
        procd: undefined, // statements processed
        error: undefined, // statements executed with error
        value: undefined, // current statement number
      },
    };
  }

  exit(code) {
    if (this.options.debug) {
      const used = process.memoryUsage().heapUsed / 1024 / 1024;
      console.log(
        `The script used approximately ${
          Math.round(used * 100) / 100
        } MB (heap memory)`
      );
    }
    if (this.errorFileStream) this.errorFileStream.end();
    if (this.outputFileStream) this.outputFileStream.end();
    process.exit(code);
  }

  async init() {
    try {
      await this.initConfigDir();
      if (this.options.errorFile) this.openErrorFile();

      if (this.options.moat !== undefined) {
        const moatConfig = await this.promptForMoatConfig(this.options.moat);
        await this.connectToMoat(moatConfig);
      }

      if (this.options.inputFile) {
        // require connected moat to import SQL
        if (this.options.moat === undefined) {
          console.log("ERROR: KwilDB moat must be specified");
          this.exit(1);
        }
        await this.importSQLFile();
      } else {
        await this.terminalPrompt();
      }
    } catch (err) {
      console.log("ERROR:", err.message);
      this.exit(1);
    }

    this.exit(0);
  }

  openErrorFile() {
    try {
      // test file for writing, then open as stream
      fs.writeFileSync(this.options.errorFile, "");
      this.errorFileStream = fs.createWriteStream(this.options.errorFile, {
        encoding: "utf8",
      });
    } catch (error) {
      console.log("ERROR: Failed to open error file");
      console.log(error.message);
      this.exit(1);
    }
  }

  writeErrorFile(v) {
    // ???: if (!this.options.errorFile) return;
    try {
      this.errorFileStream.write(v + "\n");
    } catch (error) {
      console.log("ERROR: Failed to write to error file");
      console.log(error.message);
      this.exit(1);
    }
  }

  openOutputFile() {
    try {
      // test file for writing, then open as stream
      fs.writeFileSync(this.options.outputFile, "");
      this.outputFileStream = fs.createWriteStream(this.options.outputFile, {
        encoding: "utf8",
      });
    } catch (error) {
      console.log("ERROR: Failed to open output file");
      console.log(error.message);
      this.exit(1);
    }
  }

  writeOutputFile(v) {
    if (!this.options.outputFile) return;
    try {
      if (!this.outputFileStream) this.openOutputFile();
      this.outputFileStream.write(v + "\n");
    } catch (error) {
      console.log("ERROR: Failed to write to output file");
      console.log(error.message);
      this.exit(1);
    }
  }

  async terminalPrompt() {
    if (this.options.debug) console.log("----- TERMINAL BEGIN -----");
    const terminal = new KwilDBTerminal(this, (type, msg) => {
      switch (type) {
        case "ERROR":
          console.log("Terminal Error:", msg);
          if (this.options.exitOnError) {
            console.log("Exiting on Terminal error");
            this.exit(1);
          }
        default:
          if (this.options.debug)
            console.log("TODO: terminal callback", type, msg);
          break;
      }
    });
    await terminal.prompt();
    if (this.options.debug) console.log("----- TERMINAL END -----");
  }

  async importSQLFile() {
    let stats;

    // read SQL file to count total statements
    stats = await this.readSQLFile(this.options.inputFile);

    this.info = { ...this.info, sql: stats };
    this.progressBar.start(this.info, { data: 1, funds: 1, sql: 1 });

    // read SQL file to execute statements
    stats = await this.readSQLFile(
      this.options.inputFile,
      async (statement, number) => {
        if (this.options.dryRun) await sleep(10);
        else
          await this.query(
            statement,
            this.options.autoSync ? testAutoSync(statement) : this.options.sync
          );

        this.progressBar.updateSQL(number);
        if (number % refreshMoatInfoCycle == 0 || number == stats.total) {
          await this.refreshConnectedMoatInfo();
          this.progressBar.updateData(this.info.data.value);
          this.progressBar.updateFunds(this.info.funds.value);
        }
      }
    );

    this.progressBar.stop();

    if (this.options.debug) {
      console.log(
        "Number of statements error/processed/total =",
        `${stats.error}/${stats.procd}/${stats.total}`
      );
    }
  }

  // process an SQL file line by line
  // call await processStatement(statement, statementNumber) on each statement
  // return stats when complete
  async readSQLFile(fd, processStatement = async () => {}) {
    const readLines = new nReadlines(fd);
    const regexLineSkip = /^(\s*$|--)/; // empty lines and comments
    const regexStatementEnd = /;$/; // statements always end with ";"

    let line;
    let statement = "";
    let stats = {
      total: 0, // statements encountered
      procd: 0, // statements processed
      error: 0, // statements executed with error
    };

    while ((line = readLines.next())) {
      // skip empty lines and comments
      if (regexLineSkip.test(line)) continue;

      // append multi-line statements
      statement += line;
      if (!regexStatementEnd.test(line)) continue;

      stats["total"]++;

      // process statement if the number encountered is greater than the offset
      if (stats["total"] > this.options.offset) {
        await processStatement(statement, stats["total"]);
        stats["procd"]++;
      }

      statement = "";

      // stop processing if limit reached
      if (this.options.limit && stats["procd"] >= this.options.limit) break;
    }

    return stats;
  }

  // options can be passed here for local overrides
  async query(q, sync, options = this.options) {
    // ?: setTimeout(async function () {

    // NOTE: hack!!! reassign console.log to prevent kwildb from making console noise for each query
    // TOOD: revisit with the evolution of kwildb library
    const log = console.log;
    if (!options.debug) console.log = () => {};

    try {
      let result = await this.kwilDB.query(q, sync);
      console.log = log;

      if (options.debug) {
        console.log("----- QUERY RESULT BEGIN -----");
        console.log(result);
        console.log("----- QUERY RESULT END -----");
      }

      if (options.outputFile && result.rows)
        this.writeOutputFile(JSON.stringify(result.rows));

      return result;
    } catch (err) {
      console.log = log;

      if (options.debug) {
        console.log("----- QUERY ERROR BEGIN -----");
        console.log(err);
        console.log("----- QUERY ERROR END -----");
      }

      if (options.errorFile) this.writeErrorFile(q);

      if (options.exitOnError) {
        console.log("Exiting on SQL error");
        this.exit(1);
      }

      return err;
    }
    // ?: }, 0);
  }

  async selectMoatConfig() {
    try {
      const choices = fs
        .readdirSync(this.options.configDir)
        .map((f) => f.replace(/(.*)\.json$/, "$1"))
        .concat(strNEW);
      if (choices.length == 1) return strNEW;
      const answers = await inquirer.prompt([
        {
          type: "search-list",
          message: "Select KwilDB moat configuration or create a new one",
          name: "moatConfig",
          choices,
        },
      ]);
      return answers.moatConfig;
    } catch (err) {
      console.log("ERROR:", err.message);
      this.exit(1);
    }
  }

  // if config dir does not exist, create it
  async initConfigDir() {
    if (!fs.existsSync(this.options.configDir))
      await fs.promises.mkdir(this.options.configDir, { recursive: true });
  }

  // prompt user for moat configuration, if it doesn't exist
  // create moat config file if not exist
  // return moat config read from file
  async promptForMoatConfig(moat) {
    try {
      // if moat is not specified, prompt to select existing
      if (moat === undefined) moat = await this.selectMoatConfig();

      // if moat config file does not exist, create new
      let moatFile = `${this.options.configDir}/${moat}.json`;
      if (!fs.existsSync(moatFile)) {
        const answers = await inquirer.prompt([
          {
            name: "moat",
            type: "input",
            message: "KwilDB moat name",
            default: moat == strNEW ? "" : moat,
            validate: (input) => {
              if (input == "") return "moat name is required";
              return true;
            },
          },
          {
            name: "host",
            type: "input",
            message: "KwilDB host",
            default: "test-db.kwil.xyz",
          },
          {
            name: "port",
            type: "input",
            message: "KwilDB port",
            default: "",
          },
          {
            name: "protocol",
            type: "input",
            message: "KwilDB protocol",
            default: "https",
          },
          {
            name: "secret",
            type: "input",
            message: "KwilDB secret",
            validate: (input) => {
              if (input == "") return "secret is required";
              return true;
            },
          },
          {
            name: "privateKey",
            type: "input",
            message: "KwilDB private key",
            validate: (input) => {
              if (input == "") return "private key is required";
              if (!isJSON(input)) return "private key is not valid format";
              return true;
            },
          },
        ]);
        moat = answers.moat;
        moatFile = `${this.options.configDir}/${moat}.json`;
        const config = { kwildb: answers };
        fs.writeFileSync(moatFile, JSON.stringify(config), "utf8", (err) => {
          if (err) {
            console.log(`Error writing file: ${err}`);
          } else {
            console.log(`File written successfully!`);
          }
        });
      }

      // read and return parsed config file
      return this.readMoatConfigFile(moat);
    } catch (err) {
      console.log("ERROR:", err.message);
      this.exit(1);
    }
  }

  readMoatConfigFile(moat) {
    let moatFile = `${this.options.configDir}/${moat}.json`;
    const config = JSON.parse(fs.readFileSync(moatFile));
    config.kwildb.privateKey = JSON.parse(config.kwildb.privateKey);
    return config;
  }

  // A test...
  // async connectToMoatSocket() {
  //   try {
  //     const socket = this.kwilDB.createWebSocket();
  //     socket.ws.on("message", function (_message) {
  //       console.log("!!! message", JSON.parse(_message));
  //     });
  //     socket.ws.on("error", function (_message) {
  //       console.log("!!! error", _message);
  //     });
  //     await sleep(1000);
  //     socket.query("select * from yuh;");
  //     await sleep(1000);
  //   } catch (error) {
  //     console.log(error.message);
  //     this.exit(1);
  //   }
  // }

  async connectToMoat(config, exitOnError = true) {
    this.kwilDB = KwilDB.createConnector(config.kwildb, config.kwildb.secret);
    const info = await this.getMoatInfo(this.kwilDB);

    if (info === null) {
      console.log("ERROR: failed to access KwilDB moat");
      if (exitOnError) this.exit(1);
      this.options.moat = undefined;
      return null;
    } else {
      this.options.moat = config.kwildb.moat;
      const engine = await this.getConnectedMoatEngine();
      this.info = { ...info, engine };
      if (this.options.debug) console.log("info", this.info);
      return info;
    }
  }

  // returns null upon failure
  async getMoatInfo(kwilDB) {
    try {
      const funding = await kwilDB.getMoatFunding();
      const debit = await kwilDB.getMoatDebit();
      const info = { ...funding, ...debit };

      // consider connection failure if either moat funding or debit is null
      if (info.funding === null || info.debit === null) return null;

      // Fancy moat funds/data math reference:
      // https://github.com/kwilteam/db-dashboard/blob/main/src/components/FundingView.js
      return {
        funds: {
          total: info.funding,
          value: (info.debit / 1000000000) * 8.5 * 1.3,
        },
        data: {
          total: Math.round((info.funding / (8.5 * 1.3)) * 1000000000),
          value: info.debit,
        },
      };
    } catch (err) {
      console.log("ERROR:", err.message);
      return null;
    }
  }

  async getConnectedMoatEngine() {
    // TODO/NOTE: hack!!! this query is not database engine agnostic...
    let q = "SELECT VERSION();";
    let r = await this.query(q, false, { ...this.options, outputFile: "" });
    return !isError(r)
      ? r.rows[0].version.split(" ").splice(0, 2).join(" ")
      : null;
  }

  getConnectedMoatName() {
    return this.options.moat;
  }

  async refreshConnectedMoatInfo() {
    if (this.options.moat === undefined) return false;
    const moatInfo = await this.getMoatInfo(this.kwilDB);
    this.info = { ...this.info, ...moatInfo };
    return true;
  }

  printMoatInfo() {
    const config = this.readMoatConfigFile(this.options.moat);
    console.log(`moat:     ${config.kwildb.moat}`);
    console.log(`host:     ${config.kwildb.host}`);
    if (config.kwildb.port) console.log(`port:     ${config.kwildb.port}`);
    console.log(`protocol: ${config.kwildb.protocol}`);
    console.log(`engine:   ${this.info.engine}`);
    this.progressBar.start(this.info, { data: 1, funds: 1, sql: 0 });
    this.progressBar.stop();
  }
}

module.exports = KwilDBCLI;
