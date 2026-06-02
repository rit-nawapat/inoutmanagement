function jsonResponse(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

function textResponse(message) {
  return ContentService
    .createTextOutput(message)
    .setMimeType(ContentService.MimeType.TEXT);
}

function asString_(value) {
  return value === undefined || value === null ? '' : String(value);
}

function asNumber_(value) {
  var num = Number(value);
  return Number.isNaN(num) ? 0 : num;
}

function normalizeText_(value, fallback) {
  return value === undefined || value === null ? fallback : value;
}

function ensureSheet_(ss, sheetName, headers, headerBg) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length)
      .setFontWeight("bold")
      .setBackground(headerBg)
      .setFontColor("white");
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function upsertRowById_(sheet, id, width, rowValues, action) {
  var values = sheet.getDataRange().getValues();
  for (var i = values.length - 1; i >= 1; i--) {
    if (values[i][0].toString() === id.toString()) {
      if (action === 'delete') {
        sheet.deleteRow(i + 1);
      } else if (action === 'edit') {
        sheet.getRange(i + 1, 1, 1, width).setValues([rowValues]);
      }
      return true;
    }
  }
  return false;
}

function readRows_(sheetName) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) return [];

  var values = sheet.getDataRange().getValues();
  if (!values || values.length <= 1) return [];

  var headers = values[0];
  var rows = [];
  for (var i = 1; i < values.length; i++) {
    var row = {};
    for (var j = 0; j < headers.length; j++) {
      row[headers[j]] = values[i][j];
    }
    rows.push(row);
  }
  return rows;
}

function readProfiles_() {
  return readRows_('Profiles').map(function (row) {
    return {
      id: asString_(row.ProfileID || row.ProfileId || row.id),
      name: asString_(row.Name || row.name),
      imageUrl: asString_(row.ImageURL || row.ImageUrl || row.imageUrl)
    };
  }).filter(function (row) { return row.id; });
}

function readHistory_(sheetName) {
  return readRows_(sheetName).map(function (row) {
    var id = row.ID !== undefined ? row.ID : row.id;
    return {
      id: asNumber_(id) || asString_(id),
      type: asString_(row.Type || row.type),
      categoryName: asString_(row.CategoryName || row.categoryName),
      accountName: asString_(row.AccountName || row.accountName),
      amount: asNumber_(row.Amount || row.amount),
      barcodeNote: asString_(row.BarcodeNote || row.barcodeNote),
      date: asString_(row.Date || row.date),
      isoDate: asString_(row.IsoDate || row.isoDate)
    };
  }).filter(function (row) { return row.id !== ''; });
}

function readRecurring_(sheetName) {
  return readRows_(sheetName).map(function (row) {
    var id = row.ID !== undefined ? row.ID : row.id;
    var categoryId = asString_(row.CategoryId || row.categoryId || row.Category || row.category);
    var accountId = asString_(row.AccountId || row.accountId || row.Account || row.account);
    return {
      id: asNumber_(id) || asString_(id),
      name: asString_(row.Name || row.name),
      desc: asString_(row.Date_Desc || row.desc || row.Desc),
      amount: asNumber_(row.Amount || row.amount),
      categoryId: categoryId,
      accountId: accountId,
      category: categoryId,
      account: accountId,
      lastPaidMonth: asString_(row.LastPaidMonth || row.lastPaidMonth)
    };
  }).filter(function (row) { return row.id !== ''; });
}

function doGet(e) {
  try {
    var params = (e && e.parameter) || {};
    if (params.user) {
      var profileId = params.user.toString();
      return jsonResponse({
        status: 'Success',
        history: readHistory_(profileId + '_History'),
        recurring: readRecurring_(profileId + '_Recurring')
      });
    }

    return jsonResponse({
      status: 'Success',
      profiles: readProfiles_()
    });
  } catch (error) {
    return textResponse('Error: ' + error.message);
  }
}

function doPost(e) {
  try {
    var data = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    var action = data.action || 'add';
    var sheetName = data.sheetName || 'User1_History';
    var ss = SpreadsheetApp.getActiveSpreadsheet();

    if (!data.action && data.profileId && data.name) {
      action = 'save_profile';
    }

    if (action === 'save_profile') {
      var profileSheet = ensureSheet_(ss, 'Profiles', ['ProfileID', 'Name', 'ImageURL'], '#4f46e5');
      var imageUrl = normalizeText_(data.oldImageUrl, '');

      if (data.imageBase64) {
        imageUrl = 'data:' + data.mimeType + ';base64,' + data.imageBase64;
      }

      var values = profileSheet.getDataRange().getValues();
      var isEdit = false;
      for (var i = 1; i < values.length; i++) {
        if (values[i][0].toString() === data.profileId.toString()) {
          profileSheet.getRange(i + 1, 2, 1, 2).setValues([[data.name, imageUrl]]);
          isEdit = true;
          break;
        }
      }
      if (!isEdit) {
        profileSheet.appendRow([data.profileId, data.name, imageUrl]);
      }

      return jsonResponse({ status: 'Success', imageUrl: imageUrl });
    }

    if (action === 'delete_profile') {
      var profileSheet = ss.getSheetByName('Profiles');
      if (profileSheet) {
        var values = profileSheet.getDataRange().getValues();
        for (var i = values.length - 1; i >= 1; i--) {
          if (values[i][0].toString() === data.profileId.toString()) {
            profileSheet.deleteRow(i + 1);
            break;
          }
        }
      }
      return jsonResponse({ status: 'Success' });
    }

    var isRecurring = sheetName.indexOf('Recurring') !== -1;
    var sheet = ensureSheet_(
      ss,
      sheetName,
      isRecurring
        ? ['ID', 'Name', 'Date_Desc', 'Amount', 'Category', 'Account', 'LastPaidMonth']
        : ['ID', 'Type', 'CategoryName', 'AccountName', 'Amount', 'BarcodeNote', 'Date', 'IsoDate'],
      isRecurring ? '#5b3df0' : '#0f172a'
    );

    if (!isRecurring) {
      if (action === 'add') {
        sheet.appendRow([
          data.id,
          data.type,
          data.categoryName,
          data.accountName,
          data.amount,
          normalizeText_(data.barcodeNote, ''),
          data.date,
          normalizeText_(data.isoDate, '')
        ]);
      } else if (action === 'delete' || action === 'edit') {
        upsertRowById_(
          sheet,
          data.id,
          8,
          [
            data.id,
            data.type,
            data.categoryName,
            data.accountName,
            data.amount,
            normalizeText_(data.barcodeNote, ''),
            data.date,
            normalizeText_(data.isoDate, '')
          ],
          action
        );
      }
    } else {
      if (action === 'add') {
        sheet.appendRow([
          data.id,
          data.name,
          data.desc,
          data.amount,
          normalizeText_(data.categoryId || data.category, ''),
          normalizeText_(data.accountId || data.account, ''),
          normalizeText_(data.lastPaidMonth, '')
        ]);
      } else if (action === 'delete' || action === 'edit') {
        upsertRowById_(
          sheet,
          data.id,
          7,
          [
            data.id,
            data.name,
            data.desc,
            data.amount,
            normalizeText_(data.categoryId || data.category, ''),
            normalizeText_(data.accountId || data.account, ''),
            normalizeText_(data.lastPaidMonth, '')
          ],
          action
        );
      }
    }

    return textResponse('Success');
  } catch (error) {
    return textResponse('Error: ' + error.message);
  }
}
