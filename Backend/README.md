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

## Large uploads

The Django API accepts image/video uploads up to 500 MB. If the deployed site
is behind Nginx, set the same or a larger proxy limit, then reload Nginx:

```nginx
client_max_body_size 500M;
```
