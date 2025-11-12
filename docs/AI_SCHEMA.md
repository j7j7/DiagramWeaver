# DiagramWeaver AI Schema

This document provides a comprehensive schema for AI models to generate DiagramWeaver diagrams. It includes all available node types, styling options, and resource capabilities.

## Overview

DiagramWeaver uses a JSON structure with three main components:
- `nodes`: Individual diagram elements
- `connections`: Relationships between nodes  
- `groups`: Hierarchical containers for nodes

## Complete JSON Schema

```json
{
  "nodes": [
    {
      "id": "string",
      "type": "string",
      "label": "string",
      "info": "string",
      "x": "number",
      "y": "number",
      "lineColor": "string",
      "edgePosition": "top|bottom|left|right",
      "borderColor": "string",
      "backgroundColor": "string",
      "textColor": "string",
      "borderStyle": "solid|dotted|gradient|none",
      "borderColors": ["string", "string"],
      "backgroundStyle": "solid|gradient|none",
      "backgroundColors": ["string", "string"],
      "gradientAngle": "number",
      "shadow": "boolean",
      "rotation": "number",
      "textPosition": "above|center|under",
      "freeflow": "boolean",
      "borderWidth": "number",
      "width": "number",
      "height": "number",
      "sizeMode": "auto|custom",
      "noIconBackground": "boolean"
    }
  ],
  "connections": [
    {
      "from": "string",
      "to": "string",
      "color": "string",
      "text": "string",
      "textPosition": "number",
      "fromPreferredExit": "top|bottom|left|right|center",
      "fromArrow": "boolean",
      "toPreferredEntry": "top|bottom|left|right|center",
      "toArrow": "boolean",
      "arrow": "boolean",
      "style": "bezier",
      "curvature": "number",
      "lineWidth": "number",
      "shadow": "boolean"
    }
  ],
  "groups": [
    {
      "id": "string",
      "type": "group",
      "label": "string",
      "children": ["string"],
      "info": "string",
      "x": "number",
      "y": "number",
      "subType": "zone|group",
      "color": "string",
      "borderColor": "string",
      "textColor": "string",
      "backgroundColor": "string",
      "borderStyle": "solid|dotted|gradient|none",
      "borderColors": ["string", "string"],
      "backgroundStyle": "solid|gradient|none",
      "backgroundColors": ["string", "string"],
      "gradientAngle": "number",
      "orientation": "horizontal|vertical|square",
      "maxItemsPerRow": "number",
      "lineColor": "string",
      "shadow": "boolean",
      "parentId": "string",
      "textPosition": "top-left|top-center|top-right|bottom-left|bottom-center|bottom-right|inside",
      "width": "number",
      "height": "number",
      "sizeMode": "auto|custom",
      "minWidth": "number",
      "minHeight": "number",
      "rotation": "number",
      "borderWidth": "number"
    }
  ],
  "rootGroupId": "string"
}
```

## Node Types

### Text Nodes
- `generic.text.text` - Simple text
- `generic.text.textbox` - Text with editable box background

### Shape Nodes
- `generic.object.square` - Square shape
- `generic.object.rectangle` - Rectangle shape
- `generic.object.circle` - Circle shape
- `generic.object.triangle` - Triangle shape
- `generic.object.star` - Star shape
- `generic.object.cloud` - Cloud shape

### Resource Nodes
Resource nodes follow the pattern: `{provider}.{category}.{resource}`

#### Available Providers and Categories

**AWS (Amazon Web Services)**
- `aws.general` - General AWS resources (Client, Disk, Internet Gateway, etc.)
- `aws.compute` - Compute resources (EC2, Lambda, Batch, etc.)
- `aws.storage` - Storage resources (S3, EBS, EFS, etc.)
- `aws.database` - Database resources (RDS, DynamoDB, etc.)
- `aws.networking` - Networking resources (VPC, CloudFront, etc.)
- `aws.security` - Security resources (IAM, KMS, etc.)
- `aws.analytics` - Analytics resources (Redshift, Athena, etc.)
- `aws.ai` - AI/ML resources (SageMaker, etc.)
- `aws.iot` - IoT resources
- `aws.mobile` - Mobile services
- `aws.ar` - AR/VR services
- `aws.blockchain` - Blockchain services
- `aws.business` - Business applications
- `aws.cost` - Cost management
- `aws.game` - Game development
- `aws.management` - Management tools
- `aws.media` - Media services
- `aws.migration` - Migration tools
- `aws.quantum` - Quantum technologies
- `aws.robotics` - Robotics
- `aws.satellite` - Satellite services
- `aws.blockchain` - Blockchain

**Azure (Microsoft Azure)**
- `azure.aimachinelearning` - AI and Machine Learning
- `azure.analytics` - Analytics services
- `azure.appservices` - App Services
- `azure.azureecosystem` - Azure ecosystem
- `azure.compute` - Compute resources
- `azure.container` - Container services
- `azure.database` - Database services
- `azure.devops` - DevOps tools
- `azure.general` - General Azure resources
- `azure.hpc` - High Performance Computing
- `azure.identity` - Identity services
- `azure.integration` - Integration services
- `azure.iot` - IoT services
- `azure.management` - Management tools
- `azure.media` - Media services
- `azure.mobile` - Mobile services
- `azure.monitoring` - Monitoring services
- `azure.networking` - Networking
- `azure.security` - Security services
- `azure.storage` - Storage services
- `azure.web` - Web services

**GCP (Google Cloud Platform)**
- `gcp.compute` - Compute Engine
- `gcp.database` - Database services
- `gcp.storage` - Storage services
- `gcp.networking` - Networking
- `gcp.bigdata` - Big Data services
- `gcp.ai` - AI and Machine Learning
- `gcp.analytics` - Analytics
- `gcp.api` - API management
- `gcp.developer` - Developer tools
- `gcp.iot` - IoT services
- `gcp.management` - Management tools
- `gcp.security` - Security services

**Other Providers**
- `alibabacloud` - Alibaba Cloud services
- `digitalocean` - DigitalOcean services
- `elastic` - Elastic Stack services
- `firebase` - Firebase services
- `ibm` - IBM Cloud services
- `k8s` - Kubernetes resources
- `oci` - Oracle Cloud Infrastructure
- `onprem` - On-premises resources
- `openstack` - OpenStack services
- `outscale` - Outscale services
- `programming` - Programming languages and frameworks
- `saas` - SaaS applications
- `generic` - Generic computing resources

## Styling Options

### Gradient Angles
- `-45` - Alt Diagonal ↗
- `90` - Down
- `135` - Diagonal ↘
- `180` - Side

### Border Styles
- `solid` - Solid border
- `dotted` - Dotted border
- `gradient` - Gradient border
- `none` - No border

### Background Styles
- `solid` - Solid background color
- `gradient` - Gradient background
- `none` - Transparent background

### Text Positions (for shapes)
- `above` - Text above the shape
- `center` - Text centered in the shape
- `under` - Text below the shape

### Group Orientations
- `horizontal` - Horizontal layout
- `vertical` - Vertical layout
- `square` - Square/grid layout

### Group Text Positions
- `top-left` - Top left of group
- `top-center` - Top center of group
- `top-right` - Top right of group
- `bottom-left` - Bottom left of group
- `bottom-center` - Bottom center of group
- `bottom-right` - Bottom right of group
- `inside` - Inside the group

## Connection Options

### Arrow Options
- `fromArrow` - Arrow at source node
- `toArrow` - Arrow at target node
- `arrow` - Legacy arrow property (backward compatibility)

### Connection Styles
- `bezier` - Curved connection with adjustable curvature

### Entry/Exit Points
- `top` - Connect from/to top edge
- `bottom` - Connect from/to bottom edge
- `left` - Connect from/to left edge
- `right` - Connect from/to right edge
- `center` - Connect from/to center

## Example Diagrams

### Simple AWS Architecture
```json
{
  "nodes": [
    {
      "id": "user",
      "type": "aws.general.user",
      "label": "User",
      "x": 100,
      "y": 100
    },
    {
      "id": "ec2",
      "type": "aws.compute.ec2",
      "label": "Web Server",
      "x": 300,
      "y": 100,
      "backgroundColor": "#ff9900",
      "shadow": true
    },
    {
      "id": "rds",
      "type": "aws.database.rds",
      "label": "Database",
      "x": 500,
      "y": 100,
      "backgroundColor": "#527fff"
    }
  ],
  "connections": [
    {
      "from": "user",
      "to": "ec2",
      "toArrow": true,
      "color": "#ff9900"
    },
    {
      "from": "ec2",
      "to": "rds",
      "toArrow": true,
      "color": "#527fff"
    }
  ],
  "groups": []
}
```

### Styled Diagram with Groups
```json
{
  "nodes": [
    {
      "id": "frontend",
      "type": "generic.object.rectangle",
      "label": "Frontend",
      "x": 50,
      "y": 50,
      "backgroundStyle": "gradient",
      "backgroundColors": ["#667eea", "#764ba2"],
      "gradientAngle": 135,
      "shadow": true,
      "width": 120,
      "height": 60
    },
    {
      "id": "backend",
      "type": "generic.object.rectangle",
      "label": "Backend",
      "x": 250,
      "y": 50,
      "backgroundStyle": "gradient",
      "backgroundColors": ["#f093fb", "#f5576c"],
      "gradientAngle": 90,
      "shadow": true,
      "width": 120,
      "height": 60
    }
  ],
  "connections": [
    {
      "from": "frontend",
      "to": "backend",
      "style": "bezier",
      "curvature": 0.6,
      "toArrow": true,
      "color": "#333333"
    }
  ],
  "groups": [
    {
      "id": "app-group",
      "type": "group",
      "label": "Application Layer",
      "children": ["frontend", "backend"],
      "subType": "zone",
      "backgroundStyle": "gradient",
      "backgroundColors": ["#f3f4f6", "#e5e7eb"],
      "gradientAngle": 180,
      "borderStyle": "solid",
      "borderColor": "#6b7280",
      "shadow": true
    }
  ]
}
```

## Maintenance Notes

This schema should be updated when:
1. New resource providers are added
2. New node types are introduced
3. New styling options are added
4. Connection options are expanded

To update this schema:
1. Check `src/lib/types.ts` for type definitions
2. Review `public/resources/resource-*.json` files for available resources
3. Examine component implementations for new features
4. Update the examples to reflect new capabilities