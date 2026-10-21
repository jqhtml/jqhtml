#!/bin/bash
# A runtime error in the second of two expressions on one line maps, via the compiled
# template's inline sourcemap, to that expression's line and column (see check.mjs).
cd "$(dirname "$0")"
exec node check.mjs
