# Ollama Configuration

DiagramWeaver uses a centralized configuration system for Ollama connection settings.

## Configuration File

The configuration is managed in `src/lib/ollama-config.ts` and includes:

- **Base URL**: Ollama server endpoint (default: `http://localhost:11434`)
- **Model**: AI model to use (default: `llama3.2`)
- **Temperature**: Response randomness (0.0-1.0, default: 0.7)
- **Top P**: Nucleus sampling (0.0-1.0, default: 0.9)
- **Max Tokens**: Maximum response length (default: 4000)

## Environment Variables

You can override defaults using environment variables:

```bash
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2
```

## UI Configuration Editor

1. Open the Resource Browser panel
2. Click "Show Config" near the Test Connection button
3. Edit the Base URL and Model as needed
4. Click "Save" to apply changes
5. Use "Reset" to restore defaults

## Common Models

- `llama3.2` - Default choice
- `llama3.1` - Previous version
- `deepseek-v3.1:671b-cloud` - Large model (requires more resources)
- `codellama` - Code-focused model

## Testing Connection

Use the "Test Connection" button to verify your Ollama setup works with the current configuration.

## Troubleshooting

1. **Connection Failed**: Check if Ollama is running and the URL is correct
2. **Model Not Found**: Ensure the model is pulled in Ollama (`ollama pull llama3.2`)
3. **Slow Responses**: Try a smaller model or adjust temperature/max tokens