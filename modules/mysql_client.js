const mysql = require('mysql');
const fs = require('fs');
const pythonshell = require('python-shell');

const hostname = 'aa5icva8ezh544.crnuwmhdforv.us-east-2.rds.amazonaws.com';
const dbuser = 'blips';
const dbpass = 'passpass';
const dbname = 'blips';

const table_definitions = "dbsetup/table_definitions.sql";
const build_database = "dbsetup/build_cities_database.py";

const lastModTimeQuery = "select Updated from City where Name = ";
const unixTimestampQuery = "select UNIX_TIMESTAMP ";
const tableRowCountQuery = "select count(*) from Blips ";

var mySQLConnection = mysql.createConnection({
    host      : hostname,
    user      : dbuser,
    password  : dbpass,
});


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

function buildCitiesDatabase() {
	var options = {
		mode: 'text',
		pythonPath: '/usr/bin/python35',
		args: [hostname, dbuser, dbpass, dbname]
	};

	pythonshell.run(build_database, options, function (error, results) {
		if (error) throw error;

		console.log(results);
	});
}

mySQLConnection.connect();
schemaSetup();
buildCitiesDatabase();

exports.queryAndCallback = (queryStr, queryCallback, callerCallback, queryArgs) => {
	console.log(queryStr) // redirect this/add debug logging

	mySQLConnection.query(queryStr, function (error, results, fields) {
		if (error) throw error;

		queryCallback(results, callerCallback, queryArgs);
	});
}

exports.bulkInsert = (queryStr, values, callback) => {
	mySQLConnection.query(queryStr, [values], function (error) {
		if (error) throw error;

		callback();
	});
}

exports.escape = (string) => {
	return mySQLConnection.escape(string);
}

exports.tableRowCount = (blipID, callback) => {
	var queryStr = tableRowCountQuery + " where BID = " + blipID;

	mySQLConnection.query(queryStr, function (error, results, fields) {
		if (error) throw error;

		var key = (Object.keys(results[0])[0]);

		callback(results[0][key]);
	});
}

exports.getBlipLastModifiedTime = (cityStr, callback) => {
	var queryStr = lastModTimeQuery + mySQLConnection.escape(cityStr);

	mySQLConnection.query(queryStr, function (error, results, fields) {
		if (error) throw error;

		var queryStr = unixTimestampQuery + "(" + mySQLConnection.escape(results[0].Updated) + ")";

		mySQLConnection.query(queryStr, function (error, results, fields) {
			if (error) throw error;

			var key = (Object.keys(results[0])[0]);

			callback(results[0][key]);
		});
	});
}
