"""
OpenTelemetry instrumentation setup for Bulgarian Voice Coach
"""

import logging
import os

from opentelemetry import metrics, trace
from opentelemetry.exporter.otlp.proto.grpc.metric_exporter import OTLPMetricExporter
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from opentelemetry.instrumentation.httpx import HTTPXClientInstrumentor
from opentelemetry.instrumentation.logging import LoggingInstrumentor
from opentelemetry.sdk.metrics import MeterProvider
from opentelemetry.sdk.metrics.export import (
    ConsoleMetricExporter,
    PeriodicExportingMetricReader,
)
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor, ConsoleSpanExporter

logger = logging.getLogger(__name__)


def setup_telemetry(service_name: str = "bulgarian-voice-coach") -> bool:
    """
    Setup OpenTelemetry instrumentation for the application

    Returns:
        bool: True if setup was successful, False otherwise
    """
    try:
        # Check if telemetry is enabled
        if not os.getenv("OTEL_ENABLED", "false").lower() == "true":
            logger.info("OpenTelemetry disabled (OTEL_ENABLED=false)")
            return False

        logger.info("🔧 Setting up OpenTelemetry instrumentation...")

        # Create resource with service information
        resource = Resource.create(
            {
                "service.name": service_name,
                "service.version": "0.1.0",
                "service.environment": os.getenv("ENVIRONMENT", "development"),
            }
        )

        # Setup tracing
        setup_tracing(resource)

        # Setup metrics
        setup_metrics(resource)

        # Setup automatic instrumentation
        setup_auto_instrumentation()

        logger.info("✅ OpenTelemetry instrumentation configured successfully")
        return True

    except Exception as e:
        logger.error(f"❌ Failed to setup OpenTelemetry: {e}")
        return False


def setup_tracing(resource: Resource):
    """Setup distributed tracing"""
    # Create tracer provider
    tracer_provider = TracerProvider(resource=resource)
    trace.set_tracer_provider(tracer_provider)

    # Configure exporters based on environment
    otlp_endpoint = os.getenv("OTEL_EXPORTER_OTLP_TRACES_ENDPOINT")
    console_export = os.getenv("OTEL_CONSOLE_EXPORT", "false").lower() == "true"

    if otlp_endpoint:
        # OTLP exporter for production
        otlp_exporter = OTLPSpanExporter(
            endpoint=otlp_endpoint, headers=_get_otlp_headers()
        )
        tracer_provider.add_span_processor(BatchSpanProcessor(otlp_exporter))
        logger.info(f"📊 Tracing configured for OTLP endpoint: {otlp_endpoint}")

    if console_export:
        # Console exporter for development
        console_exporter = ConsoleSpanExporter()
        tracer_provider.add_span_processor(BatchSpanProcessor(console_exporter))
        logger.info("📊 Console trace export enabled")


def setup_metrics(resource: Resource):
    """Setup metrics collection"""
    otlp_endpoint = os.getenv("OTEL_EXPORTER_OTLP_METRICS_ENDPOINT")
    console_export = os.getenv("OTEL_CONSOLE_EXPORT", "false").lower() == "true"

    readers = []

    if otlp_endpoint:
        # OTLP metrics exporter
        otlp_exporter = OTLPMetricExporter(
            endpoint=otlp_endpoint, headers=_get_otlp_headers()
        )
        readers.append(
            PeriodicExportingMetricReader(otlp_exporter, export_interval_millis=30000)
        )
        logger.info(f"📈 Metrics configured for OTLP endpoint: {otlp_endpoint}")

    if console_export:
        # Console metrics exporter
        console_exporter = ConsoleMetricExporter()
        readers.append(
            PeriodicExportingMetricReader(
                console_exporter, export_interval_millis=30000
            )
        )
        logger.info("📈 Console metrics export enabled")

    if readers:
        meter_provider = MeterProvider(resource=resource, metric_readers=readers)
        metrics.set_meter_provider(meter_provider)


def setup_auto_instrumentation():
    """Setup automatic instrumentation for frameworks"""
    try:
        # FastAPI instrumentation
        FastAPIInstrumentor().instrument()
        logger.info("🔧 FastAPI instrumentation enabled")

        # HTTPX instrumentation for external API calls
        HTTPXClientInstrumentor().instrument()
        logger.info("🔧 HTTPX instrumentation enabled")

        # Logging instrumentation
        LoggingInstrumentor().instrument(set_logging_format=True)
        logger.info("🔧 Logging instrumentation enabled")

    except Exception as e:
        logger.warning(f"Some instrumentations failed: {e}")


def _get_otlp_headers() -> dict:
    """Get OTLP headers from environment"""
    headers = {}

    # Common auth headers
    api_key = os.getenv("OTEL_EXPORTER_OTLP_HEADERS")
    if api_key:
        headers.update(dict(h.split("=", 1) for h in api_key.split(",")))

    return headers


class TelemetryContext:
    """Context manager for custom telemetry instrumentation"""

    def __init__(self):
        self.tracer = trace.get_tracer(__name__)
        self.meter = metrics.get_meter(__name__)

        # Create custom metrics
        self.request_counter = self.meter.create_counter(
            "requests_total", description="Total number of requests"
        )

        self.request_duration = self.meter.create_histogram(
            "request_duration_seconds", description="Request duration in seconds"
        )

        self.active_connections = self.meter.create_up_down_counter(
            "active_websocket_connections",
            description="Number of active WebSocket connections",
        )

        self.audio_processing_duration = self.meter.create_histogram(
            "audio_processing_duration_seconds",
            description="Audio processing duration in seconds",
        )

        self.llm_tokens = self.meter.create_counter(
            "llm_tokens_total", description="Total LLM tokens processed"
        )

    def trace_operation(self, operation_name: str, **attributes):
        """Create a span for tracing an operation"""
        return self.tracer.start_as_current_span(operation_name, attributes=attributes)

    def count_request(self, method: str, endpoint: str, status_code: int):
        """Count an HTTP request"""
        self.request_counter.add(
            1, {"method": method, "endpoint": endpoint, "status_code": str(status_code)}
        )

    def record_duration(self, duration: float, operation: str):
        """Record operation duration"""
        self.request_duration.record(duration, {"operation": operation})

    def update_connections(self, delta: int):
        """Update active connections count"""
        self.active_connections.add(delta)

    def record_audio_processing(self, duration: float, operation: str):
        """Record audio processing metrics"""
        self.audio_processing_duration.record(duration, {"operation": operation})

    def count_llm_tokens(self, tokens: int, provider: str, model: str):
        """Count LLM tokens"""
        self.llm_tokens.add(tokens, {"provider": provider, "model": model})


# Global telemetry context
telemetry: TelemetryContext | None = None


def get_telemetry() -> TelemetryContext | None:
    """Get the global telemetry context"""
    return telemetry


def init_telemetry() -> TelemetryContext | None:
    """Initialize telemetry and return context"""
    global telemetry

    if setup_telemetry():
        telemetry = TelemetryContext()
        return telemetry

    return None
