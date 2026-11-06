# CSV Workbench

<img src="./public/src/assets/icon.svg" alt="CSV Workbench icon" width="112">

[English](README.md) · [Русский](README.ru.md) · [Español](README.es.md)

![Python 3.11+](https://img.shields.io/badge/Python-3.11%2B-3776AB?logo=python&logoColor=white)
![Parser Standard library CSV](https://img.shields.io/badge/Parser-Standard%20library%20CSV-4472C4)
![UI HTML / CSS / JavaScript](https://img.shields.io/badge/UI-HTML%20%2F%20CSS%20%2F%20JavaScript-F7DF1E?logo=javascript&logoColor=black)
[![License MIT](https://img.shields.io/badge/License-MIT-22A669)](LICENSE)

Inspect and clean CSV files before the next import.

<details>
<summary>Contents</summary>

[Features](#readme-features) · [Technology stack](#readme-stack) · [Quick start](#readme-start) · [Boundaries and data handling](#readme-detail-01) · [Possible service pilot](#readme-detail-02) · [Verification on 2026-10-29](#readme-detail-03) · [Author](#readme-author) · [License](#readme-license)

</details>

<a id="readme-preview"></a>

![csv-workbench interface](docs/images/preview.jpg)

Actual local interface with synthetic demonstration data.

<a id="readme-features"></a>

## Features

### Prepare a supplier / CRM import

Enable **Prepare for import**, then **Read columns**. The first nonempty record
is the header. Select output columns, rename and reorder them, and mark required
fields. Validate text, ASCII integers, decimals with a dot (no exponent), or a
basic email shape. Values remain strings: `001` stays `001`; numbers are not rounded.
Email checking does not establish mailbox existence or deliverability.

Columns marked **Key** form a composite, case-sensitive unique key after optional
trimming. Empty keys are rejected; the first valid occurrence is accepted.
Malformed-width records, missing required values, invalid types and duplicate keys
go to a separate rejection file instead of silently disappearing. If exact-row
deduplication is enabled, repeated mapped rows are also reported as rejections.

Click **Build import file** for `import-ready.csv`, `rejected-records.csv` and the
JSON report. Rejection records retain original cells as JSON and logical CSV
record numbers (quoted multiline records can span multiple physical lines).
The preview shows up to 30 accepted and 30 rejected records; downloads contain all.
Basic cleanup remains available with the mode off and does not assume a header.
Mapping supports at most 200 selected columns and 200,000 projected cells,
in addition to the source limits. Formula protection still changes negative numbers
to spreadsheet text; review it for the destination importer.

Example: **Load sample → Prepare for import → Read columns**. Mark `sku` as Key,
`email` as required Email and `price` as Decimal. The sample yields one accepted
record and four rejections with distinct reasons. No cloud call or automatic
import into an external CRM/shop occurs. Mappings are kept only in memory.

| Feature | Behavior |
| --- | --- |
| Cleanup | Trim cells and remove blank rows |
| Duplicates | Optional exact deduplication with counts |
| Export | CSV and JSON report; formula protection on by default |

Paste CSV or choose a UTF-8 file; select comma, semicolon or tab explicitly. Trim surrounding whitespace, remove blank rows and optionally remove exact duplicate rows. Review the first 30 cleaned records, download the complete CSV and a JSON report. No header is assumed; duplicates are compared after optional trimming and before formula protection. Different column counts produce a warning and preserve every nonempty row.

The interface supports English, Russian and Spanish. First use follows browser language; an explicit selection is saved locally. Only the language preference is stored in localStorage.

<a id="readme-stack"></a>

## Technology stack

| Component | Source |
| --- | --- |
| Python standard-library HTTP server, strict CSV parsing, bounded requests | [app.py](app.py) |
| Vanilla JavaScript, browser Blob downloads, RU/EN/ES interface | [public/app.js](public/src/js/app.js) |
| Responsive HTML and CSS, original SVG icon | [public/index.html](public/index.html), [public/style.css](public/src/css/style.css), [public/icon.svg](public/src/assets/icon.svg) |
| Parser and HTTP boundary tests | [tests/test_app.py](tests/test_app.py) |

<a id="readme-start"></a>

## Quick start

Install Python 3.11 or newer manually. No third-party packages or automatic installation.

Windows can use an explicit `PYTHON_EXE`, an existing Codex bundled Python under the current user profile, or installed `py` / `python`; nothing is downloaded.

| Platform | Command |
| --- | --- |
| Windows | Double-click `Start.bat` or `Start.cmd` |
| macOS | `sh Start.command` (or `chmod +x Start.command` once, then double-click) |
| Ubuntu / macOS | `sh start.sh` or `make start` |
| Any supported Python environment | `python app.py` |

Open **http://127.0.0.1:8802** after the terminal prints that URL. Stop with Ctrl+C. Port override: PowerShell `$env:PORT=8808; python app.py`; POSIX `PORT=8808 sh start.sh`. The server binds only to 127.0.0.1; this is a local utility, not a public upload service.

<a id="readme-detail-01"></a>

## Boundaries and data handling

- Input: UTF-8 only, at most 1,000,000 encoded bytes, 10,000 logical records and 200,000 cells, as defined in [app.py](app.py). The JSON request body limit is 2,200,000 bytes; escaping can make some inputs reach that limit first. There is no silent truncation.
- Python's strict CSV parser rejects unterminated quoted fields and invalid text after a closing quote. It does not validate business semantics or every possible CSV dialect. A literal quote inside an unquoted field may be accepted by Python's CSV dialect.
- Spreadsheet protection is enabled by default: an apostrophe is prepended to formula-like values (`=`, `+`, `-`, `@`, leading tab/newline). This also changes negative numbers into text. Review the export for your target spreadsheet; protection is not a guarantee across every importer and later transformation.
- CSV data lives in browser and local process memory. The app writes no uploaded files or reports to disk; downloads are explicitly saved by the browser. The operating system may use swap or crash dumps; this app does not control those mechanisms. Close the tab and stop the process when finished.
- The server validates Host and Origin, exposes only allowlisted static assets, caps two simultaneous processing tasks, and does not log request bodies or paths. Do not expose it through a reverse proxy or share sensitive data with untrusted local software.


Run `python -m unittest discover -s tests -v` (or `make test`). Tests cover quoted multiline fields, trimming/deduplication, injection protection, malformed input, limits, preserved irregular rows, UTF-8 BOM, HTTP origin/host checks and asset allowlisting. Native macOS launch still requires verification; see the dated Windows/WSL Ubuntu checks below.

<a id="readme-detail-02"></a>

## Possible service pilot

**Hypothesis, not proven demand:** offer a supervised cleanup of a customer's product or CRM CSV before import. Agree on a sample, required columns and acceptance criteria; deliver the cleaned file and report after human review. This tool does not validate email addresses, merge customer identities or promise revenue. No payments, analytics, accounts or hosted storage are implemented.

<a id="readme-detail-03"></a>

## Verification on 2026-10-29

Windows and WSL Ubuntu: product tests and a real launcher start passed. macOS execution remains unverified. Browser checks used synthetic data; download buttons requested exports, but saving to the operating system Downloads folder was not verified.

<a id="readme-author"></a>

## Author

[d9911](https://github.com/d9911) · [d9911.org](https://d9911.org).

<a id="readme-license"></a>

## License

Own code and SVG: [MIT](LICENSE), copyright 2026 d9911. Python and browsers retain their own licenses.
