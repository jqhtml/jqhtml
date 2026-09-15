#!/bin/bash
################################################################################
# run-all-suites.sh - Run every JQHTML test suite and report one summary.
#
#   ./run-all-suites.sh                 # EVERY suite, browser included on all three engines (~8 min)
#   ./run-all-suites.sh --fast          # skip the browser suite (~15s)
#   ./run-all-suites.sh --build         # build packages first (unit tests read dist/)
#   ./run-all-suites.sh --quiet         # summary only; failing suites still print
#   ./run-all-suites.sh --browser=chromium  # browser suite on one engine only
#                                           # (default runs chromium, firefox AND webkit)
#
# Exits non-zero if any suite fails, so it is usable as a release gate.
#
# The browser suite runs BY DEFAULT. It is the primary suite per CLAUDE.md - real
# components in real Chrome across 3 cache modes - and it is the only layer that
# exercises runtime behaviour at all; the unit suites cannot see it. It takes roughly
# 7 minutes (2.5 per engine), so --fast still exists for the edit/run loop. "Run all tests" means all of
# them: a suite that is skipped by default is a suite nobody runs.
################################################################################

set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

WITH_BROWSER=1
BUILD=0
QUIET=0

for arg in "$@"; do
  case "$arg" in
    # JQHTML_FAST also reaches suites that gate their own slow tiers - the
    # vscode extension host, for one.
    --fast|--no-browser) WITH_BROWSER=0; export JQHTML_FAST=1 ;;
    --browser=*)         export JQHTML_BROWSER="${arg#--browser=}" ;;   # one engine instead of chromium+firefox
    --build)             BUILD=1 ;;
    --quiet|-q)          QUIET=1 ;;
    -h|--help)           sed -n '4,10p' "$0"; exit 0 ;;
    *) echo "Unknown argument: $arg" >&2; exit 1 ;;
  esac
done

BOLD=$'\e[1m'; RED=$'\e[31m'; GREEN=$'\e[32m'; YELLOW=$'\e[33m'; GRAY=$'\e[90m'; OFF=$'\e[0m'

names=(); results=(); durations=()
failed_total=0

run_suite() {
  local name="$1" dir="$2"; shift 2

  echo
  echo "${BOLD}=== $name ===${OFF}"
  echo "${GRAY}\$ (cd $dir && $*)${OFF}"

  local start=$SECONDS output status
  if [ "$QUIET" -eq 1 ]; then
    output="$( cd "$ROOT/$dir" && "$@" 2>&1 )"; status=$?
    # A failing suite prints regardless: a summary line is not enough to act on.
    [ $status -ne 0 ] && echo "$output"
  else
    ( cd "$ROOT/$dir" && "$@" 2>&1 ); status=$?
  fi
  local elapsed=$((SECONDS - start))

  names+=("$name"); durations+=("${elapsed}s")
  if [ $status -eq 0 ]; then
    results+=("pass")
    echo "${GREEN}--- $name: PASS (${elapsed}s)${OFF}"
  else
    results+=("FAIL")
    failed_total=$((failed_total + 1))
    echo "${RED}--- $name: FAIL (${elapsed}s, exit $status)${OFF}"
  fi
}

# Unit suites import from each package's dist/, so a stale or missing build makes
# them test the previous version of the compiler without saying so.
if [ "$BUILD" -eq 1 ]; then
  echo "${BOLD}=== Building packages ===${OFF}"
  for pkg in parser core ssr; do
    [ -f "packages/$pkg/package.json" ] || continue
    grep -q '"build"' "packages/$pkg/package.json" || continue
    ( cd "packages/$pkg" && npm run build ) || { echo "${RED}build failed: $pkg${OFF}"; exit 1; }
  done
else
  for pkg in parser core; do
    if [ ! -d "packages/$pkg/dist" ]; then
      echo "${YELLOW}WARNING: packages/$pkg/dist is missing - unit tests read from it. Run with --build.${OFF}"
    fi
  done
fi

run_suite "parser: unit (jest)"      packages/parser npm test
run_suite "parser: regression corpus" packages/parser npm run test:regression
run_suite "parser: sourcemap"        packages/parser npm run validate:sourcemap
run_suite "core: unit (jest)"        packages/core   npm test
run_suite "ssr: protocol + render"   packages/ssr    npm test
run_suite "vscode: extension"        packages/vscode-extension npm test

run_suite "docs: example compilation" . npm run validate:docs

if [ "$WITH_BROWSER" -eq 1 ]; then
  echo
  echo "${YELLOW}The browser suite runs every test x 3 cache modes on chromium, firefox AND webkit (~7 min).${OFF}"
  echo "${GRAY}Use --fast to skip it, or --browser=chromium for the ~2.5 minute single-engine pass.${OFF}"
  run_suite "browser: behavioural (${JQHTML_BROWSER:-chromium + firefox + webkit})" tests ./run-all-tests.sh
fi

echo
echo "============================================================"
echo "${BOLD}Test suite summary${OFF}"
echo
for i in "${!names[@]}"; do
  if [ "${results[$i]}" = "pass" ]; then
    printf "  ${GREEN}%-6s${OFF} %-32s %s\n" "PASS" "${names[$i]}" "${durations[$i]}"
  else
    printf "  ${RED}%-6s${OFF} %-32s %s\n" "FAIL" "${names[$i]}" "${durations[$i]}"
  fi
done
echo

if [ "$WITH_BROWSER" -eq 0 ]; then
  echo "${YELLOW}  Browser suite SKIPPED (--fast). It is the only layer covering runtime${OFF}"
  echo "${YELLOW}  behaviour - run without --fast before committing or releasing.${OFF}"
  echo "${YELLOW}  The vscode extension-host tier was skipped too (JQHTML_FAST=1).${OFF}"
fi

echo
if [ "$failed_total" -eq 0 ]; then
  echo "${GREEN}${BOLD}All ${#names[@]} suites passed.${OFF}"
  exit 0
fi
echo "${RED}${BOLD}$failed_total of ${#names[@]} suites failed.${OFF}"
exit 1
