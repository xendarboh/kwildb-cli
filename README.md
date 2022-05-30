# kwildb-cli

[Kwil Database](https://kwil.com/) Interactive Terminal, Command-Line Client, and
Database Import Tool.

`kwildb-cli` is a terminal-based front-end to Kwil Database supporting
interactive and non-interactive use. It is conceptually modeled after
[mysql](https://dev.mysql.com/doc/refman/8.0/en/mysql.html) and
[psql](https://www.postgresql.org/docs/current/app-psql.html) terminal clients
for a familiar developer experience. It enables you to type in queries
interactively, issue them to a Kwil Database (optionally syncing to the
blockchain), and see the query results. SQL input can be read from a file as a
database import tool. A configuration wizard allows Kwil Data Moat
configurations to be easily created and quickly restored.

## Installation

```sh
$ npm install --global kwildb-cli
```

## Features

- KwilDB moat connection configuration creation and selection wizard
- three modes of kwildb query sync; enabled, disabled, and auto
- optionally record failed SQL statements to file
- optionally record query results to file
- interactive terminal
  - command autocompletion and history
  - show moat funding and data usage
  - toggle options: sync, debug, results recording
  - meta-commands
- non-interactive database import (migration tool)
  - import and execute SQL statements from database dump files
  - real-time monitoring of import progress, moat funding, and data usage
  - `--limit` option to assist large database imports
  - `--offset` option to continue partial imports
  - record failed SQL statements to file, optionally exit upon error

## Usage

```
$ kwildb-cli --help
Usage: kwildb-cli [options]... [moat]

KwilDB Terminal Client and Database Import Tool

Arguments:
  moat                          KwilDB moat to connect to

Options:
  -c, --config-dir <directory>  the directory for configuration files (default: "./config")
  -i, --input-file <file>       read SQL statements from a file
  -f, --error-file <file>       write failed statements to a file
  -o, --output-file <file>      write query results to a file
      --limit <count>           limit number of executed statements
      --offset <offset>         execute statements from the given offset (default: 0)
  -n, --dry-run                 perform a trial run without statement execution (default: false)
  -e, --exit-on-error           exit if an error is encountered sending SQL (default: false)
      --sync                    sync queries (default: false)
      --no-sync                 do not sync queries
      --auto-sync               sync write statements and do not sync reads (default: false)
  -V, --version                 output the version number
  -d, --debug                   turn on debug output (default: false)
  -h, --help                    display help for command
```

## Moat Configuration Wizard

Both terminal and database import modes use moat configuration files that are
created and read from a configuration directory, `./config` by default or set
by `--config-dir`.

### Configure a moat

To configure a moat, launch `kwildb-cli` to start the terminal then type
`connect` (or `\r`) to connect to a moat. If moats have not yet been
configured, a series of input prompts will be presented. Press enter at a
prompt to accept the default. The terminal prompt shows the moat name to
indicate a successful connection.

```
$ kwildb-cli
Welcome to KwilDB Terminal Client and Database Import Tool. kwildb-cli (0.0.0)
Type 'help' or '?' for help.

? KwilDB [(none)]> connect
? KwilDB moat name moat1234
? KwilDB host test-db.kwil.xyz
? KwilDB port
? KwilDB protocol https
? KwilDB secret ********************************
? KwilDB private key ***************************

? KwilDB [moat1234]>
```

### Connect to a configured moat

If moats have already been configured, select one to connect to from a list
(with `UP`/`DOWN` arrow keys or fuzzy search) or opt to create a new one.

```
? KwilDB [(none)]> connect
? Select KwilDB moat configuration or create a new one (Press <enter> to submit)
❯ moat1234
  project36production
  project36testing
  <new>
```

Pass a configured moat name as an argument to `kwildb-cli` to connect to that
moat. Required by `--input-file`.

```
$ kwildb-cli moat1234
Welcome to KwilDB Terminal Client and Database Import Tool. kwildb-cli (0.0.0)
Type 'help' or '?' for help.

? KwilDB [moat1234]>
```

## Terminal Client

The terminal will be invoked unless the `--input-file` option is used.

### Usage

Type `help` (or `\?`) to see available terminal meta-commands and current state
of terminal options.

```
? KwilDB [(none)]> help
commands:
  help     (\?) display this help
  connect  (\r) (re)connect to moat host
  debug    (\D) enable debug output
  nodebug  (\d) disable debug output
  exit     (\q) same as quit
  info     (\i) display info for the connected moat
  record   (\O) enable record results to output file
  norecord (\o) disable record results to output file
  sync     (\S) enable kwildb query sync
  nosync   (\s) disable kwildb query sync
  autosync (\a) enable sync for writes, disable for reads
  quit     (\q) quit kwildb-cli
options:
  record : off
  debug  : off
  sync   : off

? KwilDB [(none)]>
```

### Command Auto-Completion

Type `Tab` at the terminal prompt to see and auto-complete available commands.

```
? KwilDB [moat1234]>
>> Available commands:
\?          \D          \O          \S          \a          \d
\i          \o          \q          \q          \r          \s
autosync    connect     debug       exit        help        info
nodebug     norecord    nosync      quit        record      sync
? KwilDB [moat1234]>
```

### Command History

Use `UP` and `DOWN` keyboard keys to cycle through command history.

### SQL Queries

Terminal input that is not a terminal meta-command, is passed to the connected
moat as a SQL statement.

```
? KwilDB [moat1234]> SELECT * FROM users ORDER BY uid ASC LIMIT 2;
[
  {
    uid: 0,
    uuid: '38f1d8a4-8a04-43cf-ac5c-16f2d3eef26e',
  },
  {
    uid: 1,
    uuid: 'f00ee027-6fc4-41b2-945c-113b191f369b',
  }
]
? KwilDB [moat1234]>
```

### Terminal Options

The terminal maintains state for some options that default to the values set
from the command-line and may be changed while using the terminal. For example,
use `sync`, `nosync`, and `autosync` commands to change the sync option. Type
`help` to see the current option values.

```
? KwilDB [moat1234]> sync
  sync   : on
? KwilDB [moat1234]> nosync
  sync   : off
? KwilDB [moat1234]> autosync
  sync   : auto
? KwilDB [moat1234]>
```

### Moat info

Use the `info` terminal command to display information about a connected moat.

```
? KwilDB [moat1234]> info
moat:     moat1234
host:     test-db.kwil.xyz
protocol: https
engine:   PostgreSQL 12.11
Moat Data Usage  [████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░]  10% | 24.60 MB / 226.24 MB
Moat Funds Usage [████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░]  10% | 0.27 USD / 2.50 USD
```

## Database Import

### Goal & Project Scope

`kwildb-cli` strives to provide a lossless fault-tolerant production-grade kwil
database import solution suitable for seamless transfer of large and advanced
databases with an interface familiar to database operators. As such, this tool
targets the use case of importing databases from SQL dump files that more
closely match the underlying [Database
Engine](https://docs.kwil.com/architecture/node#database-engine) used by [Kwil
Nodes](https://docs.kwil.com/architecture/node) of the target moat. The broad
and potentially complex task of converting from one type of database to another
is beyond the scope of `kwildb-cli` and is left to better suited existing
tools.

By default, Kwil nodes are equipped with a standard relational database and are
currently running PostgreSQL, however virtually any type of database engine
(even non-relational) can be used. Use the `kwildb-cli` [moat info](#moat-info)
command for insight into the underlying database engine of the connected moat.
If your source database to migrate to KwilDB is not PostgreSQL, refer to this
list of solutions for [Converting from other Databases to
PostgreSQL](https://wiki.postgresql.org/wiki/Converting_from_other_Databases_to_PostgreSQL)
in preparation for importing the database with `kwildb-cli`. In this manner,
`kwildb-cli` can reliably and completely import the entire database including
SQL functions, constraints, indexes, triggers, etc.

### Import Process

1. Use the [KwilDB Web App](https://db.kwil.com/) to create and fund a KwilDB
   moat to receive the migrating database.

2. Use the [Configuration Wizard](#moat-configuration-wizard) to configure the
   moat connection information, use the [Terminal](#moat-info) to ensure
   successful connection to the moat, then pass the moat by name as an argument
   to `kwildb-cli`.

3. Use [pg_dump](https://www.postgresql.org/docs/current/app-pgdump.html) to
   extract a PostgreSQL database into a file. The following `pg_dump`
   invocation illustrates an example set of working options, your preference
   may vary. owner is not supported by KwilDB as permissions are handled
   differently. comments are optional but are supported. `--rows-per-inserts=1`
   enables the `kwildb-cli` import process and real-time progress bar to have
   higher resolution than fewer `INSERT` statements which may be useful for
   importing a larger or more complex database.

```
$ pg_dump -U <database> \
  --clean \
  --if-exists \
  --no-owner \
  --no-privileges \
  --no-comments \
  --rows-per-insert=1 \
  > db.sql
```

4. Use `kwildb-cli` to import a database file specified by the `--input-file`
   (`-i`) option. In the following example, any failed statements will be logged
   to `./errors.sql` while statement processing will continue (since the
   `--exit-on-error` option was not given), and all queries will be synced to the
   blockchain.

```
$ kwildb-cli moat1234 --input-file ./db.sql --error-file ./errors.sql --sync
Moat Data Usage  [████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░]  10% | 24.60 MB / 226.24 MB
Moat Funds Usage [████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░]  10% | 0.27 USD / 2.50 USD
SQL Statements   [█████████████████████████████████░░░░░░░]  81% | ETA:  7m25s | 3950 / 4835
```

### Import Features

#### Real-time Monitoring

During the database import process, real-time progress bars are shown to
monitor the import progress as well as see the effects of the import on the
moat's data and funding usage.

The `SQL Statements` progress bar shows the current number of SQL statements
processed out of the total number of statements within the import file. Format
`<processed> / <total>`.

#### Partial Import & Fault-Tolerant Resume

The `kwildb-cli` `--limit` and `--offset` options use the conventions of SQL
`SELECT` syntax. For example, the default offset is `0` to start processing
from the 1st statement and `--offset 100` would continue processing from the
next statement after the 100th (ie statement `#101`) in an input file.

The `--limit` option may be used to limit the number of SQL statements of an
import file that will be sent to the kwildb moat. Additionally, in-progress
imports may be intentionally stopped with `ctrl+c`. Stopped or failed imports
may be resumed using `--offset`. Refer to the `SQL Statements` progress bar to
see the number of the last successfully executed SQL statement to resume from.

#### Other

Refer to the `kwildb-cli` [usage](#usage) for other options that may be helpful
for database imports, including `--dry-run` and `--exit-on-error`.

## TODO Ideas

- [ ] use kwildb websockets when available for potentially (much) faster imports
- [ ] process SQL statements from stdin
- [ ] option to persist terminal history between terminal invocations
- [ ] `history` terminal command to display terminal command history
