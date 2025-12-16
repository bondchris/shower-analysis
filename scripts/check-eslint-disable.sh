#!/bin/bash

# Configuration
WHITELIST_FILE=".eslint-disable-whitelist"

MATCHES_FILE=$(mktemp)

# Find all eslint-disable occurrences in relevant directories (src, tests)
# We search for "eslint-disable" or "eslint-disable-next-line" or "eslint-disable-line"
# -r: recursive
# -n: line number
# -E: extended regex
# -I: ignore binary
if grep -rnEI "eslint-disable" src tests > "$MATCHES_FILE"; then
  FOUND_ANY=true
else
  FOUND_ANY=false
fi

# If we found matches, check against whitelist
if [ "$FOUND_ANY" = true ]; then
  if [ -f "$WHITELIST_FILE" ]; then
    # Use grep -v -f to remove lines that match any pattern in the whitelist
    # -F: fixed string match (safer for simple paths/content)
    # -f: file containing patterns
    # We need to be careful. The whitelist might contain file paths or line content.
    # Let's assume whitelist contains file paths or specific signatures.
    # But grep results look like: "src/file.ts:10: content"

    # Filter
    # Filter
    # Pre-process whitelist to ignore empty lines and comments (#)
    # matching an empty line in grep -f causes it to match EVERYTHING (filtering out all errors)
    CLEAN_WHITELIST=$(mktemp)
    grep -vE '^\s*($|#)' "$WHITELIST_FILE" > "$CLEAN_WHITELIST"

    if [ -s "$CLEAN_WHITELIST" ]; then
        grep -vFf "$CLEAN_WHITELIST" "$MATCHES_FILE" > "${MATCHES_FILE}.filtered"
        mv "${MATCHES_FILE}.filtered" "$MATCHES_FILE"
    fi
    rm "$CLEAN_WHITELIST"

    # Re-check count
    if [ -s "$MATCHES_FILE" ]; then
      REMAINING=true
    else
      REMAINING=false
    fi
  else
    REMAINING=true
  fi

  if [ "$REMAINING" = true ]; then
    echo "❌ ERROR: Found unapproved eslint-disable statements:"
    echo "---------------------------------------------------"
    cat "$MATCHES_FILE"
    echo "---------------------------------------------------"
    echo "Please remove these suppressions."
    echo "If strictly necessary, add the full error line (or unique substring) to '$WHITELIST_FILE'."
    rm "$MATCHES_FILE"
    exit 1
  fi
fi

echo "✅ SUCCESS: No unapproved eslint-disable statements found."
rm "$MATCHES_FILE"
exit 0
