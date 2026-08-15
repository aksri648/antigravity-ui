package handlers

import (
	"bytes"
	"compress/gzip"
	"io"
	"testing"
	"time"
)

func TestEncodeSnapshotToProtobuf(t *testing.T) {
	snap := TelemetrySnapshot{
		Timestamp:     "12:00:00",
		UnixSeconds:   1700000000,
		CPUPercent:    4.2,
		MemoryAllocMB: 3.14,
		MemorySysMB:   12.8,
		MemoryPercent: 72.5,
		Goroutines:    12,
		DBOpenConns:   2,
		DBInUseConns:  1,
		ActiveSockets: 0,
		NetRxKBs:      25.4,
		NetTxKBs:      30.1,
	}

	protoBytes := EncodeSnapshotToProtobuf(snap)
	if len(protoBytes) == 0 {
		t.Fatalf("Expected non-empty protobuf bytes")
	}

	t.Logf("Snapshot Protobuf Size: %d bytes (vs JSON ~250 bytes)", len(protoBytes))
}

func TestEncodePlatformTelemetryToProtobuf(t *testing.T) {
	var telemetry PlatformTelemetry
	telemetry.Platform.Name = "DELTA SaaS Platform"
	telemetry.Platform.Version = "2.5.0"
	telemetry.Platform.UptimeSeconds = 86400
	telemetry.System.CPUUsagePercent = 3.5
	telemetry.System.MemoryTotalMB = 512
	telemetry.System.MemoryUsagePercent = 74.0
	telemetry.Runtime.AllocMB = 3.2
	telemetry.Runtime.Goroutines = 9
	telemetry.Timestamp = time.Now()

	for i := 0; i < 30; i++ {
		telemetry.History = append(telemetry.History, TelemetrySnapshot{
			Timestamp:     "12:00:00",
			UnixSeconds:   int64(1700000000 + i),
			CPUPercent:    3.5,
			MemoryAllocMB: 3.2,
			MemorySysMB:   12.5,
			MemoryPercent: 74.0,
			Goroutines:    9,
			DBOpenConns:   1,
		})
	}

	protoBytes := EncodePlatformTelemetryToProtobuf(telemetry)
	if len(protoBytes) == 0 {
		t.Fatalf("Expected non-empty protobuf bytes")
	}

	gzBytes, err := CompressGzip(protoBytes)
	if err != nil {
		t.Fatalf("Gzip compression failed: %v", err)
	}

	// Decompress and verify
	gr, err := gzip.NewReader(bytes.NewReader(gzBytes))
	if err != nil {
		t.Fatalf("Gzip reader creation failed: %v", err)
	}
	defer gr.Close()

	decompressed, err := io.ReadAll(gr)
	if err != nil {
		t.Fatalf("Gzip decompression failed: %v", err)
	}

	if !bytes.Equal(decompressed, protoBytes) {
		t.Fatalf("Decompressed data mismatch")
	}

	t.Logf("Full Telemetry Protobuf Size: %d bytes", len(protoBytes))
	t.Logf("Full Telemetry Protobuf + Gzip Size: %d bytes (-%d%%)", len(gzBytes), 100-(len(gzBytes)*100/len(protoBytes)))
}
