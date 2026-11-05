// =====================================================================
// 바른손 리플렛 신청 시트 Apps Script
//  - doPost: 웹 폼 신청 → 시트 저장 / Slack 스레드 ts 기록
//  - handleEdit: O·P·Q 체크 시 완료 일시 자동 기록
//  - checkStalledRequests: 영업일 기준 3일 넘게 다음 단계가 체크 안 된 건을
//    최초 Slack 신청 알림의 스레드 댓글로 리마인드
//
// 최초 1회: 스크립트 속성(SLACK_BOT_TOKEN, SLACK_CHANNEL_ID) 등록 후 setup() 실행
// =====================================================================

var SHEET_INDEX = 0;
var HEADER_ROW = 1;

var COL = {
  submittedAt: 1,  // A 신청일시
  company: 2,      // B 회사명
  email: 5,        // E 이메일
  quantity: 9,     // I 수량
  deadline: 10,    // J 납기일
  shipPlan: 18,    // R 출고 일정
  status: 14,      // N 처리상태
  draftDone: 15,   // O 초안 완료 여부 (편집팀)
  printDone: 16,   // P 리플렛 인쇄 완료 여부 (인쇄팀)
  shipDone: 17,    // Q 배송 완료 여부 (포장팀)
  // ---- 자동 기록 영역 (W~AC) : 손으로 수정하지 않음 ----
  slackTs: 23,        // W 슬랙 스레드 ts
  draftDoneAt: 24,    // X 초안 완료일시
  printDoneAt: 25,    // Y 인쇄 완료일시
  shipDoneAt: 26,     // Z 배송 완료일시
  draftRemindAt: 27,  // AA 초안 리마인드 일시
  printRemindAt: 28,  // AB 인쇄 리마인드 일시
  shipRemindAt: 29    // AC 배송 리마인드 일시
};

var TRACKING_HEADERS = [
  "슬랙 스레드 ts\n(자동)", "초안 완료일시\n(자동)", "인쇄 완료일시\n(자동)", "배송 완료일시\n(자동)",
  "초안 리마인드\n(자동)", "인쇄 리마인드\n(자동)", "배송 리마인드\n(자동)"
];

// 공정 순서대로. 이전 단계 완료(초안은 신청 접수) 후 영업일 기준 STALL_BUSINESS_DAYS일이
// 지나도록 체크되지 않으면 mention 대상에게 스레드 댓글로 알림
var STAGES = [
  { name: "초안(편집)", doneCol: COL.draftDone, doneAtCol: COL.draftDoneAt, remindCol: COL.draftRemindAt,
    mention: "<!subteam^S08TX7T8XSA>", prevLabel: "신청 접수" },   // @팀-편집-멤버
  { name: "인쇄", doneCol: COL.printDone, doneAtCol: COL.printDoneAt, remindCol: COL.printRemindAt,
    mention: "<@U08SED8U8JV>", prevLabel: "초안 완료" },           // 석광호 (인쇄팀)
  { name: "포장·배송", doneCol: COL.shipDone, doneAtCol: COL.shipDoneAt, remindCol: COL.shipRemindAt,
    mention: "<@U08RVS9VD19>", prevLabel: "인쇄 완료" }            // 강구완 (포장팀)
];

var STALL_BUSINESS_DAYS = 3;
var MAX_AGE_DAYS = 90;  // 신청 후 이 기간이 지난 행은 검사하지 않음 (오래된 잔여 데이터 보호)
// 처리상태(N열)에 아래 값이 들어있으면 리마인드 제외 (테스트·취소 건 등)
var SKIP_STATUSES = ["cancel", "취소", "보류", "hold", "test", "테스트", "중복"];
// 회사 자체 휴무일 등 공휴일 캘린더에 없는 휴일 (yyyy-MM-dd)
var EXTRA_HOLIDAYS = [];
var HOLIDAY_CALENDAR_ID = "ko.south_korea#holiday@group.v.calendar.google.com";
var TZ = "Asia/Seoul";

// ---------------------------------------------------------------------
// 웹 폼 연동
// ---------------------------------------------------------------------
function doPost(e) {
  var data = JSON.parse(e.postData.contents);
  if (data.action === "setSlackThread") {
    return json_(setSlackThread_(data));
  }

  var sheet = getSheet_();
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var insertRow = getLastDataRow_(sheet) + 1;
    var now = Utilities.formatDate(new Date(), TZ, "yyyy-MM-dd HH:mm:ss");

    var fileCell = "";
    if (data.fileData && data.fileName) {
      var bytes = Utilities.base64Decode(data.fileData);
      var blob = Utilities.newBlob(bytes, data.fileMimeType || "application/octet-stream", data.fileName);
      var driveFile = DriveApp.createFile(blob);
      driveFile.setSharing(DriveApp.Access.DOMAIN_WITH_LINK, DriveApp.Permission.VIEW);
      var safeName = String(data.fileName).replace(/"/g, '""');
      fileCell = '=HYPERLINK("' + driveFile.getUrl() + '","' + safeName + '")';
    } else if (data.fileName) {
      fileCell = data.fileName;
    }

    var rowData = [
      now,
      data.companyName,
      data.contactName,
      data.phone,
      data.email,
      data.address,
      data.partnerCode || "",
      data.purpose,
      data.quantity,
      data.deadline,
      fileCell,
      data.phoneCallRequest || "",
      data.notes || "",
      "accept",
      false,
      false,
      false
    ];

    sheet.getRange(insertRow, 1, 1, rowData.length).setValues([rowData]);
    sheet.getRange(insertRow, 1, 1, 12).setHorizontalAlignment("center");
    sheet.getRange(insertRow, 13).setHorizontalAlignment("left");
    sheet.getRange(insertRow, 13).setWrap(true);
    sheet.getRange(insertRow, 14).setHorizontalAlignment("center");
    sheet.getRange(insertRow, COL.draftDone, 1, 3).insertCheckboxes();
    SpreadsheetApp.flush();

    return json_({ success: true, row: insertRow });
  } finally {
    lock.releaseLock();
  }
}

// 신청 알림을 보낸 뒤 Next.js가 호출: 해당 행에 Slack 메시지 ts 기록
function setSlackThread_(data) {
  var sheet = getSheet_();
  var row = Number(data.row);
  if (!row || row <= HEADER_ROW || !data.ts) return { success: false, error: "invalid params" };
  // 다른 행에 잘못 기록되는 것 방지
  var company = String(sheet.getRange(row, COL.company).getValue());
  if (company !== String(data.companyName)) return { success: false, error: "row mismatch" };
  sheet.getRange(row, COL.slackTs).setNumberFormat("@").setValue(String(data.ts));
  return { success: true };
}

// ---------------------------------------------------------------------
// 체크박스 완료 일시 기록 (설치형 onEdit 트리거로 연결)
// ---------------------------------------------------------------------
function handleEdit(e) {
  var range = e.range;
  var sheet = range.getSheet();
  if (sheet.getIndex() !== SHEET_INDEX + 1) return;

  var firstCol = range.getColumn();
  var lastCol = firstCol + range.getNumColumns() - 1;
  var firstRow = Math.max(range.getRow(), HEADER_ROW + 1);
  var lastRow = range.getRow() + range.getNumRows() - 1;
  if (lastRow < firstRow) return;

  var now = new Date();
  STAGES.forEach(function (stage) {
    if (stage.doneCol < firstCol || stage.doneCol > lastCol) return;
    var n = lastRow - firstRow + 1;
    var checks = sheet.getRange(firstRow, stage.doneCol, n, 1).getValues();
    var doneAtRange = sheet.getRange(firstRow, stage.doneAtCol, n, 1);
    var doneAts = doneAtRange.getValues();
    var changed = false;
    for (var i = 0; i < n; i++) {
      var checked = checks[i][0] === true;
      if (checked && !doneAts[i][0]) { doneAts[i][0] = now; changed = true; }
      if (!checked && doneAts[i][0]) { doneAts[i][0] = ""; changed = true; }
    }
    if (changed) {
      doneAtRange.setValues(doneAts).setNumberFormat("yyyy-MM-dd HH:mm");
    }
  });
}

// ---------------------------------------------------------------------
// 지연 건 리마인드 (매일 오전 시간 트리거)
// ---------------------------------------------------------------------
function checkStalledRequests() {
  var today = startOfDay_(new Date());
  if (!isBusinessDay_(today)) return;

  var sheet = getSheet_();
  var lastRow = getLastDataRow_(sheet);
  if (lastRow <= HEADER_ROW) return;

  var values = sheet.getRange(HEADER_ROW + 1, 1, lastRow - HEADER_ROW, COL.shipRemindAt).getValues();
  var openRowsByEmail = groupOpenRowsByEmail_(values);
  var sent = 0;

  values.forEach(function (r, idx) {
    var rowNum = HEADER_ROW + 1 + idx;
    var company = String(r[COL.company - 1]).trim();
    if (!company) return;
    if (isSkipStatus_(r[COL.status - 1])) return;

    var submittedAt = parseDate_(r[COL.submittedAt - 1]);
    if (!submittedAt) return;
    if ((today - startOfDay_(submittedAt)) / 86400000 > MAX_AGE_DAYS) return;

    // 아직 체크 안 된 첫 단계
    var stageIdx = -1;
    for (var s = 0; s < STAGES.length; s++) {
      if (r[STAGES[s].doneCol - 1] !== true) { stageIdx = s; break; }
    }
    if (stageIdx === -1) return;
    var stage = STAGES[stageIdx];
    if (r[stage.remindCol - 1]) return;  // 이미 리마인드함
    // 출고 일정이 오늘 이후로 잡혀 있으면 담당자가 인지한 건으로 보고 대기
    var shipPlan = parseDate_(r[COL.shipPlan - 1]);
    if (shipPlan && startOfDay_(shipPlan) >= today) return;

    // 기준 시점: 이전 단계 완료일시 (기록이 없는 기존 행은 신청일시로 대체)
    var baseline = submittedAt;
    var baselineKnown = stageIdx === 0;
    if (stageIdx > 0) {
      var prevAt = r[STAGES[stageIdx - 1].doneAtCol - 1];
      if (prevAt instanceof Date) { baseline = prevAt; baselineKnown = true; }
    }

    var elapsed = businessDaysBetween_(startOfDay_(baseline), today);
    if (elapsed <= STALL_BUSINESS_DAYS) return;

    var threadTs = String(r[COL.slackTs - 1] || "");
    if (!threadTs) {
      threadTs = findOriginalSlackTs_(submittedAt, company) || "";
      if (threadTs) sheet.getRange(rowNum, COL.slackTs).setNumberFormat("@").setValue(threadTs);
    }

    var dupRows = (openRowsByEmail[normEmail_(r[COL.email - 1])] || []).filter(function (n) { return n !== rowNum; });
    var text = buildReminderText_({
      stage: stage,
      rowNum: rowNum,
      company: company,
      quantity: r[COL.quantity - 1],
      deadline: formatCell_(r[COL.deadline - 1]),
      baseline: baseline,
      baselineKnown: baselineKnown,
      elapsed: elapsed,
      inThread: !!threadTs,
      dupRows: dupRows
    });

    if (postSlack_(text, threadTs)) {
      sheet.getRange(rowNum, stage.remindCol).setValue(new Date()).setNumberFormat("yyyy-MM-dd HH:mm");
      sent++;
    }
  });

  console.log("checkStalledRequests: " + sent + "건 리마인드");
}

function buildReminderText_(p) {
  var sheetUrl = SpreadsheetApp.getActiveSpreadsheet().getUrl() + "#gid=" + getSheet_().getSheetId() + "&range=A" + p.rowNum;
  var since = Utilities.formatDate(p.baseline, TZ, "M/d");
  var lines = [];
  lines.push(":rotating_light: *[" + p.stage.name + "] 단계 지연 알림* " + p.stage.mention);
  if (!p.inThread) {
    lines.push("*" + esc_(p.company) + "* (" + esc_(String(p.quantity)) + ", 납기 " + esc_(p.deadline) + ")");
  }
  if (p.baselineKnown) {
    lines.push(p.stage.prevLabel + "(" + since + ") 후 영업일 " + p.elapsed + "일이 지났지만 *" +
      p.stage.name + "* 완료 체크가 되지 않았어요.");
  } else {
    lines.push("신청일(" + since + ")로부터 영업일 " + p.elapsed + "일이 지났지만 *" +
      p.stage.name + "* 완료 체크가 되지 않았어요. (" + p.stage.prevLabel + " 시점 기록 없음)");
  }
  lines.push("작업을 마치셨다면 시트에 체크해주시고, 지연 사유가 있다면 이 스레드에 남겨주세요.");
  if (p.dupRows.length) {
    lines.push(":warning: 같은 업체(이메일)의 미완료 신청이 더 있어요: " +
      p.dupRows.map(function (n) { return n + "행"; }).join(", ") + " — 재신청 여부 확인 필요");
  }
  lines.push("<" + sheetUrl + "|:page_facing_up: 시트 " + p.rowNum + "행 바로가기>");
  return lines.join("\n");
}

// ---------------------------------------------------------------------
// Slack
// ---------------------------------------------------------------------
function postSlack_(text, threadTs) {
  var props = PropertiesService.getScriptProperties();
  var token = props.getProperty("SLACK_BOT_TOKEN");
  var channel = props.getProperty("SLACK_CHANNEL_ID");
  if (!token || !channel) { console.error("SLACK_BOT_TOKEN / SLACK_CHANNEL_ID 스크립트 속성 없음"); return false; }

  var body = { channel: channel, text: text, unfurl_links: false };
  if (threadTs) body.thread_ts = threadTs;
  var res = UrlFetchApp.fetch("https://slack.com/api/chat.postMessage", {
    method: "post",
    contentType: "application/json; charset=utf-8",
    headers: { Authorization: "Bearer " + token },
    payload: JSON.stringify(body),
    muteHttpExceptions: true
  });
  var out = JSON.parse(res.getContentText());
  if (!out.ok) console.error("Slack 전송 실패: " + out.error);
  return out.ok === true;
}

// ts 기록이 없는 기존 신청 건: 신청 시각 전후 채널 기록에서 원본 알림 메시지를 찾음
// (봇 토큰에 channels:history 또는 groups:history 권한 필요)
function findOriginalSlackTs_(submittedAt, company) {
  var props = PropertiesService.getScriptProperties();
  var token = props.getProperty("SLACK_BOT_TOKEN");
  var channel = props.getProperty("SLACK_CHANNEL_ID");
  if (!token || !channel) return null;
  // 시간 없이 날짜만 입력된 수기 행은 원본 알림이 없음
  if (Utilities.formatDate(submittedAt, TZ, "HH:mm:ss") === "00:00:00") return null;

  var t = submittedAt.getTime() / 1000;
  var url = "https://slack.com/api/conversations.history?channel=" + encodeURIComponent(channel) +
    "&oldest=" + (t - 60) + "&latest=" + (t + 600) + "&inclusive=true&limit=50";
  var res = UrlFetchApp.fetch(url, { headers: { Authorization: "Bearer " + token }, muteHttpExceptions: true });
  var out = JSON.parse(res.getContentText());
  if (!out.ok) { console.error("conversations.history 실패: " + out.error); return null; }

  // 신청 알림 블록의 회사명 필드("*회사명:*\n{회사명}")와 정확히 일치하는 메시지
  var target = "*회사명:*\n" + esc_(company);
  var hit = (out.messages || []).filter(function (m) {
    return (m.blocks || []).some(function (b) {
      return (b.fields || []).some(function (f) { return f.text === target; });
    });
  }).sort(function (a, b) { return Number(a.ts) - Number(b.ts); })[0];
  return hit ? hit.ts : null;
}

// 기존 행들의 Slack 스레드 ts를 한 번에 채움 (수동 실행용, 선택)
function backfillSlackThreads() {
  var sheet = getSheet_();
  var lastRow = getLastDataRow_(sheet);
  var values = sheet.getRange(HEADER_ROW + 1, 1, lastRow - HEADER_ROW, COL.slackTs).getValues();
  var filled = 0;
  values.forEach(function (r, idx) {
    if (r[COL.slackTs - 1] || !r[COL.company - 1]) return;
    var submittedAt = parseDate_(r[COL.submittedAt - 1]);
    if (!submittedAt) return;
    var ts = findOriginalSlackTs_(submittedAt, String(r[COL.company - 1]).trim());
    if (ts) {
      sheet.getRange(HEADER_ROW + 1 + idx, COL.slackTs).setNumberFormat("@").setValue(ts);
      filled++;
    }
  });
  console.log("backfillSlackThreads: " + filled + "건 기록");
}

// ---------------------------------------------------------------------
// 설치 (최초 1회 수동 실행)
// ---------------------------------------------------------------------
function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = getSheet_();

  if (sheet.getMaxColumns() < COL.shipRemindAt) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), COL.shipRemindAt - sheet.getMaxColumns());
  }
  sheet.getRange(HEADER_ROW, COL.slackTs, 1, TRACKING_HEADERS.length)
    .setValues([TRACKING_HEADERS])
    .setFontColor("#888888")
    .setWrap(true);

  ScriptApp.getProjectTriggers().forEach(function (t) {
    var fn = t.getHandlerFunction();
    if (fn === "handleEdit" || fn === "checkStalledRequests") ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger("handleEdit").forSpreadsheet(ss).onEdit().create();
  ScriptApp.newTrigger("checkStalledRequests").timeBased().atHour(10).everyDays(1).inTimezone(TZ).create();

  // 공휴일 캘린더 접근 확인
  if (!getHolidayCalendar_()) console.warn("공휴일 캘린더를 불러오지 못해 주말만 제외합니다.");
  console.log("setup 완료");
}

// ---------------------------------------------------------------------
// 영업일 계산
// ---------------------------------------------------------------------
var holidayCache_ = null;

function getHolidayCalendar_() {
  var cal = CalendarApp.getCalendarById(HOLIDAY_CALENDAR_ID);
  if (!cal) {
    try { cal = CalendarApp.subscribeToCalendar(HOLIDAY_CALENDAR_ID); } catch (err) { cal = null; }
  }
  return cal;
}

function loadHolidays_() {
  if (holidayCache_) return holidayCache_;
  holidayCache_ = {};
  EXTRA_HOLIDAYS.forEach(function (d) { holidayCache_[d] = true; });
  var cal = getHolidayCalendar_();
  if (!cal) return holidayCache_;
  var now = new Date();
  var from = new Date(now.getTime() - (MAX_AGE_DAYS + 30) * 86400000);
  var to = new Date(now.getTime() + 30 * 86400000);
  cal.getEvents(from, to).forEach(function (ev) {
    // 공휴일만 (어버이날 등 '기념일'은 영업일)
    var desc = String(ev.getDescription() || "");
    if (desc.indexOf("기념일") !== -1 || /observance/i.test(desc)) return;
    var d = new Date(ev.getStartTime().getTime());
    var end = ev.getEndTime();
    while (d < end) {
      holidayCache_[Utilities.formatDate(d, TZ, "yyyy-MM-dd")] = true;
      d = new Date(d.getTime() + 86400000);
    }
  });
  return holidayCache_;
}

function isBusinessDay_(date) {
  var dow = Number(Utilities.formatDate(date, TZ, "u"));  // 1=월 ... 7=일
  if (dow >= 6) return false;
  return !loadHolidays_()[Utilities.formatDate(date, TZ, "yyyy-MM-dd")];
}

// from 다음 날부터 to 당일까지의 영업일 수
function businessDaysBetween_(from, to) {
  var count = 0;
  var d = new Date(from.getTime() + 86400000);
  while (d <= to) {
    if (isBusinessDay_(d)) count++;
    d = new Date(d.getTime() + 86400000);
  }
  return count;
}

// ---------------------------------------------------------------------
// 유틸
// ---------------------------------------------------------------------
function getSheet_() {
  return SpreadsheetApp.getActiveSpreadsheet().getSheets()[SHEET_INDEX];
}

function getLastDataRow_(sheet) {
  var colA = sheet.getRange("A:A").getValues();
  for (var i = colA.length - 1; i >= 0; i--) {
    if (colA[i][0] !== "") return i + 1;
  }
  return 1;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// "2026-10-23 17:48:28", "2026-09-29", "2026. 9. 18", Date 객체 모두 처리 (KST 기준)
function parseDate_(v) {
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
  var m = String(v).trim().match(/^(\d{4})[-.\/]\s*(\d{1,2})[-.\/]\s*(\d{1,2})\.?(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (!m) return null;
  var pad = function (n) { return ("0" + n).slice(-2); };
  var iso = m[1] + "-" + pad(m[2]) + "-" + pad(m[3]) + "T" +
    pad(m[4] || 0) + ":" + pad(m[5] || 0) + ":" + pad(m[6] || 0) + "+09:00";
  var d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
}

function startOfDay_(d) {
  return new Date(Utilities.formatDate(d, TZ, "yyyy-MM-dd") + "T00:00:00+09:00");
}

function formatCell_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, TZ, "yyyy-MM-dd");
  return String(v || "-");
}

function isSkipStatus_(status) {
  var s = String(status || "").toLowerCase();
  return SKIP_STATUSES.some(function (k) { return s.indexOf(k.toLowerCase()) !== -1; });
}

function normEmail_(v) {
  return String(v || "").trim().toLowerCase();
}

function groupOpenRowsByEmail_(values) {
  var map = {};
  values.forEach(function (r, idx) {
    var email = normEmail_(r[COL.email - 1]);
    if (!email || isSkipStatus_(r[COL.status - 1])) return;
    if (r[COL.shipDone - 1] === true) return;
    (map[email] = map[email] || []).push(HEADER_ROW + 1 + idx);
  });
  return map;
}

// Slack mrkdwn 제어문자 이스케이프
function esc_(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
