/**
 * Service Substitution System
 * Maps generic terms to specific cloud provider services
 */

interface ServiceMapping {
  generic: string;
  substitutions: {
    aws: string;
    azure?: string;
    gcp?: string;
  };
}

const serviceMappings: ServiceMapping[] = [
  // Compute Services
  {
    generic: "server",
    substitutions: {
      aws: "aws.compute.ec2",
      azure: "azure.compute['virtual-machines']",
      gcp: "gcp.compute['compute-engine']"
    }
  },
  {
    generic: "virtual machine",
    substitutions: {
      aws: "aws.compute.ec2",
      azure: "azure.compute['virtual-machines']",
      gcp: "gcp.compute['compute-engine']"
    }
  },
  {
    generic: "vm",
    substitutions: {
      aws: "aws.compute.ec2",
      azure: "azure.compute['virtual-machines']",
      gcp: "gcp.compute['compute-engine']"
    }
  },
  {
    generic: "function",
    substitutions: {
      aws: "aws.compute.lambda",
      azure: "azure.compute['function-apps']",
      gcp: "gcp.compute['cloud-functions']"
    }
  },
  {
    generic: "lambda",
    substitutions: {
      aws: "aws.compute.lambda",
      azure: "azure.compute['function-apps']",
      gcp: "gcp.compute['cloud-functions']"
    }
  },
  {
    generic: "container",
    substitutions: {
      aws: "aws.compute.ec2", // EC2 is most common for containers
      azure: "azure.compute['app-services']",
      gcp: "gcp.compute['kubernetes-engine']"
    }
  },
  {
    generic: "kubernetes",
    substitutions: {
      aws: "aws.compute.ec2", // EKS would be more specific but EC2 is more general
      azure: "azure.compute['kubernetes-engine']",
      gcp: "gcp.compute['kubernetes-engine']"
    }
  },

  // Database Services
  {
    generic: "database",
    substitutions: {
      aws: "aws.database.rds",
      azure: "azure.database['sql-database']",
      gcp: "gcp.database['cloud-sql']"
    }
  },
  {
    generic: "sql database",
    substitutions: {
      aws: "aws.database.rds",
      azure: "azure.database['sql-database']",
      gcp: "gcp.database['cloud-sql']"
    }
  },
  {
    generic: "nosql",
    substitutions: {
      aws: "aws.database.dynamodb",
      azure: "azure.database['cosmos-db']",
      gcp: "gcp.database.firestore"
    }
  },
  {
    generic: "document database",
    substitutions: {
      aws: "aws.documentdb",
      azure: "azure.database['cosmos-db']",
      gcp: "gcp.database.firestore"
    }
  },
  {
    generic: "data warehouse",
    substitutions: {
      aws: "aws.database.redshift",
      azure: "azure.database['sql-datawarehouse']",
      gcp: "gcp.database.bigquery"
    }
  },

  // Storage Services
  {
    generic: "storage",
    substitutions: {
      aws: "aws.storage.s3",
      azure: "azure.storage['blob-storage']",
      gcp: "gcp.storage['cloud-storage']"
    }
  },
  {
    generic: "object storage",
    substitutions: {
      aws: "aws.storage.s3",
      azure: "azure.storage['blob-storage']",
      gcp: "gcp.storage['cloud-storage']"
    }
  },
  {
    generic: "file storage",
    substitutions: {
      aws: "aws.storage.efs",
      azure: "azure.storage['file-storage']",
      gcp: "gcp.storage.filestore"
    }
  },
  {
    generic: "block storage",
    substitutions: {
      aws: "aws.storage.ebs",
      azure: "azure.storage['disk-storage']",
      gcp: "gcp.storage['persistent-disk']"
    }
  },
  {
    generic: "bucket",
    substitutions: {
      aws: "aws.storage.s3",
      azure: "azure.storage['blob-storage']",
      gcp: "gcp.storage['cloud-storage-bucket']"
    }
  },

  // Networking Services
  {
    generic: "network",
    substitutions: {
      aws: "aws.network.vpc",
      azure: "azure.network['virtual-network']",
      gcp: "gcp.network['vpc-network']"
    }
  },
  {
    generic: "vpc",
    substitutions: {
      aws: "aws.network.vpc",
      azure: "azure.network['virtual-network']",
      gcp: "gcp.network['vpc-network']"
    }
  },
  {
    generic: "load balancer",
    substitutions: {
      aws: "aws.network.elb",
      azure: "azure.network['load-balancer']",
      gcp: "gcp.network['load-balancing']"
    }
  },
  {
    generic: "cdn",
    substitutions: {
      aws: "aws.network.cloudfront",
      azure: "azure.network.cdn",
      gcp: "gcp.network['cloud-cdn']"
    }
  },
  {
    generic: "dns",
    substitutions: {
      aws: "aws.network['route-53']",
      azure: "azure.network['cloud-dns']",
      gcp: "gcp.network['cloud-dns']"
    }
  },
  {
    generic: "api gateway",
    substitutions: {
      aws: "aws.network['api-gateway']",
      azure: "azure.network['api-management']",
      gcp: "gcp.network['api-gateway']"
    }
  },

  // Security Services
  {
    generic: "firewall",
    substitutions: {
      aws: "aws.security.waf",
      azure: "azure.network['network-security-group']",
      gcp: "gcp.compute['cloud-firewall']"
    }
  },
  {
    generic: "identity",
    substitutions: {
      aws: "aws.security.iam",
      azure: "azure.identity['active-directory']",
      gcp: "gcp.identity['cloud-identity']"
    }
  },
  {
    generic: "authentication",
    substitutions: {
      aws: "aws.security.iam",
      azure: "azure.identity['active-directory']",
      gcp: "gcp.identity['cloud-identity']"
    }
  },
  {
    generic: "encryption",
    substitutions: {
      aws: "aws.security.kms",
      azure: "azure.security['key-vault']",
      gcp: "gcp.security['cloud-kms']"
    }
  },

  // Analytics & Monitoring
  {
    generic: "monitoring",
    substitutions: {
      aws: "aws.management.cloudwatch",
      azure: "azure.monitoring['monitor']",
      gcp: "gcp.monitoring['cloud-monitoring']"
    }
  },
  {
    generic: "logging",
    substitutions: {
      aws: "aws.management.cloudtrail",
      azure: "azure.monitoring['log-analytics']",
      gcp: "gcp.logging['cloud-logging']"
    }
  },
  {
    generic: "analytics",
    substitutions: {
      aws: "aws.analytics.emr",
      azure: "azure.analytics['synapse-analytics']",
      gcp: "gcp.analytics['dataflow']"
    }
  },

  // User/Client
  {
    generic: "user",
    substitutions: {
      aws: "aws.general.user",
      azure: "azure.general.user",
      gcp: "gcp.general.user"
    }
  },
  {
    generic: "client",
    substitutions: {
      aws: "aws.general.client",
      azure: "azure.general.client",
      gcp: "gcp.general.client"
    }
  },
  {
    generic: "mobile client",
    substitutions: {
      aws: "aws.general['mobile-client']",
      azure: "azure.general['mobile-client']",
      gcp: "gcp.general['mobile-client']"
    }
  }
];

/**
 * Substitutes generic service names with specific cloud provider services
 */
export function substituteServices(
  diagramJson: any,
  preferredProvider: 'aws' | 'azure' | 'gcp' = 'aws'
): any {
  if (!diagramJson || !diagramJson.nodes) {
    return diagramJson;
  }

  const result = JSON.parse(JSON.stringify(diagramJson)); // Deep clone

  // Process nodes
  result.nodes = result.nodes.map((node: any) => {
    if (!node.type) return node;

    // Check if node type matches any generic term
    const mapping = serviceMappings.find(m => 
      node.type.toLowerCase().includes(m.generic.toLowerCase()) ||
      node.label?.toLowerCase().includes(m.generic.toLowerCase())
    );

    if (mapping && mapping.substitutions[preferredProvider]) {
      // Preserve all other properties, just update the type
      return {
        ...node,
        type: mapping.substitutions[preferredProvider]!
      };
    }

    return node;
  });

  return result;
}

/**
 * Detects likely provider from existing node types
 */
export function detectProvider(nodes: any[]): 'aws' | 'azure' | 'gcp' | 'generic' {
  const providerCounts = {
    aws: 0,
    azure: 0,
    gcp: 0
  };

  nodes.forEach(node => {
    if (node.type?.startsWith('aws.')) providerCounts.aws++;
    else if (node.type?.startsWith('azure.')) providerCounts.azure++;
    else if (node.type?.startsWith('gcp.')) providerCounts.gcp++;
  });

  const total = providerCounts.aws + providerCounts.azure + providerCounts.gcp;
  if (total === 0) return 'generic';

  // Return provider with highest count, or default to AWS
  const maxCount = Math.max(providerCounts.aws, providerCounts.azure, providerCounts.gcp);
  if (providerCounts.aws === maxCount) return 'aws';
  if (providerCounts.azure === maxCount) return 'azure';
  return 'gcp';
}