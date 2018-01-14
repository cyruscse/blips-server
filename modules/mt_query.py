from multiprocessing.dummy import Pool as ThreadPool

import pymysql
import sys

location_cache_query = "select * from LocationCache where "

db_address = ""
db_port = 3306
db_user = ""
db_pass = ""
db = ""

city = ""
state = ""
country = ""

def cacheQuery(attraction):
	query = location_cache_query + "city = \"" + city + "\" and state = \"" + state + "\" and country = \"" + country + "\" and Type = \"" + attraction + "\""

	conn = pymysql.connect(host = db_address, port = db_port, user = db_user, passwd = db_pass, db = db)
	conn.set_charset('utf8')
	cursor = conn.cursor()

	conn.begin()

	cursor.execute(query)

	for row in cursor:
		print(row[0])

	cursor.close()
	conn.close()

def main():
	global db_address
	global db_user
	global db_pass
	global db

	global city
	global state
	global country

	attraction_types = sys.argv[8:]

	db_address = sys.argv[1]
	db_user = sys.argv[2]
	db_pass = sys.argv[3]
	db = sys.argv[4]
	city = sys.argv[5]
	state = sys.argv[6]
	country = sys.argv[7]

	pool = ThreadPool(len(attraction_types))
	results = pool.map(cacheQuery, attraction_types)
	pool.close()
	pool.join()

main()