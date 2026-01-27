# DiagramWeaver Embedding Guide

This guide explains how to embed DiagramWeaver diagrams on external websites, conference pages, or in documentation.

## Overview

DiagramWeaver provides two methods for embedding diagrams:

1. **Interactive Viewer** - A fully interactive, read-only diagram viewer embedded in an iframe
2. **Static Image Export** - Server-side API for generating PNG/SVG images

## Interactive Viewer

The interactive viewer allows users to pan, zoom, and interact with diagrams while maintaining all visual styling and features.

### Basic Usage

Embed the viewer using an iframe:

```html
<iframe 
  src="https://yourapp.com/viewer?json=<base64-encoded-json>" 
  width="100%" 
  height="600"
  frameborder="0"
></iframe>
```

### URL Parameters

The viewer accepts two types of input:

#### Option 1: Inline JSON (base64-encoded)

```
/viewer?json=<base64-encoded-json>
```

**JavaScript Example:**
```javascript
const diagramData = {
  nodes: [
    { id: 'node1', type: 'Server', label: 'Web Server', x: 100, y: 100 },
    { id: 'node2', type: 'Database', label: 'DB', x: 300, y: 100 },
  ],
  connections: [
    { from: 'node1', to: 'node2' },
  ],
  zones: [],
};

const jsonString = JSON.stringify(diagramData);
const base64Json = btoa(jsonString);
const viewerUrl = `https://yourapp.com/viewer?json=${encodeURIComponent(base64Json)}`;
```

**Python Example:**
```python
import json
import base64
from urllib.parse import quote

diagram_data = {
    "nodes": [
        {"id": "node1", "type": "Server", "label": "Web Server", "x": 100, "y": 100},
        {"id": "node2", "type": "Database", "label": "DB", "x": 300, "y": 100},
    ],
    "connections": [
        {"from": "node1", "to": "node2"},
    ],
    "zones": [],
}

json_string = json.dumps(diagram_data)
base64_json = base64.b64encode(json_string.encode()).decode()
viewer_url = f"https://yourapp.com/viewer?json={quote(base64_json)}"
```

#### Option 2: Remote JSON URL

```
/viewer?url=<url-to-json-file>
```

**Example:**
```html
<iframe 
  src="https://yourapp.com/viewer?url=https://example.com/diagrams/architecture.json" 
  width="100%" 
  height="600"
  frameborder="0"
></iframe>
```

### Viewer Features

- ✅ Pan and zoom (mouse wheel, drag, zoom controls)
- ✅ Hover tooltips (info popups on nodes/zones)
- ✅ Fit-to-view button
- ✅ All visual styling (shadows, gradients, borders, etc.)
- ✅ Connection lines with arrows and labels
- ✅ Layer visibility (if JSON contains layers)

### Responsive Sizing

The viewer automatically fits the diagram to the viewport on load. For responsive embedding:

```html
<div style="position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden;">
  <iframe 
    src="https://yourapp.com/viewer?json=..." 
    style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;"
    frameborder="0"
  ></iframe>
</div>
```

### Security Considerations

- JSON size limit: 5MB maximum
- Remote URLs must use `http://` or `https://` protocols
- Remote JSON fetching has a 10-second timeout
- All JSON is validated against the DiagramWeaver schema

## Static Image Export API

The export API generates static PNG or SVG images from diagram JSON, suitable for embedding in emails, PDFs, or documentation.

### API Endpoint

```
POST /api/export?format=png&quality=medium&bg=white
```

### Request Format

**URL:** `/api/export`

**Method:** `POST`

**Query Parameters:**
- `format` (optional): `png` | `svg` (default: `png`)
- `quality` (optional): `low` | `medium` | `high` (default: `medium`)
- `bg` (optional): `transparent` | `white` (default: `white`)

**Request Body:**
```json
{
  "diagram": {
    "nodes": [...],
    "connections": [...],
    "zones": [...]
  }
}
```

### Response

**Success (200):**
- Content-Type: `image/png` or `image/svg+xml`
- Body: Image file binary data
- Headers include `Content-Disposition` with filename

**Error (400/500):**
```json
{
  "error": "Error message",
  "details": "Detailed error information"
}
```

### JavaScript Example

```javascript
async function exportDiagram(diagramData) {
  const response = await fetch('/api/export?format=png&quality=medium&bg=white', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ diagram: diagramData }),
  });
  
  if (response.ok) {
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    
    // Use the image URL
    const img = document.createElement('img');
    img.src = url;
    document.body.appendChild(img);
    
    // Or download the image
    const a = document.createElement('a');
    a.href = url;
    a.download = 'diagram.png';
    a.click();
  } else {
    const error = await response.json();
    console.error('Export failed:', error);
  }
}
```

### cURL Example

```bash
curl -X POST "https://yourapp.com/api/export?format=png&quality=high&bg=white" \
  -H "Content-Type: application/json" \
  -d '{
    "diagram": {
      "nodes": [...],
      "connections": [...],
      "zones": [...]
    }
  }' \
  --output diagram.png
```

### Quality Settings

- **low**: 1x pixel ratio (faster, smaller file)
- **medium**: 2x pixel ratio (balanced)
- **high**: 4x pixel ratio (slower, larger file, best quality)

### Server-Side Rendering

**Note:** True server-side rendering requires Puppeteer or Playwright. The current implementation returns a viewer URL that can be used with a headless browser for rendering.

To implement full server-side rendering:

1. Install Puppeteer or Playwright
2. Update `src/lib/server-export.ts` with headless browser rendering
3. The API will then return actual image files

See `src/lib/server-export.ts` for example implementation code.

## Conference Page Integration

### Example HTML

```html
<!DOCTYPE html>
<html>
<head>
    <title>Conference - Architecture Overview</title>
</head>
<body>
    <h1>System Architecture</h1>
    
    <!-- Interactive Viewer -->
    <div class="diagram-container">
        <h2>Explore the Architecture</h2>
        <iframe 
            src="https://yourapp.com/viewer?url=https://conference.example.com/diagrams/architecture.json"
            width="100%"
            height="600"
            frameborder="0"
            style="border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);"
        ></iframe>
    </div>
    
    <!-- Static Image (for email/PDF) -->
    <div class="diagram-image">
        <h2>Architecture Diagram</h2>
        <img 
            src="https://yourapp.com/api/export?format=png&quality=high&bg=white"
            alt="System Architecture"
            style="max-width: 100%; height: auto;"
        />
    </div>
</body>
</html>
```

### Best Practices

1. **Use Interactive Viewer for:**
   - Conference pages and blogs
   - Documentation sites
   - Interactive demos
   - Complex diagrams that benefit from exploration

2. **Use Static Images for:**
   - Email newsletters
   - PDF documents
   - Print materials
   - Simple diagrams
   - When interactivity isn't needed

3. **Performance:**
   - Cache viewer URLs when possible
   - Use appropriate quality settings for images
   - Consider lazy loading for multiple diagrams

4. **Accessibility:**
   - Always include `alt` text for static images
   - Ensure iframe has appropriate `title` attribute
   - Provide alternative text descriptions

## Error Handling

### Common Errors

**"Missing required parameter: either 'json' or 'url' must be provided"**
- Solution: Ensure URL contains either `?json=` or `?url=` parameter

**"Failed to decode JSON parameter"**
- Solution: Verify base64 encoding is correct

**"JSON size exceeds maximum limit"**
- Solution: Reduce diagram complexity or split into multiple diagrams

**"Failed to fetch JSON: [error]"**
- Solution: Check remote URL is accessible and returns valid JSON

**"Invalid diagram format"**
- Solution: Ensure JSON matches DiagramWeaver schema

### Error Display

The viewer displays user-friendly error messages when:
- JSON cannot be loaded
- JSON is invalid
- Remote URL is unreachable
- Diagram format is incorrect

## Testing

A test page is available at `/viewer-test.html` that demonstrates:
- Interactive viewer embedding
- Static image export
- URL parameter encoding
- Error handling

## Support

For issues or questions:
1. Check the test page: `/viewer-test.html`
2. Review error messages in browser console
3. Verify JSON format matches DiagramWeaver schema
4. Check network requests in browser DevTools

## Future Enhancements

Planned features:
- Signed URLs for private diagrams
- Custom theme support via URL parameters
- Embeddable widget with custom styling
- Webhook support for diagram updates
- CDN integration for static exports
