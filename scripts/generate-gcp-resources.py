#!/usr/bin/env python3
"""
Generate resource-gcp.json from GCP google-cloud-legacy-icons and Unique-Icons folder structure.

This script processes all SVG files in:
- public/resources/gcp/google-cloud-legacy-icons/
- public/resources/gcp/Unique-Icons/

and generates a complete resource-gcp.json file with proper category paths.
"""

import os
import json
import re
from collections import defaultdict

# Category mapping based on GCP service patterns
CATEGORY_MAPPING = {
    # Compute
    'compute': [
        'compute_engine', 'app_engine', 'cloud_functions', 'cloud_run', 'gke', 'kubernetes_engine',
        'gke_on_prem', 'cloud_gpu', 'container_optimized_os', 'bare_metal_solutions', 'batch',
        'cloud_scheduler', 'cloud_tasks', 'cloud_build', 'cloud_deployment_manager',
        'cloud_tpu', 'Compute Engine', 'Cloud Run', 'GKE'
    ],
    # Storage
    'storage': [
        'cloud_storage', 'filestore', 'persistent_disk', 'local_ssd', 'cloud_storage_bucket',
        'storage_transfer_service', 'transfer_appliance', 'Cloud Storage', 'Hyperdisk'
    ],
    # Database
    'database': [
        'cloud_sql', 'spanner', 'bigtable', 'firestore', 'bigquery', 'memorystore',
        'datastore', 'cloud_datastore', 'alloydb', 'Cloud SQL', 'Cloud Spanner', 'BigQuery', 'AlloyDB'
    ],
    # Networking
    'network': [
        'vpc_network', 'cloud_cdn', 'cloud_load_balancing', 'cloud_dns', 'cloud_interconnect',
        'cloud_armor', 'cloud_nat', 'network_tiers', 'cloud_vpn', 'cloud_router',
        'service_directory', 'private_service_connect', 'network_security', 'cloud_endpoints',
        'cloud_api_gateway', 'cloud_routes', 'cloud_external_ip_addresses', 'connectivity_test',
        'cloud_firewall_rules', 'cloud_domains'
    ],
    # Analytics
    'analytics': [
        'bigquery', 'dataflow', 'dataproc', 'pubsub', 'data_studio', 'data_catalog',
        'data_fusion', 'dataform', 'datastream', 'analytics_hub', 'cloud_data_fusion',
        'cloud_composer', 'BigQuery'
    ],
    # AI + Machine Learning
    'aimachinelearning': [
        'vertex_ai', 'automl', 'ai_platform', 'speech_to_text', 'text_to_speech',
        'natural_language', 'vision_ai', 'translation', 'automl_translation', 'automl_vision',
        'automl_natural_language', 'automl_tables', 'automl_video_intelligence',
        'ai_platform_unified', 'ai_hub', 'agent_assist', 'advanced_agent_modeling',
        'speech_to_text_api', 'text_to_speech_api', 'cloud_translation_api',
        'Vertex AI', 'AI Hypercomputer'
    ],
    # Security
    'security': [
        'identity_aware_proxy', 'access_context_manager', 'cloud_armor', 'security_command_center',
        'certificate_manager', 'key_management_service', 'secret_manager', 'beyondcorp',
        'assured_workloads', 'binary_authorization', 'cloud_ekm', 'cloud_hsm', 'cloud_ids',
        'Security Command Center', 'Security Operations', 'Threat Intelligence', 'Mandiant'
    ],
    # Management & Monitoring
    'management': [
        'cloud_monitoring', 'cloud_logging', 'error_reporting', 'cloud_trace', 'cloud_debugger',
        'cloud_profiler', 'stackdriver', 'cloud_console', 'cloud_shell', 'gce_systems_management',
        'os_inventory_management', 'cloud_asset_inventory', 'asset_inventory', 'cloud_audit_logs',
        'cloud_ops', 'configuration_management', 'billing', 'administration'
    ],
    # Developer Tools
    'developertools': [
        'cloud_build', 'cloud_source_repositories', 'artifact_registry', 'container_registry',
        'cloud_code', 'api', 'api_analytics', 'api_monetization', 'apigee_api_platform', 'apigee_sense',
        'cloud_apis', 'cloud_deploy', 'cloud_test_lab', 'Apigee'
    ],
    # Containers & Kubernetes
    'containers': [
        'anthos', 'anthos_config_management', 'anthos_service_mesh', 'gke', 'kubernetes_engine',
        'cloud_run', 'container_registry', 'artifact_registry', 'Anthos', 'GKE', 'Cloud Run'
    ],
    # Data & Analytics
    'data': [
        'bigquery', 'dataflow', 'dataproc', 'pubsub', 'datastream', 'data_fusion', 'dataform',
        'data_catalog', 'analytics_hub', 'BigQuery', 'Looker'
    ],
    # Migration & Modernization
    'migration': [
        'migrate_for_compute_engine', 'transfer_appliance', 'cloud_sql_migration', 'database_migration_service'
    ],
    # Hybrid & Multi-Cloud
    'hybrid': [
        'anthos', 'anthos_config_management', 'anthos_service_mesh', 'gke_on_prem',
        'distributed_cloud', 'Distributed Cloud', 'Anthos'
    ],
    # Other Services
    'other': [
        'home', 'launcher', 'partner_portal', 'cloud_for_marketing', 'release_notes',
        'administration', 'advanced_solutions_lab', 'connectors'
    ]
}

def normalize_folder_name(folder_name):
    """Normalize folder name for matching."""
    return folder_name.lower().replace(' ', '_').replace('-', '_')

def get_category_for_folder(folder_name):
    """Determine category for a folder name."""
    normalized = normalize_folder_name(folder_name)
    
    # Check each category's keywords
    for category, keywords in CATEGORY_MAPPING.items():
        for keyword in keywords:
            if normalized == normalize_folder_name(keyword) or normalized.startswith(normalize_folder_name(keyword) + '_'):
                return category
    
    # Default category based on common patterns
    if 'compute' in normalized or 'engine' in normalized or 'function' in normalized or 'run' in normalized or 'tpu' in normalized:
        return 'compute'
    elif 'storage' in normalized or 'disk' in normalized or 'filestore' in normalized:
        return 'storage'
    elif 'sql' in normalized or 'database' in normalized or 'spanner' in normalized or 'bigtable' in normalized or 'firestore' in normalized:
        return 'database'
    elif 'network' in normalized or 'vpc' in normalized or 'cdn' in normalized or 'dns' in normalized or 'load' in normalized or 'route' in normalized or 'firewall' in normalized or 'gateway' in normalized or 'ip' in normalized:
        return 'network'
    elif 'ai' in normalized or 'ml' in normalized or 'automl' in normalized or 'speech' in normalized or 'vision' in normalized or 'language' in normalized or 'translation' in normalized or 'document' in normalized or 'inference' in normalized:
        return 'aimachinelearning'
    elif 'security' in normalized or 'iam' in normalized or 'armor' in normalized or 'certificate' in normalized or 'authorization' in normalized or 'ekm' in normalized or 'hsm' in normalized or 'ids' in normalized:
        return 'security'
    elif 'monitoring' in normalized or 'logging' in normalized or 'stackdriver' in normalized or 'audit' in normalized or 'ops' in normalized or 'billing' in normalized or 'administration' in normalized:
        return 'management'
    elif 'anthos' in normalized or 'gke' in normalized or 'kubernetes' in normalized:
        return 'containers'
    elif 'bigquery' in normalized or 'dataflow' in normalized or 'dataproc' in normalized or 'composer' in normalized or 'data_fusion' in normalized or 'fusion' in normalized:
        return 'analytics'
    elif 'deploy' in normalized or 'build' in normalized or 'test' in normalized or 'api' in normalized:
        return 'developertools'
    
    return 'other'

def extract_name_from_filename(filename, folder_name=None):
    """
    Extract resource name from GCP icon filename.
    
    Examples:
    - stackdriver.svg -> Stackdriver
    - key_management_service.svg -> Key Management Service
    - AIHypercomputer-512-color.svg -> AI Hypercomputer
    - CloudRun-512-color-rgb.svg -> Cloud Run
    """
    # Remove .svg extension
    name = filename.replace('.svg', '')
    
    # Remove common suffixes
    name = re.sub(r'[-_]512[-_]color.*$', '', name, flags=re.IGNORECASE)
    name = re.sub(r'[-_]rgb$', '', name, flags=re.IGNORECASE)
    name = re.sub(r'[-_]512$', '', name)
    
    # Convert underscores and hyphens to spaces
    name = name.replace('_', ' ').replace('-', ' ')
    
    # Title case each word
    name = ' '.join(word.capitalize() for word in name.split())
    
    # Fix common acronyms
    acronyms_map = {
        'Api': 'API',
        'Sql': 'SQL',
        'Gpu': 'GPU',
        'Ssd': 'SSD',
        'Cdn': 'CDN',
        'Dns': 'DNS',
        'Vpc': 'VPC',
        'Vpn': 'VPN',
        'Nat': 'NAT',
        'Iam': 'IAM',
        'Gke': 'GKE',
        'Ai': 'AI',
        'Ml': 'ML',
        'Os': 'OS',
        'Gce': 'GCE',
    }
    
    # Replace acronyms
    words = name.split()
    result_words = []
    for word in words:
        if word in acronyms_map:
            result_words.append(acronyms_map[word])
        else:
            result_words.append(word)
    
    name = ' '.join(result_words)
    
    # Special handling for common patterns
    name = re.sub(r'\bGcp\b', 'GCP', name, flags=re.IGNORECASE)
    name = re.sub(r'\bVm\b', 'VM', name, flags=re.IGNORECASE)
    
    return name

def folder_to_key(folder_name):
    """Convert folder name to JSON key (normalized, lowercase)."""
    key = folder_name.lower()
    key = re.sub(r'[^a-z0-9]', '', key)
    return key

def process_gcp_icons():
    """Process GCP Legacy and Unique Icons and generate resource JSON."""
    gcp_base_path = 'public/resources/gcp'
    legacy_path = os.path.join(gcp_base_path, 'google-cloud-legacy-icons')
    unique_path = os.path.join(gcp_base_path, 'Unique-Icons')
    
    categories_data = defaultdict(list)
    
    # Process Legacy Icons
    if os.path.exists(legacy_path):
        for folder_name in sorted(os.listdir(legacy_path)):
            folder_path = os.path.join(legacy_path, folder_name)
            if not os.path.isdir(folder_path):
                continue
            
            # Look for SVG files in the folder
            for filename in sorted(os.listdir(folder_path)):
                if filename.endswith('.svg'):
                    name = extract_name_from_filename(filename, folder_name)
                    category_key = get_category_for_folder(folder_name)
                    
                    # File path relative to resources/ folder (absolute from gcp/)
                    file_path = f"gcp/google-cloud-legacy-icons/{folder_name}/{filename}"
                    
                    categories_data[category_key].append({
                        'name': name,
                        'file': file_path,
                        'type': 'service'
                    })
                    break  # Only one file per folder
    
    # Process Unique Icons
    if os.path.exists(unique_path):
        for service_folder in sorted(os.listdir(unique_path)):
            service_path = os.path.join(unique_path, service_folder)
            if not os.path.isdir(service_path):
                continue
            
            # Look for SVG subfolder
            svg_folder = os.path.join(service_path, 'SVG')
            if os.path.exists(svg_folder) and os.path.isdir(svg_folder):
                for filename in sorted(os.listdir(svg_folder)):
                    if filename.endswith('.svg'):
                        name = extract_name_from_filename(filename, service_folder)
                        category_key = get_category_for_folder(service_folder)
                        
                        # File path relative to resources/ folder (absolute from gcp/)
                        file_path = f"gcp/Unique-Icons/{service_folder}/SVG/{filename}"
                        
                        categories_data[category_key].append({
                            'name': name,
                            'file': file_path,
                            'type': 'service'
                        })
                        break  # Only one file per service
    
    # Category display names
    category_display_names = {
        'compute': 'Compute',
        'storage': 'Storage',
        'database': 'Database',
        'network': 'Networking',
        'analytics': 'Analytics',
        'aimachinelearning': 'AI + Machine Learning',
        'security': 'Security',
        'management': 'Management',
        'developertools': 'Developer Tools',
        'containers': 'Containers',
        'data': 'Data',
        'migration': 'Migration',
        'hybrid': 'Hybrid & Multi-Cloud',
        'other': 'Other'
    }
    
    # Build the JSON structure
    result = {
        "name": "Google Cloud Platform",
        "icon": "gcp.png",
        "totalResources": 0,
        "categories": {}
    }
    
    total_resources = 0
    
    for category_key, resources in sorted(categories_data.items()):
        # Remove duplicates based on name (keep first occurrence)
        seen_names = set()
        unique_resources = []
        for resource in resources:
            if resource['name'] not in seen_names:
                seen_names.add(resource['name'])
                unique_resources.append(resource)
        
        display_name = category_display_names.get(category_key, category_key.replace('_', ' ').title())
        path = f"gcp/{category_key}"
        
        result["categories"][category_key] = {
            "name": display_name,
            "path": path,
            "resources": unique_resources
        }
        
        total_resources += len(unique_resources)
    
    result["totalResources"] = total_resources
    
    # Write to file
    output_file = 'public/resources/resource-gcp.json'
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(result, f, indent=2, ensure_ascii=False)
    
    print(f"Generated JSON with {len(result['categories'])} categories and {total_resources} total resources")
    print(f"\nCategories:")
    for key in sorted(result['categories'].keys()):
        cat = result['categories'][key]
        print(f"  {key}: {cat['name']} ({len(cat['resources'])} items)")

if __name__ == '__main__':
    process_gcp_icons()
