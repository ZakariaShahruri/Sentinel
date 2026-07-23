# Uptime Monitoring

Sentinel ships an [Uptime Kuma](https://github.com/louislam/uptime-kuma) stack for
health monitoring and alerting. The manifests in this directory deploy it on an
OpenShift/Kubernetes cluster; this guide covers setup.

## What is monitored

| Monitor          | URL                                              |
| ---------------- | ------------------------------------------------ |
| Frontend         | `https://<your-frontend-host>`                   |
| Backend health   | `https://<your-backend-host>/api/test-connection`|

## 1. Deploy Uptime Kuma

Log in to the cluster and select the target namespace, then apply the manifests:

```bash
oc apply -f uptime-kuma-pvc.yaml
oc apply -f uptime-kuma-deployment.yaml
oc apply -f uptime-kuma-service.yaml
oc apply -f uptime-kuma-route.yaml
```

Wait for the pod to become ready and grab its route:

```bash
oc get pods -l app=uptime-kuma
oc get route uptime-kuma
```

> The deployment pins `louislam/uptime-kuma:2-rootless`. OpenShift blocks the
> default image's root `chown`, so the rootless variant is required.

## 2. First login

Open the route URL and create an admin account on the registration screen.

## 3. Add the monitors

For each service, **Add New Monitor**:

| Field             | Frontend                         | Backend health                                    |
| ----------------- | -------------------------------- | ------------------------------------------------- |
| Monitor Type      | HTTP(s)                          | HTTP(s)                                            |
| Friendly Name     | Sentinel Frontend                | Sentinel Backend                                  |
| URL               | `https://<your-frontend-host>`   | `https://<your-backend-host>/api/test-connection` |
| Heartbeat / Retry | 60s / 60s                        | 60s / 60s                                         |
| Max Retries       | 3                                | 3                                                 |
| Accepted Status   | 200-299                          | 200-299                                           |

## 4. Alerting (Discord)

1. In your Discord channel: **Edit Channel → Integrations → Webhooks → New Webhook**, copy the URL.
2. In Uptime Kuma: **Settings → Notifications → Add Notification → Discord**, paste the webhook URL, **Test**, then **Save**.
3. Open each monitor, enable the Discord notification under **Notifications**, and save.

## What you get

- A live dashboard of uptime history for both services.
- Discord alerts when a service goes down (after 3 failed retries) and when it recovers.
