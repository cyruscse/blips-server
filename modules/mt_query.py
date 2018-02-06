# mt_query.py
# Cyrus Sadeghi - January 2018
# Multithreaded implementation of Blip querying

from multiprocessing.dummy import Pool as ThreadPool

import googlemaps
import pymysql
import sys
import math
import time

# Initialize Google API, using our API key
gmaps = googlemaps.Client(key = 'AIzaSyB0oGuvJF0foOJxAwSj_pxlsLJdijmsoFw')

# SQL queries used throughout all methods
location_cache_query = "select CachedTime, ID from LocationCache where "
location_cache_query_id = "select ID from LocationCache where "
location_cache_insert = "insert into LocationCache values ("
location_cache_update = "update LocationCache set CachedTime = (now()) where Type = \""
blip_cache_clear = "delete from Blips where LCID = \""
blip_bulk_insert = "insert ignore into Blips ( ID, LCID, Type, Name, Rating, Price, Latitude, Longitude ) values (%s, %s, %s, %s, %s, %s, %s, %s)"
blip_existence = "select count(*) from Blips where LCID = \""
unix_timestamp_query = "select UNIX_TIMESTAMP (\'"
user_preference_update = "insert into UserPreferences (UID, AID, Frequency) select (\""

# Global DB variables
db_address = ""
db_port = 3306
db_user = ""
db_pass = ""
db = ""

# City, State, and Country of current query (global, as this is shared between all threads and is immutable)
city = ""
state = ""
country = ""

user_id = -1

# Same implementation as the city-matrix branch, create a grid over the current city and query for blips
# in each cell. This Python implementation is multithreaded, all cells are queried simultaneously.
cells = []
cell_radius = 0

one_day_in_seconds = 86400  # One day in seconds, used for cache expiration
R = 6371					# Radius of the earth in km

# Common DB cursor setup, creates a connection to the Amazon RDS server (running MySQL)
# Returns a cursor that is ready to use
def setupCursor():
	conn = pymysql.connect(host = db_address, port = db_port, user = db_user, passwd = db_pass, db = db)
	conn.set_charset('utf8')
	cursor = conn.cursor()

	conn.begin()

	return conn, cursor

# Convert degrees to radians (used for distanceBetweenPoints)
def deg2rad(deg):
	return deg * (math.pi / 180)

# Calculate distance (in m) between two lat/lng points
def distanceBetweenPoints(lat1, lng1, lat2, lng2):
	d_lat = deg2rad(lat2 - lat1)
	d_lng = deg2rad(lng2 - lng1)
	a = math.sin(d_lat / 2) * math.sin(d_lat / 2) + math.cos(deg2rad(lat1)) * math.cos(deg2rad(lat2)) * math.sin(d_lng / 2) * math.sin(d_lng / 2)
	c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
	d = R * c

	return (d * 1000)

# Given a point (using lat/lng coordinates), and differences in x and y, calculate a new lat/lng point
def calculateNewLocation(old_lat, old_lng, dx, dy):
	new_location = {'lat': old_lat + ((dy / 1000) / R) * (180 / math.pi), 'lng': old_lng + ((dx / 1000) / R) * (180 / math.pi) / math.cos(old_lat * math.pi / 180)}

	return new_location

# Given an attraction type, LocationCache ID, and cell, query Google for a list of attractions (matching the passed attraction type)
# within the cell. Return the compiled list.
def queryPlaces(attraction, lc_id, cell):
	places = gmaps.places_nearby(cell, radius = cell_radius, max_price = 4, open_now = True, type = attraction) # need to hook up open_now

	to_insert = []
	file = '/tmp/mt_' + str(attraction) + '.log'

	if len(places["results"]) is 0:
		f = open(file, 'a')
		f.write("No places for " + str(cell["lat"]) + " " + str(cell["lng"]) + " " + str(attraction) + "\n")
		f.write(str(places))
		f.close()

		return

	for result in places["results"]:
		row = []

		# Sometimes, Google returns non-ASCII characters in the name.
		# Python doesn't like non-ASCII characters. Replace non-ASCII characters
		# with nothing to prevent a crash.
		''.join([x for x in result["name"] if ord(x) < 128]);

		row.append(result["id"])
		row.append(lc_id)
		row.append(attraction)
		row.append(result["name"].encode('utf-8'))

		# The rating and price_level tags aren't always included
		# (usually in newer entries), check to see if this attraction
		# has it, otherwise we crash.
		if "rating" in result:
			row.append(result["rating"])
		else:
			row.append("0")

		if "price_level" in result:
			row.append(result["price_level"])
		else:
			row.append("0")

		row.append(result["geometry"]["location"]["lat"])
		row.append(result["geometry"]["location"]["lng"])

		to_insert.append(row)

	return to_insert

# Given an attraction type to query, spawn a thread for each cell of the current city and query Google for the
# current attraction type once for each thread. This can't be done in one query as the Google API call can only return 20 attractions at once.
def initQueryPlaces(attraction, lc_id):
	# ThreadPool.map only allows one argument for each thread, so we can't pass attraction type, lcID, and the current cell
	# Instead we can use lambdas to partially setup the call to queryPlaces, setting up the attraction type and cell, allowing map to call with the current cell
	f = lambda attr: lambda lcid: lambda loc: queryPlaces(attraction, lc_id, loc)
	f = f(attraction)
	f = f(lc_id)

	# List that will be populated with results of queries for each cell
	combined_to_insert = []

	# Spawn a thread for each cell in the matrix
	pool = ThreadPool(len(cells))
	results = pool.map(f, cells)
	pool.close()
	pool.join()

	# This code is executed once all cell thread's for an attraction type are complete.
	# results contains a 2D array, with the first dimension corresponding to each cell, and the second dimension
	# containg the blips returned for that cell. We need to join all the blip array together so we can bulk insert into the DB
	for cell in results:
		if cell is not None:
			for blip in cell:
				combined_to_insert.append(blip)

	return combined_to_insert

# Given a previously unqueried attraction type and city, insert a row to the LocationCache table with the current time to start the caching process
# Once the row is inserted, query the DB for the generated unique ID for the new LocationCache row, then call initQueryPlaces with this ID and attraction type to query Google
def createLocationCache(attraction):
	query = location_cache_insert + "\"" + city + "\", \"" + state + "\", \"" + country + "\", \"" + attraction + "\", (now()), NULL)"

	conn, cursor = setupCursor()

	cursor.execute(query)
	conn.commit()

	query = location_cache_query_id + "city = \"" + city + "\" and state = \"" + state + "\" and country = \"" + country + "\" and Type = \"" + attraction + "\""

	cursor.execute(query)
	lc_id = cursor.fetchone()[0]

	print(lc_id)

	cursor.close()
	conn.close()

	return initQueryPlaces(attraction, lc_id)

# A row exists for the queried attraction and city, but it is out of date (i.e. cache invalid)
# First call the DB to delete all rows from the Blips database that correspond to the queried attraction type and city
# Then call initQueryPlaces (at this point, the queried attracion type and city is handled like a new attraction type and city)
def updateLocationCache(attraction, lc_id):
	query = blip_cache_clear + str(lc_id) + "\""

	conn, cursor = setupCursor()

	cursor.execute(query)

	query = location_cache_update + attraction + "\""

	cursor.execute(query)
	conn.commit()

	cursor.close()
	conn.close()

	return initQueryPlaces(attraction, lc_id)

# Given a cached time (as standard date/time), call the DB server to convert the date/time to a Unix timestamp. Check if the cached time is within
# the allowed cache validity time (currently set as one_day_in_seconds, 24 hours)
def checkCacheValidity(cached_time):
	current_time = time.time()
	query = unix_timestamp_query + str(cached_time) + "\')"

	conn, cursor = setupCursor()

	cursor.execute(query)
	cursor.close()
	conn.close()

	curTime = cursor.fetchone()[0]

	if (curTime + one_day_in_seconds) < current_time:
		return False

	return True

# Check the LocationCache table in the DB for cache validity on client's query
# If a row doesn't exist for the client's city and this thread's attraction type, create a new row
# If a row exists, call cacheCacheValidity to determine whether or not the cache can be used
def cacheQuery(attraction):
	conn, cursor = setupCursor()

	if int(user_id) is not -1:
		query = user_preference_update + str(user_id) + "\"), (select ID from AttractionTypes where AttractionTypes.Name = \"" + attraction + "\"), (1) on duplicate key update Frequency = Frequency + 1"

		cursor.execute(query)
		conn.commit();

	query = location_cache_query + "city = \"" + city + "\" and state = \"" + state + "\" and country = \"" + country + "\" and Type = \"" + attraction + "\""

	cursor.execute(query)

	if cursor.rowcount is 0:
		cursor.close()
		conn.close()

		return createLocationCache(attraction)
	else:
		lc_entry = cursor.fetchone()
		lc_id = lc_entry[1]

		# We have an LC entry, check if any Blip entries exist
		# This is here to prevent issue #19
		query = blip_existence + str(lc_id) + "\""

		cursor.execute(query)

		cursor.close()
		conn.close()

		blip_count = cursor.fetchone()[0]

		if blip_count is 0:
			return updateLocationCache(attraction, lc_id)

		print(lc_id)

		# If checkCacheValidity returns False, we need to clear the cache for this LocationCache row
		# lc_entry[0] is the date/time of caching
		if checkCacheValidity(lc_entry[0]) is False:
			return updateLocationCache(attraction, lc_id)
		#If it doesn't return False, this thread ends and joins back to the main thread

	return

# Geocode (convert user's location to readable names) user's location
# Google API call returns client city's northeast and southwest bounds
# Create a matrix over the city using the returned information
def geocodeLocation():
	global cells
	global cell_radius

	location_str = city + ", " + state + ", " + country
	geocode_result = gmaps.geocode(location_str)

	ne_bound = geocode_result[0]['geometry']['viewport']['northeast']
	sw_bound = geocode_result[0]['geometry']['viewport']['southwest']

	nw_bound = {'lat': ne_bound['lat'], 'lng': sw_bound['lng']}
	se_bound = {'lat': sw_bound['lat'], 'lng': ne_bound['lng']}

	# Calculate city dimensions
	city_length = distanceBetweenPoints(ne_bound['lat'], ne_bound['lng'], nw_bound['lat'], nw_bound['lng'])
	city_width = distanceBetweenPoints(nw_bound['lat'], nw_bound['lng'], sw_bound['lat'], sw_bound['lng'])

	cell_radius = city_length / 7	#7 need to be a const
	city_rows = math.ceil(city_width / cell_radius)

	cells = []

	# Fill array of city cells (used to be created as a 2D array, but is now a regular array to simplify code)
	for i in range(7):
		for j in range(city_rows):
			new_point = calculateNewLocation(sw_bound['lat'], sw_bound['lng'], (cell_radius * i), (cell_radius * j))
			cells.append(new_point)

# Entry point for script, set up global DB and city variables
# Once globals are set, call Google API to convert user's location (passed as lat/lng) to a city, state, and country name.
# Finally, spawn a thread for each passed attraction type (each thread calls cacheQuery())
def main():
	global db_address
	global db_user
	global db_pass
	global db

	global city
	global state
	global country
	global user_id

	attraction_types = sys.argv[9:]

	db_address = sys.argv[1]
	db_user = sys.argv[2]
	db_pass = sys.argv[3]
	db = sys.argv[4]
	city = sys.argv[5]
	state = sys.argv[6]
	country = sys.argv[7]
	user_id = sys.argv[8]

	geocodeLocation()

	# List that will be populated with results of queries for each cell
	combined_to_insert = []

	# Create a thread for each passed attraction type
	pool = ThreadPool(len(attraction_types))

	# map iterates over the second argument, in this case the passed list of attraction types,
	# and calls the first argument on the next thread with the current second argument.

	# In other words, if this script receives ['bar', 'bank', 'cafe'], the constructor above creates
	# three threads, and map makes the first thread call queryPlaces('bar'), the second thread call queryPlaces('bank'),
	# and the third thread call queryPlaces('cafe')
	results = pool.map(cacheQuery, attraction_types)

	# Close the thread pool and rejoin up to the main thread
	pool.close()
	pool.join()

	# This code is executed once all cell thread's for an attraction type are complete.
	# results contains a 2D array, with the first dimension corresponding to each cell, and the second dimension
	# containg the blips returned for that cell. We need to join all the blip array together so we can bulk insert into the DB
	for to_insert in results:
		if to_insert is not None:
			for blip in to_insert:
				combined_to_insert.append(blip)

	conn, cursor = setupCursor()

	# Bulk insert combined_to_insert
	cursor.executemany(blip_bulk_insert, combined_to_insert)
	conn.commit()

	cursor.close()
	conn.close()

	# At this point the script has updated the DB for the current query, and it is ready to be used to formulate a response to the client

main()
