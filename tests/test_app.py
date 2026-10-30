import http.client
import json
import threading
import unittest

from app import Handler, Server, clean_csv


class CleaningTests(unittest.TestCase):
    def test_quoted_multiline_and_delimiter(self):
        result = clean_csv({"text": 'name;note\r\nAda;"a; b\nnext"\r\n', "delimiter": ";"})
        self.assertEqual(result["preview"], [["name", "note"], ["Ada", "a; b\nnext"]])
        self.assertEqual(result["report"]["input_rows"], 2)

    def test_trim_blank_dedup_without_assuming_header(self):
        result = clean_csv({"text": " Ada , 1\nAda,1\n,\n\nBob,2\n", "dedup": True})
        self.assertEqual(result["csv"], "Ada,1\r\nBob,2\r\n")
        self.assertEqual(result["report"]["duplicates_removed"], 1)
        self.assertEqual(result["report"]["empty_removed"], 2)

    def test_safe_export_default_and_disable(self):
        text = '=1+1,+2,-3,@SUM(A1),\t=7\n'
        self.assertEqual(clean_csv({"text": text})["report"]["protected_cells"], 5)
        self.assertEqual(clean_csv({"text": text, "safe": False})["preview"][0][0], '=1+1')

    def test_dedup_before_protection_keeps_distinct_values(self):
        result = clean_csv({"text": "=2\n'=2\n", "dedup": True})
        self.assertEqual(result["report"]["output_rows"], 2)

    def test_malformed_is_rejected(self):
        for text in ['a,"never closed\n', 'a,"quoted"bad\n']:
            with self.subTest(text=text), self.assertRaisesRegex(ValueError, "malformed"):
                clean_csv({"text": text})

    def test_ragged_rows_preserved(self):
        result = clean_csv({"text": "a,b\nc\n"})
        self.assertTrue(result["report"]["ragged_rows"])
        self.assertEqual(result["report"]["output_rows"], 2)

    def test_bom_unicode_tab(self):
        self.assertEqual(clean_csv({"text": '\ufeffимя\tзначение\n', "delimiter": "\t"})["preview"], [["имя", "значение"]])

    def test_limits_and_types(self):
        for payload, error in [({"text":"x"*1_000_001}, "text_limit"), ({"text":"x\n"*10_001}, "row_limit"), ({"text":"a", "delimiter":"|"}, "delimiter"), ({"text":"a", "safe":"false"}, "options"), ({"text":"\x00"}, "nul")]:
            with self.subTest(error=error), self.assertRaisesRegex(ValueError,error):
                clean_csv(payload)


class HTTPTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server=Server(("127.0.0.1",0),Handler)
        cls.thread=threading.Thread(target=cls.server.serve_forever,daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join()

    def request(self, method, path, body=None, headers=None):
        connection=http.client.HTTPConnection("127.0.0.1",self.server.server_address[1],timeout=5)
        connection.request(method,path,body,headers or {})
        response=connection.getresponse()
        data=response.read()
        connection.close()
        return response.status,data

    def test_api(self):
        status,data=self.request("POST","/api/clean",json.dumps({"text":"a,b\n"}),{"Content-Type":"application/json"})
        self.assertEqual(status,200)
        self.assertEqual(json.loads(data)["csv"],"a,b\r\n")

    def test_external_origin_and_rebinding_host_blocked(self):
        self.assertEqual(self.request("GET","/",headers={"Host":"attacker.test"})[0],403)
        self.assertEqual(self.request("POST","/api/clean","{}",{"Content-Type":"application/json","Origin":"https://attacker.test"})[0],403)

    def test_static_allowlist_and_request_limits(self):
        self.assertEqual(self.request("GET","/app.py")[0],404)
        self.assertEqual(self.request("GET","/")[0],200)
        self.assertEqual(self.request("POST","/api/clean","{}",{"Content-Type":"text/plain"})[0],415)
        self.assertEqual(self.request("POST","/api/clean","",{"Content-Type":"application/json","Content-Length":"2200001"})[0],413)


if __name__ == "__main__":
    unittest.main()
