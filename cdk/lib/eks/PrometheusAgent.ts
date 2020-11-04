import * as cdk from "@aws-cdk/core";
import * as eks from "@aws-cdk/aws-eks";
import * as iam from "@aws-cdk/aws-iam";

export interface PrometheusAgentProps {
  readonly cluster: eks.Cluster;
  readonly namespace?: string;
}

export class PrometheusAgent extends cdk.Construct {
  constructor(scope: cdk.Construct, id: string, props: PrometheusAgentProps) {
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
    serviceAccount.role.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName("CloudWatchAgentServerPolicy")
    );

    new eks.KubernetesManifest(this, "DeamonSet", {
      cluster,
      manifest: [
        {
          kind: "ClusterRole",
          apiVersion: "rbac.authorization.k8s.io/v1",
          metadata: {
            name: "cwagent-prometheus-role",
          },
          rules: [
            {
              apiGroups: [""],
              resources: [
                "nodes",
                "nodes/proxy",
                "services",
                "endpoints",
                "pods",
              ],
              verbs: ["get", "list", "watch"],
            },
            {
              apiGroups: ["extensions"],
              resources: ["ingresses"],
              verbs: ["get", "list", "watch"],
            },
            {
              nonResourceURLs: ["/metrics"],
              verbs: ["get"],
            },
          ],
        },
        {
          kind: "ClusterRoleBinding",
          apiVersion: "rbac.authorization.k8s.io/v1",
          metadata: {
            name: "cwagent-prometheus-role-binding",
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
            name: "cwagent-prometheus-role",
            apiGroup: "rbac.authorization.k8s.io",
          },
        },
        {
          apiVersion: "v1",
          kind: "ConfigMap",
          metadata: {
            name: "prometheus-cwagentconfig",
            namespace: "amazon-cloudwatch",
          },
          data: {
            "cwagentconfig.json": JSON.stringify({
              logs: {
                metrics_collected: {
                  prometheus: {
                    prometheus_config_path:
                      "/etc/prometheusconfig/prometheus.yaml",
                    emf_processor: {
                      metric_declaration_dedup: true,
                      metric_declaration: [
                        {
                          "source_labels": ["Service"],
                          "label_matcher": ".*nginx.*",
                          "dimensions": [["Service","Namespace","ClusterName"]],
                          "metric_selectors": [
                            "^nginx_ingress_controller_(requests|success)$",
                            "^nginx_ingress_controller_nginx_process_connections$",
                            "^nginx_ingress_controller_nginx_process_connections_total$",
                            "^nginx_ingress_controller_nginx_process_resident_memory_bytes$",
                            "^nginx_ingress_controller_nginx_process_cpu_seconds_total$",
                            "^nginx_ingress_controller_config_last_reload_successful$"
                          ]
                        },
                        {
                          "source_labels": ["Service"],
                          "label_matcher": ".*nginx.*",
                          "dimensions": [["Service","Namespace","ClusterName","ingress"],["Service","Namespace","ClusterName","status"]],
                          "metric_selectors": ["^nginx_ingress_controller_requests$"]
                        },
                        {
                          "source_labels": ["Service", "frontend"],
                          "label_matcher": ".*haproxy-ingress-controller.*;(httpfront-shared-frontend|httpfront-default-backend|httpsfront)",
                          "dimensions": [["Service","Namespace","ClusterName","frontend","code"]],
                          "metric_selectors": [
                            "^haproxy_frontend_http_responses_total$"
                          ]
                        },
                        {
                          "source_labels": ["Service", "backend"],
                          "label_matcher": ".*haproxy-ingress-controller.*;(httpback-shared-backend|httpback-default-backend|httpsback-shared-backend)",
                          "dimensions": [["Service","Namespace","ClusterName","backend","code"]],
                          "metric_selectors": [
                            "^haproxy_backend_http_responses_total$"
                          ]
                        },
                        {
                          "source_labels": ["Service"],
                          "label_matcher": ".*haproxy-ingress-controller.*",
                          "dimensions": [["Service","Namespace","ClusterName"]],
                          "metric_selectors": [
                            "^haproxy_backend_up$",
                            "^haproxy_backend_bytes_(in|out)_total$",
                            "^haproxy_backend_connections_total$",
                            "^haproxy_backend_connection_errors_total$",
                            "^haproxy_backend_current_sessions$",
                            "^haproxy_frontend_bytes_(in|out)_total$",
                            "^haproxy_frontend_connections_total$",
                            "^haproxy_frontend_http_requests_total$",
                            "^haproxy_frontend_request_errors_total$",
                            "^haproxy_frontend_requests_denied_total$",
                            "^haproxy_frontend_current_sessions$"
                          ]
                        },
                        {
                          "source_labels": ["Service"],
                          "label_matcher": ".*memcached.*",
                          "dimensions": [["Service","Namespace","ClusterName"]],
                          "metric_selectors": [
                            "^memcached_current_(bytes|items|connections)$",
                            "^memcached_items_(reclaimed|evicted)_total$",
                            "^memcached_(written|read)_bytes_total$",
                            "^memcached_limit_bytes$",
                            "^memcached_commands_total$"
                          ]
                        },
                        {
                          "source_labels": ["Service", "status", "command"],
                          "label_matcher": ".*memcached.*;hit;get",
                          "dimensions": [["Service","Namespace","ClusterName","status","command"]],
                          "metric_selectors": [
                            "^memcached_commands_total$"
                          ]
                        },
                        {
                          "source_labels": ["Service", "command"],
                          "label_matcher": ".*memcached.*;(get|set)",
                          "dimensions": [["Service","Namespace","ClusterName","command"]],
                          "metric_selectors": [
                            "^memcached_commands_total$"
                          ]
                        },
                        {
                          "source_labels": ["container_name"],
                          "label_matcher": "^envoy$",
                          "dimensions": [["ClusterName","Namespace"]],
                          "metric_selectors": [
                            "^envoy_http_downstream_rq_(total|xx)$",
                            "^envoy_cluster_upstream_cx_(r|t)x_bytes_total$",
                            "^envoy_cluster_membership_(healthy|total)$",
                            "^envoy_server_memory_(allocated|heap_size)$",
                            "^envoy_cluster_upstream_cx_(connect_timeout|destroy_local_with_active_rq)$",
                            "^envoy_cluster_upstream_rq_(pending_failure_eject|pending_overflow|timeout|per_try_timeout|rx_reset|maintenance_mode)$",
                            "^envoy_http_downstream_cx_destroy_remote_active_rq$",
                            "^envoy_cluster_upstream_flow_control_(paused_reading_total|resumed_reading_total|backed_up_total|drained_total)$",
                            "^envoy_cluster_upstream_rq_retry$",
                            "^envoy_cluster_upstream_rq_retry_(success|overflow)$",
                            "^envoy_server_(version|uptime|live)$"
                          ]
                        },
                        {
                          "source_labels": ["container_name"],
                          "label_matcher": "^envoy$",
                          "dimensions": [["ClusterName","Namespace","envoy_http_conn_manager_prefix","envoy_response_code_class"]],
                          "metric_selectors": [
                            "^envoy_http_downstream_rq_xx$"
                          ]
                        },
                        {
                          "source_labels": ["job"],
                          "label_matcher": "^kubernetes-pod-jmx$",
                          "dimensions": [["ClusterName","Namespace"]],
                          "metric_selectors": [
                            "^jvm_threads_(current|daemon)$",
                            "^jvm_classes_loaded$",
                            "^java_lang_operatingsystem_(freephysicalmemorysize|totalphysicalmemorysize|freeswapspacesize|totalswapspacesize|systemcpuload|processcpuload|availableprocessors|openfiledescriptorcount)$",
                            "^catalina_manager_(rejectedsessions|activesessions)$",
                            "^jvm_gc_collection_seconds_(count|sum)$",
                            "^catalina_globalrequestprocessor_(bytesreceived|bytessent|requestcount|errorcount|processingtime)$"
                          ]
                        },
                        {
                          "source_labels": ["job"],
                          "label_matcher": "^kubernetes-pod-jmx$",
                          "dimensions": [["ClusterName","Namespace","area"]],
                          "metric_selectors": [
                            "^jvm_memory_bytes_used$"
                          ]
                        },
                        {
                          "source_labels": ["job"],
                          "label_matcher": "^kubernetes-pod-jmx$",
                          "dimensions": [["ClusterName","Namespace","pool"]],
                          "metric_selectors": [
                            "^jvm_memory_pool_bytes_used$"
                          ]
                        },
                        {
                          source_labels: ["job"],
                          label_matcher: "abshop",
                          dimensions: [["ClusterName", "Namespace", "app", "version"]],
                          metric_selectors: [
                            "^abshop_orders$",
                            "^abshop_oneclick$",
                          ],
                        },
                      ],
                    },
                  },
                },
                force_flush_interval: 5,
              },
            }),
          },
        },
        {
          apiVersion: "v1",
          kind: "ConfigMap",
          metadata: {
            name: "prometheus-config",
            namespace: "amazon-cloudwatch",
          },
          data: {
            "prometheus.yaml": `
global:
  scrape_interval: 1m
  scrape_timeout: 10s
scrape_configs:
- job_name: 'kubernetes-pod-appmesh-envoy'
  sample_limit: 10000
  metrics_path: /stats/prometheus
  kubernetes_sd_configs:
  - role: pod
  relabel_configs:
  - source_labels: [__meta_kubernetes_pod_container_name]
    action: keep
    regex: '^envoy$'
  - source_labels: [__address__, __meta_kubernetes_pod_annotation_prometheus_io_port]
    action: replace
    regex: ([^:]+)(?::\d+)?;(\d+)
    replacement: ${1}:9901
    target_label: __address__
  - action: labelmap
    regex: __meta_kubernetes_pod_label_(.+)
  - action: replace
    source_labels:
    - __meta_kubernetes_namespace
    target_label: Namespace
  - source_labels: [__meta_kubernetes_pod_name]
    action: replace
    target_label: pod_name
  - action: replace
    source_labels:
    - __meta_kubernetes_pod_container_name
    target_label: container_name
  - action: replace
    source_labels:
    - __meta_kubernetes_pod_controller_name
    target_label: pod_controller_name
  - action: replace
    source_labels:
    - __meta_kubernetes_pod_controller_kind
    target_label: pod_controller_kind
  - action: replace
    source_labels:
    - __meta_kubernetes_pod_phase
    target_label: pod_phase
- job_name: kubernetes-service-endpoints
  sample_limit: 10000
  kubernetes_sd_configs:
  - role: endpoints
  relabel_configs:
  - action: keep
    regex: true
    source_labels:
    - __meta_kubernetes_service_annotation_prometheus_io_scrape
  - action: replace
    regex: (https?)
    source_labels:
    - __meta_kubernetes_service_annotation_prometheus_io_scheme
    target_label: __scheme__
  - action: replace
    regex: (.+)
    source_labels:
    - __meta_kubernetes_service_annotation_prometheus_io_path
    target_label: __metrics_path__
  - action: replace
    regex: ([^:]+)(?::\d+)?;(\d+)
    replacement: $1:$2
    source_labels:
    - __address__
    - __meta_kubernetes_service_annotation_prometheus_io_port
    target_label: __address__
  - action: labelmap
    regex: __meta_kubernetes_service_label_(.+)
  - action: replace
    source_labels:
    - __meta_kubernetes_namespace
    target_label: Namespace
  - action: replace
    source_labels:
    - __meta_kubernetes_service_name
    target_label: Service
  - action: replace
    source_labels:
    - __meta_kubernetes_pod_node_name
    target_label: kubernetes_node
  - action: replace
    source_labels:
    - __meta_kubernetes_pod_name
    target_label: pod_name
  - action: replace
    source_labels:
    - __meta_kubernetes_pod_container_name
    target_label: container_name
- job_name: 'abshop'
  sample_limit: 10000
  metrics_path: /api/v1/metrics
  kubernetes_sd_configs:
  - role: pod
  relabel_configs:
  - source_labels: [__address__]
    action: keep
    regex: '.*:8080$'
  - action: labelmap
    regex: __meta_kubernetes_pod_label_(.+)
  - action: replace
    source_labels:
    - __meta_kubernetes_namespace
    target_label: Namespace
  - source_labels: [__meta_kubernetes_pod_name]
    action: replace
    target_label: pod_name
  - action: replace
    source_labels:
    - __meta_kubernetes_pod_container_name
    target_label: container_name
  - action: replace
    source_labels:
    - __meta_kubernetes_pod_controller_name
    target_label: pod_controller_name
  - action: replace
    source_labels:
    - __meta_kubernetes_pod_controller_kind
    target_label: pod_controller_kind
  - action: replace
    source_labels:
    - __meta_kubernetes_pod_phase
    target_label: pod_phase
            `,
          },
        },
        {
          apiVersion: "apps/v1",
          kind: "Deployment",
          metadata: {
            name: "cwagent-prometheus",
            namespace: "amazon-cloudwatch",
          },
          spec: {
            replicas: 1,
            selector: {
              matchLabels: {
                app: "cwagent-prometheus",
              },
            },
            template: {
              metadata: {
                labels: {
                  app: "cwagent-prometheus",
                },
              },
              spec: {
                containers: [
                  {
                    name: "cloudwatch-agent",
                    image: "amazon/cloudwatch-agent:1.248913.0-prometheus",
                    imagePullPolicy: "Always",
                    resources: {
                      limits: {
                        cpu: "1000m",
                        memory: "1000Mi",
                      },
                      requests: {
                        cpu: "200m",
                        memory: "200Mi",
                      },
                    },
                    env: [
                      {
                        name: "CI_VERSION",
                        value: "k8s/1.2.1-prometheus",
                      },
                    ],
                    volumeMounts: [
                      {
                        name: "prometheus-cwagentconfig",
                        mountPath: "/etc/cwagentconfig",
                      },
                      {
                        name: "prometheus-config",
                        mountPath: "/etc/prometheusconfig",
                      },
                    ],
                  },
                ],
                volumes: [
                  {
                    name: "prometheus-cwagentconfig",
                    configMap: {
                      name: "prometheus-cwagentconfig",
                    },
                  },
                  {
                    name: "prometheus-config",
                    configMap: {
                      name: "prometheus-config",
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
