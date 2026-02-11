#!/usr/bin/env python3
"""
Generate resource-k8s.json from Kubernetes community icons folder structure.

This script processes all SVG files in:
- public/resources/k8s/

and generates a complete resource-k8s.json file with proper category paths.
"""

import os
import json
import re
from collections import defaultdict

# Resource name mapping (short names to full names)
RESOURCE_NAMES = {
    'pod': 'Pod',
    'deploy': 'Deployment',
    'sts': 'StatefulSet',
    'ds': 'DaemonSet',
    'job': 'Job',
    'cronjob': 'CronJob',
    'rs': 'ReplicaSet',
    'svc': 'Service',
    'ing': 'Ingress',
    'netpol': 'NetworkPolicy',
    'ep': 'Endpoint',
    'pv': 'PersistentVolume',
    'pvc': 'PersistentVolumeClaim',
    'sc': 'StorageClass',
    'vol': 'Volume',
    'cm': 'ConfigMap',
    'secret': 'Secret',
    'ns': 'Namespace',
    'sa': 'ServiceAccount',
    'role': 'Role',
    'c-role': 'ClusterRole',
    'rb': 'RoleBinding',
    'crb': 'ClusterRoleBinding',
    'crd': 'CustomResourceDefinition',
    'hpa': 'HorizontalPodAutoscaler',
    'psp': 'PodSecurityPolicy',
    'quota': 'ResourceQuota',
    'limits': 'LimitRange',
    'group': 'Group',
    'user': 'User',
    # Control plane components
    'api': 'API Server',
    'sched': 'Scheduler',
    'c-m': 'Controller Manager',
    'c-c-m': 'Cloud Controller Manager',
    'k-proxy': 'kube-proxy',
    'kubelet': 'kubelet',
    # Infrastructure components
    'node': 'Node',
    'control-plane': 'Control Plane',
    'etcd': 'etcd',
}

# Category mapping
CATEGORY_MAPPING = {
    'compute': ['pod', 'deploy', 'sts', 'ds', 'job', 'cronjob', 'rs'],
    'network': ['svc', 'ing', 'netpol', 'ep'],
    'storage': ['pv', 'pvc', 'sc', 'vol'],
    'config': ['cm', 'secret', 'ns', 'sa'],
    'rbac': ['role', 'c-role', 'rb', 'crb', 'group', 'user'],
    'controlplane': ['api', 'sched', 'c-m', 'c-c-m', 'k-proxy', 'kubelet'],
    'infrastructure': ['node', 'control-plane', 'etcd'],
    'extensions': ['crd', 'hpa', 'psp', 'quota', 'limits'],
}

def get_category_for_resource(filename):
    """Determine category for a resource based on filename."""
    base_name = filename.replace('.svg', '').lower()
    
    # Check each category's resources
    for category, resources in CATEGORY_MAPPING.items():
        if base_name in resources:
            return category
    
    return 'other'

def extract_name_from_filename(filename):
    """Extract resource name from filename."""
    base_name = filename.replace('.svg', '').lower()
    return RESOURCE_NAMES.get(base_name, base_name.replace('-', ' ').title())

def process_k8s_icons():
    """Process Kubernetes icons and generate resource JSON."""
    k8s_base_path = 'public/resources/k8s'
    
    categories_data = defaultdict(list)
    
    # Process resources (use labeled versions)
    resources_path = os.path.join(k8s_base_path, 'resources', 'labeled')
    if os.path.exists(resources_path):
        for filename in sorted(os.listdir(resources_path)):
            if filename.endswith('.svg'):
                name = extract_name_from_filename(filename)
                category_key = get_category_for_resource(filename)
                
                # File path relative to resources/ folder (absolute from k8s/)
                file_path = f"k8s/resources/labeled/{filename}"
                
                categories_data[category_key].append({
                    'name': name,
                    'file': file_path,
                    'type': 'resource' if category_key != 'controlplane' and category_key != 'infrastructure' else 'component'
                })
    
    # Process control plane components (use labeled versions)
    cp_path = os.path.join(k8s_base_path, 'control_plane_components', 'labeled')
    if os.path.exists(cp_path):
        for filename in sorted(os.listdir(cp_path)):
            if filename.endswith('.svg'):
                name = extract_name_from_filename(filename)
                category_key = 'controlplane'
                
                file_path = f"k8s/control_plane_components/labeled/{filename}"
                
                categories_data[category_key].append({
                    'name': name,
                    'file': file_path,
                    'type': 'component'
                })
    
    # Process infrastructure components (use labeled versions)
    infra_path = os.path.join(k8s_base_path, 'infrastructure_components', 'labeled')
    if os.path.exists(infra_path):
        for filename in sorted(os.listdir(infra_path)):
            if filename.endswith('.svg'):
                name = extract_name_from_filename(filename)
                category_key = 'infrastructure'
                
                file_path = f"k8s/infrastructure_components/labeled/{filename}"
                
                categories_data[category_key].append({
                    'name': name,
                    'file': file_path,
                    'type': 'component'
                })
    
    # Category display names
    category_display_names = {
        'compute': 'Compute',
        'network': 'Networking',
        'storage': 'Storage',
        'config': 'Configuration',
        'rbac': 'RBAC',
        'controlplane': 'Control Plane',
        'infrastructure': 'Infrastructure',
        'extensions': 'Extensions',
        'other': 'Other'
    }
    
    # Build the JSON structure
    result = {
        "name": "Kubernetes",
        "icon": "k8s.png",
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
        path = f"k8s/{category_key}"
        
        result["categories"][category_key] = {
            "name": display_name,
            "path": path,
            "resources": unique_resources
        }
        
        total_resources += len(unique_resources)
    
    result["totalResources"] = total_resources
    
    # Write to file
    output_file = 'public/resources/resource-k8s.json'
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(result, f, indent=2, ensure_ascii=False)
    
    print(f"Generated JSON with {len(result['categories'])} categories and {total_resources} total resources")
    print(f"\nCategories:")
    for key in sorted(result['categories'].keys()):
        cat = result['categories'][key]
        print(f"  {key}: {cat['name']} ({len(cat['resources'])} items)")

if __name__ == '__main__':
    process_k8s_icons()
