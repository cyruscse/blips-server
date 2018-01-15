from multiprocessing.dummy import Pool as ThreadPool

import googlemaps
import pymysql
import sys
import math
import time

gmaps = googlemaps.Client(key = 'AIzaSyB0oGuvJF0foOJxAwSj_pxlsLJdijmsoFw')

location_cache_query = "select CachedTime, ID from LocationCache where "
location_cache_query_id = "select ID from LocationCache where "
location_cache_insert = "insert into LocationCache values ("
location_cache_update = "update LocationCache set CachedTime = (now()) where Type = \""
blip_cache_clear = "delete from Blips where LCID = \""
blip_bulk_insert = "insert ignore into Blips ( ID, LCID, Type, Name, Latitude, Longitude ) values (%s, %s, %s, %s, %s, %s)"
unix_timestamp_query = "select UNIX_TIMESTAMP (\'"

db_address = ""
db_port = 3306
db_user = ""
db_pass = ""
db = ""

city = ""
state = ""
country = ""
lc_id = 0
global_attraction = ""

cells = []
cell_radius = 0

one_day_in_seconds = 86400
R = 6371

def setupCursor():
	conn = pymysql.connect(host = db_address, port = db_port, user = db_user, passwd = db_pass, db = db)
	conn.set_charset('utf8')
	cursor = conn.cursor()

	conn.begin()

	return conn, cursor

def deg2rad(deg):
	return deg * (math.pi / 180)

def distanceBetweenPoints(lat1, lng1, lat2, lng2):
	d_lat = deg2rad(lat2 - lat1)
	d_lng = deg2rad(lng2 - lng1)
	a = math.sin(d_lat / 2) * math.sin(d_lat / 2) + math.cos(deg2rad(lat1)) * math.cos(deg2rad(lat2)) * math.sin(d_lng / 2) * math.sin(d_lng / 2)
	c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
	d = R * c

	return (d * 1000)

def calculateNewLocation(old_lat, old_lng, dx, dy):
	new_location = {'lat': old_lat + ((dy / 1000) / R) * (180 / math.pi), 'lng': old_lng + ((dx / 1000) / R) * (180 * math.pi) / math.cos(old_lat * math.pi / 180)}

	return new_location

def queryPlaces(loc):
	places = gmaps.places_nearby(loc, radius = cell_radius, open_now = True, type = global_attraction) # need to hook up open_now

	to_insert = []

	if len(places["results"]) is 0:
		print("No places for " + str(loc["lat"]) + " " + str(loc["lng"]) + " " + str(global_attraction))
		return

	for result in places["results"]:
		row = []

		row.append(result["id"])
		row.append(lc_id)
		row.append(global_attraction)
		row.append(result["name"].encode('utf-8'))
		row.append(result["geometry"]["location"]["lat"])
		row.append(result["geometry"]["location"]["lng"])

		to_insert.append(row)

	conn, cursor = setupCursor()

	cursor.executemany(blip_bulk_insert, to_insert)
	conn.commit()

	cursor.close()
	conn.close()

def initQueryPlaces(attraction):
	global global_attraction

	global_attraction = attraction

	pool = ThreadPool(len(cells))
	results = pool.map(queryPlaces, cells)
	pool.close()
	pool.join()

def createLocationCache(attraction):
	global lc_id

	query = location_cache_insert + "\"" + city + "\", \"" + state + "\", \"" + country + "\", \"" + attraction + "\", (now()), NULL)"

	conn, cursor = setupCursor()

	cursor.execute(query)
	conn.commit()

	query = location_cache_query_id + "city = \"" + city + "\" and state = \"" + state + "\" and country = \"" + country + "\" and Type = \"" + attraction + "\""

	cursor.execute(query)
	lc_id = cursor.fetchone()[0]

	cursor.close()
	conn.close()

	initQueryPlaces(attraction)

def updateLocationCache(attraction):
	query = blip_cache_clear + str(lc_id) + "\""

	conn, cursor = setupCursor()

	cursor.execute(query)

	query = location_cache_update + attraction + "\""

	cursor.execute(query)
	conn.commit()

	cursor.close()
	conn.close()

	initQueryPlaces(attraction)

def checkCacheValidity(cached_time):
	current_time = time.time()
	query = unix_timestamp_query + str(cached_time) + "\')"

	conn, cursor = setupCursor()

	cursor.execute(query)
	cursor.close()
	conn.close()

	if (cursor.fetchone()[0] + one_day_in_seconds) > current_time:
		return False

	return True

def cacheQuery(attraction):
	query = location_cache_query + "city = \"" + city + "\" and state = \"" + state + "\" and country = \"" + country + "\" and Type = \"" + attraction + "\""

	conn, cursor = setupCursor()

	cursor.execute(query)
	cursor.close()
	conn.close()

	if cursor.rowcount is 0:
		createLocationCache(attraction)
	else:
		global lc_id
		lc_entry = cursor.fetchone()
		lc_id = lc_entry[1]

		if checkCacheValidity(lc_entry[0]) is False:
			updateLocationCache(attraction)

def geocodeLocation():
	global cells
	global cell_radius

	location_str = city + ", " + state + ", " + country
	geocode_result = gmaps.geocode(location_str)

	ne_bound = geocode_result[0]['geometry']['viewport']['northeast']
	sw_bound = geocode_result[0]['geometry']['viewport']['southwest']

	nw_bound = {'lat': ne_bound['lat'], 'lng': sw_bound['lng']}
	se_bound = {'lat': sw_bound['lat'], 'lng': ne_bound['lng']}

	city_length = distanceBetweenPoints(ne_bound['lat'], ne_bound['lng'], nw_bound['lat'], nw_bound['lng'])
	city_width = distanceBetweenPoints(nw_bound['lat'], nw_bound['lng'], sw_bound['lat'], sw_bound['lng'])

	cell_radius = city_length / 7	#7 need to be a const
	city_rows = math.ceil(city_width / cell_radius)

	cells = []

	for i in range(7):
		for j in range(city_rows):
			new_point = calculateNewLocation(sw_bound['lat'], sw_bound['lng'], (cell_radius * i), (cell_radius * j))
			cells.append(new_point)

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

	geocodeLocation()

	pool = ThreadPool(len(attraction_types))
	results = pool.map(cacheQuery, attraction_types)
	pool.close()
	pool.join()

main()