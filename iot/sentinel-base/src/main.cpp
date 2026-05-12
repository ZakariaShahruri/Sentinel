#include <Arduino.h>
#include <WiFi.h>
#include <SocketIOclient.h>
#include <ArduinoJson.h>
#include <RH_ASK.h>
#include <SPI.h>
#include <math.h>
#include <U8x8lib.h>
#include <Wire.h>
#include "../include/config.h"
extern "C"
{
#include <aes.h>
}

// ── RF driver ──────────────────────────────────────────────────────────────
RH_ASK driver(4800, 4, 2, 0);

// ── Packet constants ───────────────────────────────────────────────────────
const uint8_t HEADER_ID = 0x04;
const uint8_t PACKET_HEADER_LEN = 5;
const uint8_t MAX_SAMPLES_PER_PACKET = 12;
const bool PRINT_LAST_SAMPLE_EVERY_SEC = true;
const uint32_t REPORT_INTERVAL_MS   = 1000;
const uint32_t DISPLAY_INTERVAL_MS = 250;

// ── AES ────────────────────────────────────────────────────────────────────
static const uint8_t AES_KEY[16] = AES_KEY_BYTES;
static const uint8_t NONCE_PREFIX[12] = {
    'S', 'N', 'T', 'L', HEADER_ID, 0x01, 0x00, 0x00, 0x5A, 0xC3, 0x11, 0x90};
static AES_ctx aes_ctx;

// ── Peripherals ────────────────────────────────────────────────────────────
SocketIOclient socketIO;
U8X8_SH1106_128X64_NONAME_HW_I2C display(U8X8_PIN_NONE);

const int LED_GREEN  = 25;
const int LED_YELLOW = 26;
const int LED_RED    = 27;
bool sioConnected = false;

// ── Vibration intensity thresholds (raw ADC units, ±2g range) ─────────────
const int16_t LED_MED_THRESHOLD  = 200;
const int16_t LED_HIGH_THRESHOLD = 800;
const uint32_t LED_HOLD_MS = 350;

// ── Tilt thresholds (degrees) ──────────────────────────────────────────────
const float TILT_SLIGHT_DEG = 5.0f;
const float TILT_HEAVY_DEG  = 15.0f;

// ── State ──────────────────────────────────────────────────────────────────
static bool     wifiOk = false;
static bool     last_sample_valid = false;
static int16_t  last_sample_x = 0;
static int16_t  last_sample_y = 0;
static int16_t  last_sample_z = 0;
static uint32_t last_sample_report_ms = 0;
static uint32_t led_off_at_ms    = 0;
static uint32_t last_display_ms  = 0;
static uint32_t pkt_count = 0;

// =============================================================================
// Signal processing
// =============================================================================

static int16_t readInt16LE(const uint8_t *buffer, uint8_t &index)
{
  int16_t value = (int16_t)(buffer[index] | (buffer[index + 1] << 8));
  index += 2;
  return value;
}

static void buildPacketIv(uint16_t seq, uint8_t node_id, uint8_t iv[16])
{
  for (uint8_t i = 0; i < 12; i++)
    iv[i] = NONCE_PREFIX[i];
  iv[5] = node_id;  // must match NODE_ID in the node's NONCE_PREFIX
  iv[6] = (uint8_t)(seq & 0xFF);
  iv[7] = (uint8_t)((seq >> 8) & 0xFF);
  iv[12] = iv[13] = iv[14] = iv[15] = 0;
}

static void decryptPayload(uint8_t *buffer, uint8_t length,
                           uint16_t seq, uint8_t node_id)
{
  if (length <= PACKET_HEADER_LEN)
    return;
  uint8_t iv[16];
  buildPacketIv(seq, node_id, iv);
  AES_init_ctx_iv(&aes_ctx, AES_KEY, iv);
  AES_CTR_xcrypt_buffer(&aes_ctx, buffer + PACKET_HEADER_LEN,
                        (size_t)(length - PACKET_HEADER_LEN));
}

static int16_t computePeak(const int16_t *xs, const int16_t *ys,
                           const int16_t *zs, uint8_t count)
{
  int16_t peak = 0;
  for (uint8_t i = 0; i < count; i++)
  {
    int16_t p = max(abs(xs[i]), max(abs(ys[i]), abs(zs[i])));
    if (p > peak)
      peak = p;
  }
  return peak;
}

static int16_t computeRMS(const int16_t *xs, const int16_t *ys,
                          const int16_t *zs, uint8_t count)
{
  if (count == 0)
    return 0;
  int64_t sum = 0;
  for (uint8_t i = 0; i < count; i++)
    sum += (int64_t)xs[i] * xs[i] + (int64_t)ys[i] * ys[i] + (int64_t)zs[i] * zs[i];
  return (int16_t)sqrt((double)sum / (double)count);
}

static int16_t computeZCR(const int16_t *zs, uint8_t count)
{
  int16_t crossings = 0;
  for (uint8_t i = 1; i < count; i++)
    if ((zs[i - 1] >= 0) != (zs[i] >= 0))
      crossings++;
  return crossings;
}

// Decay: 0 = fully decayed, 100 = still at peak
static int16_t computeDecay(const int16_t *xs, const int16_t *ys,
                            const int16_t *zs, uint8_t count, int16_t peak)
{
  if (count == 0 || peak == 0)
    return 0;
  uint8_t last = count - 1;
  int16_t lastMag = max(abs(xs[last]), max(abs(ys[last]), abs(zs[last])));
  return (int16_t)(((int32_t)lastMag * 100) / peak);
}

// Tilt: averages samples then converts to roll/pitch in degrees.
// 16384 = 1g in raw ADC units at ±2g MPU6050 range.
// Valid up to ~±30° — sufficient for a marble balancing game.
static void computeTilt(const int16_t *xs, const int16_t *ys, uint8_t count,
                        float &roll, float &pitch)
{
  if (count == 0) { roll = pitch = 0.0f; return; }

  float sum_x = 0.0f, sum_y = 0.0f;
  for (uint8_t i = 0; i < count; i++)
  {
    sum_x += xs[i];
    sum_y += ys[i];
  }
  float nx = sum_x / (count * 16384.0f);
  float ny = sum_y / (count * 16384.0f);

  // Clamp to [-1, 1] to guard against asinf domain errors
  if (nx >  1.0f) nx =  1.0f;
  if (nx < -1.0f) nx = -1.0f;
  if (ny >  1.0f) ny =  1.0f;
  if (ny < -1.0f) ny = -1.0f;

  roll  =  asinf(ny) * 180.0f / (float)M_PI;
  pitch = -asinf(nx) * 180.0f / (float)M_PI;
}

// =============================================================================
// LED intensity
// =============================================================================

// GREEN stays on as a WiFi/alive indicator.
// YELLOW and RED form a two-step intensity bar, auto-clearing after LED_HOLD_MS.
static void updateIntensityLEDs(int16_t peak)
{
  if (peak >= LED_HIGH_THRESHOLD)
  {
    digitalWrite(LED_YELLOW, HIGH);
    digitalWrite(LED_RED, HIGH);
  }
  else if (peak >= LED_MED_THRESHOLD)
  {
    digitalWrite(LED_YELLOW, HIGH);
    digitalWrite(LED_RED, LOW);
  }
  else
  {
    digitalWrite(LED_YELLOW, LOW);
    digitalWrite(LED_RED, LOW);
  }
  led_off_at_ms = millis() + LED_HOLD_MS;
}

static void updateTiltLEDs(float roll, float pitch)
{
  float angle = fabsf(roll) > fabsf(pitch) ? fabsf(roll) : fabsf(pitch);
  if (angle >= TILT_HEAVY_DEG)
  {
    digitalWrite(LED_YELLOW, HIGH);
    digitalWrite(LED_RED, HIGH);
  }
  else if (angle >= TILT_SLIGHT_DEG)
  {
    digitalWrite(LED_YELLOW, HIGH);
    digitalWrite(LED_RED, LOW);
  }
  else
  {
    digitalWrite(LED_YELLOW, LOW);
    digitalWrite(LED_RED, LOW);
  }
  led_off_at_ms = millis() + LED_HOLD_MS;
}

static void flashRed()
{
  digitalWrite(LED_RED, HIGH);
  delay(80);
  digitalWrite(LED_RED, LOW);
}

// =============================================================================
// Display
// =============================================================================

// Row 0: "BASE STATION"    (static header)
// Row 1: connection status (WiFi + SIO, updated on connect/disconnect)
// Row 2-7: live vibration data (updated on each packet)

static void updateConnectionRow()
{
  char buf[17];
  snprintf(buf, sizeof(buf), "W:%-2s  S:%-2s      ",
           wifiOk       ? "OK" : "--",
           sioConnected ? "OK" : "--");
  display.clearLine(1);
  display.drawString(0, 1, buf);
}

static void updateDisplayVibration(uint8_t node_id, int16_t peak, int16_t rms,
                                   int16_t zcr, int16_t decay)
{
  char buf[17];

  snprintf(buf, sizeof(buf), "N:%02X Pkts:%lu", node_id, (unsigned long)pkt_count);
  display.clearLine(2);
  display.drawString(0, 2, buf);

  snprintf(buf, sizeof(buf), "Peak:%d", (int)peak);
  display.clearLine(3);
  display.drawString(0, 3, buf);

  snprintf(buf, sizeof(buf), "RMS: %d", (int)rms);
  display.clearLine(4);
  display.drawString(0, 4, buf);

  snprintf(buf, sizeof(buf), "ZCR: %d", (int)zcr);
  display.clearLine(5);
  display.drawString(0, 5, buf);

  snprintf(buf, sizeof(buf), "Dec: %d%%", (int)decay);
  display.clearLine(6);
  display.drawString(0, 6, buf);

  const char *level;
  if (peak >= LED_HIGH_THRESHOLD)     level = "HIGH";
  else if (peak >= LED_MED_THRESHOLD) level = "MED";
  else                                 level = "LOW";

  snprintf(buf, sizeof(buf), "Lvl: %s", level);
  display.clearLine(7);
  display.drawString(0, 7, buf);
}

static void updateDisplayTilt(uint8_t node_id, float roll, float pitch)
{
  char buf[17];

  snprintf(buf, sizeof(buf), "N:%02X Pkts:%lu", node_id, (unsigned long)pkt_count);
  display.clearLine(2);
  display.drawString(0, 2, buf);

  snprintf(buf, sizeof(buf), "Roll: %+.1f", roll);
  display.clearLine(3);
  display.drawString(0, 3, buf);

  snprintf(buf, sizeof(buf), "Ptch: %+.1f", pitch);
  display.clearLine(4);
  display.drawString(0, 4, buf);

  display.clearLine(5);
  display.clearLine(6);

  float angle = fabsf(roll) > fabsf(pitch) ? fabsf(roll) : fabsf(pitch);
  const char *status;
  if (angle >= TILT_HEAVY_DEG)       status = "HEAVY";
  else if (angle >= TILT_SLIGHT_DEG) status = "SLIGHT";
  else                                status = "LEVEL";

  snprintf(buf, sizeof(buf), "Tilt: %s", status);
  display.clearLine(7);
  display.drawString(0, 7, buf);
}

// =============================================================================
// SocketIO — emit computed features to the backend
// =============================================================================

static void emitFeatures(uint8_t node_id, int16_t seq, uint8_t count, uint8_t scale,
                         int16_t peak, int16_t rms, int16_t zcr, int16_t decay,
                         int16_t lastx, int16_t lasty, int16_t lastz)
{
  JsonDocument doc;
  JsonArray arr = doc.to<JsonArray>();
  arr.add("sentinel_data");

  JsonObject data = arr.add<JsonObject>();
  data["room"]    = SYNCWORD;
  data["node_id"] = node_id;
  data["seq"]     = seq;
  data["count"]   = count;
  data["scale"]   = scale;
  data["peak"]    = peak;
  data["rms"]     = rms;
  data["zcr"]     = zcr;
  data["decay"]   = decay;
  data["lastx"]   = lastx;
  data["lasty"]   = lasty;
  data["lastz"]   = lastz;

  String payload;
  serializeJson(doc, payload);
  socketIO.sendEVENT(payload);

  Serial.printf("[SIO] -> peak=%d rms=%d zcr=%d decay=%d\n",
                peak, rms, zcr, decay);
}

static void emitTilt(uint8_t node_id, int16_t seq, float roll, float pitch)
{
  JsonDocument doc;
  JsonArray arr = doc.to<JsonArray>();
  arr.add("game_data");

  JsonObject data = arr.add<JsonObject>();
  data["room"]    = SYNCWORD;
  data["node_id"] = node_id;
  data["seq"]     = seq;
  data["roll"]    = roll;
  data["pitch"]   = pitch;

  String payload;
  serializeJson(doc, payload);
  socketIO.sendEVENT(payload);

  Serial.printf("[SIO] -> roll=%.1f pitch=%.1f\n", roll, pitch);
}

// =============================================================================
// SocketIO event handler
// =============================================================================

void onSioEvent(socketIOmessageType_t type, uint8_t *payload, size_t length)
{
  switch (type)
  {
  case sIOtype_DISCONNECT:
    sioConnected = false;
    Serial.println("[SIO] Disconnected");
    updateConnectionRow();
    break;

  case sIOtype_CONNECT:
    sioConnected = true;
    Serial.println("[SIO] Connected");
    socketIO.send(sIOtype_CONNECT, "/");
    updateConnectionRow();
    {
      JsonDocument joinDoc;
      JsonArray joinArr = joinDoc.to<JsonArray>();
      joinArr.add("joinRoom");
      joinArr.add(SYNCWORD);
      String joinPayload;
      serializeJson(joinDoc, joinPayload);
      socketIO.sendEVENT(joinPayload);
      Serial.printf("[SIO] Joined room: %s\n", SYNCWORD);
    }
    break;

  case sIOtype_ERROR:
    Serial.println("[SIO] Error");
    break;

  default:
    break;
  }
}

// =============================================================================
// WiFi
// =============================================================================

static void connectWifi()
{
  wifiOk = false;
  digitalWrite(LED_GREEN, LOW);
  updateConnectionRow();

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  Serial.print("[WiFi] Connecting");
  while (WiFi.status() != WL_CONNECTED)
  {
    delay(500);
    Serial.print(".");
  }
  Serial.printf("\n[WiFi] Connected — IP: %s\n", WiFi.localIP().toString().c_str());
  wifiOk = true;
  digitalWrite(LED_GREEN, HIGH);
  updateConnectionRow();
}

static void printReject(const char *reason, uint8_t got, size_t expected)
{
  Serial.print("[RF] Reject: ");
  Serial.print(reason);
  if (expected > 0)
  {
    Serial.print(" (got=");
    Serial.print(got);
    Serial.print(", expected=");
    Serial.print((uint16_t)expected);
    Serial.print(")");
  }
  Serial.println();
}

// =============================================================================
// Arduino entry points
// =============================================================================

void setup()
{
  Serial.begin(9600);

  pinMode(LED_GREEN,  OUTPUT);
  pinMode(LED_YELLOW, OUTPUT);
  pinMode(LED_RED,    OUTPUT);
  digitalWrite(LED_GREEN,  LOW);
  digitalWrite(LED_YELLOW, LOW);
  digitalWrite(LED_RED,    LOW);

  Wire.begin();
  display.begin();
  display.setFont(u8x8_font_chroma48medium8_r);
  display.drawString(0, 0, "BASE STATION");
  display.drawString(0, 1, "W:--  S:--");
  display.drawString(0, 2, "Pkts:0");
  display.drawString(0, 3, "Peak:--");
  display.drawString(0, 4, "RMS: --");
  display.drawString(0, 5, "ZCR: --");
  display.drawString(0, 6, "Dec: --%");
  display.drawString(0, 7, "Lvl: --");

  if (!driver.init())
    Serial.println("[RF] Init failed");
  driver.setHeaderId(HEADER_ID);
  Serial.println("[RF] Receiver ready");

  connectWifi();

  socketIO.begin(WS_HOST, WS_PORT, WS_PATH);
  socketIO.onEvent(onSioEvent);
  socketIO.setReconnectInterval(3000);

  Serial.println("[base] Ready");
}

void loop()
{
  socketIO.loop();

  // Auto-clear intensity LEDs after hold time
  if (led_off_at_ms > 0 && millis() >= led_off_at_ms)
  {
    digitalWrite(LED_YELLOW, LOW);
    digitalWrite(LED_RED,    LOW);
    led_off_at_ms = 0;
  }

  if (WiFi.status() != WL_CONNECTED)
  {
    Serial.println("[WiFi] Lost — reconnecting...");
    sioConnected = false;
    connectWifi();
  }

  // ── 1. Receive RF packet ───────────────────────────────────────────────
  uint8_t buf[64];
  uint8_t buflen = sizeof(buf);

  if (driver.recv(buf, &buflen) && driver.headerId() == HEADER_ID)
  {
    if (buflen < PACKET_HEADER_LEN)
    {
      printReject("Too short", buflen, PACKET_HEADER_LEN);
      flashRed();
    }
    else
    {
      uint8_t index = 0;

      int16_t packet_seq = readInt16LE(buf, index);
      /* flags = */ index++;
      uint8_t sample_count = buf[index++];
      uint8_t scale = buf[index++];

      if (sample_count == 0)
      {
        printReject("Empty packet", 0, 0);
        flashRed();
      }
      else if (sample_count > MAX_SAMPLES_PER_PACKET)
      {
        printReject("Count too large", sample_count, MAX_SAMPLES_PER_PACKET);
        flashRed();
      }
      else
      {
        size_t expected_len = PACKET_HEADER_LEN + 6 + (size_t)(sample_count - 1) * 3;
        if ((size_t)buflen < expected_len)
        {
          printReject("Truncated", buflen, expected_len);
          flashRed();
        }
        else
        {
          // ── 2. Read node ID from RF header ─────────────────────────────
          uint8_t node_id = driver.headerFrom();

          // ── 3. Decrypt ─────────────────────────────────────────────────
          decryptPayload(buf, buflen, (uint16_t)packet_seq, node_id);

          // ── 4. Decode samples ───────────────────────────────────────────
          int16_t dx = readInt16LE(buf, index);
          int16_t dy = readInt16LE(buf, index);
          int16_t dz = readInt16LE(buf, index);

          int16_t sample_x[MAX_SAMPLES_PER_PACKET];
          int16_t sample_y[MAX_SAMPLES_PER_PACKET];
          int16_t sample_z[MAX_SAMPLES_PER_PACKET];
          sample_x[0] = dx;
          sample_y[0] = dy;
          sample_z[0] = dz;

          for (uint8_t i = 1; i < sample_count; i++)
          {
            dx = (int16_t)(dx + (int16_t)((int8_t)buf[index++]) * scale);
            dy = (int16_t)(dy + (int16_t)((int8_t)buf[index++]) * scale);
            dz = (int16_t)(dz + (int16_t)((int8_t)buf[index++]) * scale);
            sample_x[i] = dx;
            sample_y[i] = dy;
            sample_z[i] = dz;
          }

          last_sample_x = dx;
          last_sample_y = dy;
          last_sample_z = dz;
          last_sample_valid = true;

          pkt_count++;

          // ── 5. Per-node dispatch ────────────────────────────────────────
          switch (node_id)
          {
          case 0x01:
          {
            int16_t peak  = computePeak(sample_x, sample_y, sample_z, sample_count);
            int16_t rms   = computeRMS(sample_x, sample_y, sample_z, sample_count);
            int16_t zcr   = computeZCR(sample_z, sample_count);
            int16_t decay = computeDecay(sample_x, sample_y, sample_z, sample_count, peak);

            updateIntensityLEDs(peak);
            if (millis() - last_display_ms >= DISPLAY_INTERVAL_MS)
            {
              updateDisplayVibration(node_id, peak, rms, zcr, decay);
              last_display_ms = millis();
            }

            if (sioConnected)
              emitFeatures(node_id, packet_seq, sample_count, scale,
                           peak, rms, zcr, decay,
                           sample_x[sample_count - 1],
                           sample_y[sample_count - 1],
                           sample_z[sample_count - 1]);
            else
              Serial.println("[SIO] Not connected — data dropped");
            break;
          }

          case 0x02:
          {
            float roll, pitch;
            computeTilt(sample_x, sample_y, sample_count, roll, pitch);

            updateTiltLEDs(roll, pitch);
            if (millis() - last_display_ms >= DISPLAY_INTERVAL_MS)
            {
              updateDisplayTilt(node_id, roll, pitch);
              last_display_ms = millis();
            }

            if (sioConnected)
              emitTilt(node_id, packet_seq, roll, pitch);
            else
              Serial.println("[SIO] Not connected — data dropped");
            break;
          }

          default:
            Serial.printf("[RF] Unknown node 0x%02X — packet ignored\n", node_id);
            break;
          }
        }
      }
    }
  }

  // ── Periodic raw sample log ────────────────────────────────────────────
  if (PRINT_LAST_SAMPLE_EVERY_SEC)
  {
    uint32_t now = millis();
    if (now - last_sample_report_ms >= REPORT_INTERVAL_MS)
    {
      last_sample_report_ms = now;
      if (last_sample_valid)
        Serial.printf("[RF] sample ax=%d ay=%d az=%d\n",
                      last_sample_x, last_sample_y, last_sample_z);
      else
        Serial.println("[RF] sample none");
    }
  }
}
