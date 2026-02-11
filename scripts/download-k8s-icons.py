#!/usr/bin/env python3
"""
Download Kubernetes icons from GitHub repository.

Downloads all SVG files from:
https://github.com/kubernetes/community/tree/master/icons/svg
"""

import os
import urllib.request
import urllib.parse
import json
import sys

BASE_URL = "https://raw.githubusercontent.com/kubernetes/community/master/icons/svg"
API_BASE = "https://api.github.com/repos/kubernetes/community/contents/icons/svg"
OUTPUT_DIR = "public/resources/k8s"

def get_directory_contents(path):
    """Get contents of a directory from GitHub API."""
    url = f"{API_BASE}/{path}?ref=master"
    try:
        with urllib.request.urlopen(url) as response:
            return json.loads(response.read())
    except Exception as e:
        print(f"Error fetching {url}: {e}")
        return []

def download_file(download_url, filepath):
    """Download a file from URL to filepath."""
    try:
        os.makedirs(os.path.dirname(filepath), exist_ok=True)
        urllib.request.urlretrieve(download_url, filepath)
        print(f"Downloaded: {filepath}")
        return True
    except Exception as e:
        print(f"Error downloading {download_url}: {e}")
        return False

def download_recursive(path="", output_path=""):
    """Recursively download all SVG files from the repository."""
    contents = get_directory_contents(path)
    downloaded = 0
    
    for item in contents:
        if item['type'] == 'file' and item['name'].endswith('.svg'):
            # Download the file
            filepath = os.path.join(OUTPUT_DIR, output_path, item['name'])
            if download_file(item['download_url'], filepath):
                downloaded += 1
        elif item['type'] == 'dir':
            # Recursively process subdirectories
            new_path = f"{path}/{item['name']}" if path else item['name']
            new_output = os.path.join(output_path, item['name']) if output_path else item['name']
            downloaded += download_recursive(new_path, new_output)
    
    return downloaded

def main():
    """Download all Kubernetes icons."""
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    
    print("Downloading Kubernetes icons...")
    downloaded = download_recursive()
    
    print(f"\nDownload complete: {downloaded} SVG files downloaded")

if __name__ == '__main__':
    main()
