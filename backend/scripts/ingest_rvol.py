import os
import re
import uuid
from dataclasses import dataclass
from typing import Dict

import requests
import pandas as pd
from bs4 import BeautifulSoup
import dotenv
import unicodedata

dotenv.load_dotenv()
URL = os.environ.get("RVOL_URL")
API_BASE_URL = os.environ.get("API_BASE_URL", "http://localhost:8000")
SETTINGS_URL = os.environ.get("APP_SETTINGS_URL")

MULT = {"K": 1e3, "M": 1e6, "B": 1e9, "T": 1e12}


@dataclass
class FilterConfig:
    min_rvol: float
    min_price: float
    max_price: float
    min_pct_change: float


def _env_float(*keys: str, default: float) -> float:
    for key in keys:
        raw = os.environ.get(key)
        if raw is None:
            continue
        try:
            return float(raw)
        except ValueError:
            continue
    return default


def load_filter_config() -> FilterConfig:
    settings_endpoint = SETTINGS_URL or f"{API_BASE_URL.rstrip('/')}/api/settings"

    try:
        resp = requests.get(settings_endpoint, timeout=10)
        resp.raise_for_status()
        data: Dict[str, object] = resp.json()
        return FilterConfig(
            min_rvol=float(data.get("min_rvol", 0.0)),
            min_price=float(data.get("price_min", 0.0)),
            max_price=float(data.get("price_max", float("inf"))),
            min_pct_change=float(data.get("min_pct_change", 0.0)),
        )
    except Exception as exc:  # pylint: disable=broad-except
        print(
            f"Warning: unable to fetch application settings ({exc}); falling back to environment defaults."
        )

    return FilterConfig(
        min_rvol=_env_float("MIN_RVOL", default=0.0),
        min_price=_env_float("PRICE_MIN", "MIN_PRICE", default=0.0),
        max_price=_env_float("PRICE_MAX", "MAX_PRICE", default=float("inf")),
        min_pct_change=_env_float("MIN_PCT_CHANGE", default=0.0),
    )

def _normalize_numstr(s: str) -> str:
    """Normalize weird unicode: thin/nb spaces, unicode minus, currency codes."""
    s = unicodedata.normalize("NFKC", str(s)).upper()
    # remove various unicode spaces
    s = s.replace("\u00a0", "").replace("\u202f", "")  # NBSP & NARROW NBSP
    s = re.sub(r"\s+", "", s)
    # unify minus variants
    s = s.replace("\u2212", "-").replace("\u2013", "-").replace("\u2014", "-")
    # drop currency symbols/codes (keep K/M/B/T multipliers)
    s = s.replace("$", "")
    s = s.replace("USD", "")  # handles 'MUSD', ' USD', etc.
    return s

def extract_ticker_and_name_from_html(symbol_td):
    """
    Extract ticker and company name from the HTML structure of the symbol cell.
    Based on the HTML structure you provided.
    """
    # Look for the ticker in the <a> tag with class "tickerName-GrtoTeat"
    ticker_link = symbol_td.find('a', class_=lambda x: x and 'tickerName-GrtoTeat' in x)
    ticker = None
    if ticker_link:
        ticker = ticker_link.get_text(strip=True)
    
    # Look for the company name in the <sup> tag with class "tickerDescription-GrtoTeat"
    name_element = symbol_td.find('sup', class_=lambda x: x and 'tickerDescription-GrtoTeat' in x)
    name = None
    if name_element:
        name = name_element.get_text(strip=True)
    
    # Fallback: if we couldn't find the specific elements, try other common patterns
    if not ticker:
        # Try any <a> tag (might be the ticker link)
        any_link = symbol_td.find('a')
        if any_link:
            ticker = any_link.get_text(strip=True)
    
    if not name:
        # Try <sup>, <span>, or <div> that might contain the name
        for tag in ['sup', 'span', 'div']:
            elements = symbol_td.find_all(tag)
            for elem in elements:
                text = elem.get_text(strip=True)
                # Skip if it looks like a ticker (short, all caps)
                if text and len(text) > 6 and not text.isupper():
                    name = text
                    break
            if name:
                break
    
    return ticker, name

def table_to_records_fixed(table):
    """
    Fixed version that properly extracts ticker and name from HTML structure
    """
    headers = [th.get_text(strip=True) for th in table.select("thead th")]
    print(f"Headers found: {headers}")
    
    rows = []
    symbol_col_idx = None
    if "Symbol" in headers:
        symbol_col_idx = headers.index("Symbol")
    
    for tr in table.select("tbody tr"):
        cells = tr.find_all("td")
        row_data = {}
        
        for i, (header, td) in enumerate(zip(headers, cells)):
            if i == symbol_col_idx:
                # Special handling for Symbol column
                ticker, name = extract_ticker_and_name_from_html(td)
                row_data[header] = td.get_text(strip=True)  # Keep original for debugging
                row_data["Ticker"] = ticker
                row_data["Name"] = name
                print(f"Extracted - Ticker: '{ticker}', Name: '{name}'")
            else:
                # Normal text extraction for other columns
                row_data[header] = td.get_text(strip=True)
        
        rows.append(row_data)
    
    return rows

def scrape_and_parse():
    print("Starting scraping with fixed parser...")
    r = requests.get(URL, timeout=30)
    r.raise_for_status()
    soup = BeautifulSoup(r.text, "lxml")
    roots = soup.find_all("div", class_="js-base-screener-page-component-root")

    all_records = []
    for div in roots:
        table = div.find("table")
        if table:
            all_records.extend(table_to_records_fixed(table))

    df = pd.DataFrame(all_records)
    
    # Now we should have separate Ticker and Name columns already
    if "Ticker" in df.columns and "Name" in df.columns:
        print("\nFirst 10 rows - Ticker and Name extraction:")
        print(df[["Symbol", "Ticker", "Name"]].head(10))
    else:
        print("Warning: Ticker and Name columns not created properly")
        # Fallback to your original method if HTML parsing fails
        if "Symbol" in df.columns:
            print("Falling back to regex extraction...")
            orig_symbol = df["Symbol"].astype(str)
            df["Ticker"], df["Name"] = zip(*orig_symbol.map(extract_ticker_and_name_improved))

    # Rename other columns as before
    df = df.rename(
        columns={
            "Rel Volume": "RVOL",
            "Change\xa0%": "PctChange", 
            "Market cap": "MarketCap",
        }
    )

    # Apply number parsing
    df["RVOL_num"] = df["RVOL"].map(lambda x: parse_human_number(x, as_int=False))
    df["Price_num"] = df["Price"].map(lambda x: parse_human_number(x, as_int=False))
    df["Pct_num"] = df["PctChange"].map(parse_percent)
    df["Volume_num"] = df["Volume"].map(lambda x: parse_human_number(x, as_int=True))
    df["MktCap_num"] = df["MarketCap"].map(lambda x: parse_human_number(x, as_int=True))

    return df

def extract_ticker_and_name_improved(sym_cell: str):
    """
    Fallback regex-based extraction (your original method)
    """
    s = str(sym_cell).strip()
    print(f"Fallback processing: '{s}'")
    
    # Strategy 1: Look for ticker followed by space and name
    m = re.match(r"^([A-Z.\-]{1,5})\s+(.+)$", s)
    if m:
        ticker = m.group(1)
        name = m.group(2).strip()
        print(f"  Strategy 1: ticker='{ticker}', name='{name}'")
        return ticker, name
    
    # Strategy 2: Look for ticker at start, followed by lowercase or mixed case
    m = re.match(r"^([A-Z.\-]{1,5})([a-z].*|[A-Z][a-z].*)$", s)
    if m:
        ticker = m.group(1)
        name = m.group(2).strip()
        print(f"  Strategy 2: ticker='{ticker}', name='{name}'")
        return ticker, name
    
    # Strategy 3: Look for known ticker patterns followed by company indicators
    m = re.match(r"^([A-Z.\-]{1,5})(Inc\.?|Corp\.?|Ltd\.?|LLC|Co\.?|Group|Holdings?|Technologies?|Systems?|Solutions?|[A-Z][a-z].*)$", s, re.IGNORECASE)
    if m:
        ticker = m.group(1)
        name = m.group(2).strip()
        print(f"  Strategy 3: ticker='{ticker}', name='{name}'")
        return ticker, name
    
    # Strategy 4: Split on first occurrence of multiple capitals followed by lowercase
    m = re.match(r"^([A-Z.\-]{2,5})([A-Z][a-z].*)$", s)
    if m:
        ticker = m.group(1)
        name = m.group(2).strip()
        print(f"  Strategy 4: ticker='{ticker}', name='{name}'")
        return ticker, name
    
    # Strategy 5: Look for 3-5 consecutive uppercase letters at the start
    m = re.match(r"^([A-Z]{3,5})(.*)$", s)
    if m and len(m.group(2)) > 0:
        ticker = m.group(1)
        name = m.group(2).strip() or None
        print(f"  Strategy 5: ticker='{ticker}', name='{name}'")
        return ticker, name
    
    # Strategy 6: Check if it's all uppercase (likely just a ticker)
    if re.match(r"^[A-Z.\-]{1,5}$", s):
        print(f"  Strategy 6: ticker='{s}', name=None")
        return s, None
    
    # Fallback: return whole string as ticker
    print(f"  Fallback: ticker='{s}', name=None")
    return s, None

def parse_human_number(s: str | None, *, as_int: bool = False):
    """Parses '786K', '1.2M', '55M', '1B', '4.11MUSD', '4.46USD', '1,496.51', '5.3x'."""
    if s is None:
        return None
    s = _normalize_numstr(s)
    if s in ("", "-", "â€", "N/A"):
        return None
    s = s.replace(",", "")
    # remove trailing 'x' for RVOL
    s = re.sub(r"[X]$", "", s)

    m = re.match(r"^([+-]?\d*\.?\d+)([KMBT]?)$", s)
    if m:
        val = float(m.group(1))
        val *= MULT.get(m.group(2), 1)
        return int(val) if as_int else val
    # last-ditch plain float
    try:
        val = float(s)
        return int(val) if as_int else val
    except ValueError:
        return None

def parse_percent(s):
    if s is None:
        return None
    s = _normalize_numstr(str(s))
    s = s.replace("%", "")
    return parse_human_number(s, as_int=False)


def apply_filters(df: pd.DataFrame, cfg: FilterConfig) -> pd.DataFrame:
    if df.empty:
        return df

    rvol_series = pd.to_numeric(df["RVOL_num"], errors="coerce")
    price_series = pd.to_numeric(df["Price_num"], errors="coerce")
    pct_series = pd.to_numeric(df["Pct_num"], errors="coerce")

    mask = (
        rvol_series.ge(cfg.min_rvol)
        & price_series.ge(cfg.min_price)
        & price_series.le(cfg.max_price)
        & pct_series.ge(cfg.min_pct_change)
    )

    filtered = df.loc[mask].copy()
    print(
        f"Applied filters: min RVOL {cfg.min_rvol}, price between {cfg.min_price} and {cfg.max_price}, "
        f"min % change {cfg.min_pct_change}."
    )
    print(f"Rows before filtering: {len(df)} | after filtering: {len(filtered)}")
    return filtered


def post_batch(df):
    payload = {
        "batch_id": str(uuid.uuid4()),
        "items": [
            {
                "ticker": str(row["Ticker"]).upper() if row.get("Ticker") else None,
                "name": row.get("Name"),
                "rvol": parse_human_number(row.get("RVOL"), as_int=False),
                "price": parse_human_number(row.get("Price"), as_int=False),
                "pct_change": parse_percent(row.get("PctChange")),
                "volume": parse_human_number(row.get("Volume"), as_int=True),
                "market_cap": parse_human_number(row.get("MarketCap"), as_int=True),
                "sector": row.get("Sector"),
                "analyst_rating": row.get("Analyst Rating"),
            }
            for _, row in df.iterrows()
        ],
    }
    resp = requests.post(
        f"{API_BASE_URL.rstrip('/')}/internal/ingest-rvol-batch",
        json=payload,
        timeout=30,
    )
    print(resp.status_code, resp.text)


if __name__ == "__main__":
    cfg = load_filter_config()
    df = scrape_and_parse()
    if not df.empty:
        print(f"\nFinal DataFrame shape: {df.shape}")
        if "Ticker" in df.columns and "Name" in df.columns:
            print("\nFinal results:")
            print(df[["Ticker", "Name", "RVOL", "Price", "PctChange", "Volume", "MarketCap"]].head(10))
        filtered_df = apply_filters(df, cfg)
        if filtered_df.empty:
            print("No rows matched the configured filters. Skipping batch upload.")
        else:
            post_batch(filtered_df)
