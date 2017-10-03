# Blips City/Province/Country DB Builder
# (uses PyMySQL to open a cursor into DB, table_definitions.sql needs to have been run first)
# Get list of cities with a population > 100 000
# and build the MySQL database
#
# Data is gathered from Wikipedia pages for U.S. and Canada (for now)

from urllib.request import urlopen
import re

us_wiki_url = "https://en.wikipedia.org/wiki/List_of_United_States_cities_by_population"
canada_wiki_url = "https://en.wikipedia.org/wiki/List_of_the_100_largest_municipalities_in_Canada_by_population"

# List of tuples to add to DB
db_entries = []

def get_num_cities(contents, index_tag_begin, index_tag_end):
	pop_table = contents.split(index_tag_begin + "1" + index_tag_end, 1)[1]
	pop_table = pop_table.split("</table>")[0]

	last_element = pop_table.split("<tr>")[pop_table.count("<tr>")]

	return int(re.search(r'\d+', last_element).group())

def parse_cities(wiki_url, index_tag_begin, index_tag_end, city_line_number, state_line_number, country):
	with urlopen(wiki_url) as site:
		# Decode response using UTF-8
		html_response = site.read()
		encoding = site.headers.get_content_charset('utf-8')
		decoded_html = html_response.decode(encoding)

		num_cities = get_num_cities(decoded_html, index_tag_begin, index_tag_end)

		# String splitting constants
		state_rsplit_number = 4

		# Split on first occurence of "<td>1</td>", this is where the
		# the list of cities begins
		pop_table = decoded_html.split(index_tag_begin + "1" + index_tag_end, 1)[1]

		# Split on end of HTML table, this is where the list of cities ends
		pop_table = pop_table.split("</table>")[0]

		pop_index = 1

		while pop_index <= num_cities:
			pop_index = pop_index + 1
			pop_table = pop_table.split(index_tag_begin + str(pop_index) + index_tag_end)
			lines = pop_table[0].splitlines()

			city = lines[city_line_number]
			state = lines[state_line_number]

			if "<b>" not in city:
				city = city.split("</a>")[0]
				city = city.rsplit(">")[city.count(">")]

				if "title" in city:
					city = city.split("title=\"")[1]
					city = city.split("\"")[0]
			else:
				city = city.split("title=\"")[1]

				if "," in city:
					city = city.split(",")[0]
				else:
					city = city.split("\"")[0]

			# Special handling for </small> and states that don't contain index_tag_end
			if "</small>" in state or index_tag_end not in state:
				state = state.split("</a>")[0]
				state = state.split(">")[state.count(">")]
			else:
				state = state.split(index_tag_end)[0]
				state = state.rsplit(">")[state_rsplit_number]

			# Splitting on </a> and > sometimes doesn't work, fallback to splitting on
			# "title="
			if "title" in state:
				state = state.split("title=\"")[1]
				state = state.split("\"")[0]

			entry = city, state, country
			db_entries.append(entry)

			if len(pop_table) > 1:
				pop_table = pop_table[1]

		for entry in db_entries:
			print(entry[0] + ", " + entry[1] + ", " + entry[2])

def us_cities():
	parse_cities(us_wiki_url, "<td>", "</td>", 1, 2, "United States")

def canada_cities():
	parse_cities(canada_wiki_url, "<center>", "</center>", 2, 3, "Canada")

def main():
	us_cities()
	canada_cities()

main()