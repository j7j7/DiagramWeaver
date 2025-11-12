/**
 * Ollama Service - Direct API integration with Ollama
 */

import { ollamaConfig } from '@/lib/ollama-config';

interface OllamaGenerateRequest {
  model: string;
  prompt: string;
  stream?: boolean;
  format?: string;
  options?: {
    temperature?: number;
    top_p?: number;
    max_tokens?: number;
  };
}

interface OllamaGenerateResponse {
  model: string;
  created_at: string;
  response: string;
  done: boolean;
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  prompt_eval_duration?: number;
  eval_count?: number;
  eval_duration?: number;
}

interface OllamaModelsResponse {
  models: Array<{
    name: string;
    size?: number;
    digest?: string;
    modified_at: string;
  }>;
}

export class OllamaService {
  private config = ollamaConfig;

  constructor() {
    // Configuration is now managed by ollamaConfig
  }

  /**
   * Generate text using Ollama API
   */
  async generate(prompt: string): Promise<string> {
    const request: OllamaGenerateRequest = {
      model: this.config.getModel(),
      prompt: `You are an expert diagram generator for DiagramWeaver. You will take a natural language description and generate valid JSON that can be directly imported into DiagramWeaver.

## DIAGRAMWEAVER SCHEMA REFERENCE:

### JSON Structure:
{
  "nodes": [...],      // Individual diagram elements
  "connections": [...], // Relationships between nodes
  "groups": [...]      // Hierarchical containers (optional)
}

### Node Types:
**Text/Label Nodes:**
- generic.text.label - Simple text label
- generic.text.textbox - Text with editable box background
- generic.text.labelbox - Label with background box

**Shape Nodes:**
- generic.text.square - Square shape
- generic.text.rectangle - Rectangle shape
- generic.text.circle - Circle shape
- generic.text.point - Point shape (small grey point, no outline, no label, freeflow mode)
- generic.text.triangle - Triangle shape
- generic.text.star - Star shape
- generic.text.cloud - Cloud shape

**Resource Nodes (format: {provider}.{category}.{resource}):**

**AWS Services:**
- **Compute:** aws.compute.ec2, aws.compute.lambda, aws.compute.batch, aws.compute["ec2-auto-scaling"], aws.compute["ec2-spot-instance"]
- **Storage:** aws.storage.s3, aws.storage.ebs, aws.storage.efs, aws.storage["storage-gateway"], aws.storage.backup
- **Database:** aws.database.rds, aws.database.dynamodb, aws.database.redshift, aws.database.aurora, aws.database.neptune
- **Networking:** aws.network.vpc, aws.network.cloudfront, aws.network["route-53"], aws.network["api-gateway"], aws.network.elb, aws.network.alb
- **Security:** aws.security.iam, aws.security.kms, aws.security["secrets-manager"], aws.security.guardduty, aws.security.waf
- **Analytics:** aws.analytics.emr, aws.analytics.kinesis, aws.analytics.glue, aws.analytics.athena, aws.analytics.quicksight
- **Management:** aws.management.cloudwatch, aws.management.cloudtrail, aws.management.config, aws.management["systems-manager"]
- **General:** aws.general.user, aws.general.client, aws.general["internet-gateway"], aws.general.disk

**Azure Services:**
- **Compute:** azure.compute["virtual-machines"], azure.compute["vm-scale-sets"], azure.compute["function-apps"], azure.compute["app-services"]
- **Storage:** azure.storage["storage-account"], azure.storage["blob-storage"], azure.storage["file-storage"], azure.storage["disk-storage"]
- **Database:** azure.database["sql-database"], azure.database["cosmos-db"], azure.database["database-for-mysql"], azure.database["cache-for-redis"]
- **Networking:** azure.network.vpc, azure.network["virtual-network"], azure.network["load-balancer"], azure.network.cdn

**GCP Services:**
- **Compute:** gcp.compute["compute-engine"], gcp.compute["kubernetes-engine"], gcp.compute["app-engine"], gcp.compute["cloud-functions"]
- **Storage:** gcp.storage["cloud-storage"], gcp.storage["persistent-disk"], gcp.storage["filestore"], gcp.storage["cloud-storage-bucket"]
- **Database:** gcp.database["cloud-sql"], gcp.database.spanner, gcp.database.bigtable, gcp.database.firestore, gcp.database.bigquery
- **Networking:** gcp.network["vpc-network"], gcp.network["cloud-cdn"], gcp.network["load-balancing"], gcp.network["cloud-dns"]

**Other Providers:**
- **Kubernetes:** k8s.compute.pod, k8s.compute.service, k8s.network.ingress, k8s.storage.pvc
- **Generic:** generic.compute.server, generic.database.database, generic.network.firewall, generic.storage.disk
- **On-Premises:** onprem.compute.server, onprem.network.switch, onprem.storage.nas
- **Programming:** programming.language.javascript, programming.framework.react, programming.runtime.nodejs

### Styling Options:
**Gradient Angles:** -45 (Alt Diagonal ↗), 90 (Down), 135 (Diagonal ↘), 180 (Side)
**Border Styles:** solid, dotted, gradient, none
**Background Styles:** solid, gradient, none
**Text Positions (shapes):** above, center, under
**Group Orientations:** horizontal, vertical, square

### Connection Options:
**Styles:** bezier (with curvature 0.1-1.0)
**Arrows:** fromArrow (source), toArrow (target)
**Entry/Exit Points:** top, bottom, left, right, center

### Key Properties:
**Nodes:** id, type, label, x, y, backgroundColor, textColor, borderStyle, backgroundStyle, gradientAngle, shadow, width, height
**Connections:** from, to, color, toArrow, fromArrow, style, curvature
**Groups:** id, type: "group", label, children, subType: "zone"|"group", orientation, backgroundStyle, gradientAngle

## USER REQUEST:
${prompt}

## COMMON ARCHITECTURE PATTERNS:
**Web Application:** User → Load Balancer → Web Servers → Database
**Microservices:** API Gateway → Multiple Services →各自 Databases
**Data Pipeline:** Data Source → Processing → Storage → Analytics
**Serverless:** Events → Lambda Functions → Databases/Storage

## AI GENERATION STRATEGY:
**USE GENERIC TERMS** - The system will automatically substitute generic terms with specific cloud services:
- Instead of "aws.compute.ec2", use "server" or "virtual machine"
- Instead of "aws.database.rds", use "database" or "sql database"  
- Instead of "aws.storage.s3", use "storage" or "object storage"
- Instead of "aws.network.vpc", use "network" or "vpc"
- Instead of "aws.security.iam", use "identity" or "authentication"

**EXAMPLES:**
- "web server" → will become "aws.compute.ec2" (for AWS)
- "database" → will become "aws.database.rds" (for AWS)
- "storage bucket" → will become "aws.storage.s3" (for AWS)
- "load balancer" → will become "aws.network.elb" (for AWS)

## REQUIREMENTS:
1. Generate VALID JSON only - no markdown, no explanations, no code blocks
2. Use GENERIC TERMS for services (server, database, storage, network, etc.) - system will substitute automatically
3. Include proper positioning (x, y coordinates) - space nodes 150-200px apart
4. Add meaningful labels for all nodes
5. Create logical connections between related nodes with arrows
6. Use appropriate styling (AWS colors: #ff9900, Azure: #0078d4, GCP: #4285f4)
7. Ensure all referenced IDs exist in nodes array
8. Use bezier connections with curvature 0.6 for better appearance
9. Return only JSON object that can be directly parsed

Generate complete DiagramWeaver JSON now:`,
      stream: false,
      format: 'json',
      options: {
        temperature: this.config.get().temperature,
        top_p: this.config.get().topP,
        max_tokens: this.config.get().maxTokens,
      },
    };

    try {
      const response = await fetch(`${this.config.getBaseUrl()}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
      }

      const data: OllamaGenerateResponse = await response.json();
      
      if (data.done && data.response) {
        // Clean response and parse JSON to ensure it's valid
        let cleanedResponse = data.response.trim();
        
        // Remove any markdown code blocks if present
        if (cleanedResponse.startsWith('```json')) {
          cleanedResponse = cleanedResponse.replace(/```json\s*/, '').replace(/```\s*$/, '');
        } else if (cleanedResponse.startsWith('```')) {
          cleanedResponse = cleanedResponse.replace(/```\s*/, '').replace(/```\s*$/, '');
        }
        
        try {
          const parsedResponse = JSON.parse(cleanedResponse);
          
          // Validate basic structure
          if (!parsedResponse.nodes || !Array.isArray(parsedResponse.nodes)) {
            throw new Error('Invalid diagram structure: missing or invalid nodes array');
          }
          
          // Ensure all nodes have required properties
          for (const node of parsedResponse.nodes) {
            if (!node.id || !node.type) {
              throw new Error('Invalid node: missing required id or type property');
            }
          }
          
          // Validate connections if present
          if (parsedResponse.connections && Array.isArray(parsedResponse.connections)) {
            for (const conn of parsedResponse.connections) {
              if (!conn.from || !conn.to) {
                throw new Error('Invalid connection: missing required from or to property');
              }
            }
          }
          
          return JSON.stringify(parsedResponse);
        } catch (parseError) {
          console.error('Failed to parse or validate Ollama JSON response:', parseError);
          console.error('Raw response:', data.response);
          throw new Error(`Invalid JSON response from AI: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`);
        }
      } else {
        throw new Error('Ollama did not return a complete response');
      }
    } catch (error) {
      console.error('Error calling Ollama API:', error);
      throw error;
    }
  }

  /**
   * Check if Ollama service is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.getBaseUrl()}/api/tags`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        return false;
      }

      const data: OllamaModelsResponse = await response.json();
      const hasModel = data.models.some(model => model.name === this.config.getModel());
      
      return hasModel;
    } catch (error) {
      console.error('Error checking Ollama availability:', error);
      return false;
    }
  }

  /**
   * Get available models
   */
  async getModels(): Promise<string[]> {
    try {
      const response = await fetch(`${this.config.getBaseUrl()}/api/tags`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch models: ${response.status} ${response.statusText}`);
      }

      const data: OllamaModelsResponse = await response.json();
      return data.models.map(model => model.name);
    } catch (error) {
      console.error('Error fetching models:', error);
      return [];
    }
  }

  /**
   * Set model to use
   */
  setModel(model: string): void {
    this.config.setModel(model);
  }

  /**
   * Get current model
   */
  getModel(): string {
    return this.config.getModel();
  }
}

// Create and export default instance
export const ollamaService = new OllamaService();