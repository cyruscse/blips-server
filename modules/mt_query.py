from multiprocessing.dummy import Pool as ThreadPool

import googlemaps
import pymysql
import sys
import math

gmaps = googlemaps.Client(key = 'AIzaSyB0oGuvJF0foOJxAwSj_pxlsLJdijmsoFw')

location_cache_query = "select * from LocationCache where "
location_cache_insert = "insert into LocationCache values ("

db_address = ""
db_port = 3306
db_user = ""
db_pass = ""
db = ""

city = ""
state = ""
country = ""

cells = []

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

def cacheNewResults(attraction):
	query = location_cache_insert + "\"" + city + "\", \"" + state + "\", \"" + country + "\", \"" + attraction + "\", (now()), NULL)"

	conn, cursor = setupCursor()

	cursor.execute(query)
	conn.commit()

	cursor.close()
	conn.close()


def cacheQuery(attraction):
	query = location_cache_query + "city = \"" + city + "\" and state = \"" + state + "\" and country = \"" + country + "\" and Type = \"" + attraction + "\""

	conn, cursor = setupCursor()

	cursor.execute(query)
		
	cursor.close()
	conn.close()

	if cursor.rowcount is 0:
		cacheNewResults(attraction)
	else:
		print("len was not 0")

def geocodeLocation():
	global cells

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
		cells.append([])
		for j in range(city_rows):
			new_point = calculateNewLocation(sw_bound['lat'], sw_bound['lng'], (cell_radius * i), (cell_radius * j))
			cells[i].append(new_point)

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