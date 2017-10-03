# Blips City/Province/Country DB Builder
# (uses PyMySQL to open a cursor into DB, table_definitions.sql needs to have been run first)
# Get list of cities with greatest population in a few countries
#
# Data is gathered from Wikipedia pages for U.S. and Canada (for now)

from urllib.request import urlopen
import re

# https://github.com/PyMySQL
import pymysql

us_wiki_url = "https://en.wikipedia.org/wiki/List_of_United_States_cities_by_population"
canada_wiki_url = "https://en.wikipedia.org/wiki/List_of_the_100_largest_municipalities_in_Canada_by_population"
db_address = "localhost"
db_port = 3306
db_user = "root"
db_pass = "pass"
db = "blips"

# List of tuples to add to DB
db_entries = []
db_states_added = set()

db_country_indicies = dict()
db_state_indicies = dict()

# Get number cities in given Wiki page
def get_num_cities(contents, index_tag_begin, index_tag_end):
	pop_table = contents.split(index_tag_begin + "1" + index_tag_end, 1)[1]
	pop_table = pop_table.split("</table>")[0]

	last_element = pop_table.split("<tr>")[pop_table.count("<tr>")]

	return int(re.search(r'\d+', last_element).group())

# Given line of HTML corresponding to City name, split string
# to get and return City name
def city_split(city_line):
	if "<b>" not in city_line:
		city_line = city_line.split("</a>")[0]
		city_line = city_line.rsplit(">")[city_line.count(">")]

		if "title" in city_line:
			city_line = city_line.split("title=\"")[1]
			city_line = city_line.split("\"")[0]

	# Some city names are bolded (i.e. on the US page), requiring special handling
	else:
		city_line = city_line.split("title=\"")[1]

		if "," in city_line:
			city_line = city_line.split(",")[0]
		else:
			city_line = city_line.split("\"")[0]

	return city_line

# Given line of HTML corresponding to State name, split string
# to get and return State name
def state_split(state_line, index_tag_end):
	# String splitting constant
	state_rsplit_number = 4

	# Special handling for </small> and states that don't contain index_tag_end
	if "</small>" in state_line or index_tag_end not in state_line:
		state_line = state_line.split("</a>")[0]
		state_line = state_line.split(">")[state_line.count(">")]
	else:
		state_line = state_line.split(index_tag_end)[0]
		state_line = state_line.rsplit(">")[state_rsplit_number]

	# Splitting on </a> and > sometimes doesn't work, fallback to splitting on "title="
	if "title" in state_line:
		state_line = state_line.split("title=\"")[1]
		state_line = state_line.split("\"")[0]

	return state_line

# Creates tuples containing City, State, and Country. Tuples are then appended to a list to be inserted into the DB
def parse_cities(wiki_url, index_tag_begin, index_tag_end, city_line_number, state_line_number, country):
	with urlopen(wiki_url) as site:
		# Decode response using UTF-8
		html_response = site.read()
		encoding = site.headers.get_content_charset('utf-8')
		decoded_html = html_response.decode(encoding)

		num_cities = get_num_cities(decoded_html, index_tag_begin, index_tag_end)

		# Split on first occurence of "<td>1</td>", this is where the
		# the list of cities begins
		pop_table = decoded_html.split(index_tag_begin + "1" + index_tag_end, 1)[1]

		# Split on end of HTML table, this is where the list of cities ends
		pop_table = pop_table.split("</table>")[0]

		pop_index = 1

		# Loop over each line of filtered HTML (containing only Cities and States/Provinces)
		while pop_index <= num_cities:
			pop_index = pop_index + 1
			pop_table = pop_table.split(index_tag_begin + str(pop_index) + index_tag_end)
			lines = pop_table[0].splitlines()

			city = lines[city_line_number]
			state = lines[state_line_number]

			# Split City and State strings down to just the City and State name, respectively
			city = city_split(city)
			state = state_split(state, index_tag_end)

			# Create tuple and append to list
			entry = city, state, country
			db_entries.append(entry)

			if len(pop_table) > 1:
				pop_table = pop_table[1]

# Parse US cities
def us_cities():
	db_insert_country("United States")
	parse_cities(us_wiki_url, "<td>", "</td>", 1, 2, "United States")

# Parse Canadian cities
def canada_cities():
	db_insert_country("Canada")
	parse_cities(canada_wiki_url, "<center>", "</center>", 2, 3, "Canada")

# Insert a specific Country into the DB, maintains dictionary of Country Name to ID assigned in DB
def db_insert_country(country):
	conn = pymysql.connect(host=db_address, port=db_port, user=db_user, passwd=db_pass, db=db)
	cursor = conn.cursor()

	conn.begin()

	cursor.execute("insert into Country values (NULL, \"" + country + "\");")

	conn.commit()

	cursor.execute("select * from Country")

	for row in cursor:
		db_country_indicies[row[1]] = row[0]

	cursor.close()
	conn.close()

# Insert all Cities and States/Provinces to DB, called after all City and State names have been
# created from Wiki pages. Ensures that no redundant DB queries are performed.
def db_insert_cities():
	conn = pymysql.connect(host=db_address, port=db_port, user=db_user, passwd=db_pass, db=db)
	conn.set_charset('utf8')
	cursor = conn.cursor()

	conn.begin()

	cursor.execute('SET NAMES utf8;')
	cursor.execute('SET CHARACTER SET utf8;')
	cursor.execute('SET character_set_connection=utf8;')

	for entry in db_entries:
		if entry[1] not in db_states_added:
			cursor.execute("insert into Province values (NULL, \"" + entry[1] + "\", " + str(db_country_indicies[entry[2]]) + ");")
			db_states_added.add(entry[1])

			conn.commit()

			cursor.execute("select * from Province where Name = \"" + entry[1] + "\";")

			# Should only get one entry
			for row in cursor:
				db_state_indicies[entry[1]] = row[0]

			conn.begin()

		cursor.execute("insert into City values (NULL, \"" + entry[0] + "\", " + str(db_state_indicies[entry[1]]) + ", " + str(db_country_indicies[entry[2]]) + ");")

	conn.commit()

	cursor.close()
	conn.close()

def main():
	us_cities()
	canada_cities()
	db_insert_cities()

main()