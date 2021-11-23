import * as cdk from "@aws-cdk/core";
import * as eks from "@aws-cdk/aws-eks";
import * as iam from "@aws-cdk/aws-iam";

export interface AppMeshGatewayProps {
  cluster: eks.Cluster;
  name?: string;
  namespace?: string;
}

export class AppMeshGateway extends cdk.Construct {
  constructor(scope: cdk.Construct, id: string, props: AppMeshGatewayProps) {
    super(scope, id);

    const { cluster } = props;
    const namespace = props.namespace ?? "default";
    const name = props.name ?? "gateway";

    const serviceAccount = new eks.ServiceAccount(this, 'ServiceAccount', {
      cluster, namespace
    });
    serviceAccount.role.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName("AWSAppMeshEnvoyAccess")
    );

    // Namespace
    new eks.KubernetesManifest(this, "Manifest", {
      cluster,
      manifest: [
        {
          apiVersion: "appmesh.k8s.aws/v1beta2",
          kind: "VirtualGateway",
          metadata: {
            name,
            namespace,
          },
          spec: {
            namespaceSelector: {
              matchLabels: {
                gateway: name,
              },
            },
            podSelector: {
              matchLabels: {
                app: name,
              },
            },
            listeners: [
              {
                portMapping: {
                  port: 8088,
                  protocol: "http",
                },
              },
            ],
          },
        },
        {
          apiVersion: "v1",
          kind: "Service",
          metadata: {
            name,
            namespace,
            annotations: {
              "service.beta.kubernetes.io/aws-load-balancer-type": "nlb",
            },
          },
          spec: {
            type: "LoadBalancer",
            ports: [
              {
                port: 80,
                targetPort: 8088,
                name: "http",
              },
            ],
            selector: {
              app: name,
            },
          },
        },
        {
          apiVersion: "apps/v1",
          kind: "Deployment",
          metadata: {
            name,
            namespace,
          },
          spec: {
            replicas: 1,
            selector: {
              matchLabels: {
                app: name,
              },
            },
            template: {
              metadata: {
                labels: {
                  app: name,
                },
              },
              spec: {
                serviceAccountName: serviceAccount.serviceAccountName,
                containers: [
                  {
                    name: "envoy",
                    image:
                      "840364872350.dkr.ecr.eu-west-1.amazonaws.com/aws-appmesh-envoy:v1.20.0.1-prod",
                    ports: [
                      {
                        containerPort: 8088,
                      },
                    ],
                  },
                ],
              },
            },
          },
        },
      ],
    });
  }
}
