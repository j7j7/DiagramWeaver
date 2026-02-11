#!/usr/bin/env python3
"""
Generate resource-azure.json from Azure_Public_Service_Icons folder structure.

This script processes all SVG files in public/resources/azure/Azure_Public_Service_Icons/Icons/
and generates a complete resource-azure.json file with proper category paths.
"""

import os
import json
import re
from collections import defaultdict

def process_azure_icons():
    """Process Azure Public Service Icons and generate resource JSON."""
    icons_path = 'public/resources/azure/Azure_Public_Service_Icons/Icons'
    categories_data = defaultdict(list)

    # Process each category folder
    for category_folder in sorted(os.listdir(icons_path)):
        category_path = os.path.join(icons_path, category_folder)
        if not os.path.isdir(category_path):
            continue
        
        # Get all SVG files in this category
        for filename in sorted(os.listdir(category_path)):
            if filename.endswith('.svg'):
                # Full path from resources/ for correct icon loading
                file_path = f"azure/Azure_Public_Service_Icons/Icons/{category_folder}/{filename}"
                # Extract name by removing the prefix pattern (digits-icon-service-)
                # Pattern: [digits]-icon-service-[name].svg
                match = re.match(r'^\d+-icon-service-(.+)\.svg$', filename)
                if match:
                    name_part = match.group(1)
                    # Convert hyphens to spaces and title case
                    name = name_part.replace('-', ' ')
                    # Capitalize first letter of each word
                    name = ' '.join(word.capitalize() for word in name.split())
                    
                    categories_data[category_folder].append({
                        'name': name,
                        'file': file_path,
                        'type': 'service'
                    })
                else:
                    # Fallback for files that don't match the pattern
                    name = filename.replace('.svg', '').replace('-', ' ')
                    name = ' '.join(word.capitalize() for word in name.split())
                    categories_data[category_folder].append({
                        'name': name,
                        'file': file_path,
                        'type': 'service'
                    })

    # Function to convert folder name to JSON key
    def folder_to_key(folder_name):
        # Convert to lowercase and remove special characters
        key = folder_name.lower()
        # Replace spaces and special chars with nothing
        key = re.sub(r'[^a-z0-9]', '', key)
        return key

    # Function to convert folder name to display name
    def folder_to_display_name(folder_name):
        # Capitalize each word
        words = folder_name.split()
        return ' '.join(word.capitalize() for word in words)

    # Build the JSON structure
    result = {
        "name": "Microsoft Azure",
        "icon": "azure.png",
        "totalResources": 0,
        "categories": {}
    }

    total_resources = 0

    for folder_name, resources in sorted(categories_data.items()):
        key = folder_to_key(folder_name)
        display_name = folder_to_display_name(folder_name)
        # Path should point to the actual location: Azure_Public_Service_Icons/Icons/<category>
        path = f"azure/Azure_Public_Service_Icons/Icons/{folder_name}"
        
        result["categories"][key] = {
            "name": display_name,
            "path": path,
            "resources": resources
        }
        
        total_resources += len(resources)

    result["totalResources"] = total_resources

    # Write to file
    output_file = 'public/resources/resource-azure.json'
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(result, f, indent=2, ensure_ascii=False)

    print(f"Generated JSON with {len(result['categories'])} categories and {total_resources} total resources")
    print(f"\nCategories:")
    for key in sorted(result['categories'].keys()):
        cat = result['categories'][key]
        print(f"  {key}: {cat['name']} ({len(cat['resources'])} items)")

if __name__ == '__main__':
    process_azure_icons()
