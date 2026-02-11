#!/usr/bin/env python3
"""
Generate resource-onprem.json from onprem folder structure.

This script processes all PNG/SVG files in public/resources/onprem/
and generates a complete resource-onprem.json file with proper category paths.
"""

import os
import json
from collections import defaultdict

def format_name(filename):
    """Format filename to proper display name."""
    # Remove extension
    name = filename.replace('.png', '').replace('.svg', '')
    
    # Handle common abbreviations and special cases
    special_cases = {
        'ci': 'CI',
        'cd': 'CD',
        'dns': 'DNS',
        'etl': 'ETL',
        'iac': 'IaC',
        'mlops': 'MLOps',
        'vcs': 'VCS',
        'sso': 'SSO',
        'api': 'API',
        'sdk': 'SDK',
        'sas': 'SAS',
        'san': 'SAN',
        'nas': 'NAS',
        'jbod': 'JBOD',
        'raid': 'RAID',
        'nic': 'NIC',
        'ldap': 'LDAP',
        'elk': 'ELK',
        'splunk': 'Splunk',
        'datadog': 'Datadog',
        'newrelic': 'New Relic',
        'prometheus': 'Prometheus',
        'grafana': 'Grafana',
        'jenkins': 'Jenkins',
        'gitlab': 'GitLab',
        'github': 'GitHub',
        'circleci': 'CircleCI',
        'travisci': 'Travis CI',
        'concourseci': 'Concourse CI',
        'droneci': 'Drone CI',
        'zuulci': 'Zuul CI',
        'gitlabci': 'GitLab CI',
        'github-actions': 'GitHub Actions',
        'teamcity': 'TeamCity',
        'argocd': 'Argo CD',
        'tekton': 'Tekton',
        'tekton-cli': 'Tekton CLI',
        'oauth2-proxy': 'OAuth2 Proxy',
        'buzzfeed-sso': 'BuzzFeed SSO',
        'lets-encrypt': "Let's Encrypt",
        'cert-manager': 'Cert Manager',
        'bind-9': 'BIND 9',
        'cisco-router': 'Cisco Router',
        'cisco-switch-l2': 'Cisco Switch L2',
        'cisco-switch-l3': 'Cisco Switch L3',
        'open-service-mesh': 'Open Service Mesh',
        'ceph-osd': 'Ceph OSD',
        'postgresql': 'PostgreSQL',
        'mysql': 'MySQL',
        'mongodb': 'MongoDB',
        'redis': 'Redis',
        'cassandra': 'Cassandra',
        'clickhouse': 'ClickHouse',
        'couchdb': 'CouchDB',
        'couchbase': 'CouchBase',
        'cockroachdb': 'CockroachDB',
        'influxdb': 'InfluxDB',
        'neo4j': 'Neo4j',
        'mssql': 'MS SQL',
        'mariadb': 'MariaDB',
        'oracle': 'Oracle',
        'hbase': 'HBase',
        'druid': 'Druid',
        'dgraph': 'DGraph',
        'janusgraph': 'JanusGraph',
        'scylla': 'Scylla',
        'qdrant': 'Qdrant',
        'duckdb': 'DuckDB',
        'hadoop': 'Hadoop',
        'spark': 'Spark',
        'kafka': 'Kafka',
        'flink': 'Flink',
        'storm': 'Storm',
        'presto': 'Presto',
        'trino': 'Trino',
        'tableau': 'Tableau',
        'powerbi': 'Power BI',
        'metabase': 'Metabase',
        'superset': 'Superset',
        'dbt': 'dbt',
        'dremio': 'Dremio',
        'norikra': 'Norikra',
        'singer': 'Singer',
        'beam': 'Beam',
        'databricks': 'Databricks',
        'prometheus-operator': 'Prometheus Operator',
        'syslog-ng': 'syslog-ng',
        'fluentbit': 'Fluent Bit',
        'fluentd': 'Fluentd',
        'graylog': 'Graylog',
        'loki': 'Loki',
        'rsyslog': 'rsyslog',
        'jaeger': 'Jaeger',
        'tempo': 'Tempo',
        'thanos': 'Thanos',
        'cortex': 'Cortex',
        'mimir': 'Mimir',
        'humio': 'Humio',
        'sentry': 'Sentry',
        'nagios': 'Nagios',
        'zabbix': 'Zabbix',
        'dynatrace': 'Dynatrace',
        'rabbitmq': 'RabbitMQ',
        'activemq': 'ActiveMQ',
        'zeromq': 'ZeroMQ',
        'nats': 'NATS',
        'emqx': 'EMQX',
        'celery': 'Celery',
        'ansible': 'Ansible',
        'terraform': 'Terraform',
        'pulumi': 'Pulumi',
        'puppet': 'Puppet',
        'awx': 'AWX',
        'atlantis': 'Atlantis',
        'vault': 'Vault',
        'bitwarden': 'Bitwarden',
        'trivy': 'Trivy',
        'harbor': 'Harbor',
        'jfrog': 'JFrog',
        'gitea': 'Gitea',
        'gitlab': 'GitLab',
        'github': 'GitHub',
        'svn': 'SVN',
        'airflow': 'Airflow',
        'digdag': 'Digdag',
        'kubeflow': 'Kubeflow',
        'nifi': 'NiFi',
        'mlflow': 'MLflow',
        'polyaxon': 'Polyaxon',
        'flagger': 'Flagger',
        'flux': 'Flux',
        'consul': 'Consul',
        'etcd': 'etcd',
        'zookeeper': 'Zookeeper',
        'envoy': 'Envoy',
        'istio': 'Istio',
        'linkerd': 'Linkerd',
        'kong': 'Kong',
        'traefik': 'Traefik',
        'ambassador': 'Ambassador',
        'pomerium': 'Pomerium',
        'tyk': 'Tyk',
        'ocelot': 'Ocelot',
        'yarp': 'YARP',
        'nginx': 'Nginx',
        'apache': 'Apache',
        'caddy': 'Caddy',
        'haproxy': 'HAProxy',
        'gunicorn': 'Gunicorn',
        'tomcat': 'Tomcat',
        'jetty': 'Jetty',
        'jbossas': 'JBoss AS',
        'wildfly': 'WildFly',
        'glassfish': 'GlassFish',
        'mikrotik': 'MikroTik',
        'vyos': 'VyOS',
        'opnsense': 'OPNsense',
        'pfsense': 'pfSense',
        'powerdns': 'PowerDNS',
        'coredns': 'CoreDNS',
        'solr': 'Solr',
        'hazelcast': 'Hazelcast',
        'aerospike': 'Aerospike',
        'memcached': 'Memcached',
        'glusterfs': 'GlusterFS',
        'portworx': 'Portworx',
        'ceph': 'Ceph',
        'nextcloud': 'Nextcloud',
        'dex': 'Dex',
        'boundary': 'Boundary',
        'centrifugo': 'Centrifugo',
        'embulk': 'Embulk',
        'vector': 'Vector',
        'k3s': 'K3s',
        'rkt': 'rkt',
        'lxc': 'LXC',
        'gvisor': 'gVisor',
        'firecracker': 'Firecracker',
        'crio': 'CRI-O',
        'containerd': 'containerd',
        'docker': 'Docker',
        'nomad': 'Nomad',
        'server': 'Server',
        'user': 'User',
        'users': 'Users',
        'client': 'Client',
        'internet': 'Internet',
        'pve': 'Proxmox VE',
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
        'ci': 'CI/CD',
        'cd': 'Continuous Deployment',
        'iac': 'Infrastructure as Code',
        'vcs': 'Version Control',
        'mlops': 'MLOps',
        'dns': 'DNS',
        'etl': 'ETL',
        'auth': 'Authentication',
        'client': 'Client',
        'compute': 'Compute',
        'container': 'Container',
        'database': 'Database',
        'analytics': 'Analytics',
        'monitoring': 'Monitoring',
        'logging': 'Logging',
        'tracing': 'Tracing',
        'network': 'Network',
        'storage': 'Storage',
        'security': 'Security',
        'identity': 'Identity',
        'queue': 'Message Queue',
        'messaging': 'Messaging',
        'registry': 'Container Registry',
        'search': 'Search',
        'inmemory': 'In-Memory',
        'gitops': 'GitOps',
        'certificates': 'Certificates',
        'aggregator': 'Aggregator',
        'groupware': 'Groupware',
        'proxmox': 'Proxmox',
        'workflow': 'Workflow',
    }
    return display_names.get(folder_name.lower(), ' '.join(word.capitalize() for word in folder_name.split()))

def process_onprem_resources():
    """Process onprem folder and generate resource JSON."""
    onprem_path = 'public/resources/onprem'
    categories_data = defaultdict(list)

    # Process each category folder
    for category_folder in sorted(os.listdir(onprem_path)):
        category_path = os.path.join(onprem_path, category_folder)
        if not os.path.isdir(category_path) or category_folder.endswith('.png'):
            continue
        
        # Get all PNG/SVG files in this category
        for filename in sorted(os.listdir(category_path)):
            if filename.endswith(('.png', '.svg')):
                name = format_name(filename)
                
                # Determine type based on category
                file_type = 'software'  # default
                if category_folder == 'compute':
                    if 'server' in filename.lower():
                        file_type = 'hardware'
                    else:
                        file_type = 'software'
                elif category_folder == 'client':
                    file_type = 'client'
                
                categories_data[category_folder].append({
                    'name': name,
                    'file': filename,
                    'type': file_type
                })

    # Build the JSON structure
    result = {
        "name": "On-Premise",
        "icon": "onprem.png",
        "totalResources": 0,
        "categories": {}
    }

    total_resources = 0

    for folder_name, resources in sorted(categories_data.items()):
        key = folder_name.lower()
        display_name = folder_to_display_name(folder_name)
        path = f"onprem/{folder_name}"
        
        result["categories"][key] = {
            "name": display_name,
            "path": path,
            "resources": resources
        }
        
        total_resources += len(resources)

    result["totalResources"] = total_resources

    # Write to file
    output_file = 'public/resources/resource-onprem.json'
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(result, f, indent=2, ensure_ascii=False)

    print(f"Generated JSON with {len(result['categories'])} categories and {total_resources} total resources")
    print(f"\nCategories:")
    for key in sorted(result['categories'].keys()):
        cat = result['categories'][key]
        print(f"  {key}: {cat['name']} ({len(cat['resources'])} items)")

if __name__ == '__main__':
    process_onprem_resources()
