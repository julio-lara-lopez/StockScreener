
import requests
from bs4 import BeautifulSoup


def scrape():
    
    url = 'https://www.tradingview.com/markets/stocks-usa/market-movers-unusual-volume/'
    response = requests.get(url)
    # Save HTML response to a file
    with open("response.html", "w", encoding="utf-8") as f:
        f.write(response.text)
    soup = BeautifulSoup(response.text, 'html.parser')
    print(soup)



if __name__ == '__main__':
    scrape()