(function() {
	// -------------------------------------------------------- // 
	// Description                                              //
	// -------------------------------------------------------- //
	// Author: Jacques Otto                                     //
	// Company: Covarius                                        //
	// Date: 2018-09-14                                         //
	// Description:REST service to be able to perform the       //
	// execution of the mapping from In to Out based on the     //
	// rules defined in the COV_VAT_MAPPING Table.              //
	// POST to the service. if a GET is performed, entries are  //
	// read from the table for the log. Parameters include:     //
	// - method - MAP                                           //
	//----------------------------------------------------------//

	// -------------------------------------------------------- // 
	// Global Variables                                         //
	// -------------------------------------------------------- //
	//Variable to carry the table update status
	var gvTableUpdate,
		gvStatus;

	//Variable to carry the conversion errors
	var gvConvError;

	//Variables declaring the table details
	var gvVATSchemaName = 'COV_SCH_VAT';
	var gvMappingTableName = 'COV_VAT_MAPPING';
	var gvFieldsSchema = 'COV_SCH_GL_BRIDGE';
	var gvInBatchHeaderTable = 'COV_IN_BATCH_HEADER';
	var gvInJournalHeader = 'COV_IN_JOURNAL_HEADER';
	var gvInJournalEntry = 'COV_IN_JOURNAL_ENTRY';
	var gvOutHeader = 'COV_OUT_GL_HEADER';
	var gvOutItem = 'COV_OUT_GL_ITEM';
	var gvOutCurrency = 'COV_OUT_GL_CURRENCY';

	//Variables to Carry the Resulting Structure
	var gvPayload;
	var gvHeader = {};
	var gtItem = [];
	var gtCurrency = [];

	//Indicate if Service is to be updated or Deleted
	var gvMethod = $.request.parameters.get('method');
	var gvErrorMessage;

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

	// -------------------------------------------------------- // 
	// Execute Main Function                                    //
	// -------------------------------------------------------- //
	main();

	// -------------------------------------------------------- // 
	// Main function to call methods as required                //
	// -------------------------------------------------------- //
	function main() {
		//Check the Method
		if ($.request.method === $.net.http.POST) {
			if (gvMethod === "MAP") {
				//Perform The Mapping between In and Out
				try {
					_mapInToOut();
				} catch (errorObj) {
					gvStatus = "Error during mapping IN to OUT:" + errorObj.message;
				}
			}
		}
		// 		} else if ($.request.method === $.net.http.GET) {
		// 			//Read Entries from the Table
		// 			try {
		// 				_getEntries();
		// 			} catch (errorObj) {
		// 				$.response.status = 200;
		// 				$.response.setBody(JSON.stringify({
		// 					message: "API Called",
		// 					result: gvErrorMessage
		// 				}));
		// 			}
		// 		}
	}

	// -------------------------------------------------------- // 
	// Function to perfrom mapping from IN to OUT   		    //
	// -------------------------------------------------------- //
	function _mapInToOut() {
		var lvStatus;
		//Get the Request Body
		var oBody = JSON.parse($.request.body.asString());
		var oJournal;
		var oJournalItems;

		//Get the Fields from Incoming Payload
		if (oBody.JOURNAL.constructor === Array) {
			oJournal = oBody.JOURNAL[0];
			oJournalItems = oBody.JOURNAL[0].JOURNAL_ENTRY;
		} else {
			oJournal = oBody.JOURNAL;
			oJournalItems = oBody.JOURNAL.JOURNAL_ENTRY;
		}

		//Map the Header Fields
		_mapHeader(oBody, oJournal, oJournalItems);
		_saveHeader();

		//Map the Item Fields
		_mapItem(oBody, oJournal, oJournalItems);
		_saveItem();

		//Map the Currency Fields
		_mapCurrency(oBody, oJournal, oJournalItems);
		_saveCurrency();

		//Build the Return Item
		var lvItem,
			ltItem = [];

		if (gtItem) {
			//Loop through Items
			for (var i = 0; i < gtItem.length; i++) {
				lvItem = {
					ItemNumber: "",
					GLAccount: gtItem[i].GL_ACCOUNT,
					ItemText: gtItem[i].ITEM_TEXT,
					RefKey1: gtItem[i].REF_KEY_1,
					RefKey2: gtItem[i].REF_KEY_2,
					RefKey3: gtItem[i].REF_KEY_3,
					AccountType: gtItem[i].ACCT_TYPE,
					DocumentType: gtItem[i].DOC_TYPE,
					CompanyCode: gtItem[i].COMP_CODE,
					FiscalPeriod: gtItem[i].FIS_PERIOD,
					FiscalYear: gtItem[i].FISC_YEAR,
					PostingDate: gtItem[i].PSTNG_DATE,
					ValueDate: gtItem[i].VALUE_DATE,
					Customer: gtItem[i].CUSTOMER,
					VendorNo: gtItem[i].VENDOR_NO,
					AssignmentNumber: gtItem[i].ALLOC_NMBR,
					CostCenter: gtItem[i].COSTCENTER,
					ActivityType: gtItem[i].ACTTYPE,
					ProfitCenter: gtItem[i].PROFIT_CTR,
					ProfitCenterPartner: gtItem[i].PART_PRCTR,
					TradingPartner: gtItem[i].TRADE_ID,
					TransactionType: gtItem[i].CS_TRANS_T
				};

				ltItem.push(lvItem);
			}
		}

		//Build the Return Currency Items
		var lvCurrency,
			ltCurrency = [];

		if (gtCurrency) {
			//Loop through Items
			for (var j = 0; j < gtCurrency.length; j++) {

				lvCurrency = {};
				if (gtCurrency[j].CURR_TYPE) {
					lvCurrency.CurrencyType = gtCurrency[j].CURR_TYPE;
				}
				if (gtCurrency[j].CURRENCY) {
					lvCurrency.CurrencyKey = gtCurrency[j].CURRENCY;
				}
				if (gtCurrency[j].CURRENCY_ISO) {
					lvCurrency.CurrencyIso = gtCurrency[j].CURRENCY_ISO;
				}
				if (gtCurrency[j].AMT_DOCCUR) {
					lvCurrency.Amount = gtCurrency[j].AMT_DOCCUR;
				}
				if (gtCurrency[j].EXCH_RAT) {
					lvCurrency.ExchangeRate = gtCurrency[j].EXCH_RATE;
				}
				if (gtCurrency[j].EXCH_RATE_V) {
					lvCurrency.IndirectExchangeRate = gtCurrency[j].EXCH_RATE_V;
				}
				if (gtCurrency[j].AMT_BASE) {
					lvCurrency.AmountBase = gtCurrency[j].AMT_BASE;
				}
				if (gtCurrency[j].DISC_BASE) {
					lvCurrency.DiscountBase = gtCurrency[j].DISC_BASE;
				}
				if (gtCurrency[j].DISC_AMT) {
					lvCurrency.DiscountAmt = gtCurrency[j].DISC_AMT;
				}
				if (gtCurrency[j].TAX_AMT) {
					lvCurrency.TaxAmount = gtCurrency[j].TAX_AMT;
				}

				ltCurrency.push(lvCurrency);
			}
		}

		//Build Return Payload
		gvPayload = {
			HeaderText: gvHeader.HEADERTEXT,
			CompanyCode: gvHeader.COMP_CODE,
			DocumentDate: gvHeader.DOC_DATE,
			PostingDate: gvHeader.PSTNG_DATE,
			TranslationDate: gvHeader.TRANS_DATE,
			FiscalYear: gvHeader.FISC_YEAR,
			FiscalPeriod: gvHeader.FIS_PERIOD,
			DocumentType: gvHeader.DOC_TYPE,
			ReferenceDocNo: gvHeader.REF_DOC_NO,
			ReasonReversal: gvHeader.REASON_REV,
			ReferenceDocNoLong: gvHeader.REF_DOC_NO_LONG,
			AccountingPrinciple: gvHeader.ACC_PRINCIPLE,
			BillingCategory: gvHeader.BILL_CATEGORY,
			PartialReversalInd: gvHeader.PARTIAL_REV,
			DocumentStatus: gvHeader.DOC_STATUS,
			ToItem: ltItem,
			ToCurrency: ltCurrency
		};

		$.response.status = 200;
		$.response.setBody(JSON.stringify(gvPayload));
	}

	// -------------------------------------------------------- // 
	// Function to map Header Fields                 		    //
	// -------------------------------------------------------- //
	function _mapHeader(oBody, oJournal, oJournalItems) {
		//Get the List of Fields maintained in the mapping for Header
		var oFields = _getFields(gvOutHeader);

		//Define the Resulting Header Structure
		gvHeader = {
			MESSAGE_GUID: gvGuid,
			REF_DOC_NO: "",
			DOC_DATE: "",
			HEADERTEXT: "",
			COMP_CODE: "",
			PSTNG_DATE: "",
			TRANS_DATE: "",
			FISC_YEAR: "",
			FIS_PERIOD: "",
			DOC_TYPE: "",
			REASON_REV: "",
			REF_DOC_NO_LONG: "",
			ACC_PRINCIPLE: "",
			BILL_CATEGORY: "",
			PARTIAL_REV: "",
			DOC_STATUS: ""
		};

		if (oFields) {
			for (var i = 0; i < oFields.length; i++) {

				if (oFields[i].IN_TABLE) {
					if (oFields[i].IN_TABLE === gvInBatchHeaderTable) {
						gvHeader[oFields[i].OUT_FIELD] = oBody[oFields[i].IN_FIELD];
					} else if (oFields[i].IN_TABLE === gvInJournalHeader) {
						gvHeader[oFields[i].OUT_FIELD] = oJournal[oFields[i].IN_FIELD];
					} else if (oFields[i].IN_TABLE === gvInJournalEntry) {
						gvHeader[oFields[i].OUT_FIELD] = oJournalItems[0][oFields[i].IN_FIELD];
					}
				}
			}
		}
	}

	// -------------------------------------------------------- // 
	// Function to map Item Fields                 		        //
	// -------------------------------------------------------- //
	function _mapItem(oBody, oJournal, oJournalItems) {
		//Get the List of Fields maintained in the mapping for Header
		var oFields = _getFields(gvOutItem);
		var lvItem;

		if (oFields && oJournalItems) {
			for (var j = 0; j < oJournalItems.length; j++) {

				//Define the Resulting Item Structure
				lvItem = {
					REF_DOC_NO: gvHeader.REF_DOC_NO,
					GL_ACCOUNT: "",
					ITEM_TEXT: "",
					REF_KEY1: "",
					REF_KEY2: "",
					REF_KEY3: "",
					ACCT_TYPE: "",
					DOC_TYPE: "",
					COMP_CODE: "",
					FIS_PERIOD: "",
					FISC_YEAR: "",
					PSTNG_DATE: "",
					VALUE_DATE: "",
					CUSTOMER: "",
					VENDOR_NO: "",
					ALLOC_NMBER: "",
					COSTCENTER: "",
					ACTTYPE: "",
					PROFIT_CTR: "",
					PART_PRCTR: "",
					TRADE_ID: "",
					CS_TRANS_T: ""
				};

				//Perform Mapping for Each Item
				for (var i = 0; i < oFields.length; i++) {

					if (oFields[i].IN_TABLE) {
						if (oFields[i].IN_TABLE === gvInBatchHeaderTable) {
							lvItem[oFields[i].OUT_FIELD] = oBody[oFields[i].IN_FIELD];
						} else if (oFields[i].IN_TABLE === gvInJournalHeader) {
							lvItem[oFields[i].OUT_FIELD] = oJournal[oFields[i].IN_FIELD];
						} else if (oFields[i].IN_TABLE === gvInJournalEntry) {
							lvItem[oFields[i].OUT_FIELD] = oJournalItems[j][oFields[i].IN_FIELD];
						}
					}
				}

				//Add Item Entry to Table
				gtItem.push(lvItem);
			}
		}
	}

	// -------------------------------------------------------- // 
	// Function to map Currency Fields                 		    //
	// -------------------------------------------------------- //
	function _mapCurrency(oBody, oJournal, oJournalItems) {
		//Get the List of Fields maintained in the mapping for Header
		var oFields = _getFields(gvOutCurrency);
		var lvCurrency;

		if (oFields && oJournalItems) {
			for (var j = 0; j < oJournalItems.length; j++) {

				//Define the Resulting Item Structure
				lvCurrency = {
					REF_DOC_NO: gvHeader.REF_DOC_NO,
					CURR_TYPE: "",
					CURRENCY: "",
					CURRENCY_ISO: "",
					AMT_DOCCUR: "",
					EXCH_RATE: "",
					EXCH_RATE_V: "",
					AMT_BASE: "",
					DISC_BASE: "",
					DISC_AMT: "",
					TAX_AMT: ""
				};

				//Perform Mapping for Each Item
				for (var i = 0; i < oFields.length; i++) {

					if (oFields[i].IN_TABLE) {
						if (oFields[i].IN_TABLE === gvInBatchHeaderTable) {
							lvCurrency[oFields[i].OUT_FIELD] = oBody[oFields[i].IN_FIELD];
						} else if (oFields[i].IN_TABLE === gvInJournalHeader) {
							lvCurrency[oFields[i].OUT_FIELD] = oJournal[oFields[i].IN_FIELD];
						} else if (oFields[i].IN_TABLE === gvInJournalEntry) {
							lvCurrency[oFields[i].OUT_FIELD] = oJournalItems[j][oFields[i].IN_FIELD];
						}
					}
				}

				//Add Item Entry to Table
				gtCurrency.push(lvCurrency);
			}
		}
	}

	// -------------------------------------------------------- // 
	// Function to get the List of Fields from Mapping Table    //
	// for a specific table                                     //
	// -------------------------------------------------------- //
	function _getFields(pTable) {
		try {
			//Variable to keep query statement 
			var lvQuery = 'SELECT * FROM "' + gvVATSchemaName + '"."' + gvMappingTableName + '"';
			var lvQuery = lvQuery + ' WHERE "OUT_TABLE" = ' + "'" + pTable + "'";

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
					IN_TABLE: oResultSet.getString(1),
					IN_FIELD: oResultSet.getString(2),
					IN_TABLE_ALIAS: oResultSet.getString(3),
					OUT_TABLE: oResultSet.getString(4),
					OUT_FIELD: oResultSet.getString(5),
					OUT_TABLE_ALIAS: oResultSet.getString(6),
					MANDATORY: oResultSet.getString(7),
					RULE: oResultSet.getString(8)
				};
				oResult.records.push(record);
				record = "";
			}

			oResultSet.close();
			oStatement.close();
			oConnection.close();

			//Return the result
			return oResult.records;

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
	// Function to save entry to header table 				    //
	// -------------------------------------------------------- //
	function _saveHeader() {
		var lvStatus;
		try {
			//Get the Database connection
			var oConnection = $.db.getConnection();

			//Build the Statement to insert the entries for Batch Table
			var oStatement = oConnection.prepareStatement('INSERT INTO "' + gvFieldsSchema + '"."' + gvOutHeader +
				'" VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');

			//Populate the fields with values from the incoming payload
			//Message GUID
			oStatement.setString(1, gvGuid);
			//Ref Doc No
			oStatement.setString(2, gvHeader.REF_DOC_NO);
			//Doc Date
			oStatement.setDate(3, gvHeader.DOC_DATE);
			//Headertext
			oStatement.setString(4, gvHeader.HEADERTEXT);
			//Company Code
			oStatement.setString(5, gvHeader.COMP_CODE);
			//Posting Date
			oStatement.setString(6, gvHeader.PSTNG_DATE);
			//Translation Date
			oStatement.setDate(7, gvHeader.TRANS_DATE);
			//Fiscal Year
			oStatement.setString(8, gvHeader.FISC_YEAR);
			//Fiscal Period
			oStatement.setString(9, gvHeader.FIS_PERIOD);
			//Document Type
			oStatement.setString(10, gvHeader.DOC_TYPE);
			//Reason Reversal
			oStatement.setString(11, gvHeader.REASON_REV);
			//Reference Document Long
			oStatement.setString(12, gvHeader.REF_DOC_NO_LONG);
			//Accounting Principle
			oStatement.setString(13, gvHeader.ACC_PRINCIPLE);
			//Billing Category
			oStatement.setString(14, gvHeader.BILL_CATEGORY);
			//Partial Reversal
			oStatement.setString(15, gvHeader.PARTIAL_REV);
			//Document Status
			oStatement.setString(16, gvHeader.DOC_STATUS);

			//Add Batch process to executed on the database
			oStatement.addBatch();

			//Execute the Insert
			oStatement.executeBatch();

			//Close the connection
			oStatement.close();
			oConnection.commit();
			oConnection.close();

			gvTableUpdate = "Table entries created successfully in table:" + gvOutHeader + ";";
			lvStatus = "SUCCESS";
		} catch (errorObj) {
			if (oStatement !== null) {
				oStatement.close();
			}
			if (oConnection !== null) {
				oConnection.close();
			}
			gvTableUpdate = "There was a problem inserting entries into the table:" + gvOutHeader + ", Error: " + errorObj.message;
			lvStatus = "ERROR";
		}
		return lvStatus;
	}

	// ------------------------------------------------------------- // 
	// Function to create entries in Item Table for Output           //
	// ------------------------------------------------------------- //
	function _saveItem() {
		var lvStatus;
		//Item Number Initialization
		var item = 0;

		try {
			//Get the Database connection
			var oConnection = $.db.getConnection();

			//Build the Statement to insert the entries for Header Table
			var oStatement = oConnection.prepareStatement('INSERT INTO "' + gvFieldsSchema + '"."' + gvOutItem +
				'" VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');

			//Prepare the Batch Statement
			oStatement.setBatchSize(gtItem.length);

			for (var i = 0; i < gtItem.length; i++) {

				//Populate the fields with values from the mapping
				//Reference Document
				oStatement.setString(1, gtItem[i].REF_DOC_NO);
				//Item
				if (!gtItem[i].ITEMNO_ACC) {
					item = item + 1;
					var itemNumber = padToThree(item);
					oStatement.setString(2, itemNumber);
				} else {
					oStatement.setString(2, gtItem[i].ITEMNO_ACC);
				}
				//GL Account
				oStatement.setString(3, gtItem[i].GL_ACCOUNT);
				//Item Text
				oStatement.setString(4, gtItem[i].ITEM_TEXT);
				//Reference Key 1
				oStatement.setString(5, gtItem[i].REF_KEY1);
				//Reference Key 2
				oStatement.setString(6, gtItem[i].REF_KEY2);
				//Reference Key 3
				oStatement.setString(7, gtItem[i].REF_KEY3);
				//Account Type
				oStatement.setString(8, gtItem[i].ACCT_TYPE);
				//Document Type
				oStatement.setString(9, gtItem[i].DOC_TYPE);
				//Company Code 
				oStatement.setString(10, gtItem[i].COMP_CODE);
				//Fiscal Period 
				oStatement.setString(11, gtItem[i].FIS_PERIOD);
				//Fiscal Year
				oStatement.setString(12, gtItem[i].FISC_YEAR);
				//Posting Date
				oStatement.setDate(13, gtItem[i].PSTNG_DATE);
				//Value Date
				oStatement.setDate(14, gtItem[i].VALUE_DATE);
				//Customer
				oStatement.setString(15, gtItem[i].CUSTOMER);
				//Vendor No
				oStatement.setString(16, gtItem[i].VENDOR_NO);
				//Assignment Number
				oStatement.setString(17, gtItem[i].ALLOC_NMBER);
				//Cost Center
				oStatement.setString(18, gtItem[i].COSTCENTER);
				//Activity Type
				oStatement.setString(19, gtItem[i].ACTTYPE);
				//Profit Center
				oStatement.setString(20, gtItem[i].PROFIT_CTR);
				//Partner Profit Center
				oStatement.setString(21, gtItem[i].PART_PRCTR);
				//Trade Partner Id
				oStatement.setString(22, gtItem[i].TRADE_ID);
				//Transaction Type
				oStatement.setString(23, gtItem[i].CS_TRANS_T);

				//Add Batch process to executed on the database
				oStatement.addBatch();
			}
			//Execute the Insert
			oStatement.executeBatch();

			//Close the connection
			oStatement.close();
			oConnection.commit();
			oConnection.close();

			gvTableUpdate = gvTableUpdate + "Table entries created successfully in table:" + gvOutItem + ";";
			lvStatus = "SUCCESS";
		} catch (errorObj) {
			if (oStatement !== null) {
				oStatement.close();
			}
			if (oConnection !== null) {
				oConnection.close();
			}
			gvTableUpdate = gvTableUpdate + "There was a problem inserting entries into the table:" + gvOutItem + ", Error: " + errorObj.message;
			lvStatus = "ERROR";
		}
	}

	// ------------------------------------------------------------- // 
	// Function to create entries in Currency Table for Output       //
	// ------------------------------------------------------------- //
	function _saveCurrency() {
		var lvStatus;
		//Item Number Initialization
		var item = 0;

		try {
			//Get the Database connection
			var oConnection = $.db.getConnection();

			//Build the Statement to insert the entries for Header Table
			var oStatement = oConnection.prepareStatement('INSERT INTO "' + gvFieldsSchema + '"."' + gvOutCurrency +
				'" VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');

			//Prepare the Batch Statement
			oStatement.setBatchSize(gtCurrency.length);

			for (var i = 0; i < gtCurrency.length; i++) {

				//Populate the fields with values from the mapping
				//Reference Document
				oStatement.setString(1, gtCurrency[i].REF_DOC_NO);
				//Item
				if (!gtCurrency[i].ITEMNO_ACC) {
					item = item + 1;
					var itemNumber = padToThree(item);
					oStatement.setString(2, itemNumber);
				} else {
					oStatement.setString(2, gtCurrency[i].ITEMNO_ACC);
				}
				//Currency Type
				oStatement.setString(3, gtCurrency[i].CURR_TYPE);
				//Currency
				oStatement.setString(4, gtCurrency[i].CURRENCY);
				//Currency ISO
				oStatement.setString(5, gtCurrency[i].CURRENCY_ISO);
				//Amount
				if (gtCurrency[i].AMT_DOCCUR) {
					oStatement.setDecimal(6, gtCurrency[i].AMT_DOCCUR);
				} else {
					oStatement.setDecimal(6, 0);
				}
				//Exchange Rate
				if (gtCurrency[i].EXCH_RATE) {
					oStatement.setDecimal(7, gtCurrency[i].EXCH_RATE);
				} else {
					oStatement.setDecimal(7, 0);
				}
				//Indirect Exchange Rate
				if (gtCurrency[i].EXCH_RATE_V) {
					oStatement.setDecimal(8, gtCurrency[i].EXCH_RATE_V);
				} else {
					oStatement.setDecimal(8, 0);
				}

				//Base Amount
				if (gtCurrency[i].AMT_BASE) {
					oStatement.setDecimal(9, gtCurrency[i].AMT_BASE);
				} else {
					oStatement.setDecimal(9, 0);
				}

				//Discount Base
				if (gtCurrency[i].DISC_BASE) {
					oStatement.setDecimal(10, gtCurrency[i].DISC_BASE);
				} else {
					oStatement.setDecimal(10, 0);
				}

				//Discount Amount
				if (gtCurrency[i].DISC_AMT) {
					oStatement.setDecimal(11, gtCurrency[i].DISC_AMT);
				} else {
					oStatement.setDecimal(11, 0);
				}

				//Tax Amount
				if (gtCurrency[i].TAX_AMT) {
					oStatement.setDecimal(12, gtCurrency[i].TAX_AMT);
				} else {
					oStatement.setDecimal(12, 0);
				}

				//Add Batch process to executed on the database
				oStatement.addBatch();
			}
			//Execute the Insert
			oStatement.executeBatch();

			//Close the connection
			oStatement.close();
			oConnection.commit();
			oConnection.close();

			gvTableUpdate = gvTableUpdate + "Table entries created successfully in table:" + gvOutCurrency + ";";
			lvStatus = "SUCCESS";
		} catch (errorObj) {
			if (oStatement !== null) {
				oStatement.close();
			}
			if (oConnection !== null) {
				oConnection.close();
			}
			gvTableUpdate = gvTableUpdate + "There was a problem inserting entries into the table:" + gvOutCurrency + ", Error: " + errorObj.message;
			lvStatus = "ERROR";
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
	// ----------------------------------------------------------------// 
	// END OF PROGRAM                                                  //
	// ----------------------------------------------------------------//

})();