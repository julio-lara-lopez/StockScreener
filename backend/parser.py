from bs4 import BeautifulSoup
import pandas as pd
with open("response.html", "rb") as f:
    soup = BeautifulSoup(f, "lxml")

# find all the screener root divs
roots = soup.find_all("div", class_="js-base-screener-page-component-root")

def table_to_records(table):
    headers = [th.get_text(strip=True) for th in table.select("thead th")]
    rows = []
    for tr in table.select("tbody tr"):
        cells = [td.get_text(strip=True) for td in tr.find_all("td")]
        rows.append(dict(zip(headers, cells)))
    return rows

all_records = []
for div in roots:
    table = div.find("table")
    if table:
        all_records.extend(table_to_records(table))

df = pd.DataFrame(all_records)
    