const mysql = require('mysql');
const fs = require('fs');
const pythonshell = require('python-shell');
const logging = require('./logging.js');

// AWS RDS MySQL server settings
const hostname = 'aa5icva8ezh544.crnuwmhdforv.us-east-2.rds.amazonaws.com';
const dbuser = 'blips';
const dbpass = 'passpass';
const dbname = 'blips';

// Scripts required for initial DB build
const table_definitions = "dbsetup/table_definitions.sql";
const build_database = "dbsetup/build_cities_database.py";
const force_rebuild = "dbsetup/force_rebuild";

// Common queries
const lastModTimeQuery = "select Updated from City where Name = ";
const unixTimestampQuery = "select UNIX_TIMESTAMP ";
const tableRowCountQuery = "select count(*) from Blips ";
const blipsDbExistsQuery = "use blips"
const dropDBQuery = "drop database blips";

/*****************************************************
 **													**
 **	         Private Variables and Methods			**
 **													**
 *****************************************************/

// Logging Module setup
const log_file = '/tmp/mysql_client.log';
var module_trace_level = logging.warning_level;

function log (entry_trace_level, entry) {
    logging.log(entry_trace_level, module_trace_level, log_file, entry);
}

function setModuleTraceLevel (newLevel) {
    module_trace_level = newLevel;
}

var databaseReadyCallbacks = [];

var mySQLConnection = mysql.createConnection({
    host      : hostname,
    user      : dbuser,
    password  : dbpass,
});

function buildSchema() {
	sqlSchema = fs.readFileSync(table_definitions, "utf-8").split(";");

	for (index = 0; index < (sqlSchema.length - 1); index++) {
		sqlSchema[index] = sqlSchema[index].replace("\n", "").replace("\t", "");

		queryStr = mySQLConnection.escape(sqlSchema[index]);

		mySQLConnection.query(sqlSchema[index], function (error, results, fields) {
			if (error) throw error;
		});
	}

	buildCitiesDatabase();
}

/**
 *  schemaSetup() executes all SQL statements in table_definitions to 
 *  have the DB schema ready for SQL queries.
 */
function schemaSetup() {
	fs.stat(force_rebuild, function (err, stat) {
		if (err == null) {
			log(logging.warning_level, force_rebuild + " exists, force rebuilding DB");
			
			fs.unlink(force_rebuild, function (err) {
				if (err) log(logging.critical_level, "Failed to delete " + force_rebuild);
			});

			mySQLConnection.query(dropDBQuery, function (error, results, fields) {
				log(logging.warning_level, "blips dropped, rebuilding now");
				buildSchema();
			});
		}
		else {
			mySQLConnection.query(blipsDbExistsQuery, function (error, results, fields) {
				if (error) {
					log(logging.critical_level, "DB schema missing, rebuilding basic DB");

					buildSchema();
					return;
				}

				log(logging.warning_level, "DB Schema exists, not rebuilding");
				notifyReadyListeners(false);
			});
		}
	});
}

/**
 *  buildCitiesDatabase() executes the Python script referenced by build_database.
 *	The Python script inserts City, Province and Country rows into the DB.
 */
function buildCitiesDatabase() {
	var options = {
		mode: 'text',
		pythonPath: '/usr/bin/python35',
		args: [hostname, dbuser, dbpass, dbname]
	};

	pythonshell.run(build_database, options, function (error, results) {
		if (error) throw error;

		log(logging.trace_level, results);
		notifyReadyListeners(true);
	});
}

// Note: This is an observer pattern, good to show in a UML diagram
function notifyReadyListeners(rebuildDB) {
	databaseReadyCallbacks.forEach(function(callback) {
		callback(rebuildDB);
	});
}

// mysql_client setup, connect to MySQL server and build initial DB tables
mySQLConnection.connect();
schemaSetup();

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
	log(logging.trace_level, "queryAndCallback " + queryStr);

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
	log(logging.trace_level, "bulkInsert " + queryStr);

	mySQLConnection.query(queryStr, [values], function (error) {
		if (error) throw error;

		if (callback != null) {
			callback();
		}
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

	log(logging.trace_level, "tableRowCount " + blipID + " " + queryStr);

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

	log(logging.trace_level, "getBlipLastModifiedTime " + queryStr);

	mySQLConnection.query(queryStr, function (error, results, fields) {
		if (error) throw error;

		var queryStr = unixTimestampQuery + "(" + mySQLConnection.escape(results[0].Updated) + ")";

		log(logging.trace_level, "getBlipLastModifiedTime nested " + queryStr);

		mySQLConnection.query(queryStr, function (error, results, fields) {
			if (error) throw error;

			var key = (Object.keys(results[0])[0]);

			callback(results[0][key]);
		});
	});
}

exports.addDBReadyCallback = (callback) => {
	databaseReadyCallbacks.push(callback);
}
