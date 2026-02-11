#!/usr/bin/env python3
"""
Generate resource-aws.json from AWS Architecture-Service-Icons and Resource-Icons folder structure.

This script processes all SVG files in:
- public/resources/aws/Architecture-Service-Icons_01302026/
- public/resources/aws/Resource-Icons_01302026/

and generates a complete resource-aws.json file with proper category paths.
"""

import os
import json
import re
from collections import defaultdict

def extract_name_from_filename(filename):
    """
    Extract resource name from AWS icon filename.
    
    Examples:
    - Arch_Amazon-Athena_64.svg -> Athena
    - Arch_AWS-Clean-Rooms_64.svg -> Clean Rooms
    - Res_Amazon-OpenSearch-Service_48.svg -> OpenSearch Service
    - Arch_Amazon-EMR_64.svg -> EMR
    """
    # Remove .svg extension
    name = filename.replace('.svg', '')
    
    # Remove prefix (Arch_ or Res_)
    name = re.sub(r'^(Arch_|Res_)', '', name)
    
    # Remove size suffix (_64, _48, _32, _16)
    name = re.sub(r'_\d+$', '', name)
    
    # Remove Amazon- or AWS- prefix
    name = re.sub(r'^(Amazon-|AWS-)', '', name)
    
    # Convert hyphens to spaces
    name = name.replace('-', ' ')
    
    # Title case each word
    name = ' '.join(word.capitalize() for word in name.split())
    
    # Fix common acronyms that should be uppercase
    acronyms_map = {
        'Emr': 'EMR',
        'Ec2': 'EC2',
        'S3': 'S3',
        'Efs': 'EFS',
        'Ebs': 'EBS',
        'Rds': 'RDS',
        'Vpc': 'VPC',
        'Api': 'API',
        'Sdk': 'SDK',
        'Iam': 'IAM',
        'Kms': 'KMS',
        'Waf': 'WAF',
        'Iot': 'IoT',
        'Dns': 'DNS',
        'Vpn': 'VPN',
        'Cdn': 'CDN',
        'Elb': 'ELB',
        'Alb': 'ALB',
        'Nlb': 'NLB',
        'Sqs': 'SQS',
        'Sns': 'SNS',
        'Ses': 'SES',
        'Sms': 'SMS',
        'Acm': 'ACM',
        'Arn': 'ARN',
        'Aws': 'AWS',
        'Ecr': 'ECR',
        'Ecs': 'ECS',
        'Eks': 'EKS',
        'Qldb': 'QLDB',
        'Fsx': 'FSx',
        'Mq': 'MQ',
        'Ca': 'CA',
    }
    
    # Replace acronyms in the name
    words = name.split()
    result_words = []
    for word in words:
        if word in acronyms_map:
            result_words.append(acronyms_map[word])
        else:
            result_words.append(word)
    
    name = ' '.join(result_words)
    
    return name

def extract_category_from_folder(folder_name):
    """
    Extract category name from folder name.
    
    Examples:
    - Arch_Analytics -> Analytics
    - Res_Analytics -> Analytics
    - Arch_Application-Integration -> Application Integration
    """
    # Remove prefix (Arch_ or Res_)
    category = re.sub(r'^(Arch_|Res_)', '', folder_name)
    
    # Convert hyphens to spaces
    category = category.replace('-', ' ')
    
    # Title case each word
    category = ' '.join(word.capitalize() for word in category.split())
    
    return category

def normalize_category_key(category_name):
    """
    Normalize category name to a consistent key.
    Handles variations like IoT vs Internet of Things.
    """
    # Normalize common variations
    category_lower = category_name.lower()
    
    # Map variations to canonical form
    if 'iot' in category_lower or 'internet of things' in category_lower:
        return 'internetofthings'
    
    # Convert to lowercase and remove special characters
    key = category_lower
    key = re.sub(r'[^a-z0-9]', '', key)
    return key

def folder_to_key(folder_name):
    """Convert folder name to JSON key (normalized, lowercase)."""
    # Extract category name first
    category = extract_category_from_folder(folder_name)
    # Normalize to handle variations
    return normalize_category_key(category)

def process_aws_icons():
    """Process AWS Architecture and Resource Icons and generate resource JSON."""
    aws_base_path = 'public/resources/aws'
    arch_path = os.path.join(aws_base_path, 'Architecture-Service-Icons_01302026')
    res_path = os.path.join(aws_base_path, 'Resource-Icons_01302026')
    
    categories_data = defaultdict(list)
    
    # Process Architecture-Service-Icons
    if os.path.exists(arch_path):
        for category_folder in sorted(os.listdir(arch_path)):
            category_path = os.path.join(arch_path, category_folder)
            if not os.path.isdir(category_path):
                continue
            
            # Check for 64 subfolder
            size_folder = os.path.join(category_path, '64')
            if os.path.exists(size_folder) and os.path.isdir(size_folder):
                # Process files in 64 subfolder
                for filename in sorted(os.listdir(size_folder)):
                    if filename.endswith('.svg'):
                        name = extract_name_from_filename(filename)
                        category_key = folder_to_key(category_folder)
                        
                        # Full path from resources/ for correct icon loading
                        file_path = f"aws/Architecture-Service-Icons_01302026/{category_folder}/64/{filename}"
                        
                        categories_data[category_key].append({
                            'name': name,
                            'file': file_path,
                            'type': 'architecture',
                            'folder_name': category_folder
                        })
            else:
                # Fallback: check if files are directly in category folder
                for filename in sorted(os.listdir(category_path)):
                    if filename.endswith('.svg'):
                        name = extract_name_from_filename(filename)
                        category_key = folder_to_key(category_folder)
                        
                        # Full path from resources/
                        file_path = f"aws/Architecture-Service-Icons_01302026/{category_folder}/{filename}"
                        
                        categories_data[category_key].append({
                            'name': name,
                            'file': file_path,
                            'type': 'architecture',
                            'folder_name': category_folder
                        })
    
    # Process Resource-Icons
    if os.path.exists(res_path):
        for category_folder in sorted(os.listdir(res_path)):
            category_path = os.path.join(res_path, category_folder)
            if not os.path.isdir(category_path):
                continue
            
            # Resource-Icons files are directly in category folders (not in size subfolders)
            for filename in sorted(os.listdir(category_path)):
                if filename.endswith('.svg'):
                    name = extract_name_from_filename(filename)
                    category_key = folder_to_key(category_folder)
                    
                    # Full path from resources/ for correct icon loading
                    file_path = f"aws/Resource-Icons_01302026/{category_folder}/{filename}"
                    
                    categories_data[category_key].append({
                        'name': name,
                        'file': file_path,
                        'type': 'resource',
                        'folder_name': category_folder
                    })
    
    # Build the JSON structure
    result = {
        "name": "Amazon Web Services",
        "icon": "aws.png",
        "totalResources": 0,
        "categories": {}
    }
    
    total_resources = 0
    
    for category_key, resources in sorted(categories_data.items()):
        # Get display name and path from the resources
        # Prefer Architecture icons over Resource icons for display name
        display_name = None
        path = None
        arch_folder = None
        res_folder = None
        
        # Collect folder names from resources
        for resource in resources:
            folder_name = resource.get('folder_name')
            if not folder_name:
                continue
            
            if resource['type'] == 'architecture':
                arch_folder = folder_name
            elif resource['type'] == 'resource':
                res_folder = folder_name
        
        # Prefer Architecture folder for display name and path
        if arch_folder:
            display_name = extract_category_from_folder(arch_folder)
            path = f"aws/Architecture-Service-Icons_01302026/{arch_folder}"
        elif res_folder:
            display_name = extract_category_from_folder(res_folder)
            path = f"aws/Resource-Icons_01302026/{res_folder}"
        else:
            # Fallback: try to reconstruct from key (for merged categories like IoT)
            if category_key == 'internetofthings':
                display_name = 'Internet of Things'
                # Prefer Architecture path if it exists, otherwise Resource
                arch_path_test = 'aws/Architecture-Service-Icons_01302026/Arch_Internet-of-Things'
                res_path_test = 'aws/Resource-Icons_01302026/Res_IoT'
                if os.path.exists(arch_path_test.replace('aws/', 'public/resources/aws/')):
                    path = arch_path_test
                else:
                    path = res_path_test
            else:
                display_name = category_key.replace('_', ' ').title()
                path = f"aws/{category_key}"
        
        # Remove duplicates based on name (keep first occurrence)
        # All resources now have full path from resources/ in file field
        seen_names = set()
        unique_resources = []
        for resource in resources:
            if resource['name'] not in seen_names:
                seen_names.add(resource['name'])
                clean_resource = {
                    'name': resource['name'],
                    'file': resource['file'],
                    'type': resource['type']
                }
                unique_resources.append(clean_resource)
        
        result["categories"][category_key] = {
            "name": display_name,
            "path": path,
            "resources": unique_resources
        }
        
        total_resources += len(unique_resources)
    
    result["totalResources"] = total_resources
    
    # Write to file
    output_file = 'public/resources/resource-aws.json'
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(result, f, indent=2, ensure_ascii=False)
    
    print(f"Generated JSON with {len(result['categories'])} categories and {total_resources} total resources")
    print(f"\nCategories:")
    for key in sorted(result['categories'].keys()):
        cat = result['categories'][key]
        print(f"  {key}: {cat['name']} ({len(cat['resources'])} items)")

if __name__ == '__main__':
    process_aws_icons()
