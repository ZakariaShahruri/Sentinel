#include <Arduino.h>
#include <Wire.h>
#include <MPU6050.h>
#include <RH_ASK.h>
#include <SPI.h>
#include "../include/config.h"
extern "C"
{
#include <aes.h>
}

// ── Hardware ───────────────────────────────────────────────────────────────
const uint8_t MPU_ADDR = 0x68;
MPU6050 mpu(MPU_ADDR);
RH_ASK driver(4800, 11, 12, 10);

#if NODE_ID == 0x01
const uint8_t LED_GREEN_NODE  = 5;
const uint8_t LED_YELLOW_NODE = 6;
const uint8_t LED_RED_NODE    = 7;

const int16_t  NODE_MED_THRESHOLD  = 200;
const int16_t  NODE_HIGH_THRESHOLD = 800;
const uint32_t NODE_LED_HOLD_MS    = 350;

static uint32_t node_led_off_at_ms = 0;
#endif

// ── Packet constants ───────────────────────────────────────────────────────
const uint8_t  HEADER_ID              = 0x04;
const uint16_t SAMPLE_INTERVAL_MS     = 11;
const uint16_t PACKET_INTERVAL_MS     = 180;
const uint8_t  MAX_SAMPLES_PER_PACKET = 12;
const uint8_t  DELTA_SCALE            = 128;
const uint8_t  PACKET_FLAGS           = 0x01;
const uint8_t  PACKET_HEADER_LEN      = 5;

// ── Logging flags ──────────────────────────────────────────────────────────
const bool LOGGING_ENABLED = true;
const bool LOG_PACKET_HEX  = true;
const bool LOG_INIT_STATUS = true;
const bool LOG_RF_ERRORS   = true;

// ── AES ────────────────────────────────────────────────────────────────────
static const uint8_t AES_KEY[16] = AES_KEY_BYTES;
static const uint8_t NONCE_PREFIX[12] = {
    'S', 'N', 'T', 'L', HEADER_ID, NODE_ID, 0x00, 0x00, 0x5A, 0xC3, 0x11, 0x90};
static AES_ctx aes_ctx;

// ── Sample buffer ──────────────────────────────────────────────────────────
struct Sample { int16_t ax, ay, az; };

int16_t baseline_x = 0, baseline_y = 0, baseline_z = 0;
Sample  packet_samples[MAX_SAMPLES_PER_PACKET];
uint8_t  packet_sample_count = 0;
uint16_t packet_seq          = 0;

unsigned long last_sample_ms = 0;
unsigned long last_packet_ms = 0;

// =============================================================================
// Helpers
// =============================================================================

void calibrate(int samples = 200)
{
  long sum_x = 0, sum_y = 0, sum_z = 0;
  for (int i = 0; i < samples; i++)
  {
    int16_t ax, ay, az;
    mpu.getAcceleration(&ax, &ay, &az);
    sum_x += ax;
    sum_y += ay;
    sum_z += az;
    delay(5);
  }
  baseline_x = sum_x / samples;
  baseline_y = sum_y / samples;
  baseline_z = sum_z / samples;
}

uint8_t writeInt16LE(uint8_t *buffer, uint8_t index, int16_t value)
{
  buffer[index++] = (uint8_t)(value & 0xFF);
  buffer[index++] = (uint8_t)((value >> 8) & 0xFF);
  return index;
}

int8_t quantizeDelta(int16_t delta)
{
  int16_t q = (delta >= 0)
                  ? (delta + DELTA_SCALE / 2) / DELTA_SCALE
                  : (delta - DELTA_SCALE / 2) / DELTA_SCALE;
  if (q >  127) q =  127;
  if (q < -127) q = -127;
  return (int8_t)q;
}

void buildPacketIv(uint16_t seq, uint8_t iv[16])
{
  for (uint8_t i = 0; i < 12; i++)
    iv[i] = NONCE_PREFIX[i];
  iv[6] = (uint8_t)(seq & 0xFF);
  iv[7] = (uint8_t)((seq >> 8) & 0xFF);
  iv[12] = iv[13] = iv[14] = iv[15] = 0;
}

void encryptPayload(uint8_t *buffer, uint8_t length, uint16_t seq)
{
  if (length <= PACKET_HEADER_LEN)
    return;
  uint8_t iv[16];
  buildPacketIv(seq, iv);
  AES_init_ctx_iv(&aes_ctx, AES_KEY, iv);
  AES_CTR_xcrypt_buffer(&aes_ctx, buffer + PACKET_HEADER_LEN,
                        (size_t)(length - PACKET_HEADER_LEN));
}

void logEncryptedPacket(const uint8_t *buffer, uint8_t length)
{
  if (!LOGGING_ENABLED || !LOG_PACKET_HEX)
    return;
  Serial.print("pkt encrypted len=");
  Serial.print(length);
  Serial.print(" data=");
  for (uint8_t i = 0; i < length; i++)
  {
    if (buffer[i] < 0x10)
      Serial.print('0');
    Serial.print(buffer[i], HEX);
    if (i + 1 < length)
      Serial.print(' ');
  }
  Serial.println();
}

// =============================================================================
// LEDs — vibration node (0x01) only
// =============================================================================

#if NODE_ID == 0x01

static void updateNodeLEDs(int16_t mag)
{
  if (mag >= NODE_HIGH_THRESHOLD)
  {
    digitalWrite(LED_YELLOW_NODE, HIGH);
    digitalWrite(LED_RED_NODE,    HIGH);
  }
  else if (mag >= NODE_MED_THRESHOLD)
  {
    digitalWrite(LED_YELLOW_NODE, HIGH);
    digitalWrite(LED_RED_NODE,    LOW);
  }
  else
  {
    digitalWrite(LED_YELLOW_NODE, LOW);
    digitalWrite(LED_RED_NODE,    LOW);
  }
  node_led_off_at_ms = millis() + NODE_LED_HOLD_MS;
}

#endif // NODE_ID == 0x01

// =============================================================================
// Packet build & transmit
// =============================================================================

void transmitPacket()
{
  if (packet_sample_count == 0)
    return;

  uint8_t payload[RH_ASK_MAX_MESSAGE_LEN];
  uint8_t idx = 0;

  // ── Header (5 bytes, plaintext) ────────────────────────────────────────
  idx = writeInt16LE(payload, idx, (int16_t)packet_seq);
  payload[idx++] = PACKET_FLAGS;
  payload[idx++] = packet_sample_count;
  payload[idx++] = DELTA_SCALE;

  // ── First sample: absolute int16 LE x3 (encrypted) ────────────────────
  idx = writeInt16LE(payload, idx, packet_samples[0].ax);
  idx = writeInt16LE(payload, idx, packet_samples[0].ay);
  idx = writeInt16LE(payload, idx, packet_samples[0].az);

  // ── Delta samples (encrypted) ──────────────────────────────────────────
#if NODE_ID == 0x01
  // Sample[0] is transmitted exact — seed window_mag from it
  int16_t window_mag = max(abs(packet_samples[0].ax),
                       max(abs(packet_samples[0].ay), abs(packet_samples[0].az)));
#endif

  int16_t prev_x = packet_samples[0].ax;
  int16_t prev_y = packet_samples[0].ay;
  int16_t prev_z = packet_samples[0].az;

  for (uint8_t i = 1; i < packet_sample_count; i++)
  {
    int8_t qx = quantizeDelta(packet_samples[i].ax - prev_x);
    int8_t qy = quantizeDelta(packet_samples[i].ay - prev_y);
    int8_t qz = quantizeDelta(packet_samples[i].az - prev_z);

    payload[idx++] = (uint8_t)qx;
    payload[idx++] = (uint8_t)qy;
    payload[idx++] = (uint8_t)qz;

    // Advance using quantised reconstruction — identical to what the base decodes
    prev_x = (int16_t)(prev_x + (int16_t)qx * DELTA_SCALE);
    prev_y = (int16_t)(prev_y + (int16_t)qy * DELTA_SCALE);
    prev_z = (int16_t)(prev_z + (int16_t)qz * DELTA_SCALE);

#if NODE_ID == 0x01
    int16_t m = max(abs(prev_x), max(abs(prev_y), abs(prev_z)));
    if (m > window_mag) window_mag = m;
#endif
  }

  encryptPayload(payload, idx, packet_seq);
  logEncryptedPacket(payload, idx);

  driver.send(payload, idx);
  driver.waitPacketSent();

  packet_sample_count = 0;
  packet_seq++;

#if NODE_ID == 0x01
  updateNodeLEDs(window_mag);
#endif
}

// =============================================================================
// Sampling & scheduling
// =============================================================================

void collectSamples(unsigned long now)
{
  while (now - last_sample_ms >= SAMPLE_INTERVAL_MS)
  {
    last_sample_ms += SAMPLE_INTERVAL_MS;

    int16_t ax, ay, az;
    mpu.getAcceleration(&ax, &ay, &az);

    if (packet_sample_count < MAX_SAMPLES_PER_PACKET)
    {
      packet_samples[packet_sample_count++] = {
          (int16_t)(ax - baseline_x),
          (int16_t)(ay - baseline_y),
          (int16_t)(az - baseline_z)};
    }
  }
}

void processPackets(unsigned long now)
{
  if (packet_sample_count >= MAX_SAMPLES_PER_PACKET)
  {
    transmitPacket();
    last_packet_ms = now;
    return;
  }

  while (now - last_packet_ms >= PACKET_INTERVAL_MS)
  {
    last_packet_ms += PACKET_INTERVAL_MS;
    if (packet_sample_count > 0)
      transmitPacket();
  }
}

// =============================================================================
// Arduino entry points
// =============================================================================

void setup()
{
  Serial.begin(115200);
  Wire.begin();

#if NODE_ID == 0x01
  pinMode(LED_GREEN_NODE,  OUTPUT);
  pinMode(LED_YELLOW_NODE, OUTPUT);
  pinMode(LED_RED_NODE,    OUTPUT);
  digitalWrite(LED_GREEN_NODE,  LOW);
  digitalWrite(LED_YELLOW_NODE, LOW);
  digitalWrite(LED_RED_NODE,    LOW);
#endif

  mpu.initialize();

  if (!driver.init())
  {
    if (LOGGING_ENABLED && LOG_RF_ERRORS)
      Serial.println("RF init failed");
  }
  driver.setHeaderId(HEADER_ID);
  driver.setHeaderFrom(NODE_ID);

  delay(500);
  calibrate(200);

#if NODE_ID == 0x01
  digitalWrite(LED_GREEN_NODE, HIGH);
#endif

  if (LOGGING_ENABLED && LOG_INIT_STATUS)
    Serial.println("#ready");

  unsigned long now = millis();
  last_sample_ms = now;
  last_packet_ms = now;
}

void loop()
{
  unsigned long now = millis();

#if NODE_ID == 0x01
  if (node_led_off_at_ms > 0 && millis() >= node_led_off_at_ms)
  {
    digitalWrite(LED_YELLOW_NODE, LOW);
    digitalWrite(LED_RED_NODE,    LOW);
    node_led_off_at_ms = 0;
  }
#endif

  collectSamples(now);
  processPackets(now);
}
