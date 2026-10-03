#!/usr/bin/env bash
# End-to-end checks against a RUNNING QuizMaster API in Development, on a FRESHLY SEEDED database
# (the homework checks submit once; a second run finds the assignment already submitted).
#
#   docker compose up -d sqlserver
#   SeedOptions__DemoSchool=true dotnet run --project src/Services/QuizMaster/QuizMaster.API   # migrates; seeds the demo school
#   bash tests/smoke/smoke.sh                                         # API_URL=http://localhost:4401 by default
#
# Fresh database: docker compose exec sqlserver /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P 'LocalDev_Passw0rd!' -C -Q "DROP DATABASE QuizMaster", then restart the API (it recreates it).
# Needs: curl, jq. Request bodies are built with jq: macOS bash 3.2 mis-parses JSON braces nested in "$( ... )".
set -u
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
API="${API_URL:-http://localhost:4401}/api"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
PASSED=0; FAILED=0

dotnet build "$ROOT/tools/QuizMasterPro.DevToken" -v q >/dev/null
for uid in dev-admin dev-teacher dev-parent dev-student dev-student-2 dev-platform; do
  dotnet run --no-build --project "$ROOT/tools/QuizMasterPro.DevToken" -- --uid "$uid" --minutes 30 > "$WORK/token-$uid"
done

call() { # user method path [json-body] -> prints the status code; body in $WORK/out.json
  local user=$1 method=$2 path=$3 body=${4:-}
  local args=(-s -o "$WORK/out.json" -w "%{http_code}" -X "$method" -H "Authorization: Bearer $(cat "$WORK/token-$user")")
  [ -n "$body" ] && args+=(-H "Content-Type: application/json" -d "$body")
  curl "${args[@]}" "$API$path"
}
check() { # label expected actual
  if [ "$2" = "$3" ]; then PASSED=$((PASSED + 1)); echo "PASS  $1"
  else FAILED=$((FAILED + 1)); echo "FAIL  $1: expected $2, got $3 -> $(head -c 300 "$WORK/out.json")"; fi
}
json() { jq -r "$1" "$WORK/out.json"; }

echo "== identity and roles"
for uid in dev-admin dev-teacher dev-parent dev-student; do check "GET /me as $uid" 200 "$(call $uid GET /me)"; done
check "no token is 401" 401 "$(curl -s -o "$WORK/out.json" -w "%{http_code}" "$API/me")"
call dev-student GET /me >/dev/null; STUDENT_ID=$(json .user.id)

echo "== sitting a quiz never exposes the answers"
check "student lists quizzes" 200 "$(call dev-student GET /quizzes)"
QUIZ=$(json '.quizzes[] | select(.name=="Science Basics") | .id')
OTJ=$(json '.quizzes[] | select(.name=="One Time Join Check") | .id')
check "student gets the sitting" 200 "$(call dev-student GET /quizzes/$QUIZ/sitting)"
check "sitting carries no answer data" 0 "$(grep -ciE 'correct|referenceAnswer|"key"' "$WORK/out.json")"
Q=($(json '.questions[].questionId'))
check "student cannot browse the bank" 403 "$(call dev-student GET /questions)"
check "a teacher can browse the bank (to copy from it)" 200 "$(call dev-teacher GET /questions)"

echo "== server-side grading"
BODY=$(jq -nc --argjson quiz "$QUIZ" --argjson q0 "${Q[0]}" --argjson q1 "${Q[1]}" --argjson q2 "${Q[2]}" --argjson q3 "${Q[3]}" \
  '{bankQuizId: $quiz, responses: [
     {questionId: $q0, selectedOptionId: 1}, {questionId: $q1, selectedOptionId: 1},
     {questionId: $q2, blanks: [{index: 0, userAnswer: "Photosynthesis"}, {index: 1, userAnswer: "sunlight"}]},
     {questionId: $q3, responseText: "<p>The axis is tilted.</p>"}]}')
check "submit practice quiz" 201 "$(call dev-student POST /submissions "$BODY")"
check "two auto-graded answers right, weighted 53%" "2 53 2" "$(json '"\(.score) \(.scorePercent) \(.pendingReviewCount)"')"
# worth 26.67% (Explain takes 20, three questions share 80), so marked out of 27 points: half of 27 = 13.5 → 14 points
check "Complete suggestion is pro rata (1 of 2 blanks)" 14 "$(json '.answers[2].suggestedAward')"
PID=$(json .participationId)

echo "== a teacher's students"
check "a teacher lists the students of the classes they teach" 200 "$(call dev-teacher GET /me/students)"
check "the practice quiz counts as one quiz, no homework" "1 0" \
  "$(jq -r --argjson id "$STUDENT_ID" '.students[] | select(.student.id == $id) | "\(.quizCount) \(.homeworkCount)"' "$WORK/out.json")"
check "a student cannot list students" 403 "$(call dev-student GET /me/students)"
check "a parent cannot list students" 403 "$(call dev-parent GET /me/students)"
check "an administrator is not a teacher here" 403 "$(call dev-admin GET /me/students)"

echo "== who may read and review it"
check "owner reads it" 200 "$(call dev-student GET /participations/$PID)"
check "parent reads their child's" 200 "$(call dev-parent GET /participations/$PID)"
check "classmate cannot" 403 "$(call dev-student-2 GET /participations/$PID)"
check "student cannot review" 403 "$(call dev-student-2 POST /participations/$PID:review '{"status":"Approved","marks":[]}')"
check "teacher's review queue" 200 "$(call dev-teacher GET /reviews)"
BODY=$(jq -nc --argjson q2 "${Q[2]}" --argjson q3 "${Q[3]}" \
  '{status: "Approved", marks: [{questionId: $q2, awardedPercent: 20}, {questionId: $q3, awardedPercent: 15, comment: "Mention the sun angle"}]}')
check "teacher marks and approves" 200 "$(call dev-teacher POST /participations/$PID:review "$BODY")"
BODY=$(jq -nc --argjson q3 "${Q[3]}" '{status: "Approved", marks: [{questionId: $q3, awardedPercent: 99}]}')
check "a mark above the answer's weight is refused" 400 "$(call dev-teacher POST /participations/$PID:review "$BODY")"
call dev-student GET /participations/$PID >/dev/null
check "score rises to 88% with nothing pending" "88 0" "$(json '"\(.participation.scorePercent) \(.participation.pendingReviewCount)"')"

echo "== notifications, sent by the server"
call dev-parent GET /me/notifications >/dev/null
check "the parent hears their child finished" "SubmissionCompleted Sara Student $PID 1" "$(json '"\(.notifications[0].type) \(.notifications[0].childName) \(.notifications[0].participationId) \(.unreadCount)"')"
call dev-teacher GET /me/notifications >/dev/null
check "the reviewer hears two answers need marking" "SubmissionNeedsReview 2" "$(json '"\(.notifications[0].type) \(.notifications[0].pendingReviewCount)"')"
call dev-student GET /me/notifications >/dev/null
check "the student hears the verdict" "SubmissionApproved 1" "$(json '"\(.notifications[0].type) \(.unreadCount)"')"
NID=$(json '.notifications[0].id')
check "re-saving the same verdict" 200 "$(call dev-teacher POST /participations/$PID:review '{"status":"Approved","marks":[]}')"
call dev-student GET /me/notifications >/dev/null
check "does not notify the student twice" 1 "$(json '.notifications | length')"
check "nobody else can mark it read" 404 "$(call dev-student-2 POST /me/notifications/$NID:read)"
check "the student marks it read" 200 "$(call dev-student POST /me/notifications/$NID:read)"
call dev-student GET /me/notifications >/dev/null
check "nothing unread" "0 true" "$(json '"\(.unreadCount) \(.notifications[0].isRead)"')"
check "the teacher marks all read" 1 "$(call dev-teacher POST /me/notifications:read-all >/dev/null; json .markedCount)"

echo "== homework: answers withheld until due, one submission"
check "student's assignments" 200 "$(call dev-student GET /assignments)"
HW=$(json '.assignments[0].id')
HW_SHAPE=$(json '.assignments[0] | "\(.questionCount) \(.oneTimeJoin|type) \(.durationSeconds|type)"')
check "homework sitting" 200 "$(call dev-student GET /assignments/$HW/sitting)"
HQ=($(json '.questions[].questionId'))
check "an assignment carries its quiz's shape" "${#HQ[@]} boolean number" "$HW_SHAPE"
BODY=$(jq -nc --argjson hw "$HW" --argjson q0 "${HQ[0]}" --argjson q1 "${HQ[1]}" \
  '{homeworkId: $hw, responses: [{questionId: $q0, selectedOptionId: 1}, {questionId: $q1, selectedOptionId: 2}]}')
check "submit homework" 201 "$(call dev-student POST /submissions "$BODY")"
check "results withheld before the due date" "false 0 null" "$(json '"\(.resultsAvailable) \(.key|length) \(.answers[0].correctOptionId)"')"
HPID=$(json .participationId)
BODY=$(jq -nc --argjson hw "$HW" '{homeworkId: $hw, responses: []}')
check "second submission refused" 400 "$(call dev-student POST /submissions "$BODY")"
call dev-student GET /participations/$HPID >/dev/null
check "still withheld when read back by the student" "false null" "$(json '"\(.participation.resultsAvailable) \(.participation.answers[0].correctOptionId)"')"
call dev-teacher GET /participations/$HPID >/dev/null
check "visible to the teacher" true "$(json '.participation.resultsAvailable')"
call dev-teacher GET /me/notifications >/dev/null
check "the teacher hears of an auto-graded submission too" "SubmissionReceived $HPID 0 1" "$(json '"\(.notifications[0].type) \(.notifications[0].participationId) \(.notifications[0].pendingReviewCount) \(.unreadCount)"')"

echo "== One Time Join"
START=$(jq -nc --argjson quiz "$OTJ" '{bankQuizId: $quiz}')
check "start attempt" 200 "$(call dev-student POST /attempt-locks "$START")"; LOCK=$(json .id)
check "re-entry refused while blocking" 400 "$(call dev-student POST /attempt-locks "$START")"
check "exit recorded" 200 "$(call dev-student POST /attempt-locks/$LOCK:exit '{"reason":"Hidden"}')"
check "student cannot release" 403 "$(call dev-student POST /attempt-locks/$LOCK:release)"
check "teacher releases" 200 "$(call dev-teacher POST /attempt-locks/$LOCK:release)"
check "student starts again, clean" 200 "$(call dev-student POST /attempt-locks "$START")"
call dev-student GET /quizzes/$OTJ/sitting >/dev/null; OQ=($(json '.questions[].questionId'))
BODY=$(jq -nc --argjson quiz "$OTJ" --argjson q0 "${OQ[0]}" '{bankQuizId: $quiz, responses: [{questionId: $q0, selectedOptionId: 1}]}')
check "requiredAll enforced" 400 "$(call dev-student POST /submissions "$BODY")"
BODY=$(jq -nc --argjson quiz "$OTJ" --argjson q0 "${OQ[0]}" --argjson q1 "${OQ[1]}" \
  '{bankQuizId: $quiz, responses: [{questionId: $q0, selectedOptionId: 1}, {questionId: $q1, selectedOptionId: 1}]}')
check "submission" 201 "$(call dev-student POST /submissions "$BODY")"
call dev-student GET /attempt-locks/mine >/dev/null
check "submission released the lock" "Released" "$(json '.locks[0].status')"

echo "== administration"
check "admin creates a stage" 201 "$(call dev-admin POST /stages '{"name":"Preparatory","order":2}')"
check "teacher cannot" 403 "$(call dev-teacher POST /stages '{"name":"X","order":3}')"
check "dashboard stats" 200 "$(call dev-admin GET /dashboard/stats)"
check "the tiles include registration keys and students" "true" "$(json '.registrationKeys > 0 and .students > 0')"
call dev-admin GET /subjects >/dev/null; SCIENCE=$(json '.subjects[] | select(.name=="Science") | .id')
check "deleting a subject in use is a conflict" 409 "$(call dev-admin DELETE /subjects/$SCIENCE)"
check "the domain rejects an invalid question" 400 "$(call dev-admin POST /questions '{"type":"Complete","text":"No markers here"}')"
check "teacher cannot change roles" 403 "$(call dev-teacher PUT /users/$STUDENT_ID/roles '{"roles":["TEACHER"]}')"

echo "== question bank: bulk upload and reclassify"
call dev-admin GET '/questions?pageSize=1' >/dev/null; BANK_BEFORE=$(json .totalCount)
BULK='{"questions":[{"type":"Choose","text":"2 + 2 = ?","options":["3","4"],"correctOption":2,"semester":"First"},{"type":"RightWrong","text":"Ice is cold.","isRight":true,"semester":"First"}]}'
check "upload two questions at once" 200 "$(call dev-admin POST /questions/bulk "$BULK")"
Q1=$(json '.ids[0]'); Q2=$(json '.ids[1]')
BAD='{"questions":[{"type":"Choose","text":"Fine","options":["a","b"],"correctOption":1},{"type":"Choose","text":"Broken","options":["only one"],"correctOption":1}]}'
check "an upload with an invalid question is refused, naming it" "400 Question 2" "$(call dev-admin POST /questions/bulk "$BAD") $(json .Message | cut -c1-10)"
call dev-admin GET '/questions?pageSize=1' >/dev/null
check "and saves none of it" "$((BANK_BEFORE + 2))" "$(json .totalCount)"
call dev-admin GET /subjects >/dev/null; MATH=$(json '.subjects[] | select(.name=="Math") | .id')
check "reclassify both into Math" 2 "$(call dev-admin POST /questions:reclassify "$(jq -nc --argjson a "$Q1" --argjson b "$Q2" --argjson m "$MATH" '{questionIds:[$a,$b], subjectId:$m}')" >/dev/null; json .updatedCount)"
call dev-admin GET /questions/$Q2 >/dev/null
check "only the subject changed" "$MATH First Ice is cold." "$(json '"\(.question.subjectId) \(.question.semester) \(.question.name)"')"
check "a teacher cannot reclassify" 403 "$(call dev-teacher POST /questions:reclassify "$(jq -nc --argjson a "$Q1" '{questionIds:[$a], subjectId:1}')")"

echo "== subject tags: a question carries its own subject's topics"
call dev-admin GET /subjects >/dev/null
check "a subject lists its tags" "Fractions,Geometry" "$(json '.subjects[] | select(.name=="Math") | [.tags[].name] | join(",")')"
FRACTIONS=$(json '.subjects[] | select(.name=="Math") | .tags[] | select(.name=="Fractions") | .id')
GEOMETRY=$(json '.subjects[] | select(.name=="Math") | .tags[] | select(.name=="Geometry") | .id')
SPACE=$(json '.subjects[] | select(.name=="Science") | .tags[] | select(.name=="Space") | .id')
check "tag one question" 200 "$(call dev-admin PUT /questions/$Q1/tags "$(jq -nc --argjson t "$FRACTIONS" '{tagIds:[$t]}')")"
check "another subject's tag is refused" 400 "$(call dev-admin PUT /questions/$Q1/tags "$(jq -nc --argjson t "$SPACE" '{tagIds:[$t]}')")"
check "a teacher cannot tag bank questions" 403 "$(call dev-teacher PUT /questions/$Q1/tags '{"tagIds":[]}')"
check "bulk: add Geometry to both" 2 "$(call dev-admin POST /questions:retag "$(jq -nc --argjson a "$Q1" --argjson b "$Q2" --argjson g "$GEOMETRY" '{questionIds:[$a,$b], addTagIds:[$g]}')" >/dev/null; json .updatedCount)"
call dev-admin GET /questions/$Q1 >/dev/null
check "the other tags are kept" "$(jq -nc --argjson f "$FRACTIONS" --argjson g "$GEOMETRY" '[$f,$g] | sort')" "$(jq -c '.question.tagIds | sort' "$WORK/out.json")"
call dev-admin GET "/questions?tagId=$GEOMETRY&pageSize=50" >/dev/null
check "the bank filters by tag" "true" "$(json "[.items[].id] | (index($Q1) != null and index($Q2) != null)")"
TQ=$(jq -nc --argjson s "$SCIENCE" --argjson t "$SPACE" '{name:"Tagged", subjectId:$s, questions:[{type:"RightWrong", text:"The Sun is a star.", isRight:true, tagIds:[$t]}]}')
check "a teacher tags their own quiz's questions" 201 "$(call dev-teacher POST /teacher-quizzes "$TQ")"; TQ_ID=$(json .id)
call dev-teacher GET /teacher-quizzes/$TQ_ID >/dev/null
check "with the quiz subject's tags" "$SPACE" "$(json '.quiz.questions[0].tagIds[0]')"
call dev-admin GET "/teacher-quizzes?subjectId=$SCIENCE" >/dev/null
check "a teacher quiz's summary counts its questions" 1 "$(json ".quizzes[] | select(.id == $TQ_ID) | .questionCount")"
TQ_BAD=$(echo "$TQ" | jq -c --argjson g "$GEOMETRY" '.questions[0].tagIds = [$g]')
check "but not another subject's" 400 "$(call dev-teacher POST /teacher-quizzes "$TQ_BAD")"
RENAME=$(jq -nc --argjson f "$FRACTIONS" '{name:"Math", color:"#1565C0", tags:[{id:$f, name:"Fractions and decimals"}, {name:"Algebra"}]}')
check "rename one tag, add one, drop Geometry" 200 "$(call dev-admin PUT /subjects/$MATH "$RENAME")"
call dev-admin GET /questions/$Q1 >/dev/null
check "a renamed tag stays on its questions, a dropped one leaves them" "[$FRACTIONS]" "$(jq -c '.question.tagIds' "$WORK/out.json")"

echo "== deleting a teacher or subject leaves no id behind"
check "a subject" 201 "$(call dev-admin POST /subjects '{"name":"Geography"}')"; GEO=$(json .id)
check "a teacher of it" 201 "$(call dev-admin POST /teachers "$(jq -nc --argjson geo "$GEO" '{firstName:"Gina",lastName:"Geo",subjectIds:[$geo]}')")"; GINA=$(json .id)
call dev-admin GET /classes >/dev/null; CLS=$(json '.classes[0]')
CLS_ID=$(echo "$CLS" | jq .id)
BODY=$(echo "$CLS" | jq -c --argjson gina "$GINA" --argjson geo "$GEO" '{gradeId, name, teacherIds: (.teacherIds + [$gina]), subjectIds: (.subjectIds + [$geo])}')
check "both assigned to a class" 200 "$(call dev-admin PUT /classes/$CLS_ID "$BODY")"
check "delete the teacher" 200 "$(call dev-admin DELETE /teachers/$GINA)"
check "delete the subject" 200 "$(call dev-admin DELETE /subjects/$GEO)"
call dev-admin GET /classes >/dev/null
check "the class lists neither any more" "false false" "$(jq -r "[.classes[] | select(.id == $CLS_ID)][0] | \"\\(.teacherIds | index($GINA) != null) \\(.subjectIds | index($GEO) != null)\"" "$WORK/out.json")"

echo "== registration keys and accounts"
anon() { # method path [json-body] -> status; no token
  local args=(-s -o "$WORK/out.json" -w "%{http_code}" -X "$1")
  [ -n "${3:-}" ] && args+=(-H "Content-Type: application/json" -d "$3")
  curl "${args[@]}" "$API$2"
}
check "admin lists keys" 200 "$(call dev-admin GET '/registration-keys?status=Active&role=PARENT')"
OPEN_KEY=$(json '.items[0].code')
check "teacher cannot list keys" 403 "$(call dev-teacher GET /registration-keys)"
call dev-admin GET '/registration-keys?status=Used' >/dev/null
check "the family key reads as used" "1 1" "$(json '"\(.totalCount) \(.items[0].childCount)"')"
FAMILY_KEY=$(json '.items[0].code'); FAMILY_KEY_ID=$(json '.items[0].id')

MOBILE="01$(date +%s)"
BODY=$(jq -nc --arg code "$OPEN_KEY" --arg mobile "$MOBILE" '{code: $code, firstName: "Nadia", lastName: "New", mobileNumber: $mobile, password: "smoke-pass-1"}')
check "a parent registers with a key" 201 "$(anon POST /registrations "$BODY")"
check "the sign-in is the mobile number" "$MOBILE@mobile.local" "$(json .email)"
check "the same key cannot register a second family" 400 "$(anon POST /registrations "$(echo "$BODY" | jq -c '.mobileNumber = "0999111222"')")"
check "an unknown key is refused" 400 "$(anon POST /registrations "$(echo "$BODY" | jq -c '.code = "not-a-key"')")"
check "a signed-in caller cannot register" 400 "$(call dev-student POST /registrations "$(echo "$BODY" | jq -c '.mobileNumber = "0999111333"')")"

call dev-admin GET /classes >/dev/null; CLASS=$(json '.classes[0].id')
CHILD=$(jq -nc --arg code "$FAMILY_KEY" --argjson class "$CLASS" '{code: $code, firstName: "Kareem", lastName: "Kid", mobileNumber: "0100200300", password: "smoke-pass-1", classId: $class}')
check "a child registers with the family key" 201 "$(anon POST /registrations/child "$CHILD")"
CHILD_ID=$(json .userId)
call dev-parent GET /me/children >/dev/null
check "the child is linked to the parent" 1 "$(json "[.children[] | select(.id == $CHILD_ID)] | length")"
ADD=$(jq -nc --argjson class "$CLASS" '{firstName: "Lina", lastName: "Kid", mobileNumber: "0100200301", password: "smoke-pass-1", classId: $class}')
check "the parent adds the third child" 201 "$(call dev-parent POST /me/children "$ADD")"
check "the allowance of 3 is spent" 400 "$(call dev-parent POST /me/children "$(echo "$ADD" | jq -c '.mobileNumber = "0100200302"')")"
check "a student cannot add children" 403 "$(call dev-student POST /me/children "$ADD")"

call dev-parent GET /me >/dev/null
check "/me carries the family key, no problem" "3 null" "$(json '"\(.registrationKey.childCount) \(.registrationKeyProblem)"')"
check "admin deactivates the family key" 200 "$(call dev-admin PUT /registration-keys/$FAMILY_KEY_ID '{"isActive":false,"expiresOn":null,"maxChildren":3}')"
call dev-parent GET /me >/dev/null
check "/me reports the lapsed key" "Inactive" "$(json .registrationKeyProblem)"
check "a lapsed key suspends the family" 403 "$(call dev-parent GET /me/children)"
check "and the child" 403 "$(call dev-student GET /quizzes)"
check "admin reactivates it" 200 "$(call dev-admin PUT /registration-keys/$FAMILY_KEY_ID '{"isActive":true,"expiresOn":null,"maxChildren":3}')"
check "access is back on the next request" 200 "$(call dev-student GET /quizzes)"
check "a key held by accounts cannot be deleted" 409 "$(call dev-admin DELETE /registration-keys/$FAMILY_KEY_ID)"
check "the allowance cannot drop below the enrolled children" 400 "$(call dev-admin PUT /registration-keys/$FAMILY_KEY_ID '{"isActive":true,"expiresOn":null,"maxChildren":1}')"

check "admin creates a key" 201 "$(call dev-admin POST /registration-keys '{"role":"PARENT","expiresOn":"2030-01-01T00:00:00Z","maxChildren":2}')"
NEW_KEY=$(json .code); NEW_KEY_ID=$(json .id)
check "an unused key can be deleted" 200 "$(call dev-admin DELETE /registration-keys/$NEW_KEY_ID)"
check "a teacher key does not exist" 400 "$(call dev-admin POST /registration-keys '{"role":"TEACHER"}')"
check "admin creates a key for a parent account" 201 "$(call dev-admin POST /registration-keys '{"role":"PARENT","expiresOn":"2030-01-01T00:00:00Z","maxChildren":2}')"
PARENT_KEY=$(json .code)
BODY=$(jq -nc --arg code "$PARENT_KEY" '{kind: "Parent", firstName: "Hana", lastName: "Parent", mobileNumber: "0111222333", password: "smoke-pass-1", registrationKeyCode: $code}')
call dev-admin GET '/registration-keys?role=APPLICATION_ADMIN' >/dev/null; ADMIN_KEY=$(json '.items[0].code')
check "a parent cannot be created on an administrator key" 400 "$(call dev-admin POST /users "$(jq -nc --arg code "$ADMIN_KEY" '{kind: "Parent", firstName: "Wrong", lastName: "Key", mobileNumber: "0111000999", password: "smoke-pass-1", registrationKeyCode: $code}')")"
check "admin creates a parent on that key" 201 "$(call dev-admin POST /users "$BODY")"
NEW_PARENT=$(json .id)
BODY=$(jq -nc --argjson parent "$NEW_PARENT" --argjson class "$CLASS" '{kind: "Student", firstName: "Yara", lastName: "Kid", mobileNumber: "0111222334", password: "smoke-pass-1", parentId: $parent, classId: $class}')
check "admin enrols a student on that family's key" 201 "$(call dev-admin POST /users "$BODY")"
check "a student cannot name another family's key" 400 "$(call dev-admin POST /users "$(echo "$BODY" | jq -c --arg code "$FAMILY_KEY" '.registrationKeyCode = $code | .mobileNumber = "0111222335"')")"
check "the same mobile number twice is a conflict" 409 "$(call dev-admin POST /users "$(echo "$BODY" | jq -c '.kind = "Teacher" | del(.parentId, .classId)')")"
check "a parent cannot create accounts" 403 "$(call dev-parent POST /users "$BODY")"

echo "== moving a child between families, renaming"
check "the new family's key before the move" "1" "$(call dev-admin GET '/registration-keys?status=Used&pageSize=100' >/dev/null; json "[.items[] | select(.parentId == $NEW_PARENT)][0].childCount")"
check "move Sara to the new family" 200 "$(call dev-admin PUT /users/$STUDENT_ID/parent "$(jq -nc --argjson p "$NEW_PARENT" '{parentId: $p}')")"
call dev-admin GET '/registration-keys?status=Used&pageSize=100' >/dev/null
check "the slot follows the child (old family 3 -> 2, new 1 -> 2)" "2 2" "$(json "\"\\([.items[] | select(.id == $FAMILY_KEY_ID)][0].childCount) \\([.items[] | select(.parentId == $NEW_PARENT)][0].childCount)\"")"
call dev-student GET /me >/dev/null
check "and holds the new family's key" "$NEW_PARENT" "$(json .user.parentId)"
check "the new family's allowance of 2 is now spent" 400 "$(call dev-admin PUT /users/$CHILD_ID/parent "$(jq -nc --argjson p "$NEW_PARENT" '{parentId: $p}')")"
check "rename a user" 200 "$(call dev-admin PUT /users/$NEW_PARENT/name '{"firstName":"Hana","lastName":"Hassan"}')"
call dev-admin GET "/users?role=PARENT&pageSize=100" >/dev/null
check "the parents list shows the new name and child count" "Hana Hassan 2" "$(json "[.items[] | select(.id == $NEW_PARENT)][0] | \"\\(.displayName) \\(.childCount)\"")"

call dev-admin GET /teachers >/dev/null; ROSTER=$(json '.teachers[0].id')
check "provisioning an existing teacher's login links it" "Linked" "$(call dev-admin POST /teachers/$ROSTER/login '{"password":"smoke-pass-1"}' >/dev/null; json .status)"
check "a teacher without an email is skipped" "SkippedNoEmail" "$(call dev-admin POST /teachers '{"firstName":"No","lastName":"Email"}' >/dev/null; call dev-admin POST /teachers/$(json .id)/login '{"password":"smoke-pass-1"}' >/dev/null; json .status)"
check "a new teacher gets a login" "Created" "$(call dev-admin POST /teachers '{"firstName":"Mona","lastName":"New","email":"mona@demo-school.local"}' >/dev/null; call dev-admin POST /teachers/$(json .id)/login '{"password":"smoke-pass-1"}' >/dev/null; json .status)"

echo "== translation overrides"
check "a student reads the school's labels" 200 "$(call dev-student GET /translation-overrides)"
check "both languages present, nothing customised" "0 0" "$(json '"\(.languages.en | length) \(.languages.ar | length)"')"
BODY=$(jq -nc '{changed: {"nav.dashboard": "الرئيسية", "notifications.reviewStatus.revision-requested": "أعد المحاولة يا {{ name }}"}}')
check "admin customises two Arabic labels" 200 "$(call dev-admin PUT /translation-overrides/ar "$BODY")"
check "teacher cannot" 403 "$(call dev-teacher PUT /translation-overrides/ar "$BODY")"
check "a colleague's session touches only its own label" 200 "$(call dev-admin PUT /translation-overrides/ar '{"changed":{"topbar.notifications":"الإشعارات"}}')"
check "so all three stand" 3 "$(json '.values | length')"
check "admin customises an English label" 200 "$(call dev-admin PUT /translation-overrides/en '{"changed":{"nav.dashboard":"Home"}}')"
call dev-student GET /translation-overrides >/dev/null
check "keys and Arabic come back exactly, placeholders intact" "الرئيسية|أعد المحاولة يا {{ name }}|Home" \
  "$(json '"\(.languages.ar["nav.dashboard"])|\(.languages.ar["notifications.reviewStatus.revision-requested"])|\(.languages.en["nav.dashboard"])"')"
check "removing a label restores the shipped one" 2 "$(call dev-admin PUT /translation-overrides/ar '{"removed":["topbar.notifications"]}' >/dev/null; json '.values | length')"
check "an unsupported language is refused" 400 "$(call dev-admin PUT /translation-overrides/fr '{"changed":{"nav.dashboard":"Accueil"}}')"
check "a blank label is refused" 400 "$(call dev-admin PUT /translation-overrides/en '{"changed":{"nav.dashboard":"  "}}')"
check "a malformed key is refused" 400 "$(call dev-admin PUT /translation-overrides/en '{"changed":{"nav..dashboard":"Home"}}')"
check "changed and removed together is refused" 400 "$(call dev-admin PUT /translation-overrides/en '{"changed":{"nav.dashboard":"Home"},"removed":["nav.dashboard"]}')"
check "resetting Arabic" "ar 2" "$(call dev-admin DELETE /translation-overrides/ar >/dev/null; json '"\(.language) \(.removedCount)"')"
call dev-student GET /translation-overrides >/dev/null
check "leaves English alone" "0 1" "$(json '"\(.languages.ar | length) \(.languages.en | length)"')"

echo "== platform: onboarding and suspending organizations"
call dev-platform GET /me >/dev/null
check "the platform administrator belongs to no organization" "PLATFORM_ADMIN null" "$(json '"\(.user.roles[0]) \(.tenant)"')"
check "the platform administrator lists organizations" 200 "$(call dev-platform GET /platform/tenants)"
check "the demo school is one of them" 1 "$(json '[.items[] | select(.slug == "demo-school")] | length')"
DEMO=$(json '.items[] | select(.slug == "demo-school") | .id')
check "a school administrator cannot" 403 "$(call dev-admin GET /platform/tenants)"
check "the platform administrator reads no school data" 403 "$(call dev-platform GET /users)"
BODY='{"slug":"acme_school","name":"Acme School","plan":"Trial","adminEmail":"head@acme.test"}'
check "onboard a school with a generated password" 201 "$(call dev-platform POST /platform/tenants "$BODY")"
check "the password is returned once" "acme_school true" "$(json '"\(.slug) \(.generatedPassword | length > 10)"')"
ACME=$(json .tenantId)
check "an organization id is never reused" 409 "$(call dev-platform POST /platform/tenants "$BODY")"
check "nor an administrator address" 409 "$(call dev-platform POST /platform/tenants "$(echo "$BODY" | jq -c '.slug = "acme-two"')")"
check "a bad organization id is refused" 400 "$(call dev-platform POST /platform/tenants "$(echo "$BODY" | jq -c '.slug = "Acme School!" | .adminEmail = "x@acme.test"')")"
check "the new administrator is invisible to other schools" 0 "$(call dev-admin GET '/users?search=head@acme' >/dev/null; json .totalCount)"
check "rebrand the new school" 200 "$(call dev-platform PUT /platform/tenants/$ACME '{"name":"Acme Academy","plan":"Standard","primaryColor":"#1565C0"}')"
check "a bad brand colour is refused" 400 "$(call dev-platform PUT /platform/tenants/$ACME '{"name":"Acme","plan":"Standard","primaryColor":"blue"}')"
check "suspend the demo school" 200 "$(call dev-platform POST /platform/tenants/$DEMO:suspend)"
check "its students lose access" 403 "$(call dev-student GET /quizzes)"
check "and its administrator" 403 "$(call dev-admin GET /users)"
call dev-admin GET /me >/dev/null
check "/me still says why" false "$(json .tenant.isActive)"
check "reactivate it" 200 "$(call dev-platform POST /platform/tenants/$DEMO:reactivate)"
check "access returns on the next request" 200 "$(call dev-student GET /quizzes)"

echo "== sign-in"
anon() { # method path json-body -> status; body in $WORK/out.json (no token)
  curl -s -o "$WORK/out.json" -w "%{http_code}" -X "$1" -H "Content-Type: application/json" -d "$3" "$API$2"
}
bearer() { # access-token method path [json-body] -> status
  local args=(-s -o "$WORK/out.json" -w "%{http_code}" -X "$2" -H "Authorization: Bearer $1")
  [ -n "${4:-}" ] && args+=(-H "Content-Type: application/json" -d "$4")
  curl "${args[@]}" "$API$3"
}
check "a wrong password is refused" 401 "$(anon POST /auth/sign-in '{"email":"student@demo-school.local","password":"nope"}')"
check "without saying whether the account exists" 401 "$(anon POST /auth/sign-in '{"email":"nobody@demo-school.local","password":"nope"}')"
check "a refused sign-in is not activity" null "$(call dev-admin GET /users/$STUDENT_ID >/dev/null; json .user.lastActiveOn)"
check "the seeded student signs in" 200 "$(anon POST /auth/sign-in '{"email":"Student@Demo-School.local ","password":"password"}')"
ACCESS=$(json .accessToken); REFRESH=$(json .refreshToken)
call dev-admin GET /users/$STUDENT_ID >/dev/null; ACTIVE_ON=$(json .user.lastActiveOn)
check "signing in marks the person active" true "$([ "$ACTIVE_ON" != null ] && echo true)"
check "and the token opens /me" "200 student@demo-school.local" "$(bearer "$ACCESS" GET /me) $(json .user.email)"
check "refresh rotates the session" 200 "$(anon POST /auth/refresh "$(jq -nc --arg t "$REFRESH" '{refreshToken:$t}')")"
REFRESH2=$(json .refreshToken)
check "renewing the session does too" true "$(call dev-admin GET /users/$STUDENT_ID >/dev/null; jq -r --arg was "$ACTIVE_ON" '.user.lastActiveOn != null and .user.lastActiveOn != $was' "$WORK/out.json")"
check "a spent refresh token is refused" 401 "$(anon POST /auth/refresh "$(jq -nc --arg t "$REFRESH" '{refreshToken:$t}')")"
check "and ends the stolen family: its successor is dead too" 401 "$(anon POST /auth/refresh "$(jq -nc --arg t "$REFRESH2" '{refreshToken:$t}')")"
anon POST /auth/sign-in '{"email":"student@demo-school.local","password":"password"}' >/dev/null; REFRESH=$(json .refreshToken); ACCESS=$(json .accessToken)
check "sign-out" 204 "$(anon POST /auth/sign-out "$(jq -nc --arg t "$REFRESH" '{refreshToken:$t}')")"
check "the ended session cannot refresh" 401 "$(anon POST /auth/refresh "$(jq -nc --arg t "$REFRESH" '{refreshToken:$t}')")"
check "changing a password needs the current one" 400 "$(bearer "$ACCESS" PUT /me/password '{"currentPassword":"wrong","newPassword":"newpass1"}')"
check "change my password" 200 "$(bearer "$ACCESS" PUT /me/password '{"currentPassword":"password","newPassword":"newpass1"}')"
check "the new one signs in" 200 "$(anon POST /auth/sign-in '{"email":"student@demo-school.local","password":"newpass1"}')"
check "the old one no longer does" 401 "$(anon POST /auth/sign-in '{"email":"student@demo-school.local","password":"password"}')"
call dev-student GET /me >/dev/null; STUDENT_ID=$(json .user.id)
check "a teacher cannot set a student's password" 403 "$(call dev-teacher PUT /users/$STUDENT_ID/password '{"password":"smoke-pass-2"}')"
check "nor a parent, for a child who is not theirs" 403 "$(call dev-parent PUT /users/$STUDENT_ID/password '{"password":"smoke-pass-2"}')"
check "a parent can, for their own child" 200 "$(call dev-parent PUT /users/$CHILD_ID/password '{"password":"smoke-pass-2"}')"
check "a new password needs 8 characters" 400 "$(call dev-admin PUT /users/$STUDENT_ID/password '{"password":"short7c"}')"
check "and cannot be a common one" "400 true" "$(call dev-admin PUT /users/$STUDENT_ID/password '{"password":"Password1"}') $(json '[.. | strings] | any(test("too common"))')"
check "an administrator can" 200 "$(call dev-admin PUT /users/$STUDENT_ID/password '{"password":"smoke-pass-3"}')"
check "and it is the one that signs in now" 200 "$(anon POST /auth/sign-in '{"email":"student@demo-school.local","password":"smoke-pass-3"}')"
for i in 1 2 3 4 5; do anon POST /auth/sign-in '{"email":"student2@demo-school.local","password":"guess"}' >/dev/null; done
check "the first-run platform administrator signs in" "200" "$(anon POST /auth/sign-in '{"email":"platform@quizmasterpro.local","password":"@dminP@$$w0rd"}')"
check "five wrong guesses lock the account" "401 true" "$(anon POST /auth/sign-in '{"email":"student2@demo-school.local","password":"password"}') $(json '.Message | test("Too many")')"

echo "== a school with no working administrator login"
check "a school administrator cannot use the platform's reset" 403 "$(call dev-admin PUT /platform/tenants/$DEMO/administrator-password '{"email":"admin@demo-school.local","password":"platform1"}')"
check "it names administrators only" 404 "$(call dev-platform PUT /platform/tenants/$DEMO/administrator-password '{"email":"teacher@demo-school.local","password":"platform1"}')"
check "the platform sets the administrator's password" 200 "$(call dev-platform PUT /platform/tenants/$DEMO/administrator-password '{"email":"admin@demo-school.local","password":"platform1"}')"
check "and they sign in with it" 200 "$(anon POST /auth/sign-in '{"email":"admin@demo-school.local","password":"platform1"}')"

echo "== live channel"
HUB="${API%/api}/hubs/notifications/negotiate?negotiateVersion=1"
check "the hub refuses a connection without a token" 401 "$(curl -s -o /dev/null -w '%{http_code}' -X POST "$HUB")"
check "and accepts a signed-in one" 200 "$(curl -s -o "$WORK/out.json" -w '%{http_code}' -X POST -H "Authorization: Bearer $(cat "$WORK/token-dev-teacher")" "$HUB")"
check "the token may travel in the URL for the hub (WebSockets carry no headers)" 200 "$(curl -s -o /dev/null -w '%{http_code}' -X POST "$HUB&access_token=$(cat "$WORK/token-dev-teacher")")"
check "but nowhere else" 401 "$(curl -s -o /dev/null -w '%{http_code}' "$API/me?access_token=$(cat "$WORK/token-dev-teacher")")"

echo "== participations history"
check "students who have submitted, most attempts first" 200 "$(call dev-admin GET '/users?participated=true')"
check "each with a count, none without one" "true" "$(json '(.items | length > 0) and all(.items[]; .participationCount > 0) and ([.items[].participationCount] == ([.items[].participationCount] | sort | reverse))')"

echo "== server-side search and filters (they cover every page, not only the one on screen)"
call dev-admin GET '/users?search=0100200&pageSize=100' >/dev/null
check "users: search matches a mobile number" true "$(json '.totalCount > 0 and all(.items[]; .mobileNumber | test("0100200"))')"
call dev-admin GET '/users?search=%25' >/dev/null
check "users: a typed % is a literal, not a wildcard" 0 "$(json .totalCount)"
call dev-admin GET '/users?activity=Pending&pageSize=100' >/dev/null
check "users: Pending is active and never signed in" true "$(json '.totalCount > 0 and all(.items[]; .isActive and .lastActiveOn == null)')"
call dev-admin GET '/users?activity=Suspended&pageSize=100' >/dev/null
check "users: Suspended is deactivated" true "$(json 'all(.items[]; .isActive | not)')"
call dev-admin GET '/registration-keys?pageSize=1' >/dev/null; KEY_PART=$(json '.items[0].code' | cut -c1-8)
call dev-admin GET "/registration-keys?search=$KEY_PART" >/dev/null
check "registration keys: search by part of a code" true \
  "$(jq -r --arg p "$KEY_PART" '.totalCount >= 1 and all(.items[]; .code | contains($p))' "$WORK/out.json")"
call dev-admin GET '/registration-keys?role=PARENT&pageSize=100' >/dev/null
check "registration keys: the role tab is a server filter" true "$(json 'all(.items[]; .role == "PARENT")')"
call dev-admin GET '/teachers?search=tarek' >/dev/null
check "teachers: search by name" true "$(json '(.teachers | length) >= 1 and all(.teachers[]; (.firstName + " " + .lastName) | ascii_downcase | contains("tarek"))')"
call dev-admin GET '/teachers?search=no-such-teacher-xyz' >/dev/null
check "teachers: a search with no match is empty" 0 "$(json '.teachers | length')"
call dev-admin GET '/subjects?search=scien' >/dev/null
check "subjects: search by name" true "$(json '(.subjects | length) >= 1 and all(.subjects[]; .name | ascii_downcase | contains("scien"))')"
call dev-admin GET '/quizzes?search=basics' >/dev/null
check "bank quizzes: search by name" true "$(json '(.quizzes | length) >= 1 and all(.quizzes[]; (.name + " " + (.description // "")) | ascii_downcase | contains("basics"))')"
call dev-admin GET '/teacher-quizzes?search=tarek' >/dev/null
check "teacher quizzes: search by the author's name" true "$(json '(.quizzes | length) >= 1')"
# the quiz builder's picker: an unclassified question fits any term, but never a chosen grade
check "upload an unclassified question" 200 "$(call dev-admin POST /questions/bulk '{"questions":[{"type":"Choose","text":"Zebra search probe","options":["a","b"],"correctOption":1}]}')"
PROBE=$(json '.ids[0]')
call dev-admin GET '/questions?search=zebra%20search%20probe' >/dev/null
check "questions: search by text across the bank" "1 $PROBE" "$(json '"\(.totalCount) \(.items[0].id)"')"
call dev-admin GET '/questions?search=zebra%20search%20probe&forSemester=Second' >/dev/null
check "questions: a question with no term fits any term (forSemester)" 1 "$(json .totalCount)"
call dev-admin GET '/questions?search=zebra%20search%20probe&semester=Second' >/dev/null
check "questions: the bank's own semester filter stays exact" 0 "$(json .totalCount)"
call dev-admin GET '/questions?search=zebra%20search%20probe&gradeId=1' >/dev/null
check "questions: a question with no grade never fits a chosen grade" 0 "$(json .totalCount)"
call dev-admin GET "/questions?search=$PROBE" >/dev/null
check "questions: a number typed in the search finds that question" true "$(jq -r --argjson id "$PROBE" 'any(.items[]; .id == $id)' "$WORK/out.json")"
call dev-admin GET "/questions?ids=$PROBE&ids=${Q[0]}" >/dev/null
check "questions: exactly the ones asked for by id (a quiz builder naming its own)" 2 "$(json .totalCount)"
check "remove the probe question" 200 "$(call dev-admin DELETE /questions/$PROBE)"

echo "== Quiz Management: filter bar, results and review queue on the server"
call dev-teacher GET /me >/dev/null; TEACHER_UID=$(json .user.id)
call dev-teacher GET '/assignments?mine=true&includeInactive=true' >/dev/null
MY_ASSIGNMENTS=$(json '.assignments | length'); FIRST_TITLE=$(json '.assignments[0].title')
check "the teacher has assignments to filter" true "$(json '(.assignments | length) > 0')"
call dev-teacher GET '/assignments?mine=true&includeInactive=true&kind=Homework' >/dev/null
check "assignments: the kind filter" true "$(json 'all(.assignments[]; .kind == "Homework")')"
call dev-teacher GET "/assignments?mine=true&includeInactive=true&search=$(jq -rn --arg t "$FIRST_TITLE" '$t | @uri')" >/dev/null
check "assignments: search by title" true "$(jq -r --arg t "$FIRST_TITLE" 'any(.assignments[]; .title == $t)' "$WORK/out.json")"
call dev-teacher GET '/assignments?mine=true&includeInactive=true&search=no-such-assignment-xyz' >/dev/null
check "assignments: a search with no match is empty" 0 "$(json '.assignments | length')"
check "results: a teacher reads their own" 200 "$(call dev-teacher GET /assignments/results)"
check "results: one row per assignment the filter bar selects" "$MY_ASSIGNMENTS" "$(json '.results | length')"
check "results: every targeted student is completed, not started or overdue" true \
  "$(json 'all(.results[]; .targeted == .completed + .notStarted + .overdue and .validated <= .completed)')"
check "results: students cannot read them" 403 "$(call dev-student GET /assignments/results)"
call dev-teacher GET "/participations?reviewerId=$TEACHER_UID&verdict=Pending&pageSize=100" >/dev/null
check "review queue: Pending has no verdict yet" true "$(json 'all(.items[]; .validationStatus == null)')"
call dev-teacher GET "/participations?reviewerId=$TEACHER_UID&verdict=Reviewed&pageSize=100" >/dev/null
check "review queue: Reviewed has a verdict, latest first" true \
  "$(json '(.totalCount > 0) and all(.items[]; .validationStatus != null)')"
call dev-teacher GET "/participations?reviewerId=$TEACHER_UID&kind=Homework&pageSize=100" >/dev/null
check "review queue: the kind filter uses the assignment's kind" true "$(json 'all(.items[]; .assignmentKind == "Homework")')"

echo "== security headers and limits (OWASP)"
HEADERS=$(curl -s -D - -o /dev/null -H "Authorization: Bearer $(cat "$WORK/token-dev-admin")" "$API/subjects" | tr -d '\r')
check "responses forbid MIME sniffing" "true" "$(echo "$HEADERS" | grep -qi '^x-content-type-options: nosniff' && echo true)"
check "and framing (clickjacking)" "true" "$(echo "$HEADERS" | grep -qi '^x-frame-options: deny' && echo true)"
check "a content security policy allows no inline script" "true" "$(echo "$HEADERS" | grep -i '^content-security-policy:' | grep -q "script-src 'self';" && echo true)"
check "API answers are never cached" "true" "$(echo "$HEADERS" | grep -qi '^cache-control: no-store' && echo true)"
check "an endpoint with no rule of its own still needs a signed-in caller" 401 "$(curl -s -o "$WORK/out.json" -w "%{http_code}" "$API/me")"
# last: it spends this address's sign-in allowance
LIMITED=false
for i in $(seq 1 80); do
  [ "$(anon POST /auth/sign-in '{"email":"nobody@demo-school.local","password":"wrong-guess"}')" = 429 ] && { LIMITED=true; break; }
done
check "sign-in is rate-limited per address" true "$LIMITED"

echo
echo "$PASSED passed, $FAILED failed"
[ "$FAILED" -eq 0 ]
