# attraction_replace.py
# Cyrus Sadeghi - February 2018
# Attraction History merging of User Account and Guest Account

from multiprocessing.dummy import Pool as ThreadPool

import pymysql
import sys

user_preferences_replace = "replace into UserPreferences (UID, AID, Frequency) select (\""

# Global DB variables
db_address = ""
db_port = 3306
db_user = ""
db_pass = ""
db = ""

user_id = -1

# Common DB cursor setup, creates a connection to the Amazon RDS server (running MySQL)
# Returns a cursor that is ready to use
def setupCursor():
	conn = pymysql.connect(host = db_address, port = db_port, user = db_user, passwd = db_pass, db = db)
	conn.set_charset('utf8')
	cursor = conn.cursor()

	conn.begin()

	return conn, cursor

# Given a tuple of an attraction type and frequency,
# get the corresponding AttractionID then insert or replace the row in UserPreferences
def replaceAttraction(attraction_and_frequency):
	query = user_preferences_replace + str(user_id) + "\"), (select ID from AttractionTypes where AttractionTypes.Name = \"" + attraction_and_frequency[0] + "\"), (\"" + attraction_and_frequency[1] + "\")"
	
	conn, cursor = setupCursor()
	cursor.execute(query)
	conn.commit()

	cursor.close()
	conn.close()

def main():
	global db_address
	global db_user
	global db_pass
	global db
	global user_id

	attraction_and_freqs = sys.argv[6:]
	attrfreqs_list = list()

	db_address = sys.argv[1]
	db_user = sys.argv[2]
	db_pass = sys.argv[3]
	db = sys.argv[4]
	user_id = sys.argv[5]

	i = 0

	while i < len(attraction_and_freqs):
		t = attraction_and_freqs[i], attraction_and_freqs[i + 1]
		attrfreqs_list.append(t)
		i = i + 2

	pool = ThreadPool(len(attrfreqs_list))

	results = pool.map(replaceAttraction, attrfreqs_list)

	pool.close()
	pool.join()

main()
