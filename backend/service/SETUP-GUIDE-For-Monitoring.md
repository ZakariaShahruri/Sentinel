# Uptime Kuma – Monitoring Setup Guide

# Team EN-04

## What you are monitoring

| Name           | URL                                                                          |
| -------------- | ---------------------------------------------------------------------------- |
| Frontend       | https://team-en04-frontend-itip-en-04.apps.okd.ucll.cloud                    |
| Backend Health | https://team-en04-backend-itip-en-04.apps.okd.ucll.cloud/api/test-connection |

---

## Step 1 – Deploy Uptime Kuma on OKD

Make sure you are logged into OKD and in the correct project/namespace, then run:

```powershell
oc apply -f uptime-kuma-pvc.yaml
oc apply -f uptime-kuma-deployment.yaml
oc apply -f uptime-kuma-service.yaml
oc apply -f uptime-kuma-route.yaml
```

Check that the pod is running:

```powershell
oc get pods -l app=uptime-kuma
```

Wait until STATUS shows `Running`. Then get your dashboard URL:

```powershell
oc get route uptime-kuma
```

Copy the HOST/PORT value — that is your Uptime Kuma URL.

> NOTE: The deployment uses `louislam/uptime-kuma:2-rootless`.
> This is required on OpenShift because the regular image tries to
> run chown as root, which OpenShift blocks. The rootless image works fine.

---

## Step 2 – First login

1. Open the route URL in your browser (add https:// in front if needed)
2. You will see a registration screen — create an admin username and password

---

## Step 3 – Add Monitor: Frontend

1. Click **Add New Monitor**
2. Fill in the following:
   - Monitor Type: HTTP(s)
   - Friendly Name: Frontend EN-04
   - URL: https://team-en04-frontend-itip-en-04.apps.okd.ucll.cloud
   - Heartbeat Interval: 60 (seconds)
   - Retry Interval: 60 (seconds)
   - Max Retries: 3
   - Accepted Status: 200-299

3. Click **Save**

---

## Step 4 – Add Monitor: Backend Health

1. Click **Add New Monitor**
2. Fill in the following:
   - Monitor Type: HTTP(s)
   - Friendly Name: Backend Health EN-04
   - URL: https://team-en04-backend-itip-en-04.apps.okd.ucll.cloud/api/test-connection
   - Heartbeat Interval: 60 (seconds)
   - Retry Interval: 60 (seconds)
   - Max Retries: 3
   - Accepted Status: 200-299

3. Click **Save**

Both monitors will start checking immediately.

---

## Step 5 – Set up Discord alerting

1. In Discord server, go to the channel where you want alerts
2. Click the gear icon (Edit Channel) → Integrations → Webhooks → New Webhook
3. Give it a name "Uptime Kuma" and copy the Webhook URL

Back in Uptime Kuma:

1. Go to Settings → Notifications → Add Notification
2. Notification Type: Discord
3. Paste your Webhook URL
4. Click Test – you should get a test message in Discord
5. Click Save

---

## Step 7 – Attach notifications to both monitors

1. Open the Frontend EN-04 monitor → click Edit
2. Scroll down to Notifications
3. Toggle ON Discord notifications
4. Save

Repeat for the Backend Health EN-04 monitor.

---

## What you get

- A live dashboard showing uptime history for both services
- An alert on Discord whenever a service goes down
  (only after 3 failed retries = ~ minutes of downtime before alert fires)
- An alert when the service comes back up

---
