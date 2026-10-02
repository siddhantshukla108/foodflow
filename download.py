import urllib.request
import os

repos = [
    "kannanaikkal/Food-Demand-Forecasting",
    "sureshmecad/Food-Demand-Forecasting",
    "Shivansh-Commits/Food-Demand-Forecasting-DATA-SCIENCE-CHALLANGE"
]

files = [
    "train.csv",
    "meal_info.csv",
    "fulfilment_center_info.csv"
]

def download_dataset():
    os.makedirs("dataset", exist_ok=True)
    for repo in repos:
        success = True
        print(f"Trying repo: {repo}")
        for file in files:
            for branch in ["master", "main"]:
                url = f"https://raw.githubusercontent.com/{repo}/{branch}/{file}"
                try:
                    urllib.request.urlretrieve(url, f"dataset/{file}")
                    print(f"  Downloaded {file} from {branch}")
                    break
                except Exception as e:
                    if branch == "main":
                        print(f"  Failed to download {file} from {repo}")
                        success = False
            if not success:
                break
        if success:
            print("Successfully downloaded all files.")
            return

download_dataset()
