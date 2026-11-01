import csv
import io
import unittest

from app import clean_csv
from import_pipeline import inspect_csv


class ImportTests(unittest.TestCase):
    def test_reorder_rename_validate_and_reject_without_losing_original(self):
        text = 'name,email,sku,price\n Alice ,alice@example.test,001,12.50\nBad,wrong,002,abc\nCopy,copy@example.test,001,2\nMissing,,003,3\nRagged,a@example.test,004\n'
        schema = [{'source': 2, 'name': 'id', 'unique': True},
                  {'source': 1, 'name': 'contact', 'type': 'email', 'required': True},
                  {'source': 3, 'name': 'amount', 'type': 'decimal'}]
        result = clean_csv({'text': text, 'schema': schema})
        self.assertEqual(result['csv'], 'id,contact,amount\r\n001,alice@example.test,12.50\r\n')
        self.assertEqual(result['report']['accepted_rows'], 1)
        self.assertEqual(result['report']['rejected_rows'], 4)
        self.assertEqual([row['record'] for row in result['rejected_preview']], [3, 4, 5, 6])
        self.assertEqual(result['rejected_preview'][0]['row'], ['Bad', 'wrong', '002', 'abc'])
        self.assertEqual({i['code'] for i in result['rejected_preview'][0]['issues']}, {'email', 'decimal'})
        self.assertEqual(len(list(csv.reader(io.StringIO(result['rejected_csv'])))), 5)

    def test_composite_key_only_accepted_rows_reserve_it(self):
        schema = [{'source': 0, 'name': 'id', 'unique': True}, {'source': 1, 'name': 'branch', 'unique': True}, {'source': 2, 'name': 'qty', 'type': 'integer'}]
        result = clean_csv({'text': 'id,branch,qty\n001,A,bad\n001,A,2\n001,B,3\n001,A,4', 'schema': schema})
        self.assertEqual(result['report']['accepted_rows'], 2)
        self.assertEqual(result['report']['rejected_rows'], 2)
        self.assertIn('001,B,3', result['csv'])

    def test_schema_and_types_are_explicit(self):
        for schema in [[], [{'source': True, 'name': 'x'}], [{'source': 4, 'name': 'x'}],
                       [{'source': 0, 'name': ''}], [{'source': 0, 'name': 'x', 'required': 'yes'}],
                       [{'source': 0, 'name': 'x', 'type': 'guess'}],
                       [{'source': 0, 'name': 'X'}, {'source': 1, 'name': 'x'}]]:
            with self.subTest(schema=schema), self.assertRaisesRegex(ValueError, 'schema'):
                clean_csv({'text': 'a,b\n1,2', 'schema': schema})

    def test_inspection_bom_multiline_and_blank_records(self):
        result = inspect_csv({'text': '\ufeff\nname;note\nAlice;"a;b\nnext"', 'delimiter': ';'})
        self.assertEqual(result['headers'], ['name', 'note'])
        self.assertEqual(result['sample'], [['Alice', 'a;b\nnext']])
        self.assertEqual(result['data_rows'], 1)

    def test_mapping_expansion_is_bounded(self):
        schema = [{'source': 0, 'name': 'value_' + str(i)} for i in range(200)]
        with self.assertRaisesRegex(ValueError, 'row_limit'):
            clean_csv({'text': 'value\n' + 'x\n' * 1001, 'schema': schema})
        with self.assertRaisesRegex(ValueError, 'columns_limit'):
            inspect_csv({'text': ','.join('x' for _ in range(201))})

    def test_optional_empty_values_and_required_key_and_ragged_rows(self):
        schema = [{'source': 0, 'name': 'id', 'unique': True}, {'source': 1, 'name': 'amount', 'type': 'decimal'}]
        result = clean_csv({'text': 'id,amount\n001,\n,2\n002,3,extra\n003,1e5', 'schema': schema})
        self.assertEqual(result['report']['accepted_rows'], 1)
        self.assertEqual([row['issues'][0]['code'] for row in result['rejected_preview']], ['required','column_count','decimal'])

    def test_original_rejection_is_not_trimmed(self):
        result = clean_csv({'text': 'id,email\n 001 , invalid ', 'schema': [{'source': 1, 'name': 'email', 'type': 'email'}]})
        self.assertEqual(result['rejected_preview'][0]['row'], [' 001 ', ' invalid '])

    def test_protection_and_full_reject_export_beyond_preview(self):
        result = clean_csv({'text': 'id,value\n001,=2+2\n' + '002,invalid\n' * 40,
                            'schema': [{'source': 0, 'name': 'id', 'unique': True}, {'source': 1, 'name': 'value'}]})
        self.assertIn("'=2+2", result['csv'])
        self.assertEqual(result['report']['rejected_rows'], 39)
        self.assertEqual(len(result['rejected_preview']), 30)
        self.assertEqual(len(list(csv.reader(io.StringIO(result['rejected_csv'])))), 40)


if __name__ == '__main__':
    unittest.main()
