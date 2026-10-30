PYTHON ?= python3
.PHONY: start test
start:
	sh ./start.sh
test:
	$(PYTHON) -m unittest discover -s tests -v
