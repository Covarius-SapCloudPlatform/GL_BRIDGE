(function() {
	// -------------------------------------------------------- // 
	// Description                                              //
	// -------------------------------------------------------- //
	// Author: Jacques Otto                                     //
	// Company: Covarius                                        //
	// Date: 2018-06-15                                         //
	// Description: REST service to be able to create entries   //
	// in the Results GL Tables after Posting.POST method is    //
	// allowed.                                                 //
	//----------------------------------------------------------//

	// -------------------------------------------------------- // 
	// Global Variables                                         //
	// -------------------------------------------------------- //
	//Variable to carry the table update status
	var gvTableUpdate;

	//Variable to carry the conversion errors
	var gvConvError;

	//Variables declaring the table details
	var gvSchemaName = 'COV_SCH_GL_BRIDGE';
	var gvHeaderTable = 'COV_RESULT_GL_HEADER';
	var gvItemTable = 'COV_RESULT_GL_ITEM';
	var gvCurrencyTable = 'COV_RESULT_GL_CURRENCY';

	//Get the Message Guid from HTTP Header
	var gvGuid;

	for (var i = 0; i < $.request.headers.length; ++i) {
		var lvName = $.request.headers[i].name;
		var lvValue = $.request.headers[i].value;

		if (lvName === "SCI_GUID" || lvName === "sci_guid") {
			gvGuid = lvValue;
			break;
		}
	}

	//Variables for Get Operations
	var gvSapDocument = $.request.parameters.get('sapDocument');
	var gvFiscalYear = $.request.parameters.get('fiscalYear');
	var gvCompanyCode = $.request.parameters.get('companyCode'),
		gvCompanyCodes;
	var gvItemNo = $.request.parameters.get('itemNo');
	var gvPostingDate = $.request.parameters.get('postingDate'),
		gvPostingDates;
	var gvReferenceDocument = $.request.parameters.get('referenceDocument');
	var gvGlAccount = $.request.parameters.get('glAccount'),
		gvGlAccounts;
	var gvPostingStatus = $.request.parameters.get('postingStatus'),
		gvPostingStatuses;
	var gvOrderby = $.request.parameters.get('orderBy');

	var gvErrorMessage;
	//Area = HEADER, ITEM, CURRENCY
	var gvArea = $.request.parameters.get('area');

	//Check if there are multiple Posting Date Restrictions
	if (gvPostingDate) {
		if (gvPostingDate.indexOf(',') !== -1) {
			gvPostingDates = gvPostingDate.split(',');
		}
	}

	//Check if there are multiple Company Code Restrictions
	if (gvCompanyCode) {
		if (gvCompanyCode.indexOf(',') !== -1) {
			gvCompanyCodes = gvCompanyCode.split(',');
		}
	}

	//Check if there are multiple GL Account Restrictions
	if (gvGlAccount) {
		if (gvGlAccount.indexOf(',') !== -1) {
			gvGlAccounts = gvGlAccount.split(',');
		}
	}

	//Check if there are multiple Posting Status Restrictions
	if (gvPostingStatus) {
		if (gvPostingStatus.indexOf(',') !== -1) {
			gvPostingStatuses = gvPostingStatus.split(',');
		}
	}

	//Check if first character of sapDocument is a 0, then remove it
	if (gvSapDocument) {
		if (gvSapDocument.substring(0, 1) === "0") {
			gvSapDocument = gvSapDocument.substring("1");
		}
	}

	// -------------------------------------------------------- // 
	// Execute Main Function                                    //
	// -------------------------------------------------------- //
	main();

	// -------------------------------------------------------- // 
	// Main function to add entries to the Input Tables         //
	// -------------------------------------------------------- //
	function main() {

		//Check the Method
		if ($.request.method === $.net.http.GET) {
			try {
				switch (gvArea) {
					case "HEADER":
						_getHeader();
						break;
					case "ITEM":
						_getItem();
						break;
					case "ITEM_AMOUNT":
						_getItemAmount();
						break;
					default:
						_getHeader();
						break;
				}
			} catch (errorObj) {
				//Set the Response
				$.response.status = 200;
				$.response.setBody(JSON.stringify({
					message: "API Called",
					result: gvErrorMessage
				}));
			}
		} else {
			//Perform Table Entry to be created in Table
			try {
				if (gvGuid) {
					_createEntries();
				}
			} catch (errorObj) {
				gvTableUpdate = "Error during table insert:" + errorObj.message;
			}

			$.response.status = 200;
			$.response.setBody(JSON.stringify({
				message: "API Called",
				TableUpdateStatus: gvTableUpdate
			}));
		}
	}

	// ----------------------------------------------------------------// 
	// Function to insert entries into the results tables              //
	// ----------------------------------------------------------------//
	function _createEntries() {
		//Get the Body
		var oBody = JSON.parse($.request.body.asString());

		if (oBody.d.AccountingDocNo) {
			var lvStatus = _createHeaderEntry();

			if (lvStatus === "SUCCESS") {
				_createItemEntries();
				_createCurrencyEntries();
			}
		}
	}

	// ----------------------------------------------------------------// 
	// Function to insert entries into the header table                //
	// ----------------------------------------------------------------//
	function _createHeaderEntry() {
		var lvStatus;

		try {
			//Get the Body
			var oBody = JSON.parse($.request.body.asString());

			if (gvGuid && oBody.d.AccountingDocNo) {
				//Get the Database connection
				var oConnection = $.db.getConnection();

				//Build the Statement to insert the entries
				var oStatement = oConnection.prepareStatement('INSERT INTO "' + gvSchemaName + '"."' + gvHeaderTable +
					'" VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');

				//Populate the fields with values from the incoming payload
				//SAP Document
				oStatement.setString(1, oBody.d.AccountingDocNo);
				//Fiscal Year
				oStatement.setString(2, oBody.d.FiscalYear);
				//Company Code
				oStatement.setString(3, oBody.d.CompanyCode);
				//Message GUID
				oStatement.setString(4, gvGuid);
				//Reference Key
				oStatement.setString(5, oBody.d.ObjectKey);
				//Business Transaction
				oStatement.setString(6, oBody.d.BusinessTransaction);
				//HeaderText
				oStatement.setString(7, oBody.d.HeaderText);
				//Document Date
				oStatement.setDate(8, oBody.d.DocumentDate);
				//Posting Date
				oStatement.setDate(9, oBody.d.PostingDate);
				//Translation Date
				if (oBody.d.TranslationDate) {
					oStatement.setDate(10, oBody.d.TranslationDate);
				} else {
					oStatement.setDate(10, "");
				}
				//Fiscal Period
				oStatement.setString(11, oBody.d.FiscalPeriod);
				//Document Type
				oStatement.setString(12, oBody.d.DocumentType);
				//Reference Document
				oStatement.setString(13, oBody.d.ReferenceDocNo);
				//Reference Document Number Long
				oStatement.setString(14, oBody.d.ReferenceDocNoLong);
				//Accounting Principle
				oStatement.setString(15, oBody.d.AccountingPrinciple);
				//Billing Category
				oStatement.setString(16, oBody.d.BillingCategory);
				//Status Code
				oStatement.setString(17, oBody.d.ERPStatus);
				//Status Message
				oStatement.setString(18, oBody.d.ReturnMessage);
				//Document Status
				oStatement.setString(19, oBody.d.DocumentStatus);
				//Document Status Description
				oStatement.setString(20, oBody.d.DocumentStatusDescription);
				//Post Indicator
				if (oBody.d.PostIndicator) {
					oStatement.setString(21, oBody.d.PostIndicator.toString());
				} else {
					oStatement.setString(21, "false");
				}
				//Account Type
				oStatement.setString(22, oBody.d.AccountType);
				//Entry Date
				var lvDate = new Date();
				var lvDateString = lvDate.toISOString().substring(0, 10);
				oStatement.setDate(23, lvDateString);
				//Update GUID
				oStatement.setString(24, gvGuid);

				//Add Batch process to executed on the database
				oStatement.addBatch();

				//Execute the Insert
				oStatement.executeBatch();

				//Close the connection
				oStatement.close();
				oConnection.commit();
				oConnection.close();

				gvTableUpdate += ",Table entry created for " + gvHeaderTable;
				lvStatus = "SUCCESS";
			} else {
				gvTableUpdate += ",Table entry not created for " + gvHeaderTable + " key values missing";
				lvStatus = "ERROR";
			}

		} catch (errorObj) {
			gvTableUpdate += ",Error saving Payload Header field level entries:" + errorObj.message;
			lvStatus = "ERROR";
		}
		return lvStatus;
	}

	// ----------------------------------------------------------------// 
	// Function to insert entries into the item table                  //
	// ----------------------------------------------------------------//
	function _createItemEntries() {
		var lvStatus;
		try {
			//Get the Request Body
			var oBody = JSON.parse($.request.body.asString());

			//Get the Database connection
			var oConnection = $.db.getConnection();

			//Build the Statement to insert the entries
			var oStatement = oConnection.prepareStatement('INSERT INTO "' + gvSchemaName + '"."' + gvItemTable +
				'" VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');

			//Item Number Initialization
			var item = 0;
			var oItems = oBody.d.ToItem.results;

			//Prepare the Batch Statement
			oStatement.setBatchSize(oItems.length);

			//Populate the fields with values from the incoming payload
			for (var i = 0; i < oItems.length; i++) {
				//SAP Document
				oStatement.setString(1, oBody.d.AccountingDocNo);
				//Fiscal Year
				oStatement.setString(2, oBody.d.FiscalYear);
				//Company Code
				oStatement.setString(3, oBody.d.CompanyCode);

				//Item
				if (!oItems[i].ItemNumber) {
					item = item + 1;
					var itemNumber = padToThree(item);
					oStatement.setString(4, itemNumber);
				} else {
					oStatement.setString(4, oItems[i].ItemNumber);
				}

				//GL Account
				oStatement.setString(5, oItems[i].GLAccount);
				//Value Date
				oStatement.setDate(6, oItems[i].ValueDate);
				//Posting Date
				oStatement.setDate(7, oItems[i].PostingDate);
				//Item Text
				oStatement.setString(8, oItems[i].ItemText);
				//Ref Key 1
				oStatement.setString(9, oItems[i].RefKey1);
				//Ref Key 2
				oStatement.setString(10, oItems[i].RefKey2);
				//Ref Key 3
				oStatement.setString(11, oItems[i].RefKey3);
				//Account Type
				oStatement.setString(12, oItems[i].AccountType);
				//Document Type
				oStatement.setString(13, oItems[i].DocumentType);
				//Fiscal Period
				if (oItems[i].FiscalPeriod !== "00") {
					oStatement.setString(14, oItems[i].FiscalPeriod);
				} else {
					oStatement.setString(14, oBody.d.FiscalPeriod);
				}
				//Profit Center
				oStatement.setString(15, oItems[i].ProfitCenter);
				//Assignment Number
				oStatement.setString(16, oItems[i].AssignmentNumber);
				//Trading Partner
				oStatement.setString(17, oItems[i].TradingPartner);
				//Customer
				oStatement.setString(18, oItems[i].Customer);
				//Vendor
				oStatement.setString(19, oItems[i].VendorNo);
				//Entry Date
				var lvDate = new Date();
				var lvDateString = lvDate.toISOString().substring(0, 10);
				oStatement.setDate(20, lvDateString);
				//Cost Center
				oStatement.setString(21, oItems[i].CostCenter);
				//Partner Profit Center
				oStatement.setString(22, oItems[i].ProfitCenterPartner);

				//Add Batch process to executed on the database
				oStatement.addBatch();
			}

			//Execute the Insert
			oStatement.executeBatch();

			//Close the connection
			oStatement.close();
			oConnection.commit();
			oConnection.close();

			gvTableUpdate += ",Table entries created for " + gvItemTable;
			lvStatus = "SUCCESS";
		} catch (errorObj) {
			gvTableUpdate += ",Error saving Payload Item field level entries:" + errorObj.message;
			lvStatus = "ERROR";
		}
	}

	// ----------------------------------------------------------------// 
	// Function to insert entries into the currency table              //
	// ----------------------------------------------------------------//
	function _createCurrencyEntries() {
		try {
			//Get the Request Body
			var oBody = JSON.parse($.request.body.asString());

			//Get the Database connection
			var oConnection = $.db.getConnection();

			//Build the Statement to insert the entries
			var oStatement = oConnection.prepareStatement('INSERT INTO "' + gvSchemaName + '"."' + gvCurrencyTable +
				'" VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');

			//Item Number Initialization
			var item = 0;
			var oItems = oBody.d.ToCurrency.results;

			//Prepare the Batch Statement
			oStatement.setBatchSize(oItems.length);

			//Populate the fields with values from the incoming payload
			for (var i = 0; i < oItems.length; i++) {
				//SAP Document
				oStatement.setString(1, oBody.d.AccountingDocNo);
				//Fiscal Year
				oStatement.setString(2, oBody.d.FiscalYear);
				//Company Code
				oStatement.setString(3, oBody.d.CompanyCode);

				//Item
				if (!oItems[i].ItemNumber) {
					item = item + 1;
					var itemNumber = padToThree(item);
					oStatement.setString(4, itemNumber);
				} else {
					oStatement.setString(4, oItems[i].ItemNumber);
				}

				//Currency Type
				oStatement.setString(5, oItems[i].CurrencyType);
				//Currency
				oStatement.setString(6, oItems[i].CurrencyKey);
				//Currency ISO
				oStatement.setString(7, oItems[i].CurrencyIso);
				//Amount
				oStatement.setDecimal(8, oItems[i].Amount);
				//Exchange Rate
				if (oItems[i].ExchangeRate) {
					oStatement.setDecimal(9, oItems[i].ExchangeRate);
				} else {
					oStatement.setDecimal(9, 0);
				}
				//Indirect Exchange Rate
				if (oItems[i].IndirectExchangeRate) {
					oStatement.setDecimal(10, oItems[i].IndirectExchangeRate);
				} else {
					oStatement.setDecimal(10, 0);
				}
				//Amount Base
				if (oItems[i].AmountBase) {
					oStatement.setDecimal(11, oItems[i].AmountBase);
				} else {
					oStatement.setDecimal(11, 0);
				}
				//Discount Base
				if (oItems[i].DiscountBase) {
					oStatement.setString(12, oItems[i].DiscountBase);
				} else {
					oStatement.setString(12, 0);
				}
				//Discount Amount
				if (oItems[i].DiscountAmt) {
					oStatement.setString(13, oItems[i].DiscountAmt);
				} else {
					oStatement.setString(13, 0);
				}
				//Tax Amount
				if (oItems[i].TaxAmount) {
					oStatement.setString(14, oItems[i].TaxAmount);
				} else {
					oStatement.setString(14, 0);
				}
				//Entry Date
				var lvDate = new Date();
				var lvDateString = lvDate.toISOString().substring(0, 10);
				oStatement.setDate(15, lvDateString);

				//Add Batch process to executed on the database
				oStatement.addBatch();
			}

			//Execute the Insert
			oStatement.executeBatch();

			//Close the connection
			oStatement.close();
			oConnection.commit();
			oConnection.close();

			gvTableUpdate += ",Table entries created for " + gvCurrencyTable;

		} catch (errorObj) {
			gvTableUpdate += ",Error saving Payload Currency field level entries:" + errorObj.message;
		}
	}
	// -------------------------------------------------------- // 
	// Function to Pad Item Number                             //
	// -------------------------------------------------------- //	
	function padToThree(number) {
		if (number <= 999) {
			number = ("00" + number).slice(-3);
		}
		return number;
	}

	// -------------------------------------------------------- // 
	// Function to read the Header Table                        //
	// -------------------------------------------------------- //	
	function _getHeader() {
		var status,
			lvSapDocument,
			lvCompanyCode,
			lvFiscalYear;

		try {
			//Variable to keep query statement 
			var lvQuery =
				'SELECT J1."SAP_DOCUMENT", J1."FISCAL_YEAR", J1."COMPANY_CODE", J1."MESSAGE_GUID", J1."REFERENCE_KEY", J1."BUSINESS_TRANSACTION", J1."HEADERTEXT", J1."DOCUMENT_DATE",';
			lvQuery = lvQuery +
				'J1."POSTING_DATE", J1."TRANSLATION_DATE", J1."FISCAL_PERIOD", J1."DOCUMENT_TYPE", J1."REFERENCE_DOCUMENT", J1."REFERENCE_DOC_NO_LONG", J1."ACCOUNTING_PRINCIPLE",';
			lvQuery = lvQuery +
				'J1."BILLING_CATEGORY", J1."STATUS_CODE", J1."STATUS_MESSAGE", J1."DOCUMENT_STATUS", J1."DOCUMENT_STATUS_DESCRIPTION", J1."POST_INDICATOR", J1."ACCOUNT_TYPE", ';
			lvQuery = lvQuery +
				'J1."ENTRY_DATE", J1."UPDATE_GUID", J1."DOCUMENT_STATUS_DESCRIPTION", J1."POST_INDICATOR", J1."ACCOUNT_TYPE", J1."ENTRY_DATE", J1."UPDATE_GUID"';
			lvQuery = lvQuery + 'FROM "' + gvSchemaName + '"."' + gvHeaderTable + '" as J1 ';

			//Check if GL Account is used as restriction, then add the join
			if (gvGlAccount) {
				lvQuery = lvQuery + 'FULL OUTER JOIN "' + gvSchemaName + '"."' + gvItemTable + '" as J2 ';
				lvQuery = lvQuery + 'ON J1."SAP_DOCUMENT" = J2."SAP_DOCUMENT" ';
				lvQuery = lvQuery + 'AND J1."FISCAL_YEAR" = J2."FISCAL_YEAR" ';
				lvQuery = lvQuery + 'AND J1."COMPANY_CODE" = J2."COMPANY_CODE" ';
			}

			//GL Account Restriction
			if (!gvGlAccounts && gvGlAccount) {
				if (lvQuery.indexOf('WHERE') === -1) {
					lvQuery = lvQuery + ' WHERE J2."GL_ACCOUNT" = ' + "'" + gvGlAccount + "'";
				} else {
					lvQuery = lvQuery + ' AND J2."GL_ACCOUNT" = ' + "'" + gvGlAccount + "'";
				}
			} else if (gvGlAccounts) {
				for (var j = 0; j <= gvGlAccounts.length; j++) {
					if (gvGlAccounts[j]) {
						if (j === 0) {
							if (lvQuery.indexOf('WHERE') === -1) {
								lvQuery = lvQuery + ' WHERE ( J2."GL_ACCOUNT" = ' + "'" + gvGlAccounts[j] + "'";
							} else {
								lvQuery = lvQuery + ' AND ( J2."GL_ACCOUNT" = ' + "'" + gvGlAccounts[j] + "'";
							}

						} else {
							lvQuery = lvQuery + ' OR J2."GL_ACCOUNT" = ' + "'" + gvGlAccounts[j] + "' )";
						}
					}
				}
			}

			//SAP Document Restrictions
			if (gvSapDocument) {
				lvQuery = lvQuery + ' WHERE J1."SAP_DOCUMENT" = ' + "'" + gvSapDocument + "'";
			}

			//Fiscal Year
			if (gvFiscalYear) {
				if (lvQuery) {
					if (lvQuery.indexOf('WHERE') === -1) {
						lvQuery = lvQuery + ' WHERE J1."FISCAL_YEAR" = ' + "'" + gvFiscalYear + "'";
					} else {
						lvQuery = lvQuery + ' AND J1."FISCAL_YEAR" = ' + "'" + gvFiscalYear + "'";
					}
				} else {
					lvQuery = lvQuery + ' WHERE J1."FISCAL_YEAR" = ' + "'" + gvFiscalYear + "'";
				}
			}

			//Company Code Restriction
			if (!gvCompanyCodes && gvCompanyCode) {
				if (lvQuery.indexOf('WHERE') === -1) {
					lvQuery = lvQuery + ' WHERE J1."COMPANY_CODE" = ' + "'" + gvCompanyCode + "'";
				} else {
					lvQuery = lvQuery + ' AND J1."COMPANY_CODE" = ' + "'" + gvCompanyCode + "'";
				}
			} else if (gvCompanyCodes) {
				for (var j = 0; j <= gvCompanyCodes.length; j++) {
					if (gvCompanyCodes[j]) {
						if (j === 0) {
							if (lvQuery.indexOf('WHERE') === -1) {
								lvQuery = lvQuery + ' WHERE ( J1."COMPANY_CODE" = ' + "'" + gvCompanyCodes[j] + "'";
							} else {
								lvQuery = lvQuery + ' AND ( J1."COMPANY_CODE" = ' + "'" + gvCompanyCodes[j] + "'";
							}

						} else {
							lvQuery = lvQuery + ' OR J1."COMPANY_CODE" = ' + "'" + gvCompanyCodes[j] + "' )";
						}
					}
				}
			}

			//Posting Date Restriction
			if (!gvPostingDates && gvPostingDate) {
				if (lvQuery.indexOf('WHERE') === -1) {
					lvQuery = lvQuery + ' WHERE J1."POSTING_DATE" = ' + "'" + gvPostingDate + "'";
				} else {
					lvQuery = lvQuery + ' AND J1."POSTING_DATE" = ' + "'" + gvPostingDate + "'";
				}
			} else if (gvPostingDates) {
				for (var j = 0; j <= gvPostingDates.length; j++) {
					if (gvPostingDates[j]) {
						if (j === 0) {
							if (lvQuery.indexOf('WHERE') === -1) {
								lvQuery = lvQuery + ' WHERE ( J1."POSTING_DATE" = ' + "'" + gvPostingDates[j] + "'";
							} else {
								lvQuery = lvQuery + ' AND ( J1."POSTING_DATE" = ' + "'" + gvPostingDates[j] + "'";
							}

						} else {
							lvQuery = lvQuery + ' OR J1."POSTING_DATE" = ' + "'" + gvPostingDates[j] + "' )";
						}
					}
				}
			}

			if (gvReferenceDocument) {
				if (lvQuery) {
					if (lvQuery.indexOf('WHERE') === -1) {
						lvQuery = lvQuery + ' WHERE J1."REFERENCE_DOCUMENT" = ' + "'" + gvReferenceDocument + "'";
					} else {
						lvQuery = lvQuery + ' AND J1."REFERENCE_DOCUMENT" = ' + "'" + gvReferenceDocument + "'";
					}
				} else {
					lvQuery = lvQuery + ' WHERE J1."REFERENCE_DOCUMENT" = ' + "'" + gvReferenceDocument + "'";
				}
			}

			//Posting Status Restriction
			if (!gvPostingStatus && gvPostingStatuses) {
				if (gvPostingStatus === "Parked") {
					status = "V";
				} else {
					status = "";
				}
				if (lvQuery.indexOf('WHERE') === -1) {
					lvQuery = lvQuery + ' WHERE J1."DOCUMENT_STATUS" = ' + "'" + status + "'";
				} else {
					lvQuery = lvQuery + ' AND J1."DOCUMENT_STATUS" = ' + "'" + status + "'";
				}
			} else if (gvPostingStatuses) {
				for (var j = 0; j <= gvPostingStatuses.length; j++) {
					if (gvPostingStatuses[j]) {
						if (gvPostingStatuses[j] === "Parked") {
							status = "V";
						} else {
							status = "";
						}
						if (j === 0) {
							if (lvQuery.indexOf('WHERE') === -1) {
								lvQuery = lvQuery + ' WHERE ( J1."DOCUMENT_STATUS" = ' + "'" + status + "'";
							} else {
								lvQuery = lvQuery + ' AND ( J1."DOCUMENT_STATUS" = ' + "'" + status + "'";
							}

						} else {
							lvQuery = lvQuery + ' OR J1."DOCUMENT_STATUS" = ' + "'" + status + "' )";
						}
					}
				}
			}

			//Connect to the Database and execute the query
			var oConnection = $.db.getConnection();
			var oStatement = oConnection.prepareStatement(lvQuery);
			oStatement.execute();
			var oResultSet = oStatement.getResultSet();
			var oResult = {
				records: []
			};
			while (oResultSet.next()) {

				var record = {
					SAP_DOCUMENT: oResultSet.getString(1),
					FISCAL_YEAR: oResultSet.getString(2),
					COMPANY_CODE: oResultSet.getString(3),
					MESSAGE_GUID: oResultSet.getString(4),
					REFERENCE_KEY: oResultSet.getString(5),
					BUSINESS_TRANSACTION: oResultSet.getString(6),
					HEADERTEXT: oResultSet.getString(7),
					DOCUMENT_DATE: oResultSet.getString(8),
					POSTING_DATE: oResultSet.getString(9),
					TRANSLATION_DATE: oResultSet.getString(10),
					FISCAL_PERIOD: oResultSet.getString(11),
					DOCUMENT_TYPE: oResultSet.getString(12),
					REFERENCE_DOCUMENT: oResultSet.getString(13),
					REFERENCE_DOC_NO_LONG: oResultSet.getString(14),
					ACCOUNTING_PRINCIPLE: oResultSet.getString(15),
					BILLING_CATEGORY: oResultSet.getString(16),
					STATUS_CODE: oResultSet.getString(17),
					STATUS_MESSAGE: oResultSet.getString(18),
					DOCUMENT_STATUS: oResultSet.getString(19),
					DOCUMENT_STATUS_DESCRIPTION: oResultSet.getString(20),
					POST_INDICATOR: oResultSet.getString(21),
					ACCOUNT_TYPE: oResultSet.getString(22),
					ENTRY_DATE: oResultSet.getString(23),
					UPDATE_GUID: oResultSet.getString(24)
				};

				if (lvSapDocument !== oResultSet.getString(1)) {
					oResult.records.push(record);
					lvSapDocument = oResultSet.getString(1);
					lvCompanyCode = oResultSet.getString(3);
					lvFiscalYear = oResultSet.getString(2);
				} else {
					lvSapDocument = oResultSet.getString(1);
					lvCompanyCode = oResultSet.getString(3);
					lvFiscalYear = oResultSet.getString(2);
				}
				record = "";

			}
			oResultSet.close();
			oStatement.close();
			oConnection.close();

			//Return the result
			$.response.contentType = "application/json; charset=UTF-8";
			$.response.setBody(JSON.stringify(oResult));
			$.response.status = $.net.http.OK;

		} catch (errorObj) {
			gvErrorMessage = errorObj.message;
			if (oStatement !== null) {
				oStatement.close();
			}
			if (oConnection !== null) {
				oConnection.close();
			}
		}
	}

	// -------------------------------------------------------- // 
	// Function to read the Item Table                          //
	// -------------------------------------------------------- //	
	function _getItem() {
		try {
			//Variable to keep query statement 
			var lvQuery;

			if (!gvSapDocument && !gvFiscalYear && !gvCompanyCode && !gvPostingDate && !gvItemNo && !gvGlAccount) {
				lvQuery = 'SELECT * FROM "' + gvSchemaName + '"."' + gvItemTable + '"';

				if (gvOrderby) {
					if (lvQuery) {
						lvQuery = lvQuery + ' ORDER BY ' + '"' + gvOrderby + '"';
					}
				}

			} else {
				lvQuery = 'SELECT * FROM "' + gvSchemaName + '"."' + gvItemTable + '"';
				if (gvSapDocument) {
					lvQuery = lvQuery + ' WHERE SAP_DOCUMENT = ' + "'" + gvSapDocument + "'";
				}
				if (gvFiscalYear) {
					if (lvQuery) {
						if (lvQuery.indexOf('WHERE') === -1) {
							lvQuery = lvQuery + ' WHERE FISCAL_YEAR = ' + "'" + gvFiscalYear + "'";
						} else {
							lvQuery = lvQuery + ' AND FISCAL_YEAR = ' + "'" + gvFiscalYear + "'";
						}
					} else {
						lvQuery = lvQuery + ' WHERE FISCAL_YEAR = ' + "'" + gvFiscalYear + "'";
					}
				}
				if (gvCompanyCode) {
					if (lvQuery) {
						if (lvQuery.indexOf('WHERE') === -1) {
							lvQuery = lvQuery + ' WHERE COMPANY_CODE = ' + "'" + gvCompanyCode + "'";
						} else {
							lvQuery = lvQuery + ' AND COMPANY_CODE = ' + "'" + gvCompanyCode + "'";
						}
					} else {
						lvQuery = lvQuery + ' WHERE COMPANY_CODE = ' + "'" + gvCompanyCode + "'";
					}
				}
				if (gvPostingDate) {
					if (lvQuery) {
						if (lvQuery.indexOf('WHERE') === -1) {
							lvQuery = lvQuery + ' WHERE POSTING_DATE = ' + "'" + gvPostingDate + "'";
						} else {
							lvQuery = lvQuery + ' AND POSTING_DATE = ' + "'" + gvPostingDate + "'";
						}
					} else {
						lvQuery = lvQuery + ' WHERE POSTING_DATE = ' + "'" + gvPostingDate + "'";
					}
				}
				if (gvItemNo) {
					if (lvQuery) {
						if (lvQuery.indexOf('WHERE') === -1) {
							lvQuery = lvQuery + ' WHERE ITEM_NO = ' + "'" + gvItemNo + "'";
						} else {
							lvQuery = lvQuery + ' AND ITEM_NO = ' + "'" + gvItemNo + "'";
						}
					} else {
						lvQuery = lvQuery + ' WHERE ITEM_NO = ' + "'" + gvItemNo + "'";
					}
				}
				if (gvGlAccount) {
					if (lvQuery) {
						if (lvQuery.indexOf('WHERE') === -1) {
							lvQuery = lvQuery + ' WHERE GL_ACCOUNT = ' + "'" + gvGlAccount + "'";
						} else {
							lvQuery = lvQuery + ' AND GL_ACCOUNT = ' + "'" + gvGlAccount + "'";
						}
					} else {
						lvQuery = lvQuery + ' WHERE GL_ACCOUNT = ' + "'" + gvGlAccount + "'";
					}
				}
				if (gvOrderby) {
					if (lvQuery) {
						lvQuery = lvQuery + ' ORDER BY ' + '"' + gvOrderby + '"';
					}
				}
			}

			//Connect to the Database and execute the query
			var oConnection = $.db.getConnection();
			var oStatement = oConnection.prepareStatement(lvQuery);
			oStatement.execute();
			var oResultSet = oStatement.getResultSet();
			var oResult = {
				records: []
			};
			while (oResultSet.next()) {

				var record = {
					SAP_DOCUMENT: oResultSet.getString(1),
					FISCAL_YEAR: oResultSet.getString(2),
					COMPANY_CODE: oResultSet.getString(3),
					ITEM_NO: oResultSet.getString(4),
					GL_ACCOUNT: oResultSet.getString(5),
					VALUE_DATE: oResultSet.getString(6),
					POSTING_DATE: oResultSet.getString(7),
					ITEM_TEXT: oResultSet.getString(8),
					REF_KEY1: oResultSet.getString(9),
					REF_KEY2: oResultSet.getString(10),
					REF_KEY3: oResultSet.getString(11),
					ACCOUNT_TYPE: oResultSet.getString(12),
					DOCUMENT_TYPE: oResultSet.getString(13),
					FISCAL_PERIOD: oResultSet.getString(14),
					PROFIT_CENTER: oResultSet.getString(15),
					ASSIGNMENT_NUMBER: oResultSet.getString(16),
					TRADING_PARTNER: oResultSet.getString(17),
					CUSTOMER: oResultSet.getString(18),
					VENDOR: oResultSet.getString(19),
					ENTRY_DATE: oResultSet.getString(20)
				};

				oResult.records.push(record);
				record = "";
			}
			oResultSet.close();
			oStatement.close();
			oConnection.close();

			//Return the result
			$.response.contentType = "application/json; charset=UTF-8";
			$.response.setBody(JSON.stringify(oResult));
			$.response.status = $.net.http.OK;

		} catch (errorObj) {
			gvErrorMessage = errorObj.message;
			if (oStatement !== null) {
				oStatement.close();
			}
			if (oConnection !== null) {
				oConnection.close();
			}
		}
	}

	// -------------------------------------------------------- // 
	// Function to read the Item Amounts from Tables            //
	// -------------------------------------------------------- //	
	function _getItemAmount() {
		try {
			//Variable to keep query statement 
			var lvQuery;

			lvQuery = 'SELECT J1."SAP_DOCUMENT", J1."FISCAL_YEAR", J1."COMPANY_CODE", J1."ITEM_NO",';
			lvQuery = lvQuery + 'J1."GL_ACCOUNT", J1."VALUE_DATE", J1."POSTING_DATE", J1."ITEM_TEXT",';
			lvQuery = lvQuery + 'J1."ACCOUNT_TYPE", J1."ENTRY_DATE", J2."CURRENCY", J2."CURRENCY_ISO", J2."AMOUNT"';
			lvQuery = lvQuery + 'FROM "' + gvSchemaName + '"."' + gvItemTable + '" as J1 ';
			lvQuery = lvQuery + 'INNER JOIN "' + gvSchemaName + '"."' + gvCurrencyTable + '" as J2 ';
			lvQuery = lvQuery + 'ON J1."SAP_DOCUMENT" = J2."SAP_DOCUMENT" ';
			lvQuery = lvQuery + 'AND J1."FISCAL_YEAR" = J2."FISCAL_YEAR" ';
			lvQuery = lvQuery + 'AND J1."COMPANY_CODE" = J2."COMPANY_CODE" ';
			lvQuery = lvQuery + 'AND J1."ITEM_NO" = J2."ITEM_NO" ';

			if (gvSapDocument) {
				lvQuery = lvQuery + ' WHERE J1."SAP_DOCUMENT" = ' + "'" + gvSapDocument + "'";
			}
			if (gvFiscalYear) {
				if (lvQuery) {
					if (lvQuery.indexOf('WHERE') === -1) {
						lvQuery = lvQuery + ' WHERE J1."FISCAL_YEAR" = ' + "'" + gvFiscalYear + "'";
					} else {
						lvQuery = lvQuery + ' AND J1."FISCAL_YEAR" = ' + "'" + gvFiscalYear + "'";
					}
				} else {
					lvQuery = lvQuery + ' WHERE J1."FISCAL_YEAR" = ' + "'" + gvFiscalYear + "'";
				}
			}
			if (gvCompanyCode) {
				if (lvQuery) {
					if (lvQuery.indexOf('WHERE') === -1) {
						lvQuery = lvQuery + ' WHERE J1."COMPANY_CODE" = ' + "'" + gvCompanyCode + "'";
					} else {
						lvQuery = lvQuery + ' AND J1."COMPANY_CODE" = ' + "'" + gvCompanyCode + "'";
					}
				} else {
					lvQuery = lvQuery + ' WHERE J1."COMPANY_CODE" = ' + "'" + gvCompanyCode + "'";
				}
			}
			if (gvPostingDate) {
				if (lvQuery) {
					if (lvQuery.indexOf('WHERE') === -1) {
						lvQuery = lvQuery + ' WHERE J1."POSTING_DATE" = ' + "'" + gvPostingDate + "'";
					} else {
						lvQuery = lvQuery + ' AND J1."POSTING_DATE" = ' + "'" + gvPostingDate + "'";
					}
				} else {
					lvQuery = lvQuery + ' WHERE J1."POSTING_DATE" = ' + "'" + gvPostingDate + "'";
				}
			}
			if (gvItemNo) {
				if (lvQuery) {
					if (lvQuery.indexOf('WHERE') === -1) {
						lvQuery = lvQuery + ' WHERE J1."ITEM_NO" = ' + "'" + gvItemNo + "'";
					} else {
						lvQuery = lvQuery + ' AND J1."ITEM_NO" = ' + "'" + gvItemNo + "'";
					}
				} else {
					lvQuery = lvQuery + ' WHERE J1."ITEM_NO" = ' + "'" + gvItemNo + "'";
				}
			}
			if (gvGlAccount) {
				if (lvQuery) {
					if (lvQuery.indexOf('WHERE') === -1) {
						lvQuery = lvQuery + ' WHERE J1."GL_ACCOUNT" = ' + "'" + gvGlAccount + "'";
					} else {
						lvQuery = lvQuery + ' AND J1."GL_ACCOUNT" = ' + "'" + gvGlAccount + "'";
					}
				} else {
					lvQuery = lvQuery + ' WHERE J1."GL_ACCOUNT" = ' + "'" + gvGlAccount + "'";
				}
			}
			if (gvOrderby) {
				if (lvQuery) {
					lvQuery = lvQuery + ' ORDER BY ' + '"' + gvOrderby + '"';
				}
			}

			//Connect to the Database and execute the query
			var oConnection = $.db.getConnection();
			var oStatement = oConnection.prepareStatement(lvQuery);
			oStatement.execute();
			var oResultSet = oStatement.getResultSet();
			var oResult = {
				records: []
			};
			while (oResultSet.next()) {

				var record = {
					SAP_DOCUMENT: oResultSet.getString(1),
					FISCAL_YEAR: oResultSet.getString(2),
					COMPANY_CODE: oResultSet.getString(3),
					ITEM_NO: oResultSet.getString(4),
					GL_ACCOUNT: oResultSet.getString(5),
					VALUE_DATE: oResultSet.getString(6),
					POSTING_DATE: oResultSet.getString(7),
					ITEM_TEXT: oResultSet.getString(8),
					ACCOUNT_TYPE: oResultSet.getString(9),
					ENTRY_DATE: oResultSet.getString(10),
					CURRENCY: oResultSet.getString(11),
					CURRENCY_ISO: oResultSet.getString(12),
					AMOUNT: oResultSet.getString(13)
				};

				oResult.records.push(record);
				record = "";
			}
			oResultSet.close();
			oStatement.close();
			oConnection.close();

			//Return the result
			$.response.contentType = "application/json; charset=UTF-8";
			$.response.setBody(JSON.stringify(oResult));
			$.response.status = $.net.http.OK;

		} catch (errorObj) {
			gvErrorMessage = errorObj.message;
			if (oStatement !== null) {
				oStatement.close();
			}
			if (oConnection !== null) {
				oConnection.close();
			}
		}
	}

})();