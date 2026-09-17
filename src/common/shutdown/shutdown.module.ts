import { Module } from '@nestjs/common';
import { ObservabilityModule } from '../observability/observability.module.js';
import { EmergencyShutdownSink } from './emergency-shutdown-sink.js';
import { ShutdownCoordinatorService } from './shutdown-coordinator.service.js';

@Module({
  imports: [ObservabilityModule],
  providers: [EmergencyShutdownSink, ShutdownCoordinatorService],
  exports: [ShutdownCoordinatorService],
})
export class ShutdownModule {}
