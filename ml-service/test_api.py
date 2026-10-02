import requests

print("Testing /check-freshness endpoint...")
url = "http://127.0.0.1:5000/check-freshness"
img_path = "../dataset/freshness/Fresh/Fresh_0.jpg"

try:
    with open(img_path, 'rb') as f:
        files = {'image': f}
        response = requests.post(url, files=files)
        
    print(f"Status Code: {response.status_code}")
    print("Raw Response:", response.json())
except Exception as e:
    print(f"Failed to call API: {e}")
