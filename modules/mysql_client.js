const mysql = require('mysql');

module.exports = (host, user, password, database) => mysql.createConnection({
    host      : host,
    user      : user,
    password  : password,
    database  : database
});
