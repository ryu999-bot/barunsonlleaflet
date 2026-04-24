function doPost(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  var data = JSON.parse(e.postData.contents);

  var lastDataRow = 1;
  var colA = sheet.getRange("A:A").getValues();
  for (var i = colA.length - 1; i >= 0; i--) {
    if (colA[i][0] !== "") {
      lastDataRow = i + 1;
      break;
    }
  }
  var insertRow = lastDataRow + 1;

  var now = Utilities.formatDate(new Date(), "Asia/Seoul", "yyyy-MM-dd HH:mm:ss");

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
    data.fileName || "",
    data.phoneCallRequest || "",
    data.notes || "",
    "accept",
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

  return ContentService.createTextOutput(JSON.stringify({success: true})).setMimeType(ContentService.MimeType.JSON);
}
