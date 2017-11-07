const mysql = require('mysql');
const fs = require('fs');
const pythonshell = require('python-shell');

// AWS RDS MySQL server settings
const hostname = 'aa5icva8ezh544.crnuwmhdforv.us-east-2.rds.amazonaws.com';
const dbuser = 'blips';
const dbpass = 'passpass';
const dbname = 'blips';

// Scripts required for initial DB build
const table_definitions = "dbsetup/table_definitions.sql";
const build_database = "dbsetup/build_cities_database.py";

// Common queries
const lastModTimeQuery = "select Updated from City where Name = ";
const unixTimestampQuery = "select UNIX_TIMESTAMP ";
const tableRowCountQuery = "select count(*) from Blips ";

/*****************************************************
 **													**
 **	         Private Variables and Methods			**
 **													**
 *****************************************************/

// Logging setup
var loggingModule = require('./logging.js');
var logging = new loggingModule('mysql_client', loggingModule.trace_level);

var mySQLConnection = mysql.createConnection({
    host      : hostname,
    user      : dbuser,
    password  : dbpass,
});

/**
 *  schemaSetup() executes all SQL statements in table_definitions to 
 *  have the DB schema ready for SQL queries.
 *
 *  ISSUE (#4): This function doesn't check if the DB is in a good state,
 *	it always drops the DB and rebuilds it. This should be addressed.
 */
function schemaSetup() {
	sqlSchema = fs.readFileSync(table_definitions, "utf-8").split(";");

	for (index = 0; index < (sqlSchema.length - 1); index++) {
		sqlSchema[index] = sqlSchema[index].replace("\n", "").replace("\t", "");

		queryStr = mySQLConnection.escape(sqlSchema[index]);

		mySQLConnection.query(sqlSchema[index], function (error, results, fields) {
			if (error) throw error;
		});
	}
}

/**
 *  buildCitiesDatabase() executes the Python script referenced by build_database.
 *	The Python script inserts City, Province and Country rows into the DB.
 *
 *	ISSUE (#4): Like schemaSetup(), this function will always rebuild the DB. This
 *  needs to be addressed in the Python script or here. The call to this function can
 *  also be moved to schemaSetup() and have it only be called if the DB needs to be built.
 */
function buildCitiesDatabase() {
	var options = {
		mode: 'text',
		pythonPath: '/usr/bin/python35',
		args: [hostname, dbuser, dbpass, dbname]
	};

	pythonshell.run(build_database, options, function (error, results) {
		if (error) throw error;

		logging.log(loggingModule.trace_level, results);
	});
}

// mysql_client setup, connect to MySQL server and build initial DB tables
mySQLConnection.connect();
schemaSetup();
buildCitiesDatabase();

/*****************************************************
 **													**
 **				   Exported Methods					**
 **													**
 *****************************************************/

/**
 *  queryAndCallback() expects an SQL query to execute, a query callback function
 *  that it will call if the SQL query was successful, and optionally, a reference to
 *  a second callback function that can be called later on.
 */
exports.queryAndCallback = (queryStr, queryCallback, callerCallback, queryArgs) => {
	logging.log(loggingModule.trace_level, "queryAndCallback " + queryStr);

	mySQLConnection.query(queryStr, function (error, results, fields) {
		if (error) throw error;

		queryCallback(results, callerCallback, queryArgs);
	});
}

/**
 *  bulkInsert() receives a 2D array containing multiple SQL insertion queries, with
 *  attributes having been set on all insertion queries. If the bulk insertion is successful,
 *  the given callback function is called.
 */
exports.bulkInsert = (queryStr, values, callback) => {
	logging.log(loggingModule.trace_level, "bulkInsert " + queryStr);

	mySQLConnection.query(queryStr, [values], function (error) {
		if (error) throw error;

		callback();
	});
}

/**
 *  Escape the given SQL query
 */
exports.escape = (string) => {
	return mySQLConnection.escape(string);
}

/**
 *  Count the number of rows in the Blips table corresponding to the given blipID.
 *  Call the callback function with the result.
 *
 *  TODO: Generalize this function to work with any table and attribute
 */
exports.tableRowCount = (blipID, callback) => {
	var queryStr = tableRowCountQuery + " where BID = " + blipID;

	logging.log(loggingModule.trace_level, "tableRowCount " + blipID + " " + queryStr);

	mySQLConnection.query(queryStr, function (error, results, fields) {
		if (error) throw error;

		var key = (Object.keys(results[0])[0]);

		callback(results[0][key]);
	});
}

/**
 *  Given the name of a City, check the last time that its Blips were cached.
 *  Call the callback function with the result.
 *
 *  TODO: This function should be in places.js instead (the SQL queries should be removed,
 *  and instead call this module's queryAndCallback function)
 */
exports.getBlipLastModifiedTime = (cityStr, callback) => {
	var queryStr = lastModTimeQuery + mySQLConnection.escape(cityStr);

	logging.log(loggingModule.trace_level, "getBlipLastModifiedTime " + queryStr);

	mySQLConnection.query(queryStr, function (error, results, fields) {
		if (error) throw error;

		var queryStr = unixTimestampQuery + "(" + mySQLConnection.escape(results[0].Updated) + ")";

		logging.log(loggingModule.trace_level, "getBlipLastModifiedTime nested " + queryStr);

		mySQLConnection.query(queryStr, function (error, results, fields) {
			if (error) throw error;

			var key = (Object.keys(results[0])[0]);

			callback(results[0][key]);
		});
	});
}
