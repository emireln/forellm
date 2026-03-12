#!/bin/sh
# Push ForeLLM to https://github.com/emireln/forellm
# Run from project root: bash push-to-github.sh  (or ./push-to-github.sh on macOS/Linux)

set -e
cd "$(dirname "$0")"

if [ ! -d .git ]; then
  git init
  git add .
  git commit -m "Initial commit: ForeLLM by Emir Lima"
  git branch -M main
  git remote add origin https://github.com/emireln/forellm.git
  git push -u origin main
else
  git add .
  git status
  echo ""
  echo "Repo already initialized. To push:"
  echo "  git remote add origin https://github.com/emireln/forellm.git   # only if not already added"
  echo "  git commit -m 'Your message'   # if you have changes"
  echo "  git push -u origin main"
fi
