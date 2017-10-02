# Blips City/Province/Country DB Builder
# (uses PyMySQL to open a cursor into DB, table_definitions.sql needs to have been run first)
# Get list of cities with a population > 100 000
# and build the MySQL database
#
# Data is gathered from Wikipedia pages for U.S. and Canada (for now)

from urllib.request import urlopen

def us_cities():
	wiki_url = "https://en.wikipedia.org/wiki/List_of_United_States_cities_by_population"

	with urlopen(wiki_url) as site:
		# Decode response using UTF-8
		html_response = site.read()
		encoding = site.headers.get_content_charset('utf-8')
		decoded_html = html_response.decode(encoding)

		db_entries = []

		city_line_number = 1
		city_rsplit_number = 2

		state_line_number = 2
		state_rsplit_number = 4

		# Split on first occurence of "<td>1</td>", this is where the
		# the list of cities begins
		pop_table = decoded_html.split("<td>1</td>", 1)[1]


		# Split on end of HTML table, this is where the list of cities ends
		pop_table = pop_table.split("</table>")[0]

		pop_index = 1

		# FIX THIS - Need better way to get number of items in table
		while pop_index != 308:
			pop_index = pop_index + 1
			pop_table = pop_table.split("<td>" + str(pop_index) + "</td>")
			lines = pop_table[0].splitlines()

			city = lines[city_line_number]
			state = lines[state_line_number]

			city = city.split("</a>")[0]
			city = city.rsplit(">")[city_rsplit_number]

			state = state.split("</td>")[0]
			state = state.rsplit(">")[state_rsplit_number]

			entry = city, state, "United States"
			db_entries.append(entry)

			if len(pop_table) > 1:
				pop_table = pop_table[1]

		for entry in db_entries:
			print(entry[0] + ", " + entry[1] + ", " + entry[2])


def main():
	us_cities()

main()