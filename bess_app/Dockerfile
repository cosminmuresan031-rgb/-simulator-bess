FROM python:3.12-slim

WORKDIR /app
COPY requirements.txt /tmp/requirements.txt
RUN pip install --no-cache-dir -r /tmp/requirements.txt

COPY . /app

ENV HOST=0.0.0.0
ENV PORT=8765
EXPOSE 8765
CMD ["python", "server.py"]
