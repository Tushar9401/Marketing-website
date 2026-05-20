# Marketing Builder Backend

Local Django API for the React marketing playlist app.

## Setup

```bash
cd Backend
python3 -m pip install -r requirements.txt
python3 manage.py migrate
python3 manage.py runserver 127.0.0.1:8000
```

The React app expects the API at `http://127.0.0.1:8000/api`.
