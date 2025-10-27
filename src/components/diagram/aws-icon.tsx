"use client";

import React, { useState } from "react";
import { Server, User } from "lucide-react";

interface AwsIconProps extends React.SVGProps<SVGSVGElement> {
  type: string;
  imagePath?: string; // If provided, use this exact icon path
}

export function AwsIcon({ type, imagePath, ...props }: AwsIconProps) {
  const [imageError, setImageError] = useState(false);

  // If an explicit imagePath is provided, prefer it for exact parity with browser
  if (imagePath && !imageError) {
    return (
      <img
        src={imagePath}
        alt={type}
        onError={() => setImageError(true)}
        width={props.width || '40'}
        height={props.height || '40'}
        style={{
          width: props.width || '40px',
          height: props.height || '40px',
          objectFit: 'contain'
        }}
      />
    );
  }
  
  // Handle all provider resources by loading PNG files derived from type
  const parts = type.split('.');
  if (parts.length >= 3) {
    const provider = parts[0];
    const category = parts[1];
    const resourceName = parts.slice(2).join('-').toLowerCase();
    const derivedPath = `/resources/${provider}/${category}/${resourceName}.png`;
    
    if (!imageError) {
      return (
        <img
          src={derivedPath}
          alt={type}
          onError={() => setImageError(true)}
          width={props.width || '40'}
          height={props.height || '40'}
          style={{ 
            width: props.width || '40px', 
            height: props.height || '40px',
            objectFit: 'contain'
          }}
        />
      );
    }
  }
  
  // Handle legacy generic resources
  if (type.startsWith('generic.')) {
    if (parts.length === 2) {
      // Handle legacy simple types like "generic.server"
      const provider = parts[0];
      const typeMap: Record<string, { category: string; file: string }> = {
        'server': { category: 'compute', file: 'server' },
        'vm': { category: 'compute', file: 'vm' },
        'database': { category: 'database', file: 'database' },
        'load-balancer': { category: 'network', file: 'load-balancer' },
        'gateway': { category: 'network', file: 'gateway' },
        'router': { category: 'network', file: 'router' },
        'switch': { category: 'network', file: 'switch' },
        'firewall': { category: 'network', file: 'firewall' },
        'storage': { category: 'storage', file: 'storage' }
      };
      
      const mapping = typeMap[parts[1].toLowerCase()];
      if (mapping) {
        const imagePath = `/resources/${provider}/${mapping.category}/${mapping.file}.png`;
        
        if (!imageError) {
          return (
            <img
              src={imagePath}
              alt={type}
              onError={() => setImageError(true)}
              width={props.width || '40'}
              height={props.height || '40'}
              style={{ 
                width: props.width || '40px', 
                height: props.height || '40px',
                objectFit: 'contain'
              }}
            />
          );
        }
      }
    }
  }
  
  switch (type) {
    case "user":
      return <User {...props} />;
    case "generic.server":
      return <Server {...props} />;
    case "aws.network.APIGateway":
      return (
        <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8h-2a2 2 0 10-4 0H5v11h14V8zM5 8V5a2 2 0 012-2h10a2 2 0 012 2v3" />
          <path d="M12 19v-5" />
          <path d="M12 8v-1" />
        </svg>
      );
    case "aws.compute.Kubernetes":
      return (
        <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 8l-8 4 8 4 8-4-8-4z" />
            <path d="M4 12l8 4 8-4" />
            <path d="M12 20V12" />
            <path d="M4 12v4a8 8 0 0016 0v-4" />
        </svg>
      );
    case "aws.applicationintegration.EventBridge":
        return (
            <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 5l-8 8h6v6l8-8h-6V5z" />
                <path d="M3.5 3.5l17 17" />
            </svg>
        );
    case "aws.analytics.Kinesis":
       return (
        <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 5L5 19" />
            <path d="M12 5h7v7" />
            <path d="M12 19H5v-7" />
        </svg>
       );
    case "aws.compute.Lambda":
      return (
        <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M15.59 4.34a2 2 0 010 2.82l-5.66 5.66a2 2 0 00-2.82 0l-5.66 5.66a2 2 0 01-2.82-2.82l5.66-5.66a2 2 0 000-2.82l5.66-5.66a2 2 0 012.82 0z" />
          <path d="M17 11l-1.17-1.17" />
          <path d="M21.24 15.24l-5.66 5.66a2 2 0 01-2.82 0l-5.66-5.66a2 2 0 010-2.82l5.66-5.66a2 2 0 012.82 0z" />
        </svg>
      );
    case "aws.storage.S3":
      return (
        <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12.25c0-4.01-4.7-7.25-10.5-7.25S0 8.24 0 12.25c0 4.02 4.7 7.25 10.5 7.25S21 16.27 21 12.25z" transform="scale(1.14 1) translate(-1.5 -0.1)" />
            <path d="M12 12.25c-5.8 0-10.5-1.79-10.5-4s4.7-4 10.5-4 10.5 1.79 10.5 4" />
        </svg>
      );
    case "aws.database.RDS":
       return (
        <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <ellipse cx="12" cy="5" rx="9" ry="3" />
            <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
            <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
        </svg>
       );
    case "generic.text.text":
      // Return null for text type - no icon, just text
      return null;
    default:
      return (
        <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
        </svg>
      );
  }
}
