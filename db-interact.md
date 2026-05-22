# Database Interaction Guide

This project uses an SQLite database to store metadata for custom trained voices. The database file is located at `data/metadata.db`.

This guide provides instructions on how to access the database, list tables, and run queries using the `sqlite3` command-line interface.

## Prerequisites

You need to have the `sqlite3` command-line tool installed on your system.

### Installation

*   **Linux (Ubuntu/Debian):** `sudo apt-get install sqlite3`
*   **macOS:** macOS comes with `sqlite3` pre-installed. Alternatively, use Homebrew: `brew install sqlite`
*   **Windows:** Download the precompiled binaries from the [SQLite Download Page](https://www.sqlite.org/download.html) and add them to your system's PATH.

## Connecting to the Database

To connect to the SQLite database, open your terminal, navigate to the root directory of the project, and run the following command:

```bash
sqlite3 data/metadata.db
```

If the connection is successful, you will see the SQLite prompt (`sqlite>`).

## Listing Tables

Once connected to the database, you can list all the available tables by running the `.tables` command:

```sqlite
sqlite> .tables
```

This should output `voices`, which is the main table used in this application.

## Running SELECT Queries

You can execute standard SQL queries to view the data. Don't forget to end your SQL statements with a semicolon (`;`).

### View all records in the `voices` table

```sqlite
sqlite> SELECT * FROM voices;
```

This will display all columns for every row in the `voices` table.

### View specific columns

If you only want to see specific information, such as the voice name and the file path:

```sqlite
sqlite> SELECT voice_name, file_path FROM voices;
```

### Formatting Output

To make the output easier to read, you can turn on headers and set the output mode to column:

```sqlite
sqlite> .headers on
sqlite> .mode column
sqlite> SELECT * FROM voices;
```

## Exiting the Database

To exit the `sqlite3` prompt and return to your regular terminal, use the `.quit` or `.exit` command:

```sqlite
sqlite> .quit
```
