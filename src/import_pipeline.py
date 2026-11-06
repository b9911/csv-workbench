"""Explicit, in-memory CSV import mapping. Never guesses or writes customer files."""
import csv
import io
import re

MAX_TEXT = 1_000_000
MAX_ROWS = 10_000
MAX_CELLS = 200_000


def read_source(payload):
    if not isinstance(payload, dict):
        raise ValueError('object_required')
    text, delimiter = payload.get('text'), payload.get('delimiter', ',')
    if not isinstance(text, str) or len(text.encode('utf-8')) > MAX_TEXT:
        raise ValueError('text_limit')
    if delimiter not in (',', ';', '\t'):
        raise ValueError('delimiter')
    if '\x00' in text:
        raise ValueError('nul')
    for option in ('trim', 'dedup', 'safe'):
        if option in payload and type(payload[option]) is not bool:
            raise ValueError('options')
    rows, cells = [], 0
    try:
        for row in csv.reader(io.StringIO(text.removeprefix('\ufeff'), newline=''), delimiter=delimiter, strict=True):
            rows.append(row)
            cells += len(row)
            if len(rows) > MAX_ROWS or cells > MAX_CELLS:
                raise ValueError('row_limit')
    except csv.Error as error:
        raise ValueError('malformed') from error
    return rows


def inspect_csv(payload):
    rows = read_source(payload)
    nonempty = [row for row in rows if any(value.strip() for value in row)]
    if not nonempty:
        raise ValueError('empty_input')
    if len(nonempty[0]) > 200:
        raise ValueError('columns_limit')
    return {'headers': nonempty[0], 'sample': nonempty[1:6], 'data_rows': len(nonempty) - 1}


def csv_text(rows, delimiter):
    stream = io.StringIO(newline='')
    csv.writer(stream, delimiter=delimiter, lineterminator='\r\n').writerows(rows)
    return stream.getvalue()


def protect(value):
    return "'" + value if (value.lstrip(' \t\r\n').startswith(('=', '+', '-', '@')) or value.startswith(('\t', '\r', '\n'))) else value


def prepare_import(payload):
    rows = read_source(payload)
    first = next((i for i, row in enumerate(rows) if any(value.strip() for value in row)), None)
    if first is None:
        raise ValueError('empty_input')
    width = len(rows[first])
    schema = payload.get('schema')
    if not isinstance(schema, list) or not 1 <= len(schema) <= 200:
        raise ValueError('schema')
    names = set()
    for field in schema:
        if not isinstance(field, dict):
            raise ValueError('schema')
        name, source = field.get('name'), field.get('source')
        if (not isinstance(name, str) or not name.strip() or name != name.strip() or len(name) > 100
                or any(ord(char) < 32 for char in name) or name.casefold() in names
                or type(source) is not int or not 0 <= source < width
                or field.get('type', 'text') not in ('text', 'integer', 'decimal', 'email')
                or any(type(field.get(key, False)) is not bool for key in ('required', 'unique'))):
            raise ValueError('schema')
        names.add(name.casefold())
    if len(schema) * sum(any(value.strip() for value in row) for row in rows[first + 1:]) > MAX_CELLS:
        raise ValueError('row_limit')
    trim, safe, dedup = payload.get('trim', True), payload.get('safe', True), payload.get('dedup', False)
    keys = [i for i, field in enumerate(schema) if field.get('unique')]
    accepted, rejected, seen_keys, seen_rows = [], [], set(), set()
    counts = dict(input_rows=len(rows), empty_removed=0, duplicates_removed=0, protected_cells=0, trimmed_cells=0)
    for index, original in enumerate(rows):
        if not any(value.strip() for value in original):
            counts['empty_removed'] += 1
            continue
        if index == first:
            continue
        issues = []
        if len(original) != width:
            issues.append({'code': 'column_count', 'column': ''})
        selected = []
        for field in schema:
            value = original[field['source']] if field['source'] < len(original) else ''
            if trim:
                counts['trimmed_cells'] += value != value.strip()
                value = value.strip()
            selected.append(value)
            if not value.strip():
                if field.get('required') or field.get('unique'):
                    issues.append({'code': 'required', 'column': field['name']})
                continue
            kind = field.get('type', 'text')
            valid = (kind == 'text'
                     or kind == 'integer' and re.fullmatch(r'[+-]?\d+', value, re.ASCII)
                     or kind == 'decimal' and re.fullmatch(r'[+-]?\d+(?:\.\d+)?', value, re.ASCII)
                     or kind == 'email' and re.fullmatch(r'[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+', value))
            if not valid:
                issues.append({'code': kind, 'column': field['name']})
        key, exact = tuple(selected[i] for i in keys), tuple(selected)
        if keys and key in seen_keys:
            issues.append({'code': 'duplicate_key', 'column': ', '.join(schema[i]['name'] for i in keys)})
        elif dedup and exact in seen_rows:
            issues.append({'code': 'duplicate_row', 'column': ''})
        if issues:
            rejected.append({'record': index + 1, 'issues': issues, 'row': original})
            counts['duplicates_removed'] += any(issue['code'].startswith('duplicate_') for issue in issues)
            continue
        seen_keys.add(key)
        seen_rows.add(exact)
        accepted.append(selected)
    output = [[field['name'] for field in schema], *accepted]
    if safe:
        for row in output:
            for i, value in enumerate(row):
                protected = protect(value)
                counts['protected_cells'] += protected != value
                row[i] = protected
    # Preserve original rejected cells as JSON in one quoted field, without ragged exports.
    import json
    rejects = [['record', 'issues', 'original_json'], *[
        [str(row['record']), '; '.join(issue['code'] + (':' + issue['column'] if issue['column'] else '') for issue in row['issues']), json.dumps(row['row'], ensure_ascii=False)]
        for row in rejected]]
    # Column names appear in issue descriptions too. Protect rejection exports independently.
    rejects = [[protect(value) for value in row] for row in rejects]
    return {'csv': csv_text(output, payload.get('delimiter', ',')), 'preview': output[:31],
            'rejected_csv': csv_text(rejects, payload.get('delimiter', ',')), 'rejected_preview': rejected[:30],
            'report': {**counts, 'output_rows': len(output), 'accepted_rows': len(accepted),
                       'rejected_rows': len(rejected), 'schema_enabled': True, 'schema': schema,
                       'column_counts': [len(schema)], 'ragged_rows': False, 'safe_export': safe,
                       'preview_rows': min(len(accepted), 30)}}
