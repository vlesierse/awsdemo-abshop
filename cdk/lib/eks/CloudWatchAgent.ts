import * as cdk from "@aws-cdk/core";
import * as eks from "@aws-cdk/aws-eks";
import * as iam from "@aws-cdk/aws-iam";

export interface CloudWatchAgentProps {
  readonly cluster: eks.Cluster;
  readonly namespace?: string;
}

export class CloudWatchAgent extends cdk.Construct {
  constructor(scope: cdk.Construct, id: string, props: CloudWatchAgentProps) {
    super(scope, id);

    const { cluster } = props;
    const namespace = props.namespace ?? "amazon-cloudwatch";
    const namespaceManifest = new eks.KubernetesManifest(this, "Namespace", {
      cluster,
      manifest: [
        {
          apiVersion: "v1",
          kind: "Namespace",
          metadata: {
            name: namespace,
          },
        },
      ],
    });

    const serviceAccount = new eks.ServiceAccount(this, "ServiceAccount", {
      cluster,
      namespace,
    });
    serviceAccount.node.addDependency(namespaceManifest);
    serviceAccount.role.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('CloudWatchAgentServerPolicy'));

    new eks.KubernetesManifest(this, "DeamonSet", {
      cluster,
      manifest: [
        {
          kind: "ClusterRole",
          apiVersion: "rbac.authorization.k8s.io/v1",
          metadata: {
            name: "cloudwatch-agent-role",
          },
          rules: [
            {
              apiGroups: [""],
              resources: ["pods", "nodes", "endpoints"],
              verbs: ["list", "watch"],
            },
            {
              apiGroups: ["apps"],
              resources: ["replicasets"],
              verbs: ["list", "watch"],
            },
            {
              apiGroups: ["batch"],
              resources: ["jobs"],
              verbs: ["list", "watch"],
            },
            {
              apiGroups: [""],
              resources: ["nodes/proxy"],
              verbs: ["get"],
            },
            {
              apiGroups: [""],
              resources: ["nodes/stats", "configmaps", "events"],
              verbs: ["create"],
            },
            {
              apiGroups: [""],
              resources: ["configmaps"],
              resourceNames: ["cwagent-clusterleader"],
              verbs: ["get", "update"],
            },
          ],
        },
        {
          kind: "ClusterRoleBinding",
          apiVersion: "rbac.authorization.k8s.io/v1",
          metadata: {
            name: "cloudwatch-agent-role-binding",
          },
          subjects: [
            {
              kind: "ServiceAccount",
              name: serviceAccount.serviceAccountName,
              namespace: namespace,
            },
          ],
          roleRef: {
            kind: "ClusterRole",
            name: "cloudwatch-agent-role",
            apiGroup: "rbac.authorization.k8s.io",
          },
        },
        {
          apiVersion: "v1",
          kind: "ConfigMap",
          metadata: {
            name: "cwagentconfig",
            namespace: "amazon-cloudwatch",
          },
          data: {
            "cwagentconfig.json": JSON.stringify({
              logs: {
                metrics_collected: {
                  kubernetes: {
                    cluster_name: cluster.clusterName,
                    metrics_collection_interval: 60,
                  },
                },
                force_flush_interval: 5,
              },
            }),
          },
        },
        {
          apiVersion: "apps/v1",
          kind: "DaemonSet",
          metadata: {
            name: "cloudwatch-agent",
            namespace: namespace,
          },
          spec: {
            selector: {
              matchLabels: {
                name: "cloudwatch-agent",
              },
            },
            template: {
              metadata: {
                labels: {
                  name: "cloudwatch-agent",
                },
              },
              spec: {
                containers: [
                  {
                    name: "cloudwatch-agent",
                    image: "amazon/cloudwatch-agent:1.247345.36b249270",
                    resources: {
                      limits: {
                        cpu: "200m",
                        memory: "200Mi",
                      },
                      requests: {
                        cpu: "200m",
                        memory: "200Mi",
                      },
                    },
                    env: [
                      {
                        name: "HOST_IP",
                        valueFrom: {
                          fieldRef: {
                            fieldPath: "status.hostIP",
                          },
                        },
                      },
                      {
                        name: "HOST_NAME",
                        valueFrom: {
                          fieldRef: {
                            fieldPath: "spec.nodeName",
                          },
                        },
                      },
                      {
                        name: "K8S_NAMESPACE",
                        valueFrom: {
                          fieldRef: {
                            fieldPath: "metadata.namespace",
                          },
                        },
                      },
                      {
                        name: "CI_VERSION",
                        value: "k8s/1.2.2",
                      },
                    ],
                    volumeMounts: [
                      {
                        name: "cwagentconfig",
                        mountPath: "/etc/cwagentconfig",
                      },
                      {
                        name: "rootfs",
                        mountPath: "/rootfs",
                        readOnly: true,
                      },
                      {
                        name: "dockersock",
                        mountPath: "/var/run/docker.sock",
                        readOnly: true,
                      },
                      {
                        name: "varlibdocker",
                        mountPath: "/var/lib/docker",
                        readOnly: true,
                      },
                      {
                        name: "sys",
                        mountPath: "/sys",
                        readOnly: true,
                      },
                      {
                        name: "devdisk",
                        mountPath: "/dev/disk",
                        readOnly: true,
                      },
                    ],
                  },
                ],
                volumes: [
                  {
                    name: "cwagentconfig",
                    configMap: {
                      name: "cwagentconfig",
                    },
                  },
                  {
                    name: "rootfs",
                    hostPath: {
                      path: "/",
                    },
                  },
                  {
                    name: "dockersock",
                    hostPath: {
                      path: "/var/run/docker.sock",
                    },
                  },
                  {
                    name: "varlibdocker",
                    hostPath: {
                      path: "/var/lib/docker",
                    },
                  },
                  {
                    name: "sys",
                    hostPath: {
                      path: "/sys",
                    },
                  },
                  {
                    name: "devdisk",
                    hostPath: {
                      path: "/dev/disk/",
                    },
                  },
                ],
                terminationGracePeriodSeconds: 60,
                serviceAccountName: serviceAccount.serviceAccountName,
              },
            },
          },
        },
      ],
    });
  }
}
