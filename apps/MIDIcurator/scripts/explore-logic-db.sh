#!/bin/bash
# Explore the Logic Loops Database using sqlite3 CLI.
#
# Usage:
#   bash scripts/explore-logic-db.sh [path-to-db]

DB_PATH="${1:-./LogicLoopsDatabaseV11.db}"

if [ ! -f "$DB_PATH" ]; then
  # Try default location
  DB_PATH="$HOME/Music/Audio Music Apps/Databases/LogicLoopsDatabaseV11.db"
fi

if [ ! -f "$DB_PATH" ]; then
  echo "Database not found."
  echo "Tried: ./LogicLoopsDatabaseV11.db"
  echo "       ~/Music/Audio Music Apps/Databases/LogicLoopsDatabaseV11.db"
  echo ""
  echo "Usage: bash explore-logic-db.sh <path-to-db>"
  exit 1
fi

echo "Using database: $DB_PATH"
echo ""
echo "======================================================================"
echo "DATABASE SCHEMA"
echo "======================================================================"

# List tables
echo ""
echo "Tables:"
sqlite3 "$DB_PATH" "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;" | sed 's/^/  /'

echo ""
echo "======================================================================"
echo "TABLE SCHEMAS"
echo "======================================================================"

# For each table, show schema
for table in $(sqlite3 "$DB_PATH" "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;"); do
  row_count=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM $table;")
  echo ""
  echo "$table ($row_count rows)"
  echo "----------------------------------------------------------------------"
  sqlite3 "$DB_PATH" "PRAGMA table_info($table);" | awk -F'|' '{printf "  %s: %s\n", $2, $3}'
done

echo ""
echo "======================================================================"
echo "CHORD-RELATED FIELDS"
echo "======================================================================"

# Search for chord-related columns
for table in $(sqlite3 "$DB_PATH" "SELECT name FROM sqlite_master WHERE type='table';"); do
  schema=$(sqlite3 "$DB_PATH" "PRAGMA table_info($table);" | awk -F'|' '{print $2}' | grep -iE 'chord|key|scale|note|root')

  if [ -n "$schema" ]; then
    echo ""
    echo "$table:"
    echo "$schema" | sed 's/^/  /'
  fi
done

echo ""
echo "======================================================================"
echo "SAMPLE DATA FROM KEY TABLES"
echo "======================================================================"

# Try to find metadata tables
for table in $(sqlite3 "$DB_PATH" "SELECT name FROM sqlite_master WHERE type='table' AND (name LIKE '%loop%' OR name LIKE '%file%' OR name LIKE '%asset%') ORDER BY name;"); do
  echo ""
  echo "$table (first 3 rows):"
  echo "----------------------------------------------------------------------"
  sqlite3 -header -column "$DB_PATH" "SELECT * FROM $table LIMIT 3;"
done

echo ""
echo "======================================================================"
