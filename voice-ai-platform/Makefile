.PHONY: venv install demo-console demo-dev

venv:
	python3 -m venv .venv
	.venv/bin/pip install -U pip wheel
	.venv/bin/pip install -e .

install: venv

demo-console:
	.venv/bin/python examples/local_voice_demo.py console

demo-dev:
	.venv/bin/python examples/local_voice_demo.py dev
