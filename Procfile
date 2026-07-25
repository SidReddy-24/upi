web: PYTHONPATH=backend gunicorn -w 1 -k uvicorn.workers.UvicornWorker app.main:app --bind 0.0.0.0:$PORT --timeout 120 --keep-alive 5

