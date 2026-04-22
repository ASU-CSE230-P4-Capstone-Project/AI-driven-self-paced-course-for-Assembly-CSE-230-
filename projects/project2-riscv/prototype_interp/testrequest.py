import requests

url = "http://127.0.0.1:25565/data"
data = {
    "code": "ADDI x1, x0, 5\nADD x2, x1, x1"
}

response = requests.post(url, json=data)

print(response.json())