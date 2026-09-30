#!/usr/bin/env bash
# First-run checks against a RUNNING QuizMaster API in Development, started on an EMPTY database with default settings
# (no SeedOptions__DemoSchool): the only thing in it must be the platform administrator, and it must be able to bring a
# school into being. Unlike smoke.sh it signs in for real (POST /auth/sign-in) — no dev tokens, no demo accounts.
#
#   docker compose up -d sqlserver
#   dotnet run --project src/Services/QuizMaster/QuizMaster.API       # migrates; creates the platform administrator
#   bash tests/smoke/first-run.sh                                     # API_URL=http://localhost:4401 by default
#
# It onboards one school, so run it on a fresh database (see smoke.sh for how to drop one).
# Needs: curl, jq.
set -u
API="${API_URL:-http://localhost:4401}/api"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
PASSED=0; FAILED=0

check() {
  if [ "$2" = "$3" ]; then PASSED=$((PASSED + 1)); echo "PASS  $1"
  else FAILED=$((FAILED + 1)); echo "FAIL  $1: expected $2, got $3 -> $(head -c 300 "$WORK/out.json")"; fi
}
json() { jq -r "$1" "$WORK/out.json"; }
anon() { # method path json-body -> status
  curl -s -o "$WORK/out.json" -w "%{http_code}" -X "$1" -H "Content-Type: application/json" -d "$3" "$API$2"
}
bearer() { # access-token method path [json-body] -> status
  local args=(-s -o "$WORK/out.json" -w "%{http_code}" -X "$2" -H "Authorization: Bearer $1")
  [ -n "${4:-}" ] && args+=(-H "Content-Type: application/json" -d "$4")
  curl "${args[@]}" "$API$3"
}

echo "== an empty database holds one account: the platform administrator"
check "the platform administrator signs in with the first-run password" 200 \
  "$(anon POST /auth/sign-in '{"email":"platform@quizmasterpro.local","password":"@dminP@$$w0rd"}')"
PLATFORM=$(json .accessToken)
check "and belongs to no school" "PLATFORM_ADMIN null" "$(bearer "$PLATFORM" GET /me >/dev/null; json '"\(.user.roles | join(",")) \(.tenant)"')"
check "there are no schools yet" 0 "$(bearer "$PLATFORM" GET /platform/tenants >/dev/null; json '.items | length')"
check "the demo accounts do not exist" 401 "$(anon POST /auth/sign-in '{"email":"admin@demo-school.local","password":"password"}')"

echo "== the platform administrator brings a school into being"
BODY='{"slug":"first_school","name":"First School","plan":"Trial","adminEmail":"head@first-school.test"}'
check "onboard a school" 201 "$(bearer "$PLATFORM" POST /platform/tenants "$BODY")"
ADMIN_PASSWORD=$(json .generatedPassword)
check "its administrator signs in with the generated password" 200 \
  "$(anon POST /auth/sign-in "$(jq -nc --arg p "$ADMIN_PASSWORD" '{email: "head@first-school.test", password: $p}')")"
ADMIN=$(json .accessToken)
check "the new school holds its administrator and nobody else" 1 "$(bearer "$ADMIN" GET /users >/dev/null; json .totalCount)"
check "no quizzes" 0 "$(bearer "$ADMIN" GET /quizzes >/dev/null; json '.quizzes | length')"
check "no homework" 0 "$(bearer "$ADMIN" GET /assignments >/dev/null; json '.assignments | length')"
check "no participations" 0 "$(bearer "$ADMIN" GET /participations >/dev/null; json .totalCount)"

echo
echo "$PASSED passed, $FAILED failed"
[ "$FAILED" -eq 0 ]
