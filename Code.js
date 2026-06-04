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
      isoDate: asString_(row.IsoDate || row.isoDate),
      budgetGroupId: asString_(row.BudgetGroupId || row.budgetGroupId),
      budgetGroupName: asString_(row.BudgetGroupName || row.budgetGroupName),
      budgetGroupType: asString_(row.BudgetGroupType || row.budgetGroupType)
    };
  }).filter(function (row) { return row.id !== ''; });
}

function readRecurring_(sheetName) {
  return readRows_(sheetName).map(function (row) {
    var id = row.ID !== undefined ? row.ID : row.id;
    var categoryId = asString_(row.CategoryId || row.categoryId || row.Category || row.category);
    var accountId = asString_(row.AccountId || row.accountId || row.Account || row.account);
    var defaultBudgetGroupId = asString_(row.DefaultBudgetGroupId || row.defaultBudgetGroupId);
    return {
      id: asNumber_(id) || asString_(id),
      name: asString_(row.Name || row.name),
      desc: asString_(row.Date_Desc || row.desc || row.Desc),
      amount: asNumber_(row.Amount || row.amount),
      categoryId: categoryId,
      accountId: accountId,
      category: categoryId,
      account: accountId,
      lastPaidMonth: asString_(row.LastPaidMonth || row.lastPaidMonth),
      defaultBudgetGroupId: defaultBudgetGroupId
    };
  }).filter(function (row) { return row.id !== ''; });
}

function readBudget_(sheetName) {
  return readRows_(sheetName).map(function (row) {
    var id = row.ID !== undefined ? row.ID : row.id;
    var parentId = row.ParentId !== undefined ? row.ParentId : row.parentId;
    var isArchived = row.IsArchived !== undefined ? row.IsArchived : row.isArchived;
    return {
      id: asNumber_(id) || asString_(id),
      name: asString_(row.Name || row.name),
      budget: asNumber_(row.Budget || row.budget),
      remaining: asNumber_(row.Remaining || row.remaining),
      parentId: parentId ? (asNumber_(parentId) || asString_(parentId)) : null,
      color: asString_(row.Color || row.color),
      order: asNumber_(row.Order || row.order),
      isArchived: isArchived === true || isArchived === 'true' || isArchived === 1 || isArchived === '1'
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
        recurring: readRecurring_(profileId + '_Recurring'),
        budget: readBudget_(profileId + '_Budget')
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

function processSingleOperation_(ss, data) {
    var action = data.action || 'add';
    var sheetName = data.sheetName || 'User1_History';
    
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
        profileSheet.appendRow(["'" + String(data.profileId), data.name, imageUrl]); // Prevent ID mutation
      }
      return { status: 'Success', imageUrl: imageUrl };
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
      return { status: 'Success' };
    }

    var isBudget = sheetName.indexOf('Budget') !== -1;
    var isRecurring = sheetName.indexOf('Recurring') !== -1;
    
    var headers;
    var headerBg;
    if (isBudget) {
      headers = ['ID', 'Name', 'Budget', 'Remaining', 'ParentId', 'Color', 'Order', 'IsArchived'];
      headerBg = '#4f46e5';
    } else if (isRecurring) {
      headers = ['ID', 'Name', 'Date_Desc', 'Amount', 'Category', 'Account', 'LastPaidMonth', 'DefaultBudgetGroupId'];
      headerBg = '#5b3df0';
    } else {
      headers = ['ID', 'Type', 'CategoryName', 'AccountName', 'Amount', 'BarcodeNote', 'Date', 'IsoDate', 'BudgetGroupId', 'BudgetGroupName', 'BudgetGroupType'];
      headerBg = '#0f172a';
    }

    // Instead of getSheetByName, if we had sheetId mapping we would use it, but for simplicity and legacy support, we use name.
    var sheet = ensureSheet_(ss, sheetName, headers, headerBg);
    
    // Prevent Data Type Mutation by prepending ' to ID
    var safeId = data.id !== undefined && data.id !== null ? "'" + String(data.id) : null;

    var rowArray;
    if (isBudget) {
      rowArray = [
        safeId, data.name, data.budget, data.remaining, normalizeText_(data.parentId, ''),
        data.color, data.order, data.isArchived
      ];
    } else if (!isRecurring) {
      rowArray = [
        safeId, data.type, data.categoryName, data.accountName, data.amount,
        normalizeText_(data.barcodeNote, ''), data.date, normalizeText_(data.isoDate, ''),
        normalizeText_(data.budgetGroupId, ''), normalizeText_(data.budgetGroupName, ''), normalizeText_(data.budgetGroupType, '')
      ];
    } else {
      rowArray = [
        safeId, data.name, data.desc, data.amount, normalizeText_(data.categoryId || data.category, ''),
        normalizeText_(data.accountId || data.account, ''), normalizeText_(data.lastPaidMonth, ''), normalizeText_(data.defaultBudgetGroupId, '')
      ];
    }

    if (action === 'add') {
      sheet.appendRow(rowArray);
    } else if (action === 'delete' || action === 'edit') {
      upsertRowById_(sheet, data.id, rowArray.length, rowArray, action);
    }

    return { status: 'Success', id: data.id, action: action };
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    // Wait for up to 30 seconds for other concurrent requests to finish
    lock.waitLock(30000);
  } catch (lockError) {
    return textResponse('Error: System is busy, could not obtain lock. Please try again.');
  }

  try {
    var data = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    var ss = SpreadsheetApp.getActiveSpreadsheet();

    if (data.action === 'batch' && data.operations && Array.isArray(data.operations)) {
      // Process batch queue
      var results = [];
      for (var i = 0; i < data.operations.length; i++) {
        var op = data.operations[i];
        results.push(processSingleOperation_(ss, op));
      }
      return jsonResponse({ status: 'Success', results: results });
    } else {
      // Legacy single operation support
      var result = processSingleOperation_(ss, data);
      return result.imageUrl !== undefined ? jsonResponse(result) : textResponse('Success');
    }
  } catch (error) {
    return textResponse('Error: ' + error.message);
  } finally {
    // Release lock immediately after finishing
    lock.releaseLock();
  }
}
