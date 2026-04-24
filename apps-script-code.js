function doPost(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  var data = JSON.parse(e.postData.contents);

  if (sheet.getLastRow() === 0) {
    var headers = ["신청일시", "회사명", "담당자명", "연락처", "이메일", "주소", "제휴사코드", "용도", "수량", "납기일", "첨부파일", "유선 연락 요청", "특이사항", "처리상태", "바른손 완료여부", "배송완료 여부"];
    sheet.appendRow(headers);

    var headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setBackground("#4285F4");
    headerRange.setFontColor("#FFFFFF");
    headerRange.setFontWeight("bold");
    headerRange.setHorizontalAlignment("center");

    sheet.setColumnWidth(1, 160);
    sheet.setColumnWidth(2, 140);
    sheet.setColumnWidth(3, 100);
    sheet.setColumnWidth(4, 130);
    sheet.setColumnWidth(5, 180);
    sheet.setColumnWidth(6, 250);
    sheet.setColumnWidth(7, 120);
    sheet.setColumnWidth(8, 80);
    sheet.setColumnWidth(9, 80);
    sheet.setColumnWidth(10, 120);
    sheet.setColumnWidth(11, 150);
    sheet.setColumnWidth(12, 120);
    sheet.setColumnWidth(13, 260);
    sheet.setColumnWidth(14, 100);
    sheet.setColumnWidth(15, 130);
    sheet.setColumnWidth(16, 130);

    sheet.setFrozenRows(1);
  }

  var lastDataRow = 1;
  var colA = sheet.getRange("A:A").getValues();
  for (var i = colA.length - 1; i >= 0; i--) {
    if (colA[i][0] !== "") {
      lastDataRow = i + 1;
      break;
    }
  }
  var insertRow = lastDataRow + 1;

  var now = new Date();
  var dateStr = Utilities.formatDate(now, "Asia/Seoul", "yyyy-MM-dd HH:mm:ss");

  var rowData = [
    dateStr,
    data.companyName,
    data.contactName,
    data.phone,
    data.email,
    data.address,
    data.partnerCode || "",
    data.purpose,
    data.quantity,
    data.deadline,
    data.fileName || "",
    data.phoneCallRequest || "",
    data.notes || "",
    "접수",
    false,
    false
  ];

  sheet.getRange(insertRow, 1, 1, rowData.length).setValues([rowData]);
  sheet.getRange(insertRow, 1, 1, 12).setHorizontalAlignment("center");
  sheet.getRange(insertRow, 13).setHorizontalAlignment("left");
  sheet.getRange(insertRow, 13).setWrap(true);
  sheet.getRange(insertRow, 14).setHorizontalAlignment("center");
  sheet.getRange(insertRow, 15).insertCheckboxes();
  sheet.getRange(insertRow, 16).insertCheckboxes();

  if (insertRow % 2 === 0) {
    sheet.getRange(insertRow, 1, 1, rowData.length).setBackground("#F8F9FA");
  }

  return ContentService.createTextOutput(JSON.stringify({success: true})).setMimeType(ContentService.MimeType.JSON);
}
