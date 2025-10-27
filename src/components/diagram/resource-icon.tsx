"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Server, User } from "lucide-react";

interface ResourceIconProps extends React.SVGProps<SVGSVGElement> {
  type: string; // Format: provider.category.resourcename (e.g., aws.compute.ec2)
  imagePath?: string; // If provided, use this exact icon path (legacy support)
}

export function ResourceIcon({ type, imagePath, ...props }: ResourceIconProps) {
  const [idx, setIdx] = useState(0);
  const [resourceFile, setResourceFile] = useState<string | null>(null);

  // Look up file from resource catalog based on type
  useEffect(() => {
    const parts = type.split('.');
    if (parts.length >= 3) {
      const provider = parts[0];
      const category = parts[1];
      const resourceName = parts.slice(2).join('-').toLowerCase();
      
      // Fetch the resource catalog to get the correct filename
      fetch(`/resources/resource-${provider}.json`)
        .then(res => res.json())
        .then(data => {
          const categoryData = data.categories?.[category];
          if (categoryData?.resources) {
            // Find the resource that matches the resourceName (derived from type)
            // Look for resources where name.toLowerCase().replace(/\s+/g, '-') matches resourceName
            const resource = categoryData.resources.find((r: {name: string, file: string}) => 
              r.name.replace(/\s+/g, '-').toLowerCase() === resourceName
            );
            if (resource?.file) {
              setResourceFile(resource.file);
            }
          }
        })
        .catch(() => {
          // Silently fail, will use fallback
        });
    }
  }, [type]);

  const candidates = useMemo(() => {
    const list: string[] = [];
    const parts = type.split('.');
    
    // If imagePath is explicitly provided, use only that
    if (imagePath) {
      list.push(imagePath);
      return list;
    }
    
    // If we found the file from resource catalog, use it
    if (resourceFile && parts.length >= 3) {
      const provider = parts[0];
      const category = parts[1];
      list.push(`/resources/${provider}/${category}/${resourceFile}`);
      return list;
    }
    
    // Derive path from type: provider.category.resourcename (fallback)
    if (parts.length >= 3) {
      const provider = parts[0];
      const category = parts[1];
      const resourceName = parts.slice(2).join('-').toLowerCase();
      // Derived by convention
      list.push(`/resources/${provider}/${category}/${resourceName}.png`);
      // Provider-specific aliases (Kubernetes short filenames)
      if (provider === 'k8s') {
        const k8sMap: Record<string, string> = {
          kubernetes: 'infra/master.png',
          pod: 'pod.png',
          deployment: 'deploy.png',
          statefulset: 'sts.png',
          daemonset: 'ds.png',
          job: 'job.png',
          cronjob: 'cronjob.png',
          replicaset: 'rs.png',
          service: 'svc.png',
          ingress: 'ing.png',
          networkpolicy: 'netpol.png',
          endpoint: 'ep.png',
          persistentvolume: 'pv.png',
          persistentvolumeclaim: 'pvc.png',
          storageclass: 'sc.png',
          volume: 'vol.png',
          'api-server': 'api.png',
          apiserver: 'api.png',
          scheduler: 'sched.png',
          'controller-manager': 'c-m.png',
          'cloud-controller-manager': 'c-c-m.png',
          'kube-proxy': 'k-proxy.png',
          kubelet: 'kubelet.png',
        };
        const alias = k8sMap[resourceName];
        if (alias) list.push(`/resources/k8s/${category}/${alias}`);
      }
    }
    return Array.from(new Set(list));
  }, [type, resourceFile, imagePath]);

  useEffect(() => setIdx(0), [type, resourceFile, imagePath]);

  const src = candidates[idx];
  if (src) {
    return (
      <img
        src={src}
        alt={type}
        onError={() => setIdx(i => (i + 1 < candidates.length ? i + 1 : i + 1))}
        width={props.width || '40'}
        height={props.height || '40'}
        style={{ width: props.width || '40px', height: props.height || '40px', objectFit: 'contain' }}
      />
    );
  }

  // Handle legacy generic resources
  const parts = type.split('.');
  if (type.startsWith('generic.') && parts.length === 2) {
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
      const p = `/resources/${provider}/${mapping.category}/${mapping.file}.png`;
      return (
        <img
          src={p}
          alt={type}
          onError={() => setIdx(i => i + 1)}
          width={props.width || '40'}
          height={props.height || '40'}
          style={{ width: props.width || '40px', height: props.height || '40px', objectFit: 'contain' }}
        />
      );
    }
  }

  switch (type) {
    case "user":
      return <User {...props} />;
    case "generic.server":
      return <Server {...props} />;
    default:
      return (
        <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
        </svg>
      );
  }
}
