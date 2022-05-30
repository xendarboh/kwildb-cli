const inquirer = require("inquirer");

const { isError, testAutoSync } = require("./utils");

inquirer.registerPrompt("command", require("inquirer-command-prompt"));

class KwilDBTerminal {
  constructor(kwilDBCLI, callback = (type, msg) => {}) {
    this.app = kwilDBCLI;
    this.cb = callback;

    // options
    this.autoSync = kwilDBCLI.options.autoSync;
    this.debug = kwilDBCLI.options.debug;
    this.sync = kwilDBCLI.options.sync;
    this.record = kwilDBCLI.options.outputFile ? true : false;

    this.printTerminalWelcome();
  }

  printTerminalWelcome() {
    console.log(
      `Welcome to ${this.app.pkg.description}. ${this.app.pkg.name} (${this.app.pkg.version})`
    );
    console.log("Type 'help' or '?' for help.");
    console.log("");
  }

  printSyncState() {
    console.log("  sync   :", this.autoSync ? "auto" : this.sync ? "on" : "off");
  }

  printDebugState() {
    console.log("  debug  :", this.debug ? "on" : "off");
  }

  printRecordState() {
    console.log("  record :", this.record ? "on" : "off");
  }

  printHelp() {
    console.log("commands:");
    console.log("  help     (\\?) display this help");
    console.log("  connect  (\\r) (re)connect to moat host");
    console.log("  debug    (\\D) enable debug output");
    console.log("  nodebug  (\\d) disable debug output");
    console.log("  exit     (\\q) same as quit");
    console.log("  info     (\\i) display info for the connected moat");
    console.log("  record   (\\O) enable record results to output file");
    console.log("  norecord (\\o) disable record results to output file");
    console.log("  sync     (\\S) enable kwildb query sync");
    console.log("  nosync   (\\s) disable kwildb query sync");
    console.log("  autosync (\\a) enable sync for writes, disable for reads");
    console.log(`  quit     (\\q) quit ${this.app.pkg.name}`);
    console.log("options:");
    this.printRecordState();
    this.printDebugState();
    this.printSyncState();
    console.log("");
  }

  async prompt() {
    try {
      const answers = await inquirer.prompt([
        {
          type: "command",
          name: "cmd",
          message: `KwilDB [${this.app.getConnectedMoatName() || "(none)"}]>`,
          autoCompletion: [
            "?",
            "\\?",
            "\\D",
            "\\O",
            "\\S",
            "\\a",
            "\\d",
            "\\i",
            "\\o",
            "\\q",
            "\\q",
            "\\r",
            "\\s",
            "autosync",
            "connect",
            "debug",
            "exit",
            "help",
            "info",
            "nodebug",
            "norecord",
            "nosync",
            "quit",
            "record",
            "sync",
          ],
        },
      ]);
      switch (answers.cmd) {
        case "quit":
        case "exit":
        case "\\q":
          console.log("Bye");
          return; // exit the prompt!

        case "debug":
        case "\\D":
          this.debug = true;
          this.printDebugState();
          break;

        case "nodebug":
        case "\\d":
          this.debug = false;
          this.printDebugState();
          break;

        case "record":
        case "\\O":
          this.record = true;
          this.printRecordState();
          break;

        case "norecord":
        case "\\o":
          this.record = false;
          this.printRecordState();
          break;

        case "sync":
        case "\\S":
          this.sync = true;
          this.autoSync = false;
          this.printSyncState();
          break;

        case "nosync":
        case "\\s":
          this.sync = false;
          this.autoSync = false;
          this.printSyncState();
          break;

        case "autosync":
        case "\\a":
          this.autoSync = true;
          this.printSyncState();
          break;

        case "help":
        case "\\?":
        case "?":
        case "":
          this.printHelp();
          break;

        case "info":
        case "\\i":
          const c = await this.app.refreshConnectedMoatInfo();
          if (c) this.app.printMoatInfo();
          else console.log("ERROR: KwilDB moat not connected");
          break;

        case "connect":
        case "conn":
        case "\\r":
          const moatConfig = await this.app.promptForMoatConfig();
          await this.app.connectToMoat(moatConfig, false);
          break;

        // pass these commands through the callback function
        case "test":
          console.log(answers);
          this.cb(answers.cmd);
          break;

        // everything else is an SQL statement to execute
        default:
          const q = answers.cmd;

          // require statements always end with ";"
          const regexStatementEnd = /;$/;
          if (!regexStatementEnd.test(q)) {
            console.log("ERROR: SQL commands must end in ';'");
            break;
          }

          // require connection to kwildb moat
          if (!this.app.getConnectedMoatName()) {
            console.log("ERROR: KwilDB moat not connected. Use 'connect'.");
            break;
          }

          const sync = this.autoSync ? testAutoSync(q) : this.sync;
          if (this.autoSync) console.log("^ sync:", sync);

          let r = await this.app.query(q, sync, {
            ...this.app.options,
            debug: this.debug,
            outputFile: this.record ? this.app.options.outputFile : "",
          });
          if (isError(r)) console.log("SQL ERROR:", r.response.data);
          else if (r.rows) console.log(r.rows);
          break;
      }
      await this.prompt();
    } catch (error) {
      this.cb("ERROR", error);
    }
  }
}

module.exports = KwilDBTerminal;
