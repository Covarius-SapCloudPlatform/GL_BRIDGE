(function() {
	// -------------------------------------------------------- // 
	// Description                                              //
	// -------------------------------------------------------- //
	// Author: Jacques Otto                                     //
	// Company: Covarius                                        //
	// Date: 2018-06-15                                         //
	// Description: REST service to be able to create entries   //
	// in the Covarius Input Journal Tables.POST method is      //
	// allowed you would need to get the x-csrf-token before    //
	// doing the POST to the service.                           //
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
	var gvHeaderTable = 'COV_IN_JOURNAL_HEADER';
	var gvItemTable = 'COV_IN_JOURNAL_ENTRY';
	var gvBatchTable = 'COV_IN_BATCH_HEADER';

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
	// Main function to add entries to the Input Tables         //
	// -------------------------------------------------------- //
	function main() {

		//Check the Method
		if ($.request.method === $.net.http.GET) {
			$.response.status = 200;
			$.response.setBody(JSON.stringify({
				message: "API Called",
				result: "GET is not supported, perform a POST to add Entries"
			}));
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
	// Function to insert entries into the table for integration event //
	// ----------------------------------------------------------------//
	function _createEntries() {
		var lvStatus;
		//Get the Request Body
		var oBody = JSON.parse($.request.body.asString());

		//Check if it is Bulk Scenario Asynchronous
		if (oBody.JOURNAL.constructor === Array) {
			for (var i = 0; i < oBody.JOURNAL.length; i++) {
				//Create the Batch Entry
				lvStatus = _createBatch(oBody, oBody.JOURNAL[i]);

				//Create the Header
				if (lvStatus === "SUCCESS") {
					lvStatus = _createHeader(oBody.JOURNAL[i]);
				}

				//If Successful create the Item
				if (lvStatus === "SUCCESS") {
					_createItems(oBody.JOURNAL[i], oBody.JOURNAL[i].JOURNAL_ENTRY);
				}
				lvStatus = "";
			}
		} else {
			//Create Header Entry
			if (oBody.JOURNAL) {
				//Create the Batch Entry
				lvStatus = _createBatch(oBody, oBody.JOURNAL);

				//Create the Header
				if (lvStatus === "SUCCESS") {
					lvStatus = _createHeader(oBody.JOURNAL);
				}

				//Create the Items
				if (lvStatus === "SUCCESS") {
					_createItems(oBody.JOURNAL, oBody.JOURNAL.JOURNAL_ENTRY);
				}
			}
		}
	}

	// ------------------------------------------------------------- // 
	// Function to create entries in Batch Table for Journal Input   //
	// ------------------------------------------------------------- //
	function _createBatch(oBatchHeader, oJournal) {
		var lvStatus;

		try {
			//Get the Database connection
			var oConnection = $.db.getConnection();

			//Build the Statement to insert the entries for Batch Table
			var oStatement = oConnection.prepareStatement('INSERT INTO "' + gvSchemaName + '"."' + gvBatchTable +
				'" VALUES (?, ?, ?, ?, ?)');

			//Populate the fields with values from the incoming payload
			//Message GUID
			oStatement.setString(1, gvGuid);
			//Batch Guid
			oStatement.setString(2, oBatchHeader.BATCH_GUID);
			//Batch Date
			oStatement.setDate(3, oBatchHeader.BATCH_DATE);
			//Sender Id
			oStatement.setString(4, oBatchHeader.BATCH_SENDER_ID);
			//Accounting Instance
			oStatement.setString(5, oBatchHeader.ACCTG_INSTANCE);

			//Add Batch process to executed on the database
			oStatement.addBatch();

			//Execute the Insert
			oStatement.executeBatch();

			//Close the connection
			oStatement.close();
			oConnection.commit();
			oConnection.close();

			gvTableUpdate = "Table entries created successfully in table:" + gvBatchTable + ";";
			lvStatus = "SUCCESS";
		} catch (errorObj) {
			if (oStatement !== null) {
				oStatement.close();
			}
			if (oConnection !== null) {
				oConnection.close();
			}
			gvTableUpdate = "There was a problem inserting entries into the table:" + gvBatchTable + ", Error: " + errorObj.message;
			lvStatus = "ERROR";
		}
		return lvStatus;
	}

	// ------------------------------------------------------------- // 
	// Function to create entries in Header Table for Journal Input  //
	// ------------------------------------------------------------- //
	function _createHeader(oJournal) {
		var lvStatus;

		try {
			//Get the Database connection
			var oConnection = $.db.getConnection();

			//Build the Statement to insert the entries for Header Table
			var oStatement = oConnection.prepareStatement('INSERT INTO "' + gvSchemaName + '"."' + gvHeaderTable +
				'" VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');

			//Populate the fields with values from the incoming payload
			//Message GUID
			oStatement.setString(1, gvGuid);
			//Journal Reference
			oStatement.setString(2, oJournal.JOURNAL_REF);
			//Company Code
			oStatement.setString(3, oJournal.COMP_CODE);
			//Journal Description
			oStatement.setString(4, oJournal.JOURNAL_DESC);
			//Inter Company Flag
			oStatement.setString(5, oJournal.INTERCO_FLAG);
			//Reversal Indicator
			oStatement.setString(6, oJournal.REVERSAL_INDICATOR);
			//Reversal Reference
			oStatement.setString(7, oJournal.REVERSAL_REF);
			//Transaction Reference
			oStatement.setString(8, oJournal.TRAN_REF);
			//Transaction Type
			oStatement.setString(9, oJournal.TRAN_TYPE);

			//Add Batch process to executed on the database
			oStatement.addBatch();

			//Execute the Insert
			oStatement.executeBatch();

			//Close the connection
			oStatement.close();
			oConnection.commit();
			oConnection.close();

			gvTableUpdate = gvTableUpdate + "Table entries created successfully in table:" + gvHeaderTable + ";";
			lvStatus = "SUCCESS";
		} catch (errorObj) {
			if (oStatement !== null) {
				oStatement.close();
			}
			if (oConnection !== null) {
				oConnection.close();
			}
			gvTableUpdate = gvTableUpdate + "There was a problem inserting entries into the table:" + gvHeaderTable + ", Error: " + errorObj.message;
			lvStatus = "ERROR";
		}
		return lvStatus;
	}

	// ------------------------------------------------------------- // 
	// Function to create entries in Item Table for Journal Input  //
	// ------------------------------------------------------------- //
	function _createItems(oJournal, oItems) {
		var lvStatus;

		try {
			//Get the Database connection
			var oConnection = $.db.getConnection();

			//Build the Statement to insert the entries for Header Table
			var oStatement = oConnection.prepareStatement('INSERT INTO "' + gvSchemaName + '"."' + gvItemTable +
				'" VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');

			for (var i = 0; i < oItems.length; i++) {

				//Populate the fields with values from the incoming payload
				//Journal Reference
				oStatement.setString(1, oJournal.JOURNAL_REF);
				//Journal Entry Reference
				oStatement.setString(2, oItems[i].JOURNAL_ENTRY_REF);
				//Debit/Credit
				oStatement.setString(3, oItems[i].DEBIT_CREDIT);
				//GL Account
				oStatement.setString(4, oItems[i].GL_ACCT);
				//GL Group
				oStatement.setString(5, oItems[i].GL_GROUP);
				//Posting Date
				oStatement.setDate(6, oItems[i].PSTNG_DATE);
				//Value Date
				oStatement.setDate(7, oItems[i].VALUE_DATE);
				//Posting Type
				oStatement.setString(8, oItems[i].PSTNG_TYPE);
				//Posted Amount
				oStatement.setDecimal(9, oItems[i].PSTNG_AMT);
				//Posted Currency
				oStatement.setString(10, oItems[i].PSTNG_CCY);
				//FX Rate
				if (oItems[i].FX_RATE) {
					oStatement.setDecimal(11, oItems[i].FX_RATE);
				} else {
					oStatement.setDecimal(11, 0);
				}
				//Base Amount
				if (oItems[i].BASE_AMT) {
					oStatement.setDecimal(12, oItems[i].BASE_AMT);
				} else {
					oStatement.setDecimal(12, 0);
				}
				//Base Currency
				oStatement.setString(13, oItems[i].BASE_CCY);
				//Profit Center
				oStatement.setString(14, oItems[i].PROFIT_CTR);
				//Profit Center Partner
				oStatement.setString(15, oItems[i].PROFIT_CTR_PRTNR);
				//Cost Center
				oStatement.setString(16, oItems[i].COST_CTR);
				//Cost Center Partner
				oStatement.setString(17, oItems[i].COST_CTR_PRTNR);

				//Add Batch process to executed on the database
				oStatement.addBatch();
			}
			//Execute the Insert
			oStatement.executeBatch();

			//Close the connection
			oStatement.close();
			oConnection.commit();
			oConnection.close();

			gvTableUpdate = gvTableUpdate + "Table entries created successfully in table:" + gvItemTable + ";";
			lvStatus = "SUCCESS";
		} catch (errorObj) {
			if (oStatement !== null) {
				oStatement.close();
			}
			if (oConnection !== null) {
				oConnection.close();
			}
			gvTableUpdate = gvTableUpdate + "There was a problem inserting entries into the table:" + gvItemTable + ", Error: " + errorObj.message;
			lvStatus = "ERROR";
		}
	}
	// 	// ------------------------------------------------------------- // 
	// 	// Function to delete entries in logging table older than 30 days//
	// 	// ------------------------------------------------------------- //
	// 	function _deleteHistoricEntries() {

	// 		try {
	// 			//Get the Database connection
	// 			var oConnection = $.db.getConnection();

	// 			//Get date 90 days back
	// 			var lvDate = new Date();
	// 			lvDate.setDate(lvDate.getDate() - 90);
	// 			var lvDateString = lvDate.toISOString().split('T')[0];

	// 			//Build the Statement to delete the entries
	// 			var oStatement = oConnection.prepareStatement("DELETE FROM \"" + gvSchemaName + "\".\"" + gvTableName + "\" WHERE START_TIME <= ?");

	// 			//Start Time
	// 			oStatement.setString(1, lvDateString);

	// 			oStatement.addBatch();

	// 			//Execute the Insert
	// 			oStatement.executeBatch();

	// 			//Close the connection
	// 			oStatement.close();
	// 			oConnection.commit();
	// 			oConnection.close();

	// 			gvTableUpdate += "Table entries deleted for historic entries older than 90 days;";

	// 		} catch (errorObj) {
	// 			if (oStatement !== null) {
	// 				oStatement.close();
	// 			}
	// 			if (oConnection !== null) {
	// 				oConnection.close();
	// 			}
	// 			gvTableUpdate += ",There was a problem deleting entries in the logging table, Error: " + errorObj.message;
	// 		}
	// 	}

	// 	// -------------------------------------------------------- // 
	// 	// Function to Pad Item Number                             //
	// 	// -------------------------------------------------------- //	
	// 	function padToThree(number) {
	// 		if (number <= 999) {
	// 			number = ("00" + number).slice(-3);
	// 		}
	// 		return number;
	// 	}

	// 	// ------------------------------------------------------------- // 
	// 	// Function to delete entries in GL Header Table older than 90 days//
	// 	// ------------------------------------------------------------- //
	// 	function _deleteHistoricEntriesContentTables(tableName) {
	// 		try {
	// 			//Get the Database connection
	// 			var oConnection = $.db.getConnection();

	// 			//Get date 90 days back
	// 			var lvDate = new Date();
	// 			lvDate.setDate(lvDate.getDate() - 90);
	// 			var lvDateString = lvDate.toISOString().substring(0, 10);

	// 			//Build the Statement to delete the entries
	// 			var oStatement = oConnection.prepareStatement("DELETE FROM \"" + gvSchemaName + "\".\"" + tableName + "\" WHERE ENTRY_DATE <= ?");

	// 			//Entry Date
	// 			oStatement.setString(1, lvDateString);

	// 			oStatement.addBatch();

	// 			//Execute the Insert
	// 			oStatement.executeBatch();

	// 			//Close the connection
	// 			oStatement.close();
	// 			oConnection.commit();
	// 			oConnection.close();

	// 			gvTableUpdate += "Table entries deleted for historic entries older than 90 days" + tableName + ";";

	// 		} catch (errorObj) {
	// 			if (oStatement !== null) {
	// 				oStatement.close();
	// 			}
	// 			if (oConnection !== null) {
	// 				oConnection.close();
	// 			}
	// 			gvTableUpdate += ",There was a problem deleting entries in the " + tableName + " table, Error: " + errorObj.message;
	// 		}
	// 	}

})();