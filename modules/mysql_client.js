const mysql = require('mysql');
const hostname = 'localhost';

const lastModTimeQuery = "select Updated from City where Name = ";
const unixTimestampQuery = "select UNIX_TIMESTAMP ";
const tableRowCountQuery = "select count(*) from blips ";

/*var mySQLConnection = mysql.createConnection({
    host      : hostname,
    user      : 'root',
    password  : 'pass',
    database  : 'blips'
});

mySQLConnection.connect();
*/
exports.queryAndCallback = (queryStr, queryCallback, callerCallback, queryArgs) => {
/*	console.log(queryStr)

	mySQLConnection.query(queryStr, function (error, results, fields) {
		if (error) throw error;

		queryCallback(results, callerCallback, queryArgs);
	});*/
}

exports.bulkInsert = (queryStr, values, callback) => {
	/*mySQLConnection.query(queryStr, [values], function (error) {
		if (error) throw error;

		callback();
	});*/
}

exports.escape = (string) => {
	//return mySQLConnection.escape(string);
}

exports.tableRowCount = (blipID, callback) => {
/*	var queryStr = tableRowCountQuery + " where BID = " + blipID;

	mySQLConnection.query(queryStr, function (error, results, fields) {
		if (error) throw error;

		var key = (Object.keys(results[0])[0]);

		callback(results[0][key]);
	});*/
}

exports.getBlipLastModifiedTime = (cityStr, callback) => {
	/*var queryStr = lastModTimeQuery + mySQLConnection.escape(cityStr);

	mySQLConnection.query(queryStr, function (error, results, fields) {
		if (error) throw error;

		var queryStr = unixTimestampQuery + "(" + mySQLConnection.escape(results[0].Updated) + ")";

		mySQLConnection.query(queryStr, function (error, results, fields) {
			if (error) throw error;

			var key = (Object.keys(results[0])[0]);

			callback(results[0][key]);
		});
	});*/
}
