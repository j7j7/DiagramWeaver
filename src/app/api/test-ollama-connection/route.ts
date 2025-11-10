import { NextRequest, NextResponse } from 'next/server';
import { ollamaConfig } from '@/lib/ollama-config';

export async function POST(request: NextRequest) {
  try {
    // Get Ollama configuration from centralized config
    const config = ollamaConfig.get();
    const baseUrl = config.baseUrl;
    const model = config.model;
    
    // Test connection with a simple "hello" prompt
    const response = await fetch(`${baseUrl}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model,
        prompt: 'hello',
        stream: false,
        options: {
          temperature: 0.1,
          num_predict: 10
        }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Ollama API error:', response.status, errorText);
      return NextResponse.json(
        { 
          success: false, 
          error: `Ollama API error: ${response.status} ${response.statusText}` 
        },
        { status: 500 }
      );
    }

    const data = await response.json();
    
    // Return success response with the model's reply
    return NextResponse.json({
      success: true,
      response: data.response,
      model: model,
      baseUrl: baseUrl
    });

  } catch (error) {
    console.error('Connection test error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return NextResponse.json(
      { 
        success: false, 
        error: `Connection failed: ${errorMessage}` 
      },
      { status: 500 }
    );
  }
}