#!/usr/bin/env bash
# Push the current branch to origin, surviving the race where another workflow
# lands a commit on the same branch first.
#
# Every committing workflow in this repo pushes to main, and several overlap in
# time by design: publish-social fires on push (so it runs *while* whatever
# pushed is still finishing), vendor-outreach runs 15:15 daily, and the
# insights pair runs 09:00/13:30. A loser gets "! [rejected] (fetch first)" and
# the whole job fails with its work already committed locally and then thrown
# away — that is how publish-social died on 2026-08-17.
#
# Rebasing rather than merging keeps main linear, and matters for correctness
# here: these jobs append to data files (ledgers, generated JSON), so replaying
# our commit on top of theirs is what preserves both sides' writes.
#
# Usage: scripts/ci/git-push-retry.sh
# Env:   PUSH_ATTEMPTS (default 5)

set -euo pipefail

BRANCH="${GITHUB_REF_NAME:-$(git rev-parse --abbrev-ref HEAD)}"
ATTEMPTS="${PUSH_ATTEMPTS:-5}"

for attempt in $(seq 1 "$ATTEMPTS"); do
  if git push origin "HEAD:${BRANCH}"; then
    echo "Pushed to ${BRANCH} on attempt ${attempt} of ${ATTEMPTS}."
    exit 0
  fi

  if [ "$attempt" -eq "$ATTEMPTS" ]; then
    break
  fi

  delay=$((2 ** attempt))
  echo "::warning::Push to ${BRANCH} was rejected (attempt ${attempt} of ${ATTEMPTS}) — someone else pushed first. Rebasing onto origin/${BRANCH} in ${delay}s, then retrying."
  sleep "$delay"

  # A conflict means two jobs edited the same lines, which no amount of
  # retrying will settle. Abort so the workspace is left clean and say so,
  # rather than looping until the attempts run out on a stuck rebase.
  if ! git pull --rebase origin "$BRANCH"; then
    git rebase --abort || true
    echo "::error::Rebasing onto origin/${BRANCH} hit a conflict, so this run's commit cannot be replayed automatically. Its work is NOT on ${BRANCH} — reconcile the two changes by hand."
    exit 1
  fi
done

echo "::error::Could not push to ${BRANCH} after ${ATTEMPTS} attempts. This run's commit is NOT on ${BRANCH}."
exit 1
