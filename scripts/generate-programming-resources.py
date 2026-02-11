#!/usr/bin/env python3
"""
Generate resource-programming.json from programming folder structure.

This script processes all PNG/SVG files in public/resources/programming/
and generates a complete resource-programming.json file with proper category paths.
"""

import os
import json
from collections import defaultdict

def format_name(filename):
    """Format filename to proper display name."""
    # Remove extension
    name = filename.replace('.png', '').replace('.svg', '')
    
    # Handle special cases for programming resources
    special_cases = {
        # Languages
        'cpp': 'C++',
        'csharp': 'C#',
        'nodejs': 'Node.js',
        'javascript': 'JavaScript',
        'typescript': 'TypeScript',
        'sql': 'SQL',
        'latex': 'LaTeX',
        'matlab': 'MATLAB',
        'r': 'R',
        'go': 'Go',
        'php': 'PHP',
        'java': 'Java',
        'python': 'Python',
        'ruby': 'Ruby',
        'rust': 'Rust',
        'swift': 'Swift',
        'kotlin': 'Kotlin',
        'scala': 'Scala',
        'dart': 'Dart',
        'elixir': 'Elixir',
        'erlang': 'Erlang',
        'bash': 'Bash',
        'c': 'C',
        
        # Frameworks
        'nextjs': 'Next.js',
        'dotnet': '.NET',
        'graphql': 'GraphQL',
        'sqlpage': 'SQLPage',
        
        # Flowchart symbols
        'start-end': 'Start/End',
        'input-output': 'Input/Output',
        'internal-storage': 'Internal Storage',
        'loop-limit': 'Loop Limit',
        'manual-input': 'Manual Input',
        'manual-loop': 'Manual Loop',
        'multiple-documents': 'Multiple Documents',
        'off-page-connector-left': 'Off-Page Connector (Left)',
        'off-page-connector-right': 'Off-Page Connector (Right)',
        'predefined-process': 'Predefined Process',
        'stored-data': 'Stored Data',
        'summing-junction': 'Summing Junction',
        
        # Runtime
        'dapr': 'DAPR',
    }
    
    # Check if exact match exists
    if name.lower() in {k.lower(): v for k, v in special_cases.items()}:
        for key, value in special_cases.items():
            if name.lower() == key.lower():
                return value
    
    # Handle hyphenated names
    if '-' in name:
        parts = name.split('-')
        formatted_parts = []
        for part in parts:
            found = False
            for key, value in special_cases.items():
                if part.lower() == key.lower():
                    formatted_parts.append(value)
                    found = True
                    break
            if not found:
                formatted_parts.append(part.capitalize())
        return ' '.join(formatted_parts)
    
    # Default: capitalize each word
    words = name.replace('_', ' ').split()
    formatted_words = []
    for word in words:
        found = False
        for key, value in special_cases.items():
            if word.lower() == key.lower():
                formatted_words.append(value)
                found = True
                break
        if not found:
            formatted_words.append(word.capitalize())
    return ' '.join(formatted_words)

def folder_to_display_name(folder_name):
    """Convert folder name to display name."""
    display_names = {
        'language': 'Programming Languages',
        'framework': 'Frameworks',
        'flowchart': 'Flowchart',
        'runtime': 'Runtime',
    }
    return display_names.get(folder_name.lower(), ' '.join(word.capitalize() for word in folder_name.split()))

def process_programming_resources():
    """Process programming folder and generate resource JSON."""
    programming_path = 'public/resources/programming'
    categories_data = defaultdict(list)

    # Process each category folder
    for category_folder in sorted(os.listdir(programming_path)):
        category_path = os.path.join(programming_path, category_folder)
        if not os.path.isdir(category_path) or category_folder.endswith('.png'):
            continue
        
        # Get all PNG/SVG files in this category
        for filename in sorted(os.listdir(category_path)):
            if filename.endswith(('.png', '.svg')):
                name = format_name(filename)
                
                # Determine type based on category
                file_type = category_folder  # Use folder name as type (language, framework, flowchart, runtime)
                
                categories_data[category_folder].append({
                    'name': name,
                    'file': filename,
                    'type': file_type
                })

    # Build the JSON structure
    result = {
        "name": "Programming",
        "icon": "programming.png",
        "totalResources": 0,
        "categories": {}
    }

    total_resources = 0

    for folder_name, resources in sorted(categories_data.items()):
        key = folder_name.lower()
        display_name = folder_to_display_name(folder_name)
        path = f"programming/{folder_name}"
        
        result["categories"][key] = {
            "name": display_name,
            "path": path,
            "resources": resources
        }
        
        total_resources += len(resources)

    result["totalResources"] = total_resources

    # Write to file
    output_file = 'public/resources/resource-programming.json'
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(result, f, indent=2, ensure_ascii=False)

    print(f"Generated JSON with {len(result['categories'])} categories and {total_resources} total resources")
    print(f"\nCategories:")
    for key in sorted(result['categories'].keys()):
        cat = result['categories'][key]
        print(f"  {key}: {cat['name']} ({len(cat['resources'])} items)")

if __name__ == '__main__':
    process_programming_resources()
